CREATE TABLE IF NOT EXISTS `marketplace_invoices` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `company_id` int(11) NOT NULL,
  `store_id` int(11) DEFAULT NULL,
  `platform` varchar(50) NOT NULL,
  `employee_id` int(11) DEFAULT NULL,
  `month_year` varchar(7) NOT NULL COMMENT 'Format: YYYY-MM',
  `total_sales_amount` decimal(15,2) DEFAULT '0.00',
  `actual_amount` decimal(15,2) DEFAULT '0.00',
  `file_path` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
