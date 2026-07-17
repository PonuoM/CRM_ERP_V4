-- 050: แยกแคตตาล็อกสินค้าของระบบแพลนรับสินค้าออกจากตาราง products หลัก
-- เหตุผล: มีของที่สั่งเข้าจริงแต่ใส่ในรหัสสินค้าหลักไม่ได้ -- แพลนจึงต้องมีแคตตาล็อกของตัวเอง
-- ผู้ใช้เพิ่มรายการเองได้จากหน้าตั้งค่า, seed ชุดแรกมาจากไฟล์ "รหัสสินค้า ชีวภัณฑ์ เทพมงคล.xlsx" (แยกสคริปต์ต่างหาก)
-- การ remap ด้านล่างยังช่วยยุบสินค้า SKU ซ้ำข้ามบริษัท (เช่น 3SOSR001001 ที่มี 2 record) ให้เหลือรายการเดียว

CREATE TABLE `stock_arrival_products` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sku` varchar(64) NOT NULL,
  `name` varchar(255) NOT NULL,
  `format_code` varchar(16) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_stock_arrival_products_sku` (`sku`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1) Carry over every main-catalog product already referenced by plans or divisor settings
--    (dedupe by SKU -- one canonical catalog row per SKU)
INSERT INTO stock_arrival_products (sku, name)
SELECT pr.sku, MIN(pr.name)
FROM products pr
WHERE pr.id IN (
        SELECT product_id FROM stock_arrival_plan_items
        UNION
        SELECT product_id FROM stock_arrival_ton_divisor_history
      )
  AND pr.sku IS NOT NULL AND pr.sku != ''
GROUP BY pr.sku;

-- 2) Detach from the main products table
ALTER TABLE stock_arrival_plan_items DROP FOREIGN KEY fk_stock_arrival_plan_items_product;
ALTER TABLE stock_arrival_ton_divisor_history DROP FOREIGN KEY fk_ton_divisor_hist_product;

-- 3) Divisor history: where two same-SKU product rows both configured the same effective_from,
--    keep only the most recently updated entry so the remap below can't violate the unique key
DELETE h1 FROM stock_arrival_ton_divisor_history h1
JOIN products p1 ON p1.id = h1.product_id
JOIN stock_arrival_ton_divisor_history h2 ON h2.id <> h1.id
JOIN products p2 ON p2.id = h2.product_id
WHERE p1.sku = p2.sku
  AND h1.effective_from = h2.effective_from
  AND (h1.updated_at < h2.updated_at OR (h1.updated_at = h2.updated_at AND h1.id < h2.id));

-- 4) Remap old products.id -> new stock_arrival_products.id (matched by SKU)
UPDATE stock_arrival_plan_items i
JOIN products pr ON pr.id = i.product_id
JOIN stock_arrival_products sap ON sap.sku = pr.sku
SET i.product_id = sap.id;

UPDATE stock_arrival_ton_divisor_history h
JOIN products pr ON pr.id = h.product_id
JOIN stock_arrival_products sap ON sap.sku = pr.sku
SET h.product_id = sap.id;

-- 5) Re-attach FKs to the new catalog
ALTER TABLE stock_arrival_plan_items
  ADD CONSTRAINT fk_sapi_catalog_product FOREIGN KEY (product_id) REFERENCES stock_arrival_products (id) ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE stock_arrival_ton_divisor_history
  ADD CONSTRAINT fk_tdh_catalog_product FOREIGN KEY (product_id) REFERENCES stock_arrival_products (id) ON DELETE CASCADE ON UPDATE NO ACTION;
