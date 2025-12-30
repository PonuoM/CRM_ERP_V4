-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Dec 26, 2025 at 08:28 AM
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
-- Database: `primacom_Customer`
--

-- --------------------------------------------------------

--
-- Table structure for table `activity_logs`
--

CREATE TABLE `activity_logs` (
  `id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `company_id` int(11) DEFAULT NULL,
  `activity_type` varchar(50) NOT NULL,
  `table_name` varchar(50) DEFAULT NULL,
  `record_id` int(11) DEFAULT NULL,
  `action` varchar(20) NOT NULL,
  `description` text DEFAULT NULL,
  `old_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`old_values`)),
  `new_values` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`new_values`)),
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `appointments`
--

CREATE TABLE `appointments` (
  `appointment_id` int(11) NOT NULL,
  `company_id` int(11) DEFAULT NULL,
  `customer_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `call_log_id` int(11) DEFAULT NULL,
  `appointment_date` datetime NOT NULL,
  `appointment_type` enum('call','meeting','presentation','followup','follow_up_call','other') NOT NULL,
  `appointment_status` enum('scheduled','confirmed','completed','cancelled','no_show') DEFAULT 'scheduled',
  `location` varchar(200) DEFAULT NULL,
  `contact_person` varchar(100) DEFAULT NULL,
  `contact_phone` varchar(20) DEFAULT NULL,
  `title` varchar(200) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `reminder_sent` tinyint(1) DEFAULT 0,
  `reminder_sent_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Triggers `appointments`
--
DELIMITER $$
CREATE TRIGGER `after_appointment_delete` AFTER DELETE ON `appointments` FOR EACH ROW BEGIN
       UPDATE customers 
       SET appointment_count = GREATEST(appointment_count - 1, 0),
           updated_at = NOW()
       WHERE customer_id = OLD.customer_id;
   END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `after_appointment_insert` AFTER INSERT ON `appointments` FOR EACH ROW BEGIN
       UPDATE customers 
       SET appointment_count = appointment_count + 1,
           last_appointment_date = NEW.appointment_date,
           updated_at = NOW()
       WHERE customer_id = NEW.customer_id;
   END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `bi_appointments_set_company` BEFORE INSERT ON `appointments` FOR EACH ROW BEGIN
    DECLARE c_company2 INT DEFAULT NULL;
    IF NEW.customer_id IS NOT NULL THEN
        SELECT company_id INTO c_company2 FROM customers WHERE customer_id = NEW.customer_id LIMIT 1;
        SET NEW.company_id = c_company2;
    END IF;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `appointment_activities`
--

CREATE TABLE `appointment_activities` (
  `activity_id` int(11) NOT NULL,
  `appointment_id` int(11) NOT NULL,
  `company_id` int(11) DEFAULT NULL,
  `user_id` int(11) NOT NULL,
  `activity_type` enum('created','updated','confirmed','completed','cancelled','reminder_sent') NOT NULL,
  `activity_description` text NOT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `appointment_extensions`
--

CREATE TABLE `appointment_extensions` (
  `extension_id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `appointment_id` int(11) DEFAULT NULL COMMENT 'ID ของการนัดหมายที่ทำให้เกิดการต่อเวลา (NULL ถ้าเป็นการต่อเวลาอัตโนมัติ)',
  `extension_type` enum('appointment','sale','manual') NOT NULL COMMENT 'ประเภทการต่อเวลา: appointment=จากนัดหมาย, sale=จากการขาย, manual=ต่อเวลาด้วยตนเอง',
  `extension_days` int(11) NOT NULL COMMENT 'จำนวนวันที่ต่อเวลา',
  `extension_reason` varchar(200) DEFAULT NULL COMMENT 'เหตุผลการต่อเวลา',
  `previous_expiry` timestamp NULL DEFAULT NULL COMMENT 'วันหมดอายุเดิม',
  `new_expiry` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00' COMMENT 'วันหมดอายุใหม่',
  `extension_count_before` int(11) NOT NULL COMMENT 'จำนวนครั้งที่ต่อเวลาก่อนการต่อเวลานี้',
  `extension_count_after` int(11) NOT NULL COMMENT 'จำนวนครั้งที่ต่อเวลาหลังการต่อเวลานี้',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `appointment_extension_rules`
--

CREATE TABLE `appointment_extension_rules` (
  `rule_id` int(11) NOT NULL,
  `rule_name` varchar(100) NOT NULL,
  `rule_description` text DEFAULT NULL,
  `extension_days` int(11) NOT NULL DEFAULT 30 COMMENT 'จำนวนวันที่ต่อเวลาต่อการนัดหมาย 1 ครั้ง',
  `max_extensions` int(11) NOT NULL DEFAULT 3 COMMENT 'จำนวนครั้งสูงสุดที่สามารถต่อเวลาได้',
  `reset_on_sale` tinyint(1) DEFAULT 1 COMMENT 'รีเซ็ตตัวนับเมื่อมีการขาย',
  `min_appointment_duration` int(11) DEFAULT 0 COMMENT 'ระยะเวลาขั้นต่ำของการนัดหมาย (นาที)',
  `required_appointment_status` enum('completed','confirmed','scheduled') DEFAULT 'completed' COMMENT 'สถานะการนัดหมายที่จำเป็น',
  `min_customer_grade` enum('A+','A','B','C','D') DEFAULT 'D' COMMENT 'เกรดลูกค้าขั้นต่ำ',
  `temperature_status_filter` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'สถานะอุณหภูมิที่ใช้ได้ (JSON array)' CHECK (json_valid(`temperature_status_filter`)),
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `call_followup_queue`
--

CREATE TABLE `call_followup_queue` (
  `queue_id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `call_log_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL COMMENT 'ผู้ที่ต้องติดตาม',
  `followup_date` date NOT NULL COMMENT 'วันที่ต้องติดตาม',
  `priority` enum('low','medium','high','urgent') DEFAULT 'medium',
  `status` enum('pending','in_progress','completed','cancelled') DEFAULT 'pending',
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `call_followup_rules`
--

CREATE TABLE `call_followup_rules` (
  `rule_id` int(11) NOT NULL,
  `call_result` enum('interested','not_interested','callback','order','complaint') NOT NULL,
  `followup_days` int(11) NOT NULL DEFAULT 0 COMMENT 'จำนวนวันที่ต้องติดตามกลับ',
  `priority` enum('low','medium','high','urgent') DEFAULT 'medium',
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `call_logs`
--

CREATE TABLE `call_logs` (
  `log_id` int(11) NOT NULL,
  `company_id` int(11) DEFAULT NULL,
  `customer_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `call_type` enum('outbound','inbound') DEFAULT 'outbound',
  `call_status` enum('answered','no_answer','busy','invalid') NOT NULL,
  `call_result` enum('interested','not_interested','callback','order','complaint') DEFAULT NULL,
  `duration_minutes` int(11) DEFAULT 0,
  `notes` text DEFAULT NULL,
  `next_action` varchar(200) DEFAULT NULL,
  `next_followup_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `followup_notes` text DEFAULT NULL,
  `followup_days` int(11) DEFAULT 0,
  `followup_priority` enum('low','medium','high','urgent') DEFAULT 'medium' COMMENT 'ความสำคัญของการติดตาม',
  `status_display` varchar(100) DEFAULT NULL,
  `result_display` varchar(100) DEFAULT NULL,
  `plant_variety` varchar(255) DEFAULT NULL COMMENT 'พืชพันธุ์ที่ลูกค้าปลูก',
  `garden_size` varchar(100) DEFAULT NULL COMMENT 'ขนาดสวน (ไร่/ตารางวา/ตารางเมตร)'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Triggers `call_logs`
--
DELIMITER $$
CREATE TRIGGER `bi_call_logs_set_company` BEFORE INSERT ON `call_logs` FOR EACH ROW BEGIN
    DECLARE c_company3 INT DEFAULT NULL;
    IF NEW.customer_id IS NOT NULL THEN
        SELECT company_id INTO c_company3 FROM customers WHERE customer_id = NEW.customer_id LIMIT 1;
        SET NEW.company_id = c_company3;
    END IF;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `companies`
--

CREATE TABLE `companies` (
  `company_id` int(11) NOT NULL,
  `company_name` varchar(100) NOT NULL,
  `company_code` varchar(20) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `cron_job_logs`
--

CREATE TABLE `cron_job_logs` (
  `id` int(11) NOT NULL,
  `job_name` varchar(100) NOT NULL,
  `status` enum('running','success','failed') NOT NULL,
  `start_time` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `end_time` timestamp NULL DEFAULT NULL,
  `execution_time` decimal(8,2) DEFAULT NULL,
  `output` text DEFAULT NULL,
  `error_message` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `cron_job_settings`
--

CREATE TABLE `cron_job_settings` (
  `id` int(11) NOT NULL,
  `job_name` varchar(100) NOT NULL,
  `cron_expression` varchar(100) NOT NULL,
  `is_enabled` tinyint(1) DEFAULT 1,
  `last_run` timestamp NULL DEFAULT NULL,
  `next_run` timestamp NULL DEFAULT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customers`
--

CREATE TABLE `customers` (
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
  `appointment_count` int(11) DEFAULT 0 COMMENT 'จำนวนการนัดหมายที่ทำไปแล้ว',
  `appointment_extension_count` int(11) DEFAULT 0 COMMENT 'จำนวนครั้งที่ต่อเวลาจากการนัดหมาย',
  `last_appointment_date` timestamp NULL DEFAULT NULL COMMENT 'วันที่นัดหมายล่าสุด',
  `appointment_extension_expiry` timestamp NULL DEFAULT NULL COMMENT 'วันหมดอายุการต่อเวลาจากการนัดหมาย',
  `max_appointment_extensions` int(11) DEFAULT 3 COMMENT 'จำนวนครั้งสูงสุดที่สามารถต่อเวลาได้ (default: 3)',
  `appointment_extension_days` int(11) DEFAULT 30 COMMENT 'จำนวนวันที่ต่อเวลาต่อการนัดหมาย 1 ครั้ง (default: 30 วัน)',
  `customer_status` enum('new','existing','existing_3m','followup','call_followup','daily_distribution') DEFAULT 'new',
  `customer_time_extension` int(11) DEFAULT 0 COMMENT 'จำนวนวันที่ต่อเวลาแล้ว',
  `customer_time_base` timestamp NULL DEFAULT NULL COMMENT 'วันเริ่มต้นการดูแลลูกค้า',
  `customer_time_expiry` timestamp NULL DEFAULT NULL COMMENT 'วันหมดอายุการดูแลลูกค้า',
  `plant_variety` varchar(255) DEFAULT NULL COMMENT 'พืชพันธุ์ที่ลูกค้าปลูก',
  `garden_size` varchar(100) DEFAULT NULL COMMENT 'ขนาดสวน (ไร่/ตารางวา/ตารางเมตร)',
  `is_blocked` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Triggers `customers`
--
DELIMITER $$
CREATE TRIGGER `after_customer_block` AFTER UPDATE ON `customers` FOR EACH ROW BEGIN
    -- Log การเปลี่ยน basket_type เป็น block
    IF OLD.basket_type != 'block' AND NEW.basket_type = 'block' THEN
        INSERT INTO `activity_logs` (
            `user_id`, 
            `company_id`, 
            `activity_type`, 
            `table_name`, 
            `record_id`, 
            `action`, 
            `description`, 
            `old_values`, 
            `new_values`
        ) VALUES (
            NULL, -- จะถูกอัปเดตจาก application
            NEW.company_id,
            'customer_block',
            'customers',
            NEW.customer_id,
            'block',
            CONCAT('ลูกค้า ', NEW.first_name, ' ', NEW.last_name, ' ถูก block'),
            JSON_OBJECT('basket_type', OLD.basket_type, 'assigned_to', OLD.assigned_to),
            JSON_OBJECT('basket_type', NEW.basket_type, 'assigned_to', NEW.assigned_to)
        );
    END IF;
    
    -- Log การเปลี่ยน basket_type จาก block
    IF OLD.basket_type = 'block' AND NEW.basket_type != 'block' THEN
        INSERT INTO `activity_logs` (
            `user_id`, 
            `company_id`, 
            `activity_type`, 
            `table_name`, 
            `record_id`, 
            `action`, 
            `description`, 
            `old_values`, 
            `new_values`
        ) VALUES (
            NULL, -- จะถูกอัปเดตจาก application
            NEW.company_id,
            'customer_unblock',
            'customers',
            NEW.customer_id,
            'unblock',
            CONCAT('ลูกค้า ', NEW.first_name, ' ', NEW.last_name, ' ถูก unblock'),
            JSON_OBJECT('basket_type', OLD.basket_type, 'assigned_to', OLD.assigned_to),
            JSON_OBJECT('basket_type', NEW.basket_type, 'assigned_to', NEW.assigned_to)
        );
    END IF;
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `bi_customers_enforce_company` BEFORE INSERT ON `customers` FOR EACH ROW BEGIN
    DECLARE u_company INT DEFAULT NULL;
    IF NEW.assigned_to IS NOT NULL THEN
        SELECT company_id INTO u_company FROM users WHERE user_id = NEW.assigned_to LIMIT 1;
        IF u_company IS NOT NULL AND NEW.company_id IS NOT NULL AND u_company <> NEW.company_id THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'assigned_to user must belong to the same company';
        END IF;
    END IF;
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `bu_customers_enforce_company` BEFORE UPDATE ON `customers` FOR EACH ROW BEGIN
    DECLARE u_company2 INT DEFAULT NULL;
    IF NEW.assigned_to IS NOT NULL THEN
        SELECT company_id INTO u_company2 FROM users WHERE user_id = NEW.assigned_to LIMIT 1;
        IF u_company2 IS NOT NULL AND NEW.company_id IS NOT NULL AND u_company2 <> NEW.company_id THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'assigned_to user must belong to the same company';
        END IF;
    END IF;
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `trg_customers_ad_log` AFTER DELETE ON `customers` FOR EACH ROW BEGIN
  INSERT INTO customer_change_logs (customer_id, assigned_to, basket_type, customer_status)
  VALUES (OLD.customer_id, OLD.assigned_to, OLD.basket_type, OLD.customer_status);
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `trg_customers_ai_log` AFTER INSERT ON `customers` FOR EACH ROW BEGIN
  INSERT INTO customer_change_logs (customer_id, assigned_to, basket_type, customer_status)
  VALUES (NEW.customer_id, NEW.assigned_to, NEW.basket_type, NEW.customer_status);
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `trg_customers_au_log` AFTER UPDATE ON `customers` FOR EACH ROW BEGIN
  IF NOT (
       NEW.assigned_to   <=> OLD.assigned_to
   AND NEW.basket_type   <=> OLD.basket_type
   AND NEW.customer_status <=> OLD.customer_status
  ) THEN
    INSERT INTO customer_change_logs (customer_id, assigned_to, basket_type, customer_status)
    VALUES (NEW.customer_id, NEW.assigned_to, NEW.basket_type, NEW.customer_status);
  END IF;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `customers_backup_20250905_waiting_company1`
--

CREATE TABLE `customers_backup_20250905_waiting_company1` (
  `customer_id` int(11) NOT NULL DEFAULT 0,
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
  `basket_type` enum('distribution','waiting','assigned','expired') DEFAULT 'distribution',
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
  `appointment_count` int(11) DEFAULT 0 COMMENT 'จำนวนการนัดหมายที่ทำไปแล้ว',
  `appointment_extension_count` int(11) DEFAULT 0 COMMENT 'จำนวนครั้งที่ต่อเวลาจากการนัดหมาย',
  `last_appointment_date` timestamp NULL DEFAULT NULL COMMENT 'วันที่นัดหมายล่าสุด',
  `appointment_extension_expiry` timestamp NULL DEFAULT NULL COMMENT 'วันหมดอายุการต่อเวลาจากการนัดหมาย',
  `max_appointment_extensions` int(11) DEFAULT 3 COMMENT 'จำนวนครั้งสูงสุดที่สามารถต่อเวลาได้ (default: 3)',
  `appointment_extension_days` int(11) DEFAULT 30 COMMENT 'จำนวนวันที่ต่อเวลาต่อการนัดหมาย 1 ครั้ง (default: 30 วัน)',
  `customer_status` enum('new','existing','followup','call_followup','daily_distribution') DEFAULT 'new',
  `customer_time_extension` int(11) DEFAULT 0 COMMENT 'จำนวนวันที่ต่อเวลาแล้ว',
  `customer_time_base` timestamp NULL DEFAULT NULL COMMENT 'วันเริ่มต้นการดูแลลูกค้า',
  `customer_time_expiry` timestamp NULL DEFAULT NULL COMMENT 'วันหมดอายุการดูแลลูกค้า'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Stand-in structure for view `customer_3months_view`
-- (See below for the actual view)
--
CREATE TABLE `customer_3months_view` (
`customer_id` int(11)
,`company_id` int(11)
,`customer_code` varchar(50)
,`first_name` varchar(50)
,`last_name` varchar(50)
,`phone` varchar(20)
,`email` varchar(100)
,`address` text
,`district` varchar(50)
,`province` varchar(50)
,`postal_code` varchar(10)
,`temperature_status` enum('hot','warm','cold','frozen')
,`customer_grade` enum('A+','A','B','C','D')
,`total_purchase_amount` decimal(12,2)
,`assigned_to` int(11)
,`basket_type` enum('distribution','waiting','assigned','expired','block')
,`assigned_at` timestamp
,`last_contact_at` timestamp
,`next_followup_at` timestamp
,`recall_at` timestamp
,`recall_reason` varchar(100)
,`source` varchar(50)
,`notes` text
,`is_active` tinyint(1)
,`created_at` timestamp
,`updated_at` timestamp
,`appointment_count` int(11)
,`appointment_extension_count` int(11)
,`last_appointment_date` timestamp
,`appointment_extension_expiry` timestamp
,`max_appointment_extensions` int(11)
,`appointment_extension_days` int(11)
,`customer_status` enum('new','existing','existing_3m','followup','call_followup','daily_distribution')
,`customer_time_extension` int(11)
,`customer_time_base` timestamp
,`customer_time_expiry` timestamp
,`plant_variety` varchar(255)
,`garden_size` varchar(100)
,`status_text` varchar(18)
,`is_3months_customer` int(1)
,`recent_3months_sales` decimal(34,2)
);

-- --------------------------------------------------------

--
-- Table structure for table `customer_activities`
--

CREATE TABLE `customer_activities` (
  `activity_id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `activity_type` enum('status_change','assignment','call','order','note','recall') NOT NULL,
  `activity_date` date DEFAULT NULL,
  `activity_description` text NOT NULL,
  `old_value` varchar(200) DEFAULT NULL,
  `new_value` varchar(200) DEFAULT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Stand-in structure for view `customer_appointment_extensions`
-- (See below for the actual view)
--
CREATE TABLE `customer_appointment_extensions` (
`customer_id` int(11)
,`customer_name` varchar(101)
,`customer_grade` enum('A+','A','B','C','D')
,`temperature_status` enum('hot','warm','cold','frozen')
,`appointment_count` int(11)
,`appointment_extension_count` int(11)
,`max_appointment_extensions` int(11)
,`appointment_extension_expiry` timestamp
,`appointment_extension_days` int(11)
,`last_appointment_date` timestamp
,`expiry_status` varchar(15)
,`extension_status` varchar(23)
,`assigned_user` varchar(50)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `customer_blocked_list`
-- (See below for the actual view)
--
CREATE TABLE `customer_blocked_list` (
`customer_id` int(11)
,`company_id` int(11)
,`customer_code` varchar(50)
,`first_name` varchar(50)
,`last_name` varchar(50)
,`phone` varchar(20)
,`email` varchar(100)
,`address` text
,`district` varchar(50)
,`province` varchar(50)
,`postal_code` varchar(10)
,`temperature_status` enum('hot','warm','cold','frozen')
,`customer_grade` enum('A+','A','B','C','D')
,`total_purchase_amount` decimal(12,2)
,`assigned_to` int(11)
,`basket_type` enum('distribution','waiting','assigned','expired','block')
,`assigned_at` timestamp
,`last_contact_at` timestamp
,`next_followup_at` timestamp
,`recall_at` timestamp
,`recall_reason` varchar(100)
,`source` varchar(50)
,`notes` text
,`is_active` tinyint(1)
,`created_at` timestamp
,`updated_at` timestamp
,`customer_status` enum('new','existing','existing_3m','followup','call_followup','daily_distribution')
,`customer_time_expiry` timestamp
,`block_id` int(11)
,`block_reason` text
,`block_date` timestamp
,`blocked_by` int(11)
,`blocked_by_name` varchar(100)
,`previous_basket_type` enum('distribution','waiting','assigned','expired')
,`previous_assigned_to` int(11)
,`previous_assigned_to_name` varchar(100)
,`days_blocked` int(8)
);

-- --------------------------------------------------------

--
-- Table structure for table `customer_blocks`
--

CREATE TABLE `customer_blocks` (
  `block_id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `company_id` int(11) DEFAULT NULL,
  `blocked_by` int(11) NOT NULL COMMENT 'ผู้ที่ทำการ block',
  `block_reason` text NOT NULL COMMENT 'เหตุผลการ block (ขั้นต่ำ 5 ตัวอักษร)',
  `previous_basket_type` enum('distribution','waiting','assigned','expired') NOT NULL COMMENT 'basket_type เดิม',
  `previous_assigned_to` int(11) DEFAULT NULL COMMENT 'ผู้ดูแลเดิม',
  `block_date` timestamp NOT NULL DEFAULT current_timestamp() COMMENT 'วันที่ block',
  `is_active` tinyint(1) DEFAULT 1 COMMENT 'สถานะการ block (1=block, 0=unblock)',
  `unblocked_by` int(11) DEFAULT NULL COMMENT 'ผู้ที่ทำการ unblock',
  `unblock_reason` text DEFAULT NULL COMMENT 'เหตุผลการ unblock',
  `unblock_date` timestamp NULL DEFAULT NULL COMMENT 'วันที่ unblock',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Stand-in structure for view `customer_call_followup_list`
-- (See below for the actual view)
--
CREATE TABLE `customer_call_followup_list` (
`customer_id` int(11)
,`customer_code` varchar(50)
,`first_name` varchar(50)
,`last_name` varchar(50)
,`phone` varchar(20)
,`email` varchar(100)
,`province` varchar(50)
,`temperature_status` enum('hot','warm','cold','frozen')
,`customer_grade` enum('A+','A','B','C','D')
,`assigned_to` int(11)
,`assigned_to_name` varchar(100)
,`call_log_id` int(11)
,`call_result` enum('interested','not_interested','callback','order','complaint')
,`call_status` enum('answered','no_answer','busy','invalid')
,`last_call_date` timestamp
,`next_followup_at` timestamp
,`followup_notes` text
,`followup_days` int(11)
,`followup_priority` enum('low','medium','high','urgent')
,`queue_id` int(11)
,`followup_date` date
,`queue_status` enum('pending','in_progress','completed','cancelled')
,`queue_priority` enum('low','medium','high','urgent')
,`days_until_followup` int(8)
,`urgency_status` varchar(7)
);

-- --------------------------------------------------------

--
-- Table structure for table `customer_change_logs`
--

CREATE TABLE `customer_change_logs` (
  `log_id` bigint(20) UNSIGNED NOT NULL,
  `customer_id` int(11) NOT NULL,
  `assigned_to` int(11) DEFAULT NULL,
  `basket_type` enum('distribution','waiting','assigned','expired','block') DEFAULT NULL,
  `customer_status` enum('new','existing','existing_3m','followup','call_followup','daily_distribution') DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Stand-in structure for view `customer_do_list`
-- (See below for the actual view)
--
CREATE TABLE `customer_do_list` (
`customer_id` int(11)
,`company_id` int(11)
,`customer_code` varchar(50)
,`first_name` varchar(50)
,`last_name` varchar(50)
,`phone` varchar(20)
,`email` varchar(100)
,`address` text
,`district` varchar(50)
,`province` varchar(50)
,`postal_code` varchar(10)
,`temperature_status` enum('hot','warm','cold','frozen')
,`customer_grade` enum('A+','A','B','C','D')
,`total_purchase_amount` decimal(12,2)
,`assigned_to` int(11)
,`basket_type` enum('distribution','waiting','assigned','expired','block')
,`assigned_at` timestamp
,`last_contact_at` timestamp
,`next_followup_at` timestamp
,`recall_at` timestamp
,`recall_reason` varchar(100)
,`source` varchar(50)
,`notes` text
,`is_active` tinyint(1)
,`created_at` timestamp
,`updated_at` timestamp
,`appointment_count` int(11)
,`appointment_extension_count` int(11)
,`last_appointment_date` timestamp
,`appointment_extension_expiry` timestamp
,`max_appointment_extensions` int(11)
,`appointment_extension_days` int(11)
,`customer_status` enum('new','existing','existing_3m','followup','call_followup','daily_distribution')
,`customer_time_extension` int(11)
,`customer_time_base` timestamp
,`customer_time_expiry` timestamp
,`days_remaining` int(8)
,`status_text` varchar(18)
,`urgency_status` varchar(11)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `customer_do_list_new`
-- (See below for the actual view)
--
CREATE TABLE `customer_do_list_new` (
`customer_id` int(11)
,`company_id` int(11)
,`customer_code` varchar(50)
,`first_name` varchar(50)
,`last_name` varchar(50)
,`phone` varchar(20)
,`email` varchar(100)
,`address` text
,`district` varchar(50)
,`province` varchar(50)
,`postal_code` varchar(10)
,`temperature_status` enum('hot','warm','cold','frozen')
,`customer_grade` enum('A+','A','B','C','D')
,`total_purchase_amount` decimal(12,2)
,`assigned_to` int(11)
,`basket_type` enum('distribution','waiting','assigned','expired','block')
,`assigned_at` timestamp
,`last_contact_at` timestamp
,`next_followup_at` timestamp
,`recall_at` timestamp
,`recall_reason` varchar(100)
,`source` varchar(50)
,`notes` text
,`is_active` tinyint(1)
,`created_at` timestamp
,`updated_at` timestamp
,`appointment_count` int(11)
,`appointment_extension_count` int(11)
,`last_appointment_date` timestamp
,`appointment_extension_expiry` timestamp
,`max_appointment_extensions` int(11)
,`appointment_extension_days` int(11)
,`customer_status` enum('new','existing','existing_3m','followup','call_followup','daily_distribution')
,`customer_time_extension` int(11)
,`customer_time_base` timestamp
,`customer_time_expiry` timestamp
,`plant_variety` varchar(255)
,`garden_size` varchar(100)
,`status_text` varchar(18)
,`urgency_status` varchar(11)
,`has_called_from_current_assigned` int(1)
,`should_appear_in_do` int(1)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `customer_do_view`
-- (See below for the actual view)
--
CREATE TABLE `customer_do_view` (
`customer_id` int(11)
,`company_id` int(11)
,`customer_code` varchar(50)
,`first_name` varchar(50)
,`last_name` varchar(50)
,`phone` varchar(20)
,`email` varchar(100)
,`address` text
,`district` varchar(50)
,`province` varchar(50)
,`postal_code` varchar(10)
,`temperature_status` enum('hot','warm','cold','frozen')
,`customer_grade` enum('A+','A','B','C','D')
,`total_purchase_amount` decimal(12,2)
,`assigned_to` int(11)
,`basket_type` enum('distribution','waiting','assigned','expired','block')
,`assigned_at` timestamp
,`last_contact_at` timestamp
,`next_followup_at` timestamp
,`recall_at` timestamp
,`recall_reason` varchar(100)
,`source` varchar(50)
,`notes` text
,`is_active` tinyint(1)
,`created_at` timestamp
,`updated_at` timestamp
,`appointment_count` int(11)
,`appointment_extension_count` int(11)
,`last_appointment_date` timestamp
,`appointment_extension_expiry` timestamp
,`max_appointment_extensions` int(11)
,`appointment_extension_days` int(11)
,`customer_status` enum('new','existing','existing_3m','followup','call_followup','daily_distribution')
,`customer_time_extension` int(11)
,`customer_time_base` timestamp
,`customer_time_expiry` timestamp
,`plant_variety` varchar(255)
,`garden_size` varchar(100)
,`do_category` varchar(18)
,`do_priority` int(1)
,`do_order_date` varchar(19)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `customer_existing_3m_list`
-- (See below for the actual view)
--
CREATE TABLE `customer_existing_3m_list` (
`customer_id` int(11)
,`customer_code` varchar(50)
,`first_name` varchar(50)
,`last_name` varchar(50)
,`phone` varchar(20)
,`email` varchar(100)
,`address` text
,`district` varchar(50)
,`province` varchar(50)
,`postal_code` varchar(10)
,`temperature_status` enum('hot','warm','cold','frozen')
,`customer_grade` enum('A+','A','B','C','D')
,`total_purchase_amount` decimal(12,2)
,`assigned_to` int(11)
,`basket_type` enum('distribution','waiting','assigned','expired','block')
,`assigned_at` timestamp
,`last_contact_at` timestamp
,`next_followup_at` timestamp
,`recall_at` timestamp
,`source` varchar(50)
,`notes` text
,`is_active` tinyint(1)
,`created_at` timestamp
,`updated_at` timestamp
,`customer_status` enum('new','existing','existing_3m','followup','call_followup','daily_distribution')
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `customer_existing_list`
-- (See below for the actual view)
--
CREATE TABLE `customer_existing_list` (
`customer_id` int(11)
,`company_id` int(11)
,`customer_code` varchar(50)
,`first_name` varchar(50)
,`last_name` varchar(50)
,`phone` varchar(20)
,`email` varchar(100)
,`address` text
,`district` varchar(50)
,`province` varchar(50)
,`postal_code` varchar(10)
,`temperature_status` enum('hot','warm','cold','frozen')
,`customer_grade` enum('A+','A','B','C','D')
,`total_purchase_amount` decimal(12,2)
,`assigned_to` int(11)
,`basket_type` enum('distribution','waiting','assigned','expired','block')
,`assigned_at` timestamp
,`last_contact_at` timestamp
,`next_followup_at` timestamp
,`recall_at` timestamp
,`recall_reason` varchar(100)
,`source` varchar(50)
,`notes` text
,`is_active` tinyint(1)
,`created_at` timestamp
,`updated_at` timestamp
,`appointment_count` int(11)
,`appointment_extension_count` int(11)
,`last_appointment_date` timestamp
,`appointment_extension_expiry` timestamp
,`max_appointment_extensions` int(11)
,`appointment_extension_days` int(11)
,`customer_status` enum('new','existing','existing_3m','followup','call_followup','daily_distribution')
,`customer_time_extension` int(11)
,`customer_time_base` timestamp
,`customer_time_expiry` timestamp
,`status_text` varchar(18)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `customer_expiry_list`
-- (See below for the actual view)
--
CREATE TABLE `customer_expiry_list` (
`customer_id` int(11)
,`company_id` int(11)
,`customer_code` varchar(50)
,`first_name` varchar(50)
,`last_name` varchar(50)
,`phone` varchar(20)
,`email` varchar(100)
,`address` text
,`district` varchar(50)
,`province` varchar(50)
,`postal_code` varchar(10)
,`temperature_status` enum('hot','warm','cold','frozen')
,`customer_grade` enum('A+','A','B','C','D')
,`total_purchase_amount` decimal(12,2)
,`assigned_to` int(11)
,`basket_type` enum('distribution','waiting','assigned','expired','block')
,`assigned_at` timestamp
,`last_contact_at` timestamp
,`next_followup_at` timestamp
,`recall_at` timestamp
,`recall_reason` varchar(100)
,`source` varchar(50)
,`notes` text
,`is_active` tinyint(1)
,`created_at` timestamp
,`updated_at` timestamp
,`appointment_count` int(11)
,`appointment_extension_count` int(11)
,`last_appointment_date` timestamp
,`appointment_extension_expiry` timestamp
,`max_appointment_extensions` int(11)
,`appointment_extension_days` int(11)
,`customer_status` enum('new','existing','existing_3m','followup','call_followup','daily_distribution')
,`customer_time_extension` int(11)
,`customer_time_base` timestamp
,`customer_time_expiry` timestamp
,`plant_variety` varchar(255)
,`garden_size` varchar(100)
,`days_remaining` int(8)
,`status_text` varchar(18)
,`urgency_status` varchar(11)
);

-- --------------------------------------------------------

--
-- Table structure for table `customer_followup_list`
--

CREATE ALGORITHM=UNDEFINED DEFINER=`primacom_bloguser`@`localhost` SQL SECURITY DEFINER VIEW `customer_followup_list`  AS SELECT `c`.`customer_id` AS `customer_id`, `c`.`customer_code` AS `customer_code`, `c`.`first_name` AS `first_name`, `c`.`last_name` AS `last_name`, `c`.`phone` AS `phone`, `c`.`email` AS `email`, `c`.`address` AS `address`, `c`.`district` AS `district`, `c`.`province` AS `province`, `c`.`postal_code` AS `postal_code`, `c`.`temperature_status` AS `temperature_status`, `c`.`customer_grade` AS `customer_grade`, `c`.`total_purchase_amount` AS `total_purchase_amount`, `c`.`assigned_to` AS `assigned_to`, `c`.`basket_type` AS `basket_type`, `c`.`assigned_at` AS `assigned_at`, `c`.`last_contact_at` AS `last_contact_at`, `c`.`next_followup_at` AS `next_followup_at`, `c`.`recall_at` AS `recall_at`, `c`.`source` AS `source`, `c`.`notes` AS `notes`, `c`.`is_active` AS `is_active`, `c`.`created_at` AS `created_at`, `c`.`updated_at` AS `updated_at`, `c`.`total_purchase` AS `total_purchase`, `c`.`appointment_count` AS `appointment_count`, `c`.`appointment_extension_count` AS `appointment_extension_count`, `c`.`last_appointment_date` AS `last_appointment_date`, `c`.`appointment_extension_expiry` AS `appointment_extension_expiry`, `c`.`max_appointment_extensions` AS `max_appointment_extensions`, `c`.`appointment_extension_days` AS `appointment_extension_days`, `c`.`customer_status` AS `customer_status`, `c`.`customer_time_extension` AS `customer_time_extension`, `c`.`customer_time_base` AS `customer_time_base`, `c`.`customer_time_expiry` AS `customer_time_expiry`, to_days(`c`.`next_followup_at`) - to_days(current_timestamp()) AS `followup_days_remaining` FROM `customers` AS `c` WHERE `c`.`assigned_to` is not null AND `c`.`basket_type` = 'assigned' AND `c`.`next_followup_at` is not null AND `c`.`next_followup_at` <= current_timestamp() AND `c`.`is_active` = 1 ;

-- --------------------------------------------------------

--
-- Table structure for table `customer_info_tags`
--

CREATE TABLE `customer_info_tags` (
  `id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `tag_name` varchar(100) NOT NULL,
  `tag_color` varchar(7) DEFAULT '#6c757d',
  `created_by` int(11) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customer_new_list`
--

CREATE ALGORITHM=UNDEFINED DEFINER=`primacom_bloguser`@`localhost` SQL SECURITY DEFINER VIEW `customer_new_list`  AS SELECT `c`.`customer_id` AS `customer_id`, `c`.`customer_code` AS `customer_code`, `c`.`first_name` AS `first_name`, `c`.`last_name` AS `last_name`, `c`.`phone` AS `phone`, `c`.`email` AS `email`, `c`.`address` AS `address`, `c`.`district` AS `district`, `c`.`province` AS `province`, `c`.`postal_code` AS `postal_code`, `c`.`temperature_status` AS `temperature_status`, `c`.`customer_grade` AS `customer_grade`, `c`.`total_purchase_amount` AS `total_purchase_amount`, `c`.`assigned_to` AS `assigned_to`, `c`.`basket_type` AS `basket_type`, `c`.`assigned_at` AS `assigned_at`, `c`.`last_contact_at` AS `last_contact_at`, `c`.`next_followup_at` AS `next_followup_at`, `c`.`recall_at` AS `recall_at`, `c`.`source` AS `source`, `c`.`notes` AS `notes`, `c`.`is_active` AS `is_active`, `c`.`created_at` AS `created_at`, `c`.`updated_at` AS `updated_at`, `c`.`total_purchase` AS `total_purchase`, `c`.`appointment_count` AS `appointment_count`, `c`.`appointment_extension_count` AS `appointment_extension_count`, `c`.`last_appointment_date` AS `last_appointment_date`, `c`.`appointment_extension_expiry` AS `appointment_extension_expiry`, `c`.`max_appointment_extensions` AS `max_appointment_extensions`, `c`.`appointment_extension_days` AS `appointment_extension_days`, `c`.`customer_status` AS `customer_status`, `c`.`customer_time_extension` AS `customer_time_extension`, `c`.`customer_time_base` AS `customer_time_base`, `c`.`customer_time_expiry` AS `customer_time_expiry`, to_days(`c`.`customer_time_expiry`) - to_days(current_timestamp()) AS `days_remaining` FROM `customers` AS `c` WHERE `c`.`assigned_to` is not null AND `c`.`basket_type` = 'assigned' AND `c`.`customer_status` = 'new' AND `c`.`is_active` = 1 ;

-- --------------------------------------------------------

--
-- Table structure for table `customer_recalls`
--

CREATE TABLE `customer_recalls` (
  `recall_id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `recall_type` enum('timeout','manual','system') NOT NULL,
  `recall_reason` varchar(200) DEFAULT NULL,
  `previous_basket` enum('distribution','waiting','assigned') NOT NULL,
  `new_basket` enum('distribution','waiting','assigned') NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customer_recall_list`
--

CREATE TABLE `customer_recall_list` (
  `id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `priority` int(11) NOT NULL DEFAULT 0,
  `days_since_contact` int(11) NOT NULL,
  `created_date` date NOT NULL,
  `assigned_to` int(11) DEFAULT NULL,
  `status` enum('pending','assigned','contacted','completed') DEFAULT 'pending',
  `notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customer_tags`
--

CREATE TABLE `customer_tags` (
  `tag_id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `tag_name` varchar(50) NOT NULL,
  `tag_color` varchar(7) DEFAULT '#007bff',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customer_time_extensions`
--

CREATE TABLE `customer_time_extensions` (
  `extension_id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `extension_type` enum('sale','appointment','manual') NOT NULL,
  `extension_days` int(11) NOT NULL,
  `previous_expiry` timestamp NULL DEFAULT NULL,
  `new_expiry` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `reason` varchar(200) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customer_transfers`
--

CREATE TABLE `customer_transfers` (
  `transfer_id` int(11) NOT NULL,
  `company_id` int(11) DEFAULT NULL,
  `source_telesales_id` int(11) NOT NULL,
  `target_telesales_id` int(11) NOT NULL,
  `customer_count` int(11) NOT NULL,
  `reason` text NOT NULL,
  `transferred_by` int(11) NOT NULL,
  `transferred_by_name` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customer_transfer_details`
--

CREATE TABLE `customer_transfer_details` (
  `detail_id` int(11) NOT NULL,
  `transfer_id` int(11) NOT NULL,
  `company_id` int(11) DEFAULT NULL,
  `customer_id` int(11) NOT NULL,
  `customer_code` varchar(50) DEFAULT NULL,
  `customer_name` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `company_id` int(11) DEFAULT NULL,
  `type` varchar(50) NOT NULL,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `is_read` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `orders`
--

CREATE TABLE `orders` (
  `order_id` int(11) NOT NULL,
  `company_id` int(11) DEFAULT NULL,
  `order_number` varchar(50) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `created_by` int(11) NOT NULL,
  `order_date` date NOT NULL,
  `total_amount` decimal(12,2) NOT NULL,
  `discount_amount` decimal(10,2) DEFAULT 0.00,
  `discount_percentage` decimal(5,2) DEFAULT 0.00,
  `net_amount` decimal(12,2) NOT NULL,
  `payment_method` enum('cash','transfer','cod','credit','other') DEFAULT 'cash',
  `payment_status` enum('pending','paid','partial','cancelled','returned') DEFAULT 'pending',
  `delivery_date` date DEFAULT NULL,
  `delivery_address` text DEFAULT NULL,
  `delivery_status` enum('pending','confirmed','shipped','delivered','cancelled') DEFAULT 'pending',
  `notes` text DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Triggers `orders`
--
DELIMITER $$
CREATE TRIGGER `bi_orders_set_company` BEFORE INSERT ON `orders` FOR EACH ROW BEGIN
    DECLARE c_company INT DEFAULT NULL;
    IF NEW.customer_id IS NOT NULL THEN
        SELECT company_id INTO c_company FROM customers WHERE customer_id = NEW.customer_id LIMIT 1;
        SET NEW.company_id = c_company;
    END IF;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `orders_backup_20250904`
--

CREATE TABLE `orders_backup_20250904` (
  `order_id` int(11) NOT NULL DEFAULT 0,
  `company_id` int(11) DEFAULT NULL,
  `order_number` varchar(50) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `created_by` int(11) NOT NULL,
  `order_date` date NOT NULL,
  `total_amount` decimal(12,2) NOT NULL,
  `discount_amount` decimal(10,2) DEFAULT 0.00,
  `discount_percentage` decimal(5,2) DEFAULT 0.00,
  `net_amount` decimal(12,2) NOT NULL,
  `payment_method` enum('cash','transfer','cod','credit','other') DEFAULT 'cash',
  `payment_status` enum('pending','paid','partial','cancelled','returned') DEFAULT 'pending',
  `delivery_date` date DEFAULT NULL,
  `delivery_address` text DEFAULT NULL,
  `delivery_status` enum('pending','confirmed','shipped','delivered','cancelled') DEFAULT 'pending',
  `notes` text DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `order_activities`
--

CREATE TABLE `order_activities` (
  `activity_id` int(11) NOT NULL,
  `order_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `activity_type` enum('created','status_update','payment_update','delivery_update','cancelled') NOT NULL,
  `description` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `order_details`
--

CREATE TABLE `order_details` (
  `detail_id` int(11) NOT NULL,
  `order_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `total_price` decimal(12,2) NOT NULL,
  `discount_amount` decimal(10,2) DEFAULT 0.00,
  `net_price` decimal(12,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `order_items`
--

CREATE TABLE `order_items` (
  `item_id` int(11) NOT NULL,
  `order_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `total_price` decimal(12,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `order_items_backup_20250904`
--

CREATE TABLE `order_items_backup_20250904` (
  `item_id` int(11) NOT NULL DEFAULT 0,
  `order_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `quantity` int(11) NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `total_price` decimal(12,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `predefined_tags`
--

CREATE TABLE `predefined_tags` (
  `id` int(11) NOT NULL,
  `tag_name` varchar(50) NOT NULL,
  `tag_color` varchar(7) NOT NULL,
  `is_global` tinyint(1) DEFAULT 0,
  `created_by` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `products`
--

CREATE TABLE `products` (
  `product_id` int(11) NOT NULL,
  `company_id` int(11) DEFAULT NULL,
  `product_code` varchar(50) NOT NULL,
  `product_name` varchar(200) NOT NULL,
  `category` varchar(100) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `unit` varchar(20) DEFAULT 'ชิ้น',
  `cost_price` decimal(10,2) DEFAULT 0.00,
  `selling_price` decimal(10,2) NOT NULL,
  `stock_quantity` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `roles`
--

CREATE TABLE `roles` (
  `role_id` int(11) NOT NULL,
  `role_name` varchar(50) NOT NULL,
  `role_description` text DEFAULT NULL,
  `permissions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`permissions`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `sales_history`
--

CREATE TABLE `sales_history` (
  `history_id` int(11) NOT NULL,
  `customer_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `assigned_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `unassigned_at` timestamp NULL DEFAULT NULL,
  `reason` varchar(200) DEFAULT NULL,
  `total_orders` int(11) DEFAULT 0,
  `total_sales` decimal(12,2) DEFAULT 0.00,
  `is_current` tinyint(1) DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `system_settings`
--

CREATE TABLE `system_settings` (
  `setting_id` int(11) NOT NULL,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text DEFAULT NULL,
  `setting_type` enum('string','number','boolean','json') DEFAULT 'string',
  `description` text DEFAULT NULL,
  `is_editable` tinyint(1) DEFAULT 1,
  `updated_by` int(11) DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `test_phone`
--

CREATE TABLE `test_phone` (
  `id` int(11) NOT NULL,
  `phone` bigint(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `user_id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `full_name` varchar(100) NOT NULL,
  `email` varchar(100) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `role_id` int(11) NOT NULL,
  `company_id` int(11) DEFAULT NULL,
  `supervisor_id` int(11) DEFAULT NULL COMMENT 'References user_id of supervisor who manages this user',
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `last_login` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `_tmp_map`
--

CREATE TABLE `_tmp_map` (
  `dup_id` int(11) NOT NULL DEFAULT 0,
  `master_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `_tmp_master_by_company`
--

CREATE TABLE `_tmp_master_by_company` (
  `company_id` int(11) NOT NULL,
  `phone9` varchar(9) NOT NULL,
  `master_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `_tmp_null_candidates`
--

CREATE TABLE `_tmp_null_candidates` (
  `dup_id` int(11) NOT NULL DEFAULT 0,
  `target_company_id` int(11) DEFAULT NULL,
  `phone9` varchar(9) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `_tmp_phone9`
--

CREATE TABLE `_tmp_phone9` (
  `customer_id` int(11) NOT NULL DEFAULT 0,
  `company_id` int(11) DEFAULT NULL,
  `phone9` varchar(9) NOT NULL,
  `assigned_to` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Structure for view `customer_3months_view`
--
DROP TABLE IF EXISTS `customer_3months_view`;

CREATE ALGORITHM=UNDEFINED DEFINER=`primacom_bloguser`@`localhost` SQL SECURITY DEFINER VIEW `customer_3months_view`  AS SELECT `c`.`customer_id` AS `customer_id`, `c`.`company_id` AS `company_id`, `c`.`customer_code` AS `customer_code`, `c`.`first_name` AS `first_name`, `c`.`last_name` AS `last_name`, `c`.`phone` AS `phone`, `c`.`email` AS `email`, `c`.`address` AS `address`, `c`.`district` AS `district`, `c`.`province` AS `province`, `c`.`postal_code` AS `postal_code`, `c`.`temperature_status` AS `temperature_status`, `c`.`customer_grade` AS `customer_grade`, `c`.`total_purchase_amount` AS `total_purchase_amount`, `c`.`assigned_to` AS `assigned_to`, `c`.`basket_type` AS `basket_type`, `c`.`assigned_at` AS `assigned_at`, `c`.`last_contact_at` AS `last_contact_at`, `c`.`next_followup_at` AS `next_followup_at`, `c`.`recall_at` AS `recall_at`, `c`.`recall_reason` AS `recall_reason`, `c`.`source` AS `source`, `c`.`notes` AS `notes`, `c`.`is_active` AS `is_active`, `c`.`created_at` AS `created_at`, `c`.`updated_at` AS `updated_at`, `c`.`appointment_count` AS `appointment_count`, `c`.`appointment_extension_count` AS `appointment_extension_count`, `c`.`last_appointment_date` AS `last_appointment_date`, `c`.`appointment_extension_expiry` AS `appointment_extension_expiry`, `c`.`max_appointment_extensions` AS `max_appointment_extensions`, `c`.`appointment_extension_days` AS `appointment_extension_days`, `c`.`customer_status` AS `customer_status`, `c`.`customer_time_extension` AS `customer_time_extension`, `c`.`customer_time_base` AS `customer_time_base`, `c`.`customer_time_expiry` AS `customer_time_expiry`, `c`.`plant_variety` AS `plant_variety`, `c`.`garden_size` AS `garden_size`, CASE WHEN `c`.`customer_status` = 'new' THEN 'ลูกค้าใหม่' WHEN `c`.`customer_status` = 'existing' THEN 'ลูกค้าเก่า' WHEN `c`.`customer_status` = 'existing_3m' THEN 'ลูกค้าเก่า 3 เดือน' WHEN `c`.`customer_status` = 'followup' THEN 'ติดตาม' WHEN `c`.`customer_status` = 'call_followup' THEN 'ติดตามโทร' WHEN `c`.`customer_status` = 'daily_distribution' THEN 'แจกรายวัน' ELSE 'ไม่ทราบสถานะ' END AS `status_text`, CASE WHEN `c`.`customer_status` = 'existing_3m' THEN 1 ELSE 0 END AS `is_3months_customer`, coalesce(`recent_sales`.`total_amount`,0) AS `recent_3months_sales` FROM (`customers` `c` left join (select `o`.`customer_id` AS `customer_id`,sum(`o`.`total_amount`) AS `total_amount` from `orders` `o` where `o`.`order_date` >= current_timestamp() - interval 90 day and `o`.`payment_status` in ('paid','partial') group by `o`.`customer_id`) `recent_sales` on(`c`.`customer_id` = `recent_sales`.`customer_id`)) WHERE `c`.`is_active` = 1 ;

-- --------------------------------------------------------

--
-- Structure for view `customer_appointment_extensions`
--
DROP TABLE IF EXISTS `customer_appointment_extensions`;

CREATE ALGORITHM=UNDEFINED DEFINER=`primacom_bloguser`@`localhost` SQL SECURITY DEFINER VIEW `customer_appointment_extensions`  AS SELECT `c`.`customer_id` AS `customer_id`, concat(`c`.`first_name`,' ',`c`.`last_name`) AS `customer_name`, `c`.`customer_grade` AS `customer_grade`, `c`.`temperature_status` AS `temperature_status`, `c`.`appointment_count` AS `appointment_count`, `c`.`appointment_extension_count` AS `appointment_extension_count`, `c`.`max_appointment_extensions` AS `max_appointment_extensions`, `c`.`appointment_extension_expiry` AS `appointment_extension_expiry`, `c`.`appointment_extension_days` AS `appointment_extension_days`, `c`.`last_appointment_date` AS `last_appointment_date`, CASE WHEN `c`.`appointment_extension_expiry` is null THEN 'ไม่มีวันหมดอายุ' WHEN `c`.`appointment_extension_expiry` < current_timestamp() THEN 'หมดอายุแล้ว' ELSE 'ยังไม่หมดอายุ' END AS `expiry_status`, CASE WHEN `c`.`appointment_extension_count` >= `c`.`max_appointment_extensions` THEN 'ไม่สามารถต่อเวลาได้แล้ว' ELSE 'สามารถต่อเวลาได้' END AS `extension_status`, `u`.`username` AS `assigned_user` FROM (`customers` `c` left join `users` `u` on(`c`.`assigned_to` = `u`.`user_id`)) WHERE `c`.`is_active` = 1 ;

-- --------------------------------------------------------

--
-- Structure for view `customer_blocked_list`
--
DROP TABLE IF EXISTS `customer_blocked_list`;

CREATE ALGORITHM=UNDEFINED DEFINER=`primacom_bloguser`@`localhost` SQL SECURITY DEFINER VIEW `customer_blocked_list`  AS SELECT `c`.`customer_id` AS `customer_id`, `c`.`company_id` AS `company_id`, `c`.`customer_code` AS `customer_code`, `c`.`first_name` AS `first_name`, `c`.`last_name` AS `last_name`, `c`.`phone` AS `phone`, `c`.`email` AS `email`, `c`.`address` AS `address`, `c`.`district` AS `district`, `c`.`province` AS `province`, `c`.`postal_code` AS `postal_code`, `c`.`temperature_status` AS `temperature_status`, `c`.`customer_grade` AS `customer_grade`, `c`.`total_purchase_amount` AS `total_purchase_amount`, `c`.`assigned_to` AS `assigned_to`, `c`.`basket_type` AS `basket_type`, `c`.`assigned_at` AS `assigned_at`, `c`.`last_contact_at` AS `last_contact_at`, `c`.`next_followup_at` AS `next_followup_at`, `c`.`recall_at` AS `recall_at`, `c`.`recall_reason` AS `recall_reason`, `c`.`source` AS `source`, `c`.`notes` AS `notes`, `c`.`is_active` AS `is_active`, `c`.`created_at` AS `created_at`, `c`.`updated_at` AS `updated_at`, `c`.`customer_status` AS `customer_status`, `c`.`customer_time_expiry` AS `customer_time_expiry`, `cb`.`block_id` AS `block_id`, `cb`.`block_reason` AS `block_reason`, `cb`.`block_date` AS `block_date`, `cb`.`blocked_by` AS `blocked_by`, `u`.`full_name` AS `blocked_by_name`, `cb`.`previous_basket_type` AS `previous_basket_type`, `cb`.`previous_assigned_to` AS `previous_assigned_to`, `u2`.`full_name` AS `previous_assigned_to_name`, to_days(current_timestamp()) - to_days(`cb`.`block_date`) AS `days_blocked` FROM (((`customers` `c` left join `customer_blocks` `cb` on(`c`.`customer_id` = `cb`.`customer_id` and `cb`.`is_active` = 1)) left join `users` `u` on(`cb`.`blocked_by` = `u`.`user_id`)) left join `users` `u2` on(`cb`.`previous_assigned_to` = `u2`.`user_id`)) WHERE `c`.`basket_type` = 'block' AND `c`.`is_active` = 1 ;

-- --------------------------------------------------------

--
-- Structure for view `customer_call_followup_list`
--
DROP TABLE IF EXISTS `customer_call_followup_list`;

CREATE ALGORITHM=UNDEFINED DEFINER=`primacom_bloguser`@`localhost` SQL SECURITY DEFINER VIEW `customer_call_followup_list`  AS SELECT `c`.`customer_id` AS `customer_id`, `c`.`customer_code` AS `customer_code`, `c`.`first_name` AS `first_name`, `c`.`last_name` AS `last_name`, `c`.`phone` AS `phone`, `c`.`email` AS `email`, `c`.`province` AS `province`, `c`.`temperature_status` AS `temperature_status`, `c`.`customer_grade` AS `customer_grade`, `c`.`assigned_to` AS `assigned_to`, `u`.`full_name` AS `assigned_to_name`, `cl`.`log_id` AS `call_log_id`, `cl`.`call_result` AS `call_result`, `cl`.`call_status` AS `call_status`, `cl`.`created_at` AS `last_call_date`, `cl`.`next_followup_at` AS `next_followup_at`, `cl`.`followup_notes` AS `followup_notes`, `cl`.`followup_days` AS `followup_days`, `cl`.`followup_priority` AS `followup_priority`, `cfq`.`queue_id` AS `queue_id`, `cfq`.`followup_date` AS `followup_date`, `cfq`.`status` AS `queue_status`, `cfq`.`priority` AS `queue_priority`, to_days(`cl`.`next_followup_at`) - to_days(current_timestamp()) AS `days_until_followup`, CASE WHEN `cl`.`next_followup_at` <= current_timestamp() THEN 'overdue' WHEN `cl`.`next_followup_at` <= current_timestamp() + interval 3 day THEN 'urgent' WHEN `cl`.`next_followup_at` <= current_timestamp() + interval 7 day THEN 'soon' ELSE 'normal' END AS `urgency_status` FROM (((`customers` `c` left join `users` `u` on(`c`.`assigned_to` = `u`.`user_id`)) left join `call_logs` `cl` on(`c`.`customer_id` = `cl`.`customer_id`)) left join `call_followup_queue` `cfq` on(`c`.`customer_id` = `cfq`.`customer_id` and `cfq`.`status` = 'pending')) WHERE `c`.`is_active` = 1 AND `c`.`assigned_to` is not null AND `cl`.`next_followup_at` is not null AND `cl`.`next_followup_at` <= current_timestamp() + interval 30 day AND `cl`.`call_result` in ('not_interested','callback','interested','complaint') ORDER BY `cl`.`next_followup_at` ASC, `cl`.`followup_priority` DESC ;

-- --------------------------------------------------------

--
-- Structure for view `customer_do_list`
--
DROP TABLE IF EXISTS `customer_do_list`;

CREATE ALGORITHM=UNDEFINED DEFINER=`primacom_bloguser`@`localhost` SQL SECURITY DEFINER VIEW `customer_do_list`  AS SELECT `c`.`customer_id` AS `customer_id`, `c`.`company_id` AS `company_id`, `c`.`customer_code` AS `customer_code`, `c`.`first_name` AS `first_name`, `c`.`last_name` AS `last_name`, `c`.`phone` AS `phone`, `c`.`email` AS `email`, `c`.`address` AS `address`, `c`.`district` AS `district`, `c`.`province` AS `province`, `c`.`postal_code` AS `postal_code`, `c`.`temperature_status` AS `temperature_status`, `c`.`customer_grade` AS `customer_grade`, `c`.`total_purchase_amount` AS `total_purchase_amount`, `c`.`assigned_to` AS `assigned_to`, `c`.`basket_type` AS `basket_type`, `c`.`assigned_at` AS `assigned_at`, `c`.`last_contact_at` AS `last_contact_at`, `c`.`next_followup_at` AS `next_followup_at`, `c`.`recall_at` AS `recall_at`, `c`.`recall_reason` AS `recall_reason`, `c`.`source` AS `source`, `c`.`notes` AS `notes`, `c`.`is_active` AS `is_active`, `c`.`created_at` AS `created_at`, `c`.`updated_at` AS `updated_at`, `c`.`appointment_count` AS `appointment_count`, `c`.`appointment_extension_count` AS `appointment_extension_count`, `c`.`last_appointment_date` AS `last_appointment_date`, `c`.`appointment_extension_expiry` AS `appointment_extension_expiry`, `c`.`max_appointment_extensions` AS `max_appointment_extensions`, `c`.`appointment_extension_days` AS `appointment_extension_days`, `c`.`customer_status` AS `customer_status`, `c`.`customer_time_extension` AS `customer_time_extension`, `c`.`customer_time_base` AS `customer_time_base`, `c`.`customer_time_expiry` AS `customer_time_expiry`, to_days(`c`.`customer_time_expiry`) - to_days(current_timestamp()) AS `days_remaining`, CASE WHEN `c`.`customer_status` = 'new' THEN 'ลูกค้าใหม่' WHEN `c`.`customer_status` = 'existing' THEN 'ลูกค้าเก่า' WHEN `c`.`customer_status` = 'existing_3m' THEN 'ลูกค้าเก่า 3 เดือน' WHEN `c`.`customer_status` = 'followup' THEN 'ติดตาม' WHEN `c`.`customer_status` = 'call_followup' THEN 'ติดตามโทร' WHEN `c`.`customer_status` = 'daily_distribution' THEN 'แจกรายวัน' ELSE 'ไม่ทราบสถานะ' END AS `status_text`, CASE WHEN `c`.`customer_time_expiry` <= current_timestamp() THEN 'เกินกำหนด' WHEN `c`.`customer_time_expiry` <= current_timestamp() + interval 7 day THEN 'ใกล้หมดเวลา' ELSE 'ปกติ' END AS `urgency_status` FROM `customers` AS `c` WHERE `c`.`assigned_to` is not null AND `c`.`basket_type` = 'assigned' AND `c`.`is_active` = 1 AND (`c`.`customer_time_expiry` <= current_timestamp() + interval 7 day OR `c`.`next_followup_at` <= current_timestamp()) ;

-- --------------------------------------------------------

--
-- Structure for view `customer_do_list_new`
--
DROP TABLE IF EXISTS `customer_do_list_new`;

CREATE ALGORITHM=UNDEFINED DEFINER=`primacom_bloguser`@`localhost` SQL SECURITY DEFINER VIEW `customer_do_list_new`  AS SELECT `c`.`customer_id` AS `customer_id`, `c`.`company_id` AS `company_id`, `c`.`customer_code` AS `customer_code`, `c`.`first_name` AS `first_name`, `c`.`last_name` AS `last_name`, `c`.`phone` AS `phone`, `c`.`email` AS `email`, `c`.`address` AS `address`, `c`.`district` AS `district`, `c`.`province` AS `province`, `c`.`postal_code` AS `postal_code`, `c`.`temperature_status` AS `temperature_status`, `c`.`customer_grade` AS `customer_grade`, `c`.`total_purchase_amount` AS `total_purchase_amount`, `c`.`assigned_to` AS `assigned_to`, `c`.`basket_type` AS `basket_type`, `c`.`assigned_at` AS `assigned_at`, `c`.`last_contact_at` AS `last_contact_at`, `c`.`next_followup_at` AS `next_followup_at`, `c`.`recall_at` AS `recall_at`, `c`.`recall_reason` AS `recall_reason`, `c`.`source` AS `source`, `c`.`notes` AS `notes`, `c`.`is_active` AS `is_active`, `c`.`created_at` AS `created_at`, `c`.`updated_at` AS `updated_at`, `c`.`appointment_count` AS `appointment_count`, `c`.`appointment_extension_count` AS `appointment_extension_count`, `c`.`last_appointment_date` AS `last_appointment_date`, `c`.`appointment_extension_expiry` AS `appointment_extension_expiry`, `c`.`max_appointment_extensions` AS `max_appointment_extensions`, `c`.`appointment_extension_days` AS `appointment_extension_days`, `c`.`customer_status` AS `customer_status`, `c`.`customer_time_extension` AS `customer_time_extension`, `c`.`customer_time_base` AS `customer_time_base`, `c`.`customer_time_expiry` AS `customer_time_expiry`, `c`.`plant_variety` AS `plant_variety`, `c`.`garden_size` AS `garden_size`, CASE WHEN `c`.`customer_status` = 'new' THEN 'ลูกค้าใหม่' WHEN `c`.`customer_status` = 'existing' THEN 'ลูกค้าเก่า' WHEN `c`.`customer_status` = 'existing_3m' THEN 'ลูกค้าเก่า 3 เดือน' WHEN `c`.`customer_status` = 'followup' THEN 'ติดตาม' WHEN `c`.`customer_status` = 'call_followup' THEN 'ติดตามโทร' WHEN `c`.`customer_status` = 'daily_distribution' THEN 'แจกรายวัน' ELSE 'ไม่ทราบสถานะ' END AS `status_text`, CASE WHEN `c`.`customer_time_expiry` <= current_timestamp() THEN 'เกินกำหนด' WHEN `c`.`customer_time_expiry` <= current_timestamp() + interval 7 day THEN 'ใกล้หมดเวลา' ELSE 'ปกติ' END AS `urgency_status`, CASE WHEN exists(select 1 from `call_logs` `cl` where `cl`.`customer_id` = `c`.`customer_id` AND `cl`.`user_id` = `c`.`assigned_to` limit 1) THEN 1 ELSE 0 END AS `has_called_from_current_assigned`, CASE WHEN `c`.`next_followup_at` is not null AND `c`.`next_followup_at` <= current_timestamp() + interval 2 day THEN 1 WHEN `c`.`customer_status` = 'new' AND !exists(select 1 from `call_logs` `cl` where `cl`.`customer_id` = `c`.`customer_id` AND `cl`.`user_id` = `c`.`assigned_to` limit 1) THEN 1 WHEN `c`.`customer_status` = 'daily_distribution' AND !exists(select 1 from `call_logs` `cl` where `cl`.`customer_id` = `c`.`customer_id` AND `cl`.`user_id` = `c`.`assigned_to` limit 1) THEN 1 ELSE 0 END AS `should_appear_in_do` FROM `customers` AS `c` WHERE `c`.`is_active` = 1 AND `c`.`assigned_to` is not null AND `c`.`basket_type` = 'assigned' ;

-- --------------------------------------------------------

--
-- Structure for view `customer_do_view`
--
DROP TABLE IF EXISTS `customer_do_view`;

CREATE ALGORITHM=UNDEFINED DEFINER=`primacom_bloguser`@`localhost` SQL SECURITY DEFINER VIEW `customer_do_view`  AS SELECT `c`.`customer_id` AS `customer_id`, `c`.`company_id` AS `company_id`, `c`.`customer_code` AS `customer_code`, `c`.`first_name` AS `first_name`, `c`.`last_name` AS `last_name`, `c`.`phone` AS `phone`, `c`.`email` AS `email`, `c`.`address` AS `address`, `c`.`district` AS `district`, `c`.`province` AS `province`, `c`.`postal_code` AS `postal_code`, `c`.`temperature_status` AS `temperature_status`, `c`.`customer_grade` AS `customer_grade`, `c`.`total_purchase_amount` AS `total_purchase_amount`, `c`.`assigned_to` AS `assigned_to`, `c`.`basket_type` AS `basket_type`, `c`.`assigned_at` AS `assigned_at`, `c`.`last_contact_at` AS `last_contact_at`, `c`.`next_followup_at` AS `next_followup_at`, `c`.`recall_at` AS `recall_at`, `c`.`recall_reason` AS `recall_reason`, `c`.`source` AS `source`, `c`.`notes` AS `notes`, `c`.`is_active` AS `is_active`, `c`.`created_at` AS `created_at`, `c`.`updated_at` AS `updated_at`, `c`.`appointment_count` AS `appointment_count`, `c`.`appointment_extension_count` AS `appointment_extension_count`, `c`.`last_appointment_date` AS `last_appointment_date`, `c`.`appointment_extension_expiry` AS `appointment_extension_expiry`, `c`.`max_appointment_extensions` AS `max_appointment_extensions`, `c`.`appointment_extension_days` AS `appointment_extension_days`, `c`.`customer_status` AS `customer_status`, `c`.`customer_time_extension` AS `customer_time_extension`, `c`.`customer_time_base` AS `customer_time_base`, `c`.`customer_time_expiry` AS `customer_time_expiry`, `c`.`plant_variety` AS `plant_variety`, `c`.`garden_size` AS `garden_size`, CASE WHEN `c`.`next_followup_at` is not null AND `c`.`next_followup_at` <= current_timestamp() + interval 2 day THEN 'followup_2d' WHEN `c`.`customer_time_expiry` is not null AND `c`.`customer_time_expiry` <= current_timestamp() + interval 5 day THEN 'expiry_5d' WHEN `c`.`customer_status` = 'daily_distribution' OR `c`.`basket_type` = 'distribution' THEN 'daily_distribution' ELSE 'other' END AS `do_category`, CASE WHEN `c`.`next_followup_at` is not null AND `c`.`next_followup_at` <= current_timestamp() + interval 2 day THEN 1 WHEN `c`.`customer_time_expiry` is not null AND `c`.`customer_time_expiry` <= current_timestamp() + interval 5 day THEN 2 WHEN `c`.`customer_status` = 'daily_distribution' OR `c`.`basket_type` = 'distribution' THEN 3 ELSE 9 END AS `do_priority`, greatest(coalesce(`c`.`next_followup_at`,'1970-01-01'),coalesce(`c`.`updated_at`,'1970-01-01'),coalesce(`c`.`created_at`,'1970-01-01')) AS `do_order_date` FROM `customers` AS `c` WHERE `c`.`is_active` = 1 ;

-- --------------------------------------------------------

--
-- Structure for view `customer_existing_3m_list`
--
DROP TABLE IF EXISTS `customer_existing_3m_list`;

CREATE ALGORITHM=UNDEFINED DEFINER=`primacom_bloguser`@`localhost` SQL SECURITY DEFINER VIEW `customer_existing_3m_list`  AS SELECT `c`.`customer_id` AS `customer_id`, `c`.`customer_code` AS `customer_code`, `c`.`first_name` AS `first_name`, `c`.`last_name` AS `last_name`, `c`.`phone` AS `phone`, `c`.`email` AS `email`, `c`.`address` AS `address`, `c`.`district` AS `district`, `c`.`province` AS `province`, `c`.`postal_code` AS `postal_code`, `c`.`temperature_status` AS `temperature_status`, `c`.`customer_grade` AS `customer_grade`, `c`.`total_purchase_amount` AS `total_purchase_amount`, `c`.`assigned_to` AS `assigned_to`, `c`.`basket_type` AS `basket_type`, `c`.`assigned_at` AS `assigned_at`, `c`.`last_contact_at` AS `last_contact_at`, `c`.`next_followup_at` AS `next_followup_at`, `c`.`recall_at` AS `recall_at`, `c`.`source` AS `source`, `c`.`notes` AS `notes`, `c`.`is_active` AS `is_active`, `c`.`created_at` AS `created_at`, `c`.`updated_at` AS `updated_at`, `c`.`customer_status` AS `customer_status` FROM `customers` AS `c` WHERE `c`.`is_active` = 1 AND `c`.`assigned_to` is not null AND `c`.`basket_type` = 'assigned' AND `c`.`customer_status` = 'existing_3m' ;

-- --------------------------------------------------------

--
-- Structure for view `customer_existing_list`
--
DROP TABLE IF EXISTS `customer_existing_list`;

CREATE ALGORITHM=UNDEFINED DEFINER=`primacom_bloguser`@`localhost` SQL SECURITY DEFINER VIEW `customer_existing_list`  AS SELECT `c`.`customer_id` AS `customer_id`, `c`.`company_id` AS `company_id`, `c`.`customer_code` AS `customer_code`, `c`.`first_name` AS `first_name`, `c`.`last_name` AS `last_name`, `c`.`phone` AS `phone`, `c`.`email` AS `email`, `c`.`address` AS `address`, `c`.`district` AS `district`, `c`.`province` AS `province`, `c`.`postal_code` AS `postal_code`, `c`.`temperature_status` AS `temperature_status`, `c`.`customer_grade` AS `customer_grade`, `c`.`total_purchase_amount` AS `total_purchase_amount`, `c`.`assigned_to` AS `assigned_to`, `c`.`basket_type` AS `basket_type`, `c`.`assigned_at` AS `assigned_at`, `c`.`last_contact_at` AS `last_contact_at`, `c`.`next_followup_at` AS `next_followup_at`, `c`.`recall_at` AS `recall_at`, `c`.`recall_reason` AS `recall_reason`, `c`.`source` AS `source`, `c`.`notes` AS `notes`, `c`.`is_active` AS `is_active`, `c`.`created_at` AS `created_at`, `c`.`updated_at` AS `updated_at`, `c`.`appointment_count` AS `appointment_count`, `c`.`appointment_extension_count` AS `appointment_extension_count`, `c`.`last_appointment_date` AS `last_appointment_date`, `c`.`appointment_extension_expiry` AS `appointment_extension_expiry`, `c`.`max_appointment_extensions` AS `max_appointment_extensions`, `c`.`appointment_extension_days` AS `appointment_extension_days`, `c`.`customer_status` AS `customer_status`, `c`.`customer_time_extension` AS `customer_time_extension`, `c`.`customer_time_base` AS `customer_time_base`, `c`.`customer_time_expiry` AS `customer_time_expiry`, CASE WHEN `c`.`customer_status` = 'existing' THEN 'ลูกค้าเก่า' WHEN `c`.`customer_status` = 'existing_3m' THEN 'ลูกค้าเก่า 3 เดือน' ELSE `c`.`customer_status` END AS `status_text` FROM `customers` AS `c` WHERE `c`.`is_active` = 1 AND `c`.`customer_status` in ('existing','existing_3m') ;

-- --------------------------------------------------------

--
-- Structure for view `customer_expiry_list`
--
DROP TABLE IF EXISTS `customer_expiry_list`;

CREATE ALGORITHM=UNDEFINED DEFINER=`primacom_bloguser`@`localhost` SQL SECURITY DEFINER VIEW `customer_expiry_list`  AS SELECT `c`.`customer_id` AS `customer_id`, `c`.`company_id` AS `company_id`, `c`.`customer_code` AS `customer_code`, `c`.`first_name` AS `first_name`, `c`.`last_name` AS `last_name`, `c`.`phone` AS `phone`, `c`.`email` AS `email`, `c`.`address` AS `address`, `c`.`district` AS `district`, `c`.`province` AS `province`, `c`.`postal_code` AS `postal_code`, `c`.`temperature_status` AS `temperature_status`, `c`.`customer_grade` AS `customer_grade`, `c`.`total_purchase_amount` AS `total_purchase_amount`, `c`.`assigned_to` AS `assigned_to`, `c`.`basket_type` AS `basket_type`, `c`.`assigned_at` AS `assigned_at`, `c`.`last_contact_at` AS `last_contact_at`, `c`.`next_followup_at` AS `next_followup_at`, `c`.`recall_at` AS `recall_at`, `c`.`recall_reason` AS `recall_reason`, `c`.`source` AS `source`, `c`.`notes` AS `notes`, `c`.`is_active` AS `is_active`, `c`.`created_at` AS `created_at`, `c`.`updated_at` AS `updated_at`, `c`.`appointment_count` AS `appointment_count`, `c`.`appointment_extension_count` AS `appointment_extension_count`, `c`.`last_appointment_date` AS `last_appointment_date`, `c`.`appointment_extension_expiry` AS `appointment_extension_expiry`, `c`.`max_appointment_extensions` AS `max_appointment_extensions`, `c`.`appointment_extension_days` AS `appointment_extension_days`, `c`.`customer_status` AS `customer_status`, `c`.`customer_time_extension` AS `customer_time_extension`, `c`.`customer_time_base` AS `customer_time_base`, `c`.`customer_time_expiry` AS `customer_time_expiry`, `c`.`plant_variety` AS `plant_variety`, `c`.`garden_size` AS `garden_size`, to_days(`c`.`customer_time_expiry`) - to_days(current_timestamp()) AS `days_remaining`, CASE WHEN `c`.`customer_status` = 'new' THEN 'ลูกค้าใหม่' WHEN `c`.`customer_status` = 'existing' THEN 'ลูกค้าเก่า' WHEN `c`.`customer_status` = 'existing_3m' THEN 'ลูกค้าเก่า 3 เดือน' WHEN `c`.`customer_status` = 'followup' THEN 'ติดตาม' WHEN `c`.`customer_status` = 'call_followup' THEN 'ติดตามโทร' WHEN `c`.`customer_status` = 'daily_distribution' THEN 'แจกรายวัน' ELSE 'ไม่ทราบสถานะ' END AS `status_text`, CASE WHEN `c`.`customer_time_expiry` <= current_timestamp() THEN 'เกินกำหนด' WHEN `c`.`customer_time_expiry` <= current_timestamp() + interval 3 day THEN 'ใกล้หมดมาก' WHEN `c`.`customer_time_expiry` <= current_timestamp() + interval 7 day THEN 'ใกล้หมดเวลา' ELSE 'ปกติ' END AS `urgency_status` FROM `customers` AS `c` WHERE `c`.`assigned_to` is not null AND `c`.`basket_type` = 'assigned' AND `c`.`is_active` = 1 AND `c`.`customer_time_expiry` is not null AND `c`.`customer_time_expiry` <= current_timestamp() + interval 7 day ORDER BY `c`.`customer_time_expiry` ASC ;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `activity_logs`
--
ALTER TABLE `activity_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_activity_type` (`activity_type`),
  ADD KEY `idx_table_name` (`table_name`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_activity_logs_company_id` (`company_id`);

--
-- Indexes for table `appointments`
--
ALTER TABLE `appointments`
  ADD PRIMARY KEY (`appointment_id`),
  ADD KEY `idx_customer_id` (`customer_id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_appointment_date` (`appointment_date`),
  ADD KEY `idx_appointment_status` (`appointment_status`),
  ADD KEY `idx_appointment_type` (`appointment_type`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_call_log_id` (`call_log_id`),
  ADD KEY `idx_company_id` (`company_id`);

--
-- Indexes for table `appointment_activities`
--
ALTER TABLE `appointment_activities`
  ADD PRIMARY KEY (`activity_id`),
  ADD KEY `idx_appointment_id` (`appointment_id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_activity_type` (`activity_type`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_appointment_activities_company_id` (`company_id`);

--
-- Indexes for table `appointment_extensions`
--
ALTER TABLE `appointment_extensions`
  ADD PRIMARY KEY (`extension_id`),
  ADD KEY `idx_customer_id` (`customer_id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_appointment_id` (`appointment_id`),
  ADD KEY `idx_extension_type` (`extension_type`),
  ADD KEY `idx_created_at` (`created_at`);

--
-- Indexes for table `appointment_extension_rules`
--
ALTER TABLE `appointment_extension_rules`
  ADD PRIMARY KEY (`rule_id`),
  ADD KEY `idx_rule_name` (`rule_name`),
  ADD KEY `idx_is_active` (`is_active`);

--
-- Indexes for table `call_followup_queue`
--
ALTER TABLE `call_followup_queue`
  ADD PRIMARY KEY (`queue_id`),
  ADD KEY `idx_customer_id` (`customer_id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_followup_date` (`followup_date`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_priority` (`priority`),
  ADD KEY `call_log_id` (`call_log_id`);

--
-- Indexes for table `call_followup_rules`
--
ALTER TABLE `call_followup_rules`
  ADD PRIMARY KEY (`rule_id`),
  ADD UNIQUE KEY `unique_call_result` (`call_result`);

--
-- Indexes for table `call_logs`
--
ALTER TABLE `call_logs`
  ADD PRIMARY KEY (`log_id`),
  ADD KEY `idx_customer_id` (`customer_id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_call_date` (`created_at`),
  ADD KEY `idx_next_followup` (`next_followup_at`),
  ADD KEY `idx_call_logs_customer_followup` (`customer_id`,`next_followup_at`),
  ADD KEY `idx_call_logs_result_followup` (`call_result`,`next_followup_at`),
  ADD KEY `idx_company_id` (`company_id`),
  ADD KEY `idx_plant_variety` (`plant_variety`),
  ADD KEY `idx_garden_size` (`garden_size`);

--
-- Indexes for table `companies`
--
ALTER TABLE `companies`
  ADD PRIMARY KEY (`company_id`),
  ADD UNIQUE KEY `company_code` (`company_code`),
  ADD UNIQUE KEY `uq_companies_company_code` (`company_code`),
  ADD KEY `idx_company_code` (`company_code`);

--
-- Indexes for table `cron_job_logs`
--
ALTER TABLE `cron_job_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_job_name` (`job_name`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `idx_start_time` (`start_time`);

--
-- Indexes for table `cron_job_settings`
--
ALTER TABLE `cron_job_settings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `job_name` (`job_name`),
  ADD KEY `idx_job_name` (`job_name`),
  ADD KEY `idx_is_enabled` (`is_enabled`),
  ADD KEY `idx_next_run` (`next_run`);

--
-- Indexes for table `customers`
--
ALTER TABLE `customers`
  ADD PRIMARY KEY (`customer_id`),
  ADD UNIQUE KEY `uq_customers_company_phone` (`company_id`,`phone`),
  ADD UNIQUE KEY `uq_customer_code_company` (`customer_code`,`company_id`),
  ADD KEY `idx_assigned_to` (`assigned_to`),
  ADD KEY `idx_basket_type` (`basket_type`),
  ADD KEY `idx_temperature` (`temperature_status`),
  ADD KEY `idx_grade` (`customer_grade`),
  ADD KEY `idx_province` (`province`),
  ADD KEY `idx_recall_at` (`recall_at`),
  ADD KEY `idx_next_followup` (`next_followup_at`),
  ADD KEY `idx_phone` (`phone`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_customers_phone` (`phone`),
  ADD KEY `idx_customers_email` (`email`),
  ADD KEY `idx_customer_status` (`customer_status`),
  ADD KEY `idx_customer_time_expiry` (`customer_time_expiry`),
  ADD KEY `idx_customer_time_base` (`customer_time_base`),
  ADD KEY `idx_assigned_at` (`assigned_at`),
  ADD KEY `idx_customers_status_followup` (`customer_status`,`next_followup_at`),
  ADD KEY `idx_company_id` (`company_id`),
  ADD KEY `idx_customers_basket_type_block` (`basket_type`),
  ADD KEY `idx_customers_basket_block` (`basket_type`,`is_active`),
  ADD KEY `idx_customers_blocked` (`is_blocked`);

--
-- Indexes for table `customer_activities`
--
ALTER TABLE `customer_activities`
  ADD PRIMARY KEY (`activity_id`),
  ADD KEY `idx_customer_id` (`customer_id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_activity_type` (`activity_type`),
  ADD KEY `idx_created_at` (`created_at`);

--
-- Indexes for table `customer_blocks`
--
ALTER TABLE `customer_blocks`
  ADD PRIMARY KEY (`block_id`),
  ADD KEY `idx_customer_id` (`customer_id`),
  ADD KEY `idx_blocked_by` (`blocked_by`),
  ADD KEY `idx_block_date` (`block_date`),
  ADD KEY `idx_is_active` (`is_active`),
  ADD KEY `idx_company_id` (`company_id`),
  ADD KEY `fk_customer_blocks_unblocked_by` (`unblocked_by`),
  ADD KEY `idx_customer_blocks_customer_active` (`customer_id`,`is_active`),
  ADD KEY `idx_customer_blocks_date` (`block_date`);

--
-- Indexes for table `customer_change_logs`
--
ALTER TABLE `customer_change_logs`
  ADD PRIMARY KEY (`log_id`),
  ADD KEY `idx_customer_created_at` (`customer_id`,`created_at`);

--
-- Indexes for table `customer_info_tags`
--
ALTER TABLE `customer_info_tags`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_customer_info_tag` (`customer_id`,`tag_name`),
  ADD KEY `idx_customer_info_tags_customer_id` (`customer_id`);

--
-- Indexes for table `customer_recalls`
--
ALTER TABLE `customer_recalls`
  ADD PRIMARY KEY (`recall_id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `idx_customer_id` (`customer_id`),
  ADD KEY `idx_recall_type` (`recall_type`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_customer_recalls_customer_id` (`customer_id`),
  ADD KEY `idx_customer_recalls_created_at` (`created_at`);

--
-- Indexes for table `customer_recall_list`
--
ALTER TABLE `customer_recall_list`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_customer_id` (`customer_id`),
  ADD KEY `idx_created_date` (`created_date`),
  ADD KEY `idx_priority` (`priority`),
  ADD KEY `idx_status` (`status`),
  ADD KEY `fk_customer_recall_assigned_to` (`assigned_to`);

--
-- Indexes for table `customer_tags`
--
ALTER TABLE `customer_tags`
  ADD PRIMARY KEY (`tag_id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `idx_customer_tags` (`customer_id`,`user_id`);

--
-- Indexes for table `customer_time_extensions`
--
ALTER TABLE `customer_time_extensions`
  ADD PRIMARY KEY (`extension_id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `idx_customer_id` (`customer_id`),
  ADD KEY `idx_extension_type` (`extension_type`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_customer_time_extensions_customer_id` (`customer_id`),
  ADD KEY `idx_customer_time_extensions_created_at` (`created_at`);

--
-- Indexes for table `customer_transfers`
--
ALTER TABLE `customer_transfers`
  ADD PRIMARY KEY (`transfer_id`),
  ADD KEY `idx_source_telesales` (`source_telesales_id`),
  ADD KEY `idx_target_telesales` (`target_telesales_id`),
  ADD KEY `idx_transferred_by` (`transferred_by`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_customer_transfers_company_id` (`company_id`);

--
-- Indexes for table `customer_transfer_details`
--
ALTER TABLE `customer_transfer_details`
  ADD PRIMARY KEY (`detail_id`),
  ADD KEY `idx_transfer_id` (`transfer_id`),
  ADD KEY `idx_customer_id` (`customer_id`),
  ADD KEY `idx_customer_transfer_details_company_id` (`company_id`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_type` (`type`),
  ADD KEY `idx_created_at` (`created_at`),
  ADD KEY `idx_notifications_company_id` (`company_id`);

--
-- Indexes for table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`order_id`),
  ADD UNIQUE KEY `order_number` (`order_number`),
  ADD KEY `idx_order_number` (`order_number`),
  ADD KEY `idx_customer_id` (`customer_id`),
  ADD KEY `idx_created_by` (`created_by`),
  ADD KEY `idx_order_date` (`order_date`),
  ADD KEY `idx_payment_status` (`payment_status`),
  ADD KEY `idx_delivery_status` (`delivery_status`),
  ADD KEY `idx_orders_customer_id` (`customer_id`),
  ADD KEY `idx_orders_created_by` (`created_by`),
  ADD KEY `idx_orders_order_date` (`order_date`),
  ADD KEY `idx_orders_payment_status` (`payment_status`),
  ADD KEY `idx_orders_delivery_status` (`delivery_status`),
  ADD KEY `idx_orders_created_at` (`created_at`),
  ADD KEY `idx_company_id` (`company_id`);

--
-- Indexes for table `order_activities`
--
ALTER TABLE `order_activities`
  ADD PRIMARY KEY (`activity_id`),
  ADD KEY `idx_order_id` (`order_id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_activity_date` (`created_at`),
  ADD KEY `idx_order_activities_order_id` (`order_id`),
  ADD KEY `idx_order_activities_user_id` (`user_id`),
  ADD KEY `idx_order_activities_created_at` (`created_at`);

--
-- Indexes for table `order_details`
--
ALTER TABLE `order_details`
  ADD PRIMARY KEY (`detail_id`),
  ADD KEY `idx_order_id` (`order_id`),
  ADD KEY `idx_product_id` (`product_id`);

--
-- Indexes for table `order_items`
--
ALTER TABLE `order_items`
  ADD PRIMARY KEY (`item_id`),
  ADD KEY `idx_order_id` (`order_id`),
  ADD KEY `idx_product_id` (`product_id`),
  ADD KEY `idx_order_items_order_id` (`order_id`),
  ADD KEY `idx_order_items_product_id` (`product_id`);

--
-- Indexes for table `predefined_tags`
--
ALTER TABLE `predefined_tags`
  ADD PRIMARY KEY (`id`),
  ADD KEY `created_by` (`created_by`);

--
-- Indexes for table `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`product_id`),
  ADD UNIQUE KEY `product_code` (`product_code`),
  ADD UNIQUE KEY `uq_products_company_code` (`company_id`,`product_code`),
  ADD KEY `idx_product_code` (`product_code`),
  ADD KEY `idx_category` (`category`),
  ADD KEY `idx_active` (`is_active`),
  ADD KEY `idx_products_product_code` (`product_code`),
  ADD KEY `idx_products_is_active` (`is_active`),
  ADD KEY `idx_company_id` (`company_id`);

--
-- Indexes for table `roles`
--
ALTER TABLE `roles`
  ADD PRIMARY KEY (`role_id`),
  ADD KEY `idx_role_name` (`role_name`);

--
-- Indexes for table `sales_history`
--
ALTER TABLE `sales_history`
  ADD PRIMARY KEY (`history_id`),
  ADD KEY `idx_customer_id` (`customer_id`),
  ADD KEY `idx_user_id` (`user_id`),
  ADD KEY `idx_assigned_at` (`assigned_at`),
  ADD KEY `idx_is_current` (`is_current`);

--
-- Indexes for table `system_settings`
--
ALTER TABLE `system_settings`
  ADD PRIMARY KEY (`setting_id`),
  ADD UNIQUE KEY `setting_key` (`setting_key`),
  ADD KEY `updated_by` (`updated_by`),
  ADD KEY `idx_setting_key` (`setting_key`);

--
-- Indexes for table `test_phone`
--
ALTER TABLE `test_phone`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD KEY `company_id` (`company_id`),
  ADD KEY `idx_username` (`username`),
  ADD KEY `idx_role` (`role_id`),
  ADD KEY `idx_active` (`is_active`),
  ADD KEY `idx_users_username` (`username`),
  ADD KEY `idx_users_role_id` (`role_id`),
  ADD KEY `idx_supervisor_id` (`supervisor_id`);

--
-- Indexes for table `_tmp_map`
--
ALTER TABLE `_tmp_map`
  ADD PRIMARY KEY (`dup_id`),
  ADD KEY `idx_master` (`master_id`);

--
-- Indexes for table `_tmp_master_by_company`
--
ALTER TABLE `_tmp_master_by_company`
  ADD PRIMARY KEY (`company_id`,`phone9`),
  ADD KEY `idx_master` (`master_id`);

--
-- Indexes for table `_tmp_null_candidates`
--
ALTER TABLE `_tmp_null_candidates`
  ADD PRIMARY KEY (`dup_id`),
  ADD KEY `idx_target` (`target_company_id`,`phone9`);

--
-- Indexes for table `_tmp_phone9`
--
ALTER TABLE `_tmp_phone9`
  ADD PRIMARY KEY (`customer_id`),
  ADD KEY `idx_company_phone9` (`company_id`,`phone9`),
  ADD KEY `idx_assigned_to` (`assigned_to`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `activity_logs`
--
ALTER TABLE `activity_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `appointments`
--
ALTER TABLE `appointments`
  MODIFY `appointment_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `appointment_activities`
--
ALTER TABLE `appointment_activities`
  MODIFY `activity_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `appointment_extensions`
--
ALTER TABLE `appointment_extensions`
  MODIFY `extension_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `appointment_extension_rules`
--
ALTER TABLE `appointment_extension_rules`
  MODIFY `rule_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `call_followup_queue`
--
ALTER TABLE `call_followup_queue`
  MODIFY `queue_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `call_followup_rules`
--
ALTER TABLE `call_followup_rules`
  MODIFY `rule_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `call_logs`
--
ALTER TABLE `call_logs`
  MODIFY `log_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `companies`
--
ALTER TABLE `companies`
  MODIFY `company_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `cron_job_logs`
--
ALTER TABLE `cron_job_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `cron_job_settings`
--
ALTER TABLE `cron_job_settings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `customers`
--
ALTER TABLE `customers`
  MODIFY `customer_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `customer_activities`
--
ALTER TABLE `customer_activities`
  MODIFY `activity_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `customer_blocks`
--
ALTER TABLE `customer_blocks`
  MODIFY `block_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `customer_change_logs`
--
ALTER TABLE `customer_change_logs`
  MODIFY `log_id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `customer_info_tags`
--
ALTER TABLE `customer_info_tags`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `customer_recalls`
--
ALTER TABLE `customer_recalls`
  MODIFY `recall_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `customer_recall_list`
--
ALTER TABLE `customer_recall_list`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `customer_tags`
--
ALTER TABLE `customer_tags`
  MODIFY `tag_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `customer_time_extensions`
--
ALTER TABLE `customer_time_extensions`
  MODIFY `extension_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `customer_transfers`
--
ALTER TABLE `customer_transfers`
  MODIFY `transfer_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `customer_transfer_details`
--
ALTER TABLE `customer_transfer_details`
  MODIFY `detail_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `notifications`
--
ALTER TABLE `notifications`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `orders`
--
ALTER TABLE `orders`
  MODIFY `order_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `order_activities`
--
ALTER TABLE `order_activities`
  MODIFY `activity_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `order_details`
--
ALTER TABLE `order_details`
  MODIFY `detail_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `order_items`
--
ALTER TABLE `order_items`
  MODIFY `item_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `predefined_tags`
--
ALTER TABLE `predefined_tags`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `products`
--
ALTER TABLE `products`
  MODIFY `product_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `roles`
--
ALTER TABLE `roles`
  MODIFY `role_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `sales_history`
--
ALTER TABLE `sales_history`
  MODIFY `history_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `system_settings`
--
ALTER TABLE `system_settings`
  MODIFY `setting_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `test_phone`
--
ALTER TABLE `test_phone`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `user_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `activity_logs`
--
ALTER TABLE `activity_logs`
  ADD CONSTRAINT `fk_activity_logs_company_id` FOREIGN KEY (`company_id`) REFERENCES `companies` (`company_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_activity_logs_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL;

--
-- Constraints for table `appointments`
--
ALTER TABLE `appointments`
  ADD CONSTRAINT `appointments_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `appointments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `fk_appointments_company_id` FOREIGN KEY (`company_id`) REFERENCES `companies` (`company_id`) ON DELETE SET NULL;

--
-- Constraints for table `appointment_activities`
--
ALTER TABLE `appointment_activities`
  ADD CONSTRAINT `appointment_activities_ibfk_1` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`appointment_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `appointment_activities_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `fk_appointment_activities_company_id` FOREIGN KEY (`company_id`) REFERENCES `companies` (`company_id`) ON DELETE SET NULL;

--
-- Constraints for table `appointment_extensions`
--
ALTER TABLE `appointment_extensions`
  ADD CONSTRAINT `appointment_extensions_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `appointment_extensions_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `appointment_extensions_ibfk_3` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`appointment_id`) ON DELETE SET NULL;

--
-- Constraints for table `call_followup_queue`
--
ALTER TABLE `call_followup_queue`
  ADD CONSTRAINT `call_followup_queue_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `call_followup_queue_ibfk_2` FOREIGN KEY (`call_log_id`) REFERENCES `call_logs` (`log_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `call_followup_queue_ibfk_3` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE;

--
-- Constraints for table `call_logs`
--
ALTER TABLE `call_logs`
  ADD CONSTRAINT `call_logs_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`),
  ADD CONSTRAINT `call_logs_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `fk_call_logs_company_id` FOREIGN KEY (`company_id`) REFERENCES `companies` (`company_id`) ON DELETE SET NULL;

--
-- Constraints for table `customers`
--
ALTER TABLE `customers`
  ADD CONSTRAINT `customers_ibfk_1` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `fk_customers_company_id` FOREIGN KEY (`company_id`) REFERENCES `companies` (`company_id`) ON DELETE SET NULL;

--
-- Constraints for table `customer_activities`
--
ALTER TABLE `customer_activities`
  ADD CONSTRAINT `customer_activities_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`),
  ADD CONSTRAINT `customer_activities_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `customer_blocks`
--
ALTER TABLE `customer_blocks`
  ADD CONSTRAINT `fk_customer_blocks_blocked_by` FOREIGN KEY (`blocked_by`) REFERENCES `users` (`user_id`),
  ADD CONSTRAINT `fk_customer_blocks_company_id` FOREIGN KEY (`company_id`) REFERENCES `companies` (`company_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_customer_blocks_customer_id` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_customer_blocks_unblocked_by` FOREIGN KEY (`unblocked_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL;

--
-- Constraints for table `customer_recalls`
--
ALTER TABLE `customer_recalls`
  ADD CONSTRAINT `customer_recalls_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `customer_recalls_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `customer_recall_list`
--
ALTER TABLE `customer_recall_list`
  ADD CONSTRAINT `fk_customer_recall_assigned_to` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_customer_recall_customer_id` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE;

--
-- Constraints for table `customer_tags`
--
ALTER TABLE `customer_tags`
  ADD CONSTRAINT `customer_tags_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`),
  ADD CONSTRAINT `customer_tags_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `customer_time_extensions`
--
ALTER TABLE `customer_time_extensions`
  ADD CONSTRAINT `customer_time_extensions_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `customer_time_extensions_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `customer_transfers`
--
ALTER TABLE `customer_transfers`
  ADD CONSTRAINT `fk_customer_transfers_company_id` FOREIGN KEY (`company_id`) REFERENCES `companies` (`company_id`) ON DELETE SET NULL;

--
-- Constraints for table `customer_transfer_details`
--
ALTER TABLE `customer_transfer_details`
  ADD CONSTRAINT `customer_transfer_details_ibfk_1` FOREIGN KEY (`transfer_id`) REFERENCES `customer_transfers` (`transfer_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_customer_transfer_details_company_id` FOREIGN KEY (`company_id`) REFERENCES `companies` (`company_id`) ON DELETE SET NULL;

--
-- Constraints for table `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `fk_notifications_company_id` FOREIGN KEY (`company_id`) REFERENCES `companies` (`company_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_notifications_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE;

--
-- Constraints for table `orders`
--
ALTER TABLE `orders`
  ADD CONSTRAINT `fk_orders_company_id` FOREIGN KEY (`company_id`) REFERENCES `companies` (`company_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`),
  ADD CONSTRAINT `orders_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `order_activities`
--
ALTER TABLE `order_activities`
  ADD CONSTRAINT `order_activities_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `order_activities_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `order_details`
--
ALTER TABLE `order_details`
  ADD CONSTRAINT `order_details_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `order_details_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`);

--
-- Constraints for table `order_items`
--
ALTER TABLE `order_items`
  ADD CONSTRAINT `order_items_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `orders` (`order_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `order_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`product_id`);

--
-- Constraints for table `predefined_tags`
--
ALTER TABLE `predefined_tags`
  ADD CONSTRAINT `predefined_tags_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `products`
--
ALTER TABLE `products`
  ADD CONSTRAINT `fk_products_company_id` FOREIGN KEY (`company_id`) REFERENCES `companies` (`company_id`) ON DELETE SET NULL;

--
-- Constraints for table `sales_history`
--
ALTER TABLE `sales_history`
  ADD CONSTRAINT `sales_history_ibfk_1` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`),
  ADD CONSTRAINT `sales_history_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `system_settings`
--
ALTER TABLE `system_settings`
  ADD CONSTRAINT `system_settings_ibfk_1` FOREIGN KEY (`updated_by`) REFERENCES `users` (`user_id`);

--
-- Constraints for table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `users_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `roles` (`role_id`),
  ADD CONSTRAINT `users_ibfk_2` FOREIGN KEY (`company_id`) REFERENCES `companies` (`company_id`),
  ADD CONSTRAINT `users_ibfk_3` FOREIGN KEY (`supervisor_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
