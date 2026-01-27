-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Jan 27, 2026 at 01:13 PM
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

--
-- Dumping data for table `basket_config`
--

INSERT INTO `basket_config` (`id`, `basket_key`, `basket_name`, `min_order_count`, `max_order_count`, `min_days_since_order`, `max_days_since_order`, `days_since_first_order`, `days_since_registered`, `target_page`, `display_order`, `is_active`, `company_id`, `created_at`, `updated_at`, `on_fail_reevaluate`, `on_max_dist_basket_key`, `has_loop`, `on_sale_basket_key`, `on_fail_basket_key`, `fail_after_days`, `max_distribution_count`, `hold_days_before_redistribute`, `linked_basket_key`, `blocked_target_baskets`) VALUES
(38, 'new_customer', 'ลูกค้าใหม่', 1, NULL, 0, 30, NULL, NULL, 'dashboard_v2', 1, 1, 1, '2026-01-21 14:09:30', '2026-01-25 14:18:25', 0, 'waiting_for_match', 1, 'personal_1_2m', 'waiting_for_match', 60, 0, 0, NULL, NULL),
(39, 'personal_1_2m', 'ส่วนตัว 1-2 เดือน', 1, NULL, NULL, 60, NULL, NULL, 'dashboard_v2', 2, 1, 1, '2026-01-21 14:09:30', '2026-01-25 14:18:28', 0, 'personal_last_chance', 0, 'personal_1_2m', 'personal_last_chance', 60, 0, 0, NULL, NULL),
(40, 'personal_last_chance', 'ส่วนตัวโอกาสสุดท้าย', 1, NULL, 61, 90, NULL, NULL, 'dashboard_v2', 3, 1, 1, '2026-01-21 14:09:30', '2026-01-25 14:18:31', 0, 'find_new_owner', 0, 'personal_1_2m', 'find_new_owner', 30, 0, 30, NULL, NULL),
(41, 'find_new_owner', 'หาคนดูแลใหม่', 1, NULL, 91, 180, NULL, NULL, 'distribution', 4, 1, 1, '2026-01-21 14:09:30', '2026-01-25 13:44:57', 0, NULL, 0, NULL, NULL, 30, 0, 3, 'find_new_owner_dash', NULL),
(42, 'waiting_for_match', 'รอคนมาจีบให้ติด', 1, NULL, 0, 90, NULL, NULL, 'distribution', 5, 1, 1, '2026-01-21 14:09:30', '2026-01-24 15:22:46', 0, NULL, 0, NULL, NULL, 30, 0, 3, 'waiting_for_match_dash', NULL),
(43, 'mid_6_12m', 'ถังกลาง 6-12 เดือน', 1, NULL, 181, 365, NULL, NULL, 'distribution', 6, 1, 1, '2026-01-21 14:09:30', '2026-01-21 23:07:20', 0, NULL, 0, NULL, NULL, 30, 0, 7, 'mid_6_12m_dash', NULL),
(44, 'mid_1_3y', 'ถังกลาง 1-3 ปี', 1, NULL, 366, 1095, NULL, NULL, 'distribution', 7, 1, 1, '2026-01-21 14:09:30', '2026-01-21 23:07:20', 0, NULL, 0, NULL, NULL, 60, 0, 14, 'mid_1_3y_dash', NULL),
(45, 'ancient', 'ถังโบราณ เก่าเก็บ', 1, NULL, 1096, NULL, NULL, NULL, 'distribution', 8, 1, 1, '2026-01-21 14:09:30', '2026-01-21 23:07:20', 0, NULL, 0, NULL, NULL, 90, 0, 30, 'ancient_dash', NULL),
(46, 'find_new_owner_dash', 'หาคนดูแลใหม่', 1, NULL, 91, 180, NULL, NULL, 'dashboard_v2', 4, 1, 1, '2026-01-21 14:09:30', '2026-01-25 14:48:01', 1, 'mid_6_12m', 0, 'personal_1_2m', 'find_new_owner', 30, 0, 0, 'find_new_owner', '42'),
(47, 'waiting_for_match_dash', 'รอคนมาจีบให้ติด', 1, NULL, 0, 180, NULL, NULL, 'dashboard_v2', 5, 1, 1, '2026-01-21 14:09:30', '2026-01-25 14:48:17', 1, 'mid_6_12m', 0, 'personal_1_2m', 'waiting_for_match', 30, 0, 0, 'waiting_for_match', '41'),
(48, 'mid_6_12m_dash', 'ถังกลาง 6-12 เดือน', 1, NULL, 181, 365, NULL, NULL, 'dashboard_v2', 6, 1, 1, '2026-01-21 14:09:30', '2026-01-25 14:18:42', 1, 'mid_1_3y', 0, 'personal_1_2m', 'mid_6_12m', 30, 0, 0, 'mid_6_12m', NULL),
(49, 'mid_1_3y_dash', 'ถังกลาง 1-3 ปี', 1, NULL, 366, 1095, NULL, NULL, 'dashboard_v2', 7, 1, 1, '2026-01-21 14:09:30', '2026-01-25 14:18:45', 1, 'ancient', 0, 'personal_1_2m', 'mid_1_3y', 30, 0, 0, 'mid_1_3y', NULL),
(50, 'ancient_dash', 'ถังโบราณ เก่าเก็บ', 1, NULL, 1096, NULL, NULL, NULL, 'dashboard_v2', 8, 1, 1, '2026-01-21 14:09:30', '2026-01-25 14:18:47', 1, NULL, 0, 'personal_1_2m', 'ancient', 30, 0, 0, 'ancient', NULL),
(51, 'upsell', 'Upsell', NULL, NULL, NULL, NULL, NULL, NULL, 'dashboard_v2', 0, 1, 1, '2026-01-21 14:09:30', '2026-01-21 22:51:01', 0, NULL, 0, 'personal_1_2m', 'new_customer', NULL, 0, 0, NULL, NULL),
(52, 'new_customer_dis', 'ลูกค้าใหม่', 1, NULL, 0, 30, NULL, NULL, 'distribution', 1, 1, 1, '2026-01-21 14:09:30', '2026-01-26 14:35:06', 0, NULL, 1, NULL, NULL, 60, 0, 0, 'new_customer', NULL);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `basket_config`
--
ALTER TABLE `basket_config`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_basket_company` (`basket_key`,`company_id`),
  ADD KEY `idx_company_page` (`company_id`,`target_page`),
  ADD KEY `idx_display_order` (`display_order`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `basket_config`
--
ALTER TABLE `basket_config`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=53;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
