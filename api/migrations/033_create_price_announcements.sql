-- 035_create_price_announcements.sql
-- Monthly price/promotion announcement feature (publishing-only, manual CMS).

CREATE TABLE IF NOT EXISTS `price_announcements` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `company_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `month` DATE NOT NULL,
  `title` VARCHAR(255) NULL,
  `created_by` INT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL,
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`),
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`),
  INDEX `idx_company_product_month` (`company_id`, `product_id`, `month`),
  INDEX `idx_month` (`month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `price_announcement_tiers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `announcement_id` INT NOT NULL,
  `quantity` INT NOT NULL,
  `new_total_price` DECIMAL(12,2) NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  FOREIGN KEY (`announcement_id`) REFERENCES `price_announcements`(`id`) ON DELETE CASCADE,
  INDEX `idx_announcement` (`announcement_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `price_announcement_tier_notes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `tier_id` INT NOT NULL,
  `note_text` TEXT NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  FOREIGN KEY (`tier_id`) REFERENCES `price_announcement_tiers`(`id`) ON DELETE CASCADE,
  INDEX `idx_tier` (`tier_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `price_announcement_discount_tiers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `announcement_id` INT NOT NULL,
  `min_amount` DECIMAL(12,2) NOT NULL,
  `cod_discount_pct` DECIMAL(5,2) NULL,
  `transfer_discount_pct` DECIMAL(5,2) NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  FOREIGN KEY (`announcement_id`) REFERENCES `price_announcements`(`id`) ON DELETE CASCADE,
  INDEX `idx_announcement` (`announcement_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `price_announcement_discount_notes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `announcement_id` INT NOT NULL,
  `note_text` TEXT NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  FOREIGN KEY (`announcement_id`) REFERENCES `price_announcements`(`id`) ON DELETE CASCADE,
  INDEX `idx_announcement` (`announcement_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `price_announcement_visibility_roles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `announcement_id` INT NOT NULL,
  `role_id` INT NOT NULL,
  FOREIGN KEY (`announcement_id`) REFERENCES `price_announcements`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`),
  UNIQUE KEY `uniq_announcement_role` (`announcement_id`, `role_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `price_announcement_visibility_companies` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `announcement_id` INT NOT NULL,
  `company_id` INT NOT NULL,
  FOREIGN KEY (`announcement_id`) REFERENCES `price_announcements`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`),
  UNIQUE KEY `uniq_announcement_company` (`announcement_id`, `company_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
