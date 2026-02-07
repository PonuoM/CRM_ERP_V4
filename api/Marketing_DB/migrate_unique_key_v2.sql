-- ===============================================================
-- Migration: เปลี่ยน UNIQUE KEY จาก (page_id, user_id, date) เป็น (page_id, date)
-- เหตุผล: 1 เพจ ต่อ 1 วัน ควรมีข้อมูล ads ได้แค่ 1 record เท่านั้น
--         ไม่ว่าใครจะเป็นคนกรอก
-- ===============================================================

-- ขั้นตอน 1: ตรวจหา duplicate records (page_id + date ซ้ำกัน)
-- SELECT page_id, date, COUNT(*) as cnt, GROUP_CONCAT(id) as ids
-- FROM marketing_ads_log
-- GROUP BY page_id, date
-- HAVING cnt > 1;

-- ขั้นตอน 2: ลบ duplicate ให้เหลือเฉพาะ record ล่าสุดของแต่ละ page_id + date
DELETE mal FROM marketing_ads_log mal
INNER JOIN (
    SELECT page_id, date, MAX(id) as keep_id
    FROM marketing_ads_log
    GROUP BY page_id, date
    HAVING COUNT(*) > 1
) dup ON mal.page_id = dup.page_id AND mal.date = dup.date AND mal.id != dup.keep_id;

-- ขั้นตอน 3: Drop old UNIQUE KEY (page_id, user_id, date)
SET @sql = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_schema = DATABASE()
        AND table_name = 'marketing_ads_log'
        AND index_name = 'unique_page_user_date'
    ) > 0,
    'ALTER TABLE `marketing_ads_log` DROP INDEX `unique_page_user_date`',
    'SELECT "Index unique_page_user_date does not exist"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ขั้นตอน 4: สร้าง UNIQUE KEY ใหม่ (page_id, date) — ไม่รวม user_id
SET @sql = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_schema = DATABASE()
        AND table_name = 'marketing_ads_log'
        AND index_name = 'unique_page_date'
    ) = 0,
    'ALTER TABLE `marketing_ads_log` ADD UNIQUE KEY `unique_page_date` (`page_id`, `date`)',
    'SELECT "Index unique_page_date already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ===============================================================
-- Product Ads Log: ตรวจสอบ/สร้าง UNIQUE KEY (product_id, date)
-- ===============================================================

-- Clean duplicates in product table too
DELETE pal FROM marketing_product_ads_log pal
INNER JOIN (
    SELECT product_id, date, MAX(id) as keep_id
    FROM marketing_product_ads_log
    GROUP BY product_id, date
    HAVING COUNT(*) > 1
) dup ON pal.product_id = dup.product_id AND pal.date = dup.date AND pal.id != dup.keep_id;

-- Drop old unique key if exists (product_id, user_id, date)
SET @sql = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_schema = DATABASE()
        AND table_name = 'marketing_product_ads_log'
        AND index_name = 'unique_product_user_date'
    ) > 0,
    'ALTER TABLE `marketing_product_ads_log` DROP INDEX `unique_product_user_date`',
    'SELECT "Index unique_product_user_date does not exist"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create new UNIQUE KEY (product_id, date)
SET @sql = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_schema = DATABASE()
        AND table_name = 'marketing_product_ads_log'
        AND index_name = 'unique_product_date'
    ) = 0,
    'ALTER TABLE `marketing_product_ads_log` ADD UNIQUE KEY `unique_product_date` (`product_id`, `date`)',
    'SELECT "Index unique_product_date already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Done!
-- หลังจาก run migration นี้แล้ว:
-- - marketing_ads_log: UNIQUE KEY = (page_id, date) — 1 record per page per day
-- - marketing_product_ads_log: UNIQUE KEY = (product_id, date) — 1 record per product per day
