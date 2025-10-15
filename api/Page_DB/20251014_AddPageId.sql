-- Add page_id field to pages table
ALTER TABLE pages
ADD COLUMN page_id VARCHAR(255) AFTER id;