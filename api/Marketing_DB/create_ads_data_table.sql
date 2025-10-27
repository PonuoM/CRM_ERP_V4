-- สร้างตาราง ads_data เพื่อเก็บข้อมูลค่าโฆษณา
-- ตารางนี้ใช้สำหรับเก็บข้อมูลการใช้งานโฆษณาต่างๆ ของผู้ใช้สำหรับแต่ละเพจ

CREATE TABLE IF NOT EXISTS `ads_data` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `page_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `ads_cost` DECIMAL(10,2) DEFAULT 0.00,
  `impressions` INT DEFAULT 0,
  `reach` INT DEFAULT 0,
  `clicks` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_page_id` (`page_id`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_created_at` (`created_at`),
  UNIQUE KEY `unique_page_user_ads` (`page_id`, `user_id`),
  CONSTRAINT `fk_ads_data_page_id`
    FOREIGN KEY (`page_id`)
    REFERENCES `pages` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_ads_data_user_id`
    FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Comment:
-- - id: Primary key สำหรับระเบียนข้อมูลค่าโฆษณา
-- - page_id: Foreign key ไปยังตาราง pages
-- - user_id: Foreign key ไปยังตาราง users
-- - ads_cost: ค่าโฆษณา (DECIMAL สำหรับค่าเงินที่แม่นยำ)
-- - impressions: จำนวนการแสดงผล (impression)
-- - reach: จำนวนการเข้าถึง (reach)
-- - clicks: จำนวนการคลิก (clicks)
-- - created_at: วันที่สร้างข้อมูล
-- - updated_at: วันที่อัปเดตข้อมูลล่าสุด
-- - unique_page_user_ads: ทำให้แต่ละเพจสามารถมีข้อมูลค่าโฆษณาสำหรับแต่ละผู้ใช้ได้เพียงครั้งเดียว
-- - ON DELETE CASCADE: ถ้าลบเพจหรือผู้ใช้ ข้อมูลค่าโฆษณาจะถูกลบโดยอัตโนมัติ
