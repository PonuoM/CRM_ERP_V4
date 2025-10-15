-- Update pages table with all necessary fields
-- This file combines all the separate SQL updates into one file

-- Add page_id field to pages table
ALTER TABLE pages
ADD COLUMN page_id VARCHAR(255) AFTER id;

-- Add still_in_list field to pages table
ALTER TABLE pages 
ADD COLUMN still_in_list TINYINT(1) NOT NULL DEFAULT 1 
COMMENT '1 = page is visible in list, 0 = page is hidden from list';

-- Add user_count field to pages table
ALTER TABLE pages
ADD COLUMN user_count INT NOT NULL DEFAULT 0
COMMENT 'Number of users assigned to this page';

-- Add created_at and updated_at fields
ALTER TABLE pages 
ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Add indexes for better performance
CREATE INDEX idx_still_in_list ON pages(still_in_list);
CREATE INDEX idx_user_count ON pages(user_count);
CREATE INDEX idx_page_id ON pages(page_id);

-- Update existing records to have proper default values
UPDATE pages SET still_in_list = 1 WHERE still_in_list IS NULL;
UPDATE pages SET user_count = 0 WHERE user_count IS NULL;