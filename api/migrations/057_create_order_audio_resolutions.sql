CREATE TABLE IF NOT EXISTS `order_audio_resolutions` (
    `order_id` VARCHAR(32) COLLATE utf8mb4_unicode_ci NOT NULL PRIMARY KEY,
    `resolution_notes` TEXT NULL,
    `is_completed` TINYINT(1) NOT NULL DEFAULT 0,
    `resolved_by` INT NULL,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`resolved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Migrate existing data
INSERT INTO `order_audio_resolutions` (`order_id`, `resolution_notes`, `is_completed`)
SELECT `id`, `admin_resolution_notes`, `admin_resolution_completed`
FROM `orders`
WHERE `admin_resolution_notes` IS NOT NULL OR `admin_resolution_completed` = 1
ON DUPLICATE KEY UPDATE 
    `resolution_notes` = VALUES(`resolution_notes`), 
    `is_completed` = VALUES(`is_completed`);

-- Remove columns from orders
ALTER TABLE `orders`
DROP COLUMN `admin_resolution_notes`,
DROP COLUMN `admin_resolution_completed`;
