-- Create page_stats_batch table for tracking batch imports
CREATE TABLE IF NOT EXISTS page_stats_batch (
  id INT AUTO_INCREMENT PRIMARY KEY,
  date_range VARCHAR(255) NOT NULL COMMENT 'Date range in format YYYY-MM-DD - YYYY-MM-DD',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_date_range (date_range),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create page_stats_log table for storing page statistics data
CREATE TABLE IF NOT EXISTS page_stats_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_id INT NOT NULL,
  page_id VARCHAR(255) NOT NULL,
  page_name VARCHAR(255) NOT NULL,
  time_column VARCHAR(255) NOT NULL COMMENT 'Date or datetime depending on view mode',
  new_customers INT NOT NULL DEFAULT 0,
  total_phones INT NOT NULL DEFAULT 0,
  new_phones INT NOT NULL DEFAULT 0,
  total_comments INT NOT NULL DEFAULT 0,
  total_chats INT NOT NULL DEFAULT 0,
  total_page_comments INT NOT NULL DEFAULT 0,
  total_page_chats INT NOT NULL DEFAULT 0,
  new_chats INT NOT NULL DEFAULT 0,
  chats_from_old_customers INT NOT NULL DEFAULT 0,
  web_logged_in INT NOT NULL DEFAULT 0,
  web_guest INT NOT NULL DEFAULT 0,
  orders_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_batch_id (batch_id),
  INDEX idx_page_id (page_id),
  INDEX idx_time_column (time_column),
  INDEX idx_created_at (created_at),
  UNIQUE KEY unique_batch_page_time (batch_id, page_id, time_column)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add foreign key constraint if it doesn't exist
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE table_schema = DATABASE()
     AND table_name = 'page_stats_log'
     AND constraint_name = 'page_stats_log_ibfk_1') > 0,
    'SELECT "Foreign key constraint already exists" as message;',
    'ALTER TABLE page_stats_log ADD CONSTRAINT page_stats_log_ibfk_1 FOREIGN KEY (batch_id) REFERENCES page_stats_batch(id) ON DELETE CASCADE;'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Drop page_name column from page_stats_log table if it exists
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE table_schema = DATABASE()
     AND table_name = 'page_stats_log'
     AND column_name = 'page_name') > 0,
    'ALTER TABLE page_stats_log DROP COLUMN page_name;',
    'SELECT "page_name column does not exist" as message;'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create page_engagement_batch table if not exists
CREATE TABLE IF NOT EXISTS `page_engagement_batch` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `date_range` varchar(100) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
  `records_count` int(11) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create page_engagement_log table if not exists
CREATE TABLE IF NOT EXISTS `page_engagement_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `batch_id` int(11) NOT NULL,
  `page_id` varchar(50) NOT NULL,
  `date` date NOT NULL,
  `inbox` int(11) DEFAULT 0,
  `comment` int(11) DEFAULT 0,
  `total` int(11) DEFAULT 0,
  `new_customer_replied` int(11) DEFAULT 0,
  `customer_engagement_new_inbox` int(11) DEFAULT 0,
  `order_count` int(11) DEFAULT 0,
  `old_order_count` int(11) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_batch_id` (`batch_id`),
  KEY `idx_page_id` (`page_id`),
  KEY `idx_date` (`date`),
  CONSTRAINT `fk_page_engagement_log_batch` FOREIGN KEY (`batch_id`) REFERENCES `page_engagement_batch` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add columns to page_engagement_batch table if they don't exist
SET @dbname = DATABASE();
SET @tablename = 'page_engagement_batch';

-- Check if status column exists
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_schema = @dbname)
      AND (table_name = @tablename)
      AND (column_name = 'status')
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN `status` enum(\'pending\',\'processing\',\'completed\',\'failed\') NOT NULL DEFAULT \'pending\'')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Check if records_count column exists
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_schema = @dbname)
      AND (table_name = @tablename)
      AND (column_name = 'records_count')
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN `records_count` int(11) DEFAULT NULL')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Check if user_id column exists
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_schema = @dbname)
      AND (table_name = @tablename)
      AND (column_name = 'user_id')
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN `user_id` int(11) DEFAULT NULL')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add indexes to page_engagement_batch if they don't exist
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_schema = @dbname)
      AND (table_name = @tablename)
      AND (index_name = 'idx_created_at')
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD INDEX `idx_created_at` (`created_at`)')
));
PREPARE addIndexIfNotExists FROM @preparedStatement;
EXECUTE addIndexIfNotExists;
DEALLOCATE PREPARE addIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_schema = @dbname)
      AND (table_name = @tablename)
      AND (index_name = 'idx_status')
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD INDEX `idx_status` (`status`)')
));
PREPARE addIndexIfNotExists FROM @preparedStatement;
EXECUTE addIndexIfNotExists;
DEALLOCATE PREPARE addIndexIfNotExists;

-- Set tablename for page_engagement_log
SET @tablename = 'page_engagement_log';

-- Add columns to page_engagement_log table if they don't exist
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_schema = @dbname)
      AND (table_name = @tablename)
      AND (column_name = 'inbox')
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN `inbox` int(11) DEFAULT 0')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_schema = @dbname)
      AND (table_name = @tablename)
      AND (column_name = 'comment')
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN `comment` int(11) DEFAULT 0')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_schema = @dbname)
      AND (table_name = @tablename)
      AND (column_name = 'total')
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN `total` int(11) DEFAULT 0')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_schema = @dbname)
      AND (table_name = @tablename)
      AND (column_name = 'new_customer_replied')
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, 'ADD COLUMN `new_customer_replied` int(11) DEFAULT 0')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_schema = @dbname)
      AND (table_name = @tablename)
      AND (column_name = 'customer_engagement_new_inbox')
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, 'ADD COLUMN `customer_engagement_new_inbox` int(11) DEFAULT 0')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_schema = @dbname)
      AND (table_name = @tablename)
      AND (column_name = 'order_count')
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, 'ADD COLUMN `order_count` int(11) DEFAULT 0')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_schema = @dbname)
      AND (table_name = @tablename)
      AND (column_name = 'old_order_count')
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, 'ADD COLUMN `old_order_count` int(11) DEFAULT 0')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add indexes to page_engagement_log if they don't exist
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_schema = @dbname)
      AND (table_name = @tablename)
      AND (index_name = 'idx_batch_id')
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, 'ADD INDEX `idx_batch_id` (`batch_id`)')
));
PREPARE addIndexIfNotExists FROM @preparedStatement;
EXECUTE addIndexIfNotExists;
DEALLOCATE PREPARE addIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_schema = @dbname)
      AND (table_name = @tablename)
      AND (index_name = 'idx_page_id')
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, 'ADD INDEX `idx_page_id` (`page_id`)')
));
PREPARE addIndexIfNotExists FROM @preparedStatement;
EXECUTE addIndexIfNotExists;
DEALLOCATE PREPARE addIndexIfNotExists;

SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_schema = @dbname)
      AND (table_name = @tablename)
      AND (index_name = 'idx_date')
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, 'ADD INDEX `idx_date` (`date`)')
));
PREPARE addIndexIfNotExists FROM @preparedStatement;
EXECUTE addIndexIfNotExists;
DEALLOCATE PREPARE addIndexIfNotExists;

-- Add foreign key constraint if it doesn't exist
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE
      (table_schema = @dbname)
      AND (table_name = @tablename)
      AND (constraint_name = 'fk_page_engagement_log_batch')
      AND (referenced_table_name = 'page_engagement_batch')
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD CONSTRAINT `fk_page_engagement_log_batch` FOREIGN KEY (`batch_id`) REFERENCES `page_engagement_batch` (`id`) ON DELETE CASCADE')
));
PREPARE addFkIfNotExists FROM @preparedStatement;
EXECUTE addFkIfNotExists;
DEALLOCATE PREPARE addFkIfNotExists;
-- Force drop created_at columns from log tables
-- This script will drop the created_at columns even if there's data in the tables

-- Disable foreign key checks temporarily
SET FOREIGN_KEY_CHECKS = 0;

-- Drop created_at column from page_engagement_log if it exists
SET @dbname = DATABASE();
SET @tablename = 'page_engagement_log';

-- Check if column exists and drop it
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_schema = @dbname)
      AND (table_name = @tablename)
      AND (column_name = 'created_at')
  ) > 0,
  'ALTER TABLE page_engagement_log DROP COLUMN created_at',
  'SELECT "Column created_at does not exist in page_engagement_log" as message'
));
PREPARE dropColumnIfExists FROM @preparedStatement;
EXECUTE dropColumnIfExists;
DEALLOCATE PREPARE dropColumnIfExists;

-- Drop created_at column from page_stats_log if it exists
SET @tablename = 'page_stats_log';

SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_schema = @dbname)
      AND (table_name = @tablename)
      AND (column_name = 'created_at')
  ) > 0,
  'ALTER TABLE page_stats_log DROP COLUMN created_at',
  'SELECT "Column created_at does not exist in page_stats_log" as message'
));
PREPARE dropColumnIfExists FROM @preparedStatement;
EXECUTE dropColumnIfExists;
DEALLOCATE PREPARE dropColumnIfExists;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- Show results
SELECT 'Force drop created_at columns completed' as status;