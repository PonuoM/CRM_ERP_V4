-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Jan 28, 2026 at 07:52 AM
-- Server version: 10.6.19-MariaDB
-- PHP Version: 8.0.30

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `primacom_mini_erp`
--

-- --------------------------------------------------------

--
-- Table structure for table `activities`
--

CREATE TABLE `activities` (
  `id` bigint(20) NOT NULL,
  `customer_id` int(11) DEFAULT NULL,
  `timestamp` datetime DEFAULT NULL,
  `type` varchar(64) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `actor_name` varchar(128) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `address_districts`
--

CREATE TABLE `address_districts` (
  `id` int(11) NOT NULL,
  `name_th` varchar(255) DEFAULT NULL,
  `name_en` varchar(255) DEFAULT NULL,
  `province_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `address_geographies`
--

CREATE TABLE `address_geographies` (
  `id` int(11) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `address_provinces`
--

CREATE TABLE `address_provinces` (
  `id` int(11) NOT NULL,
  `name_th` varchar(255) DEFAULT NULL,
  `name_en` varchar(255) DEFAULT NULL,
  `geography_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `address_sub_districts`
--

CREATE TABLE `address_sub_districts` (
  `id` int(11) NOT NULL,
  `zip_code` varchar(10) DEFAULT NULL,
  `name_th` varchar(255) DEFAULT NULL,
  `name_en` varchar(255) DEFAULT NULL,
  `district_id` int(11) DEFAULT NULL,
  `lat` decimal(10,8) DEFAULT NULL,
  `long` decimal(11,8) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `ad_spend`
--

CREATE TABLE `ad_spend` (
  `id` int(11) NOT NULL,
  `page_id` int(11) DEFAULT NULL,
  `spend_date` date DEFAULT NULL,
  `amount` decimal(12,2) DEFAULT NULL,
  `notes` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `appointments`
--

CREATE TABLE `appointments` (
  `id` int(11) NOT NULL,
  `customer_id` int(11) DEFAULT NULL,
  `customer_ref_id` varchar(64) DEFAULT NULL,
  `date` datetime DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `status` varchar(64) DEFAULT NULL,
  `notes` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `bank_account`
--

CREATE TABLE `bank_account` (
  `id` int(11) NOT NULL,
  `company_id` int(11) DEFAULT NULL,
  `bank` varchar(100) DEFAULT NULL,
  `bank_number` varchar(50) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `basket_config`
--

CREATE TABLE `basket_config` (
  `id` int(11) NOT NULL,
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
  `blocked_target_baskets` text DEFAULT NULL COMMENT 'Comma-separated basket_keys ที่ห้ามย้ายไป เช่น "waiting_for_match,find_new_owner"'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `basket_return_config`
--

CREATE TABLE `basket_return_config` (
  `id` int(11) NOT NULL,
  `config_key` varchar(50) NOT NULL,
  `config_value` varchar(255) NOT NULL,
  `description` varchar(500) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `company_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `basket_return_log`
--

CREATE TABLE `basket_return_log` (
  `id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `previous_assigned_to` int(11) DEFAULT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `days_since_last_order` int(11) DEFAULT NULL,
  `batch_date` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `basket_transition_log`
--

CREATE TABLE `basket_transition_log` (
  `id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `from_basket_key` varchar(50) DEFAULT NULL COMMENT 'ถังต้นทาง',
  `to_basket_key` varchar(50) NOT NULL COMMENT 'ถังปลายทาง',
  `transition_type` enum('sale','fail','monthly_cron','manual','redistribute') NOT NULL,
  `triggered_by` int(11) DEFAULT NULL COMMENT 'user_id ที่ทำให้เกิด',
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Log การย้ายถังของลูกค้า';

-- --------------------------------------------------------

--
-- Table structure for table `call_history`
--

CREATE TABLE `call_history` (
  `id` int(11) NOT NULL,
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

-- --------------------------------------------------------

--
-- Table structure for table `cod_documents`
--

CREATE TABLE `cod_documents` (
  `id` int(11) NOT NULL,
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
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `cod_records`
--

CREATE TABLE `cod_records` (
  `id` int(11) NOT NULL,
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
  `order_amount` decimal(12,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `commission_order_lines`
--

CREATE TABLE `commission_order_lines` (
  `id` int(11) NOT NULL,
  `record_id` int(11) DEFAULT NULL,
  `order_id` varchar(32) DEFAULT NULL,
  `order_date` date DEFAULT NULL,
  `confirmed_at` datetime DEFAULT NULL,
  `order_amount` decimal(12,2) DEFAULT NULL,
  `commission_amount` decimal(12,2) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `commission_periods`
--

CREATE TABLE `commission_periods` (
  `id` int(11) NOT NULL,
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
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `commission_records`
--

CREATE TABLE `commission_records` (
  `id` int(11) NOT NULL,
  `period_id` int(11) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `total_sales` decimal(12,2) DEFAULT NULL,
  `commission_rate` decimal(5,2) DEFAULT NULL,
  `commission_amount` decimal(12,2) DEFAULT NULL,
  `order_count` int(11) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `companies`
--

CREATE TABLE `companies` (
  `id` int(11) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `phone` varchar(64) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `tax_id` varchar(32) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customers`
--

CREATE TABLE `customers` (
  `customer_id` int(11) NOT NULL,
  `customer_ref_id` varchar(64) DEFAULT NULL,
  `first_name` varchar(128) DEFAULT NULL,
  `last_name` varchar(128) DEFAULT NULL,
  `phone` varchar(64) DEFAULT NULL,
  `backup_phone` varchar(64) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `province` varchar(128) DEFAULT NULL,
  `company_id` int(11) DEFAULT NULL,
  `assigned_to` int(11) DEFAULT NULL,
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
  `basket_entered_date` datetime DEFAULT NULL COMMENT 'วันที่เข้าถังปัจจุบัน'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Triggers `customers`
--
DELIMITER $$
CREATE TRIGGER `customer_after_insert` AFTER INSERT ON `customers` FOR EACH ROW BEGIN
    INSERT INTO customer_logs (
        customer_id,
        bucket_type,
        lifecycle_status,
        assigned_to,
        action_type,
        new_values,
        changed_fields,
        created_by
    ) VALUES (
        NEW.customer_id,
        NEW.bucket_type,
        NEW.lifecycle_status,
        NEW.assigned_to,
        'create',
        JSON_OBJECT(
            'bucket_type', NEW.bucket_type,
            'lifecycle_status', NEW.lifecycle_status,
            'assigned_to', NEW.assigned_to,
            'first_name', NEW.first_name,
            'last_name', NEW.last_name,
            'email', NEW.email
        ),
        JSON_ARRAY('bucket_type', 'lifecycle_status', 'assigned_to'),
        NEW.assigned_to
    );
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `customer_after_update` AFTER UPDATE ON `customers` FOR EACH ROW BEGIN
    DECLARE has_changes BOOLEAN DEFAULT FALSE;
    DECLARE changed_fields_json JSON;

    -- เช็คว่ามีการเปลี่ยนแปลงฟิลด์ที่สนใจหรือไม่
    SET has_changes = (
        OLD.bucket_type <> NEW.bucket_type OR
        OLD.lifecycle_status <> NEW.lifecycle_status OR
        OLD.assigned_to <> NEW.assigned_to
    );

    IF has_changes THEN
        INSERT INTO customer_logs (
            customer_id,
            bucket_type,
            lifecycle_status,
            assigned_to,
            action_type,
            old_values,
            new_values,
            changed_fields,
            created_by
        ) VALUES (
            NEW.customer_id,
            NEW.bucket_type,
            NEW.lifecycle_status,
            NEW.assigned_to,
            'update',
            JSON_OBJECT(
                'bucket_type', OLD.bucket_type,
                'lifecycle_status', OLD.lifecycle_status,
                'assigned_to', OLD.assigned_to
            ),
            JSON_OBJECT(
                'bucket_type', NEW.bucket_type,
                'lifecycle_status', NEW.lifecycle_status,
                'assigned_to', NEW.assigned_to
            ),
            JSON_ARRAY(
    CASE WHEN NOT (OLD.bucket_type <=> NEW.bucket_type) THEN 'bucket_type' END,
    CASE WHEN NOT (OLD.lifecycle_status <=> NEW.lifecycle_status) THEN 'lifecycle_status' END,
    CASE WHEN NOT (OLD.assigned_to <=> NEW.assigned_to) THEN 'assigned_to' END
),
            NEW.assigned_to
        );
    END IF;
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `customer_before_delete` BEFORE DELETE ON `customers` FOR EACH ROW BEGIN
    INSERT INTO customer_logs (
        customer_id,
        bucket_type,
        lifecycle_status,
        assigned_to,
        action_type,
        old_values,
        new_values,
        changed_fields,
        created_by
    ) VALUES (
        OLD.customer_id,
        OLD.bucket_type,
        OLD.lifecycle_status,
        OLD.assigned_to,
        'delete',
        JSON_OBJECT(
            'bucket_type', OLD.bucket_type,
            'lifecycle_status', OLD.lifecycle_status,
            'assigned_to', OLD.assigned_to,
            'first_name', OLD.first_name,
            'last_name', OLD.last_name,
            'email', OLD.email
        ),
        NULL,
        JSON_ARRAY('bucket_type', 'lifecycle_status', 'assigned_to'),
        OLD.assigned_to
    );
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `customer_address`
--

CREATE TABLE `customer_address` (
  `id` int(11) NOT NULL,
  `customer_id` varchar(255) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `recipient_first_name` varchar(128) DEFAULT NULL,
  `recipient_last_name` varchar(128) DEFAULT NULL,
  `province` varchar(100) DEFAULT NULL,
  `district` varchar(100) DEFAULT NULL,
  `sub_district` varchar(100) DEFAULT NULL,
  `zip_code` varchar(10) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customer_assignment_history`
--

CREATE TABLE `customer_assignment_history` (
  `id` bigint(20) NOT NULL,
  `customer_id` int(11) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `assigned_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customer_blocks`
--

CREATE TABLE `customer_blocks` (
  `id` int(11) NOT NULL,
  `customer_id` varchar(64) DEFAULT NULL,
  `reason` text DEFAULT NULL,
  `blocked_by` int(11) DEFAULT NULL,
  `blocked_at` datetime DEFAULT NULL,
  `unblocked_by` int(11) DEFAULT NULL,
  `unblocked_at` datetime DEFAULT NULL,
  `active` tinyint(1) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customer_logs`
--

CREATE TABLE `customer_logs` (
  `id` int(11) NOT NULL,
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

-- --------------------------------------------------------

--
-- Table structure for table `customer_tags`
--

CREATE TABLE `customer_tags` (
  `customer_id` varchar(64) DEFAULT NULL,
  `tag_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `debt_collection`
--

CREATE TABLE `debt_collection` (
  `id` int(11) NOT NULL,
  `order_id` varchar(50) NOT NULL COMMENT 'Reference to orders table',
  `user_id` int(11) NOT NULL COMMENT 'User who performed the collection',
  `amount_collected` decimal(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Amount collected in this attempt',
  `result_status` tinyint(1) NOT NULL COMMENT '1=Unable to Collect, 2=Collected Some, 3=Collected All',
  `is_complete` tinyint(1) NOT NULL DEFAULT 0 COMMENT '0=Ongoing, 1=Case Closed',
  `note` text DEFAULT NULL COMMENT 'Notes about the collection attempt',
  `slip_id` int(11) DEFAULT NULL COMMENT 'Reference to order_slips table if payment slip was uploaded',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Debt collection tracking table';

-- --------------------------------------------------------

--
-- Table structure for table `env`
--

CREATE TABLE `env` (
  `id` int(11) NOT NULL,
  `key` varchar(255) DEFAULT NULL,
  `value` text DEFAULT NULL,
  `company_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `exports`
--

CREATE TABLE `exports` (
  `id` int(11) NOT NULL,
  `filename` varchar(255) DEFAULT NULL,
  `file_path` varchar(1024) DEFAULT NULL,
  `orders_count` int(11) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `company_id` int(11) DEFAULT NULL,
  `exported_by` varchar(128) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `download_count` int(11) DEFAULT 0,
  `category` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `google_sheet_shipping`
--

CREATE TABLE `google_sheet_shipping` (
  `id` int(11) NOT NULL,
  `system_created_time` datetime DEFAULT NULL,
  `order_number` varchar(128) DEFAULT NULL,
  `order_status` varchar(50) DEFAULT NULL COMMENT 'สถานะคำสั่งซื้อ (Official)',
  `delivery_date` date DEFAULT NULL,
  `delivery_status` varchar(100) DEFAULT NULL,
  `imported_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `marketing_ads_log`
--

CREATE TABLE `marketing_ads_log` (
  `id` int(11) NOT NULL,
  `page_id` int(11) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `date` date DEFAULT NULL,
  `ads_cost` int(11) DEFAULT NULL,
  `impressions` int(11) DEFAULT NULL,
  `reach` int(11) DEFAULT NULL,
  `clicks` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `marketing_product_ads_log`
--

CREATE TABLE `marketing_product_ads_log` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `product_id` int(11) DEFAULT NULL,
  `date` date DEFAULT NULL,
  `ads_cost` decimal(10,2) DEFAULT NULL,
  `impressions` int(11) DEFAULT NULL,
  `reach` int(11) DEFAULT NULL,
  `clicks` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `marketing_user_page`
--

CREATE TABLE `marketing_user_page` (
  `id` int(11) NOT NULL,
  `page_id` int(11) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `marketing_user_product`
--

CREATE TABLE `marketing_user_product` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `product_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
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
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notification_read_status`
--

CREATE TABLE `notification_read_status` (
  `id` int(11) NOT NULL,
  `notification_id` varchar(50) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `read_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notification_roles`
--

CREATE TABLE `notification_roles` (
  `id` int(11) NOT NULL,
  `notification_id` varchar(50) DEFAULT NULL,
  `role` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notification_settings`
--

CREATE TABLE `notification_settings` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `notification_type` varchar(50) DEFAULT NULL,
  `in_app_enabled` tinyint(1) DEFAULT NULL,
  `email_enabled` tinyint(1) DEFAULT NULL,
  `sms_enabled` tinyint(1) DEFAULT NULL,
  `business_hours_only` tinyint(1) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notification_users`
--

CREATE TABLE `notification_users` (
  `id` int(11) NOT NULL,
  `notification_id` varchar(50) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `onecall_batch`
--

CREATE TABLE `onecall_batch` (
  `id` int(11) NOT NULL,
  `company_id` int(11) NOT NULL DEFAULT 1,
  `startdate` date DEFAULT NULL,
  `enddate` date DEFAULT NULL,
  `amount_record` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `onecall_log`
--

CREATE TABLE `onecall_log` (
  `id` int(11) NOT NULL,
  `timestamp` timestamp NULL DEFAULT NULL,
  `duration` int(11) DEFAULT NULL,
  `localParty` varchar(255) DEFAULT NULL,
  `remoteParty` varchar(255) DEFAULT NULL,
  `direction` varchar(10) DEFAULT NULL,
  `phone_telesale` varchar(255) DEFAULT NULL,
  `batch_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `orders`
--

CREATE TABLE `orders` (
  `id` varchar(32) NOT NULL,
  `customer_id` int(11) DEFAULT NULL,
  `company_id` int(11) DEFAULT NULL,
  `creator_id` int(11) DEFAULT NULL,
  `order_date` datetime DEFAULT NULL,
  `delivery_date` datetime DEFAULT NULL,
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
  `basket_key_at_sale` varchar(50) DEFAULT NULL COMMENT 'ถังที่ลูกค้าอยู่ตอนสร้าง order (สำหรับคำนวณ commission)'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `order_boxes`
--

CREATE TABLE `order_boxes` (
  `id` int(11) NOT NULL,
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

--
-- Triggers `order_boxes`
--
DELIMITER $$
CREATE TRIGGER `trg_order_boxes_bi_enforce` BEFORE INSERT ON `order_boxes` FOR EACH ROW BEGIN
    DECLARE v_order_payment ENUM('COD','Transfer','PayAfter');

    -- Get order payment method
    SELECT NULLIF(payment_method, '')
    INTO v_order_payment
    FROM orders
    WHERE id = NEW.order_id;

    IF v_order_payment IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: order not found or payment method missing';
    END IF;

    -- Set defaults (DO NOT override collection_amount!)
    SET NEW.payment_method = COALESCE(NULLIF(NEW.payment_method, ''), v_order_payment, 'COD');
    SET NEW.status = COALESCE(NEW.status, 'PENDING');
    SET NEW.sub_order_id = CONCAT(NEW.order_id, '-', NEW.box_number);
    SET NEW.collection_amount = COALESCE(NEW.collection_amount, COALESCE(NEW.cod_amount, 0));
    SET NEW.collected_amount = COALESCE(NEW.collected_amount, 0);
    SET NEW.waived_amount = COALESCE(NEW.waived_amount, 0);

    -- Basic validations only
    IF NEW.collection_amount < 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: collection_amount cannot be negative';
    END IF;
    IF NEW.waived_amount < 0 OR NEW.collected_amount < 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: collected/waived amounts cannot be negative';
    END IF;
    IF NEW.collected_amount + NEW.waived_amount > NEW.collection_amount THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: collected + waived exceeds collection_amount';
    END IF;

    -- REMOVED: box totals validation (allow flexible totals)
    -- REMOVED: single-box restriction for non-COD
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `trg_order_boxes_bu_enforce` BEFORE UPDATE ON `order_boxes` FOR EACH ROW BEGIN
    DECLARE v_order_payment ENUM('COD','Transfer','PayAfter');
    DECLARE v_effective_payment ENUM('COD','Transfer','PayAfter');

    -- Get order payment method
    SELECT NULLIF(payment_method, '')
    INTO v_order_payment
    FROM orders
    WHERE id = NEW.order_id;

    IF v_order_payment IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: order not found or payment method missing';
    END IF;

    -- Set defaults (DO NOT override collection_amount!)
    SET v_effective_payment = COALESCE(NULLIF(NEW.payment_method, ''), NULLIF(OLD.payment_method, ''), v_order_payment, 'COD');
    SET NEW.payment_method = v_effective_payment;
    SET NEW.status = COALESCE(NEW.status, OLD.status, 'PENDING');
    SET NEW.sub_order_id = CONCAT(NEW.order_id, '-', NEW.box_number);
    SET NEW.collection_amount = COALESCE(NEW.collection_amount, OLD.collection_amount, 0);
    SET NEW.collected_amount = COALESCE(NEW.collected_amount, OLD.collected_amount, 0);
    SET NEW.waived_amount = COALESCE(NEW.waived_amount, OLD.waived_amount, 0);

    -- Basic validations only
    IF NEW.collection_amount < 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: collection_amount cannot be negative';
    END IF;
    IF NEW.waived_amount < 0 OR NEW.collected_amount < 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: collected/waived amounts cannot be negative';
    END IF;
    IF NEW.collected_amount + NEW.waived_amount > NEW.collection_amount THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: collected + waived exceeds collection_amount';
    END IF;

    -- Prevent changes after shipping
    IF NEW.collection_amount <> OLD.collection_amount AND OLD.status NOT IN ('PENDING','PREPARING') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: cannot change collection_amount after shipping';
    END IF;
    IF NEW.payment_method <> OLD.payment_method AND OLD.status NOT IN ('PENDING','PREPARING') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: cannot change payment_method after shipping';
    END IF;

    -- REMOVED: box totals validation (allow flexible totals)
    -- REMOVED: single-box restriction for non-COD
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `order_box_collection_logs`
--

CREATE TABLE `order_box_collection_logs` (
  `id` int(11) NOT NULL,
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
  `created_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `order_items`
--

CREATE TABLE `order_items` (
  `id` int(11) NOT NULL,
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
  `is_promotion_parent` tinyint(1) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `order_item_allocations`
--

CREATE TABLE `order_item_allocations` (
  `id` int(11) NOT NULL,
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
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `order_returns`
--

CREATE TABLE `order_returns` (
  `id` int(11) NOT NULL,
  `sub_order_id` varchar(255) NOT NULL COMMENT 'รหัสคำสั่งซื้อย่อย (Main Key)',
  `return_amount` decimal(10,2) NOT NULL DEFAULT 0.00,
  `status` varchar(50) NOT NULL DEFAULT 'returned' COMMENT 'สถานะ: returned, delivered',
  `note` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `order_sequences`
--

CREATE TABLE `order_sequences` (
  `id` int(11) NOT NULL,
  `company_id` int(11) DEFAULT NULL,
  `period` varchar(255) DEFAULT NULL,
  `prefix` varchar(8) DEFAULT NULL,
  `last_sequence` int(11) DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `order_slips`
--

CREATE TABLE `order_slips` (
  `id` int(11) NOT NULL,
  `amount` decimal(12,2) DEFAULT NULL,
  `bank_account_id` int(11) DEFAULT NULL,
  `transfer_date` datetime DEFAULT NULL,
  `order_id` varchar(32) DEFAULT NULL,
  `url` varchar(1024) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL,
  `upload_by` int(11) DEFAULT NULL,
  `upload_by_name` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `order_status_logs`
--

CREATE TABLE `order_status_logs` (
  `id` int(11) NOT NULL,
  `order_id` varchar(32) DEFAULT NULL,
  `previous_status` varchar(50) DEFAULT NULL,
  `new_status` varchar(50) DEFAULT NULL,
  `previous_tracking` varchar(100) DEFAULT NULL,
  `new_tracking` varchar(100) DEFAULT NULL,
  `changed_at` datetime DEFAULT NULL,
  `trigger_type` varchar(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `order_tab_rules`
--

CREATE TABLE `order_tab_rules` (
  `id` int(11) NOT NULL,
  `tab_key` varchar(50) NOT NULL COMMENT 'The tab identifier (e.g., unpaid, pending)',
  `payment_method` varchar(50) DEFAULT NULL COMMENT 'Payment method filter value',
  `payment_status` varchar(50) DEFAULT NULL COMMENT 'Payment status filter value',
  `order_status` varchar(50) DEFAULT NULL COMMENT 'Order status filter value',
  `description` text DEFAULT NULL,
  `company_id` int(11) NOT NULL DEFAULT 0,
  `display_order` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `order_tracking_numbers`
--

CREATE TABLE `order_tracking_numbers` (
  `id` int(11) NOT NULL,
  `order_id` varchar(32) DEFAULT NULL,
  `parent_order_id` varchar(32) DEFAULT NULL,
  `box_number` int(11) DEFAULT NULL,
  `tracking_number` varchar(128) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `pages`
--

CREATE TABLE `pages` (
  `id` int(11) NOT NULL,
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
  `sell_product_type` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `page_engagement_batch`
--

CREATE TABLE `page_engagement_batch` (
  `id` int(11) NOT NULL,
  `date_range` varchar(100) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `status` varchar(255) DEFAULT NULL,
  `records_count` int(11) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `page_engagement_log`
--

CREATE TABLE `page_engagement_log` (
  `id` int(11) NOT NULL,
  `batch_id` int(11) DEFAULT NULL,
  `page_id` varchar(50) DEFAULT NULL,
  `date` date DEFAULT NULL,
  `inbox` int(11) DEFAULT NULL,
  `comment` int(11) DEFAULT NULL,
  `total` int(11) DEFAULT NULL,
  `new_customer_replied` int(11) DEFAULT NULL,
  `customer_engagement_new_inbox` int(11) DEFAULT NULL,
  `order_count` int(11) DEFAULT NULL,
  `old_order_count` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `page_list_user`
--

CREATE TABLE `page_list_user` (
  `id` int(11) NOT NULL,
  `page_id` varchar(255) DEFAULT NULL,
  `page_user_id` varchar(255) DEFAULT NULL,
  `status` varchar(50) DEFAULT NULL,
  `still_in_list` tinyint(1) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `page_stats_batch`
--

CREATE TABLE `page_stats_batch` (
  `id` int(11) NOT NULL,
  `date_range` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `page_stats_log`
--

CREATE TABLE `page_stats_log` (
  `id` int(11) NOT NULL,
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
  `orders_count` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `page_user`
--

CREATE TABLE `page_user` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `page_user_id` varchar(255) DEFAULT NULL,
  `page_user_name` varchar(255) DEFAULT NULL,
  `page_count` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `platforms`
--

CREATE TABLE `platforms` (
  `id` int(11) NOT NULL,
  `name` varchar(64) DEFAULT NULL,
  `display_name` varchar(128) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `company_id` int(11) DEFAULT NULL,
  `active` tinyint(1) DEFAULT NULL,
  `sort_order` int(11) DEFAULT NULL,
  `show_pages_from` varchar(64) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL,
  `role_show` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `products`
--

CREATE TABLE `products` (
  `id` int(11) NOT NULL,
  `sku` varchar(64) DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `category` varchar(128) DEFAULT NULL,
  `report_category` varchar(128) DEFAULT NULL,
  `unit` varchar(32) DEFAULT NULL,
  `cost` decimal(12,2) DEFAULT NULL,
  `price` decimal(12,2) DEFAULT NULL,
  `stock` int(11) DEFAULT NULL,
  `company_id` int(11) DEFAULT NULL,
  `shop` varchar(128) DEFAULT NULL,
  `status` varchar(255) DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `product_lots`
--

CREATE TABLE `product_lots` (
  `id` int(11) NOT NULL,
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
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `promotions`
--

CREATE TABLE `promotions` (
  `id` int(11) NOT NULL,
  `sku` varchar(64) DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `company_id` int(11) DEFAULT NULL,
  `active` tinyint(1) DEFAULT NULL,
  `start_date` datetime DEFAULT NULL,
  `end_date` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `promotion_items`
--

CREATE TABLE `promotion_items` (
  `id` int(11) NOT NULL,
  `promotion_id` int(11) DEFAULT NULL,
  `product_id` int(11) DEFAULT NULL,
  `quantity` int(11) DEFAULT NULL,
  `is_freebie` tinyint(1) DEFAULT NULL,
  `price_override` decimal(12,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `roles`
--

CREATE TABLE `roles` (
  `id` int(11) NOT NULL,
  `code` varchar(64) DEFAULT NULL,
  `name` varchar(128) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT NULL,
  `is_system` tinyint(1) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `role_permissions`
--

CREATE TABLE `role_permissions` (
  `role` varchar(64) NOT NULL,
  `data` text DEFAULT NULL,
  `description` text DEFAULT NULL,
  `updated_by` int(11) DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `sales_targets`
--

CREATE TABLE `sales_targets` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `month` tinyint(4) NOT NULL COMMENT '1-12',
  `year` int(11) NOT NULL COMMENT 'e.g. 2026',
  `target_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `statement_batchs`
--

CREATE TABLE `statement_batchs` (
  `id` int(11) NOT NULL,
  `company_id` int(11) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL,
  `row_count` int(11) DEFAULT NULL,
  `transfer_min` datetime DEFAULT NULL,
  `transfer_max` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `statement_logs`
--

CREATE TABLE `statement_logs` (
  `id` int(11) NOT NULL,
  `batch_id` int(11) DEFAULT NULL,
  `transfer_at` datetime DEFAULT NULL,
  `amount` decimal(12,2) DEFAULT NULL,
  `channel` varchar(64) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `bank_account_id` int(11) DEFAULT NULL,
  `bank_display_name` varchar(150) DEFAULT NULL,
  `statement_reconcile_logs` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `statement_reconcile_batches`
--

CREATE TABLE `statement_reconcile_batches` (
  `id` int(11) NOT NULL,
  `document_no` varchar(120) DEFAULT NULL,
  `bank_account_id` int(11) DEFAULT NULL,
  `bank_display_name` varchar(150) DEFAULT NULL,
  `company_id` int(11) DEFAULT NULL,
  `start_date` datetime DEFAULT NULL,
  `end_date` datetime DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `notes` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `statement_reconcile_logs`
--

CREATE TABLE `statement_reconcile_logs` (
  `id` int(11) NOT NULL,
  `batch_id` int(11) DEFAULT NULL,
  `statement_log_id` int(11) DEFAULT NULL,
  `order_id` varchar(32) DEFAULT NULL,
  `statement_amount` decimal(12,2) DEFAULT NULL,
  `confirmed_amount` decimal(12,2) DEFAULT NULL,
  `auto_matched` tinyint(1) DEFAULT NULL,
  `note` text DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `reconcile_type` varchar(20) DEFAULT NULL,
  `confirmed_at` datetime DEFAULT NULL,
  `confirmed_order_id` varchar(100) DEFAULT NULL,
  `confirmed_order_amount` decimal(10,2) DEFAULT NULL,
  `confirmed_payment_method` varchar(50) DEFAULT NULL,
  `confirmed_action` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `stock_movements`
--

CREATE TABLE `stock_movements` (
  `id` int(11) NOT NULL,
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
  `document_number` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `stock_reservations`
--

CREATE TABLE `stock_reservations` (
  `id` int(11) NOT NULL,
  `warehouse_id` int(11) DEFAULT NULL,
  `product_id` int(11) DEFAULT NULL,
  `order_id` varchar(32) DEFAULT NULL,
  `quantity` int(11) DEFAULT NULL,
  `lot_number` varchar(128) DEFAULT NULL,
  `reserved_at` datetime DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `status` varchar(255) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `stock_transactions`
--

CREATE TABLE `stock_transactions` (
  `id` int(11) NOT NULL,
  `document_number` varchar(50) DEFAULT NULL,
  `type` varchar(255) DEFAULT NULL,
  `transaction_date` datetime DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `stock_transaction_images`
--

CREATE TABLE `stock_transaction_images` (
  `id` int(11) NOT NULL,
  `transaction_id` int(11) DEFAULT NULL,
  `image_path` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `stock_transaction_items`
--

CREATE TABLE `stock_transaction_items` (
  `id` int(11) NOT NULL,
  `transaction_id` int(11) DEFAULT NULL,
  `product_id` int(11) DEFAULT NULL,
  `warehouse_id` int(11) DEFAULT NULL,
  `lot_id` int(11) DEFAULT NULL,
  `quantity` decimal(10,2) DEFAULT NULL,
  `adjustment_type` varchar(255) DEFAULT NULL,
  `remarks` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tags`
--

CREATE TABLE `tags` (
  `id` int(11) NOT NULL,
  `name` varchar(128) DEFAULT NULL,
  `type` varchar(255) DEFAULT NULL,
  `color` varchar(20) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `upsell_round_robin`
--

CREATE TABLE `upsell_round_robin` (
  `id` int(11) NOT NULL,
  `company_id` int(11) NOT NULL DEFAULT 1,
  `last_assigned_user_id` int(11) DEFAULT NULL,
  `last_assigned_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Track Round-Robin position for Upsell auto-assignment';

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
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
  `role_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user_daily_attendance`
--

CREATE TABLE `user_daily_attendance` (
  `id` bigint(20) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `work_date` date DEFAULT NULL,
  `first_login` datetime DEFAULT NULL,
  `last_logout` datetime DEFAULT NULL,
  `login_sessions` int(11) DEFAULT NULL,
  `effective_seconds` int(11) DEFAULT NULL,
  `percent_of_workday` decimal(5,2) DEFAULT NULL,
  `attendance_value` decimal(3,1) DEFAULT NULL,
  `attendance_status` varchar(255) DEFAULT NULL,
  `computed_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user_login_history`
--

CREATE TABLE `user_login_history` (
  `id` bigint(20) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `login_time` datetime DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `logout_time` datetime DEFAULT NULL,
  `last_activity` datetime DEFAULT NULL,
  `session_duration` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user_pancake_mapping`
--

CREATE TABLE `user_pancake_mapping` (
  `id` int(11) NOT NULL,
  `id_user` int(11) DEFAULT NULL,
  `id_panake` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user_permission_overrides`
--

CREATE TABLE `user_permission_overrides` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `permission_key` varchar(128) DEFAULT NULL,
  `permission_value` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`permission_value`)),
  `notes` text DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user_tags`
--

CREATE TABLE `user_tags` (
  `user_id` int(11) DEFAULT NULL,
  `tag_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user_tokens`
--

CREATE TABLE `user_tokens` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `token` varchar(64) NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `v_customer_buckets`
--

CREATE ALGORITHM=UNDEFINED DEFINER=`primacom_bloguser`@`localhost` SQL SECURITY DEFINER VIEW `v_customer_buckets`  AS SELECT `c`.`id` AS `id`, `c`.`first_name` AS `first_name`, `c`.`last_name` AS `last_name`, `c`.`phone` AS `phone`, `c`.`email` AS `email`, `c`.`province` AS `province`, `c`.`company_id` AS `company_id`, `c`.`assigned_to` AS `assigned_to`, `c`.`date_assigned` AS `date_assigned`, `c`.`date_registered` AS `date_registered`, `c`.`follow_up_date` AS `follow_up_date`, `c`.`ownership_expires` AS `ownership_expires`, `c`.`lifecycle_status` AS `lifecycle_status`, `c`.`behavioral_status` AS `behavioral_status`, `c`.`grade` AS `grade`, `c`.`total_purchases` AS `total_purchases`, `c`.`total_calls` AS `total_calls`, `c`.`facebook_name` AS `facebook_name`, `c`.`line_id` AS `line_id`, `c`.`street` AS `street`, `c`.`subdistrict` AS `subdistrict`, `c`.`district` AS `district`, `c`.`postal_code` AS `postal_code`, `c`.`has_sold_before` AS `has_sold_before`, `c`.`follow_up_count` AS `follow_up_count`, `c`.`last_follow_up_date` AS `last_follow_up_date`, `c`.`last_sale_date` AS `last_sale_date`, `c`.`is_in_waiting_basket` AS `is_in_waiting_basket`, `c`.`waiting_basket_start_date` AS `waiting_basket_start_date`, `c`.`followup_bonus_remaining` AS `followup_bonus_remaining`, `c`.`is_blocked` AS `is_blocked`, `c`.`first_order_date` AS `first_order_date`, `c`.`last_order_date` AS `last_order_date`, `c`.`order_count` AS `order_count`, `c`.`is_new_customer` AS `is_new_customer`, `c`.`is_repeat_customer` AS `is_repeat_customer`, CASE WHEN coalesce(`c`.`is_blocked`,0) = 1 THEN 'blocked' WHEN coalesce(`c`.`is_in_waiting_basket`,0) = 1 THEN 'waiting' WHEN `c`.`assigned_to` is null THEN 'ready' ELSE 'assigned' END AS `bucket` FROM `customers` AS `c` ;

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_order_required_stock`
-- (See below for the actual view)
--
CREATE TABLE `v_order_required_stock` (
`order_id` varchar(32)
,`product_id` int(11)
,`required_qty` decimal(32,0)
,`allocated_qty` decimal(32,0)
,`free_qty` decimal(32,0)
,`paid_qty` decimal(32,0)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_telesale_call_overview_monthly`
-- (See below for the actual view)
--
CREATE TABLE `v_telesale_call_overview_monthly` (
`month_key` varchar(7)
,`user_id` int(11)
,`first_name` varchar(128)
,`role` varchar(64)
,`phone` longtext
,`working_days` decimal(25,1)
,`total_minutes` decimal(35,2)
,`connected_calls` decimal(22,0)
,`total_calls` bigint(21)
,`minutes_per_workday` decimal(37,2)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_user_daily_attendance`
-- (See below for the actual view)
--
CREATE TABLE `v_user_daily_attendance` (
`id` bigint(20)
,`user_id` int(11)
,`username` varchar(64)
,`full_name` varchar(257)
,`role` varchar(64)
,`work_date` date
,`first_login` datetime
,`last_logout` datetime
,`login_sessions` int(11)
,`effective_seconds` int(11)
,`effective_hours` decimal(13,2)
,`percent_of_workday` decimal(5,2)
,`attendance_value` decimal(3,1)
,`attendance_status` varchar(255)
,`computed_at` datetime
,`updated_at` datetime
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_user_daily_kpis`
-- (See below for the actual view)
--
CREATE TABLE `v_user_daily_kpis` (
`user_id` int(11)
,`username` varchar(64)
,`full_name` varchar(257)
,`role` varchar(64)
,`work_date` date
,`attendance_value` decimal(3,1)
,`attendance_status` varchar(255)
,`effective_seconds` int(11)
,`call_minutes` decimal(35,2)
);

-- --------------------------------------------------------

--
-- Table structure for table `warehouses`
--

CREATE TABLE `warehouses` (
  `id` int(11) NOT NULL,
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
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `warehouse_stocks`
--

CREATE TABLE `warehouse_stocks` (
  `id` int(11) NOT NULL,
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
  `updated_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure for view `v_order_required_stock`
--
DROP TABLE IF EXISTS `v_order_required_stock`;

CREATE ALGORITHM=UNDEFINED DEFINER=`primacom_bloguser`@`localhost` SQL SECURITY DEFINER VIEW `v_order_required_stock`  AS SELECT `a`.`order_id` AS `order_id`, `a`.`product_id` AS `product_id`, sum(`a`.`required_quantity`) AS `required_qty`, sum(`a`.`allocated_quantity`) AS `allocated_qty`, sum(case when `a`.`is_freebie` = 1 then `a`.`required_quantity` else 0 end) AS `free_qty`, sum(case when `a`.`is_freebie` = 0 then `a`.`required_quantity` else 0 end) AS `paid_qty` FROM `order_item_allocations` AS `a` GROUP BY `a`.`order_id`, `a`.`product_id` ;
<div class="alert alert-danger" role="alert"><img src="themes/dot.gif" title="" alt="" class="icon ic_s_error"> RuntimeException: No statement inside WITH</div></body></html>