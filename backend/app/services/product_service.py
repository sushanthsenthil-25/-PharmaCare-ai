from typing import Optional
from datetime import datetime, timezone
from fastapi import HTTPException, status

from app.models.product import Product, Category
from app.db.mongodb import to_oid
from app.schemas.product import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    ProductListResponse,
    CategoryCreate,
    CategoryResponse,
)
from app.services.audit_service import record_audit_log


# ---------------------------------------------------------------------------
# Categories
# ---------------------------------------------------------------------------

async def create_category(business_id: str, user_id: str, req: CategoryCreate, db=None) -> CategoryResponse:
    existing = await Category.find_one(
        Category.business_id == business_id,
        Category.name == req.name,
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Category already exists")

    category = Category(
        business_id=business_id,
        name=req.name,
        parent_id=str(req.parent_id) if req.parent_id else None,
    )
    await category.insert()

    await record_audit_log(
        action="CATEGORY_CREATE",
        business_id=business_id,
        user_id=user_id,
        entity_type="Category",
        entity_id=str(category.id),
        changes={"name": category.name},
    )
    return CategoryResponse.model_validate(category.model_dump())


async def list_categories(business_id: str, db=None) -> list[CategoryResponse]:
    categories = await Category.find(
        Category.business_id == business_id,
        Category.is_active == True,
    ).to_list()
    return [CategoryResponse.model_validate(c.model_dump()) for c in categories]


# ---------------------------------------------------------------------------
# Products
# ---------------------------------------------------------------------------

async def create_product(business_id: str, user_id: str, req: ProductCreate, db=None) -> ProductResponse:
    existing_sku = await Product.find_one(
        Product.business_id == business_id,
        Product.sku == req.sku,
    )
    if existing_sku:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Product with SKU '{req.sku}' already exists in your business",
        )

    if req.category_id:
        cat = await Category.find_one(
            Category.id == to_oid(req.category_id),
            Category.business_id == business_id,
        )
        if not cat:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    product = Product(
        business_id=business_id,
        sku=req.sku,
        name=req.name,
        category_id=str(req.category_id) if req.category_id else None,
        manufacturer=req.manufacturer,
        description=req.description,
        composition=req.composition,
        purchase_price=req.purchase_price,
        selling_price=req.selling_price,
        mrp=req.mrp,
        reorder_level=req.reorder_level,
        rx_required=req.rx_required,
        image_url=req.image_url,
        status=req.status,
    )
    await product.insert()

    await record_audit_log(
        action="PRODUCT_CREATE",
        business_id=business_id,
        user_id=user_id,
        entity_type="Product",
        entity_id=str(product.id),
        changes={"sku": product.sku, "name": product.name, "selling_price": float(product.selling_price)},
    )
    return ProductResponse.model_validate(product.model_dump())


async def get_product_by_id(business_id: str, product_id: str, db=None) -> ProductResponse:
    product = await Product.find_one(
        Product.id == to_oid(product_id),
        Product.business_id == business_id,
    )
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return ProductResponse.model_validate(product.model_dump())


async def list_products(
    business_id: str,
    category_id: Optional[str] = None,
    search: Optional[str] = None,
    status_filter: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
    db=None,
) -> ProductListResponse:
    conditions = [Product.business_id == business_id]

    if category_id:
        conditions.append(Product.category_id == category_id)
    if status_filter:
        conditions.append(Product.status == status_filter)

    query = Product.find(*conditions)

    if search:
        import re
        pattern = re.compile(search, re.IGNORECASE)
        # Filter in Python for text search (good enough for hackathon)
        all_items = await query.to_list()
        all_items = [
            p for p in all_items
            if pattern.search(p.name or "") or pattern.search(p.sku or "") or pattern.search(p.manufacturer or "")
        ]
        total = len(all_items)
        items = all_items[(page - 1) * page_size: page * page_size]
    else:
        total = await query.count()
        items = await query.sort(+Product.name).skip((page - 1) * page_size).limit(page_size).to_list()

    return ProductListResponse(
        items=[ProductResponse.model_validate(p.model_dump()) for p in items],
        total=total,
        page=page,
        page_size=page_size,
    )


async def update_product(
    business_id: str,
    product_id: str,
    user_id: str,
    req: ProductUpdate,
    db=None,
) -> ProductResponse:
    product = await Product.find_one(
        Product.id == to_oid(product_id),
        Product.business_id == business_id,
    )
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    update_data = req.model_dump(exclude_unset=True)

    if "category_id" in update_data and update_data["category_id"] is not None:
        cat = await Category.find_one(
            Category.id == to_oid(update_data["category_id"]),
            Category.business_id == business_id,
        )
        if not cat:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    update_data["updated_at"] = datetime.now(timezone.utc)
    await product.set({getattr(Product, k): v for k, v in update_data.items() if hasattr(Product, k)})

    await record_audit_log(
        action="PRODUCT_UPDATE",
        business_id=business_id,
        user_id=user_id,
        entity_type="Product",
        entity_id=str(product.id),
        changes=update_data,
    )
    return ProductResponse.model_validate(product.model_dump())


async def delete_product(business_id: str, product_id: str, user_id: str, db=None) -> None:
    product = await Product.find_one(
        Product.id == to_oid(product_id),
        Product.business_id == business_id,
    )
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    await product.set({Product.status: "DISCONTINUED"})

    await record_audit_log(
        action="PRODUCT_DELETE",
        business_id=business_id,
        user_id=user_id,
        entity_type="Product",
        entity_id=str(product.id),
        changes={"status": "DISCONTINUED"},
    )
