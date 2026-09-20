"""Initial schema for PharmaCare AI

Revision ID: 0001_initial_schema
Revises: 
Create Date: 2026-09-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. businesses
    op.create_table(
        "businesses",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("license_no", sa.String(length=100), nullable=True),
        sa.Column("gstin", sa.String(length=20), nullable=True),
        sa.Column("address", sa.String(length=500), nullable=True),
        sa.Column("phone", sa.String(length=20), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_businesses")),
    )

    # 2. branches
    op.create_table(
        "branches",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("business_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("address", sa.String(length=500), nullable=True),
        sa.Column("phone", sa.String(length=20), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["business_id"], ["businesses.id"], name=op.f("fk_branches_business_id_businesses"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_branches")),
    )
    op.create_index(op.f("ix_branches_business_id"), "branches", ["business_id"], unique=False)

    # 3. users
    user_role_enum = sa.Enum("OWNER", "MANAGER", "STAFF", name="user_role")
    op.create_table(
        "users",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("business_id", sa.UUID(), nullable=False),
        sa.Column("branch_id", sa.UUID(), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=True),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("role", user_role_enum, nullable=False, server_default="STAFF"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("refresh_token_hash", sa.String(length=255), nullable=True),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["branch_id"], ["branches.id"], name=op.f("fk_users_branch_id_branches"), ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["business_id"], ["businesses.id"], name=op.f("fk_users_business_id_businesses"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.UniqueConstraint("email", name=op.f("uq_users_email")),
    )
    op.create_index(op.f("ix_users_business_id"), "users", ["business_id"], unique=False)
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    # 4. categories
    op.create_table(
        "categories",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("business_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("parent_id", sa.UUID(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["business_id"], ["businesses.id"], name=op.f("fk_categories_business_id_businesses"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["parent_id"], ["categories.id"], name=op.f("fk_categories_parent_id_categories"), ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_categories")),
        sa.UniqueConstraint("business_id", "name", name="uq_categories_business_id_name"),
    )
    op.create_index(op.f("ix_categories_business_id"), "categories", ["business_id"], unique=False)

    # 5. products
    op.create_table(
        "products",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("business_id", sa.UUID(), nullable=False),
        sa.Column("category_id", sa.UUID(), nullable=True),
        sa.Column("sku", sa.String(length=100), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("manufacturer", sa.String(length=255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("composition", sa.Text(), nullable=True),
        sa.Column("purchase_price", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0.00"),
        sa.Column("selling_price", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0.00"),
        sa.Column("mrp", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("reorder_level", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("rx_required", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("image_url", sa.String(length=1000), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="ACTIVE"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["business_id"], ["businesses.id"], name=op.f("fk_products_business_id_businesses"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], name=op.f("fk_products_category_id_categories"), ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_products")),
        sa.UniqueConstraint("business_id", "sku", name="uq_products_business_id_sku"),
    )
    op.create_index(op.f("ix_products_business_id"), "products", ["business_id"], unique=False)

    # 6. suppliers
    op.create_table(
        "suppliers",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("business_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("contact_person", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=20), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("drug_license_no", sa.String(length=100), nullable=True),
        sa.Column("gstin", sa.String(length=20), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["business_id"], ["businesses.id"], name=op.f("fk_suppliers_business_id_businesses"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_suppliers")),
    )
    op.create_index(op.f("ix_suppliers_business_id"), "suppliers", ["business_id"], unique=False)

    # 7. batches
    op.create_table(
        "batches",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("product_id", sa.UUID(), nullable=False),
        sa.Column("branch_id", sa.UUID(), nullable=False),
        sa.Column("supplier_id", sa.UUID(), nullable=True),
        sa.Column("batch_no", sa.String(length=100), nullable=False),
        sa.Column("mfg_date", sa.Date(), nullable=True),
        sa.Column("expiry_date", sa.Date(), nullable=False),
        sa.Column("purchase_price", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("selling_price", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("qty_received", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("qty_remaining", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["branch_id"], ["branches.id"], name=op.f("fk_batches_branch_id_branches"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], name=op.f("fk_batches_product_id_products"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["supplier_id"], ["suppliers.id"], name=op.f("fk_batches_supplier_id_suppliers"), ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_batches")),
    )
    op.create_index(op.f("ix_batches_branch_id"), "batches", ["branch_id"], unique=False)
    op.create_index(op.f("ix_batches_expiry_date"), "batches", ["expiry_date"], unique=False)
    op.create_index(op.f("ix_batches_product_id"), "batches", ["product_id"], unique=False)

    # 8. inventory
    op.create_table(
        "inventory",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("product_id", sa.UUID(), nullable=False),
        sa.Column("branch_id", sa.UUID(), nullable=False),
        sa.Column("qty_on_hand", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_updated", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["branch_id"], ["branches.id"], name=op.f("fk_inventory_branch_id_branches"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], name=op.f("fk_inventory_product_id_products"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_inventory")),
        sa.UniqueConstraint("product_id", "branch_id", name="uq_inventory_product_branch"),
    )
    op.create_index(op.f("ix_inventory_branch_id"), "inventory", ["branch_id"], unique=False)
    op.create_index(op.f("ix_inventory_product_id"), "inventory", ["product_id"], unique=False)

    # 9. inventory_movements
    op.create_table(
        "inventory_movements",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("business_id", sa.UUID(), nullable=False),
        sa.Column("product_id", sa.UUID(), nullable=False),
        sa.Column("branch_id", sa.UUID(), nullable=False),
        sa.Column("batch_id", sa.UUID(), nullable=True),
        sa.Column("movement_type", sa.String(length=20), nullable=False),
        sa.Column("qty_change", sa.Integer(), nullable=False),
        sa.Column("qty_before", sa.Integer(), nullable=False),
        sa.Column("qty_after", sa.Integer(), nullable=False),
        sa.Column("reference_type", sa.String(length=50), nullable=True),
        sa.Column("reference_id", sa.UUID(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["batch_id"], ["batches.id"], name=op.f("fk_inventory_movements_batch_id_batches"), ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["branch_id"], ["branches.id"], name=op.f("fk_inventory_movements_branch_id_branches"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["business_id"], ["businesses.id"], name=op.f("fk_inventory_movements_business_id_businesses"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name=op.f("fk_inventory_movements_created_by_users"), ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], name=op.f("fk_inventory_movements_product_id_products"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_inventory_movements")),
    )
    op.create_index(op.f("ix_inv_movements_business_id"), "inventory_movements", ["business_id"], unique=False)
    op.create_index(op.f("ix_inv_movements_created_at"), "inventory_movements", ["created_at"], unique=False)
    op.create_index(op.f("ix_inv_movements_product_id"), "inventory_movements", ["product_id"], unique=False)

    # 10. customers
    op.create_table(
        "customers",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("business_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=20), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["business_id"], ["businesses.id"], name=op.f("fk_customers_business_id_businesses"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_customers")),
    )
    op.create_index(op.f("ix_customers_business_id"), "customers", ["business_id"], unique=False)

    # 11. sales
    op.create_table(
        "sales",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("business_id", sa.UUID(), nullable=False),
        sa.Column("branch_id", sa.UUID(), nullable=False),
        sa.Column("customer_id", sa.UUID(), nullable=True),
        sa.Column("invoice_no", sa.String(length=100), nullable=True),
        sa.Column("subtotal", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0.00"),
        sa.Column("discount_amount", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0.00"),
        sa.Column("tax_amount", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0.00"),
        sa.Column("total_amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("payment_mode", sa.String(length=20), nullable=False, server_default="CASH"),
        sa.Column("payment_status", sa.String(length=20), nullable=False, server_default="PAID"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["branch_id"], ["branches.id"], name=op.f("fk_sales_branch_id_branches"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["business_id"], ["businesses.id"], name=op.f("fk_sales_business_id_businesses"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name=op.f("fk_sales_created_by_users"), ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], name=op.f("fk_sales_customer_id_customers"), ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_sales")),
        sa.UniqueConstraint("invoice_no", name=op.f("uq_sales_invoice_no")),
    )
    op.create_index(op.f("ix_sales_business_id"), "sales", ["business_id"], unique=False)
    op.create_index(op.f("ix_sales_created_at"), "sales", ["created_at"], unique=False)

    # 12. sale_items
    op.create_table(
        "sale_items",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("sale_id", sa.UUID(), nullable=False),
        sa.Column("product_id", sa.UUID(), nullable=False),
        sa.Column("batch_id", sa.UUID(), nullable=True),
        sa.Column("qty", sa.Integer(), nullable=False),
        sa.Column("unit_price", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("discount_pct", sa.Numeric(precision=5, scale=2), nullable=False, server_default="0.00"),
        sa.Column("line_total", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.ForeignKeyConstraint(["batch_id"], ["batches.id"], name=op.f("fk_sale_items_batch_id_batches"), ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], name=op.f("fk_sale_items_product_id_products"), ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["sale_id"], ["sales.id"], name=op.f("fk_sale_items_sale_id_sales"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_sale_items")),
    )
    op.create_index(op.f("ix_sale_items_sale_id"), "sale_items", ["sale_id"], unique=False)

    # 13. purchases
    op.create_table(
        "purchases",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("business_id", sa.UUID(), nullable=False),
        sa.Column("branch_id", sa.UUID(), nullable=False),
        sa.Column("supplier_id", sa.UUID(), nullable=True),
        sa.Column("invoice_no", sa.String(length=100), nullable=True),
        sa.Column("subtotal", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0.00"),
        sa.Column("tax_amount", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0.00"),
        sa.Column("total_amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("payment_mode", sa.String(length=20), nullable=False, server_default="CREDIT"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["branch_id"], ["branches.id"], name=op.f("fk_purchases_branch_id_branches"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["business_id"], ["businesses.id"], name=op.f("fk_purchases_business_id_businesses"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name=op.f("fk_purchases_created_by_users"), ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["supplier_id"], ["suppliers.id"], name=op.f("fk_purchases_supplier_id_suppliers"), ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_purchases")),
    )
    op.create_index(op.f("ix_purchases_business_id"), "purchases", ["business_id"], unique=False)
    op.create_index(op.f("ix_purchases_created_at"), "purchases", ["created_at"], unique=False)

    # 14. purchase_items
    op.create_table(
        "purchase_items",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("purchase_id", sa.UUID(), nullable=False),
        sa.Column("product_id", sa.UUID(), nullable=False),
        sa.Column("batch_id", sa.UUID(), nullable=True),
        sa.Column("qty", sa.Integer(), nullable=False),
        sa.Column("unit_cost", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("line_total", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.ForeignKeyConstraint(["batch_id"], ["batches.id"], name=op.f("fk_purchase_items_batch_id_batches"), ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], name=op.f("fk_purchase_items_product_id_products"), ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["purchase_id"], ["purchases.id"], name=op.f("fk_purchase_items_purchase_id_purchases"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_purchase_items")),
    )
    op.create_index(op.f("ix_purchase_items_purchase_id"), "purchase_items", ["purchase_id"], unique=False)

    # 15. orders
    op.create_table(
        "orders",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("business_id", sa.UUID(), nullable=False),
        sa.Column("branch_id", sa.UUID(), nullable=True),
        sa.Column("customer_id", sa.UUID(), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="CREATED"),
        sa.Column("subtotal", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0.00"),
        sa.Column("delivery_fee", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0.00"),
        sa.Column("total_amount", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0.00"),
        sa.Column("delivery_address", sa.Text(), nullable=True),
        sa.Column("delivery_pin", sa.String(length=10), nullable=True),
        sa.Column("rider_name", sa.String(length=255), nullable=True),
        sa.Column("rider_phone", sa.String(length=20), nullable=True),
        sa.Column("eta_minutes", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["branch_id"], ["branches.id"], name=op.f("fk_orders_branch_id_branches"), ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["business_id"], ["businesses.id"], name=op.f("fk_orders_business_id_businesses"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name=op.f("fk_orders_created_by_users"), ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], name=op.f("fk_orders_customer_id_customers"), ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_orders")),
    )
    op.create_index(op.f("ix_orders_business_id"), "orders", ["business_id"], unique=False)
    op.create_index(op.f("ix_orders_created_at"), "orders", ["created_at"], unique=False)
    op.create_index(op.f("ix_orders_status"), "orders", ["status"], unique=False)

    # 16. order_items
    op.create_table(
        "order_items",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("order_id", sa.UUID(), nullable=False),
        sa.Column("product_id", sa.UUID(), nullable=False),
        sa.Column("qty", sa.Integer(), nullable=False),
        sa.Column("unit_price", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("line_total", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"], name=op.f("fk_order_items_order_id_orders"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], name=op.f("fk_order_items_product_id_products"), ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_order_items")),
    )
    op.create_index(op.f("ix_order_items_order_id"), "order_items", ["order_id"], unique=False)

    # 17. import_shipments
    op.create_table(
        "import_shipments",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("business_id", sa.UUID(), nullable=False),
        sa.Column("supplier_id", sa.UUID(), nullable=True),
        sa.Column("purchase_id", sa.UUID(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="PENDING"),
        sa.Column("tracking_no", sa.String(length=100), nullable=True),
        sa.Column("origin_country", sa.String(length=100), nullable=True),
        sa.Column("carrier", sa.String(length=100), nullable=True),
        sa.Column("shipment_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expected_arrival", sa.DateTime(timezone=True), nullable=True),
        sa.Column("actual_arrival", sa.DateTime(timezone=True), nullable=True),
        sa.Column("total_value", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["business_id"], ["businesses.id"], name=op.f("fk_import_shipments_business_id_businesses"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name=op.f("fk_import_shipments_created_by_users"), ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["purchase_id"], ["purchases.id"], name=op.f("fk_import_shipments_purchase_id_purchases"), ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["supplier_id"], ["suppliers.id"], name=op.f("fk_import_shipments_supplier_id_suppliers"), ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_import_shipments")),
    )
    op.create_index(op.f("ix_import_shipments_business_id"), "import_shipments", ["business_id"], unique=False)
    op.create_index(op.f("ix_import_shipments_status"), "import_shipments", ["status"], unique=False)

    # 18. export_shipments
    op.create_table(
        "export_shipments",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("business_id", sa.UUID(), nullable=False),
        sa.Column("customer_id", sa.UUID(), nullable=True),
        sa.Column("sale_id", sa.UUID(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="PENDING"),
        sa.Column("tracking_no", sa.String(length=100), nullable=True),
        sa.Column("destination_country", sa.String(length=100), nullable=True),
        sa.Column("carrier", sa.String(length=100), nullable=True),
        sa.Column("shipment_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expected_delivery", sa.DateTime(timezone=True), nullable=True),
        sa.Column("actual_delivery", sa.DateTime(timezone=True), nullable=True),
        sa.Column("total_value", sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["business_id"], ["businesses.id"], name=op.f("fk_export_shipments_business_id_businesses"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name=op.f("fk_export_shipments_created_by_users"), ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], name=op.f("fk_export_shipments_customer_id_customers"), ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["sale_id"], ["sales.id"], name=op.f("fk_export_shipments_sale_id_sales"), ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_export_shipments")),
    )
    op.create_index(op.f("ix_export_shipments_business_id"), "export_shipments", ["business_id"], unique=False)
    op.create_index(op.f("ix_export_shipments_status"), "export_shipments", ["status"], unique=False)

    # 19. alerts
    op.create_table(
        "alerts",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("business_id", sa.UUID(), nullable=False),
        sa.Column("branch_id", sa.UUID(), nullable=True),
        sa.Column("alert_type", sa.String(length=30), nullable=False),
        sa.Column("severity", sa.String(length=20), nullable=False, server_default="WARNING"),
        sa.Column("product_id", sa.UUID(), nullable=True),
        sa.Column("batch_id", sa.UUID(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_resolved", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["batch_id"], ["batches.id"], name=op.f("fk_alerts_batch_id_batches"), ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["branch_id"], ["branches.id"], name=op.f("fk_alerts_branch_id_branches"), ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["business_id"], ["businesses.id"], name=op.f("fk_alerts_business_id_businesses"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], name=op.f("fk_alerts_product_id_products"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_alerts")),
    )
    op.create_index(op.f("ix_alerts_alert_type"), "alerts", ["alert_type"], unique=False)
    op.create_index(op.f("ix_alerts_business_id"), "alerts", ["business_id"], unique=False)
    op.create_index(op.f("ix_alerts_created_at"), "alerts", ["created_at"], unique=False)
    op.create_index(op.f("ix_alerts_is_read"), "alerts", ["is_read"], unique=False)

    # 20. ai_predictions
    op.create_table(
        "ai_predictions",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("business_id", sa.UUID(), nullable=False),
        sa.Column("product_id", sa.UUID(), nullable=True),
        sa.Column("prediction_type", sa.String(length=50), nullable=False),
        sa.Column("predicted_value", sa.Float(), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("data_points", sa.Integer(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["business_id"], ["businesses.id"], name=op.f("fk_ai_predictions_business_id_businesses"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], name=op.f("fk_ai_predictions_product_id_products"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_ai_predictions")),
    )
    op.create_index(op.f("ix_ai_predictions_business_id"), "ai_predictions", ["business_id"], unique=False)
    op.create_index(op.f("ix_ai_predictions_product_id"), "ai_predictions", ["product_id"], unique=False)

    # 21. voice_commands
    op.create_table(
        "voice_commands",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("business_id", sa.UUID(), nullable=False),
        sa.Column("transcript", sa.Text(), nullable=False),
        sa.Column("language", sa.String(length=20), nullable=True),
        sa.Column("intent", sa.String(length=100), nullable=True),
        sa.Column("entities", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("result", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("action_type", sa.String(length=20), nullable=True),
        sa.Column("confirmed", sa.Boolean(), nullable=True),
        sa.Column("execution_status", sa.String(length=30), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["business_id"], ["businesses.id"], name=op.f("fk_voice_commands_business_id_businesses"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_voice_commands_user_id_users"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_voice_commands")),
    )
    op.create_index(op.f("ix_voice_commands_business_id"), "voice_commands", ["business_id"], unique=False)
    op.create_index(op.f("ix_voice_commands_created_at"), "voice_commands", ["created_at"], unique=False)
    op.create_index(op.f("ix_voice_commands_user_id"), "voice_commands", ["user_id"], unique=False)

    # 22. ai_preferences
    op.create_table(
        "ai_preferences",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("business_id", sa.UUID(), nullable=False),
        sa.Column("preferred_language", sa.String(length=20), nullable=False, server_default="en"),
        sa.Column("voice_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("auto_reorder_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("ai_write_actions_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("settings", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["business_id"], ["businesses.id"], name=op.f("fk_ai_preferences_business_id_businesses"), ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_ai_preferences")),
        sa.UniqueConstraint("business_id", name=op.f("uq_ai_preferences_business_id")),
    )

    # 23. ml_feedback
    op.create_table(
        "ml_feedback",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("business_id", sa.UUID(), nullable=False),
        sa.Column("prediction_id", sa.UUID(), nullable=True),
        sa.Column("prediction_type", sa.String(length=50), nullable=False),
        sa.Column("actual_value", sa.Float(), nullable=True),
        sa.Column("predicted_value", sa.Float(), nullable=True),
        sa.Column("accuracy_score", sa.Float(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["business_id"], ["businesses.id"], name=op.f("fk_ml_feedback_business_id_businesses"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], name=op.f("fk_ml_feedback_created_by_users"), ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["prediction_id"], ["ai_predictions.id"], name=op.f("fk_ml_feedback_prediction_id_ai_predictions"), ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_ml_feedback")),
    )
    op.create_index(op.f("ix_ml_feedback_business_id"), "ml_feedback", ["business_id"], unique=False)
    op.create_index(op.f("ix_ml_feedback_prediction_type"), "ml_feedback", ["prediction_type"], unique=False)

    # 24. audit_logs
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=True),
        sa.Column("business_id", sa.UUID(), nullable=True),
        sa.Column("action", sa.String(length=50), nullable=False),
        sa.Column("entity_type", sa.String(length=50), nullable=True),
        sa.Column("entity_id", sa.String(length=100), nullable=True),
        sa.Column("changes", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.String(length=500), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="SUCCESS"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["business_id"], ["businesses.id"], name=op.f("fk_audit_logs_business_id_businesses"), ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name=op.f("fk_audit_logs_user_id_users"), ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_audit_logs")),
    )
    op.create_index(op.f("ix_audit_logs_action"), "audit_logs", ["action"], unique=False)
    op.create_index(op.f("ix_audit_logs_business_id"), "audit_logs", ["business_id"], unique=False)
    op.create_index(op.f("ix_audit_logs_created_at"), "audit_logs", ["created_at"], unique=False)
    op.create_index(op.f("ix_audit_logs_user_id"), "audit_logs", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_table("audit_logs")
    op.drop_table("ml_feedback")
    op.drop_table("ai_preferences")
    op.drop_table("voice_commands")
    op.drop_table("ai_predictions")
    op.drop_table("alerts")
    op.drop_table("export_shipments")
    op.drop_table("import_shipments")
    op.drop_table("order_items")
    op.drop_table("orders")
    op.drop_table("purchase_items")
    op.drop_table("purchases")
    op.drop_table("sale_items")
    op.drop_table("sales")
    op.drop_table("customers")
    op.drop_table("inventory_movements")
    op.drop_table("inventory")
    op.drop_table("batches")
    op.drop_table("suppliers")
    op.drop_table("products")
    op.drop_table("categories")
    op.drop_table("users")
    sa.Enum(name="user_role").drop(op.get_bind(), checkfirst=False)
    op.drop_table("branches")
    op.drop_table("businesses")
