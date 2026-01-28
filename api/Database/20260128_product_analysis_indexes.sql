-- Indexes for Product Analysis Performance
-- Run this on the database to speed up queries

-- Index on order_items for product analysis
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_is_freebie ON order_items(is_freebie);

-- Index on orders for date filtering
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_company_date ON orders(company_id, order_date);
CREATE INDEX IF NOT EXISTS idx_orders_creator_id ON orders(creator_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON orders(order_status);

-- Index on products for category grouping
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_report_category ON products(report_category);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_orders_company_date_status ON orders(company_id, order_date, order_status);
