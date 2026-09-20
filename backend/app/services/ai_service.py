import re
from datetime import date, datetime, time, timezone
from typing import Optional

from app.models.product import Product
from app.models.inventory import Inventory, Batch
from app.models.transaction import Sale
from app.models.alert import Alert
from app.models.order import Order
from app.models.ai import VoiceCommand
from app.schemas.order import AIChatRequest, AIChatResponse


async def parse_and_process_ai_query(
    business_id: str,
    user_id: str,
    branch_id: Optional[str],
    message: str,
    db=None,
) -> AIChatResponse:
    text = message.strip()
    lower = text.lower()

    # -----------------------------------------------------------------------
    # WRITE INTENTS (Require Confirmation)
    # -----------------------------------------------------------------------
    sell_match = re.search(r'(?:sell|dispense|bill)\s+(\d+)\s*(?:piece|unit|strip|strips|pcs|pieces)?\s+(?:of\s+)?([a-zA-Z0-9\s]+)', lower)
    if sell_match:
        qty = int(sell_match.group(1))
        prod_query = sell_match.group(2).strip()

        # Simplistic regex search in Python, good enough for mock
        products = await Product.find(Product.business_id == business_id, Product.status == "ACTIVE").to_list()
        product = next((p for p in products if prod_query in p.name.lower()), None)

        if not product:
            return AIChatResponse(
                message=f"I could not find active product matching '{prod_query}' in your pharmacy inventory.",
                action_type=None,
            )

        today_dt = datetime.combine(date.today(), datetime.min.time()).replace(tzinfo=timezone.utc)
        batches = await Batch.find(
            Batch.product_id == str(product.id),
            Batch.qty_remaining >= qty,
        ).to_list()
        valid_batches = [b for b in batches if datetime.combine(b.expiry_date, datetime.min.time()).replace(tzinfo=timezone.utc) > today_dt]
        valid_batches.sort(key=lambda b: b.expiry_date)
        batch = valid_batches[0] if valid_batches else None

        invs = await Inventory.find(Inventory.product_id == str(product.id)).to_list()
        total_qty = sum(inv.qty_on_hand for inv in invs)

        if total_qty < qty:
            return AIChatResponse(
                message=f"Insufficient stock for {product.name}. Available: {total_qty}, Requested: {qty}.",
                action_type=None,
            )

        batch_str = f", batch {batch.batch_no} (expires {batch.expiry_date})" if batch else ""
        unit_price = float(product.selling_price)
        total_price = round(unit_price * qty, 2)

        prompt = (
            f"I found {product.name}{batch_str}. "
            f"{qty} units will be deducted from inventory at ₹{unit_price}/unit (Total: ₹{total_price}). "
            f"Please confirm to proceed with this sale."
        )

        cmd = VoiceCommand(
            user_id=user_id,
            business_id=business_id,
            transcript=text,
            language="en",
            intent="CREATE_SALE",
            entities={
                "product_id": str(product.id),
                "product_name": product.name,
                "qty": qty,
                "batch_id": str(batch.id) if batch else None,
                "unit_price": unit_price,
                "branch_id": branch_id if branch_id else None,
            },
            action_type="WRITE",
            confirmed=False,
            execution_status="PENDING",
        )
        await cmd.insert()

        return AIChatResponse(
            message=prompt,
            action_type="WRITE",
            requires_confirmation=True,
            confirmation_prompt=prompt,
            intent="CREATE_SALE",
            entities=cmd.entities,
            command_id=str(cmd.id),
        )

    # -----------------------------------------------------------------------
    # READ INTENTS (Execute immediately)
    # -----------------------------------------------------------------------

    stock_match = re.search(r'(?:how many|stock|quantity|available|count|check stock)\s*(?:of|for)?\s*([a-zA-Z0-9\s]+)', lower)
    if stock_match and not any(w in lower for w in ["low", "out of", "today", "alert"]):
        prod_query = stock_match.group(1).replace("available", "").replace("are", "").strip()
        if prod_query:
            products = await Product.find(Product.business_id == business_id).to_list()
            matched_products = [p for p in products if prod_query in p.name.lower()]

            if matched_products:
                responses = []
                for p in matched_products:
                    invs = await Inventory.find(Inventory.product_id == str(p.id)).to_list()
                    q = sum(inv.qty_on_hand for inv in invs)
                    status_text = "In Stock" if q > 0 else "OUT OF STOCK"
                    responses.append(f"• {p.name} (SKU: {p.sku}): {q} units ({status_text}, ₹{p.selling_price})")
                msg = f"Stock status for '{prod_query}':\n" + "\n".join(responses)
                return AIChatResponse(message=msg, action_type="READ", intent="CHECK_STOCK")

    if "low stock" in lower or "running low" in lower:
        products = await Product.find(Product.business_id == business_id).to_list()
        low_items = []
        for p in products:
            invs = await Inventory.find(Inventory.product_id == str(p.id)).to_list()
            qty = sum(inv.qty_on_hand for inv in invs)
            if 0 < qty <= p.reorder_level:
                low_items.append((p.name, p.sku, qty, p.reorder_level))

        if not low_items:
            return AIChatResponse(
                message="All products currently have stock above their reorder levels. No low stock alerts.",
                action_type="READ",
                intent="GET_LOW_STOCK",
            )
        msg = f"Found {len(low_items)} low-stock product(s):\n" + "\n".join(
            [f"• {name} (SKU: {sku}): {qty} left (Reorder level: {reorder})" for name, sku, qty, reorder in low_items]
        )
        return AIChatResponse(message=msg, action_type="READ", intent="GET_LOW_STOCK")

    if "out of stock" in lower or "zero stock" in lower:
        products = await Product.find(Product.business_id == business_id).to_list()
        oos = []
        for p in products:
            invs = await Inventory.find(Inventory.product_id == str(p.id)).to_list()
            qty = sum(inv.qty_on_hand for inv in invs)
            if qty <= 0:
                oos.append((p.name, p.sku))

        if not oos:
            return AIChatResponse(
                message="Great news! No products are currently out of stock.",
                action_type="READ",
                intent="GET_OUT_OF_STOCK",
            )
        msg = f"The following {len(oos)} product(s) are completely out of stock:\n" + "\n".join(
            [f"• {name} (SKU: {sku})" for name, sku in oos]
        )
        return AIChatResponse(message=msg, action_type="READ", intent="GET_OUT_OF_STOCK")

    if "today" in lower and ("sale" in lower or "revenue" in lower or "sell" in lower):
        today_start = datetime.combine(date.today(), time.min, tzinfo=timezone.utc)
        sales = await Sale.find(Sale.business_id == business_id, Sale.created_at >= today_start).to_list()
        count = len(sales)
        revenue = sum(float(s.total_amount) for s in sales)

        return AIChatResponse(
            message=f"Today's Sales Summary: {count} transaction(s) recorded with total revenue of ₹{revenue:,.2f}.",
            action_type="READ",
            intent="GET_TODAY_SALES",
        )

    if "alert" in lower or "warning" in lower:
        alerts = await Alert.find(Alert.business_id == business_id, Alert.is_resolved == False).limit(5).to_list()
        if not alerts:
            return AIChatResponse(
                message="There are no unresolved alerts for your pharmacy.",
                action_type="READ",
                intent="GET_ALERTS",
            )
        msg = f"You have active alerts:\n" + "\n".join([f"• [{a.severity}] {a.title}: {a.message}" for a in alerts])
        return AIChatResponse(message=msg, action_type="READ", intent="GET_ALERTS")

    if "order" in lower:
        orders = await Order.find(
            Order.business_id == business_id,
            {"status": {"$in": ["CREATED", "CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY"]}}
        ).limit(5).to_list()
        if not orders:
            return AIChatResponse(
                message="There are currently no pending express delivery orders.",
                action_type="READ",
                intent="GET_ORDERS",
            )
        msg = f"Active express delivery orders ({len(orders)}):\n" + "\n".join(
            [f"• Order {str(o.id)[:8]}: Status {o.status}, Total ₹{o.total_amount}, ETA {o.eta_minutes or 30} mins" for o in orders]
        )
        return AIChatResponse(message=msg, action_type="READ", intent="GET_ORDERS")

    return AIChatResponse(
        message=(
            f"Hello! I am your PharmaCare Clinical AI Assistant. You can ask me:\n"
            f"• 'How many Paracetamol are available?' (Check inventory)\n"
            f"• 'Show low stock' or 'Out of stock'\n"
            f"• 'Today's sales?'\n"
            f"• 'Show active alerts'\n"
            f"• 'Sell 10 Paracetamol' (Requires explicit confirmation)"
        ),
        action_type="READ",
    )
