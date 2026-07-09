-- 010_create_distribution_sessions.sql

CREATE TABLE IF NOT EXISTS `distribution_sessions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `company_id` INT NOT NULL,
  `distributed_by` INT,
  `distribution_mode` VARCHAR(50),
  `total_customers` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_company_created` (`company_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `distribution_session_details` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `session_id` INT NOT NULL,
  `agent_id` INT NOT NULL,
  `customer_id` INT NOT NULL,
  FOREIGN KEY (`session_id`) REFERENCES `distribution_sessions`(`id`) ON DELETE CASCADE,
  INDEX `idx_session_agent` (`session_id`, `agent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
