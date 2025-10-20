-- Update pages table with all necessary fields
-- This file combines all the separate SQL updates into one file
-- Made flexible to check if tables/columns already exist

-- Add page_id field to pages table if it doesn't exist
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE table_schema = DATABASE()
     AND table_name = 'pages'
     AND column_name = 'page_id') > 0,
    'SELECT "page_id column already exists" as message;',
    'ALTER TABLE pages ADD COLUMN page_id VARCHAR(255) AFTER id;'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add still_in_list field to pages table if it doesn't exist
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE table_schema = DATABASE()
     AND table_name = 'pages'
     AND column_name = 'still_in_list') > 0,
    'SELECT "still_in_list column already exists" as message;',
    'ALTER TABLE pages ADD COLUMN still_in_list TINYINT(1) NOT NULL DEFAULT 1 COMMENT ''1 = page is visible in list, 0 = page is hidden from list'';'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add user_count field to pages table if it doesn't exist
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE table_schema = DATABASE()
     AND table_name = 'pages'
     AND column_name = 'user_count') > 0,
    'SELECT "user_count column already exists" as message;',
    'ALTER TABLE pages ADD COLUMN user_count INT NOT NULL DEFAULT 0 COMMENT ''Number of users assigned to this page'';'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add created_at field to pages table if it doesn't exist
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE table_schema = DATABASE()
     AND table_name = 'pages'
     AND column_name = 'created_at') > 0,
    'SELECT "created_at column already exists" as message;',
    'ALTER TABLE pages ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add updated_at field to pages table if it doesn't exist
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE table_schema = DATABASE()
     AND table_name = 'pages'
     AND column_name = 'updated_at') > 0,
    'SELECT "updated_at column already exists" as message;',
    'ALTER TABLE pages ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add indexes for better performance if they don't exist
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE table_schema = DATABASE()
     AND table_name = 'pages'
     AND index_name = 'idx_still_in_list') > 0,
    'SELECT "idx_still_in_list index already exists" as message;',
    'CREATE INDEX idx_still_in_list ON pages(still_in_list);'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE table_schema = DATABASE()
     AND table_name = 'pages'
     AND index_name = 'idx_user_count') > 0,
    'SELECT "idx_user_count index already exists" as message;',
    'CREATE INDEX idx_user_count ON pages(user_count);'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE table_schema = DATABASE()
     AND table_name = 'pages'
     AND index_name = 'idx_page_id') > 0,
    'SELECT "idx_page_id index already exists" as message;',
    'CREATE INDEX idx_page_id ON pages(page_id);'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update existing records to have proper default values
UPDATE pages SET still_in_list = 1 WHERE still_in_list IS NULL;
UPDATE pages SET user_count = 0 WHERE user_count IS NULL;