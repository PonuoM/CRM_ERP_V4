ALTER TABLE `exports` ADD COLUMN `company_id` INT DEFAULT NULL AFTER `user_id`;

-- Backfill company_id from users table
UPDATE `exports` e
JOIN `users` u ON e.user_id = u.id
SET e.company_id = u.company_id;

-- Add index for performance
CREATE INDEX `idx_exports_company_id` ON `exports`(`company_id`);
