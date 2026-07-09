-- 048: Ton divisor becomes a dated history instead of a single overwritable value
-- เหตุผล: เปลี่ยนค่าตัวหารแล้วไม่อยากให้กระทบเดือนที่ผ่านมาแล้ว เดือนใหม่ใช้ค่าล่าสุด เดือนเก่าใช้ค่าที่เคย effective ตอนนั้น
-- แต่ละแถวคือ "ตั้งแต่วันที่นี้เป็นต้นไป ใช้ตัวหารนี้" (effective_from = วันที่ 1 ของเดือนที่บันทึก)

CREATE TABLE `stock_arrival_ton_divisor_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `product_id` int(11) NOT NULL,
  `divisor` decimal(12,4) NOT NULL,
  `effective_from` date NOT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_ton_divisor_hist_product_effective` (`product_id`,`effective_from`),
  KEY `idx_ton_divisor_hist_product` (`product_id`),
  CONSTRAINT `fk_ton_divisor_hist_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Carry over existing single-value settings as if they'd always been effective,
-- so every already-viewed month keeps showing the same ton figures as before this migration
INSERT INTO stock_arrival_ton_divisor_history (product_id, divisor, effective_from, updated_by, created_at, updated_at)
SELECT product_id, divisor, '2000-01-01', updated_by, updated_at, updated_at
FROM stock_arrival_ton_divisors;

DROP TABLE stock_arrival_ton_divisors;
