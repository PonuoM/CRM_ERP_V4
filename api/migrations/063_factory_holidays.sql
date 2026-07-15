-- 051: วันหยุดโรงงาน สำหรับระบบแพลนรับสินค้า
-- กรอกจากหน้าตั้งค่า แสดงบนปฏิทินแพลนรับสินค้า (global ใช้ร่วมกันทุกบริษัท -- เป็นวันหยุดของโรงงานผลิต)

CREATE TABLE `stock_arrival_factory_holidays` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `holiday_date` date NOT NULL,
  `label` varchar(255) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_factory_holiday_date` (`holiday_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
