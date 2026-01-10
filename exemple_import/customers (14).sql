-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Jan 10, 2026 at 08:09 AM
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
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
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

--
-- Indexes for dumped tables
--

--
-- Indexes for table `customers`
--
ALTER TABLE `customers`
  ADD PRIMARY KEY (`customer_id`),
  ADD UNIQUE KEY `uniq_customers_customer_ref_id` (`customer_ref_id`),
  ADD KEY `idx_customers_assigned_to` (`assigned_to`),
  ADD KEY `idx_customers_blocked` (`is_blocked`),
  ADD KEY `idx_customers_company` (`company_id`),
  ADD KEY `idx_customers_company_assigned` (`company_id`,`assigned_to`),
  ADD KEY `idx_customers_company_status` (`company_id`,`lifecycle_status`),
  ADD KEY `idx_customers_date_assigned` (`date_assigned`),
  ADD KEY `idx_customers_lifecycle_status` (`lifecycle_status`),
  ADD KEY `idx_customers_ownership_expires` (`ownership_expires`),
  ADD KEY `idx_customers_waiting` (`is_in_waiting_basket`),
  ADD KEY `idx_company_assigned` (`company_id`,`assigned_to`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `customers`
--
ALTER TABLE `customers`
  MODIFY `customer_id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `customers`
--
ALTER TABLE `customers`
  ADD CONSTRAINT `fk_customers_assigned_to` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  ADD CONSTRAINT `fk_customers_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
