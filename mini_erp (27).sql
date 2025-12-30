-- phpMyAdmin SQL Dump
-- version 4.9.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Dec 26, 2025 at 08:30 AM
-- Server version: 8.0.17
-- PHP Version: 7.3.10

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `mini_erp`
--

-- --------------------------------------------------------

--
-- Table structure for table `activities`
--

CREATE TABLE `activities` (
  `id` bigint(20) NOT NULL,
  `customer_id` int(11) DEFAULT NULL,
  `timestamp` datetime NOT NULL,
  `type` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `actor_name` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `address_districts`
--

CREATE TABLE `address_districts` (
  `id` int(11) NOT NULL,
  `name_th` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name_en` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `province_id` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `address_geographies`
--

CREATE TABLE `address_geographies` (
  `id` int(11) NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `address_provinces`
--

CREATE TABLE `address_provinces` (
  `id` int(11) NOT NULL,
  `name_th` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name_en` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `geography_id` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `address_sub_districts`
--

CREATE TABLE `address_sub_districts` (
  `id` int(11) NOT NULL,
  `zip_code` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name_th` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name_en` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
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
  `page_id` int(11) NOT NULL,
  `spend_date` date NOT NULL,
  `amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `notes` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `appointments`
--

CREATE TABLE `appointments` (
  `id` int(11) NOT NULL,
  `customer_id` int(11) DEFAULT NULL,
  `customer_ref_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `date` datetime NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `bank_account`
--

CREATE TABLE `bank_account` (
  `id` int(11) NOT NULL,
  `company_id` int(11) NOT NULL,
  `bank` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bank_number` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `call_history`
--

CREATE TABLE `call_history` (
  `id` int(11) NOT NULL,
  `customer_id` int(11) DEFAULT NULL,
  `date` datetime NOT NULL,
  `caller` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `result` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `crop_type` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `area_size` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `duration` decimal(12,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `cod_documents`
--

CREATE TABLE `cod_documents` (
  `id` int(11) NOT NULL,
  `document_number` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `document_datetime` datetime NOT NULL,
  `bank_account_id` int(11) DEFAULT NULL,
  `matched_statement_log_id` int(11) DEFAULT NULL,
  `company_id` int(11) NOT NULL,
  `total_input_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `total_order_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `status` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_by` int(11) DEFAULT NULL,
  `verified_by` int(11) DEFAULT NULL,
  `verified_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `cod_records`
--

CREATE TABLE `cod_records` (
  `id` int(11) NOT NULL,
  `document_id` int(11) DEFAULT NULL,
  `tracking_number` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `order_id` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `delivery_start_date` date DEFAULT NULL,
  `delivery_end_date` date DEFAULT NULL,
  `cod_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `order_amount` decimal(12,2) DEFAULT '0.00',
  `received_amount` decimal(12,2) DEFAULT '0.00',
  `difference` decimal(12,2) DEFAULT '0.00',
  `status` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `company_id` int(11) NOT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `commission_order_lines`
--

CREATE TABLE `commission_order_lines` (
  `id` int(11) NOT NULL,
  `record_id` int(11) NOT NULL COMMENT 'รหัสบันทึกค่าคอม',
  `order_id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'รหัสออเดอร์',
  `order_date` date NOT NULL COMMENT 'วันที่สร้างออเดอร์',
  `confirmed_at` datetime NOT NULL COMMENT 'วันที่ยืนยันจาก reconcile',
  `order_amount` decimal(12,2) NOT NULL COMMENT 'ยอดออเดอร์',
  `commission_amount` decimal(12,2) NOT NULL COMMENT 'ค่าคอมของออเดอร์นี้',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='รายละเอียดออเดอร์ที่นำมาคิดค่าคอม';

-- --------------------------------------------------------

--
-- Table structure for table `commission_periods`
--

CREATE TABLE `commission_periods` (
  `id` int(11) NOT NULL,
  `company_id` int(11) NOT NULL COMMENT 'บริษัท',
  `period_month` int(11) NOT NULL COMMENT 'เดือนที่คำนวณ (1-12)',
  `period_year` int(11) NOT NULL COMMENT 'ปีที่คำนวณ',
  `order_month` int(11) NOT NULL COMMENT 'เดือนของออเดอร์ที่นำมาคิด (1-12)',
  `order_year` int(11) NOT NULL COMMENT 'ปีของออเดอร์ที่นำมาคิด',
  `cutoff_date` date NOT NULL COMMENT 'วันตัดรอบ (เช่น 2024-12-20)',
  `status` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT 'Draft' COMMENT 'Draft, Calculated, Approved, Paid',
  `total_sales` decimal(14,2) DEFAULT '0.00' COMMENT 'ยอดขายรวมทั้งหมด',
  `total_commission` decimal(14,2) DEFAULT '0.00' COMMENT 'ค่าคอมรวมทั้งหมด',
  `total_orders` int(11) DEFAULT '0' COMMENT 'จำนวนออเดอร์ทั้งหมด',
  `calculated_at` datetime DEFAULT NULL COMMENT 'วันที่คำนวณ',
  `calculated_by` int(11) DEFAULT NULL COMMENT 'ผู้คำนวณ',
  `approved_at` datetime DEFAULT NULL COMMENT 'วันที่อนุมัติ',
  `approved_by` int(11) DEFAULT NULL COMMENT 'ผู้อนุมัติ',
  `paid_at` datetime DEFAULT NULL COMMENT 'วันที่จ่ายเงิน',
  `notes` text COLLATE utf8mb4_unicode_ci COMMENT 'หมายเหตุ',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='รอบการคำนวณค่าคอมมิชชัน';

-- --------------------------------------------------------

--
-- Table structure for table `commission_records`
--

CREATE TABLE `commission_records` (
  `id` int(11) NOT NULL,
  `period_id` int(11) NOT NULL COMMENT 'รอบการคำนวณ',
  `user_id` int(11) NOT NULL COMMENT 'Sales person',
  `total_sales` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT 'ยอดขายรวม',
  `commission_rate` decimal(5,2) DEFAULT NULL COMMENT '% ค่าคอม',
  `commission_amount` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT 'จำนวนเงินค่าคอม',
  `order_count` int(11) DEFAULT '0' COMMENT 'จำนวนออเดอร์',
  `notes` text COLLATE utf8mb4_unicode_ci COMMENT 'หมายเหตุ',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='บันทึกค่าคอมมิชชันของแต่ละคน';

-- --------------------------------------------------------

--
-- Table structure for table `companies`
--

CREATE TABLE `companies` (
  `id` int(11) NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `address` text COLLATE utf8mb4_unicode_ci,
  `phone` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tax_id` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customers`
--

CREATE TABLE `customers` (
  `customer_id` int(11) NOT NULL,
  `customer_ref_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `first_name` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_name` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `backup_phone` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `province` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `company_id` int(11) NOT NULL,
  `assigned_to` int(11) DEFAULT NULL,
  `date_assigned` datetime NOT NULL,
  `date_registered` datetime DEFAULT NULL,
  `follow_up_date` datetime DEFAULT NULL,
  `ownership_expires` datetime DEFAULT NULL,
  `lifecycle_status` enum('New','Old','FollowUp','Old3Months','DailyDistribution') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `behavioral_status` enum('Hot','Warm','Cold','Frozen') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `grade` enum('D','C','B','A','A+') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `total_purchases` decimal(12,2) NOT NULL DEFAULT '0.00',
  `total_calls` int(11) NOT NULL DEFAULT '0',
  `facebook_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `line_id` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `street` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `subdistrict` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `district` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `postal_code` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `recipient_first_name` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `recipient_last_name` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `has_sold_before` tinyint(1) DEFAULT '0',
  `follow_up_count` int(11) DEFAULT '0',
  `last_follow_up_date` datetime DEFAULT NULL,
  `last_sale_date` datetime DEFAULT NULL,
  `is_in_waiting_basket` tinyint(1) DEFAULT '0',
  `waiting_basket_start_date` datetime DEFAULT NULL,
  `followup_bonus_remaining` tinyint(1) NOT NULL DEFAULT '1',
  `is_blocked` tinyint(1) NOT NULL DEFAULT '0',
  `first_order_date` datetime DEFAULT NULL,
  `last_order_date` datetime DEFAULT NULL,
  `order_count` int(11) DEFAULT '0',
  `is_new_customer` tinyint(1) DEFAULT '0',
  `is_repeat_customer` tinyint(1) DEFAULT '0',
  `bucket_type` varchar(16) COLLATE utf8mb4_unicode_ci GENERATED ALWAYS AS ((case when (coalesce(`is_blocked`,0) = 1) then _utf8mb4'blocked' when (coalesce(`is_in_waiting_basket`,0) = 1) then _utf8mb4'waiting' when (`assigned_to` is null) then _utf8mb4'ready' else _utf8mb4'assigned' end)) STORED,
  `ai_score` int(11) DEFAULT NULL,
  `ai_reason_thai` text COLLATE utf8mb4_unicode_ci,
  `ai_last_updated` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Triggers `customers`
--
DELIMITER $$
CREATE TRIGGER `customers_before_insert` BEFORE INSERT ON `customers` FOR EACH ROW BEGIN
  SET NEW.customer_ref_id = generate_customer_id(NEW.phone, NEW.company_id);
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `customers_before_update` BEFORE UPDATE ON `customers` FOR EACH ROW BEGIN
  IF NOT (NEW.phone <=> OLD.phone) OR NOT (NEW.company_id <=> OLD.company_id) THEN
    SET NEW.customer_ref_id = generate_customer_id(NEW.phone, NEW.company_id);
  END IF;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `customer_address`
--

CREATE TABLE `customer_address` (
  `id` int(11) NOT NULL,
  `customer_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `recipient_first_name` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `recipient_last_name` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `province` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `district` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sub_district` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `zip_code` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customer_assignment_history`
--

CREATE TABLE `customer_assignment_history` (
  `id` bigint(20) NOT NULL,
  `customer_id` int(11) DEFAULT NULL,
  `user_id` int(11) NOT NULL,
  `assigned_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customer_blocks`
--

CREATE TABLE `customer_blocks` (
  `id` int(11) NOT NULL,
  `customer_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `blocked_by` int(11) NOT NULL,
  `blocked_at` datetime NOT NULL,
  `unblocked_by` int(11) DEFAULT NULL,
  `unblocked_at` datetime DEFAULT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customer_logs`
--

CREATE TABLE `customer_logs` (
  `id` int(11) NOT NULL,
  `customer_id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bucket_type` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lifecycle_status` enum('New','Old','FollowUp','Old3Months','DailyDistribution') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `assigned_to` int(11) DEFAULT NULL,
  `action_type` enum('create','update','delete') COLLATE utf8mb4_unicode_ci DEFAULT 'update',
  `old_values` json DEFAULT NULL,
  `new_values` json DEFAULT NULL,
  `changed_fields` json DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customer_tags`
--

CREATE TABLE `customer_tags` (
  `customer_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `tag_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `env`
--

CREATE TABLE `env` (
  `id` int(11) NOT NULL,
  `key` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` text COLLATE utf8mb4_unicode_ci,
  `company_id` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `exports`
--

CREATE TABLE `exports` (
  `id` int(11) NOT NULL,
  `filename` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `file_path` varchar(1024) COLLATE utf8mb4_unicode_ci NOT NULL,
  `orders_count` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `company_id` int(11) DEFAULT NULL,
  `exported_by` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `download_count` int(11) NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `google_sheet_shipping`
--

CREATE TABLE `google_sheet_shipping` (
  `id` int(11) NOT NULL,
  `system_created_time` datetime NOT NULL COMMENT 'เวลาที่ระบบสร้างขึ้น (จาก Google Sheet)',
  `order_number` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'หมายเลขคำสั่งซื้อ',
  `order_status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'สถานะคำสั่งซื้อ (Official)',
  `delivery_date` date DEFAULT NULL COMMENT 'วันที่จัดส่ง',
  `delivery_status` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'สถานะจัดส่ง',
  `imported_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'เวลาที่นำเข้าข้อมูล',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'เวลาที่อัพเดทข้อมูล'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ข้อมูลการจัดส่งจาก Google Sheet ของบริษัทขนส่ง';

-- --------------------------------------------------------

--
-- Table structure for table `marketing_ads_log`
--

CREATE TABLE `marketing_ads_log` (
  `id` int(11) NOT NULL,
  `page_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `date` date NOT NULL,
  `ads_cost` int(11) DEFAULT NULL,
  `impressions` int(11) DEFAULT NULL,
  `reach` int(11) DEFAULT NULL,
  `clicks` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `marketing_user_page`
--

CREATE TABLE `marketing_user_page` (
  `id` int(11) NOT NULL,
  `page_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('system_maintenance','system_update','new_customer_assigned','customer_ownership_expiring','customer_follow_up_due','customer_grade_changed','new_order_created','order_status_changed','order_cancelled','order_payment_pending','payment_verification_required','payment_overdue','payment_verified','stock_low','stock_out','new_stock_received','new_promotion_created','promotion_expiring','campaign_performance','team_target_achieved','team_member_performance','new_team_member','daily_report_ready','weekly_report_ready','monthly_report_ready','page_engagement_drop','page_reach_increase','unanswered_messages','weekly_page_report','high_performing_post','low_performing_post','scheduled_post_reminder','facebook_policy_alert','new_customer_from_page','customer_inquiry_from_page','customer_complaint_from_page','customer_review_from_page','pancake_api_connection_issue','page_data_sync_success','page_data_sync_failure','environment_variable_change') COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` enum('system','sales','customer','order','payment','inventory','marketing','report','team','page_performance','content_management','customer_interaction') COLLATE utf8mb4_unicode_ci NOT NULL,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `timestamp` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `is_read` tinyint(1) DEFAULT '0',
  `priority` enum('low','medium','high','urgent') COLLATE utf8mb4_unicode_ci DEFAULT 'medium',
  `related_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `page_id` int(11) DEFAULT NULL,
  `page_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `platform` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `previous_value` decimal(10,2) DEFAULT NULL,
  `current_value` decimal(10,2) DEFAULT NULL,
  `percentage_change` decimal(5,2) DEFAULT NULL,
  `action_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `action_text` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `metadata` json DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Triggers `notifications`
--
DELIMITER $$
CREATE TRIGGER `notifications_before_update` BEFORE UPDATE ON `notifications` FOR EACH ROW BEGIN
  SET NEW.updated_at = CURRENT_TIMESTAMP;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Stand-in structure for view `notifications_by_role`
-- (See below for the actual view)
--
CREATE TABLE `notifications_by_role` (
`id` varchar(50)
,`type` enum('system_maintenance','system_update','new_customer_assigned','customer_ownership_expiring','customer_follow_up_due','customer_grade_changed','new_order_created','order_status_changed','order_cancelled','order_payment_pending','payment_verification_required','payment_overdue','payment_verified','stock_low','stock_out','new_stock_received','new_promotion_created','promotion_expiring','campaign_performance','team_target_achieved','team_member_performance','new_team_member','daily_report_ready','weekly_report_ready','monthly_report_ready','page_engagement_drop','page_reach_increase','unanswered_messages','weekly_page_report','high_performing_post','low_performing_post','scheduled_post_reminder','facebook_policy_alert','new_customer_from_page','customer_inquiry_from_page','customer_complaint_from_page','customer_review_from_page','pancake_api_connection_issue','page_data_sync_success','page_data_sync_failure','environment_variable_change')
,`category` enum('system','sales','customer','order','payment','inventory','marketing','report','team','page_performance','content_management','customer_interaction')
,`title` varchar(255)
,`message` text
,`timestamp` datetime
,`is_read` tinyint(1)
,`priority` enum('low','medium','high','urgent')
,`related_id` varchar(50)
,`page_id` int(11)
,`page_name` varchar(255)
,`platform` varchar(50)
,`previous_value` decimal(10,2)
,`current_value` decimal(10,2)
,`percentage_change` decimal(5,2)
,`action_url` varchar(255)
,`action_text` varchar(100)
,`metadata` json
,`created_at` datetime
,`updated_at` datetime
,`role` enum('Admin Page','Telesale','Supervisor Telesale','Backoffice','Admin Control','Super Admin','Marketing')
);

-- --------------------------------------------------------

--
-- Table structure for table `notification_read_status`
--

CREATE TABLE `notification_read_status` (
  `id` int(11) NOT NULL,
  `notification_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int(11) NOT NULL,
  `read_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notification_roles`
--

CREATE TABLE `notification_roles` (
  `id` int(11) NOT NULL,
  `notification_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('Admin Page','Telesale','Supervisor Telesale','Backoffice','Admin Control','Super Admin','Marketing') COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notification_settings`
--

CREATE TABLE `notification_settings` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `notification_type` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `in_app_enabled` tinyint(1) DEFAULT '1',
  `email_enabled` tinyint(1) DEFAULT '0',
  `sms_enabled` tinyint(1) DEFAULT '0',
  `business_hours_only` tinyint(1) DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Triggers `notification_settings`
--
DELIMITER $$
CREATE TRIGGER `notification_settings_before_update` BEFORE UPDATE ON `notification_settings` FOR EACH ROW BEGIN
  SET NEW.updated_at = CURRENT_TIMESTAMP;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `notification_users`
--

CREATE TABLE `notification_users` (
  `id` int(11) NOT NULL,
  `notification_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int(11) NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `onecall_batch`
--

CREATE TABLE `onecall_batch` (
  `id` int(11) NOT NULL,
  `startdate` date NOT NULL,
  `enddate` date NOT NULL,
  `amount_record` int(11) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `onecall_log`
--

CREATE TABLE `onecall_log` (
  `id` int(11) NOT NULL,
  `timestamp` timestamp NOT NULL,
  `duration` int(11) NOT NULL,
  `localParty` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `remoteParty` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `direction` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone_telesale` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `batch_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `orders`
--

CREATE TABLE `orders` (
  `id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_id` int(11) DEFAULT NULL,
  `customer_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `company_id` int(11) NOT NULL,
  `creator_id` int(11) NOT NULL,
  `order_date` datetime NOT NULL,
  `delivery_date` datetime DEFAULT NULL,
  `street` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `subdistrict` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `district` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `province` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `postal_code` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `recipient_first_name` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `recipient_last_name` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `shipping_provider` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `shipping_cost` decimal(12,2) NOT NULL DEFAULT '0.00',
  `bill_discount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `total_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `payment_method` enum('COD','Transfer','PayAfter','Claim','FreeGift') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `payment_status` enum('Unpaid','PendingVerification','Verified','PreApproved','Approved','Paid') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `slip_url` varchar(1024) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `amount_paid` decimal(12,2) DEFAULT NULL,
  `cod_amount` decimal(12,2) DEFAULT NULL,
  `order_status` enum('Pending','AwaitingVerification','Confirmed','Preparing','Picking','Shipping','PreApproved','Delivered','Returned','Cancelled','Claiming','BadDebt') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Pending',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `ocr_payment_date` datetime DEFAULT NULL,
  `sales_channel` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sales_channel_page_id` int(11) DEFAULT NULL,
  `bank_account_id` int(11) DEFAULT NULL,
  `transfer_date` datetime DEFAULT NULL,
  `warehouse_id` int(11) DEFAULT NULL COMMENT 'รหัสคลังสินค้าที่จัดส่ง'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Triggers `orders`
--
DELIMITER $$
CREATE TRIGGER `trg_validate_order_creator` BEFORE INSERT ON `orders` FOR EACH ROW BEGIN
        DECLARE customer_company INT;
        DECLARE creator_company INT;
        DECLARE creator_role VARCHAR(64);
        DECLARE customer_pk INT;
        
        SET customer_pk = NEW.customer_id;

        IF customer_pk IS NULL THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Customer not found';
        END IF;
        
        SELECT company_id INTO customer_company FROM customers WHERE customer_id = customer_pk;
        SELECT company_id, role INTO creator_company, creator_role FROM users WHERE id = NEW.creator_id;
        
        IF creator_company IS NULL THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Creator user not found';
        END IF;
        
        IF creator_company != customer_company THEN
            IF creator_role != 'Super Admin' THEN
                SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Order creator must belong to same company as customer (unless Super Admin)';
            END IF;
        END IF;
        
        IF NEW.company_id != customer_company THEN
            SET NEW.company_id = customer_company;
        END IF;
    END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `order_boxes`
--

CREATE TABLE `order_boxes` (
  `id` int(11) NOT NULL,
  `order_id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sub_order_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `box_number` int(11) NOT NULL,
  `payment_method` enum('COD','Transfer','PayAfter','Claim','FreeGift') COLLATE utf8mb4_unicode_ci DEFAULT 'COD',
  `status` enum('PENDING','PREPARING','SHIPPED','DELIVERED','RETURNED','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `cod_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `collection_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `collected_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `waived_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `shipped_at` datetime DEFAULT NULL,
  `delivered_at` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Triggers `order_boxes`
--
DELIMITER $$
CREATE TRIGGER `trg_order_boxes_ai_log` AFTER INSERT ON `order_boxes` FOR EACH ROW BEGIN
    INSERT INTO order_box_collection_logs (
        order_box_id, order_id, sub_order_id, box_number, change_type,
        old_collection_amount, new_collection_amount,
        old_collected_amount, new_collected_amount,
        old_waived_amount, new_waived_amount,
        old_payment_method, new_payment_method,
        old_status, new_status,
        notes
    ) VALUES (
        NEW.id, NEW.order_id, NEW.sub_order_id, NEW.box_number, 'CREATE',
        NULL, NEW.collection_amount,
        NULL, NEW.collected_amount,
        NULL, NEW.waived_amount,
        NULL, NEW.payment_method,
        NULL, NEW.status,
        'Created order box'
    );
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `trg_order_boxes_au_log` AFTER UPDATE ON `order_boxes` FOR EACH ROW BEGIN
    IF NEW.collection_amount <> OLD.collection_amount
        OR NEW.collected_amount <> OLD.collected_amount
        OR NEW.waived_amount <> OLD.waived_amount
        OR NEW.payment_method <> OLD.payment_method
        OR NEW.status <> OLD.status THEN

        INSERT INTO order_box_collection_logs (
            order_box_id, order_id, sub_order_id, box_number, change_type,
            old_collection_amount, new_collection_amount,
            old_collected_amount, new_collected_amount,
            old_waived_amount, new_waived_amount,
            old_payment_method, new_payment_method,
            old_status, new_status,
            notes
        ) VALUES (
            NEW.id, NEW.order_id, NEW.sub_order_id, NEW.box_number,
            CASE
                WHEN NEW.collection_amount <> OLD.collection_amount THEN 'AMOUNT_UPDATE'
                WHEN NEW.payment_method <> OLD.payment_method THEN 'PAYMENT_UPDATE'
                WHEN NEW.status <> OLD.status THEN 'STATUS_UPDATE'
                WHEN NEW.waived_amount <> OLD.waived_amount THEN 'WAIVE_UPDATE'
                WHEN NEW.collected_amount <> OLD.collected_amount THEN 'COLLECT_UPDATE'
                ELSE 'STATUS_UPDATE'
            END,
            OLD.collection_amount, NEW.collection_amount,
            OLD.collected_amount, NEW.collected_amount,
            OLD.waived_amount, NEW.waived_amount,
            OLD.payment_method, NEW.payment_method,
            OLD.status, NEW.status,
            'Order box updated'
        );
    END IF;
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `trg_order_boxes_bi_enforce` BEFORE INSERT ON `order_boxes` FOR EACH ROW BEGIN
    DECLARE v_order_payment VARCHAR(50);
    DECLARE v_expected_total DECIMAL(12,2);
    DECLARE v_sum DECIMAL(14,2);
    DECLARE v_box_count INT;

    SELECT CAST(payment_method AS CHAR), 
           CASE 
               WHEN payment_method IN ('Claim', 'FreeGift') THEN 0
               ELSE COALESCE(cod_amount, total_amount, 0)
           END
    INTO v_order_payment, v_expected_total
    FROM orders
    WHERE id = NEW.order_id;

    IF v_order_payment IS NULL OR v_order_payment = '' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: order not found or payment method missing';
    END IF;

    SET NEW.payment_method = COALESCE(NULLIF(NEW.payment_method, ''), v_order_payment, 'COD');
    SET NEW.status = COALESCE(NEW.status, 'PENDING');
    SET NEW.sub_order_id = CONCAT(NEW.order_id, '-', NEW.box_number);
    SET NEW.collection_amount = COALESCE(NEW.collection_amount, COALESCE(NEW.cod_amount, 0));
    SET NEW.collected_amount = COALESCE(NEW.collected_amount, 0);
    SET NEW.waived_amount = COALESCE(NEW.waived_amount, 0);

    IF NEW.collection_amount < 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: collection_amount cannot be negative';
    END IF;

    IF NEW.payment_method <> 'COD' THEN
        SET NEW.collection_amount = v_expected_total;
        SELECT COUNT(*) INTO v_box_count FROM order_boxes WHERE order_id = NEW.order_id;
        IF v_box_count > 0 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: non-COD orders allow only one box';
        END IF;
    END IF;

    SELECT COALESCE(SUM(collection_amount), 0) INTO v_sum FROM order_boxes WHERE order_id = NEW.order_id;
    SET v_sum = v_sum + NEW.collection_amount;

    IF NEW.payment_method = 'COD' THEN
        IF v_sum > v_expected_total THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: COD box totals exceed order total';
        END IF;
    ELSE
        IF v_sum <> v_expected_total THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: non-COD box must match order total';
        END IF;
    END IF;
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `trg_order_boxes_bu_enforce` BEFORE UPDATE ON `order_boxes` FOR EACH ROW BEGIN
    DECLARE v_order_payment VARCHAR(50);
    DECLARE v_expected_total DECIMAL(12,2);
    DECLARE v_sum DECIMAL(14,2);
    DECLARE v_box_count INT;
    DECLARE v_effective_payment VARCHAR(50);

    SELECT CAST(payment_method AS CHAR), 
           CASE 
               WHEN payment_method IN ('Claim', 'FreeGift') THEN 0
               ELSE COALESCE(cod_amount, total_amount, 0)
           END
    INTO v_order_payment, v_expected_total
    FROM orders
    WHERE id = NEW.order_id;

    IF v_order_payment IS NULL OR v_order_payment = '' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: order not found or payment method missing';
    END IF;

    SET v_effective_payment = COALESCE(NULLIF(NEW.payment_method, ''), NULLIF(OLD.payment_method, ''), v_order_payment, 'COD');
    SET NEW.payment_method = v_effective_payment;
    SET NEW.status = COALESCE(NEW.status, OLD.status, 'PENDING');
    SET NEW.sub_order_id = CONCAT(NEW.order_id, '-', NEW.box_number);
    SET NEW.collection_amount = COALESCE(NEW.collection_amount, OLD.collection_amount, 0);

    IF NEW.payment_method <> 'COD' THEN
        SET NEW.collection_amount = v_expected_total;
        SELECT COUNT(*) INTO v_box_count FROM order_boxes WHERE order_id = NEW.order_id AND id <> OLD.id;
        IF v_box_count > 0 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: non-COD orders allow only one box';
        END IF;
    END IF;

    SELECT COALESCE(SUM(collection_amount), 0) INTO v_sum FROM order_boxes WHERE order_id = NEW.order_id AND id <> OLD.id;
    SET v_sum = v_sum + NEW.collection_amount;

    IF NEW.payment_method = 'COD' THEN
        IF v_sum > v_expected_total THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: COD box totals exceed order total';
        END IF;
    ELSE
        IF v_sum <> v_expected_total THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'order_boxes: non-COD box must match order total';
        END IF;
    END IF;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `order_box_collection_logs`
--

CREATE TABLE `order_box_collection_logs` (
  `id` int(11) NOT NULL,
  `order_box_id` int(11) NOT NULL,
  `order_id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sub_order_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `box_number` int(11) NOT NULL,
  `change_type` enum('CREATE','AMOUNT_UPDATE','STATUS_UPDATE','PAYMENT_UPDATE','WAIVE_UPDATE','COLLECT_UPDATE') COLLATE utf8mb4_unicode_ci NOT NULL,
  `old_collection_amount` decimal(12,2) DEFAULT NULL,
  `new_collection_amount` decimal(12,2) DEFAULT NULL,
  `old_collected_amount` decimal(12,2) DEFAULT NULL,
  `new_collected_amount` decimal(12,2) DEFAULT NULL,
  `old_waived_amount` decimal(12,2) DEFAULT NULL,
  `new_waived_amount` decimal(12,2) DEFAULT NULL,
  `old_payment_method` enum('COD','Transfer','PayAfter') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `new_payment_method` enum('COD','Transfer','PayAfter') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `old_status` enum('PENDING','PREPARING','SHIPPED','DELIVERED','RETURNED','CANCELLED') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `new_status` enum('PENDING','PREPARING','SHIPPED','DELIVERED','RETURNED','CANCELLED') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `order_items`
--

CREATE TABLE `order_items` (
  `id` int(11) NOT NULL,
  `order_id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `parent_order_id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `creator_id` int(11) NOT NULL,
  `product_id` int(11) DEFAULT NULL COMMENT 'รหัสสินค้า (NULL สำหรับรายการโปรโมชั่น)',
  `product_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ชื่อสินค้า (หรือชื่อโปรโมชั่นสำหรับ parent item)',
  `quantity` int(11) NOT NULL COMMENT 'จำนวน (สำหรับ parent = จำนวนเซ็ต, สำหรับ child = จำนวนชิ้น)',
  `price_per_unit` decimal(12,2) NOT NULL,
  `discount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `net_total` decimal(12,2) NOT NULL DEFAULT '0.00' COMMENT 'ยอดสุทธิของรายการ (price_per_unit * quantity - discount), freebies จะเป็น 0',
  `is_freebie` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'เป็นของแถมหรือไม่ (ใช้กับ child items)',
  `box_number` int(11) DEFAULT NULL,
  `promotion_id` int(11) DEFAULT NULL COMMENT 'รหัสโปรโมชั่นที่รายการนี้มาจาก',
  `parent_item_id` int(11) DEFAULT NULL COMMENT 'รหัสรายการแม่ (สำหรับรายการย่อยของโปรโมชั่น)',
  `is_promotion_parent` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'เป็นรายการแม่ของโปรโมชั่นหรือไม่'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `order_item_allocations`
--

CREATE TABLE `order_item_allocations` (
  `id` int(11) NOT NULL,
  `order_id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'รหัสออเดอร์',
  `order_item_id` int(11) DEFAULT NULL COMMENT 'อ้างอิงไปยัง order_items.id (อาจว่างเมื่อสร้างจาก FE ที่ยังไม่มี mapping)',
  `product_id` int(11) NOT NULL COMMENT 'รหัสสินค้า',
  `promotion_id` int(11) DEFAULT NULL COMMENT 'ถ้ามาจากโปรโมชัน (อ้างอิง promotions.id)',
  `is_freebie` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'เป็นของแถมหรือไม่',
  `required_quantity` int(11) NOT NULL COMMENT 'จำนวนที่ต้องตัดสต๊อก (ต่อสินค้า)',
  `allocated_quantity` int(11) NOT NULL DEFAULT '0' COMMENT 'จำนวนที่จัดสรรแล้ว (รวมทุกคลัง/ล็อต)',
  `warehouse_id` int(11) DEFAULT NULL COMMENT 'คลังที่จัดสรร (ถ้ายังไม่เลือกปล่อยว่าง)',
  `lot_number` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ล็อตที่จัดสรร (ถ้ายังไม่เลือกปล่อยว่าง)',
  `status` enum('PENDING','ALLOCATED','PICKED','SHIPPED','CANCELLED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING' COMMENT 'สถานะการจัดสรร',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_by` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `order_sequences`
--

CREATE TABLE `order_sequences` (
  `id` int(11) NOT NULL,
  `company_id` int(11) NOT NULL,
  `period` enum('day','month') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'day',
  `prefix` varchar(8) COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_sequence` int(11) NOT NULL DEFAULT '0',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
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
  `order_id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `url` varchar(1024) COLLATE utf8mb4_unicode_ci NOT NULL,
  `upload_by` int(11) DEFAULT NULL,
  `upload_by_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `order_status_logs`
--

CREATE TABLE `order_status_logs` (
  `id` int(11) NOT NULL,
  `order_id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `previous_status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `new_status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `previous_tracking` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `new_tracking` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `changed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `trigger_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'StatusChange, TrackingUpdate, Manual'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `order_tracking_numbers`
--

CREATE TABLE `order_tracking_numbers` (
  `id` int(11) NOT NULL,
  `order_id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `parent_order_id` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `box_number` int(11) DEFAULT NULL,
  `tracking_number` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `pages`
--

CREATE TABLE `pages` (
  `id` int(11) NOT NULL,
  `page_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `platform` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Facebook',
  `page_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Type of page (e.g., business, personal, fan, etc.)',
  `url` varchar(1024) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `company_id` int(11) NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `still_in_list` tinyint(1) NOT NULL DEFAULT '1' COMMENT '1 = page is visible in list, 0 = page is hidden from list',
  `user_count` int(11) NOT NULL DEFAULT '0' COMMENT 'Number of users assigned to this page',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `page_engagement_batch`
--

CREATE TABLE `page_engagement_batch` (
  `id` int(11) NOT NULL,
  `date_range` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `status` enum('pending','processing','completed','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `records_count` int(11) DEFAULT NULL,
  `user_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `page_engagement_log`
--

CREATE TABLE `page_engagement_log` (
  `id` int(11) NOT NULL,
  `batch_id` int(11) NOT NULL,
  `page_id` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `date` date NOT NULL,
  `inbox` int(11) DEFAULT '0',
  `comment` int(11) DEFAULT '0',
  `total` int(11) DEFAULT '0',
  `new_customer_replied` int(11) DEFAULT '0',
  `customer_engagement_new_inbox` int(11) DEFAULT '0',
  `order_count` int(11) DEFAULT '0',
  `old_order_count` int(11) DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `page_list_user`
--

CREATE TABLE `page_list_user` (
  `id` int(11) NOT NULL,
  `page_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Page ID from pages table',
  `page_user_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Page user ID from page_user table',
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active' COMMENT 'Status of the user (active, removed, etc.)',
  `still_in_list` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'Whether the user is still in the list (1) or not (0)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `page_stats_batch`
--

CREATE TABLE `page_stats_batch` (
  `id` int(11) NOT NULL,
  `date_range` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Date range in format YYYY-MM-DD - YYYY-MM-DD',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `page_stats_log`
--

CREATE TABLE `page_stats_log` (
  `id` int(11) NOT NULL,
  `batch_id` int(11) NOT NULL,
  `page_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `time_column` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Date or datetime depending on view mode',
  `new_customers` int(11) NOT NULL DEFAULT '0',
  `total_phones` int(11) NOT NULL DEFAULT '0',
  `new_phones` int(11) NOT NULL DEFAULT '0',
  `total_comments` int(11) NOT NULL DEFAULT '0',
  `total_chats` int(11) NOT NULL DEFAULT '0',
  `total_page_comments` int(11) NOT NULL DEFAULT '0',
  `total_page_chats` int(11) NOT NULL DEFAULT '0',
  `new_chats` int(11) NOT NULL DEFAULT '0',
  `chats_from_old_customers` int(11) NOT NULL DEFAULT '0',
  `web_logged_in` int(11) NOT NULL DEFAULT '0',
  `web_guest` int(11) NOT NULL DEFAULT '0',
  `orders_count` int(11) NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `page_user`
--

CREATE TABLE `page_user` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL COMMENT 'Reference to the user ID',
  `page_user_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Page user ID from external system',
  `page_user_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Name of the page user',
  `page_count` int(11) NOT NULL DEFAULT '0' COMMENT 'Number of pages associated with this user',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `platforms`
--

CREATE TABLE `platforms` (
  `id` int(11) NOT NULL,
  `name` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `display_name` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `company_id` int(11) NOT NULL DEFAULT '1',
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` int(11) NOT NULL DEFAULT '0',
  `show_pages_from` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `role_show` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `products`
--

CREATE TABLE `products` (
  `id` int(11) NOT NULL,
  `sku` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `category` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `unit` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cost` decimal(12,2) NOT NULL DEFAULT '0.00',
  `price` decimal(12,2) NOT NULL DEFAULT '0.00',
  `stock` int(11) NOT NULL DEFAULT '0',
  `company_id` int(11) NOT NULL,
  `shop` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('Active','Inactive') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `product_lots`
--

CREATE TABLE `product_lots` (
  `id` int(11) NOT NULL,
  `lot_number` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `product_id` int(11) NOT NULL,
  `warehouse_id` int(11) NOT NULL,
  `purchase_date` date NOT NULL,
  `expiry_date` date DEFAULT NULL,
  `quantity_received` decimal(12,2) NOT NULL,
  `quantity_remaining` decimal(12,2) NOT NULL DEFAULT '0.00',
  `unit_cost` decimal(12,2) NOT NULL,
  `supplier_id` int(11) DEFAULT NULL,
  `supplier_invoice` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('Active','Depleted','Expired') COLLATE utf8mb4_unicode_ci DEFAULT 'Active',
  `notes` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `promotions`
--

CREATE TABLE `promotions` (
  `id` int(11) NOT NULL,
  `sku` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `company_id` int(11) NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1',
  `start_date` datetime DEFAULT NULL,
  `end_date` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `promotion_items`
--

CREATE TABLE `promotion_items` (
  `id` int(11) NOT NULL,
  `promotion_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT '1',
  `is_freebie` tinyint(1) NOT NULL DEFAULT '0',
  `price_override` decimal(12,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `roles`
--

CREATE TABLE `roles` (
  `id` int(11) NOT NULL,
  `code` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'รหัส Role เช่น super_admin, backoffice',
  `name` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ชื่อ Role ภาษาไทย/อังกฤษ',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT 'คำอธิบาย Role',
  `is_active` tinyint(1) DEFAULT '1' COMMENT 'สถานะใช้งาน',
  `is_system` tinyint(1) DEFAULT '0' COMMENT 'เป็น Role ระบบ (ห้ามลบ)',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ตาราง Master สำหรับจัดการ Roles';

-- --------------------------------------------------------

--
-- Table structure for table `role_permissions`
--

CREATE TABLE `role_permissions` (
  `role` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `data` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci COMMENT 'คำอธิบาย Permission Set',
  `updated_by` int(11) DEFAULT NULL COMMENT 'ผู้แก้ไขล่าสุด',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `statement_batchs`
--

CREATE TABLE `statement_batchs` (
  `id` int(11) NOT NULL,
  `company_id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `row_count` int(11) NOT NULL,
  `transfer_min` datetime NOT NULL,
  `transfer_max` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `statement_logs`
--

CREATE TABLE `statement_logs` (
  `id` int(11) NOT NULL,
  `batch_id` int(11) NOT NULL,
  `transfer_at` datetime NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `bank_account_id` int(11) DEFAULT NULL,
  `bank_display_name` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `channel` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `statement_reconcile_batches`
--

CREATE TABLE `statement_reconcile_batches` (
  `id` int(11) NOT NULL,
  `document_no` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `bank_account_id` int(11) DEFAULT NULL,
  `bank_display_name` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `company_id` int(11) NOT NULL,
  `start_date` datetime DEFAULT NULL,
  `end_date` datetime DEFAULT NULL,
  `created_by` int(11) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `notes` text
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `statement_reconcile_logs`
--

CREATE TABLE `statement_reconcile_logs` (
  `id` int(11) NOT NULL,
  `batch_id` int(11) NOT NULL,
  `statement_log_id` int(11) NOT NULL,
  `order_id` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reconcile_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Order',
  `statement_amount` decimal(12,2) NOT NULL,
  `confirmed_amount` decimal(12,2) DEFAULT NULL,
  `auto_matched` tinyint(1) NOT NULL DEFAULT '0',
  `note` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `confirmed_at` datetime DEFAULT NULL,
  `confirmed_order_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `confirmed_order_amount` decimal(10,2) DEFAULT NULL,
  `confirmed_payment_method` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `confirmed_action` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `stock_movements`
--

CREATE TABLE `stock_movements` (
  `id` int(11) NOT NULL,
  `warehouse_id` int(11) NOT NULL COMMENT 'รหัสคลังสินค้า',
  `product_id` int(11) NOT NULL COMMENT 'รหัสสินค้า',
  `document_number` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `movement_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `quantity` int(11) NOT NULL COMMENT 'จำนวน',
  `lot_number` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'หมายเลข Lot',
  `reference_type` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ประเภทเอกสารอ้างอิง (ORDER, PURCHASE, ADJUSTMENT)',
  `reference_id` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'รหัสเอกสารอ้างอิง',
  `reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'เหตุผล',
  `notes` text COLLATE utf8mb4_unicode_ci COMMENT 'หมายเหตุ',
  `created_by` int(11) NOT NULL COMMENT 'ผู้สร้าง',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `stock_reservations`
--

CREATE TABLE `stock_reservations` (
  `id` int(11) NOT NULL,
  `warehouse_id` int(11) NOT NULL COMMENT 'รหัสคลังสินค้า',
  `product_id` int(11) NOT NULL COMMENT 'รหัสสินค้า',
  `order_id` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'รหัสออเดอร์',
  `quantity` int(11) NOT NULL COMMENT 'จำนวนที่จอง',
  `lot_number` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'หมายเลข Lot',
  `reserved_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่จอง',
  `expires_at` datetime DEFAULT NULL COMMENT 'วันหมดอายุการจอง',
  `status` enum('ACTIVE','RELEASED','EXPIRED') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ACTIVE' COMMENT 'สถานะการจอง',
  `created_by` int(11) NOT NULL COMMENT 'ผู้จอง',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `stock_transactions`
--

CREATE TABLE `stock_transactions` (
  `id` int(11) NOT NULL,
  `document_number` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('receive','adjustment') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `transaction_date` datetime NOT NULL,
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `stock_transaction_images`
--

CREATE TABLE `stock_transaction_images` (
  `id` int(11) NOT NULL,
  `transaction_id` int(11) NOT NULL,
  `image_path` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `stock_transaction_items`
--

CREATE TABLE `stock_transaction_items` (
  `id` int(11) NOT NULL,
  `transaction_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `warehouse_id` int(11) NOT NULL,
  `lot_id` int(11) DEFAULT NULL,
  `quantity` decimal(10,2) NOT NULL,
  `adjustment_type` enum('add','reduce','receive') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `remarks` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tags`
--

CREATE TABLE `tags` (
  `id` int(11) NOT NULL,
  `name` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('SYSTEM','USER') COLLATE utf8mb4_unicode_ci NOT NULL,
  `color` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `username` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `first_name` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_name` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role_id` int(11) DEFAULT NULL COMMENT 'อ้างอิง roles.id',
  `company_id` int(11) NOT NULL,
  `team_id` int(11) DEFAULT NULL,
  `supervisor_id` int(11) DEFAULT NULL,
  `id_oth` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('active','inactive','resigned') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `last_login` datetime DEFAULT NULL,
  `login_count` int(11) NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user_daily_attendance`
--

CREATE TABLE `user_daily_attendance` (
  `id` bigint(20) NOT NULL,
  `user_id` int(11) NOT NULL,
  `work_date` date NOT NULL,
  `first_login` datetime DEFAULT NULL,
  `last_logout` datetime DEFAULT NULL,
  `login_sessions` int(11) NOT NULL DEFAULT '0',
  `effective_seconds` int(11) NOT NULL DEFAULT '0' COMMENT 'Seconds overlapped with 09:00-18:00',
  `percent_of_workday` decimal(5,2) GENERATED ALWAYS AS (round(((`effective_seconds` / 32400) * 100),2)) STORED,
  `attendance_value` decimal(3,1) NOT NULL DEFAULT '0.0' COMMENT '0.0, 0.5, 1.0',
  `attendance_status` enum('absent','half','full') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'absent',
  `computed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user_login_history`
--

CREATE TABLE `user_login_history` (
  `id` bigint(20) NOT NULL,
  `user_id` int(11) NOT NULL,
  `login_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` text COLLATE utf8mb4_unicode_ci,
  `logout_time` datetime DEFAULT NULL,
  `session_duration` int(11) DEFAULT NULL COMMENT 'Session duration in seconds'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Triggers `user_login_history`
--
DELIMITER $$
CREATE TRIGGER `trg_login_history_ai` AFTER INSERT ON `user_login_history` FOR EACH ROW BEGIN
  CALL sp_upsert_user_daily_attendance(NEW.user_id, DATE(NEW.login_time));
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `trg_login_history_au` AFTER UPDATE ON `user_login_history` FOR EACH ROW BEGIN
  -- Recompute for both old and new dates just in case
  CALL sp_upsert_user_daily_attendance(NEW.user_id, DATE(NEW.login_time));
  IF DATE(OLD.login_time) <> DATE(NEW.login_time) THEN
    CALL sp_upsert_user_daily_attendance(NEW.user_id, DATE(OLD.login_time));
  END IF;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Stand-in structure for view `user_notifications`
-- (See below for the actual view)
--
CREATE TABLE `user_notifications` (
`id` varchar(50)
,`type` enum('system_maintenance','system_update','new_customer_assigned','customer_ownership_expiring','customer_follow_up_due','customer_grade_changed','new_order_created','order_status_changed','order_cancelled','order_payment_pending','payment_verification_required','payment_overdue','payment_verified','stock_low','stock_out','new_stock_received','new_promotion_created','promotion_expiring','campaign_performance','team_target_achieved','team_member_performance','new_team_member','daily_report_ready','weekly_report_ready','monthly_report_ready','page_engagement_drop','page_reach_increase','unanswered_messages','weekly_page_report','high_performing_post','low_performing_post','scheduled_post_reminder','facebook_policy_alert','new_customer_from_page','customer_inquiry_from_page','customer_complaint_from_page','customer_review_from_page','pancake_api_connection_issue','page_data_sync_success','page_data_sync_failure','environment_variable_change')
,`category` enum('system','sales','customer','order','payment','inventory','marketing','report','team','page_performance','content_management','customer_interaction')
,`title` varchar(255)
,`message` text
,`timestamp` datetime
,`is_read` tinyint(1)
,`priority` enum('low','medium','high','urgent')
,`related_id` varchar(50)
,`page_id` int(11)
,`page_name` varchar(255)
,`platform` varchar(50)
,`previous_value` decimal(10,2)
,`current_value` decimal(10,2)
,`percentage_change` decimal(5,2)
,`action_url` varchar(255)
,`action_text` varchar(100)
,`metadata` json
,`created_at` datetime
,`updated_at` datetime
,`role` enum('Admin Page','Telesale','Supervisor Telesale','Backoffice','Admin Control','Super Admin','Marketing')
,`user_id` int(11)
,`is_read_by_user` int(1)
);

-- --------------------------------------------------------

--
-- Table structure for table `user_pancake_mapping`
--

CREATE TABLE `user_pancake_mapping` (
  `id` int(11) NOT NULL,
  `id_user` int(11) NOT NULL,
  `id_panake` varchar(191) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `user_permission_overrides`
--

CREATE TABLE `user_permission_overrides` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL COMMENT 'อ้างอิง users.id',
  `permission_key` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'รหัสสิทธิ์ เช่น nav.orders, nav.bulk_tracking',
  `permission_value` json NOT NULL COMMENT 'ค่าสิทธิ์ เช่น {"view": true, "use": false}',
  `notes` text COLLATE utf8mb4_unicode_ci COMMENT 'หมายเหตุการ Override',
  `created_by` int(11) DEFAULT NULL COMMENT 'ผู้สร้าง',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Override สิทธิ์เฉพาะ User - ใช้เมื่อต้องการให้ User มีสิทธิ์ต่างจาก Role';

-- --------------------------------------------------------

--
-- Table structure for table `user_tags`
--

CREATE TABLE `user_tags` (
  `user_id` int(11) NOT NULL,
  `tag_id` int(11) NOT NULL
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
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_customer_buckets`
-- (See below for the actual view)
--
CREATE TABLE `v_customer_buckets` (
);

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
,`phone` varchar(64)
,`working_days` decimal(25,1)
,`total_minutes` decimal(35,2)
,`connected_calls` decimal(23,0)
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
,`attendance_status` enum('absent','half','full')
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
,`attendance_status` enum('absent','half','full')
,`effective_seconds` int(11)
,`call_minutes` decimal(35,2)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_user_effective_permissions`
-- (See below for the actual view)
--
CREATE TABLE `v_user_effective_permissions` (
`user_id` int(11)
,`username` varchar(64)
,`first_name` varchar(128)
,`last_name` varchar(128)
,`role_id` int(11)
,`role_code` varchar(64)
,`role_name` varchar(128)
,`role_permissions` text
,`user_overrides` text
);

-- --------------------------------------------------------

--
-- Table structure for table `warehouses`
--

CREATE TABLE `warehouses` (
  `id` int(11) NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ชื่อคลังสินค้า',
  `company_id` int(11) NOT NULL COMMENT 'รหัสบริษัท',
  `address` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ที่อยู่คลังสินค้า',
  `province` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'จังหวัด',
  `district` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'อำเภอ',
  `subdistrict` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ตำบล',
  `postal_code` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'รหัสไปรษณีย์',
  `phone` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'เบอร์โทรศัพท์',
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'อีเมล',
  `manager_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ชื่อผู้จัดการคลัง',
  `manager_phone` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'เบอร์ผู้จัดการ',
  `responsible_provinces` text COLLATE utf8mb4_unicode_ci COMMENT 'จังหวัดที่รับผิดชอบ (JSON array)',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'สถานะใช้งาน',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `warehouse_stocks`
--

CREATE TABLE `warehouse_stocks` (
  `id` int(11) NOT NULL,
  `warehouse_id` int(11) NOT NULL COMMENT 'รหัสคลังสินค้า',
  `product_id` int(11) NOT NULL COMMENT 'รหัสสินค้า',
  `lot_number` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'หมายเลข Lot',
  `product_lot_id` int(11) DEFAULT NULL,
  `quantity` int(11) NOT NULL DEFAULT '0' COMMENT 'จำนวนคงเหลือ',
  `reserved_quantity` int(11) NOT NULL DEFAULT '0' COMMENT 'จำนวนที่จองไว้',
  `available_quantity` int(11) GENERATED ALWAYS AS ((`quantity` - `reserved_quantity`)) STORED COMMENT 'จำนวนที่ใช้ได้จริง',
  `expiry_date` date DEFAULT NULL COMMENT 'วันหมดอายุ',
  `purchase_price` decimal(12,2) DEFAULT NULL COMMENT 'ราคาซื้อ',
  `selling_price` decimal(12,2) DEFAULT NULL COMMENT 'ราคาขาย',
  `location_in_warehouse` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ตำแหน่งในคลัง (เช่น A-1-2)',
  `notes` text COLLATE utf8mb4_unicode_ci COMMENT 'หมายเหตุ',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure for view `notifications_by_role`
--
DROP TABLE IF EXISTS `notifications_by_role`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `notifications_by_role`  AS  select `n`.`id` AS `id`,`n`.`type` AS `type`,`n`.`category` AS `category`,`n`.`title` AS `title`,`n`.`message` AS `message`,`n`.`timestamp` AS `timestamp`,`n`.`is_read` AS `is_read`,`n`.`priority` AS `priority`,`n`.`related_id` AS `related_id`,`n`.`page_id` AS `page_id`,`n`.`page_name` AS `page_name`,`n`.`platform` AS `platform`,`n`.`previous_value` AS `previous_value`,`n`.`current_value` AS `current_value`,`n`.`percentage_change` AS `percentage_change`,`n`.`action_url` AS `action_url`,`n`.`action_text` AS `action_text`,`n`.`metadata` AS `metadata`,`n`.`created_at` AS `created_at`,`n`.`updated_at` AS `updated_at`,`nr`.`role` AS `role` from (`notifications` `n` join `notification_roles` `nr` on((`n`.`id` = `nr`.`notification_id`))) where (`n`.`is_read` = false) order by `n`.`timestamp` desc ;

-- --------------------------------------------------------

--
-- Structure for view `user_notifications`
--
DROP TABLE IF EXISTS `user_notifications`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `user_notifications`  AS  select `n`.`id` AS `id`,`n`.`type` AS `type`,`n`.`category` AS `category`,`n`.`title` AS `title`,`n`.`message` AS `message`,`n`.`timestamp` AS `timestamp`,`n`.`is_read` AS `is_read`,`n`.`priority` AS `priority`,`n`.`related_id` AS `related_id`,`n`.`page_id` AS `page_id`,`n`.`page_name` AS `page_name`,`n`.`platform` AS `platform`,`n`.`previous_value` AS `previous_value`,`n`.`current_value` AS `current_value`,`n`.`percentage_change` AS `percentage_change`,`n`.`action_url` AS `action_url`,`n`.`action_text` AS `action_text`,`n`.`metadata` AS `metadata`,`n`.`created_at` AS `created_at`,`n`.`updated_at` AS `updated_at`,`nr`.`role` AS `role`,`nu`.`user_id` AS `user_id`,coalesce((`nrs`.`read_at` is not null),false) AS `is_read_by_user` from (((`notifications` `n` left join `notification_roles` `nr` on((`n`.`id` = `nr`.`notification_id`))) left join `notification_users` `nu` on((`n`.`id` = `nu`.`notification_id`))) left join `notification_read_status` `nrs` on((`n`.`id` = `nrs`.`notification_id`))) where ((`nr`.`role` is not null) or (`nu`.`user_id` is not null)) order by `n`.`timestamp` desc ;

-- --------------------------------------------------------

--
-- Structure for view `v_customer_buckets`
--
DROP TABLE IF EXISTS `v_customer_buckets`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_customer_buckets`  AS  select `c`.`id` AS `id`,`c`.`first_name` AS `first_name`,`c`.`last_name` AS `last_name`,`c`.`phone` AS `phone`,`c`.`email` AS `email`,`c`.`province` AS `province`,`c`.`company_id` AS `company_id`,`c`.`assigned_to` AS `assigned_to`,`c`.`date_assigned` AS `date_assigned`,`c`.`date_registered` AS `date_registered`,`c`.`follow_up_date` AS `follow_up_date`,`c`.`ownership_expires` AS `ownership_expires`,`c`.`lifecycle_status` AS `lifecycle_status`,`c`.`behavioral_status` AS `behavioral_status`,`c`.`grade` AS `grade`,`c`.`total_purchases` AS `total_purchases`,`c`.`total_calls` AS `total_calls`,`c`.`facebook_name` AS `facebook_name`,`c`.`line_id` AS `line_id`,`c`.`street` AS `street`,`c`.`subdistrict` AS `subdistrict`,`c`.`district` AS `district`,`c`.`postal_code` AS `postal_code`,`c`.`has_sold_before` AS `has_sold_before`,`c`.`follow_up_count` AS `follow_up_count`,`c`.`last_follow_up_date` AS `last_follow_up_date`,`c`.`last_sale_date` AS `last_sale_date`,`c`.`is_in_waiting_basket` AS `is_in_waiting_basket`,`c`.`waiting_basket_start_date` AS `waiting_basket_start_date`,`c`.`followup_bonus_remaining` AS `followup_bonus_remaining`,`c`.`is_blocked` AS `is_blocked`,`c`.`first_order_date` AS `first_order_date`,`c`.`last_order_date` AS `last_order_date`,`c`.`order_count` AS `order_count`,`c`.`is_new_customer` AS `is_new_customer`,`c`.`is_repeat_customer` AS `is_repeat_customer`,(case when (coalesce(`c`.`is_blocked`,0) = 1) then 'blocked' when (coalesce(`c`.`is_in_waiting_basket`,0) = 1) then 'waiting' when (`c`.`assigned_to` is null) then 'ready' else 'assigned' end) AS `bucket` from `customers` `c` ;

-- --------------------------------------------------------

--
-- Structure for view `v_order_required_stock`
--
DROP TABLE IF EXISTS `v_order_required_stock`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_order_required_stock`  AS  select `a`.`order_id` AS `order_id`,`a`.`product_id` AS `product_id`,sum(`a`.`required_quantity`) AS `required_qty`,sum(`a`.`allocated_quantity`) AS `allocated_qty`,sum((case when (`a`.`is_freebie` = 1) then `a`.`required_quantity` else 0 end)) AS `free_qty`,sum((case when (`a`.`is_freebie` = 0) then `a`.`required_quantity` else 0 end)) AS `paid_qty` from `order_item_allocations` `a` group by `a`.`order_id`,`a`.`product_id` ;

-- --------------------------------------------------------

--
-- Structure for view `v_telesale_call_overview_monthly`
--
DROP TABLE IF EXISTS `v_telesale_call_overview_monthly`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_telesale_call_overview_monthly`  AS  with `users_ts` as (select `u`.`id` AS `id`,`u`.`first_name` AS `first_name`,`u`.`role` AS `role`,(cast(replace(replace(`u`.`phone`,'-',''),' ','') as char charset utf8mb4) collate utf8mb4_unicode_ci) AS `phone0` from `users` `u` where (`u`.`role` in ('Telesale','Supervisor Telesale'))), `calls` as (select `uts`.`id` AS `user_id`,(cast(date_format(`ocl`.`timestamp`,'%Y-%m') as char charset utf8mb4) collate utf8mb4_unicode_ci) AS `month_key`,count(0) AS `total_calls`,sum((case when (`ocl`.`duration` >= 40) then 1 else 0 end)) AS `connected_calls`,round((sum(`ocl`.`duration`) / 60),2) AS `total_minutes` from (`onecall_log` `ocl` join `users_ts` `uts` on(((cast((case when (regexp_replace(coalesce(`ocl`.`phone_telesale`,''),'[^0-9]+','') like '66%') then concat('0',substr(regexp_replace(coalesce(`ocl`.`phone_telesale`,''),'[^0-9]+',''),(case when (substr(regexp_replace(coalesce(`ocl`.`phone_telesale`,''),'[^0-9]+',''),3,1) = '0') then 4 else 3 end))) when (regexp_replace(coalesce(`ocl`.`phone_telesale`,''),'[^0-9]+','') like '0%') then regexp_replace(coalesce(`ocl`.`phone_telesale`,''),'[^0-9]+','') else concat('0',regexp_replace(coalesce(`ocl`.`phone_telesale`,''),'[^0-9]+','')) end) as char charset utf8mb4) collate utf8mb4_unicode_ci) = `uts`.`phone0`))) group by `uts`.`id`,date_format(`ocl`.`timestamp`,'%Y-%m')), `attendance` as (select `uts`.`id` AS `user_id`,(cast(date_format(`a`.`work_date`,'%Y-%m') as char charset utf8mb4) collate utf8mb4_unicode_ci) AS `month_key`,sum(`a`.`attendance_value`) AS `working_days` from (`user_daily_attendance` `a` join `users_ts` `uts` on((`uts`.`id` = `a`.`user_id`))) group by `uts`.`id`,date_format(`a`.`work_date`,'%Y-%m')), `months` as (select `calls`.`user_id` AS `user_id`,`calls`.`month_key` AS `month_key` from `calls` union select `attendance`.`user_id` AS `user_id`,`attendance`.`month_key` AS `month_key` from `attendance`) select (`m`.`month_key` collate utf8mb4_unicode_ci) AS `month_key`,`uts`.`id` AS `user_id`,`uts`.`first_name` AS `first_name`,`uts`.`role` AS `role`,`uts`.`phone0` AS `phone`,coalesce(`att`.`working_days`,0) AS `working_days`,coalesce(`c`.`total_minutes`,0) AS `total_minutes`,coalesce(`c`.`connected_calls`,0) AS `connected_calls`,coalesce(`c`.`total_calls`,0) AS `total_calls`,round((coalesce(`c`.`total_minutes`,0) / nullif(coalesce(`att`.`working_days`,0),0)),2) AS `minutes_per_workday` from (((`months` `m` join `users_ts` `uts` on((`uts`.`id` = `m`.`user_id`))) left join `calls` `c` on(((`c`.`user_id` = `m`.`user_id`) and (`c`.`month_key` = `m`.`month_key`)))) left join `attendance` `att` on(((`att`.`user_id` = `m`.`user_id`) and (`att`.`month_key` = `m`.`month_key`)))) order by `m`.`month_key` desc,`uts`.`id` ;

-- --------------------------------------------------------

--
-- Structure for view `v_user_daily_attendance`
--
DROP TABLE IF EXISTS `v_user_daily_attendance`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_user_daily_attendance`  AS  select `a`.`id` AS `id`,`a`.`user_id` AS `user_id`,`u`.`username` AS `username`,concat(`u`.`first_name`,' ',`u`.`last_name`) AS `full_name`,`u`.`role` AS `role`,`a`.`work_date` AS `work_date`,`a`.`first_login` AS `first_login`,`a`.`last_logout` AS `last_logout`,`a`.`login_sessions` AS `login_sessions`,`a`.`effective_seconds` AS `effective_seconds`,round((`a`.`effective_seconds` / 3600),2) AS `effective_hours`,`a`.`percent_of_workday` AS `percent_of_workday`,`a`.`attendance_value` AS `attendance_value`,`a`.`attendance_status` AS `attendance_status`,`a`.`computed_at` AS `computed_at`,`a`.`updated_at` AS `updated_at` from (`user_daily_attendance` `a` join `users` `u` on((`u`.`id` = `a`.`user_id`))) where (`u`.`status` = 'active') ;

-- --------------------------------------------------------

--
-- Structure for view `v_user_daily_kpis`
--
DROP TABLE IF EXISTS `v_user_daily_kpis`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_user_daily_kpis`  AS  select `a`.`user_id` AS `user_id`,`u`.`username` AS `username`,concat(`u`.`first_name`,' ',`u`.`last_name`) AS `full_name`,`u`.`role` AS `role`,`a`.`work_date` AS `work_date`,`a`.`attendance_value` AS `attendance_value`,`a`.`attendance_status` AS `attendance_status`,`a`.`effective_seconds` AS `effective_seconds`,round((coalesce(sum(`ch`.`duration`),0) / 60),2) AS `call_minutes` from ((`user_daily_attendance` `a` join `users` `u` on((`u`.`id` = `a`.`user_id`))) left join `call_history` `ch` on(((cast(`ch`.`date` as date) = `a`.`work_date`) and (`ch`.`caller` = concat(`u`.`first_name`,' ',`u`.`last_name`))))) where (`u`.`status` = 'active') group by `a`.`id` ;

-- --------------------------------------------------------

--
-- Structure for view `v_user_effective_permissions`
--
DROP TABLE IF EXISTS `v_user_effective_permissions`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_user_effective_permissions`  AS  select `u`.`id` AS `user_id`,`u`.`username` AS `username`,`u`.`first_name` AS `first_name`,`u`.`last_name` AS `last_name`,`r`.`id` AS `role_id`,`r`.`code` AS `role_code`,`r`.`name` AS `role_name`,`rp`.`data` AS `role_permissions`,group_concat(concat(`upo`.`permission_key`,':',`upo`.`permission_value`) separator '||') AS `user_overrides` from (((`users` `u` left join `roles` `r` on((`u`.`role_id` = `r`.`id`))) left join `role_permissions` `rp` on((`rp`.`role` = `r`.`code`))) left join `user_permission_overrides` `upo` on((`upo`.`user_id` = `u`.`id`))) where (`u`.`status` = 'active') group by `u`.`id`,`r`.`id`,`rp`.`data` ;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `activities`
--
ALTER TABLE `activities`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_activities_timestamp` (`timestamp`);

--
-- Indexes for table `address_districts`
--
ALTER TABLE `address_districts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `province_id` (`province_id`);

--
-- Indexes for table `address_geographies`
--
ALTER TABLE `address_geographies`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `address_provinces`
--
ALTER TABLE `address_provinces`
  ADD PRIMARY KEY (`id`),
  ADD KEY `geography_id` (`geography_id`);

--
-- Indexes for table `ad_spend`
--
ALTER TABLE `ad_spend`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_page_date` (`page_id`,`spend_date`);

--
-- Indexes for table `appointments`
--
ALTER TABLE `appointments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_appointments_date` (`date`),
  ADD KEY `idx_appointments_status` (`status`);

--
-- Indexes for table `bank_account`
--
ALTER TABLE `bank_account`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_company_id` (`company_id`),
  ADD KEY `idx_is_active` (`is_active`);

--
-- Indexes for table `call_history`
--
ALTER TABLE `call_history`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `cod_documents`
--
ALTER TABLE `cod_documents`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_cod_document_company_number` (`company_id`,`document_number`),
  ADD KEY `idx_cod_documents_company` (`company_id`),
  ADD KEY `idx_cod_documents_datetime` (`document_datetime`),
  ADD KEY `fk_cod_documents_bank` (`bank_account_id`),
  ADD KEY `fk_cod_documents_creator` (`created_by`),
  ADD KEY `idx_cod_documents_status` (`status`),
  ADD KEY `idx_cod_documents_statement` (`matched_statement_log_id`),
  ADD KEY `fk_cod_documents_verified_by` (`verified_by`);

--
-- Indexes for table `cod_records`
--
ALTER TABLE `cod_records`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_tracking` (`tracking_number`),
  ADD KEY `idx_company` (`company_id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_cod_records_document` (`document_id`),
  ADD KEY `idx_cod_records_order` (`order_id`),
  ADD KEY `fk_cod_records_creator` (`created_by`);

--
-- Indexes for table `commission_order_lines`
--
ALTER TABLE `commission_order_lines`
  ADD PRIMARY KEY (`id`),
  ADD KEY `record_id` (`record_id`),
  ADD KEY `idx_commission_order` (`order_id`);

--
-- Indexes for table `commission_periods`
--
ALTER TABLE `commission_periods`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_period` (`company_id`,`period_year`,`period_month`),
  ADD KEY `idx_period_status` (`status`),
  ADD KEY `idx_period_company` (`company_id`,`period_year`,`period_month`);

--
-- Indexes for table `commission_records`
--
ALTER TABLE `commission_records`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `idx_commission_period_user` (`period_id`,`user_id`);

--
-- Indexes for table `companies`
--
ALTER TABLE `companies`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `customers`
--
ALTER TABLE `customers`
  ADD PRIMARY KEY (`customer_id`),
  ADD UNIQUE KEY `uniq_customers_customer_ref_id` (`customer_ref_id`),
  ADD KEY `idx_customers_company` (`company_id`),
  ADD KEY `idx_customers_assigned_to` (`assigned_to`),
  ADD KEY `idx_customers_lifecycle_status` (`lifecycle_status`),
  ADD KEY `idx_customers_ownership_expires` (`ownership_expires`),
  ADD KEY `idx_customers_date_assigned` (`date_assigned`),
  ADD KEY `idx_customers_blocked` (`is_blocked`),
  ADD KEY `idx_customers_waiting` (`is_in_waiting_basket`),
  ADD KEY `idx_customers_company_status` (`company_id`,`lifecycle_status`),
  ADD KEY `idx_customers_company_assigned` (`company_id`,`assigned_to`);

--
-- Indexes for table `customer_address`
--
ALTER TABLE `customer_address`
  ADD PRIMARY KEY (`id`),
  ADD KEY `customer_id` (`customer_id`);

--
-- Indexes for table `customer_assignment_history`
--
ALTER TABLE `customer_assignment_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_cah_user` (`user_id`);

--
-- Indexes for table `customer_blocks`
--
ALTER TABLE `customer_blocks`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `customer_logs`
--
ALTER TABLE `customer_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_customer_id` (`customer_id`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_assigned_to` (`assigned_to`);

--
-- Indexes for table `customer_tags`
--
ALTER TABLE `customer_tags`
  ADD KEY `fk_customer_tags_tag` (`tag_id`);

--
-- Indexes for table `env`
--
ALTER TABLE `env`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `key` (`key`),
  ADD KEY `idx_env_key` (`key`);

--
-- Indexes for table `exports`
--
ALTER TABLE `exports`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_exports_created_at` (`created_at`),
  ADD KEY `idx_exports_company_id` (`company_id`);

--
-- Indexes for table `google_sheet_shipping`
--
ALTER TABLE `google_sheet_shipping`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_order_time` (`order_number`,`system_created_time`),
  ADD KEY `idx_order_number` (`order_number`),
  ADD KEY `idx_delivery_date` (`delivery_date`),
  ADD KEY `idx_delivery_status` (`delivery_status`),
  ADD KEY `idx_order_status` (`order_status`);

--
-- Indexes for table `marketing_ads_log`
--
ALTER TABLE `marketing_ads_log`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_page_user_date` (`page_id`,`user_id`,`date`),
  ADD KEY `idx_page_id` (`page_id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_date` (`date`);

--
-- Indexes for table `marketing_user_page`
--
ALTER TABLE `marketing_user_page`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_page_user` (`page_id`,`user_id`),
  ADD KEY `idx_page_id` (`page_id`),
  ADD KEY `idx_user_id` (`user_id`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_timestamp` (`timestamp`),
  ADD KEY `idx_is_read` (`is_read`),
  ADD KEY `idx_type` (`type`),
  ADD KEY `idx_category` (`category`),
  ADD KEY `idx_priority` (`priority`),
  ADD KEY `idx_related_id` (`related_id`),
  ADD KEY `idx_page_id` (`page_id`);

--
-- Indexes for table `notification_read_status`
--
ALTER TABLE `notification_read_status`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_notification_user_read` (`notification_id`,`user_id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_read_at` (`read_at`);

--
-- Indexes for table `notification_roles`
--
ALTER TABLE `notification_roles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_notification_role` (`notification_id`,`role`),
  ADD KEY `idx_role` (`role`);

--
-- Indexes for table `notification_settings`
--
ALTER TABLE `notification_settings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_user_notification_type` (`user_id`,`notification_type`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_notification_type` (`notification_type`);

--
-- Indexes for table `notification_users`
--
ALTER TABLE `notification_users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_notification_user` (`notification_id`,`user_id`),
  ADD KEY `idx_user_id` (`user_id`);

--
-- Indexes for table `onecall_batch`
--
ALTER TABLE `onecall_batch`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `onecall_log`
--
ALTER TABLE `onecall_log`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_onecall_phone_ts` (`phone_telesale`,`timestamp`),
  ADD KEY `onecall_log_ibfk_1` (`batch_id`);

--
-- Indexes for table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_orders_company` (`company_id`),
  ADD KEY `fk_orders_warehouse` (`warehouse_id`),
  ADD KEY `idx_orders_creator` (`creator_id`),
  ADD KEY `idx_orders_status` (`order_status`),
  ADD KEY `idx_orders_payment_status` (`payment_status`),
  ADD KEY `idx_orders_company_status` (`company_id`,`order_status`),
  ADD KEY `idx_orders_date` (`order_date`),
  ADD KEY `idx_orders_delivery_date` (`delivery_date`),
  ADD KEY `idx_orders_company_payment` (`company_id`,`payment_status`),
  ADD KEY `idx_orders_bank_account_id` (`bank_account_id`),
  ADD KEY `fk_orders_customer` (`customer_id`),
  ADD KEY `fk_orders_page` (`sales_channel_page_id`);

--
-- Indexes for table `order_boxes`
--
ALTER TABLE `order_boxes`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_order_box_per_order` (`order_id`,`box_number`),
  ADD UNIQUE KEY `uniq_sub_order_id` (`sub_order_id`),
  ADD KEY `idx_order_boxes_status` (`status`);

--
-- Indexes for table `order_box_collection_logs`
--
ALTER TABLE `order_box_collection_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_ob_logs_box` (`order_box_id`),
  ADD KEY `idx_ob_logs_order` (`order_id`),
  ADD KEY `idx_ob_logs_sub_order` (`sub_order_id`),
  ADD KEY `idx_ob_logs_change_type` (`change_type`);

--
-- Indexes for table `order_items`
--
ALTER TABLE `order_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_order_items_order` (`order_id`),
  ADD KEY `idx_order_items_promotion` (`promotion_id`),
  ADD KEY `idx_order_items_parent` (`parent_item_id`),
  ADD KEY `idx_order_items_promotion_parent` (`is_promotion_parent`),
  ADD KEY `idx_order_items_product` (`product_id`),
  ADD KEY `idx_order_items_parent_order` (`parent_order_id`),
  ADD KEY `idx_order_items_creator` (`creator_id`);

--
-- Indexes for table `order_item_allocations`
--
ALTER TABLE `order_item_allocations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_allocations_order` (`order_id`),
  ADD KEY `idx_allocations_item` (`order_item_id`),
  ADD KEY `idx_allocations_product` (`product_id`),
  ADD KEY `idx_allocations_status` (`status`),
  ADD KEY `idx_allocations_warehouse` (`warehouse_id`),
  ADD KEY `idx_allocations_created_by` (`created_by`),
  ADD KEY `fk_allocations_promotion` (`promotion_id`);

--
-- Indexes for table `order_sequences`
--
ALTER TABLE `order_sequences`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_order_sequences` (`company_id`,`period`,`prefix`);

--
-- Indexes for table `order_slips`
--
ALTER TABLE `order_slips`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_order_slips_order` (`order_id`),
  ADD KEY `idx_order_slips_bank_account_id` (`bank_account_id`);

--
-- Indexes for table `order_status_logs`
--
ALTER TABLE `order_status_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_order_log_order_id` (`order_id`),
  ADD KEY `idx_order_log_changed_at` (`changed_at`);

--
-- Indexes for table `order_tracking_numbers`
--
ALTER TABLE `order_tracking_numbers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_order_tracking_order` (`order_id`),
  ADD KEY `idx_order_tracking_parent_order` (`parent_order_id`);

--
-- Indexes for table `pages`
--
ALTER TABLE `pages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_still_in_list` (`still_in_list`),
  ADD KEY `idx_user_count` (`user_count`),
  ADD KEY `idx_page_id` (`page_id`),
  ADD KEY `idx_page_type` (`page_type`),
  ADD KEY `idx_pages_company` (`company_id`),
  ADD KEY `idx_pages_active` (`active`);

--
-- Indexes for table `page_engagement_batch`
--
ALTER TABLE `page_engagement_batch`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_status` (`status`);

--
-- Indexes for table `page_engagement_log`
--
ALTER TABLE `page_engagement_log`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_batch_id` (`batch_id`),
  ADD KEY `idx_page_id` (`page_id`),
  ADD KEY `idx_date` (`date`);

--
-- Indexes for table `page_list_user`
--
ALTER TABLE `page_list_user`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_page_user_pair` (`page_id`,`page_user_id`),
  ADD KEY `idx_page_id` (`page_id`),
  ADD KEY `idx_page_user_id` (`page_user_id`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_still_in_list` (`still_in_list`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_updated_at` (`updated_at`);

--
-- Indexes for table `page_stats_batch`
--
ALTER TABLE `page_stats_batch`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_date_range` (`date_range`),
  ADD KEY `idx_created_at` (`created_at`);

--
-- Indexes for table `page_stats_log`
--
ALTER TABLE `page_stats_log`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_batch_page_time` (`batch_id`,`page_id`,`time_column`),
  ADD KEY `idx_batch_id` (`batch_id`),
  ADD KEY `idx_page_id` (`page_id`),
  ADD KEY `idx_time_column` (`time_column`);

--
-- Indexes for table `page_user`
--
ALTER TABLE `page_user`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_page_user_id` (`page_user_id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_page_user_id` (`page_user_id`),
  ADD KEY `idx_page_user_name` (`page_user_name`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_updated_at` (`updated_at`);

--
-- Indexes for table `platforms`
--
ALTER TABLE `platforms`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_platforms_company_name` (`company_id`,`name`),
  ADD KEY `idx_platforms_active` (`active`),
  ADD KEY `idx_platforms_sort_order` (`sort_order`),
  ADD KEY `idx_platforms_company_id` (`company_id`),
  ADD KEY `idx_platforms_show_pages_from` (`show_pages_from`);

--
-- Indexes for table `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `sku` (`sku`),
  ADD KEY `idx_products_company` (`company_id`);

--
-- Indexes for table `product_lots`
--
ALTER TABLE `product_lots`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `idx_product_lot_unique` (`product_id`,`lot_number`),
  ADD KEY `idx_lot_status` (`status`),
  ADD KEY `idx_lot_expiry` (`expiry_date`),
  ADD KEY `product_lots_ibfk_2` (`warehouse_id`);

--
-- Indexes for table `promotions`
--
ALTER TABLE `promotions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_promotions_company` (`company_id`),
  ADD KEY `idx_promotions_active` (`active`),
  ADD KEY `idx_promotions_dates` (`start_date`,`end_date`);

--
-- Indexes for table `promotion_items`
--
ALTER TABLE `promotion_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_pitems_product` (`product_id`),
  ADD KEY `fk_pitems_promotion` (`promotion_id`);

--
-- Indexes for table `roles`
--
ALTER TABLE `roles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `code` (`code`),
  ADD KEY `idx_roles_code` (`code`),
  ADD KEY `idx_roles_active` (`is_active`);

--
-- Indexes for table `role_permissions`
--
ALTER TABLE `role_permissions`
  ADD PRIMARY KEY (`role`),
  ADD KEY `idx_role_permissions_updated` (`updated_at`);

--
-- Indexes for table `statement_batchs`
--
ALTER TABLE `statement_batchs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_statement_batchs_company_created` (`company_id`,`created_at`);

--
-- Indexes for table `statement_logs`
--
ALTER TABLE `statement_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_statement_logs_batch_transfer` (`batch_id`,`transfer_at`),
  ADD KEY `idx_statement_logs_bank_date` (`bank_account_id`,`transfer_at`);

--
-- Indexes for table `statement_reconcile_batches`
--
ALTER TABLE `statement_reconcile_batches`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_statement_reconcile_document` (`document_no`),
  ADD KEY `idx_statement_reconcile_company_created` (`company_id`,`created_at`),
  ADD KEY `idx_statement_reconcile_bank` (`bank_account_id`);

--
-- Indexes for table `statement_reconcile_logs`
--
ALTER TABLE `statement_reconcile_logs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_statement_log` (`statement_log_id`),
  ADD KEY `idx_statement_reconcile_batch` (`batch_id`),
  ADD KEY `idx_statement_reconcile_order_statement` (`order_id`,`statement_log_id`),
  ADD KEY `idx_statement_reconcile_type` (`reconcile_type`);

--
-- Indexes for table `stock_movements`
--
ALTER TABLE `stock_movements`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_stock_movements_warehouse` (`warehouse_id`),
  ADD KEY `fk_stock_movements_product` (`product_id`),
  ADD KEY `fk_stock_movements_user` (`created_by`),
  ADD KEY `idx_stock_movements_type` (`movement_type`),
  ADD KEY `idx_stock_movements_date` (`created_at`);

--
-- Indexes for table `stock_reservations`
--
ALTER TABLE `stock_reservations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_stock_reservations_warehouse` (`warehouse_id`),
  ADD KEY `fk_stock_reservations_product` (`product_id`),
  ADD KEY `fk_stock_reservations_order` (`order_id`),
  ADD KEY `fk_stock_reservations_user` (`created_by`),
  ADD KEY `idx_stock_reservations_status` (`status`);

--
-- Indexes for table `stock_transactions`
--
ALTER TABLE `stock_transactions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `document_number` (`document_number`);

--
-- Indexes for table `stock_transaction_images`
--
ALTER TABLE `stock_transaction_images`
  ADD PRIMARY KEY (`id`),
  ADD KEY `transaction_id` (`transaction_id`);

--
-- Indexes for table `stock_transaction_items`
--
ALTER TABLE `stock_transaction_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `transaction_id` (`transaction_id`);

--
-- Indexes for table `tags`
--
ALTER TABLE `tags`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD KEY `idx_users_status` (`status`),
  ADD KEY `idx_users_last_login` (`last_login`),
  ADD KEY `idx_users_id_oth` (`id_oth`),
  ADD KEY `idx_users_phone` (`phone`),
  ADD KEY `idx_users_company` (`company_id`),
  ADD KEY `idx_users_role` (`role`),
  ADD KEY `idx_users_company_role` (`company_id`,`role`),
  ADD KEY `idx_users_company_status` (`company_id`,`status`),
  ADD KEY `idx_users_role_id` (`role_id`);

--
-- Indexes for table `user_daily_attendance`
--
ALTER TABLE `user_daily_attendance`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_user_date` (`user_id`,`work_date`),
  ADD KEY `idx_work_date` (`work_date`);

--
-- Indexes for table `user_login_history`
--
ALTER TABLE `user_login_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_login_user_id` (`user_id`),
  ADD KEY `idx_login_time` (`login_time`);

--
-- Indexes for table `user_pancake_mapping`
--
ALTER TABLE `user_pancake_mapping`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_user` (`id_user`),
  ADD UNIQUE KEY `uniq_panake` (`id_panake`),
  ADD KEY `idx_user` (`id_user`),
  ADD KEY `idx_panake` (`id_panake`);

--
-- Indexes for table `user_permission_overrides`
--
ALTER TABLE `user_permission_overrides`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_user_permission` (`user_id`,`permission_key`),
  ADD KEY `idx_user_permission_user` (`user_id`),
  ADD KEY `fk_user_permission_creator` (`created_by`),
  ADD KEY `idx_user_overrides_key` (`permission_key`);

--
-- Indexes for table `user_tags`
--
ALTER TABLE `user_tags`
  ADD PRIMARY KEY (`user_id`,`tag_id`),
  ADD KEY `fk_user_tags_tag` (`tag_id`);

--
-- Indexes for table `user_tokens`
--
ALTER TABLE `user_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_token` (`token`),
  ADD KEY `idx_user` (`user_id`);

--
-- Indexes for table `warehouses`
--
ALTER TABLE `warehouses`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_warehouses_company` (`company_id`),
  ADD KEY `idx_warehouses_province` (`province`),
  ADD KEY `idx_warehouses_active` (`is_active`);

--
-- Indexes for table `warehouse_stocks`
--
ALTER TABLE `warehouse_stocks`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_warehouse_product_lot` (`warehouse_id`,`product_id`,`lot_number`),
  ADD KEY `fk_warehouse_stocks_warehouse` (`warehouse_id`),
  ADD KEY `fk_warehouse_stocks_product` (`product_id`),
  ADD KEY `idx_warehouse_stocks_quantity` (`quantity`),
  ADD KEY `idx_warehouse_stocks_expiry` (`expiry_date`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `activities`
--
ALTER TABLE `activities`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `ad_spend`
--
ALTER TABLE `ad_spend`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `appointments`
--
ALTER TABLE `appointments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `bank_account`
--
ALTER TABLE `bank_account`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `call_history`
--
ALTER TABLE `call_history`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `cod_documents`
--
ALTER TABLE `cod_documents`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `cod_records`
--
ALTER TABLE `cod_records`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `commission_order_lines`
--
ALTER TABLE `commission_order_lines`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `commission_periods`
--
ALTER TABLE `commission_periods`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `commission_records`
--
ALTER TABLE `commission_records`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `companies`
--
ALTER TABLE `companies`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `customers`
--
ALTER TABLE `customers`
  MODIFY `customer_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `customer_address`
--
ALTER TABLE `customer_address`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `customer_assignment_history`
--
ALTER TABLE `customer_assignment_history`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `customer_blocks`
--
ALTER TABLE `customer_blocks`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `customer_logs`
--
ALTER TABLE `customer_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `env`
--
ALTER TABLE `env`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `exports`
--
ALTER TABLE `exports`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `google_sheet_shipping`
--
ALTER TABLE `google_sheet_shipping`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `marketing_ads_log`
--
ALTER TABLE `marketing_ads_log`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `marketing_user_page`
--
ALTER TABLE `marketing_user_page`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `notification_read_status`
--
ALTER TABLE `notification_read_status`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `notification_roles`
--
ALTER TABLE `notification_roles`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `notification_settings`
--
ALTER TABLE `notification_settings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `notification_users`
--
ALTER TABLE `notification_users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `onecall_batch`
--
ALTER TABLE `onecall_batch`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `onecall_log`
--
ALTER TABLE `onecall_log`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `order_boxes`
--
ALTER TABLE `order_boxes`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `order_box_collection_logs`
--
ALTER TABLE `order_box_collection_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `order_items`
--
ALTER TABLE `order_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `order_item_allocations`
--
ALTER TABLE `order_item_allocations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `order_sequences`
--
ALTER TABLE `order_sequences`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `order_slips`
--
ALTER TABLE `order_slips`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `order_status_logs`
--
ALTER TABLE `order_status_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `order_tracking_numbers`
--
ALTER TABLE `order_tracking_numbers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `pages`
--
ALTER TABLE `pages`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `page_engagement_batch`
--
ALTER TABLE `page_engagement_batch`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `page_engagement_log`
--
ALTER TABLE `page_engagement_log`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `page_list_user`
--
ALTER TABLE `page_list_user`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `page_stats_batch`
--
ALTER TABLE `page_stats_batch`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `page_stats_log`
--
ALTER TABLE `page_stats_log`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `page_user`
--
ALTER TABLE `page_user`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `platforms`
--
ALTER TABLE `platforms`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `products`
--
ALTER TABLE `products`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `product_lots`
--
ALTER TABLE `product_lots`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `promotions`
--
ALTER TABLE `promotions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `promotion_items`
--
ALTER TABLE `promotion_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `roles`
--
ALTER TABLE `roles`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `statement_batchs`
--
ALTER TABLE `statement_batchs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `statement_logs`
--
ALTER TABLE `statement_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `statement_reconcile_batches`
--
ALTER TABLE `statement_reconcile_batches`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `statement_reconcile_logs`
--
ALTER TABLE `statement_reconcile_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `stock_movements`
--
ALTER TABLE `stock_movements`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `stock_reservations`
--
ALTER TABLE `stock_reservations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `stock_transactions`
--
ALTER TABLE `stock_transactions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `stock_transaction_images`
--
ALTER TABLE `stock_transaction_images`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `stock_transaction_items`
--
ALTER TABLE `stock_transaction_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `tags`
--
ALTER TABLE `tags`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `user_daily_attendance`
--
ALTER TABLE `user_daily_attendance`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `user_login_history`
--
ALTER TABLE `user_login_history`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `user_pancake_mapping`
--
ALTER TABLE `user_pancake_mapping`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `user_permission_overrides`
--
ALTER TABLE `user_permission_overrides`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `user_tokens`
--
ALTER TABLE `user_tokens`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `warehouses`
--
ALTER TABLE `warehouses`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `warehouse_stocks`
--
ALTER TABLE `warehouse_stocks`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `cod_documents`
--
ALTER TABLE `cod_documents`
  ADD CONSTRAINT `fk_cod_documents_statement` FOREIGN KEY (`matched_statement_log_id`) REFERENCES `statement_logs` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_cod_documents_verified_by` FOREIGN KEY (`verified_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `cod_records`
--
ALTER TABLE `cod_records`
  ADD CONSTRAINT `fk_cod_records_document` FOREIGN KEY (`document_id`) REFERENCES `cod_documents` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `commission_order_lines`
--
ALTER TABLE `commission_order_lines`
  ADD CONSTRAINT `commission_order_lines_ibfk_1` FOREIGN KEY (`record_id`) REFERENCES `commission_records` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `commission_records`
--
ALTER TABLE `commission_records`
  ADD CONSTRAINT `commission_records_ibfk_1` FOREIGN KEY (`period_id`) REFERENCES `commission_periods` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `commission_records_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

--
-- Constraints for table `order_slips`
--
ALTER TABLE `order_slips`
  ADD CONSTRAINT `fk_order_slips_bank_account_id` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_account` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `statement_reconcile_batches`
--
ALTER TABLE `statement_reconcile_batches`
  ADD CONSTRAINT `fk_statement_reconcile_bank` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_account` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `statement_reconcile_logs`
--
ALTER TABLE `statement_reconcile_logs`
  ADD CONSTRAINT `fk_statement_reconcile_batch` FOREIGN KEY (`batch_id`) REFERENCES `statement_reconcile_batches` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_statement_reconcile_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_statement_reconcile_statement` FOREIGN KEY (`statement_log_id`) REFERENCES `statement_logs` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `stock_transaction_images`
--
ALTER TABLE `stock_transaction_images`
  ADD CONSTRAINT `fk_transaction_images_header` FOREIGN KEY (`transaction_id`) REFERENCES `stock_transactions` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `stock_transaction_items`
--
ALTER TABLE `stock_transaction_items`
  ADD CONSTRAINT `fk_transaction_items_header` FOREIGN KEY (`transaction_id`) REFERENCES `stock_transactions` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE RESTRICT;

--
-- Constraints for table `user_permission_overrides`
--
ALTER TABLE `user_permission_overrides`
  ADD CONSTRAINT `fk_user_permission_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_user_permission_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `user_tokens`
--
ALTER TABLE `user_tokens`
  ADD CONSTRAINT `fk_token_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
