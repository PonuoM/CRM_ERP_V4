-- 047: Per-product divisor to convert "แพลนรับสินค้า" quantities (ชิ้น) into ตัน for the report view
-- ตัวหารมาจากผู้ใช้กรอกเอง (อิงจาก Excel เดิมที่หารด้วยเลขคงที่ต่อรุ่น เช่น 500g ÷ 40 = ตัน) ไม่ใช่สูตรคำนวณอัตโนมัติ

CREATE TABLE `stock_arrival_ton_divisors` (
  `product_id` int(11) NOT NULL,
  `divisor` decimal(12,4) NOT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`product_id`),
  CONSTRAINT `fk_ton_divisor_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
