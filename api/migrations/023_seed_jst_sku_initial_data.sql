-- Data Migration: Update initial JST SKU mapping for known mismatched products
UPDATE `products` SET `jst_sku` = 'FR-TM001' WHERE `sku` = 'QT-FR-TM001';
UPDATE `products` SET `jst_sku` = '1SDSR025001' WHERE `sku` = '1SDSR025002';
