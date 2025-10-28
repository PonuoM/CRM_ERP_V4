-- สร้างตาราง marketing_ads_log เพื่อเก็บข้อมูลค่าโฆษณา
-- ตารางนี้ใช้สำหรับเก็บข้อมูลการใช้งานโฆษณาต่างๆ ของผู้ใช้สำหรับแต่ละเพจ

CREATE TABLE IF NOT EXISTS `marketing_ads_log` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `page_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `date` DATE NOT NULL,
  `ads_cost` INT DEFAULT NULL,
  `impressions` INT DEFAULT NULL,
  `reach` INT DEFAULT NULL,
  `clicks` INT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_page_id` (`page_id`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_created_at` (`created_at`),
  UNIQUE KEY `unique_page_user_ads` (`page_id`, `user_id`),
  CONSTRAINT `fk_marketing_ads_log_page_id`
    FOREIGN KEY (`page_id`)
    REFERENCES `pages` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT `fk_marketing_ads_log_user_id`
    FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Comment:
-- - id: Primary key สำหรับระเบียนข้อมูลค่าโฆษณา
-- - page_id: Foreign key ไปยังตาราง pages
-- - user_id: Foreign key ไปยังตาราง users
-- - date: วันที่ของข้อมูลค่าโฆษณา
-- - ads_cost: ค่าโฆษณา (DECIMAL สำหรับค่าเงินที่แม่นยำ) - nullable
-- - impressions: จำนวนการแสดงผล (impression) - nullable
-- - reach: จำนวนการเข้าถึง (reach) - nullable
-- - clicks: จำนวนการคลิก (clicks) - nullable
-- - created_at: วันที่สร้างข้อมูล
-- - updated_at: วันที่อัปเดตข้อมูลล่าสุด
-- - unique_page_user_ads: ทำให้แต่ละเพจสามารถมีข้อมูลค่าโฆษณาสำหรับแต่ละผู้ใช้ได้เพียงครั้งเดียว
-- - ON DELETE CASCADE: ถ้าลบเพจหรือผู้ใช้ ข้อมูลค่าโฆษณาจะถูกลบโดยอัตโนมัติ

-- ===============================================================
-- แก้ไขโครงสร้างตารางสำหรับรองรับข้อมูลหลายวัน
-- ===============================================================

-- 1. ลบ unique key เก่าที่ไม่รวม date (ทำให้มีได้แค่ 1 รายการต่อ page_id/user_id)
-- ใช้คำสั่งที่ปลอดภัยสำหรับ MySQL รุ่นต่างๆ
SET @sql = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_schema = DATABASE()
        AND table_name = 'marketing_ads_log'
        AND index_name = 'unique_page_user_ads'
    ) > 0,
    'ALTER TABLE `marketing_ads_log` DROP INDEX `unique_page_user_ads`',
    'SELECT "Index unique_page_user_ads does not exist"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. สร้าง unique key ใหม่ที่รวม date เข้าไปด้วย (1 รายการต่อเพจ/ผู้ใช้/วัน)
-- ตรวจสอบก่อนว่ามี index นี้อยู่แล้วหรือไม่
SET @sql = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_schema = DATABASE()
        AND table_name = 'marketing_ads_log'
        AND index_name = 'unique_page_user_date'
    ) = 0,
    'ALTER TABLE `marketing_ads_log` ADD UNIQUE KEY `unique_page_user_date` (`page_id`, `user_id`, `date`)',
    'SELECT "Index unique_page_user_date already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. เพิ่ม index สำหรับ date field เพื่อให้ค้นหาตามวันที่เร็วขึ้น
-- ตรวจสอบก่อนว่ามี index นี้อยู่แล้วหรือไม่
SET @sql = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_schema = DATABASE()
        AND table_name = 'marketing_ads_log'
        AND index_name = 'idx_date'
    ) = 0,
    'ALTER TABLE `marketing_ads_log` ADD INDEX `idx_date` (`date`)',
    'SELECT "Index idx_date already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- คำอธิบายการแก้ไข:
-- - หลังจากนี้จะสามารถมีข้อมูลได้หลายวันสำหรับแต่ละเพจและผู้ใช้
-- - แต่ไม่สามารถมีข้อมูลซ้ำในวันเดียวกันสำหรับเพจและผู้ใช้เดียวกัน
-- - index บน date จะช่วยให้การค้นหาตามช่วงวันที่เร็วขึ้น (BETWEEN queries)
-- - แก้ไขปัญหาที่ API ไม่ส่งข้อมูลกลับเนื่องจาก constraint ที่ไม่ถูกต้อง
-- - ใช้ INFORMATION_SCHEMA เพื่อตรวจสอบว่ามี index อยู่แล้วหรือไม่ ทำให้ทำงานได้กับ MySQL ทุกรุ่น
