-- Migration: 20251118_create_order_sequences_table.sql
-- Description: Track running order number per company/period prefix

CREATE TABLE IF NOT EXISTS `order_sequences` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `company_id` INT NOT NULL,
  `period` ENUM('day','month') NOT NULL DEFAULT 'day',
  `prefix` VARCHAR(8) NOT NULL,
  `last_sequence` INT NOT NULL DEFAULT 0,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_order_sequences` (`company_id`, `period`, `prefix`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'Migration 20251118_create_order_sequences_table.sql completed' AS message;
