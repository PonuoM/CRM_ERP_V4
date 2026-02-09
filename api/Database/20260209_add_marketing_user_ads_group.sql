-- Create marketing_user_ads_group table
-- Links marketing users to ads_group names (replaces marketing_user_product for ads purposes)
CREATE TABLE IF NOT EXISTS `marketing_user_ads_group` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `ads_group` VARCHAR(128) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_ads_group` (`ads_group`),
  UNIQUE KEY `unique_user_ads_group` (`user_id`, `ads_group`),
  CONSTRAINT `fk_marketing_user_ads_group_user_id`
    FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'Table marketing_user_ads_group created successfully' AS status;
