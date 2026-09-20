from typing import List, Optional
from fastapi import HTTPException, status

from app.models.order import Order, OrderItem, ORDER_STATUSES
from app.models.product import Product
from app.db.mongodb import to_oid
from app.schemas.order import OrderCreate, OrderStatusUpdate, OrderResponse
from app.services.audit_service import record_audit_log


async def create_order(
    business_id: str,
    user_id: Optional[str],
    req: OrderCreate,
    db=None,
) -> OrderResponse:
    subtotal = 0.0
    items_to_add = []

    for item in req.items:
        product = await Product.find_one(
            Product.id == to_oid(item.product_id),
            Product.business_id == business_id,
        )
        if not product:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Product {item.product_id} not found in this business")

        line_total = round(item.unit_price * item.qty, 2)
        subtotal += line_total
        items_to_add.append(
            OrderItem(
                order_id="temp",
                product_id=str(item.product_id),
                qty=item.qty,
                unit_price=item.unit_price,
                line_total=line_total,
            )
        )

    total_amount = round(subtotal + req.delivery_fee, 2)

    order = Order(
        business_id=business_id,
        branch_id=str(req.branch_id) if req.branch_id else None,
        customer_id=str(req.customer_id) if req.customer_id else None,
        status="CREATED",
        subtotal=round(subtotal, 2),
        delivery_fee=req.delivery_fee,
        total_amount=total_amount,
        delivery_address=req.delivery_address,
        delivery_pin=req.delivery_pin,
        notes=req.notes,
        created_by=str(user_id) if user_id else None,
    )
    await order.insert()

    for oi in items_to_add:
        oi.order_id = str(order.id)
        await oi.insert()

    await record_audit_log(
        action="ORDER_CREATE",
        business_id=business_id,
        user_id=str(user_id) if user_id else None,
        entity_type="Order",
        entity_id=str(order.id),
        changes={"total_amount": float(order.total_amount), "status": order.status},
    )

    order_dict = order.model_dump()
    order_items = await OrderItem.find(OrderItem.order_id == str(order.id)).to_list()
    order_dict["items"] = [item.model_dump() for item in order_items]

    return OrderResponse.model_validate(order_dict)


async def list_orders(
    business_id: str,
    status_filter: Optional[str] = None,
    limit: int = 50,
    db=None,
) -> List[OrderResponse]:
    query = Order.find(Order.business_id == business_id)
    if status_filter:
        query = query.find(Order.status == status_filter)

    orders = await query.sort(-Order.created_at).limit(limit).to_list()
    results = []
    for order in orders:
        order_dict = order.model_dump()
        items = await OrderItem.find(OrderItem.order_id == str(order.id)).to_list()
        order_dict["items"] = [item.model_dump() for item in items]
        results.append(OrderResponse.model_validate(order_dict))
    return results


async def get_order_by_id(
    business_id: str,
    order_id: str,
    db=None,
) -> OrderResponse:
    order = await Order.find_one(Order.id == to_oid(order_id), Order.business_id == business_id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    order_dict = order.model_dump()
    items = await OrderItem.find(OrderItem.order_id == str(order.id)).to_list()
    order_dict["items"] = [item.model_dump() for item in items]
    return OrderResponse.model_validate(order_dict)


async def update_order_status(
    business_id: str,
    order_id: str,
    user_id: str,
    req: OrderStatusUpdate,
    db=None,
) -> OrderResponse:
    if req.status not in ORDER_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status '{req.status}'. Allowed: {ORDER_STATUSES}",
        )

    order = await Order.find_one(Order.id == to_oid(order_id), Order.business_id == business_id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    old_status = order.status
    update_data = {"status": req.status}
    if req.rider_name is not None:
        update_data["rider_name"] = req.rider_name
    if req.rider_phone is not None:
        update_data["rider_phone"] = req.rider_phone
    if req.eta_minutes is not None:
        update_data["eta_minutes"] = req.eta_minutes

    await order.set(update_data)

    await record_audit_log(
        action="ORDER_STATUS_UPDATE",
        business_id=business_id,
        user_id=user_id,
        entity_type="Order",
        entity_id=str(order.id),
        changes={"old_status": old_status, "new_status": req.status},
    )

    order_dict = order.model_dump()
    items = await OrderItem.find(OrderItem.order_id == str(order.id)).to_list()
    order_dict["items"] = [item.model_dump() for item in items]
    return OrderResponse.model_validate(order_dict)
