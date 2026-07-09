-- Add indexes for SKU lookups to improve performance of JST inventory joins
CREATE INDEX `idx_products_sku` ON `products` (`sku`);
CREATE INDEX `idx_products_jst_sku` ON `products` (`jst_sku`);
