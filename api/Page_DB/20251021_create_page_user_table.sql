-- Create page_user table for tracking page users
-- This table stores the relationship between users and pages with additional metadata

CREATE TABLE IF NOT EXISTS page_user (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL COMMENT 'Reference to the user ID',
  page_user_id VARCHAR(255) NOT NULL COMMENT 'Page user ID from external system',
  page_user_name VARCHAR(255) NOT NULL COMMENT 'Name of the page user',
  page_count INT NOT NULL DEFAULT 0 COMMENT 'Number of pages associated with this user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_page_user_id (page_user_id),
  INDEX idx_page_user_name (page_user_name),
  INDEX idx_created_at (created_at),
  INDEX idx_updated_at (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add unique constraint on page_user_id to prevent duplicates
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE table_schema = DATABASE()
     AND table_name = 'page_user'
     AND constraint_name = 'uk_page_user_id') > 0,
    'SELECT "Unique constraint on page_user_id already exists" as message;',
    'ALTER TABLE page_user ADD CONSTRAINT uk_page_user_id UNIQUE (page_user_id);'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Note: Removed unique constraint on user_id and page_user_id combination since user_id is now NULL

-- Show completion message
SELECT 'page_user table created successfully' as status;