-- phpMyAdmin SQL Dump
-- version 4.9.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Nov 04, 2025 at 04:24 AM
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
  `customer_id` varchar(32) NOT NULL,
  `timestamp` datetime NOT NULL,
  `type` varchar(64) NOT NULL,
  `description` text NOT NULL,
  `actor_name` varchar(128) NOT NULL
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
  `notes` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `appointments`
--

CREATE TABLE `appointments` (
  `id` int(11) NOT NULL,
  `customer_id` varchar(32) NOT NULL,
  `date` datetime NOT NULL,
  `title` varchar(255) NOT NULL,
  `status` varchar(64) NOT NULL,
  `notes` text
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `call_history`
--

CREATE TABLE `call_history` (
  `id` int(11) NOT NULL,
  `customer_id` varchar(32) NOT NULL,
  `date` datetime NOT NULL,
  `caller` varchar(128) NOT NULL,
  `status` varchar(64) NOT NULL,
  `result` varchar(255) NOT NULL,
  `crop_type` varchar(128) DEFAULT NULL,
  `area_size` varchar(128) DEFAULT NULL,
  `notes` text,
  `duration` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `companies`
--

CREATE TABLE `companies` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `address` text,
  `phone` varchar(64) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `tax_id` varchar(32) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customers`
--

CREATE TABLE `customers` (
  `id` varchar(32) NOT NULL,
  `first_name` varchar(128) NOT NULL,
  `last_name` varchar(128) NOT NULL,
  `phone` varchar(64) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `province` varchar(128) NOT NULL,
  `company_id` int(11) NOT NULL,
  `assigned_to` int(11) DEFAULT NULL,
  `date_assigned` datetime NOT NULL,
  `date_registered` datetime DEFAULT NULL,
  `follow_up_date` datetime DEFAULT NULL,
  `ownership_expires` datetime DEFAULT NULL,
  `lifecycle_status` enum('New','Old','FollowUp','Old3Months','DailyDistribution') DEFAULT NULL,
  `behavioral_status` enum('Hot','Warm','Cold','Frozen') DEFAULT NULL,
  `grade` enum('D','C','B','A','A+') DEFAULT NULL,
  `total_purchases` decimal(12,2) NOT NULL DEFAULT '0.00',
  `total_calls` int(11) NOT NULL DEFAULT '0',
  `facebook_name` varchar(255) DEFAULT NULL,
  `line_id` varchar(128) DEFAULT NULL,
  `street` varchar(255) DEFAULT NULL,
  `subdistrict` varchar(128) DEFAULT NULL,
  `district` varchar(128) DEFAULT NULL,
  `postal_code` varchar(16) DEFAULT NULL,
  `recipient_first_name` varchar(128) DEFAULT NULL,
  `recipient_last_name` varchar(128) DEFAULT NULL,
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
  `bucket_type` varchar(16) GENERATED ALWAYS AS ((case when (coalesce(`is_blocked`,0) = 1) then _utf8mb4'blocked' when (coalesce(`is_in_waiting_basket`,0) = 1) then _utf8mb4'waiting' when (`assigned_to` is null) then _utf8mb4'ready' else _utf8mb4'assigned' end)) STORED
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
        NEW.id,
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
            NEW.id,
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
                CASE WHEN OLD.bucket_type <> NEW.bucket_type THEN 'bucket_type' END,
                CASE WHEN OLD.lifecycle_status <> NEW.lifecycle_status THEN 'lifecycle_status' END,
                CASE WHEN OLD.assigned_to <> NEW.assigned_to THEN 'assigned_to' END
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
        OLD.id,
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
  `customer_id` varchar(32) NOT NULL,
  `user_id` int(11) NOT NULL,
  `assigned_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customer_blocks`
--

CREATE TABLE `customer_blocks` (
  `id` int(11) NOT NULL,
  `customer_id` varchar(64) NOT NULL,
  `reason` text NOT NULL,
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
  `customer_id` varchar(32) NOT NULL,
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
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `exports`
--

CREATE TABLE `exports` (
  `id` int(11) NOT NULL,
  `filename` varchar(255) NOT NULL,
  `file_path` varchar(1024) NOT NULL,
  `orders_count` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `exported_by` varchar(128) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `download_count` int(11) NOT NULL DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  `id` varchar(32) NOT NULL,
  `customer_id` varchar(32) NOT NULL,
  `company_id` int(11) NOT NULL,
  `creator_id` int(11) NOT NULL,
  `order_date` datetime NOT NULL,
  `delivery_date` datetime DEFAULT NULL,
  `street` varchar(255) DEFAULT NULL,
  `subdistrict` varchar(128) DEFAULT NULL,
  `district` varchar(128) DEFAULT NULL,
  `province` varchar(128) DEFAULT NULL,
  `postal_code` varchar(16) DEFAULT NULL,
  `recipient_first_name` varchar(128) DEFAULT NULL,
  `recipient_last_name` varchar(128) DEFAULT NULL,
  `shipping_cost` decimal(12,2) NOT NULL DEFAULT '0.00',
  `bill_discount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `total_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `payment_method` enum('COD','Transfer','PayAfter') DEFAULT NULL,
  `payment_status` enum('Unpaid','PendingVerification','Paid') DEFAULT NULL,
  `slip_url` varchar(1024) DEFAULT NULL,
  `amount_paid` decimal(12,2) DEFAULT NULL,
  `cod_amount` decimal(12,2) DEFAULT NULL,
  `order_status` enum('Pending','Picking','Shipping','Delivered','Returned','Cancelled') DEFAULT NULL,
  `notes` text,
  `ocr_payment_date` datetime DEFAULT NULL,
  `sales_channel` varchar(128) DEFAULT NULL,
  `sales_channel_page_id` int(11) DEFAULT NULL,
  `warehouse_id` int(11) DEFAULT NULL COMMENT 'รหัสคลังสินค้าที่จัดส่ง'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `order_boxes`
--

CREATE TABLE `order_boxes` (
  `id` int(11) NOT NULL,
  `order_id` varchar(32) NOT NULL,
  `box_number` int(11) NOT NULL,
  `cod_amount` decimal(12,2) NOT NULL DEFAULT '0.00'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `order_items`
--

CREATE TABLE `order_items` (
  `id` int(11) NOT NULL,
  `order_id` varchar(32) NOT NULL,
  `product_id` int(11) DEFAULT NULL COMMENT 'รหัสสินค้า (NULL สำหรับรายการโปรโมชั่น)',
  `product_name` varchar(255) DEFAULT NULL COMMENT 'ชื่อสินค้า (หรือชื่อโปรโมชั่นสำหรับ parent item)',
  `quantity` int(11) NOT NULL COMMENT 'จำนวน (สำหรับ parent = จำนวนเซ็ต, สำหรับ child = จำนวนชิ้น)',
  `price_per_unit` decimal(12,2) NOT NULL,
  `discount` decimal(12,2) NOT NULL DEFAULT '0.00',
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
  `order_id` varchar(32) NOT NULL COMMENT 'รหัสออเดอร์',
  `order_item_id` int(11) DEFAULT NULL COMMENT 'อ้างอิงไปยัง order_items.id (อาจว่างเมื่อสร้างจาก FE ที่ยังไม่มี mapping)',
  `product_id` int(11) NOT NULL COMMENT 'รหัสสินค้า',
  `promotion_id` int(11) DEFAULT NULL COMMENT 'ถ้ามาจากโปรโมชัน (อ้างอิง promotions.id)',
  `is_freebie` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'เป็นของแถมหรือไม่',
  `required_quantity` int(11) NOT NULL COMMENT 'จำนวนที่ต้องตัดสต๊อก (ต่อสินค้า)',
  `allocated_quantity` int(11) NOT NULL DEFAULT '0' COMMENT 'จำนวนที่จัดสรรแล้ว (รวมทุกคลัง/ล็อต)',
  `warehouse_id` int(11) DEFAULT NULL COMMENT 'คลังที่จัดสรร (ถ้ายังไม่เลือกปล่อยว่าง)',
  `lot_number` varchar(128) DEFAULT NULL COMMENT 'ล็อตที่จัดสรร (ถ้ายังไม่เลือกปล่อยว่าง)',
  `status` enum('PENDING','ALLOCATED','PICKED','SHIPPED','CANCELLED') NOT NULL DEFAULT 'PENDING' COMMENT 'สถานะการจัดสรร',
  `notes` text,
  `created_by` int(11) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `order_slips`
--

CREATE TABLE `order_slips` (
  `id` int(11) NOT NULL,
  `order_id` varchar(32) NOT NULL,
  `url` varchar(1024) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `order_tracking_numbers`
--

CREATE TABLE `order_tracking_numbers` (
  `id` int(11) NOT NULL,
  `order_id` varchar(32) NOT NULL,
  `tracking_number` varchar(128) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `pages`
--

CREATE TABLE `pages` (
  `id` int(11) NOT NULL,
  `page_id` varchar(255) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `platform` varchar(64) NOT NULL DEFAULT 'Facebook',
  `page_type` varchar(50) DEFAULT NULL COMMENT 'Type of page (e.g., business, personal, fan, etc.)',
  `url` varchar(1024) DEFAULT NULL,
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
-- Table structure for table `products`
--

CREATE TABLE `products` (
  `id` int(11) NOT NULL,
  `sku` varchar(64) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `category` varchar(128) NOT NULL,
  `unit` varchar(32) NOT NULL,
  `cost` decimal(12,2) NOT NULL DEFAULT '0.00',
  `price` decimal(12,2) NOT NULL DEFAULT '0.00',
  `stock` int(11) NOT NULL DEFAULT '0',
  `company_id` int(11) NOT NULL,
  `status` enum('Active','Inactive') NOT NULL DEFAULT 'Active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `product_lots`
--

CREATE TABLE `product_lots` (
  `id` int(11) NOT NULL,
  `lot_number` varchar(128) NOT NULL,
  `product_id` int(11) NOT NULL,
  `warehouse_id` int(11) NOT NULL,
  `purchase_date` date NOT NULL,
  `expiry_date` date DEFAULT NULL,
  `quantity_received` decimal(12,2) NOT NULL,
  `quantity_remaining` decimal(12,2) NOT NULL DEFAULT '0.00',
  `unit_cost` decimal(12,2) NOT NULL,
  `supplier_id` int(11) DEFAULT NULL,
  `supplier_invoice` varchar(128) DEFAULT NULL,
  `status` enum('Active','Depleted','Expired') DEFAULT 'Active',
  `notes` text,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `promotions`
--

CREATE TABLE `promotions` (
  `id` int(11) NOT NULL,
  `sku` varchar(64) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
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
-- Table structure for table `role_permissions`
--

CREATE TABLE `role_permissions` (
  `role` varchar(64) NOT NULL,
  `data` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `stock_movements`
--

CREATE TABLE `stock_movements` (
  `id` int(11) NOT NULL,
  `warehouse_id` int(11) NOT NULL COMMENT 'รหัสคลังสินค้า',
  `product_id` int(11) NOT NULL COMMENT 'รหัสสินค้า',
  `movement_type` enum('IN','OUT','TRANSFER','ADJUSTMENT') NOT NULL COMMENT 'ประเภทการเคลื่อนไหว',
  `quantity` int(11) NOT NULL COMMENT 'จำนวน',
  `lot_number` varchar(128) DEFAULT NULL COMMENT 'หมายเลข Lot',
  `reference_type` varchar(64) DEFAULT NULL COMMENT 'ประเภทเอกสารอ้างอิง (ORDER, PURCHASE, ADJUSTMENT)',
  `reference_id` varchar(64) DEFAULT NULL COMMENT 'รหัสเอกสารอ้างอิง',
  `reason` varchar(255) DEFAULT NULL COMMENT 'เหตุผล',
  `notes` text COMMENT 'หมายเหตุ',
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
  `order_id` varchar(32) DEFAULT NULL COMMENT 'รหัสออเดอร์',
  `quantity` int(11) NOT NULL COMMENT 'จำนวนที่จอง',
  `lot_number` varchar(128) DEFAULT NULL COMMENT 'หมายเลข Lot',
  `reserved_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันที่จอง',
  `expires_at` datetime DEFAULT NULL COMMENT 'วันหมดอายุการจอง',
  `status` enum('ACTIVE','RELEASED','EXPIRED') NOT NULL DEFAULT 'ACTIVE' COMMENT 'สถานะการจอง',
  `created_by` int(11) NOT NULL COMMENT 'ผู้จอง',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `tags`
--

CREATE TABLE `tags` (
  `id` int(11) NOT NULL,
  `name` varchar(128) NOT NULL,
  `type` enum('SYSTEM','USER') NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `username` varchar(64) NOT NULL,
  `password` varchar(255) DEFAULT NULL,
  `first_name` varchar(128) NOT NULL,
  `last_name` varchar(128) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(64) DEFAULT NULL,
  `role` varchar(64) NOT NULL,
  `company_id` int(11) NOT NULL,
  `team_id` int(11) DEFAULT NULL,
  `supervisor_id` int(11) DEFAULT NULL,
  `id_oth` varchar(191) DEFAULT NULL,
  `status` enum('active','inactive','resigned') NOT NULL DEFAULT 'active',
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
-- Table structure for table `user_pancake_mapping`
--

CREATE TABLE `user_pancake_mapping` (
  `id` int(11) NOT NULL,
  `id_user` int(11) NOT NULL,
  `id_panake` varchar(191) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
-- Stand-in structure for view `v_customer_buckets`
-- (See below for the actual view)
--
CREATE TABLE `v_customer_buckets` (
`id` varchar(32)
,`first_name` varchar(128)
,`last_name` varchar(128)
,`phone` varchar(64)
,`email` varchar(255)
,`province` varchar(128)
,`company_id` int(11)
,`assigned_to` int(11)
,`date_assigned` datetime
,`date_registered` datetime
,`follow_up_date` datetime
,`ownership_expires` datetime
,`lifecycle_status` enum('New','Old','FollowUp','Old3Months','DailyDistribution')
,`behavioral_status` enum('Hot','Warm','Cold','Frozen')
,`grade` enum('D','C','B','A','A+')
,`total_purchases` decimal(12,2)
,`total_calls` int(11)
,`facebook_name` varchar(255)
,`line_id` varchar(128)
,`street` varchar(255)
,`subdistrict` varchar(128)
,`district` varchar(128)
,`postal_code` varchar(16)
,`has_sold_before` tinyint(1)
,`follow_up_count` int(11)
,`last_follow_up_date` datetime
,`last_sale_date` datetime
,`is_in_waiting_basket` tinyint(1)
,`waiting_basket_start_date` datetime
,`followup_bonus_remaining` tinyint(1)
,`is_blocked` tinyint(1)
,`first_order_date` datetime
,`last_order_date` datetime
,`order_count` int(11)
,`is_new_customer` tinyint(1)
,`is_repeat_customer` tinyint(1)
,`bucket` varchar(8)
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
-- Table structure for table `warehouses`
--

CREATE TABLE `warehouses` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL COMMENT 'ชื่อคลังสินค้า',
  `company_id` int(11) NOT NULL COMMENT 'รหัสบริษัท',
  `address` text NOT NULL COMMENT 'ที่อยู่คลังสินค้า',
  `province` varchar(128) NOT NULL COMMENT 'จังหวัด',
  `district` varchar(128) NOT NULL COMMENT 'อำเภอ',
  `subdistrict` varchar(128) NOT NULL COMMENT 'ตำบล',
  `postal_code` varchar(16) DEFAULT NULL COMMENT 'รหัสไปรษณีย์',
  `phone` varchar(64) DEFAULT NULL COMMENT 'เบอร์โทรศัพท์',
  `email` varchar(255) DEFAULT NULL COMMENT 'อีเมล',
  `manager_name` varchar(255) DEFAULT NULL COMMENT 'ชื่อผู้จัดการคลัง',
  `manager_phone` varchar(64) DEFAULT NULL COMMENT 'เบอร์ผู้จัดการ',
  `responsible_provinces` text COMMENT 'จังหวัดที่รับผิดชอบ (JSON array)',
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
  `lot_number` varchar(128) DEFAULT NULL COMMENT 'หมายเลข Lot',
  `product_lot_id` int(11) DEFAULT NULL,
  `quantity` int(11) NOT NULL DEFAULT '0' COMMENT 'จำนวนคงเหลือ',
  `reserved_quantity` int(11) NOT NULL DEFAULT '0' COMMENT 'จำนวนที่จองไว้',
  `available_quantity` int(11) GENERATED ALWAYS AS ((`quantity` - `reserved_quantity`)) STORED COMMENT 'จำนวนที่ใช้ได้จริง',
  `expiry_date` date DEFAULT NULL COMMENT 'วันหมดอายุ',
  `purchase_price` decimal(12,2) DEFAULT NULL COMMENT 'ราคาซื้อ',
  `selling_price` decimal(12,2) DEFAULT NULL COMMENT 'ราคาขาย',
  `location_in_warehouse` varchar(255) DEFAULT NULL COMMENT 'ตำแหน่งในคลัง (เช่น A-1-2)',
  `notes` text COMMENT 'หมายเหตุ',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure for view `v_customer_buckets`
--
DROP TABLE IF EXISTS `v_customer_buckets`;

CREATE ALGORITHM=UNDEFINED DEFINER=`primacom_bloguser`@`localhost` SQL SECURITY DEFINER VIEW `v_customer_buckets`  AS  select `c`.`id` AS `id`,`c`.`first_name` AS `first_name`,`c`.`last_name` AS `last_name`,`c`.`phone` AS `phone`,`c`.`email` AS `email`,`c`.`province` AS `province`,`c`.`company_id` AS `company_id`,`c`.`assigned_to` AS `assigned_to`,`c`.`date_assigned` AS `date_assigned`,`c`.`date_registered` AS `date_registered`,`c`.`follow_up_date` AS `follow_up_date`,`c`.`ownership_expires` AS `ownership_expires`,`c`.`lifecycle_status` AS `lifecycle_status`,`c`.`behavioral_status` AS `behavioral_status`,`c`.`grade` AS `grade`,`c`.`total_purchases` AS `total_purchases`,`c`.`total_calls` AS `total_calls`,`c`.`facebook_name` AS `facebook_name`,`c`.`line_id` AS `line_id`,`c`.`street` AS `street`,`c`.`subdistrict` AS `subdistrict`,`c`.`district` AS `district`,`c`.`postal_code` AS `postal_code`,`c`.`has_sold_before` AS `has_sold_before`,`c`.`follow_up_count` AS `follow_up_count`,`c`.`last_follow_up_date` AS `last_follow_up_date`,`c`.`last_sale_date` AS `last_sale_date`,`c`.`is_in_waiting_basket` AS `is_in_waiting_basket`,`c`.`waiting_basket_start_date` AS `waiting_basket_start_date`,`c`.`followup_bonus_remaining` AS `followup_bonus_remaining`,`c`.`is_blocked` AS `is_blocked`,`c`.`first_order_date` AS `first_order_date`,`c`.`last_order_date` AS `last_order_date`,`c`.`order_count` AS `order_count`,`c`.`is_new_customer` AS `is_new_customer`,`c`.`is_repeat_customer` AS `is_repeat_customer`,(case when (coalesce(`c`.`is_blocked`,0) = 1) then 'blocked' when (coalesce(`c`.`is_in_waiting_basket`,0) = 1) then 'waiting' when (`c`.`assigned_to` is null) then 'ready' else 'assigned' end) AS `bucket` from `customers` `c` ;

-- --------------------------------------------------------

--
-- Structure for view `v_order_required_stock`
--
DROP TABLE IF EXISTS `v_order_required_stock`;

CREATE ALGORITHM=UNDEFINED DEFINER=`primacom_bloguser`@`localhost` SQL SECURITY DEFINER VIEW `v_order_required_stock`  AS  select `a`.`order_id` AS `order_id`,`a`.`product_id` AS `product_id`,sum(`a`.`required_quantity`) AS `required_qty`,sum(`a`.`allocated_quantity`) AS `allocated_qty`,sum((case when (`a`.`is_freebie` = 1) then `a`.`required_quantity` else 0 end)) AS `free_qty`,sum((case when (`a`.`is_freebie` = 0) then `a`.`required_quantity` else 0 end)) AS `paid_qty` from `order_item_allocations` `a` group by `a`.`order_id`,`a`.`product_id` ;

-- --------------------------------------------------------

--
-- Structure for view `v_telesale_call_overview_monthly`
--
DROP TABLE IF EXISTS `v_telesale_call_overview_monthly`;

CREATE ALGORITHM=UNDEFINED DEFINER=`primacom_bloguser`@`localhost` SQL SECURITY DEFINER VIEW `v_telesale_call_overview_monthly`  AS  with `users_ts` as (select `u`.`id` AS `id`,`u`.`first_name` AS `first_name`,`u`.`role` AS `role`,(cast(replace(replace(`u`.`phone`,'-',''),' ','') as char charset utf8mb4) collate utf8mb4_unicode_ci) AS `phone0` from `users` `u` where (`u`.`role` in ('Telesale','Supervisor Telesale'))), `calls` as (select `uts`.`id` AS `user_id`,date_format(`ocl`.`timestamp`,'%Y-%m') AS `month_key`,count(0) AS `total_calls`,sum((case when (`ocl`.`duration` >= 40) then 1 else 0 end)) AS `connected_calls`,round((sum(`ocl`.`duration`) / 60),2) AS `total_minutes` from (`onecall_log` `ocl` join `users_ts` `uts` on(((cast(concat('0',substr(replace(replace(`ocl`.`phone_telesale`,'-',''),' ',''),3)) as char charset utf8mb4) collate utf8mb4_unicode_ci) = `uts`.`phone0`))) group by `uts`.`id`,date_format(`ocl`.`timestamp`,'%Y-%m')), `attendance` as (select `uts`.`id` AS `user_id`,date_format(`a`.`work_date`,'%Y-%m') AS `month_key`,sum(`a`.`attendance_value`) AS `working_days` from (`user_daily_attendance` `a` join `users_ts` `uts` on((`uts`.`id` = `a`.`user_id`))) group by `uts`.`id`,date_format(`a`.`work_date`,'%Y-%m')), `months` as (select `calls`.`user_id` AS `user_id`,`calls`.`month_key` AS `month_key` from `calls` union select `attendance`.`user_id` AS `user_id`,`attendance`.`month_key` AS `month_key` from `attendance`) select `m`.`month_key` AS `month_key`,`uts`.`id` AS `user_id`,`uts`.`first_name` AS `first_name`,`uts`.`role` AS `role`,`uts`.`phone0` AS `phone`,coalesce(`att`.`working_days`,0) AS `working_days`,coalesce(`c`.`total_minutes`,0) AS `total_minutes`,coalesce(`c`.`connected_calls`,0) AS `connected_calls`,coalesce(`c`.`total_calls`,0) AS `total_calls`,round((coalesce(`c`.`total_minutes`,0) / nullif(coalesce(`att`.`working_days`,0),0)),2) AS `minutes_per_workday` from (((`months` `m` join `users_ts` `uts` on((`uts`.`id` = `m`.`user_id`))) left join `calls` `c` on(((`c`.`user_id` = `m`.`user_id`) and (`c`.`month_key` = `m`.`month_key`)))) left join `attendance` `att` on(((`att`.`user_id` = `m`.`user_id`) and (`att`.`month_key` = `m`.`month_key`)))) order by `m`.`month_key` desc,`uts`.`id` ;

-- --------------------------------------------------------

--
-- Structure for view `v_user_daily_attendance`
--
DROP TABLE IF EXISTS `v_user_daily_attendance`;

CREATE ALGORITHM=UNDEFINED DEFINER=`primacom_bloguser`@`localhost` SQL SECURITY DEFINER VIEW `v_user_daily_attendance`  AS  select `a`.`id` AS `id`,`a`.`user_id` AS `user_id`,`u`.`username` AS `username`,concat(`u`.`first_name`,' ',`u`.`last_name`) AS `full_name`,`u`.`role` AS `role`,`a`.`work_date` AS `work_date`,`a`.`first_login` AS `first_login`,`a`.`last_logout` AS `last_logout`,`a`.`login_sessions` AS `login_sessions`,`a`.`effective_seconds` AS `effective_seconds`,round((`a`.`effective_seconds` / 3600),2) AS `effective_hours`,`a`.`percent_of_workday` AS `percent_of_workday`,`a`.`attendance_value` AS `attendance_value`,`a`.`attendance_status` AS `attendance_status`,`a`.`computed_at` AS `computed_at`,`a`.`updated_at` AS `updated_at` from (`user_daily_attendance` `a` join `users` `u` on((`u`.`id` = `a`.`user_id`))) where (`u`.`role` in ('Telesale','Supervisor Telesale')) ;

-- --------------------------------------------------------

--
-- Structure for view `v_user_daily_kpis`
--
DROP TABLE IF EXISTS `v_user_daily_kpis`;

CREATE ALGORITHM=UNDEFINED DEFINER=`primacom_bloguser`@`localhost` SQL SECURITY DEFINER VIEW `v_user_daily_kpis`  AS  select `a`.`user_id` AS `user_id`,`u`.`username` AS `username`,concat(`u`.`first_name`,' ',`u`.`last_name`) AS `full_name`,`u`.`role` AS `role`,`a`.`work_date` AS `work_date`,`a`.`attendance_value` AS `attendance_value`,`a`.`attendance_status` AS `attendance_status`,`a`.`effective_seconds` AS `effective_seconds`,round((coalesce(sum(`ch`.`duration`),0) / 60),2) AS `call_minutes` from ((`user_daily_attendance` `a` join `users` `u` on((`u`.`id` = `a`.`user_id`))) left join `call_history` `ch` on(((cast(`ch`.`date` as date) = `a`.`work_date`) and (`ch`.`caller` = concat(`u`.`first_name`,' ',`u`.`last_name`))))) where (`u`.`role` in ('Telesale','Supervisor Telesale')) group by `a`.`id` ;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `activities`
--
ALTER TABLE `activities`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_activities_customer_id` (`customer_id`),
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
-- Indexes for table `address_sub_districts`
--
ALTER TABLE `address_sub_districts`
  ADD PRIMARY KEY (`id`),
  ADD KEY `district_id` (`district_id`),
  ADD KEY `zip_code` (`zip_code`);

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
  ADD KEY `idx_appointments_customer_id` (`customer_id`),
  ADD KEY `idx_appointments_date` (`date`),
  ADD KEY `idx_appointments_status` (`status`);

--
-- Indexes for table `call_history`
--
ALTER TABLE `call_history`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_call_history_customer_id` (`customer_id`);

--
-- Indexes for table `companies`
--
ALTER TABLE `companies`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `customers`
--
ALTER TABLE `customers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_customers_company` (`company_id`),
  ADD KEY `idx_customers_assigned_to` (`assigned_to`),
  ADD KEY `idx_customers_lifecycle_status` (`lifecycle_status`),
  ADD KEY `idx_customers_ownership_expires` (`ownership_expires`),
  ADD KEY `idx_customers_date_assigned` (`date_assigned`),
  ADD KEY `idx_customers_blocked` (`is_blocked`),
  ADD KEY `idx_customers_waiting` (`is_in_waiting_basket`);

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
  ADD UNIQUE KEY `uniq_customer_user_first` (`customer_id`,`user_id`),
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
  ADD PRIMARY KEY (`customer_id`,`tag_id`),
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
  ADD KEY `idx_exports_created_at` (`created_at`);

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
-- Indexes for table `onecall_batch`
--
ALTER TABLE `onecall_batch`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `onecall_log`
--
ALTER TABLE `onecall_log`
  ADD PRIMARY KEY (`id`),
  ADD KEY `batch_id` (`batch_id`),
  ADD KEY `idx_onecall_phone_ts` (`phone_telesale`,`timestamp`);

--
-- Indexes for table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_orders_creator` (`creator_id`),
  ADD KEY `idx_orders_company` (`company_id`),
  ADD KEY `idx_orders_customer` (`customer_id`),
  ADD KEY `fk_orders_page` (`sales_channel_page_id`),
  ADD KEY `fk_orders_warehouse` (`warehouse_id`);

--
-- Indexes for table `order_boxes`
--
ALTER TABLE `order_boxes`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_order_boxes_order` (`order_id`);

--
-- Indexes for table `order_items`
--
ALTER TABLE `order_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_order_items_order` (`order_id`),
  ADD KEY `fk_order_items_product` (`product_id`),
  ADD KEY `idx_order_items_promotion` (`promotion_id`),
  ADD KEY `idx_order_items_parent` (`parent_item_id`),
  ADD KEY `idx_order_items_promotion_parent` (`is_promotion_parent`);

--
-- Indexes for table `order_item_allocations`
--
ALTER TABLE `order_item_allocations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_allocations_order` (`order_id`),
  ADD KEY `idx_allocations_item` (`order_item_id`),
  ADD KEY `idx_allocations_product` (`product_id`),
  ADD KEY `idx_allocations_status` (`status`),
  ADD KEY `fk_allocations_warehouse` (`warehouse_id`),
  ADD KEY `fk_allocations_promotion` (`promotion_id`);

--
-- Indexes for table `order_slips`
--
ALTER TABLE `order_slips`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_order_slips_order` (`order_id`);

--
-- Indexes for table `order_tracking_numbers`
--
ALTER TABLE `order_tracking_numbers`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_order_tracking_order` (`order_id`);

--
-- Indexes for table `pages`
--
ALTER TABLE `pages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_pages_company` (`company_id`),
  ADD KEY `idx_still_in_list` (`still_in_list`),
  ADD KEY `idx_user_count` (`user_count`),
  ADD KEY `idx_page_id` (`page_id`),
  ADD KEY `idx_page_type` (`page_type`);

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
  ADD UNIQUE KEY `lot_number` (`lot_number`),
  ADD KEY `product_id` (`product_id`),
  ADD KEY `warehouse_id` (`warehouse_id`),
  ADD KEY `idx_lot_status` (`status`),
  ADD KEY `idx_lot_expiry` (`expiry_date`);

--
-- Indexes for table `promotions`
--
ALTER TABLE `promotions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_promotions_company` (`company_id`);

--
-- Indexes for table `promotion_items`
--
ALTER TABLE `promotion_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_pitems_promotion` (`promotion_id`),
  ADD KEY `fk_pitems_product` (`product_id`);

--
-- Indexes for table `role_permissions`
--
ALTER TABLE `role_permissions`
  ADD PRIMARY KEY (`role`);

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
  ADD KEY `fk_users_company` (`company_id`),
  ADD KEY `idx_users_status` (`status`),
  ADD KEY `idx_users_last_login` (`last_login`),
  ADD KEY `idx_users_id_oth` (`id_oth`),
  ADD KEY `idx_users_phone` (`phone`);

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
-- Indexes for table `user_tags`
--
ALTER TABLE `user_tags`
  ADD PRIMARY KEY (`user_id`,`tag_id`),
  ADD KEY `fk_user_tags_tag` (`tag_id`);

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
-- AUTO_INCREMENT for table `call_history`
--
ALTER TABLE `call_history`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `companies`
--
ALTER TABLE `companies`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

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
-- AUTO_INCREMENT for table `order_slips`
--
ALTER TABLE `order_slips`
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
-- Constraints for table `activities`
--
ALTER TABLE `activities`
  ADD CONSTRAINT `fk_activity_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `address_districts`
--
ALTER TABLE `address_districts`
  ADD CONSTRAINT `address_districts_ibfk_1` FOREIGN KEY (`province_id`) REFERENCES `address_provinces` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `address_provinces`
--
ALTER TABLE `address_provinces`
  ADD CONSTRAINT `address_provinces_ibfk_1` FOREIGN KEY (`geography_id`) REFERENCES `address_geographies` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `address_sub_districts`
--
ALTER TABLE `address_sub_districts`
  ADD CONSTRAINT `address_sub_districts_ibfk_1` FOREIGN KEY (`district_id`) REFERENCES `address_districts` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `ad_spend`
--
ALTER TABLE `ad_spend`
  ADD CONSTRAINT `fk_adspend_page` FOREIGN KEY (`page_id`) REFERENCES `pages` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `appointments`
--
ALTER TABLE `appointments`
  ADD CONSTRAINT `fk_appt_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `call_history`
--
ALTER TABLE `call_history`
  ADD CONSTRAINT `fk_call_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `customers`
--
ALTER TABLE `customers`
  ADD CONSTRAINT `fk_customers_assigned_to` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `fk_customers_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`);

--
-- Constraints for table `customer_assignment_history`
--
ALTER TABLE `customer_assignment_history`
  ADD CONSTRAINT `fk_cah_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_cah_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `customer_tags`
--
ALTER TABLE `customer_tags`
  ADD CONSTRAINT `fk_customer_tags_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_customer_tags_tag` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `marketing_ads_log`
--
ALTER TABLE `marketing_ads_log`
  ADD CONSTRAINT `fk_marketing_ads_log_page_id` FOREIGN KEY (`page_id`) REFERENCES `pages` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_marketing_ads_log_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `marketing_user_page`
--
ALTER TABLE `marketing_user_page`
  ADD CONSTRAINT `fk_marketing_user_page_page_id` FOREIGN KEY (`page_id`) REFERENCES `pages` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_marketing_user_page_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;


--
-- Constraints for table `onecall_log`
--
ALTER TABLE `onecall_log`
  ADD CONSTRAINT `onecall_log_ibfk_1` FOREIGN KEY (`batch_id`) REFERENCES `onecall_batch` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `orders`
--
ALTER TABLE `orders`
  ADD CONSTRAINT `fk_orders_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`),
  ADD CONSTRAINT `fk_orders_creator` FOREIGN KEY (`creator_id`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `fk_orders_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  ADD CONSTRAINT `fk_orders_page` FOREIGN KEY (`sales_channel_page_id`) REFERENCES `pages` (`id`),
  ADD CONSTRAINT `fk_orders_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`);

--
-- Constraints for table `order_boxes`
--
ALTER TABLE `order_boxes`
  ADD CONSTRAINT `fk_order_boxes_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `order_items`
--
ALTER TABLE `order_items`
  ADD CONSTRAINT `fk_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_order_items_parent` FOREIGN KEY (`parent_item_id`) REFERENCES `order_items` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_order_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  ADD CONSTRAINT `fk_order_items_promotion` FOREIGN KEY (`promotion_id`) REFERENCES `promotions` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `order_item_allocations`
--
ALTER TABLE `order_item_allocations`
  ADD CONSTRAINT `fk_allocations_item` FOREIGN KEY (`order_item_id`) REFERENCES `order_items` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_allocations_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_allocations_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_allocations_promotion` FOREIGN KEY (`promotion_id`) REFERENCES `promotions` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_allocations_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `order_slips`
--
ALTER TABLE `order_slips`
  ADD CONSTRAINT `fk_order_slips_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `order_tracking_numbers`
--
ALTER TABLE `order_tracking_numbers`
  ADD CONSTRAINT `fk_order_tracking_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `pages`
--
ALTER TABLE `pages`
  ADD CONSTRAINT `fk_pages_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`);

--
-- Constraints for table `page_engagement_log`
--
ALTER TABLE `page_engagement_log`
  ADD CONSTRAINT `fk_page_engagement_log_batch` FOREIGN KEY (`batch_id`) REFERENCES `page_engagement_batch` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `page_stats_log`
--
ALTER TABLE `page_stats_log`
  ADD CONSTRAINT `page_stats_log_ibfk_1` FOREIGN KEY (`batch_id`) REFERENCES `page_stats_batch` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `products`
--
ALTER TABLE `products`
  ADD CONSTRAINT `fk_products_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`);

--
-- Constraints for table `product_lots`
--
ALTER TABLE `product_lots`
  ADD CONSTRAINT `product_lots_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `product_lots_ibfk_2` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `promotions`
--
ALTER TABLE `promotions`
  ADD CONSTRAINT `fk_promotions_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`);

--
-- Constraints for table `promotion_items`
--
ALTER TABLE `promotion_items`
  ADD CONSTRAINT `fk_pitems_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  ADD CONSTRAINT `fk_pitems_promotion` FOREIGN KEY (`promotion_id`) REFERENCES `promotions` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `stock_movements`
--
ALTER TABLE `stock_movements`
  ADD CONSTRAINT `fk_stock_movements_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_stock_movements_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `fk_stock_movements_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `stock_reservations`
--
ALTER TABLE `stock_reservations`
  ADD CONSTRAINT `fk_stock_reservations_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_stock_reservations_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_stock_reservations_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `fk_stock_reservations_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `fk_users_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`);

--
-- Constraints for table `user_daily_attendance`
--
ALTER TABLE `user_daily_attendance`
  ADD CONSTRAINT `fk_attendance_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `user_login_history`
--
ALTER TABLE `user_login_history`
  ADD CONSTRAINT `user_login_history_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `user_pancake_mapping`
--
ALTER TABLE `user_pancake_mapping`
  ADD CONSTRAINT `fk_upm_user` FOREIGN KEY (`id_user`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `user_tags`
--
ALTER TABLE `user_tags`
  ADD CONSTRAINT `fk_user_tags_tag` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_user_tags_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `warehouses`
--
ALTER TABLE `warehouses`
  ADD CONSTRAINT `fk_warehouses_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `warehouse_stocks`
--
ALTER TABLE `warehouse_stocks`
  ADD CONSTRAINT `fk_warehouse_stocks_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_warehouse_stocks_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
