-- Add page_type column to pages table
-- This column will be used to categorize pages (e.g., business, personal, fan, etc.)
-- Default value is NULL for existing pages
-- New pages can optionally specify a type

ALTER TABLE `pages`
ADD COLUMN `page_type` VARCHAR(50) NULL DEFAULT NULL
AFTER `platform`;

-- Add index for better query performance on page_type
ALTER TABLE `pages`
ADD INDEX `idx_page_type` (`page_type`);

-- Optional: Add comment to describe the column
ALTER TABLE `pages`
MODIFY COLUMN `page_type` VARCHAR(50) NULL DEFAULT NULL COMMENT 'Type of page (e.g., business, personal, fan, etc.)';

-- Show table structure to verify the changes
DESCRIBE `pages`;
