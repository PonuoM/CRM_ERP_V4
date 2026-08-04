-- Migration: Create voicecall_ai_logs table to store data from AI Voicecall Webhook

CREATE TABLE IF NOT EXISTS `voicecall_ai_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `conversation_id` BIGINT NOT NULL,
  `call_date` DATE NOT NULL,
  `call_time` TIME NOT NULL,
  `caller_phone` VARCHAR(20) DEFAULT NULL,
  `receiver_phone` VARCHAR(20) DEFAULT NULL,
  `direction` VARCHAR(10) DEFAULT NULL,
  `erp_customer_id` INT NULL DEFAULT NULL,
  `erp_employee_id` INT NULL DEFAULT NULL,
  `executive_summary` TEXT DEFAULT NULL,
  `customer_sentiment` VARCHAR(50) DEFAULT NULL,
  `important_keywords` TEXT DEFAULT NULL,
  `issue_category` VARCHAR(100) DEFAULT NULL,
  `priority` VARCHAR(50) DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- Add indexes for common lookups
  INDEX `idx_conversation_id` (`conversation_id`),
  INDEX `idx_erp_customer_id` (`erp_customer_id`),
  INDEX `idx_erp_employee_id` (`erp_employee_id`),
  INDEX `idx_call_date` (`call_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
