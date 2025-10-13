-- Add user status and login tracking fields to users table
-- This script adds fields for tracking user status and login history

USE `mini_erp`;

-- Add status field to track if user is active, inactive, or resigned
ALTER TABLE `users` 
ADD COLUMN `status` ENUM('active', 'inactive', 'resigned') NOT NULL DEFAULT 'active' AFTER `supervisor_id`;

-- Add timestamp fields for tracking user record changes
ALTER TABLE `users` 
ADD COLUMN `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP AFTER `status`,
ADD COLUMN `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER `created_at`;

-- Add login tracking fields
ALTER TABLE `users` 
ADD COLUMN `last_login` DATETIME NULL AFTER `updated_at`,
ADD COLUMN `login_count` INT NOT NULL DEFAULT 0 AFTER `last_login`;

-- Create index for status field for better query performance
CREATE INDEX `idx_users_status` ON `users`(`status`);

-- Create index for last_login field for better query performance
CREATE INDEX `idx_users_last_login` ON `users`(`last_login`);

-- Update existing users to have 'active' status and current timestamp for created_at
UPDATE `users` SET 
    `status` = 'active',
    `created_at` = NOW(),
    `updated_at` = NOW()
WHERE `status` IS NULL;

-- Create a separate table for detailed login history
CREATE TABLE IF NOT EXISTS `user_login_history` (
  `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `login_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ip_address` VARCHAR(45) NULL,
  `user_agent` TEXT NULL,
  `logout_time` DATETIME NULL,
  `session_duration` INT NULL COMMENT 'Session duration in seconds',
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_login_user_id` (`user_id`),
  INDEX `idx_login_time` (`login_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
