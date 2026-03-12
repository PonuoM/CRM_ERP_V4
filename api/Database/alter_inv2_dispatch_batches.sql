-- Dispatch batch management tables
-- Run this migration to add batch tracking for dispatch imports

CREATE TABLE IF NOT EXISTS `inv2_dispatch_batches` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `batch_doc_number` VARCHAR(50) NOT NULL,
  `filename` VARCHAR(255) NULL COMMENT 'Original CSV filename',
  `total_rows` INT NOT NULL DEFAULT 0,
  `total_quantity` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `processed_rows` INT NOT NULL DEFAULT 0 COMMENT 'Rows that successfully deducted stock',
  `notes` TEXT NULL,
  `created_by` INT NOT NULL,
  `company_id` INT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_batch_doc` (`batch_doc_number`),
  KEY `idx_batch_company` (`company_id`),
  KEY `idx_batch_date` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `inv2_dispatch_items` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `batch_id` INT NOT NULL,
  `row_index` INT NOT NULL DEFAULT 0,
  `product_sku` VARCHAR(100) NULL,
  `product_name` VARCHAR(500) NULL,
  `variant_code` VARCHAR(100) NULL,
  `variant_name` VARCHAR(255) NULL,
  `internal_order_id` VARCHAR(100) NULL,
  `online_order_id` VARCHAR(100) NULL,
  `quantity` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `total_price` DECIMAL(12,2) NULL,
  `order_date` VARCHAR(50) NULL,
  `ship_date` VARCHAR(50) NULL,
  `order_status` VARCHAR(100) NULL,
  `platform` VARCHAR(100) NULL,
  `shop` VARCHAR(255) NULL,
  `warehouse_name` VARCHAR(255) NULL,
  `tracking_number` VARCHAR(100) NULL,
  `status` VARCHAR(100) NULL,
  `product_id` INT NULL COMMENT 'Matched product ID',
  `warehouse_id` INT NULL COMMENT 'Matched warehouse ID',
  `stock_deducted` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 if stock was successfully deducted',
  PRIMARY KEY (`id`),
  KEY `idx_di_batch` (`batch_id`),
  KEY `idx_di_product` (`product_id`),
  CONSTRAINT `fk_inv2_di_batch` FOREIGN KEY (`batch_id`) REFERENCES `inv2_dispatch_batches` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
