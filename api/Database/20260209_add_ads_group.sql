-- เพิ่ม column ads_group สำหรับจัดกลุ่มสินค้าใน Ads Input
-- ใช้สำหรับรวมสินค้าที่มีขนาดต่างกัน (เช่น 25กก. / 50กก.) เป็นกลุ่มเดียว

-- Step 1: เพิ่ม column ads_group ในตาราง products
ALTER TABLE `products` 
ADD COLUMN `ads_group` VARCHAR(128) DEFAULT NULL AFTER `report_category`;

-- Step 2: สร้างตาราง marketing_product_ads_log (ถ้ายังไม่มี)
CREATE TABLE IF NOT EXISTS `marketing_product_ads_log` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `product_id` INT(11) DEFAULT NULL,
  `ads_group` VARCHAR(128) DEFAULT NULL,
  `user_id` INT(11) NOT NULL,
  `date` DATE NOT NULL,
  `ads_cost` DECIMAL(12,2) DEFAULT NULL,
  `impressions` INT(11) DEFAULT NULL,
  `reach` INT(11) DEFAULT NULL,
  `clicks` INT(11) DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ads_group_date` (`ads_group`, `date`),
  KEY `idx_product_id` (`product_id`),
  KEY `idx_date` (`date`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Step 3: ถ้าตาราง marketing_product_ads_log มีอยู่แล้ว ให้เพิ่ม column ads_group
-- ALTER TABLE `marketing_product_ads_log` ADD COLUMN `ads_group` VARCHAR(128) DEFAULT NULL AFTER `product_id`;
-- ALTER TABLE `marketing_product_ads_log` DROP INDEX IF EXISTS `uq_product_date`;
-- ALTER TABLE `marketing_product_ads_log` ADD UNIQUE KEY `uq_ads_group_date` (`ads_group`, `date`);
