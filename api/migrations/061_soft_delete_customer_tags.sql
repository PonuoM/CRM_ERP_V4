-- Migration: Add Soft Delete and History to customer_tags
-- Date: 2026-07-14

-- 1. Add auto-increment primary key `id`
ALTER TABLE `customer_tags`
ADD COLUMN `id` INT AUTO_INCREMENT PRIMARY KEY FIRST;

-- 2. Add audit columns
ALTER TABLE `customer_tags`
ADD COLUMN `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER `tag_id`,
ADD COLUMN `created_by` INT NULL AFTER `created_at`,
ADD COLUMN `deleted_at` TIMESTAMP NULL AFTER `created_by`,
ADD COLUMN `deleted_by` INT NULL AFTER `deleted_at`;

-- 3. Add foreign keys for users
ALTER TABLE `customer_tags`
ADD CONSTRAINT `fk_customer_tags_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT `fk_customer_tags_deleted_by` FOREIGN KEY (`deleted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Create indexes for faster lookup
CREATE INDEX `idx_customer_tags_deleted_at` ON `customer_tags` (`deleted_at`);
