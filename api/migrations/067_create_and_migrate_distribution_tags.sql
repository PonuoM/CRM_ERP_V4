-- 1. Create distribution_tags table
CREATE TABLE IF NOT EXISTS `distribution_tags` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `company_id` INT NOT NULL,
  `tag_name` VARCHAR(100) NOT NULL,
  `color` VARCHAR(20) DEFAULT '#E5E7EB',
  `created_by` INT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `idx_company_tag` (`company_id`, `tag_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Add tag_id to distribution_sessions
ALTER TABLE `distribution_sessions`
ADD COLUMN `tag_id` INT NULL DEFAULT NULL AFTER `session_tag`;

-- 3. Migrate existing string tags into distribution_tags
INSERT IGNORE INTO distribution_tags (company_id, tag_name)
SELECT DISTINCT company_id, session_tag 
FROM distribution_sessions 
WHERE session_tag IS NOT NULL AND session_tag != '';

-- 4. Update distribution_sessions to link the new tag_id
UPDATE distribution_sessions ds
JOIN distribution_tags dt ON ds.company_id = dt.company_id AND ds.session_tag = dt.tag_name
SET ds.tag_id = dt.id;

-- 5. Drop the old string column to complete normalization
ALTER TABLE `distribution_sessions` DROP COLUMN `session_tag`;
