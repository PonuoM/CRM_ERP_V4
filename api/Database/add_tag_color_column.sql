-- Migration: Add color column to tags table
-- This allows each tag to have its own custom color

-- Add color column to tags table
-- Using VARCHAR(20) to store hex color codes (e.g., #9333EA) or color names
ALTER TABLE `tags` 
ADD COLUMN `color` VARCHAR(20) NULL DEFAULT NULL 
AFTER `type`;

-- Optional: Set default colors for existing tags
-- You can customize these colors as needed
UPDATE `tags` 
SET `color` = '#9333EA' 
WHERE `color` IS NULL AND `type` = 'SYSTEM';

UPDATE `tags` 
SET `color` = '#9333EA' 
WHERE `color` IS NULL AND `type` = 'USER';

-- Optional: Set specific colors for common tags (customize as needed)
-- Example:
-- UPDATE `tags` SET `color` = '#EF4444' WHERE `name` = 'VIP';
-- UPDATE `tags` SET `color` = '#10B981' WHERE `name` = 'Lead';
-- UPDATE `tags` SET `color` = '#F59E0B' WHERE `name` = 'ใกล้หมดอายุ';

-- Add index for better query performance (optional)
-- CREATE INDEX `idx_tags_color` ON `tags`(`color`);

