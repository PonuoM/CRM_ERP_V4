-- สร้างตาราง marketing_product_ads_log เพื่อเก็บข้อมูลค่าโฆษณาแยกตามสินค้า
-- ตารางนี้ใช้สำหรับเก็บข้อมูลการใช้งานโฆษณาต่างๆ ของสินค้าแต่ละตัว
-- ตัด page_id ออก ตาม requirement ใหม่

CREATE TABLE IF NOT EXISTS `marketing_product_ads_log` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `date` DATE NOT NULL,
  `ads_cost` DECIMAL(10, 2) DEFAULT NULL,
  `impressions` INT DEFAULT NULL,
  `reach` INT DEFAULT NULL,
  `clicks` INT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_product_id` (`product_id`),
  INDEX `idx_date` (`date`),
  UNIQUE KEY `unique_user_product_date` (`user_id`, `product_id`, `date`),
  CONSTRAINT `fk_marketing_pad_user_id`
    FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
    CONSTRAINT `fk_marketing_pad_product_id`
    FOREIGN KEY (`product_id`)
    REFERENCES `products` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'Table marketing_product_ads_log created successfully' AS status;
