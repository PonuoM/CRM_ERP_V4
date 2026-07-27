-- 1. Create order_tags table
CREATE TABLE IF NOT EXISTS `order_tags` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `company_id` INT DEFAULT NULL,
  `name` VARCHAR(128) NOT NULL,
  `type` VARCHAR(50) NOT NULL, -- 'SYSTEM' or 'USER'
  `color` VARCHAR(20) DEFAULT '#E5E7EB',
  `created_by` INT DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Create order_tag_assignments table
CREATE TABLE IF NOT EXISTS `order_tag_assignments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_id` VARCHAR(64) NOT NULL,
  `tag_id` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `created_by` INT DEFAULT NULL,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  `deleted_by` INT DEFAULT NULL,
  KEY `idx_order_id` (`order_id`),
  KEY `idx_tag_id` (`tag_id`),
  KEY `idx_deleted_at` (`deleted_at`),
  CONSTRAINT `fk_ota_tag` FOREIGN KEY (`tag_id`) REFERENCES `order_tags` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
