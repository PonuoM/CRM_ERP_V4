-- เพิ่ม page_id ในตาราง marketing_product_ads_log
-- เพื่อให้ระบุได้ว่า Ads ของสินค้านั้นเป็นของเพจอะไร

-- Step 1: เพิ่ม column page_id
ALTER TABLE `marketing_product_ads_log`
ADD COLUMN `page_id` INT DEFAULT NULL AFTER `ads_group`;

-- Step 2: เพิ่ม index
SET @sql = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_schema = DATABASE()
        AND table_name = 'marketing_product_ads_log'
        AND index_name = 'idx_page_id'
    ) = 0,
    'ALTER TABLE `marketing_product_ads_log` ADD INDEX `idx_page_id` (`page_id`)',
    'SELECT "Index idx_page_id already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 3: Drop unique key เดิม (ads_group, date)
SET @sql = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_schema = DATABASE()
        AND table_name = 'marketing_product_ads_log'
        AND index_name = 'uq_ads_group_date'
    ) > 0,
    'ALTER TABLE `marketing_product_ads_log` DROP INDEX `uq_ads_group_date`',
    'SELECT "Index uq_ads_group_date does not exist"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 4: สร้าง unique key ใหม่ (ads_group, page_id, date)
SET @sql = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_schema = DATABASE()
        AND table_name = 'marketing_product_ads_log'
        AND index_name = 'uq_ads_group_page_date'
    ) = 0,
    'ALTER TABLE `marketing_product_ads_log` ADD UNIQUE KEY `uq_ads_group_page_date` (`ads_group`, `page_id`, `date`)',
    'SELECT "Index uq_ads_group_page_date already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT 'Migration completed: page_id added to marketing_product_ads_log' AS status;
