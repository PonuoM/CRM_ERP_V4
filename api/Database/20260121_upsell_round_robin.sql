-- ==========================================
-- Upsell Round-Robin Distribution System
-- ==========================================

-- Table to track next Telesale position for Round-Robin
CREATE TABLE IF NOT EXISTS `upsell_round_robin` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `company_id` INT NOT NULL DEFAULT 1,
    `last_assigned_user_id` INT DEFAULT NULL,
    `last_assigned_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uk_company` (`company_id`)
);

-- Initialize with NULL (will start from first telesale)
INSERT INTO `upsell_round_robin` (`company_id`, `last_assigned_user_id`) 
VALUES (1, NULL)
ON DUPLICATE KEY UPDATE `id` = `id`;

-- Add upsell_user_id to orders table for tracking which Telesale should see in Upsell tab
ALTER TABLE `orders` 
ADD COLUMN `upsell_user_id` INT DEFAULT NULL AFTER `creator_id`;

-- Index for faster queries
ALTER TABLE `orders` ADD INDEX `idx_upsell_user` (`upsell_user_id`, `order_status`);
