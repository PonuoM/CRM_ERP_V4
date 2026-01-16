-- Create debt_collection table for tracking debt collection activities
CREATE TABLE IF NOT EXISTS `debt_collection` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `order_id` VARCHAR(50) NOT NULL COMMENT 'Reference to orders table',
  `user_id` INT(11) NOT NULL COMMENT 'User who performed the collection',
  `amount_collected` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Amount collected in this attempt',
  `result_status` TINYINT(1) NOT NULL COMMENT '1=Unable to Collect, 2=Collected Some, 3=Collected All',
  `is_complete` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0=Ongoing, 1=Case Closed',
  `note` TEXT DEFAULT NULL COMMENT 'Notes about the collection attempt',
  `slip_id` INT(11) DEFAULT NULL COMMENT 'Reference to order_slips table if payment slip was uploaded',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_result_status` (`result_status`),
  KEY `idx_is_complete` (`is_complete`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_debt_collection_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Debt collection tracking table';
