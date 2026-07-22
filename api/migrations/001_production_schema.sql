-- [MODIFIED FOR SAFETY]
-- This file has been automatically modified to be idempotent.
-- All DROP TABLE IF EXISTS statements have been commented out.
-- All CREATE TABLE statements have been changed to CREATE TABLE IF NOT EXISTS.
-- It is now safe to run this file on an existing database without data loss.

-- Production Schema (Base Tables Only)
-- Exported on 2026-05-13 05:03:38

SET FOREIGN_KEY_CHECKS=0;

-- Table structure for `activities`
-- DROP TABLE IF EXISTS `activities`;
CREATE TABLE IF NOT EXISTS `activities` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `customer_id` int(11) DEFAULT NULL,
  `timestamp` datetime DEFAULT NULL,
  `type` varchar(64) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `actor_name` varchar(128) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_activities_timestamp` (`timestamp`)
) ENGINE=InnoDB AUTO_INCREMENT=39344 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `activities_bak_20260426`
-- DROP TABLE IF EXISTS `activities_bak_20260426`;
CREATE TABLE IF NOT EXISTS `activities_bak_20260426` (
  `id` bigint(20) NOT NULL DEFAULT 0,
  `customer_id` int(11) DEFAULT NULL,
  `timestamp` datetime DEFAULT NULL,
  `type` varchar(64) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `actor_name` varchar(128) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `ad_spend`
-- DROP TABLE IF EXISTS `ad_spend`;
CREATE TABLE IF NOT EXISTS `ad_spend` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `page_id` int(11) DEFAULT NULL,
  `spend_date` date DEFAULT NULL,
  `amount` decimal(12,2) DEFAULT NULL,
  `notes` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_page_date` (`page_id`,`spend_date`),
  CONSTRAINT `fk_adspend_page` FOREIGN KEY (`page_id`) REFERENCES `pages` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `address_districts`
-- DROP TABLE IF EXISTS `address_districts`;
CREATE TABLE IF NOT EXISTS `address_districts` (
  `id` int(11) NOT NULL,
  `name_th` varchar(255) DEFAULT NULL,
  `name_en` varchar(255) DEFAULT NULL,
  `province_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `province_id` (`province_id`),
  CONSTRAINT `address_districts_ibfk_1` FOREIGN KEY (`province_id`) REFERENCES `address_provinces` (`id`) ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `address_geographies`
-- DROP TABLE IF EXISTS `address_geographies`;
CREATE TABLE IF NOT EXISTS `address_geographies` (
  `id` int(11) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `address_provinces`
-- DROP TABLE IF EXISTS `address_provinces`;
CREATE TABLE IF NOT EXISTS `address_provinces` (
  `id` int(11) NOT NULL,
  `name_th` varchar(255) DEFAULT NULL,
  `name_en` varchar(255) DEFAULT NULL,
  `geography_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `geography_id` (`geography_id`),
  CONSTRAINT `address_provinces_ibfk_1` FOREIGN KEY (`geography_id`) REFERENCES `address_geographies` (`id`) ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `address_sub_districts`
-- DROP TABLE IF EXISTS `address_sub_districts`;
CREATE TABLE IF NOT EXISTS `address_sub_districts` (
  `id` int(11) NOT NULL,
  `zip_code` varchar(10) DEFAULT NULL,
  `name_th` varchar(255) DEFAULT NULL,
  `name_en` varchar(255) DEFAULT NULL,
  `district_id` int(11) DEFAULT NULL,
  `lat` decimal(10,8) DEFAULT NULL,
  `long` decimal(11,8) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `address_sub_districts_ibfk_1` FOREIGN KEY (`district_id`) REFERENCES `address_districts` (`id`) ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `app_settings`
-- DROP TABLE IF EXISTS `app_settings`;
CREATE TABLE IF NOT EXISTS `app_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `appointments`
-- DROP TABLE IF EXISTS `appointments`;
CREATE TABLE IF NOT EXISTS `appointments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_id` int(11) DEFAULT NULL,
  `customer_ref_id` varchar(64) DEFAULT NULL,
  `date` datetime DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `status` varchar(64) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_appointments_date` (`date`),
  KEY `idx_appointments_status` (`status`),
  KEY `idx_appointments_customer` (`customer_id`),
  KEY `idx_appointments_customer_status_date` (`customer_id`,`status`,`date`)
) ENGINE=InnoDB AUTO_INCREMENT=121463 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `appointments_bak_20260426`
-- DROP TABLE IF EXISTS `appointments_bak_20260426`;
CREATE TABLE IF NOT EXISTS `appointments_bak_20260426` (
  `id` int(11) NOT NULL DEFAULT 0,
  `customer_id` int(11) DEFAULT NULL,
  `customer_ref_id` varchar(64) DEFAULT NULL,
  `date` datetime DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `status` varchar(64) DEFAULT NULL,
  `notes` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `bank_account`
-- DROP TABLE IF EXISTS `bank_account`;
CREATE TABLE IF NOT EXISTS `bank_account` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `company_id` int(11) DEFAULT NULL,
  `bank` varchar(100) DEFAULT NULL,
  `bank_number` varchar(50) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_company_id` (`company_id`),
  KEY `idx_is_active` (`is_active`),
  CONSTRAINT `fk_bank_account_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `basket_config`
-- DROP TABLE IF EXISTS `basket_config`;
CREATE TABLE IF NOT EXISTS `basket_config` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `basket_key` varchar(50) NOT NULL,
  `basket_name` varchar(100) NOT NULL,
  `min_order_count` int(11) DEFAULT NULL COMMENT 'Minimum order count (NULL = no limit)',
  `max_order_count` int(11) DEFAULT NULL COMMENT 'Maximum order count (NULL = no limit)',
  `min_days_since_order` int(11) DEFAULT NULL COMMENT 'Minimum days since last order',
  `max_days_since_order` int(11) DEFAULT NULL COMMENT 'Maximum days since last order',
  `days_since_first_order` int(11) DEFAULT NULL COMMENT 'For new customer basket',
  `days_since_registered` int(11) DEFAULT NULL COMMENT 'For new customer without orders',
  `target_page` enum('dashboard_v2','distribution') NOT NULL DEFAULT 'dashboard_v2',
  `display_order` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `company_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL ON UPDATE current_timestamp(),
  `on_fail_reevaluate` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'If true, re-evaluate customer criteria on fail instead of fixed basket',
  `on_max_dist_basket_key` varchar(50) DEFAULT NULL COMMENT 'Basket key to transition to when max distribution count is reached',
  `has_loop` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'If true, basket has distribution loop logic',
  `on_sale_basket_key` varchar(50) DEFAULT NULL COMMENT 'ถังที่ย้ายไปเมื่อขายได้',
  `on_fail_basket_key` varchar(50) DEFAULT NULL COMMENT 'ถังที่ย้ายไปเมื่อหมดเวลา/ไม่ขาย',
  `fail_after_days` int(11) DEFAULT NULL COMMENT 'จำนวนวันก่อนถือว่าไม่ขาย',
  `max_distribution_count` int(11) DEFAULT 4 COMMENT 'จำนวนรอบสูงสุดก่อนหลุดไปถังถัดไป',
  `hold_days_before_redistribute` int(11) DEFAULT 30 COMMENT 'วันที่ต้องรอก่อนแจกซ้ำ',
  `linked_basket_key` varchar(50) DEFAULT NULL COMMENT 'ถังคู่ในอีก target_page',
  `blocked_target_baskets` text DEFAULT NULL COMMENT 'Comma-separated basket_keys ที่ห้ามย้ายไป เช่น "waiting_for_match,find_new_owner"',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_basket_company` (`basket_key`,`company_id`),
  KEY `idx_company_page` (`company_id`,`target_page`),
  KEY `idx_display_order` (`display_order`)
) ENGINE=InnoDB AUTO_INCREMENT=56 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `basket_return_config`
-- DROP TABLE IF EXISTS `basket_return_config`;
CREATE TABLE IF NOT EXISTS `basket_return_config` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `config_key` varchar(50) NOT NULL,
  `config_value` varchar(255) NOT NULL,
  `description` varchar(500) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `company_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `config_key` (`config_key`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `basket_return_log`
-- DROP TABLE IF EXISTS `basket_return_log`;
CREATE TABLE IF NOT EXISTS `basket_return_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_id` int(11) NOT NULL,
  `previous_assigned_to` int(11) DEFAULT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `days_since_last_order` int(11) DEFAULT NULL,
  `batch_date` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_batch_date` (`batch_date`),
  KEY `idx_previous_assigned` (`previous_assigned_to`)
) ENGINE=InnoDB AUTO_INCREMENT=356572 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `basket_return_log_bak_20260426`
-- DROP TABLE IF EXISTS `basket_return_log_bak_20260426`;
CREATE TABLE IF NOT EXISTS `basket_return_log_bak_20260426` (
  `id` int(11) NOT NULL DEFAULT 0,
  `customer_id` int(11) NOT NULL,
  `previous_assigned_to` int(11) DEFAULT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `days_since_last_order` int(11) DEFAULT NULL,
  `batch_date` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `basket_transition_log`
-- DROP TABLE IF EXISTS `basket_transition_log`;
CREATE TABLE IF NOT EXISTS `basket_transition_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_id` int(11) NOT NULL,
  `from_basket_key` varchar(50) DEFAULT NULL COMMENT 'ถังต้นทาง',
  `to_basket_key` varchar(50) NOT NULL COMMENT 'ถังปลายทาง',
  `assigned_to_old` int(11) DEFAULT NULL COMMENT 'Owner ก่อนย้าย',
  `assigned_to_new` int(11) DEFAULT NULL COMMENT 'Owner หลังย้าย',
  `transition_type` enum('sale','fail','monthly_cron','manual','redistribute','pending_admin_owned','pending_admin_unowned','picking_upsell_sold','picking_upsell_not_sold','picking_dist_to_pool','picking_telesale_own','picking_admin_to_upsell','picking_telesale_from_dist','picking_admin_no_owner','aging_timeout','upsell_by_others','upsell_exit','upsell_distribution','distribute','reclaim','transfer') NOT NULL COMMENT 'ประเภทการย้าย',
  `triggered_by` int(11) DEFAULT NULL COMMENT 'user_id ที่ทำให้เกิด',
  `order_id` varchar(50) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_transition_type` (`transition_type`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_assigned_old` (`assigned_to_old`),
  KEY `idx_assigned_new` (`assigned_to_new`)
) ENGINE=InnoDB AUTO_INCREMENT=966624 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Log การย้ายถังของลูกค้า';

-- Table structure for `basket_transition_log_bak_20260426`
-- DROP TABLE IF EXISTS `basket_transition_log_bak_20260426`;
CREATE TABLE IF NOT EXISTS `basket_transition_log_bak_20260426` (
  `id` int(11) NOT NULL DEFAULT 0,
  `customer_id` int(11) NOT NULL,
  `from_basket_key` varchar(50) DEFAULT NULL COMMENT 'ถังต้นทาง',
  `to_basket_key` varchar(50) NOT NULL COMMENT 'ถังปลายทาง',
  `assigned_to_old` int(11) DEFAULT NULL COMMENT 'Owner ก่อนย้าย',
  `assigned_to_new` int(11) DEFAULT NULL COMMENT 'Owner หลังย้าย',
  `transition_type` enum('sale','fail','monthly_cron','manual','redistribute','pending_admin_owned','pending_admin_unowned','picking_upsell_sold','picking_upsell_not_sold','picking_dist_to_pool','picking_telesale_own','picking_admin_to_upsell','picking_telesale_from_dist','picking_admin_no_owner','aging_timeout','upsell_by_others','upsell_exit','upsell_distribution','distribute','reclaim','transfer') NOT NULL COMMENT 'ประเภทการย้าย',
  `triggered_by` int(11) DEFAULT NULL COMMENT 'user_id ที่ทำให้เกิด',
  `order_id` varchar(50) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `call_history`
-- DROP TABLE IF EXISTS `call_history`;
CREATE TABLE IF NOT EXISTS `call_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_id` int(11) DEFAULT NULL,
  `date` datetime DEFAULT NULL,
  `caller` varchar(128) DEFAULT NULL,
  `status` varchar(64) DEFAULT NULL,
  `result` varchar(255) DEFAULT NULL,
  `crop_type` varchar(128) DEFAULT NULL,
  `area_size` varchar(128) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `duration` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_customer_id` (`customer_id`)
) ENGINE=InnoDB AUTO_INCREMENT=369149 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `call_history_bak_20260426`
-- DROP TABLE IF EXISTS `call_history_bak_20260426`;
CREATE TABLE IF NOT EXISTS `call_history_bak_20260426` (
  `id` int(11) NOT NULL DEFAULT 0,
  `customer_id` int(11) DEFAULT NULL,
  `date` datetime DEFAULT NULL,
  `caller` varchar(128) DEFAULT NULL,
  `status` varchar(64) DEFAULT NULL,
  `result` varchar(255) DEFAULT NULL,
  `crop_type` varchar(128) DEFAULT NULL,
  `area_size` varchar(128) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `duration` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `call_import_batches`
-- DROP TABLE IF EXISTS `call_import_batches`;
CREATE TABLE IF NOT EXISTS `call_import_batches` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `file_name` varchar(255) NOT NULL,
  `total_rows` int(11) NOT NULL DEFAULT 0,
  `matched_rows` int(11) NOT NULL DEFAULT 0,
  `duplicate_rows` int(11) NOT NULL DEFAULT 0,
  `company_id` int(11) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_cib_company` (`company_id`),
  KEY `idx_cib_created` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=98 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `call_import_logs`
-- DROP TABLE IF EXISTS `call_import_logs`;
CREATE TABLE IF NOT EXISTS `call_import_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `batch_id` int(11) NOT NULL,
  `record_id` varchar(32) NOT NULL,
  `business_group_name` varchar(255) DEFAULT NULL,
  `call_date` date DEFAULT NULL,
  `call_origination` varchar(32) DEFAULT NULL,
  `display_number` varchar(32) DEFAULT NULL,
  `call_termination` varchar(32) DEFAULT NULL,
  `status` tinyint(4) DEFAULT 0,
  `start_time` time DEFAULT NULL,
  `ringing_duration` varchar(16) DEFAULT NULL,
  `answered_time` varchar(16) DEFAULT NULL,
  `terminated_time` varchar(16) DEFAULT NULL,
  `terminated_reason` varchar(8) DEFAULT NULL,
  `reason_change` varchar(8) DEFAULT NULL,
  `final_number` varchar(32) DEFAULT NULL,
  `duration` varchar(16) DEFAULT NULL,
  `rec_type` tinyint(4) DEFAULT NULL,
  `charging_group` varchar(128) DEFAULT NULL,
  `agent_phone` varchar(32) DEFAULT NULL,
  `matched_user_id` int(11) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_record_id` (`record_id`),
  KEY `idx_cil_batch` (`batch_id`),
  KEY `idx_cil_call_date` (`call_date`),
  KEY `idx_cil_agent_phone` (`agent_phone`),
  CONSTRAINT `call_import_logs_ibfk_1` FOREIGN KEY (`batch_id`) REFERENCES `call_import_batches` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1016332 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `cancellation_types`
-- DROP TABLE IF EXISTS `cancellation_types`;
CREATE TABLE IF NOT EXISTS `cancellation_types` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `label` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `cod_documents`
-- DROP TABLE IF EXISTS `cod_documents`;
CREATE TABLE IF NOT EXISTS `cod_documents` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `document_number` varchar(64) DEFAULT NULL,
  `document_datetime` datetime DEFAULT NULL,
  `bank_account_id` int(11) DEFAULT NULL,
  `matched_statement_log_id` int(11) DEFAULT NULL,
  `company_id` int(11) DEFAULT NULL,
  `total_input_amount` decimal(12,2) DEFAULT NULL,
  `total_order_amount` decimal(12,2) DEFAULT NULL,
  `status` varchar(32) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `verified_by` int(11) DEFAULT NULL,
  `verified_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_cod_document_company_number` (`company_id`,`document_number`),
  KEY `fk_cod_documents_bank` (`bank_account_id`),
  KEY `fk_cod_documents_creator` (`created_by`),
  KEY `fk_cod_documents_verified_by` (`verified_by`),
  KEY `idx_cod_documents_company` (`company_id`),
  KEY `idx_cod_documents_datetime` (`document_datetime`),
  KEY `idx_cod_documents_statement` (`matched_statement_log_id`),
  KEY `idx_cod_documents_status` (`status`),
  CONSTRAINT `fk_cod_documents_statement` FOREIGN KEY (`matched_statement_log_id`) REFERENCES `statement_logs` (`id`) ON UPDATE NO ACTION,
  CONSTRAINT `fk_cod_documents_verified_by` FOREIGN KEY (`verified_by`) REFERENCES `users` (`id`) ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=747 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `cod_records`
-- DROP TABLE IF EXISTS `cod_records`;
CREATE TABLE IF NOT EXISTS `cod_records` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tracking_number` varchar(128) DEFAULT NULL,
  `delivery_start_date` date DEFAULT NULL,
  `delivery_end_date` date DEFAULT NULL,
  `cod_amount` decimal(12,2) DEFAULT NULL,
  `received_amount` decimal(12,2) DEFAULT NULL,
  `difference` decimal(12,2) DEFAULT NULL,
  `status` varchar(32) NOT NULL DEFAULT 'pending',
  `company_id` int(11) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  `document_id` int(11) DEFAULT NULL,
  `order_id` varchar(32) DEFAULT NULL,
  `order_amount` decimal(12,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_cod_records_creator` (`created_by`),
  KEY `idx_company` (`company_id`),
  KEY `idx_status` (`status`),
  KEY `idx_tracking` (`tracking_number`),
  KEY `idx_cod_records_document` (`document_id`),
  KEY `idx_cod_records_order` (`order_id`),
  CONSTRAINT `fk_cod_records_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_cod_records_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON UPDATE NO ACTION,
  CONSTRAINT `fk_cod_records_document` FOREIGN KEY (`document_id`) REFERENCES `cod_documents` (`id`) ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=66391 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `commission_order_lines`
-- DROP TABLE IF EXISTS `commission_order_lines`;
CREATE TABLE IF NOT EXISTS `commission_order_lines` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `record_id` int(11) DEFAULT NULL,
  `order_id` varchar(32) DEFAULT NULL,
  `order_date` date DEFAULT NULL,
  `confirmed_at` datetime DEFAULT NULL,
  `order_amount` decimal(12,2) DEFAULT NULL,
  `commission_amount` decimal(12,2) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_commission_order` (`order_id`),
  KEY `record_id` (`record_id`),
  CONSTRAINT `commission_order_lines_ibfk_1` FOREIGN KEY (`record_id`) REFERENCES `commission_records` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=5329 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `commission_periods`
-- DROP TABLE IF EXISTS `commission_periods`;
CREATE TABLE IF NOT EXISTS `commission_periods` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `company_id` int(11) DEFAULT NULL,
  `period_month` int(11) DEFAULT NULL,
  `period_year` int(11) DEFAULT NULL,
  `order_month` int(11) DEFAULT NULL,
  `order_year` int(11) DEFAULT NULL,
  `cutoff_date` date DEFAULT NULL,
  `status` varchar(20) DEFAULT NULL,
  `total_sales` decimal(14,2) DEFAULT NULL,
  `total_commission` decimal(14,2) DEFAULT NULL,
  `total_orders` int(11) DEFAULT NULL,
  `calculated_at` datetime DEFAULT NULL,
  `calculated_by` int(11) DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `approved_by` int(11) DEFAULT NULL,
  `paid_at` datetime DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_period` (`company_id`,`period_year`,`period_month`),
  KEY `idx_period_company` (`company_id`,`period_year`,`period_month`),
  KEY `idx_period_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `commission_records`
-- DROP TABLE IF EXISTS `commission_records`;
CREATE TABLE IF NOT EXISTS `commission_records` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `period_id` int(11) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `total_sales` decimal(12,2) DEFAULT NULL,
  `commission_rate` decimal(5,2) DEFAULT NULL,
  `commission_amount` decimal(12,2) DEFAULT NULL,
  `order_count` int(11) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_commission_period_user` (`period_id`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `commission_records_ibfk_1` FOREIGN KEY (`period_id`) REFERENCES `commission_periods` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `commission_records_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=38 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `commission_settings`
-- DROP TABLE IF EXISTS `commission_settings`;
CREATE TABLE IF NOT EXISTS `commission_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `company_id` int(11) NOT NULL,
  `role_id` int(11) NOT NULL,
  `config_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`config_data`)),
  `updated_by` int(11) DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_company_role` (`company_id`,`role_id`),
  KEY `company_idx` (`company_id`),
  KEY `role_idx` (`role_id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `commission_stamp_batches`
-- DROP TABLE IF EXISTS `commission_stamp_batches`;
CREATE TABLE IF NOT EXISTS `commission_stamp_batches` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `company_id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `order_count` int(11) DEFAULT 0,
  `total_commission` decimal(12,2) DEFAULT 0.00,
  `created_by` int(11) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `note` text DEFAULT NULL,
  `for_month` int(11) DEFAULT NULL,
  `for_year` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_csb_company` (`company_id`),
  KEY `idx_csb_created` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `commission_stamp_orders`
-- DROP TABLE IF EXISTS `commission_stamp_orders`;
CREATE TABLE IF NOT EXISTS `commission_stamp_orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `batch_id` int(11) NOT NULL,
  `order_id` varchar(50) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `commission_amount` decimal(12,2) DEFAULT NULL,
  `note` text DEFAULT NULL,
  `stamped_at` datetime DEFAULT current_timestamp(),
  `stamped_by` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_batch_order_user` (`batch_id`,`order_id`,`user_id`),
  KEY `idx_cso_order` (`order_id`),
  KEY `idx_cso_user` (`user_id`),
  CONSTRAINT `fk_cso_batch` FOREIGN KEY (`batch_id`) REFERENCES `commission_stamp_batches` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8057 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `companies`
-- DROP TABLE IF EXISTS `companies`;
CREATE TABLE IF NOT EXISTS `companies` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `phone` varchar(64) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `tax_id` varchar(32) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `customer_address`
-- DROP TABLE IF EXISTS `customer_address`;
CREATE TABLE IF NOT EXISTS `customer_address` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_id` varchar(255) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `recipient_first_name` varchar(128) DEFAULT NULL,
  `recipient_last_name` varchar(128) DEFAULT NULL,
  `province` varchar(100) DEFAULT NULL,
  `district` varchar(100) DEFAULT NULL,
  `sub_district` varchar(100) DEFAULT NULL,
  `zip_code` varchar(10) DEFAULT NULL,
  `recipient_phone` varchar(50) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `customer_id` (`customer_id`)
) ENGINE=InnoDB AUTO_INCREMENT=288 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `customer_address_bak_20260426`
-- DROP TABLE IF EXISTS `customer_address_bak_20260426`;
CREATE TABLE IF NOT EXISTS `customer_address_bak_20260426` (
  `id` int(11) NOT NULL DEFAULT 0,
  `customer_id` varchar(255) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `recipient_first_name` varchar(128) DEFAULT NULL,
  `recipient_last_name` varchar(128) DEFAULT NULL,
  `province` varchar(100) DEFAULT NULL,
  `district` varchar(100) DEFAULT NULL,
  `sub_district` varchar(100) DEFAULT NULL,
  `zip_code` varchar(10) DEFAULT NULL,
  `recipient_phone` varchar(50) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `customer_assign_check`
-- DROP TABLE IF EXISTS `customer_assign_check`;
CREATE TABLE IF NOT EXISTS `customer_assign_check` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `company_id` int(11) NOT NULL DEFAULT 1,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_customer_check` (`customer_id`,`user_id`),
  KEY `idx_user_check` (`user_id`),
  CONSTRAINT `fk_cac_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cac_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=447198 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `customer_assignment_history`
-- DROP TABLE IF EXISTS `customer_assignment_history`;
CREATE TABLE IF NOT EXISTS `customer_assignment_history` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `customer_id` int(11) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `assigned_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_cah_user` (`user_id`),
  CONSTRAINT `fk_cah_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=11577 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `customer_assignment_history_bak_20260426`
-- DROP TABLE IF EXISTS `customer_assignment_history_bak_20260426`;
CREATE TABLE IF NOT EXISTS `customer_assignment_history_bak_20260426` (
  `id` bigint(20) NOT NULL DEFAULT 0,
  `customer_id` int(11) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `assigned_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `customer_audit_log`
-- DROP TABLE IF EXISTS `customer_audit_log`;
CREATE TABLE IF NOT EXISTS `customer_audit_log` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `customer_id` int(11) NOT NULL COMMENT 'customers.customer_id (PK)',
  `field_name` varchar(50) NOT NULL COMMENT 'ชื่อฟิลด์ที่เปลี่ยน',
  `old_value` varchar(255) DEFAULT NULL,
  `new_value` varchar(255) DEFAULT NULL,
  `api_source` varchar(100) DEFAULT NULL COMMENT 'API ที่ทำการเปลี่ยนแปลง เช่น basket_config/distribute',
  `changed_by` int(11) DEFAULT NULL COMMENT 'user_id ที่ทำการเปลี่ยนแปลง',
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_field_name` (`field_name`)
) ENGINE=InnoDB AUTO_INCREMENT=1253451 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `customer_audit_log_bak_20260426`
-- DROP TABLE IF EXISTS `customer_audit_log_bak_20260426`;
CREATE TABLE IF NOT EXISTS `customer_audit_log_bak_20260426` (
  `id` bigint(20) NOT NULL DEFAULT 0,
  `customer_id` int(11) NOT NULL COMMENT 'customers.customer_id (PK)',
  `field_name` varchar(50) NOT NULL COMMENT 'ชื่อฟิลด์ที่เปลี่ยน',
  `old_value` varchar(255) DEFAULT NULL,
  `new_value` varchar(255) DEFAULT NULL,
  `api_source` varchar(100) DEFAULT NULL COMMENT 'API ที่ทำการเปลี่ยนแปลง เช่น basket_config/distribute',
  `changed_by` int(11) DEFAULT NULL COMMENT 'user_id ที่ทำการเปลี่ยนแปลง',
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `customer_blocks`
-- DROP TABLE IF EXISTS `customer_blocks`;
CREATE TABLE IF NOT EXISTS `customer_blocks` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_id` varchar(64) DEFAULT NULL,
  `reason` text DEFAULT NULL,
  `blocked_by` int(11) DEFAULT NULL,
  `blocked_at` datetime DEFAULT NULL,
  `unblocked_by` int(11) DEFAULT NULL,
  `unblocked_at` datetime DEFAULT NULL,
  `active` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=51 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `customer_blocks_bak_20260426`
-- DROP TABLE IF EXISTS `customer_blocks_bak_20260426`;
CREATE TABLE IF NOT EXISTS `customer_blocks_bak_20260426` (
  `id` int(11) NOT NULL DEFAULT 0,
  `customer_id` varchar(64) DEFAULT NULL,
  `reason` text DEFAULT NULL,
  `blocked_by` int(11) DEFAULT NULL,
  `blocked_at` datetime DEFAULT NULL,
  `unblocked_by` int(11) DEFAULT NULL,
  `unblocked_at` datetime DEFAULT NULL,
  `active` tinyint(1) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `customer_logs`
-- DROP TABLE IF EXISTS `customer_logs`;
CREATE TABLE IF NOT EXISTS `customer_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_id` varchar(32) DEFAULT NULL,
  `bucket_type` varchar(16) DEFAULT NULL,
  `lifecycle_status` varchar(255) DEFAULT NULL,
  `assigned_to` int(11) DEFAULT NULL,
  `action_type` varchar(255) DEFAULT NULL,
  `old_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`old_values`)),
  `new_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`new_values`)),
  `changed_fields` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`changed_fields`)),
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_assigned_to` (`assigned_to`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_customer_id` (`customer_id`)
) ENGINE=InnoDB AUTO_INCREMENT=1364406 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `customer_logs_bak_20260426`
-- DROP TABLE IF EXISTS `customer_logs_bak_20260426`;
CREATE TABLE IF NOT EXISTS `customer_logs_bak_20260426` (
  `id` int(11) NOT NULL DEFAULT 0,
  `customer_id` varchar(32) DEFAULT NULL,
  `bucket_type` varchar(16) DEFAULT NULL,
  `lifecycle_status` varchar(255) DEFAULT NULL,
  `assigned_to` int(11) DEFAULT NULL,
  `action_type` varchar(255) DEFAULT NULL,
  `old_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`old_values`)),
  `new_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`new_values`)),
  `changed_fields` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`changed_fields`)),
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `customer_tags`
-- DROP TABLE IF EXISTS `customer_tags`;
CREATE TABLE IF NOT EXISTS `customer_tags` (
  `customer_id` varchar(64) DEFAULT NULL,
  `tag_id` int(11) DEFAULT NULL,
  KEY `fk_customer_tags_tag` (`tag_id`),
  CONSTRAINT `fk_customer_tags_tag` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `customer_tags_bak_20260426`
-- DROP TABLE IF EXISTS `customer_tags_bak_20260426`;
CREATE TABLE IF NOT EXISTS `customer_tags_bak_20260426` (
  `customer_id` varchar(64) DEFAULT NULL,
  `tag_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `customers`
-- DROP TABLE IF EXISTS `customers`;
CREATE TABLE IF NOT EXISTS `customers` (
  `customer_id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_ref_id` varchar(64) DEFAULT NULL,
  `first_name` varchar(128) DEFAULT NULL,
  `last_name` varchar(128) DEFAULT NULL,
  `phone` varchar(64) DEFAULT NULL,
  `recipient_phone` varchar(50) DEFAULT NULL,
  `backup_phone` varchar(64) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `province` varchar(128) DEFAULT NULL,
  `company_id` int(11) DEFAULT NULL,
  `assigned_to` int(11) DEFAULT NULL,
  `current_round` int(11) NOT NULL DEFAULT 1,
  `date_assigned` datetime DEFAULT NULL,
  `date_registered` datetime DEFAULT NULL,
  `follow_up_date` datetime DEFAULT NULL,
  `ownership_expires` datetime DEFAULT NULL,
  `lifecycle_status` varchar(255) DEFAULT NULL,
  `behavioral_status` varchar(255) DEFAULT NULL,
  `grade` varchar(255) DEFAULT NULL,
  `total_purchases` decimal(12,2) DEFAULT NULL,
  `total_calls` int(11) DEFAULT NULL,
  `facebook_name` varchar(255) DEFAULT NULL,
  `line_id` varchar(128) DEFAULT NULL,
  `street` varchar(255) DEFAULT NULL,
  `subdistrict` varchar(128) DEFAULT NULL,
  `district` varchar(128) DEFAULT NULL,
  `postal_code` varchar(16) DEFAULT NULL,
  `recipient_first_name` varchar(128) DEFAULT NULL,
  `recipient_last_name` varchar(128) DEFAULT NULL,
  `has_sold_before` tinyint(1) DEFAULT NULL,
  `follow_up_count` int(11) DEFAULT NULL,
  `last_follow_up_date` datetime DEFAULT NULL,
  `last_sale_date` datetime DEFAULT NULL,
  `is_in_waiting_basket` tinyint(1) DEFAULT NULL,
  `waiting_basket_start_date` datetime DEFAULT NULL,
  `followup_bonus_remaining` tinyint(1) DEFAULT NULL,
  `is_blocked` tinyint(1) DEFAULT NULL,
  `first_order_date` datetime DEFAULT NULL,
  `last_order_date` datetime DEFAULT NULL,
  `order_count` int(11) DEFAULT NULL,
  `is_new_customer` tinyint(1) DEFAULT NULL,
  `is_repeat_customer` tinyint(1) DEFAULT NULL,
  `bucket_type` varchar(16) DEFAULT NULL,
  `ai_last_updated` datetime DEFAULT NULL,
  `ai_reason_thai` text DEFAULT NULL,
  `ai_score` int(11) DEFAULT NULL,
  `previous_lifecycle_status` varchar(50) DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `distribution_count` int(11) DEFAULT 0 COMMENT 'จำนวนครั้งที่ถูกแจกแล้วไม่ขายได้',
  `last_distribution_date` datetime DEFAULT NULL COMMENT 'วันที่แจกล่าสุด',
  `hold_until_date` datetime DEFAULT NULL COMMENT 'ห้ามแจกจนกว่าถึงวันนี้',
  `previous_assigned_to` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'รายชื่อ user_id ที่เคยได้รับแจก' CHECK (json_valid(`previous_assigned_to`)),
  `current_basket_key` varchar(50) DEFAULT NULL COMMENT 'ถังปัจจุบัน',
  `basket_entered_date` datetime DEFAULT NULL COMMENT 'วันที่เข้าถังปัจจุบัน',
  `birth_date` date DEFAULT NULL,
  PRIMARY KEY (`customer_id`),
  UNIQUE KEY `uniq_customers_customer_ref_id` (`customer_ref_id`),
  KEY `idx_customers_assigned_to` (`assigned_to`),
  KEY `idx_customers_blocked` (`is_blocked`),
  KEY `idx_customers_company` (`company_id`),
  KEY `idx_customers_company_assigned` (`company_id`,`assigned_to`),
  KEY `idx_customers_company_status` (`company_id`,`lifecycle_status`),
  KEY `idx_customers_date_assigned` (`date_assigned`),
  KEY `idx_customers_lifecycle_status` (`lifecycle_status`),
  KEY `idx_customers_ownership_expires` (`ownership_expires`),
  KEY `idx_customers_waiting` (`is_in_waiting_basket`),
  KEY `idx_company_assigned` (`company_id`,`assigned_to`),
  KEY `idx_current_basket` (`current_basket_key`),
  KEY `idx_hold_until` (`hold_until_date`),
  KEY `idx_distribution_count` (`distribution_count`),
  KEY `idx_customers_assigned` (`assigned_to`),
  KEY `idx_customers_assigned_basket` (`assigned_to`,`current_basket_key`),
  CONSTRAINT `fk_customers_assigned_to` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_customers_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=336867 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `customers_bak_20260426`
-- DROP TABLE IF EXISTS `customers_bak_20260426`;
CREATE TABLE IF NOT EXISTS `customers_bak_20260426` (
  `customer_id` int(11) NOT NULL DEFAULT 0,
  `customer_ref_id` varchar(64) DEFAULT NULL,
  `first_name` varchar(128) DEFAULT NULL,
  `last_name` varchar(128) DEFAULT NULL,
  `phone` varchar(64) DEFAULT NULL,
  `recipient_phone` varchar(50) DEFAULT NULL,
  `backup_phone` varchar(64) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `province` varchar(128) DEFAULT NULL,
  `company_id` int(11) DEFAULT NULL,
  `assigned_to` int(11) DEFAULT NULL,
  `current_round` int(11) NOT NULL DEFAULT 1,
  `date_assigned` datetime DEFAULT NULL,
  `date_registered` datetime DEFAULT NULL,
  `follow_up_date` datetime DEFAULT NULL,
  `ownership_expires` datetime DEFAULT NULL,
  `lifecycle_status` varchar(255) DEFAULT NULL,
  `behavioral_status` varchar(255) DEFAULT NULL,
  `grade` varchar(255) DEFAULT NULL,
  `total_purchases` decimal(12,2) DEFAULT NULL,
  `total_calls` int(11) DEFAULT NULL,
  `facebook_name` varchar(255) DEFAULT NULL,
  `line_id` varchar(128) DEFAULT NULL,
  `street` varchar(255) DEFAULT NULL,
  `subdistrict` varchar(128) DEFAULT NULL,
  `district` varchar(128) DEFAULT NULL,
  `postal_code` varchar(16) DEFAULT NULL,
  `recipient_first_name` varchar(128) DEFAULT NULL,
  `recipient_last_name` varchar(128) DEFAULT NULL,
  `has_sold_before` tinyint(1) DEFAULT NULL,
  `follow_up_count` int(11) DEFAULT NULL,
  `last_follow_up_date` datetime DEFAULT NULL,
  `last_sale_date` datetime DEFAULT NULL,
  `is_in_waiting_basket` tinyint(1) DEFAULT NULL,
  `waiting_basket_start_date` datetime DEFAULT NULL,
  `followup_bonus_remaining` tinyint(1) DEFAULT NULL,
  `is_blocked` tinyint(1) DEFAULT NULL,
  `first_order_date` datetime DEFAULT NULL,
  `last_order_date` datetime DEFAULT NULL,
  `order_count` int(11) DEFAULT NULL,
  `is_new_customer` tinyint(1) DEFAULT NULL,
  `is_repeat_customer` tinyint(1) DEFAULT NULL,
  `bucket_type` varchar(16) DEFAULT NULL,
  `ai_last_updated` datetime DEFAULT NULL,
  `ai_reason_thai` text DEFAULT NULL,
  `ai_score` int(11) DEFAULT NULL,
  `previous_lifecycle_status` varchar(50) DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `distribution_count` int(11) DEFAULT 0 COMMENT 'จำนวนครั้งที่ถูกแจกแล้วไม่ขายได้',
  `last_distribution_date` datetime DEFAULT NULL COMMENT 'วันที่แจกล่าสุด',
  `hold_until_date` datetime DEFAULT NULL COMMENT 'ห้ามแจกจนกว่าถึงวันนี้',
  `previous_assigned_to` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'รายชื่อ user_id ที่เคยได้รับแจก' CHECK (json_valid(`previous_assigned_to`)),
  `current_basket_key` varchar(50) DEFAULT NULL COMMENT 'ถังปัจจุบัน',
  `basket_entered_date` datetime DEFAULT NULL COMMENT 'วันที่เข้าถังปัจจุบัน',
  `birth_date` date DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `debt_collection`
-- DROP TABLE IF EXISTS `debt_collection`;
CREATE TABLE IF NOT EXISTS `debt_collection` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` varchar(50) NOT NULL COMMENT 'Reference to orders table',
  `user_id` int(11) NOT NULL COMMENT 'User who performed the collection',
  `amount_collected` decimal(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Amount collected in this attempt',
  `result_status` tinyint(1) NOT NULL COMMENT '1=Unable to Collect, 2=Collected Some, 3=Collected All',
  `is_complete` tinyint(1) NOT NULL DEFAULT 0 COMMENT '0=Ongoing, 1=Case Closed',
  `note` text DEFAULT NULL COMMENT 'Notes about the collection attempt',
  `slip_id` int(11) DEFAULT NULL COMMENT 'Reference to order_slips table if payment slip was uploaded',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_result_status` (`result_status`),
  KEY `idx_is_complete` (`is_complete`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `fk_debt_collection_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=826 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Debt collection tracking table';

-- Table structure for `debt_collection_images`
-- DROP TABLE IF EXISTS `debt_collection_images`;
CREATE TABLE IF NOT EXISTS `debt_collection_images` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `debt_collection_id` int(11) NOT NULL,
  `order_slip_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `debt_collection_id` (`debt_collection_id`),
  KEY `idx_order_slip_id` (`order_slip_id`)
) ENGINE=InnoDB AUTO_INCREMENT=378 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `env`
-- DROP TABLE IF EXISTS `env`;
CREATE TABLE IF NOT EXISTS `env` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `key` varchar(255) DEFAULT NULL,
  `value` text DEFAULT NULL,
  `company_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_env_key` (`key`),
  KEY `idx_env_key` (`key`)
) ENGINE=InnoDB AUTO_INCREMENT=36 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `export_order_items`
-- DROP TABLE IF EXISTS `export_order_items`;
CREATE TABLE IF NOT EXISTS `export_order_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `export_id` int(11) NOT NULL,
  `order_id` varchar(50) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_eoi_export` (`export_id`),
  KEY `idx_eoi_order` (`order_id`)
) ENGINE=InnoDB AUTO_INCREMENT=21806 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `export_template_columns`
-- DROP TABLE IF EXISTS `export_template_columns`;
CREATE TABLE IF NOT EXISTS `export_template_columns` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `template_id` int(11) NOT NULL,
  `header_name` varchar(100) NOT NULL,
  `data_source` varchar(200) NOT NULL DEFAULT '',
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `default_value` varchar(100) DEFAULT NULL,
  `display_mode` varchar(10) NOT NULL DEFAULT 'all',
  PRIMARY KEY (`id`),
  KEY `idx_etc_template` (`template_id`),
  CONSTRAINT `export_template_columns_ibfk_1` FOREIGN KEY (`template_id`) REFERENCES `export_templates` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=714 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `export_template_defaults`
-- DROP TABLE IF EXISTS `export_template_defaults`;
CREATE TABLE IF NOT EXISTS `export_template_defaults` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `company_id` int(11) NOT NULL,
  `template_id` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_etd_company` (`company_id`),
  KEY `idx_etd_template` (`template_id`),
  CONSTRAINT `export_template_defaults_ibfk_1` FOREIGN KEY (`template_id`) REFERENCES `export_templates` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `export_templates`
-- DROP TABLE IF EXISTS `export_templates`;
CREATE TABLE IF NOT EXISTS `export_templates` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `exports`
-- DROP TABLE IF EXISTS `exports`;
CREATE TABLE IF NOT EXISTS `exports` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `filename` varchar(255) DEFAULT NULL,
  `file_path` varchar(1024) DEFAULT NULL,
  `orders_count` int(11) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `company_id` int(11) DEFAULT NULL,
  `exported_by` varchar(128) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `download_count` int(11) DEFAULT 0,
  `category` varchar(100) DEFAULT NULL,
  `template_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_exports_created_at` (`created_at`),
  KEY `idx_exports_company_id` (`company_id`),
  KEY `idx_exports_company` (`company_id`),
  KEY `idx_exports_category` (`category`)
) ENGINE=InnoDB AUTO_INCREMENT=1371 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `google_sheet_shipping`
-- DROP TABLE IF EXISTS `google_sheet_shipping`;
CREATE TABLE IF NOT EXISTS `google_sheet_shipping` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `system_created_time` datetime DEFAULT NULL,
  `order_number` varchar(128) DEFAULT NULL,
  `order_status` varchar(50) DEFAULT NULL COMMENT 'สถานะคำสั่งซื้อ (Official)',
  `delivery_date` date DEFAULT NULL,
  `delivery_status` varchar(100) DEFAULT NULL,
  `imported_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_delivery_date` (`delivery_date`),
  KEY `idx_delivery_status` (`delivery_status`),
  KEY `idx_order_number` (`order_number`),
  KEY `idx_order_time` (`order_number`,`system_created_time`),
  KEY `idx_order_status` (`order_status`)
) ENGINE=InnoDB AUTO_INCREMENT=11302 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `inv2_dispatch_batches`
-- DROP TABLE IF EXISTS `inv2_dispatch_batches`;
CREATE TABLE IF NOT EXISTS `inv2_dispatch_batches` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `batch_doc_number` varchar(50) NOT NULL,
  `filename` varchar(255) DEFAULT NULL,
  `total_rows` int(11) NOT NULL DEFAULT 0,
  `total_quantity` decimal(12,2) NOT NULL DEFAULT 0.00,
  `processed_rows` int(11) NOT NULL DEFAULT 0,
  `notes` text DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `company_id` int(11) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_batch_doc` (`batch_doc_number`),
  KEY `idx_batch_company` (`company_id`),
  KEY `idx_batch_date` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `inv2_dispatch_items`
-- DROP TABLE IF EXISTS `inv2_dispatch_items`;
CREATE TABLE IF NOT EXISTS `inv2_dispatch_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `batch_id` int(11) NOT NULL,
  `row_index` int(11) NOT NULL DEFAULT 0,
  `product_sku` varchar(100) DEFAULT NULL,
  `product_name` varchar(500) DEFAULT NULL,
  `variant_code` varchar(100) DEFAULT NULL,
  `variant_name` varchar(255) DEFAULT NULL,
  `internal_order_id` varchar(100) DEFAULT NULL,
  `online_order_id` varchar(100) DEFAULT NULL,
  `quantity` decimal(12,2) NOT NULL DEFAULT 0.00,
  `total_price` decimal(12,2) DEFAULT NULL,
  `order_date` varchar(50) DEFAULT NULL,
  `ship_date` varchar(50) DEFAULT NULL,
  `order_status` varchar(100) DEFAULT NULL,
  `platform` varchar(100) DEFAULT NULL,
  `shop` varchar(255) DEFAULT NULL,
  `warehouse_name` varchar(255) DEFAULT NULL,
  `tracking_number` varchar(100) DEFAULT NULL,
  `status` varchar(100) DEFAULT NULL,
  `product_id` int(11) DEFAULT NULL,
  `warehouse_id` int(11) DEFAULT NULL,
  `stock_deducted` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_di_batch` (`batch_id`),
  KEY `idx_di_product` (`product_id`),
  CONSTRAINT `fk_inv2_di_batch` FOREIGN KEY (`batch_id`) REFERENCES `inv2_dispatch_batches` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=14367 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `inv2_edit_logs`
-- DROP TABLE IF EXISTS `inv2_edit_logs`;
CREATE TABLE IF NOT EXISTS `inv2_edit_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `reference_type` varchar(50) NOT NULL,
  `reference_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `old_data` longtext DEFAULT NULL,
  `new_data` longtext DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=43 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `inv2_movements`
-- DROP TABLE IF EXISTS `inv2_movements`;
CREATE TABLE IF NOT EXISTS `inv2_movements` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `warehouse_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `variant` varchar(255) DEFAULT NULL,
  `lot_number` varchar(128) DEFAULT NULL,
  `movement_type` enum('IN','OUT','ADJUST_IN','ADJUST_OUT') NOT NULL,
  `quantity` decimal(12,2) NOT NULL COMMENT 'จำนวน (always positive)',
  `reference_type` varchar(50) DEFAULT NULL COMMENT 'receive, dispatch, adjustment',
  `reference_id` int(11) DEFAULT NULL COMMENT 'ID of source document',
  `reference_doc_number` varchar(50) DEFAULT NULL COMMENT 'เลขที่เอกสาร',
  `reference_order_id` varchar(50) DEFAULT NULL COMMENT 'เลขที่ออเดอร์จากระบบ (ถ้ามี)',
  `notes` text DEFAULT NULL,
  `images` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`images`)),
  `created_by` int(11) NOT NULL,
  `company_id` int(11) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_mov_warehouse` (`warehouse_id`),
  KEY `idx_mov_product` (`product_id`),
  KEY `idx_mov_type` (`movement_type`),
  KEY `idx_mov_date` (`created_at`),
  KEY `idx_mov_ref` (`reference_type`,`reference_id`),
  KEY `idx_mov_order` (`reference_order_id`),
  KEY `idx_mov_company` (`company_id`),
  KEY `fk_inv2_mov_user` (`created_by`),
  CONSTRAINT `fk_inv2_mov_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  CONSTRAINT `fk_inv2_mov_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_inv2_mov_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1445 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `inv2_receive_documents`
-- DROP TABLE IF EXISTS `inv2_receive_documents`;
CREATE TABLE IF NOT EXISTS `inv2_receive_documents` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `doc_number` varchar(50) NOT NULL COMMENT 'เลขที่เอกสาร (RCV-YYYYMMDD-XXXXX)',
  `stock_order_id` int(11) DEFAULT NULL COMMENT 'อ้างอิง SO (ถ้ามี)',
  `warehouse_id` int(11) NOT NULL,
  `receive_date` date NOT NULL,
  `notes` text DEFAULT NULL,
  `images` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'Array of image paths' CHECK (json_valid(`images`)),
  `created_by` int(11) NOT NULL,
  `company_id` int(11) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_rcv_doc_number` (`doc_number`),
  KEY `idx_rcv_so` (`stock_order_id`),
  KEY `idx_rcv_warehouse` (`warehouse_id`),
  KEY `idx_rcv_date` (`receive_date`),
  KEY `idx_rcv_company` (`company_id`),
  KEY `fk_inv2_rcv_user` (`created_by`),
  CONSTRAINT `fk_inv2_rcv_so` FOREIGN KEY (`stock_order_id`) REFERENCES `inv2_stock_orders` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_inv2_rcv_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_inv2_rcv_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=218 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `inv2_receive_items`
-- DROP TABLE IF EXISTS `inv2_receive_items`;
CREATE TABLE IF NOT EXISTS `inv2_receive_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `receive_doc_id` int(11) NOT NULL,
  `so_item_id` int(11) DEFAULT NULL COMMENT 'อ้างอิง SO item (ถ้ามี)',
  `product_id` int(11) NOT NULL,
  `variant` varchar(255) DEFAULT NULL COMMENT 'รุ่น',
  `lot_number` varchar(128) DEFAULT NULL COMMENT 'หมายเลข Lot',
  `quantity` decimal(12,2) NOT NULL,
  `unit_cost` decimal(12,2) DEFAULT NULL,
  `mfg_date` date DEFAULT NULL COMMENT 'วันผลิต',
  `exp_date` date DEFAULT NULL COMMENT 'วันหมดอายุ',
  `notes` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ri_doc` (`receive_doc_id`),
  KEY `idx_ri_soi` (`so_item_id`),
  KEY `idx_ri_product` (`product_id`),
  CONSTRAINT `fk_inv2_ri_doc` FOREIGN KEY (`receive_doc_id`) REFERENCES `inv2_receive_documents` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_inv2_ri_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  CONSTRAINT `fk_inv2_ri_soi` FOREIGN KEY (`so_item_id`) REFERENCES `inv2_stock_order_items` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=350 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `inv2_stock`
-- DROP TABLE IF EXISTS `inv2_stock`;
CREATE TABLE IF NOT EXISTS `inv2_stock` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `warehouse_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `variant` varchar(255) DEFAULT NULL COMMENT 'รุ่น',
  `lot_number` varchar(128) DEFAULT NULL COMMENT 'หมายเลข Lot',
  `quantity` decimal(12,2) NOT NULL DEFAULT 0.00,
  `mfg_date` date DEFAULT NULL COMMENT 'วันผลิต',
  `exp_date` date DEFAULT NULL COMMENT 'วันหมดอายุ',
  `unit_cost` decimal(12,2) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_stock` (`warehouse_id`,`product_id`,`variant`,`lot_number`),
  KEY `idx_stock_warehouse` (`warehouse_id`),
  KEY `idx_stock_product` (`product_id`),
  KEY `idx_stock_expiry` (`exp_date`),
  CONSTRAINT `fk_inv2_stock_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  CONSTRAINT `fk_inv2_stock_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=276 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `inv2_stock_order_items`
-- DROP TABLE IF EXISTS `inv2_stock_order_items`;
CREATE TABLE IF NOT EXISTS `inv2_stock_order_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `stock_order_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `variant` varchar(255) DEFAULT NULL COMMENT 'รุ่น',
  `quantity` decimal(12,2) NOT NULL COMMENT 'จำนวนที่สั่ง',
  `max_quantity` decimal(12,2) DEFAULT NULL,
  `received_quantity` decimal(12,2) NOT NULL DEFAULT 0.00 COMMENT 'จำนวนที่รับแล้ว',
  `unit_cost` decimal(12,2) DEFAULT NULL COMMENT 'ราคาต่อหน่วย',
  `notes` text DEFAULT NULL,
  `department` varchar(255) DEFAULT NULL,
  `delivery_date` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_soi_order` (`stock_order_id`),
  KEY `idx_soi_product` (`product_id`),
  CONSTRAINT `fk_inv2_soi_order` FOREIGN KEY (`stock_order_id`) REFERENCES `inv2_stock_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_inv2_soi_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=104 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `inv2_stock_orders`
-- DROP TABLE IF EXISTS `inv2_stock_orders`;
CREATE TABLE IF NOT EXISTS `inv2_stock_orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `so_number` varchar(50) NOT NULL COMMENT 'เลขที่ SO (SO-YYYYMMDD-XXXXX)',
  `warehouse_id` int(11) NOT NULL COMMENT 'คลังปลายทาง',
  `order_date` date NOT NULL COMMENT 'วันที่สั่ง',
  `expected_date` date DEFAULT NULL COMMENT 'วันที่คาดว่าจะเข้า',
  `status` enum('Draft','Ordered','Partial','Completed','Cancelled') NOT NULL DEFAULT 'Draft',
  `notes` text DEFAULT NULL,
  `source_location` varchar(255) DEFAULT NULL,
  `customer_vendor` varchar(255) DEFAULT NULL,
  `delivery_location` varchar(255) DEFAULT NULL,
  `images` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'Array of image paths' CHECK (json_valid(`images`)),
  `created_by` int(11) NOT NULL,
  `company_id` int(11) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_so_number` (`so_number`),
  KEY `idx_so_warehouse` (`warehouse_id`),
  KEY `idx_so_status` (`status`),
  KEY `idx_so_date` (`order_date`),
  KEY `idx_so_company` (`company_id`),
  KEY `fk_inv2_so_user` (`created_by`),
  CONSTRAINT `fk_inv2_so_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_inv2_so_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `inv2_warehouse_mappings`
-- DROP TABLE IF EXISTS `inv2_warehouse_mappings`;
CREATE TABLE IF NOT EXISTS `inv2_warehouse_mappings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `company_id` int(11) NOT NULL,
  `dispatch_warehouse_name` varchar(100) NOT NULL,
  `main_warehouse_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_dispatch_company` (`company_id`,`dispatch_warehouse_name`)
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `marketing_ads_log`
-- DROP TABLE IF EXISTS `marketing_ads_log`;
CREATE TABLE IF NOT EXISTS `marketing_ads_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `page_id` int(11) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `date` date DEFAULT NULL,
  `ads_cost` int(11) DEFAULT NULL,
  `impressions` int(11) DEFAULT NULL,
  `reach` int(11) DEFAULT NULL,
  `clicks` int(11) DEFAULT NULL,
  `edited_by` int(11) DEFAULT NULL,
  `edited_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_page_date` (`page_id`,`date`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_date` (`date`),
  KEY `idx_page_id` (`page_id`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `fk_marketing_ads_log_page_id` FOREIGN KEY (`page_id`) REFERENCES `pages` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_marketing_ads_log_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7109 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `marketing_product_ads_log`
-- DROP TABLE IF EXISTS `marketing_product_ads_log`;
CREATE TABLE IF NOT EXISTS `marketing_product_ads_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `product_id` int(11) DEFAULT NULL,
  `ads_group` varchar(128) DEFAULT NULL,
  `page_id` int(11) DEFAULT NULL,
  `date` date DEFAULT NULL,
  `ads_cost` decimal(10,2) DEFAULT NULL,
  `impressions` int(11) DEFAULT NULL,
  `reach` int(11) DEFAULT NULL,
  `clicks` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_product_date` (`user_id`,`product_id`,`date`),
  UNIQUE KEY `unique_product_date` (`product_id`,`date`),
  UNIQUE KEY `uq_ads_group_page_date` (`ads_group`,`page_id`,`date`),
  KEY `idx_date` (`date`),
  KEY `idx_product_id` (`product_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_page_id` (`page_id`),
  CONSTRAINT `fk_marketing_pad_product_id` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_marketing_pad_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=166 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `marketing_user_ads_group`
-- DROP TABLE IF EXISTS `marketing_user_ads_group`;
CREATE TABLE IF NOT EXISTS `marketing_user_ads_group` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `ads_group` varchar(128) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_ads_group` (`user_id`,`ads_group`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_ads_group` (`ads_group`),
  CONSTRAINT `fk_marketing_user_ads_group_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=103 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `marketing_user_page`
-- DROP TABLE IF EXISTS `marketing_user_page`;
CREATE TABLE IF NOT EXISTS `marketing_user_page` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `page_id` int(11) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_page_user` (`page_id`,`user_id`),
  KEY `idx_page_id` (`page_id`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `fk_marketing_user_page_page_id` FOREIGN KEY (`page_id`) REFERENCES `pages` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_marketing_user_page_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=108 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `marketing_user_product`
-- DROP TABLE IF EXISTS `marketing_user_product`;
CREATE TABLE IF NOT EXISTS `marketing_user_product` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `product_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_product` (`user_id`,`product_id`),
  KEY `idx_product_id` (`product_id`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `fk_marketing_user_product_product_id` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_marketing_user_product_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `marketplace_ads_log`
-- DROP TABLE IF EXISTS `marketplace_ads_log`;
CREATE TABLE IF NOT EXISTS `marketplace_ads_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `store_id` int(11) NOT NULL,
  `date` date NOT NULL,
  `ads_cost` decimal(12,2) DEFAULT 0.00,
  `impressions` int(11) DEFAULT 0,
  `clicks` int(11) DEFAULT 0,
  `user_id` int(11) NOT NULL COMMENT 'who entered this',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_store_date` (`store_id`,`date`),
  KEY `idx_date` (`date`),
  CONSTRAINT `marketplace_ads_log_ibfk_1` FOREIGN KEY (`store_id`) REFERENCES `marketplace_stores` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=65 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `marketplace_import_batches`
-- DROP TABLE IF EXISTS `marketplace_import_batches`;
CREATE TABLE IF NOT EXISTS `marketplace_import_batches` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `filename` varchar(500) DEFAULT NULL,
  `total_rows` int(11) DEFAULT 0,
  `imported_rows` int(11) DEFAULT 0,
  `skipped_rows` int(11) DEFAULT 0,
  `user_id` int(11) NOT NULL,
  `company_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_company` (`company_id`),
  KEY `idx_user` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `marketplace_sales_import`
-- DROP TABLE IF EXISTS `marketplace_sales_import`;
CREATE TABLE IF NOT EXISTS `marketplace_sales_import` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `store_id` int(11) NOT NULL,
  `date` date NOT NULL,
  `total_sales` decimal(12,2) DEFAULT 0.00,
  `total_orders` int(11) DEFAULT 0,
  `returns_amount` decimal(12,2) DEFAULT 0.00,
  `cancelled_amount` decimal(12,2) DEFAULT 0.00,
  `user_id` int(11) NOT NULL COMMENT 'who imported this',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_store_date` (`store_id`,`date`),
  KEY `idx_date` (`date`),
  CONSTRAINT `marketplace_sales_import_ibfk_1` FOREIGN KEY (`store_id`) REFERENCES `marketplace_stores` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `marketplace_sales_orders`
-- DROP TABLE IF EXISTS `marketplace_sales_orders`;
CREATE TABLE IF NOT EXISTS `marketplace_sales_orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `batch_id` int(11) NOT NULL,
  `product_code` varchar(100) DEFAULT NULL,
  `product_name` varchar(500) DEFAULT NULL,
  `variant_code` varchar(100) DEFAULT NULL,
  `variant_name` varchar(200) DEFAULT NULL,
  `internal_order_id` varchar(50) DEFAULT NULL,
  `online_order_id` varchar(50) DEFAULT NULL,
  `quantity` int(11) DEFAULT 0,
  `total_price` decimal(12,2) DEFAULT 0.00,
  `order_date` date DEFAULT NULL,
  `shipping_date` date DEFAULT NULL,
  `order_status` varchar(100) DEFAULT NULL,
  `platform` varchar(100) DEFAULT NULL,
  `store_name` varchar(255) DEFAULT NULL,
  `warehouse` varchar(255) DEFAULT NULL,
  `tracking_number` varchar(100) DEFAULT NULL,
  `status` varchar(100) DEFAULT NULL,
  `cancel_reason` varchar(500) DEFAULT NULL,
  `store_id` int(11) DEFAULT NULL,
  `company_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_batch` (`batch_id`),
  KEY `idx_order_date` (`order_date`),
  KEY `idx_store` (`store_id`),
  KEY `idx_online_order` (`online_order_id`),
  KEY `idx_company` (`company_id`),
  KEY `idx_platform` (`platform`),
  CONSTRAINT `marketplace_sales_orders_ibfk_1` FOREIGN KEY (`batch_id`) REFERENCES `marketplace_import_batches` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=977 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `marketplace_stores`
-- DROP TABLE IF EXISTS `marketplace_stores`;
CREATE TABLE IF NOT EXISTS `marketplace_stores` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `platform` varchar(100) NOT NULL COMMENT 'e.g. Shopee, Lazada, TikTok',
  `url` varchar(500) DEFAULT NULL,
  `manager_user_id` int(11) DEFAULT NULL,
  `company_id` int(11) NOT NULL,
  `active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_company` (`company_id`),
  KEY `idx_platform` (`platform`),
  CONSTRAINT `marketplace_stores_ibfk_1` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `notification_read_status`
-- DROP TABLE IF EXISTS `notification_read_status`;
CREATE TABLE IF NOT EXISTS `notification_read_status` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `notification_id` varchar(50) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `read_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_notification_user_read` (`notification_id`,`user_id`),
  KEY `idx_read_at` (`read_at`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `notification_read_status_ibfk_1` FOREIGN KEY (`notification_id`) REFERENCES `notifications` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `notification_read_status_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `notification_roles`
-- DROP TABLE IF EXISTS `notification_roles`;
CREATE TABLE IF NOT EXISTS `notification_roles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `notification_id` varchar(50) DEFAULT NULL,
  `role` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_notification_role` (`notification_id`,`role`),
  KEY `idx_role` (`role`),
  CONSTRAINT `notification_roles_ibfk_1` FOREIGN KEY (`notification_id`) REFERENCES `notifications` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `notification_settings`
-- DROP TABLE IF EXISTS `notification_settings`;
CREATE TABLE IF NOT EXISTS `notification_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `notification_type` varchar(50) DEFAULT NULL,
  `in_app_enabled` tinyint(1) DEFAULT NULL,
  `email_enabled` tinyint(1) DEFAULT NULL,
  `sms_enabled` tinyint(1) DEFAULT NULL,
  `business_hours_only` tinyint(1) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_notification_type` (`user_id`,`notification_type`),
  KEY `idx_notification_type` (`notification_type`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `notification_settings_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `notification_users`
-- DROP TABLE IF EXISTS `notification_users`;
CREATE TABLE IF NOT EXISTS `notification_users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `notification_id` varchar(50) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_notification_user` (`notification_id`,`user_id`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `notification_users_ibfk_1` FOREIGN KEY (`notification_id`) REFERENCES `notifications` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `notification_users_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `notifications`
-- DROP TABLE IF EXISTS `notifications`;
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` varchar(50) NOT NULL,
  `type` varchar(255) DEFAULT NULL,
  `category` varchar(255) DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `message` text DEFAULT NULL,
  `timestamp` datetime DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT NULL,
  `priority` varchar(255) DEFAULT NULL,
  `related_id` varchar(50) DEFAULT NULL,
  `page_id` int(11) DEFAULT NULL,
  `page_name` varchar(255) DEFAULT NULL,
  `platform` varchar(50) DEFAULT NULL,
  `previous_value` decimal(10,2) DEFAULT NULL,
  `current_value` decimal(10,2) DEFAULT NULL,
  `percentage_change` decimal(5,2) DEFAULT NULL,
  `action_url` varchar(255) DEFAULT NULL,
  `action_text` varchar(100) DEFAULT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_category` (`category`),
  KEY `idx_is_read` (`is_read`),
  KEY `idx_page_id` (`page_id`),
  KEY `idx_priority` (`priority`),
  KEY `idx_related_id` (`related_id`),
  KEY `idx_timestamp` (`timestamp`),
  KEY `idx_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `old_customers`
-- DROP TABLE IF EXISTS `old_customers`;
CREATE TABLE IF NOT EXISTS `old_customers` (
  `customer_id` int(11) NOT NULL,
  `company_id` int(11) DEFAULT NULL,
  `customer_code` varchar(50) DEFAULT NULL,
  `first_name` varchar(50) NOT NULL,
  `last_name` varchar(50) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `district` varchar(50) DEFAULT NULL,
  `province` varchar(50) DEFAULT NULL,
  `postal_code` varchar(10) DEFAULT NULL,
  `temperature_status` enum('hot','warm','cold','frozen') DEFAULT 'hot',
  `customer_grade` enum('A+','A','B','C','D') DEFAULT 'D',
  `total_purchase_amount` decimal(12,2) DEFAULT 0.00,
  `assigned_to` int(11) DEFAULT NULL,
  `basket_type` enum('distribution','waiting','assigned','expired','block') DEFAULT 'distribution',
  `assigned_at` timestamp NULL DEFAULT NULL,
  `last_contact_at` timestamp NULL DEFAULT NULL,
  `next_followup_at` timestamp NULL DEFAULT NULL,
  `recall_at` timestamp NULL DEFAULT NULL,
  `recall_reason` varchar(100) DEFAULT NULL,
  `source` varchar(50) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `appointment_count` int(11) DEFAULT 0,
  `appointment_extension_count` int(11) DEFAULT 0,
  `last_appointment_date` timestamp NULL DEFAULT NULL,
  `appointment_extension_expiry` timestamp NULL DEFAULT NULL,
  `max_appointment_extensions` int(11) DEFAULT 3,
  `appointment_extension_days` int(11) DEFAULT 30,
  `customer_status` enum('new','existing','existing_3m','followup','call_followup','daily_distribution') DEFAULT 'new',
  `customer_time_extension` int(11) DEFAULT 0,
  `customer_time_base` timestamp NULL DEFAULT NULL,
  `customer_time_expiry` timestamp NULL DEFAULT NULL,
  `plant_variety` varchar(255) DEFAULT NULL,
  `garden_size` varchar(100) DEFAULT NULL,
  `is_blocked` tinyint(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `onecall_batch`
-- DROP TABLE IF EXISTS `onecall_batch`;
CREATE TABLE IF NOT EXISTS `onecall_batch` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `company_id` int(11) NOT NULL DEFAULT 1,
  `startdate` date DEFAULT NULL,
  `enddate` date DEFAULT NULL,
  `amount_record` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `company_id` (`company_id`)
) ENGINE=InnoDB AUTO_INCREMENT=66 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `onecall_log`
-- DROP TABLE IF EXISTS `onecall_log`;
CREATE TABLE IF NOT EXISTS `onecall_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `timestamp` timestamp NULL DEFAULT NULL,
  `duration` int(11) DEFAULT NULL,
  `localParty` varchar(255) DEFAULT NULL,
  `remoteParty` varchar(255) DEFAULT NULL,
  `direction` varchar(10) DEFAULT NULL,
  `phone_telesale` varchar(255) DEFAULT NULL,
  `batch_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `batch_id` (`batch_id`),
  KEY `idx_onecall_phone_ts` (`phone_telesale`,`timestamp`),
  KEY `onecall_log_ibfk_1` (`batch_id`),
  KEY `idx_onecall_log_phone_date` (`phone_telesale`,`timestamp`),
  CONSTRAINT `onecall_log_ibfk_1` FOREIGN KEY (`batch_id`) REFERENCES `onecall_batch` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=95709834 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `order_audit_log`
-- DROP TABLE IF EXISTS `order_audit_log`;
CREATE TABLE IF NOT EXISTS `order_audit_log` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `order_id` varchar(50) NOT NULL COMMENT 'orders.id',
  `field_name` varchar(50) NOT NULL COMMENT 'ชื่อฟิลด์ที่เปลี่ยน',
  `old_value` varchar(255) DEFAULT NULL,
  `new_value` varchar(255) DEFAULT NULL,
  `api_source` varchar(100) DEFAULT NULL COMMENT 'API ที่ทำการเปลี่ยนแปลง',
  `changed_by` int(11) DEFAULT NULL COMMENT 'user_id ที่ทำการเปลี่ยนแปลง',
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_field_name` (`field_name`)
) ENGINE=InnoDB AUTO_INCREMENT=180147 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `order_box_collection_logs`
-- DROP TABLE IF EXISTS `order_box_collection_logs`;
CREATE TABLE IF NOT EXISTS `order_box_collection_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_box_id` int(11) DEFAULT NULL,
  `order_id` varchar(32) DEFAULT NULL,
  `sub_order_id` varchar(64) DEFAULT NULL,
  `box_number` int(11) DEFAULT NULL,
  `change_type` varchar(255) DEFAULT NULL,
  `old_collection_amount` decimal(12,2) DEFAULT NULL,
  `new_collection_amount` decimal(12,2) DEFAULT NULL,
  `old_collected_amount` decimal(12,2) DEFAULT NULL,
  `new_collected_amount` decimal(12,2) DEFAULT NULL,
  `old_waived_amount` decimal(12,2) DEFAULT NULL,
  `new_waived_amount` decimal(12,2) DEFAULT NULL,
  `old_payment_method` varchar(255) DEFAULT NULL,
  `new_payment_method` varchar(255) DEFAULT NULL,
  `old_status` varchar(255) DEFAULT NULL,
  `new_status` varchar(255) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ob_logs_box` (`order_box_id`),
  KEY `idx_ob_logs_change_type` (`change_type`),
  KEY `idx_ob_logs_order` (`order_id`),
  KEY `idx_ob_logs_sub_order` (`sub_order_id`),
  CONSTRAINT `fk_ob_logs_box` FOREIGN KEY (`order_box_id`) REFERENCES `order_boxes` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `order_boxes`
-- DROP TABLE IF EXISTS `order_boxes`;
CREATE TABLE IF NOT EXISTS `order_boxes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` varchar(32) DEFAULT NULL,
  `sub_order_id` varchar(64) DEFAULT NULL,
  `box_number` int(11) DEFAULT NULL,
  `payment_method` enum('COD','Transfer','PayAfter','Claim','FreeGift','DiscountCoupon') DEFAULT NULL,
  `status` varchar(255) DEFAULT NULL,
  `return_status` varchar(50) DEFAULT NULL COMMENT 'Status for return process',
  `return_note` text DEFAULT NULL COMMENT 'Note for return process',
  `return_created_at` datetime DEFAULT NULL,
  `cod_amount` decimal(12,2) DEFAULT NULL,
  `collection_amount` decimal(12,2) DEFAULT NULL,
  `collected_amount` decimal(12,2) DEFAULT NULL,
  `waived_amount` decimal(12,2) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  `shipped_at` datetime DEFAULT NULL,
  `delivered_at` datetime DEFAULT NULL,
  `return_complete` tinyint(1) DEFAULT 0 COMMENT 'จบเคสแล้ว (1 = จบเคส, 0 = ยังไม่จบ)',
  `return_claim` decimal(10,2) DEFAULT NULL COMMENT 'จำนวนเงินเคลม (กรณีเสียหาย/สูญหาย)',
  `returned_by` int(11) DEFAULT NULL COMMENT 'User ID ของผู้อัปเดตสถานะตีกลับ',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_order_box_per_order` (`order_id`,`box_number`),
  UNIQUE KEY `uniq_order_boxes_sub_order_id` (`sub_order_id`),
  KEY `idx_order_boxes_status` (`status`),
  CONSTRAINT `fk_order_boxes_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=988943 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `order_boxes_backup_20260308`
-- DROP TABLE IF EXISTS `order_boxes_backup_20260308`;
CREATE TABLE IF NOT EXISTS `order_boxes_backup_20260308` (
  `id` int(11) NOT NULL DEFAULT 0,
  `order_id` varchar(32) DEFAULT NULL,
  `sub_order_id` varchar(64) DEFAULT NULL,
  `box_number` int(11) DEFAULT NULL,
  `payment_method` enum('COD','Transfer','PayAfter','Claim','FreeGift') DEFAULT 'COD',
  `status` varchar(255) DEFAULT NULL,
  `return_status` varchar(50) DEFAULT NULL COMMENT 'Status for return process',
  `return_note` text DEFAULT NULL COMMENT 'Note for return process',
  `return_created_at` datetime DEFAULT NULL,
  `cod_amount` decimal(12,2) DEFAULT NULL,
  `collection_amount` decimal(12,2) DEFAULT NULL,
  `collected_amount` decimal(12,2) DEFAULT NULL,
  `waived_amount` decimal(12,2) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  `shipped_at` datetime DEFAULT NULL,
  `delivered_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `order_boxes_imp_116m`
-- DROP TABLE IF EXISTS `order_boxes_imp_116m`;
CREATE TABLE IF NOT EXISTS `order_boxes_imp_116m` (
  `id` int(11) NOT NULL DEFAULT 0,
  `order_id` varchar(32) DEFAULT NULL,
  `sub_order_id` varchar(64) DEFAULT NULL,
  `box_number` int(11) DEFAULT NULL,
  `payment_method` enum('COD','Transfer','PayAfter','Claim','FreeGift') DEFAULT 'COD',
  `status` varchar(255) DEFAULT NULL,
  `return_status` varchar(50) DEFAULT NULL COMMENT 'Status for return process',
  `return_note` text DEFAULT NULL COMMENT 'Note for return process',
  `return_created_at` datetime DEFAULT NULL,
  `cod_amount` decimal(12,2) DEFAULT NULL,
  `collection_amount` decimal(12,2) DEFAULT NULL,
  `collected_amount` decimal(12,2) DEFAULT NULL,
  `waived_amount` decimal(12,2) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  `shipped_at` datetime DEFAULT NULL,
  `delivered_at` datetime DEFAULT NULL,
  `return_complete` tinyint(1) DEFAULT 0 COMMENT 'จบเคสแล้ว (1 = จบเคส, 0 = ยังไม่จบ)',
  `return_claim` decimal(10,2) DEFAULT NULL COMMENT 'จำนวนเงินเคลม (กรณีเสียหาย/สูญหาย)'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `order_cancellations`
-- DROP TABLE IF EXISTS `order_cancellations`;
CREATE TABLE IF NOT EXISTS `order_cancellations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` varchar(32) NOT NULL,
  `cancellation_type_id` int(11) NOT NULL,
  `notes` text DEFAULT NULL,
  `classified_by` int(11) DEFAULT NULL,
  `classified_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_order` (`order_id`),
  KEY `idx_ctype` (`cancellation_type_id`),
  KEY `fk_oc_user` (`classified_by`),
  CONSTRAINT `fk_oc_ctype` FOREIGN KEY (`cancellation_type_id`) REFERENCES `cancellation_types` (`id`),
  CONSTRAINT `fk_oc_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`),
  CONSTRAINT `fk_oc_user` FOREIGN KEY (`classified_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1480 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `order_item_allocations`
-- DROP TABLE IF EXISTS `order_item_allocations`;
CREATE TABLE IF NOT EXISTS `order_item_allocations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` varchar(32) DEFAULT NULL,
  `order_item_id` int(11) DEFAULT NULL,
  `product_id` int(11) DEFAULT NULL,
  `promotion_id` int(11) DEFAULT NULL,
  `is_freebie` tinyint(1) DEFAULT NULL,
  `required_quantity` int(11) DEFAULT NULL,
  `allocated_quantity` int(11) DEFAULT NULL,
  `warehouse_id` int(11) DEFAULT NULL,
  `lot_number` varchar(128) DEFAULT NULL,
  `status` varchar(255) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_allocations_promotion` (`promotion_id`),
  KEY `idx_allocations_created_by` (`created_by`),
  KEY `idx_allocations_item` (`order_item_id`),
  KEY `idx_allocations_order` (`order_id`),
  KEY `idx_allocations_product` (`product_id`),
  KEY `idx_allocations_status` (`status`),
  KEY `idx_allocations_warehouse` (`warehouse_id`),
  CONSTRAINT `fk_allocations_item` FOREIGN KEY (`order_item_id`) REFERENCES `order_items` (`id`) ON UPDATE NO ACTION,
  CONSTRAINT `fk_allocations_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_allocations_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON UPDATE NO ACTION,
  CONSTRAINT `fk_allocations_promotion` FOREIGN KEY (`promotion_id`) REFERENCES `promotions` (`id`) ON UPDATE NO ACTION,
  CONSTRAINT `fk_allocations_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=71106 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `order_items`
-- DROP TABLE IF EXISTS `order_items`;
CREATE TABLE IF NOT EXISTS `order_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` varchar(32) DEFAULT NULL,
  `parent_order_id` varchar(32) DEFAULT NULL,
  `creator_id` int(11) DEFAULT NULL,
  `basket_key_at_sale` varchar(50) DEFAULT NULL COMMENT 'ถังที่ลูกค้าอยู่ตอนเพิ่มสินค้า (สำหรับคำนวณ commission upsell)',
  `product_id` int(11) DEFAULT NULL,
  `product_name` varchar(255) DEFAULT NULL,
  `quantity` int(11) DEFAULT NULL,
  `price_per_unit` decimal(12,2) DEFAULT NULL,
  `discount` decimal(12,2) DEFAULT NULL,
  `net_total` decimal(12,2) DEFAULT NULL,
  `is_freebie` tinyint(1) DEFAULT NULL,
  `box_number` int(11) DEFAULT NULL,
  `promotion_id` int(11) DEFAULT NULL,
  `parent_item_id` int(11) DEFAULT NULL,
  `is_promotion_parent` tinyint(1) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `fk_order_items_order` (`order_id`),
  KEY `idx_order_items_creator` (`creator_id`),
  KEY `idx_order_items_parent` (`parent_item_id`),
  KEY `idx_order_items_parent_order` (`parent_order_id`),
  KEY `idx_order_items_product` (`product_id`),
  KEY `idx_order_items_promotion` (`promotion_id`),
  KEY `idx_order_items_promotion_parent` (`is_promotion_parent`),
  KEY `idx_order_items_basket_key` (`basket_key_at_sale`),
  KEY `idx_order_items_order_id` (`order_id`),
  KEY `idx_order_items_product_id` (`product_id`),
  KEY `idx_order_items_is_freebie` (`is_freebie`),
  KEY `idx_order_items_parent_creator` (`parent_order_id`,`creator_id`),
  KEY `idx_order_items_freebie` (`is_freebie`),
  CONSTRAINT `fk_order_items_creator` FOREIGN KEY (`creator_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_order_items_parent` FOREIGN KEY (`parent_item_id`) REFERENCES `order_items` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_order_items_parent_order` FOREIGN KEY (`parent_order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_order_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_order_items_promotion` FOREIGN KEY (`promotion_id`) REFERENCES `promotions` (`id`) ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=1128853 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `order_items_backup_20260308`
-- DROP TABLE IF EXISTS `order_items_backup_20260308`;
CREATE TABLE IF NOT EXISTS `order_items_backup_20260308` (
  `id` int(11) NOT NULL DEFAULT 0,
  `order_id` varchar(32) DEFAULT NULL,
  `parent_order_id` varchar(32) DEFAULT NULL,
  `creator_id` int(11) DEFAULT NULL,
  `basket_key_at_sale` varchar(50) DEFAULT NULL COMMENT 'ถังที่ลูกค้าอยู่ตอนเพิ่มสินค้า (สำหรับคำนวณ commission upsell)',
  `product_id` int(11) DEFAULT NULL,
  `product_name` varchar(255) DEFAULT NULL,
  `quantity` int(11) DEFAULT NULL,
  `price_per_unit` decimal(12,2) DEFAULT NULL,
  `discount` decimal(12,2) DEFAULT NULL,
  `net_total` decimal(12,2) DEFAULT NULL,
  `is_freebie` tinyint(1) DEFAULT NULL,
  `box_number` int(11) DEFAULT NULL,
  `promotion_id` int(11) DEFAULT NULL,
  `parent_item_id` int(11) DEFAULT NULL,
  `is_promotion_parent` tinyint(1) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `order_items_imp_116m`
-- DROP TABLE IF EXISTS `order_items_imp_116m`;
CREATE TABLE IF NOT EXISTS `order_items_imp_116m` (
  `id` int(11) NOT NULL DEFAULT 0,
  `order_id` varchar(32) DEFAULT NULL,
  `parent_order_id` varchar(32) DEFAULT NULL,
  `creator_id` int(11) DEFAULT NULL,
  `basket_key_at_sale` varchar(50) DEFAULT NULL COMMENT 'ถังที่ลูกค้าอยู่ตอนเพิ่มสินค้า (สำหรับคำนวณ commission upsell)',
  `product_id` int(11) DEFAULT NULL,
  `product_name` varchar(255) DEFAULT NULL,
  `quantity` int(11) DEFAULT NULL,
  `price_per_unit` decimal(12,2) DEFAULT NULL,
  `discount` decimal(12,2) DEFAULT NULL,
  `net_total` decimal(12,2) DEFAULT NULL,
  `is_freebie` tinyint(1) DEFAULT NULL,
  `box_number` int(11) DEFAULT NULL,
  `promotion_id` int(11) DEFAULT NULL,
  `parent_item_id` int(11) DEFAULT NULL,
  `is_promotion_parent` tinyint(1) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `order_sequences`
-- DROP TABLE IF EXISTS `order_sequences`;
CREATE TABLE IF NOT EXISTS `order_sequences` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `company_id` int(11) DEFAULT NULL,
  `period` varchar(255) DEFAULT NULL,
  `prefix` varchar(8) DEFAULT NULL,
  `last_sequence` int(11) DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_order_sequences` (`company_id`,`period`,`prefix`)
) ENGINE=InnoDB AUTO_INCREMENT=49879 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `order_slips`
-- DROP TABLE IF EXISTS `order_slips`;
CREATE TABLE IF NOT EXISTS `order_slips` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `amount` decimal(12,2) DEFAULT NULL,
  `bank_account_id` int(11) DEFAULT NULL,
  `transfer_date` datetime DEFAULT NULL,
  `order_id` varchar(32) DEFAULT NULL,
  `url` varchar(1024) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  `upload_by` int(11) DEFAULT NULL,
  `upload_by_name` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_order_slips_bank_account_id` (`bank_account_id`),
  KEY `idx_order_slips_order` (`order_id`),
  CONSTRAINT `fk_order_slips_bank_account_id` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_account` (`id`) ON UPDATE NO ACTION,
  CONSTRAINT `fk_order_slips_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=5249 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `order_status_logs`
-- DROP TABLE IF EXISTS `order_status_logs`;
CREATE TABLE IF NOT EXISTS `order_status_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` varchar(32) DEFAULT NULL,
  `previous_status` varchar(50) DEFAULT NULL,
  `new_status` varchar(50) DEFAULT NULL,
  `previous_tracking` varchar(100) DEFAULT NULL,
  `new_tracking` varchar(100) DEFAULT NULL,
  `changed_at` datetime DEFAULT NULL,
  `trigger_type` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_order_log_changed_at` (`changed_at`),
  KEY `idx_order_log_order_id` (`order_id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `order_tab_rules`
-- DROP TABLE IF EXISTS `order_tab_rules`;
CREATE TABLE IF NOT EXISTS `order_tab_rules` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tab_key` varchar(50) NOT NULL COMMENT 'The tab identifier (e.g., unpaid, pending)',
  `payment_method` varchar(50) DEFAULT NULL COMMENT 'Payment method filter value',
  `payment_status` varchar(50) DEFAULT NULL COMMENT 'Payment status filter value',
  `order_status` varchar(50) DEFAULT NULL COMMENT 'Order status filter value',
  `description` text DEFAULT NULL,
  `company_id` int(11) NOT NULL DEFAULT 0,
  `display_order` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_tab_key` (`tab_key`),
  KEY `idx_company` (`company_id`)
) ENGINE=InnoDB AUTO_INCREMENT=308 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `order_tracking_numbers`
-- DROP TABLE IF EXISTS `order_tracking_numbers`;
CREATE TABLE IF NOT EXISTS `order_tracking_numbers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` varchar(32) DEFAULT NULL,
  `parent_order_id` varchar(32) DEFAULT NULL,
  `box_number` int(11) DEFAULT NULL,
  `tracking_number` varchar(128) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_tracking_number` (`tracking_number`),
  KEY `fk_order_tracking_order` (`order_id`),
  KEY `idx_order_tracking_parent_order` (`parent_order_id`),
  CONSTRAINT `fk_order_tracking_parent_order` FOREIGN KEY (`parent_order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=55451 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `orders`
-- DROP TABLE IF EXISTS `orders`;
CREATE TABLE IF NOT EXISTS `orders` (
  `id` varchar(32) NOT NULL,
  `customer_id` int(11) DEFAULT NULL,
  `company_id` int(11) DEFAULT NULL,
  `creator_id` int(11) DEFAULT NULL,
  `order_date` datetime DEFAULT NULL,
  `delivery_date` datetime DEFAULT NULL,
  `customer_received_date` date DEFAULT NULL,
  `street` varchar(255) DEFAULT NULL,
  `subdistrict` varchar(128) DEFAULT NULL,
  `district` varchar(128) DEFAULT NULL,
  `province` varchar(128) DEFAULT NULL,
  `postal_code` varchar(16) DEFAULT NULL,
  `recipient_first_name` varchar(128) DEFAULT NULL,
  `recipient_last_name` varchar(128) DEFAULT NULL,
  `recipient_phone` varchar(50) DEFAULT NULL,
  `shipping_provider` varchar(128) DEFAULT NULL,
  `shipping_cost` decimal(12,2) DEFAULT NULL,
  `bill_discount` decimal(12,2) DEFAULT NULL,
  `total_amount` decimal(12,2) DEFAULT NULL,
  `payment_method` enum('COD','Transfer','PayAfter','Claim','FreeGift','DiscountCoupon') DEFAULT NULL,
  `payment_status` varchar(255) DEFAULT NULL,
  `slip_url` varchar(1024) DEFAULT NULL,
  `amount_paid` decimal(12,2) DEFAULT NULL,
  `cod_amount` decimal(12,2) DEFAULT NULL,
  `order_status` varchar(255) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `ocr_payment_date` datetime DEFAULT NULL,
  `sales_channel` varchar(128) DEFAULT NULL,
  `sales_channel_page_id` int(11) DEFAULT NULL,
  `bank_account_id` int(11) DEFAULT NULL,
  `transfer_date` datetime DEFAULT NULL,
  `warehouse_id` int(11) DEFAULT NULL,
  `customer_type` varchar(50) DEFAULT NULL,
  `upsell_user_id` int(11) DEFAULT NULL COMMENT 'Telesale user assigned for Upsell via Round-Robin',
  `basket_key_at_sale` varchar(50) DEFAULT NULL COMMENT 'ถังที่ลูกค้าอยู่ตอนสร้าง order (สำหรับคำนวณ commission)',
  `note_system` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_orders_customer` (`customer_id`),
  KEY `fk_orders_page` (`sales_channel_page_id`),
  KEY `fk_orders_warehouse` (`warehouse_id`),
  KEY `idx_orders_bank_account_id` (`bank_account_id`),
  KEY `idx_orders_company` (`company_id`),
  KEY `idx_orders_company_payment` (`company_id`,`payment_status`),
  KEY `idx_orders_company_status` (`company_id`,`order_status`),
  KEY `idx_orders_creator` (`creator_id`),
  KEY `idx_orders_date` (`order_date`),
  KEY `idx_orders_delivery_date` (`delivery_date`),
  KEY `idx_orders_payment_status` (`payment_status`),
  KEY `idx_orders_status` (`order_status`),
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_upsell_user` (`upsell_user_id`,`order_status`),
  KEY `idx_orders_basket_key` (`basket_key_at_sale`),
  KEY `idx_orders_status_date` (`order_status`,`order_date`),
  KEY `idx_orders_order_date` (`order_date`),
  KEY `idx_orders_company_date` (`company_id`,`order_date`),
  KEY `idx_orders_creator_id` (`creator_id`),
  KEY `idx_orders_order_status` (`order_status`),
  KEY `idx_orders_company_date_status` (`company_id`,`order_date`,`order_status`),
  KEY `idx_orders_creator_status` (`creator_id`,`order_status`),
  CONSTRAINT `fk_orders_bank_account` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_account` (`id`) ON UPDATE NO ACTION,
  CONSTRAINT `fk_orders_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_orders_creator` FOREIGN KEY (`creator_id`) REFERENCES `users` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_orders_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_orders_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `orders_backup_20260308`
-- DROP TABLE IF EXISTS `orders_backup_20260308`;
CREATE TABLE IF NOT EXISTS `orders_backup_20260308` (
  `id` varchar(32) NOT NULL,
  `customer_id` int(11) DEFAULT NULL,
  `company_id` int(11) DEFAULT NULL,
  `creator_id` int(11) DEFAULT NULL,
  `order_date` datetime DEFAULT NULL,
  `delivery_date` datetime DEFAULT NULL,
  `customer_received_date` date DEFAULT NULL,
  `street` varchar(255) DEFAULT NULL,
  `subdistrict` varchar(128) DEFAULT NULL,
  `district` varchar(128) DEFAULT NULL,
  `province` varchar(128) DEFAULT NULL,
  `postal_code` varchar(16) DEFAULT NULL,
  `recipient_first_name` varchar(128) DEFAULT NULL,
  `recipient_last_name` varchar(128) DEFAULT NULL,
  `shipping_provider` varchar(128) DEFAULT NULL,
  `shipping_cost` decimal(12,2) DEFAULT NULL,
  `bill_discount` decimal(12,2) DEFAULT NULL,
  `total_amount` decimal(12,2) DEFAULT NULL,
  `payment_method` enum('COD','Transfer','PayAfter','Claim','FreeGift') DEFAULT NULL,
  `payment_status` varchar(255) DEFAULT NULL,
  `slip_url` varchar(1024) DEFAULT NULL,
  `amount_paid` decimal(12,2) DEFAULT NULL,
  `cod_amount` decimal(12,2) DEFAULT NULL,
  `order_status` varchar(255) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `ocr_payment_date` datetime DEFAULT NULL,
  `sales_channel` varchar(128) DEFAULT NULL,
  `sales_channel_page_id` int(11) DEFAULT NULL,
  `bank_account_id` int(11) DEFAULT NULL,
  `transfer_date` datetime DEFAULT NULL,
  `warehouse_id` int(11) DEFAULT NULL,
  `customer_type` varchar(50) DEFAULT NULL,
  `upsell_user_id` int(11) DEFAULT NULL COMMENT 'Telesale user assigned for Upsell via Round-Robin',
  `basket_key_at_sale` varchar(50) DEFAULT NULL COMMENT 'ถังที่ลูกค้าอยู่ตอนสร้าง order (สำหรับคำนวณ commission)',
  `note_system` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `orders_bak_20260426`
-- DROP TABLE IF EXISTS `orders_bak_20260426`;
CREATE TABLE IF NOT EXISTS `orders_bak_20260426` (
  `id` varchar(32) NOT NULL,
  `customer_id` int(11) DEFAULT NULL,
  `company_id` int(11) DEFAULT NULL,
  `creator_id` int(11) DEFAULT NULL,
  `order_date` datetime DEFAULT NULL,
  `delivery_date` datetime DEFAULT NULL,
  `customer_received_date` date DEFAULT NULL,
  `street` varchar(255) DEFAULT NULL,
  `subdistrict` varchar(128) DEFAULT NULL,
  `district` varchar(128) DEFAULT NULL,
  `province` varchar(128) DEFAULT NULL,
  `postal_code` varchar(16) DEFAULT NULL,
  `recipient_first_name` varchar(128) DEFAULT NULL,
  `recipient_last_name` varchar(128) DEFAULT NULL,
  `recipient_phone` varchar(50) DEFAULT NULL,
  `shipping_provider` varchar(128) DEFAULT NULL,
  `shipping_cost` decimal(12,2) DEFAULT NULL,
  `bill_discount` decimal(12,2) DEFAULT NULL,
  `total_amount` decimal(12,2) DEFAULT NULL,
  `payment_method` enum('COD','Transfer','PayAfter','Claim','FreeGift','DiscountCoupon') DEFAULT NULL,
  `payment_status` varchar(255) DEFAULT NULL,
  `slip_url` varchar(1024) DEFAULT NULL,
  `amount_paid` decimal(12,2) DEFAULT NULL,
  `cod_amount` decimal(12,2) DEFAULT NULL,
  `order_status` varchar(255) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `ocr_payment_date` datetime DEFAULT NULL,
  `sales_channel` varchar(128) DEFAULT NULL,
  `sales_channel_page_id` int(11) DEFAULT NULL,
  `bank_account_id` int(11) DEFAULT NULL,
  `transfer_date` datetime DEFAULT NULL,
  `warehouse_id` int(11) DEFAULT NULL,
  `customer_type` varchar(50) DEFAULT NULL,
  `upsell_user_id` int(11) DEFAULT NULL COMMENT 'Telesale user assigned for Upsell via Round-Robin',
  `basket_key_at_sale` varchar(50) DEFAULT NULL COMMENT 'ถังที่ลูกค้าอยู่ตอนสร้าง order (สำหรับคำนวณ commission)',
  `note_system` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `orders_imp_116m`
-- DROP TABLE IF EXISTS `orders_imp_116m`;
CREATE TABLE IF NOT EXISTS `orders_imp_116m` (
  `id` varchar(32) NOT NULL,
  `customer_id` int(11) DEFAULT NULL,
  `company_id` int(11) DEFAULT NULL,
  `creator_id` int(11) DEFAULT NULL,
  `order_date` datetime DEFAULT NULL,
  `delivery_date` datetime DEFAULT NULL,
  `customer_received_date` date DEFAULT NULL,
  `street` varchar(255) DEFAULT NULL,
  `subdistrict` varchar(128) DEFAULT NULL,
  `district` varchar(128) DEFAULT NULL,
  `province` varchar(128) DEFAULT NULL,
  `postal_code` varchar(16) DEFAULT NULL,
  `recipient_first_name` varchar(128) DEFAULT NULL,
  `recipient_last_name` varchar(128) DEFAULT NULL,
  `shipping_provider` varchar(128) DEFAULT NULL,
  `shipping_cost` decimal(12,2) DEFAULT NULL,
  `bill_discount` decimal(12,2) DEFAULT NULL,
  `total_amount` decimal(12,2) DEFAULT NULL,
  `payment_method` enum('COD','Transfer','PayAfter','Claim','FreeGift') DEFAULT NULL,
  `payment_status` varchar(255) DEFAULT NULL,
  `slip_url` varchar(1024) DEFAULT NULL,
  `amount_paid` decimal(12,2) DEFAULT NULL,
  `cod_amount` decimal(12,2) DEFAULT NULL,
  `order_status` varchar(255) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `ocr_payment_date` datetime DEFAULT NULL,
  `sales_channel` varchar(128) DEFAULT NULL,
  `sales_channel_page_id` int(11) DEFAULT NULL,
  `bank_account_id` int(11) DEFAULT NULL,
  `transfer_date` datetime DEFAULT NULL,
  `warehouse_id` int(11) DEFAULT NULL,
  `customer_type` varchar(50) DEFAULT NULL,
  `upsell_user_id` int(11) DEFAULT NULL COMMENT 'Telesale user assigned for Upsell via Round-Robin',
  `basket_key_at_sale` varchar(50) DEFAULT NULL COMMENT 'ถังที่ลูกค้าอยู่ตอนสร้าง order (สำหรับคำนวณ commission)',
  `note_system` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `page_engagement_batch`
-- DROP TABLE IF EXISTS `page_engagement_batch`;
CREATE TABLE IF NOT EXISTS `page_engagement_batch` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `date_range` varchar(100) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `status` varchar(255) DEFAULT NULL,
  `records_count` int(11) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `page_engagement_log`
-- DROP TABLE IF EXISTS `page_engagement_log`;
CREATE TABLE IF NOT EXISTS `page_engagement_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `batch_id` int(11) DEFAULT NULL,
  `page_id` varchar(50) DEFAULT NULL,
  `date` date DEFAULT NULL,
  `inbox` int(11) DEFAULT NULL,
  `comment` int(11) DEFAULT NULL,
  `total` int(11) DEFAULT NULL,
  `new_customer_replied` int(11) DEFAULT NULL,
  `customer_engagement_new_inbox` int(11) DEFAULT NULL,
  `order_count` int(11) DEFAULT NULL,
  `old_order_count` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_batch_id` (`batch_id`),
  KEY `idx_date` (`date`),
  KEY `idx_page_id` (`page_id`),
  CONSTRAINT `fk_page_engagement_log_batch` FOREIGN KEY (`batch_id`) REFERENCES `page_engagement_batch` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `page_list_user`
-- DROP TABLE IF EXISTS `page_list_user`;
CREATE TABLE IF NOT EXISTS `page_list_user` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `page_id` varchar(255) DEFAULT NULL,
  `page_user_id` varchar(255) DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  `still_in_list` tinyint(1) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_page_user_pair` (`page_id`,`page_user_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_page_id` (`page_id`),
  KEY `idx_page_user_id` (`page_user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_still_in_list` (`still_in_list`),
  KEY `idx_updated_at` (`updated_at`)
) ENGINE=InnoDB AUTO_INCREMENT=1171 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `page_stats_batch`
-- DROP TABLE IF EXISTS `page_stats_batch`;
CREATE TABLE IF NOT EXISTS `page_stats_batch` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `date_range` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_date_range` (`date_range`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `page_stats_log`
-- DROP TABLE IF EXISTS `page_stats_log`;
CREATE TABLE IF NOT EXISTS `page_stats_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `batch_id` int(11) DEFAULT NULL,
  `page_id` varchar(255) DEFAULT NULL,
  `time_column` varchar(255) DEFAULT NULL,
  `new_customers` int(11) DEFAULT NULL,
  `total_phones` int(11) DEFAULT NULL,
  `new_phones` int(11) DEFAULT NULL,
  `total_comments` int(11) DEFAULT NULL,
  `total_chats` int(11) DEFAULT NULL,
  `total_page_comments` int(11) DEFAULT NULL,
  `total_page_chats` int(11) DEFAULT NULL,
  `new_chats` int(11) DEFAULT NULL,
  `chats_from_old_customers` int(11) DEFAULT NULL,
  `web_logged_in` int(11) DEFAULT NULL,
  `web_guest` int(11) DEFAULT NULL,
  `orders_count` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_batch_page_time` (`batch_id`,`page_id`,`time_column`),
  KEY `idx_batch_id` (`batch_id`),
  KEY `idx_page_id` (`page_id`),
  KEY `idx_time_column` (`time_column`),
  CONSTRAINT `page_stats_log_ibfk_1` FOREIGN KEY (`batch_id`) REFERENCES `page_stats_batch` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=124 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `page_user`
-- DROP TABLE IF EXISTS `page_user`;
CREATE TABLE IF NOT EXISTS `page_user` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `page_user_id` varchar(255) DEFAULT NULL,
  `page_user_name` varchar(255) DEFAULT NULL,
  `page_count` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_page_user_page_user_id` (`page_user_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_page_user_id` (`page_user_id`),
  KEY `idx_page_user_name` (`page_user_name`),
  KEY `idx_updated_at` (`updated_at`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=93 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `pages`
-- DROP TABLE IF EXISTS `pages`;
CREATE TABLE IF NOT EXISTS `pages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `page_id` varchar(255) DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  `platform` varchar(64) DEFAULT NULL,
  `page_type` varchar(50) DEFAULT NULL,
  `url` varchar(1024) DEFAULT NULL,
  `company_id` int(11) DEFAULT NULL,
  `active` tinyint(1) DEFAULT NULL,
  `still_in_list` tinyint(1) DEFAULT NULL,
  `user_count` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `display_name` varchar(255) DEFAULT NULL,
  `sell_product_type` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_page_id` (`page_id`),
  KEY `idx_page_type` (`page_type`),
  KEY `idx_pages_active` (`active`),
  KEY `idx_pages_company` (`company_id`),
  KEY `idx_still_in_list` (`still_in_list`),
  KEY `idx_user_count` (`user_count`),
  CONSTRAINT `fk_pages_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=236 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `platforms`
-- DROP TABLE IF EXISTS `platforms`;
CREATE TABLE IF NOT EXISTS `platforms` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(64) DEFAULT NULL,
  `display_name` varchar(128) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `company_id` int(11) DEFAULT NULL,
  `active` tinyint(1) DEFAULT NULL,
  `sort_order` int(11) DEFAULT NULL,
  `show_pages_from` varchar(64) DEFAULT NULL,
  `require_page` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL,
  `role_show` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_platforms_company_name` (`company_id`,`name`),
  KEY `idx_platforms_active` (`active`),
  KEY `idx_platforms_company_id` (`company_id`),
  KEY `idx_platforms_show_pages_from` (`show_pages_from`),
  KEY `idx_platforms_sort_order` (`sort_order`),
  CONSTRAINT `fk_platforms_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=39 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `product_lots`
-- DROP TABLE IF EXISTS `product_lots`;
CREATE TABLE IF NOT EXISTS `product_lots` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `lot_number` varchar(128) DEFAULT NULL,
  `product_id` int(11) DEFAULT NULL,
  `warehouse_id` int(11) DEFAULT NULL,
  `purchase_date` date DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  `quantity_received` decimal(12,2) DEFAULT NULL,
  `quantity_remaining` decimal(12,2) DEFAULT NULL,
  `unit_cost` decimal(12,2) DEFAULT NULL,
  `supplier_id` int(11) DEFAULT NULL,
  `supplier_invoice` varchar(128) DEFAULT NULL,
  `status` varchar(255) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_product_lots_lot_number` (`lot_number`),
  UNIQUE KEY `idx_product_lot_unique` (`product_id`,`lot_number`),
  KEY `idx_lot_expiry` (`expiry_date`),
  KEY `idx_lot_status` (`status`),
  KEY `product_id` (`product_id`),
  KEY `warehouse_id` (`warehouse_id`),
  KEY `product_lots_ibfk_1` (`product_id`),
  KEY `product_lots_ibfk_2` (`warehouse_id`),
  CONSTRAINT `product_lots_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `product_lots_ibfk_2` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `products`
-- DROP TABLE IF EXISTS `products`;
CREATE TABLE IF NOT EXISTS `products` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sku` varchar(64) DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `category` varchar(128) DEFAULT NULL,
  `report_category` varchar(128) DEFAULT NULL,
  `ads_group` varchar(128) DEFAULT NULL,
  `unit` varchar(32) DEFAULT NULL,
  `cost` decimal(12,2) DEFAULT NULL,
  `price` decimal(12,2) DEFAULT NULL,
  `stock` int(11) DEFAULT NULL,
  `company_id` int(11) DEFAULT NULL,
  `shop` varchar(128) DEFAULT NULL,
  `status` varchar(255) DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_products_company` (`company_id`),
  KEY `idx_products_category` (`category`),
  KEY `idx_products_report_category` (`report_category`),
  CONSTRAINT `fk_products_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=163 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `promotion_items`
-- DROP TABLE IF EXISTS `promotion_items`;
CREATE TABLE IF NOT EXISTS `promotion_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `promotion_id` int(11) DEFAULT NULL,
  `product_id` int(11) DEFAULT NULL,
  `quantity` int(11) DEFAULT NULL,
  `is_freebie` tinyint(1) DEFAULT NULL,
  `price_override` decimal(12,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_pitems_product` (`product_id`),
  KEY `fk_pitems_promotion` (`promotion_id`),
  CONSTRAINT `fk_pitems_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_pitems_promotion` FOREIGN KEY (`promotion_id`) REFERENCES `promotions` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=105 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `promotions`
-- DROP TABLE IF EXISTS `promotions`;
CREATE TABLE IF NOT EXISTS `promotions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sku` varchar(64) DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `company_id` int(11) DEFAULT NULL,
  `active` tinyint(1) DEFAULT NULL,
  `start_date` datetime DEFAULT NULL,
  `end_date` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_promotions_active` (`active`),
  KEY `idx_promotions_company` (`company_id`),
  KEY `idx_promotions_dates` (`start_date`,`end_date`),
  CONSTRAINT `fk_promotions_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=34 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `quota_allocations`
-- DROP TABLE IF EXISTS `quota_allocations`;
CREATE TABLE IF NOT EXISTS `quota_allocations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `quota_product_id` int(11) DEFAULT NULL COMMENT 'FK → quota_products.id (NULL = global)',
  `user_id` int(11) NOT NULL COMMENT 'FK → users.id (พนักงานที่ได้โควตา)',
  `company_id` int(11) NOT NULL,
  `quantity` decimal(10,2) NOT NULL COMMENT 'จำนวนโควตาที่ให้',
  `source` varchar(50) NOT NULL DEFAULT 'admin' COMMENT 'auto | admin | auto_confirmed',
  `source_detail` text DEFAULT NULL COMMENT 'รายละเอียด เช่น order_id, หมายเหตุ',
  `allocated_by` int(11) DEFAULT NULL COMMENT 'FK → users.id (admin ที่เพิ่ม)',
  `period_start` date DEFAULT NULL COMMENT 'เริ่มต้นรอบ',
  `period_end` date DEFAULT NULL COMMENT 'สิ้นสุดรอบ',
  `valid_from` date DEFAULT NULL COMMENT 'วันเริ่มมีผล',
  `valid_until` date DEFAULT NULL COMMENT 'วันหมดอายุ',
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user_product` (`user_id`,`quota_product_id`),
  KEY `idx_company` (`company_id`),
  KEY `idx_period` (`quota_product_id`,`user_id`,`period_start`,`period_end`)
) ENGINE=InnoDB AUTO_INCREMENT=23 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `quota_products`
-- DROP TABLE IF EXISTS `quota_products`;
CREATE TABLE IF NOT EXISTS `quota_products` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `product_id` int(11) NOT NULL COMMENT 'FK → products.id',
  `company_id` int(11) NOT NULL COMMENT 'FK → companies.id',
  `display_name` varchar(255) NOT NULL COMMENT 'ชื่อที่แสดงในระบบ',
  `csv_label` varchar(255) DEFAULT NULL COMMENT 'ชื่อที่แสดงใน CSV export',
  `quota_cost` int(11) NOT NULL DEFAULT 1 COMMENT 'จำนวนโควตาที่ต้องใช้ต่อ 1 ชิ้น',
  `is_active` tinyint(1) DEFAULT 1,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_product_company` (`product_id`,`company_id`),
  KEY `idx_company` (`company_id`),
  KEY `idx_active` (`company_id`,`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `quota_rate_schedules`
-- DROP TABLE IF EXISTS `quota_rate_schedules`;
CREATE TABLE IF NOT EXISTS `quota_rate_schedules` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `rate_name` varchar(255) DEFAULT NULL,
  `quota_product_id` int(11) DEFAULT NULL COMMENT 'FK → quota_products.id (NULL = global/scoped)',
  `sales_per_quota` decimal(10,2) NOT NULL COMMENT 'ยอดขายกี่บาท = 1 โควตา',
  `effective_date` date NOT NULL COMMENT 'มีผลตั้งแต่วันนี้เป็นต้นไป',
  `order_date_field` enum('order_date','delivery_date') DEFAULT 'order_date' COMMENT 'ใช้วันไหนคำนวณ',
  `quota_mode` enum('reset','cumulative','confirm') DEFAULT 'reset' COMMENT 'reset=รีเซ็ตตามรอบ, cumulative=สะสม, confirm=กำหนดเอง',
  `reset_interval_days` int(11) DEFAULT 30 COMMENT 'จำนวนวันต่อรอบ (mode reset + interval)',
  `reset_day_of_month` tinyint(4) DEFAULT NULL COMMENT 'วันที่รีเซ็ตของเดือน 1-28 (mode reset + monthly)',
  `reset_anchor_date` date DEFAULT NULL COMMENT 'วันเริ่มนับรอบ (mode reset + interval)',
  `calc_period_start` date DEFAULT NULL COMMENT 'ช่วงออเดอร์เริ่มต้น (confirm mode)',
  `calc_period_end` date DEFAULT NULL COMMENT 'ช่วงออเดอร์สิ้นสุด (confirm mode)',
  `usage_start_date` date DEFAULT NULL COMMENT 'โควตาเริ่มใช้ได้เมื่อไหร่ (confirm mode)',
  `usage_end_date` date DEFAULT NULL COMMENT 'วันหมดอายุโควตา (confirm mode)',
  `require_confirm` tinyint(4) NOT NULL DEFAULT 1 COMMENT '1=รอ admin ยืนยัน, 0=อัตโนมัติ',
  `created_by` int(11) DEFAULT NULL COMMENT 'FK → users.id',
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_effective` (`quota_product_id`,`effective_date`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `quota_rate_scope`
-- DROP TABLE IF EXISTS `quota_rate_scope`;
CREATE TABLE IF NOT EXISTS `quota_rate_scope` (
  `rate_schedule_id` int(11) NOT NULL COMMENT 'FK → quota_rate_schedules.id',
  `quota_product_id` int(11) NOT NULL COMMENT 'FK → quota_products.id',
  `sales_per_quota` decimal(12,2) DEFAULT NULL COMMENT 'ยอดขาย/โควตาเฉพาะสินค้านี้ (NULL = ใช้ค่าจาก rate)',
  PRIMARY KEY (`rate_schedule_id`,`quota_product_id`),
  KEY `idx_product` (`quota_product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `quota_usage`
-- DROP TABLE IF EXISTS `quota_usage`;
CREATE TABLE IF NOT EXISTS `quota_usage` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `quota_product_id` int(11) NOT NULL COMMENT 'FK → quota_products.id',
  `user_id` int(11) NOT NULL COMMENT 'FK → users.id',
  `company_id` int(11) NOT NULL,
  `order_id` varchar(50) NOT NULL COMMENT 'FK → orders.id',
  `quantity_used` decimal(10,2) NOT NULL COMMENT 'จำนวนโควตาที่ใช้',
  `period_start` date DEFAULT NULL,
  `period_end` date DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_order_product` (`order_id`,`quota_product_id`),
  KEY `idx_user_product` (`user_id`,`quota_product_id`),
  KEY `idx_order` (`order_id`),
  KEY `idx_period` (`quota_product_id`,`user_id`,`period_start`,`period_end`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `return_images`
-- DROP TABLE IF EXISTS `return_images`;
CREATE TABLE IF NOT EXISTS `return_images` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sub_order_id` varchar(100) NOT NULL,
  `filename` varchar(255) NOT NULL,
  `url` varchar(500) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_sub_order_id` (`sub_order_id`)
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `role_permissions`
-- DROP TABLE IF EXISTS `role_permissions`;
CREATE TABLE IF NOT EXISTS `role_permissions` (
  `role` varchar(64) NOT NULL,
  `data` text DEFAULT NULL,
  `description` text DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`role`),
  KEY `idx_role_permissions_updated` (`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `roles`
-- DROP TABLE IF EXISTS `roles`;
CREATE TABLE IF NOT EXISTS `roles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(64) DEFAULT NULL,
  `name` varchar(128) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT NULL,
  `is_system` tinyint(1) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_roles_code` (`code`),
  KEY `idx_roles_active` (`is_active`),
  KEY `idx_roles_code` (`code`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `sales_targets`
-- DROP TABLE IF EXISTS `sales_targets`;
CREATE TABLE IF NOT EXISTS `sales_targets` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `month` tinyint(4) NOT NULL COMMENT '1-12',
  `year` int(11) NOT NULL COMMENT 'e.g. 2026',
  `target_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_month_year` (`user_id`,`month`,`year`),
  CONSTRAINT `sales_targets_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=762 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table structure for `statement_batchs`
-- DROP TABLE IF EXISTS `statement_batchs`;
CREATE TABLE IF NOT EXISTS `statement_batchs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `company_id` int(11) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `row_count` int(11) DEFAULT NULL,
  `transfer_min` datetime DEFAULT NULL,
  `transfer_max` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_statement_batchs_company_created` (`company_id`,`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=1015 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `statement_logs`
-- DROP TABLE IF EXISTS `statement_logs`;
CREATE TABLE IF NOT EXISTS `statement_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `batch_id` int(11) DEFAULT NULL,
  `transfer_at` datetime DEFAULT NULL,
  `amount` decimal(12,2) DEFAULT NULL,
  `channel` varchar(64) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `bank_account_id` int(11) DEFAULT NULL,
  `bank_display_name` varchar(150) DEFAULT NULL,
  `statement_reconcile_logs` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_statement_logs_batch_transfer` (`batch_id`,`transfer_at`),
  KEY `idx_statement_logs_bank_date` (`bank_account_id`,`transfer_at`),
  CONSTRAINT `fk_statement_logs_batch_id_statement_batchs` FOREIGN KEY (`batch_id`) REFERENCES `statement_batchs` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=6177 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `statement_reconcile_batches`
-- DROP TABLE IF EXISTS `statement_reconcile_batches`;
CREATE TABLE IF NOT EXISTS `statement_reconcile_batches` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `document_no` varchar(120) DEFAULT NULL,
  `bank_account_id` int(11) DEFAULT NULL,
  `bank_display_name` varchar(150) DEFAULT NULL,
  `company_id` int(11) DEFAULT NULL,
  `start_date` datetime DEFAULT NULL,
  `end_date` datetime DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `notes` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_statement_reconcile_batches_document_no` (`document_no`),
  KEY `idx_statement_reconcile_bank` (`bank_account_id`),
  KEY `idx_statement_reconcile_company_created` (`company_id`,`created_at`),
  CONSTRAINT `fk_statement_reconcile_bank` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_account` (`id`) ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=5217 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `statement_reconcile_logs`
-- DROP TABLE IF EXISTS `statement_reconcile_logs`;
CREATE TABLE IF NOT EXISTS `statement_reconcile_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `batch_id` int(11) DEFAULT NULL,
  `statement_log_id` int(11) DEFAULT NULL,
  `order_id` varchar(32) DEFAULT NULL,
  `statement_amount` decimal(12,2) DEFAULT NULL,
  `confirmed_amount` decimal(12,2) DEFAULT NULL,
  `auto_matched` tinyint(1) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `confirmed_by` int(11) DEFAULT NULL,
  `note` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `reconcile_type` varchar(20) DEFAULT NULL,
  `confirmed_at` datetime DEFAULT NULL,
  `confirmed_order_id` varchar(100) DEFAULT NULL,
  `confirmed_order_amount` decimal(10,2) DEFAULT NULL,
  `confirmed_payment_method` varchar(50) DEFAULT NULL,
  `confirmed_action` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_statement_reconcile_batch` (`batch_id`),
  KEY `idx_statement_reconcile_order_statement` (`order_id`,`statement_log_id`),
  KEY `idx_statement_reconcile_type` (`reconcile_type`),
  CONSTRAINT `fk_statement_reconcile_batch` FOREIGN KEY (`batch_id`) REFERENCES `statement_reconcile_batches` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_statement_reconcile_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=39129 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `stock_movements`
-- DROP TABLE IF EXISTS `stock_movements`;
CREATE TABLE IF NOT EXISTS `stock_movements` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `warehouse_id` int(11) DEFAULT NULL,
  `product_id` int(11) DEFAULT NULL,
  `movement_type` varchar(255) DEFAULT NULL,
  `quantity` int(11) DEFAULT NULL,
  `lot_number` varchar(128) DEFAULT NULL,
  `reference_type` varchar(64) DEFAULT NULL,
  `reference_id` varchar(64) DEFAULT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `document_number` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_stock_movements_product` (`product_id`),
  KEY `fk_stock_movements_user` (`created_by`),
  KEY `fk_stock_movements_warehouse` (`warehouse_id`),
  KEY `idx_stock_movements_date` (`created_at`),
  KEY `idx_stock_movements_type` (`movement_type`),
  CONSTRAINT `fk_stock_movements_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_stock_movements_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_stock_movements_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `stock_reservations`
-- DROP TABLE IF EXISTS `stock_reservations`;
CREATE TABLE IF NOT EXISTS `stock_reservations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `warehouse_id` int(11) DEFAULT NULL,
  `product_id` int(11) DEFAULT NULL,
  `order_id` varchar(32) DEFAULT NULL,
  `quantity` int(11) DEFAULT NULL,
  `lot_number` varchar(128) DEFAULT NULL,
  `reserved_at` datetime DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `status` varchar(255) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_stock_reservations_order` (`order_id`),
  KEY `fk_stock_reservations_product` (`product_id`),
  KEY `fk_stock_reservations_user` (`created_by`),
  KEY `fk_stock_reservations_warehouse` (`warehouse_id`),
  KEY `idx_stock_reservations_status` (`status`),
  CONSTRAINT `fk_stock_reservations_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_stock_reservations_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_stock_reservations_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_stock_reservations_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `stock_transaction_images`
-- DROP TABLE IF EXISTS `stock_transaction_images`;
CREATE TABLE IF NOT EXISTS `stock_transaction_images` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `transaction_id` int(11) DEFAULT NULL,
  `image_path` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `transaction_id` (`transaction_id`),
  CONSTRAINT `fk_transaction_images_header` FOREIGN KEY (`transaction_id`) REFERENCES `stock_transactions` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `stock_transaction_items`
-- DROP TABLE IF EXISTS `stock_transaction_items`;
CREATE TABLE IF NOT EXISTS `stock_transaction_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `transaction_id` int(11) DEFAULT NULL,
  `product_id` int(11) DEFAULT NULL,
  `warehouse_id` int(11) DEFAULT NULL,
  `lot_id` int(11) DEFAULT NULL,
  `quantity` decimal(10,2) DEFAULT NULL,
  `adjustment_type` varchar(255) DEFAULT NULL,
  `remarks` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `transaction_id` (`transaction_id`),
  CONSTRAINT `fk_transaction_items_header` FOREIGN KEY (`transaction_id`) REFERENCES `stock_transactions` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `stock_transactions`
-- DROP TABLE IF EXISTS `stock_transactions`;
CREATE TABLE IF NOT EXISTS `stock_transactions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `document_number` varchar(50) DEFAULT NULL,
  `type` varchar(255) DEFAULT NULL,
  `transaction_date` datetime DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_stock_transactions_document_number` (`document_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `tags`
-- DROP TABLE IF EXISTS `tags`;
CREATE TABLE IF NOT EXISTS `tags` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(128) DEFAULT NULL,
  `type` varchar(255) DEFAULT NULL,
  `color` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=616 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `tmp_assignment_periods`
-- DROP TABLE IF EXISTS `tmp_assignment_periods`;
CREATE TABLE IF NOT EXISTS `tmp_assignment_periods` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `customer_id` int(11) NOT NULL,
  `assigned_to` int(11) NOT NULL,
  `period_start` datetime NOT NULL,
  `period_end` datetime NOT NULL,
  `source` varchar(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_customer` (`customer_id`),
  KEY `idx_assigned` (`assigned_to`),
  KEY `idx_period` (`period_start`,`period_end`),
  KEY `idx_cust_period` (`customer_id`,`period_start`,`period_end`)
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table structure for `tracking_import_logs`
-- DROP TABLE IF EXISTS `tracking_import_logs`;
CREATE TABLE IF NOT EXISTS `tracking_import_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `batch_id` varchar(36) NOT NULL COMMENT 'UUID ระบุรอบ import เดียวกัน',
  `user_id` int(11) DEFAULT NULL,
  `username` varchar(100) DEFAULT NULL,
  `company_id` int(11) DEFAULT NULL,
  `order_id` varchar(100) NOT NULL COMMENT 'Order ID ตามที่ผู้ใช้กรอก (raw)',
  `resolved_order_id` varchar(100) DEFAULT NULL COMMENT 'Order ID ที่ระบบ resolve ได้หลัง validate',
  `tracking_number` varchar(100) NOT NULL,
  `box_number` int(11) DEFAULT 1,
  `action` varchar(20) DEFAULT 'import' COMMENT 'import | validate',
  `status` varchar(20) DEFAULT 'success' COMMENT 'success | error | duplicate',
  `message` text DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_batch_id` (`batch_id`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_tracking_number` (`tracking_number`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_company_id` (`company_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=33565 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `upsell_round_robin`
-- DROP TABLE IF EXISTS `upsell_round_robin`;
CREATE TABLE IF NOT EXISTS `upsell_round_robin` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `company_id` int(11) NOT NULL DEFAULT 1,
  `last_assigned_user_id` int(11) DEFAULT NULL,
  `last_assigned_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_company` (`company_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Track Round-Robin position for Upsell auto-assignment';

-- Table structure for `user_daily_attendance`
-- DROP TABLE IF EXISTS `user_daily_attendance`;
CREATE TABLE IF NOT EXISTS `user_daily_attendance` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `work_date` date DEFAULT NULL,
  `first_login` datetime DEFAULT NULL,
  `last_logout` datetime DEFAULT NULL,
  `login_sessions` int(11) DEFAULT NULL,
  `effective_seconds` int(11) DEFAULT NULL,
  `percent_of_workday` decimal(5,2) DEFAULT NULL,
  `attendance_value` decimal(6,4) NOT NULL DEFAULT 0.0000,
  `attendance_status` varchar(255) DEFAULT NULL,
  `computed_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `notes` varchar(255) DEFAULT NULL COMMENT 'หมายเหตุ',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_user_date` (`user_id`,`work_date`),
  KEY `idx_work_date` (`work_date`),
  CONSTRAINT `fk_attendance_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=43876543 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `user_login_history`
-- DROP TABLE IF EXISTS `user_login_history`;
CREATE TABLE IF NOT EXISTS `user_login_history` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `login_time` datetime DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `logout_time` datetime DEFAULT NULL,
  `last_activity` datetime DEFAULT NULL,
  `session_duration` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_login_time` (`login_time`),
  KEY `idx_login_user_id` (`user_id`),
  KEY `idx_last_activity` (`last_activity`),
  CONSTRAINT `user_login_history_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=7071 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `user_pancake_mapping`
-- DROP TABLE IF EXISTS `user_pancake_mapping`;
CREATE TABLE IF NOT EXISTS `user_pancake_mapping` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_user` int(11) DEFAULT NULL,
  `id_panake` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_user_pancake_mapping_id_user` (`id_user`),
  UNIQUE KEY `uniq_user_pancake_mapping_id_panake` (`id_panake`),
  KEY `idx_panake` (`id_panake`),
  KEY `idx_user` (`id_user`),
  CONSTRAINT `fk_upm_user` FOREIGN KEY (`id_user`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `user_permission_overrides`
-- DROP TABLE IF EXISTS `user_permission_overrides`;
CREATE TABLE IF NOT EXISTS `user_permission_overrides` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `permission_key` varchar(128) DEFAULT NULL,
  `permission_value` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`permission_value`)),
  `notes` text DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_user_permission` (`user_id`,`permission_key`),
  KEY `fk_user_permission_creator` (`created_by`),
  KEY `idx_user_overrides_key` (`permission_key`),
  KEY `idx_user_permission_user` (`user_id`),
  CONSTRAINT `fk_user_permission_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON UPDATE NO ACTION,
  CONSTRAINT `fk_user_permission_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `user_tags`
-- DROP TABLE IF EXISTS `user_tags`;
CREATE TABLE IF NOT EXISTS `user_tags` (
  `user_id` int(11) DEFAULT NULL,
  `tag_id` int(11) DEFAULT NULL,
  KEY `fk_user_tags_tag` (`tag_id`),
  KEY `fk_user_tags_user` (`user_id`),
  CONSTRAINT `fk_user_tags_tag` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_user_tags_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `user_tokens`
-- DROP TABLE IF EXISTS `user_tokens`;
CREATE TABLE IF NOT EXISTS `user_tokens` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `token` varchar(64) NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_token` (`token`),
  UNIQUE KEY `uniq_user_tokens_token` (`token`),
  KEY `idx_user` (`user_id`),
  CONSTRAINT `fk_token_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=14700 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table structure for `users`
-- DROP TABLE IF EXISTS `users`;
CREATE TABLE IF NOT EXISTS `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(64) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `first_name` varchar(128) DEFAULT NULL,
  `last_name` varchar(128) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(64) DEFAULT NULL,
  `role` varchar(64) DEFAULT NULL,
  `company_id` int(11) DEFAULT NULL,
  `team_id` int(11) DEFAULT NULL,
  `supervisor_id` int(11) DEFAULT NULL,
  `id_oth` varchar(255) DEFAULT NULL,
  `status` varchar(255) DEFAULT 'active',
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  `last_login` datetime DEFAULT NULL,
  `login_count` int(11) DEFAULT NULL,
  `role_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_users_username` (`username`),
  KEY `idx_users_company` (`company_id`),
  KEY `idx_users_company_role` (`company_id`,`role`),
  KEY `idx_users_company_status` (`company_id`,`status`),
  KEY `idx_users_id_oth` (`id_oth`),
  KEY `idx_users_last_login` (`last_login`),
  KEY `idx_users_phone` (`phone`),
  KEY `idx_users_role` (`role`),
  KEY `idx_users_status` (`status`),
  KEY `idx_users_role_id` (`role_id`),
  CONSTRAINT `fk_users_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=1780 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `warehouse_stocks`
-- DROP TABLE IF EXISTS `warehouse_stocks`;
CREATE TABLE IF NOT EXISTS `warehouse_stocks` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `warehouse_id` int(11) DEFAULT NULL,
  `product_id` int(11) DEFAULT NULL,
  `lot_number` varchar(128) DEFAULT NULL,
  `product_lot_id` int(11) DEFAULT NULL,
  `quantity` int(11) DEFAULT NULL,
  `reserved_quantity` int(11) DEFAULT NULL,
  `available_quantity` int(11) DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  `purchase_price` decimal(12,2) DEFAULT NULL,
  `selling_price` decimal(12,2) DEFAULT NULL,
  `location_in_warehouse` varchar(255) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_warehouse_product_lot` (`warehouse_id`,`product_id`,`lot_number`),
  KEY `fk_warehouse_stocks_product` (`product_id`),
  KEY `fk_warehouse_stocks_warehouse` (`warehouse_id`),
  KEY `idx_warehouse_stocks_expiry` (`expiry_date`),
  KEY `idx_warehouse_stocks_quantity` (`quantity`),
  CONSTRAINT `fk_warehouse_stocks_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_warehouse_stocks_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table structure for `warehouses`
-- DROP TABLE IF EXISTS `warehouses`;
CREATE TABLE IF NOT EXISTS `warehouses` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) DEFAULT NULL,
  `company_id` int(11) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `province` varchar(128) DEFAULT NULL,
  `district` varchar(128) DEFAULT NULL,
  `subdistrict` varchar(128) DEFAULT NULL,
  `postal_code` varchar(16) DEFAULT NULL,
  `phone` varchar(64) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `manager_name` varchar(255) DEFAULT NULL,
  `manager_phone` varchar(64) DEFAULT NULL,
  `responsible_provinces` text DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_warehouses_company` (`company_id`),
  KEY `idx_warehouses_active` (`is_active`),
  KEY `idx_warehouses_province` (`province`),
  CONSTRAINT `fk_warehouses_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS=1;
-- Migration: Create daily attendance tracking from login history
-- Purpose: Track per-user daily attendance (Telesale/Supervisor Telesale)
-- Logic:
--   - Work window: 09:00:00 to 18:00:00 each day (9 hours = 32400 seconds)
--   - Sum only the overlap between login sessions and the work window
--   - Attendance value:
--       >= 80% of window -> 1.0 (full)
--       >= 40% and <80% -> 0.5 (half)
--       otherwise        -> 0.0 (absent)
-- Safe for repeated runs (guards on existence)

USE `mini_erp`;

-- 1) Create table if not exists
CREATE TABLE IF NOT EXISTS `user_daily_attendance` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `work_date` DATE NOT NULL,
  `first_login` DATETIME NULL,
  `last_logout` DATETIME NULL,
  `login_sessions` INT NOT NULL DEFAULT 0,
  `effective_seconds` INT NOT NULL DEFAULT 0 COMMENT 'Seconds overlapped with 09:00-18:00',
  `percent_of_workday` DECIMAL(5,2) GENERATED ALWAYS AS (ROUND((`effective_seconds` / 32400) * 100, 2)) STORED,
  `attendance_value` DECIMAL(3,1) NOT NULL DEFAULT 0.0 COMMENT '0.0, 0.5, 1.0',
  `attendance_status` ENUM('absent','half','full') NOT NULL DEFAULT 'absent',
  `computed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_user_date` (`user_id`, `work_date`),
  KEY `idx_work_date` (`work_date`),
  CONSTRAINT `fk_attendance_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2) Helper procedure: upsert attendance for a single user and date
DROP PROCEDURE IF EXISTS `sp_upsert_user_daily_attendance`;
DELIMITER $$
CREATE PROCEDURE `sp_upsert_user_daily_attendance`(IN p_user_id INT, IN p_date DATE)
proc: BEGIN
  DECLARE v_role VARCHAR(64);
  DECLARE v_work_start DATETIME;
  DECLARE v_work_end DATETIME;
  DECLARE v_first_login DATETIME;
  DECLARE v_last_logout DATETIME;
  DECLARE v_sessions INT DEFAULT 0;
  DECLARE v_effective_seconds INT DEFAULT 0;
  DECLARE v_att_val DECIMAL(3,1) DEFAULT 0.0;
  DECLARE v_att_status VARCHAR(10);

  -- Only consider Telesale roles
  SELECT role INTO v_role FROM users WHERE id = p_user_id LIMIT 1;
  IF v_role IS NULL OR v_role NOT IN ('Telesale','Supervisor Telesale') THEN
    LEAVE proc;
  END IF;

  -- Work window boundaries for the day
  SET v_work_start = TIMESTAMP(p_date, '09:00:00');
  SET v_work_end   = TIMESTAMP(p_date, '18:00:00');

  -- First login within the day
  SELECT MIN(h.login_time)
    INTO v_first_login
    FROM user_login_history h
   WHERE h.user_id = p_user_id
     AND h.login_time >= p_date
     AND h.login_time < DATE_ADD(p_date, INTERVAL 1 DAY);

  -- Last logout within or up to end of work window (fallback to NOW() if no logout)
  SELECT MAX(LEAST(COALESCE(h.logout_time, NOW()), v_work_end))
    INTO v_last_logout
    FROM user_login_history h
   WHERE h.user_id = p_user_id
     AND h.login_time >= p_date
     AND h.login_time < DATE_ADD(p_date, INTERVAL 1 DAY);

  -- Number of sessions overlapping work window
  SELECT COUNT(*)
    INTO v_sessions
    FROM user_login_history h
   WHERE h.user_id = p_user_id
     AND h.login_time >= p_date
     AND h.login_time < DATE_ADD(p_date, INTERVAL 1 DAY)
     AND h.login_time < v_work_end
     AND COALESCE(h.logout_time, NOW()) > v_work_start;

  -- Sum effective seconds overlapping [09:00, 18:00]
  SELECT COALESCE(SUM(
           GREATEST(0, TIMESTAMPDIFF(SECOND,
             GREATEST(h.login_time, v_work_start),
             LEAST(COALESCE(h.logout_time, NOW()), v_work_end)
           ))
         ), 0)
    INTO v_effective_seconds
    FROM user_login_history h
   WHERE h.user_id = p_user_id
     AND h.login_time >= p_date
     AND h.login_time < DATE_ADD(p_date, INTERVAL 1 DAY)
     AND h.login_time < v_work_end
     AND COALESCE(h.logout_time, NOW()) > v_work_start;

  -- Attendance value and status
  IF v_effective_seconds >= 0.80 * 32400 THEN
    SET v_att_val = 1.0; SET v_att_status = 'full';
  ELSEIF v_effective_seconds >= 0.40 * 32400 THEN
    SET v_att_val = 0.5; SET v_att_status = 'half';
  ELSE
    SET v_att_val = 0.0; SET v_att_status = 'absent';
  END IF;

  -- Upsert row
  INSERT INTO user_daily_attendance
    (user_id, work_date, first_login, last_logout, login_sessions, effective_seconds, attendance_value, attendance_status, computed_at)
  VALUES
    (p_user_id, p_date, v_first_login, v_last_logout, v_sessions, v_effective_seconds, v_att_val, v_att_status, NOW())
  ON DUPLICATE KEY UPDATE
    first_login = VALUES(first_login),
    last_logout = VALUES(last_logout),
    login_sessions = VALUES(login_sessions),
    effective_seconds = VALUES(effective_seconds),
    attendance_value = VALUES(attendance_value),
    attendance_status = VALUES(attendance_status),
    computed_at = NOW(),
    updated_at = NOW();

END proc $$
DELIMITER ;

-- 3) Procedure: compute attendance for all eligible users for a given date
DROP PROCEDURE IF EXISTS `sp_compute_daily_attendance`;
DELIMITER $$
CREATE PROCEDURE `sp_compute_daily_attendance`(IN p_date DATE)
BEGIN
  DECLARE done INT DEFAULT 0;
  DECLARE v_user_id INT;
  DECLARE cur CURSOR FOR
    SELECT id FROM users 
     WHERE status = 'active' AND role IN ('Telesale','Supervisor Telesale');
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

  OPEN cur;
  read_loop: LOOP
    FETCH cur INTO v_user_id;
    IF done = 1 THEN LEAVE read_loop; END IF;
    CALL sp_upsert_user_daily_attendance(v_user_id, p_date);
  END LOOP;
  CLOSE cur;
END $$
DELIMITER ;

-- 4) Convenience procedure: fill a date range (inclusive)
DROP PROCEDURE IF EXISTS `sp_fill_attendance_for_range`;
DELIMITER $$
CREATE PROCEDURE `sp_fill_attendance_for_range`(IN p_start DATE, IN p_end DATE)
BEGIN
  DECLARE d DATE;
  SET d = p_start;
  WHILE d <= p_end DO
    CALL sp_compute_daily_attendance(d);
    SET d = DATE_ADD(d, INTERVAL 1 DAY);
  END WHILE;
END $$
DELIMITER ;

-- 5) Triggers to keep attendance up-to-date when login history changes
-- Note: Triggers will update the record for the login day only
DROP TRIGGER IF EXISTS `trg_login_history_ai`;
DELIMITER $$
CREATE TRIGGER `trg_login_history_ai` AFTER INSERT ON `user_login_history`
FOR EACH ROW
BEGIN
  CALL sp_upsert_user_daily_attendance(NEW.user_id, DATE(NEW.login_time));
END $$
DELIMITER ;

DROP TRIGGER IF EXISTS `trg_login_history_au`;
DELIMITER $$
CREATE TRIGGER `trg_login_history_au` AFTER UPDATE ON `user_login_history`
FOR EACH ROW
BEGIN
  -- Recompute for both old and new dates just in case
  CALL sp_upsert_user_daily_attendance(NEW.user_id, DATE(NEW.login_time));
  IF DATE(OLD.login_time) <> DATE(NEW.login_time) THEN
    CALL sp_upsert_user_daily_attendance(NEW.user_id, DATE(OLD.login_time));
  END IF;
END $$
DELIMITER ;

-- 6) View for easy reporting (telesale roles only)
DROP VIEW IF EXISTS `v_user_daily_attendance`;
CREATE VIEW `v_user_daily_attendance` AS
SELECT 
  a.id,
  a.user_id,
  u.username,
  CONCAT(u.first_name, ' ', u.last_name) AS full_name,
  u.role,
  a.work_date,
  a.first_login,
  a.last_logout,
  a.login_sessions,
  a.effective_seconds,
  ROUND(a.effective_seconds/3600, 2) AS effective_hours,
  a.percent_of_workday,
  a.attendance_value,
  a.attendance_status,
  a.computed_at,
  a.updated_at
FROM user_daily_attendance a
JOIN users u ON u.id = a.user_id
WHERE u.role IN ('Telesale','Supervisor Telesale');

-- 7) View with daily call minutes (for per-day KPI and later averaging)
DROP VIEW IF EXISTS `v_user_daily_kpis`;
CREATE VIEW `v_user_daily_kpis` AS
SELECT 
  a.user_id,
  u.username,
  CONCAT(u.first_name, ' ', u.last_name) AS full_name,
  u.role,
  a.work_date,
  a.attendance_value,
  a.attendance_status,
  a.effective_seconds,
  ROUND(COALESCE(SUM(ch.duration), 0) / 60, 2) AS call_minutes
FROM user_daily_attendance a
JOIN users u ON u.id = a.user_id
LEFT JOIN call_history ch
  ON DATE(ch.`date`) = a.work_date
 AND ch.caller = CONCAT(u.first_name, ' ', u.last_name)
WHERE u.role IN ('Telesale','Supervisor Telesale')
GROUP BY a.id;
