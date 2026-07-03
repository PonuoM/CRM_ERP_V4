CREATE TABLE IF NOT EXISTS `order_audio_links` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_id` VARCHAR(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `audio_url` VARCHAR(500) NOT NULL,
  `source` ENUM('manual', 'auto') NOT NULL DEFAULT 'manual',
  `created_by` INT NULL COMMENT 'User ID who attached the link (if manual)',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_order_audio_links_order_id` (`order_id`),
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
