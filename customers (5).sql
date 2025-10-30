-- phpMyAdmin SQL Dump
-- version 4.9.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Oct 30, 2025 at 05:06 AM
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `customers`
--

INSERT INTO `customers` (`id`, `first_name`, `last_name`, `phone`, `email`, `province`, `company_id`, `assigned_to`, `date_assigned`, `date_registered`, `follow_up_date`, `ownership_expires`, `lifecycle_status`, `behavioral_status`, `grade`, `total_purchases`, `total_calls`, `facebook_name`, `line_id`, `street`, `subdistrict`, `district`, `postal_code`, `has_sold_before`, `follow_up_count`, `last_follow_up_date`, `last_sale_date`, `is_in_waiting_basket`, `waiting_basket_start_date`, `followup_bonus_remaining`, `is_blocked`, `first_order_date`, `last_order_date`, `order_count`, `is_new_customer`, `is_repeat_customer`) VALUES
('CUS-001', 'สมชาย', 'ใจดี', '0812345678', 'somchai@email.com', 'กรุงเทพ', 1, 2, '2025-09-27 21:00:09', '2025-09-27 21:00:09', '2025-10-11 22:30:00', '2025-12-28 10:36:28', 'Old', 'Hot', 'A', '0.00', 1, 'Somchai Jaidee', 'somchai01', '123 ถนนสุขุมวิท', 'คลองตัน', 'วัฒนา', '10110', 0, 1, '2025-09-27 15:30:09', NULL, 0, NULL, 1, 0, NULL, NULL, 0, 0, 0),
('CUS-002', 'สมหญิง', 'รักดี', '0823456789', 'somying@email.com', 'ปทุมธานี', 1, 2, '2025-09-27 21:00:28', '2025-09-27 21:00:28', '2025-09-30 16:47:00', '2025-12-28 03:52:59', 'Old3Months', 'Warm', 'B', '13640.00', 6, 'Somying Rakdee', 'somying02', '33/10 ภูริคลอง 7', 'คูคต', 'ลำลูกกา', '12130', 0, 1, '2025-09-29 03:52:59', NULL, 0, NULL, 1, 0, '2025-10-17 03:14:36', '2025-10-20 07:30:41', 5, 0, 1),
('CUS-003', 'วิชัย', 'เก่งมาก', '0834567890', 'wichai@email.com', 'นนทบุรี', 1, 2, '2025-09-27 21:00:28', '2025-09-27 21:00:28', '2025-10-01 21:30:00', '2025-12-28 13:59:46', 'Old3Months', 'Cold', 'C', '6430.00', 2, 'Wichai Kengmak', 'wichai03', '789 ถนนติวานนท์', 'บางกระสอ', 'เมืองนนทบุรี', '11000', 1, 0, '2025-09-29 05:45:10', '2025-09-29 07:57:55', 0, NULL, 1, 0, '2025-09-29 07:20:13', '2025-10-20 08:59:55', 7, 0, 1),
('CUS-004', 'มาลี', 'สวยงาม', '0845678901', 'malee@email.com', 'ปทุมธานี', 1, 2, '2025-09-27 21:00:28', '2025-09-27 21:00:28', '2025-10-12 10:38:00', '2025-12-28 03:38:27', 'Old3Months', 'Hot', 'A+', '600.00', 2, 'Malee Suayngam', 'malee04', '321 ถนนรังสิต', 'คลองหนึ่ง', 'คลองหลวง', '12120', 0, 1, '2025-09-29 03:38:27', NULL, 0, NULL, 1, 0, NULL, NULL, 0, 0, 0),
('CUS-005', 'ประเสริฐ', 'ดีมาก', '0856789012', 'prasert@email.com', 'สมุทรปราการ', 1, NULL, '2025-09-27 21:00:28', '2025-09-27 21:00:28', '2025-10-02 17:00:00', '2025-11-01 21:03:36', 'FollowUp', 'Warm', 'B', '0.00', 7, 'Prasert Deemak', 'prasert05', '654 ถนนสุขุมวิท', 'บางนา', 'บางนา', '10260', 0, 0, NULL, NULL, 0, NULL, 0, 1, NULL, NULL, 0, 0, 0),
('CUS-100000001', 'Mana', 'Jaidee', '0812345678', 'mana.j@example.com', 'Bangkok', 1, 2, '2025-09-17 10:31:32', '2025-09-12 10:31:32', '2025-09-24 23:54:00', '2025-12-11 10:31:32', 'Old3Months', 'Hot', 'B', '7320.00', 18, 'Mana Jaidee', 'mana.j', '123 Sukhumvit Rd', 'Khlong Toei', 'Khlong Toei', '10110', 0, 0, NULL, NULL, 0, NULL, 1, 0, '2025-09-21 10:31:32', '2025-10-17 05:25:53', 3, 0, 1),
('CUS-952141254', 'มาเรีย', 'สิกา', '0952141254', NULL, 'กรุงเทพ', 1, 1, '2025-09-24 08:14:03', '2025-09-24 08:14:03', NULL, '2025-10-24 08:14:03', 'New', 'Warm', 'D', '500.00', 0, 'อิอิ', '', '33/10', 'ออเงิน', 'สายไหม', '12120', 0, 0, NULL, NULL, 0, NULL, 1, 0, '2025-09-24 14:57:51', '2025-09-24 14:57:51', 1, 1, 0),
('CUS-952513121', 'มานี', 'พี่มานะ', '0952513121', NULL, 'ปทุมธานี', 1, 2, '2025-09-22 03:58:57', '2025-09-22 03:58:57', '2025-10-03 17:01:00', '2025-10-22 03:58:57', 'Old3Months', 'Warm', 'D', '620.00', 2, 'mana jaidee', 'manaza007', '33/10', 'ลำลูกกา', 'ลำลูกกา', '12150', 0, 0, NULL, NULL, 0, NULL, 1, 0, '2025-09-22 03:58:57', '2025-09-23 03:32:36', 2, 0, 1),
('CUS-952519797', 'พิมพ์พิกา', 'ณ ระนอง', '0952519797', NULL, 'กรุงเทพ', 1, 1, '2025-09-24 08:06:52', '2025-09-24 08:06:52', NULL, '2025-10-24 08:06:52', 'New', 'Warm', 'D', '0.00', 0, 'pimmy', 'ก็มาดิค๊าบ', '31/10', 'ออเงิน', 'สายไหม', '10210', 0, 0, NULL, NULL, 0, NULL, 1, 0, NULL, NULL, 0, 0, 0),
('CUS-954564646', 'มาโนช', 'ศรีบุญเรือง', '0954564646', NULL, 'กรุงเทพ', 1, 2, '2025-09-22 05:24:32', '2025-09-22 05:24:32', '2025-10-25 10:16:00', '2025-12-28 10:36:28', 'Old3Months', 'Warm', 'D', '600.00', 5, 'maNos', 'Manosza', '214', 'สายไหม', 'ออเงิน', '12150', 0, 2, '2025-09-29 03:16:37', NULL, 0, NULL, 1, 0, '2025-09-23 03:25:56', '2025-09-23 03:35:12', 3, 0, 1),
('CUS-958844578', 'มนัส', 'บุญจำนง', '0958844578', NULL, 'กรุงเทพ', 1, 1, '2025-09-24 08:52:21', '2025-09-24 08:52:21', NULL, '2025-10-24 08:52:21', 'New', 'Warm', 'D', '1625.00', 0, 'manus', '', '32/458', 'ออเงิน', 'สายไหม', '12150', 0, 0, NULL, NULL, 0, NULL, 1, 0, '2025-09-24 08:52:21', '2025-10-17 02:47:28', 2, 0, 1),
('CUST-001', 'บริษัท', 'เอ็กแซมเพิล จำกัด', '26789000', 'info@example.co.th', 'กรุงเทพมหานคร', 1, 2, '2025-10-27 04:58:03', '2025-10-27 04:58:03', NULL, '2025-11-26 04:58:03', 'Old', 'Hot', 'C', '2000.00', 2, 'บริษัท เอ็กแซมเพิล จำกัด', '', '128/12 ถนนพระราม 1 แขวงวังใหม่ เขตปทุมวัน', 'ลุมพินี', 'ปทุมวัน', '10330', 0, 0, NULL, NULL, 0, NULL, 1, 0, NULL, NULL, 0, 0, 0),
('CUST-TH-001', 'สมชาย', 'สุขใจ', '891234567', 'somchai@example.com', 'กรุงเทพมหานคร', 1, 2, '2025-10-29 04:20:47', '2025-10-29 03:50:19', NULL, '2025-11-28 03:50:19', NULL, 'Cold', 'D', '1000.00', 0, NULL, NULL, '99/9 หมู่บ้านสุขใจ ซอย 5 ถนนโชคชัย 4 แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพมหานคร 10230', 'แขวงลาดพร้าว', 'เขตลาดพร้าว', '10230', 0, 0, NULL, NULL, 0, NULL, 1, 0, NULL, NULL, 0, 0, 0),
('CUST-TH-002', 'สมหญิง', 'ชิงกาเบล', '891234567', 'somchai@example.com', 'กรุงเทพมหานคร', 1, 2, '2025-10-29 04:24:32', '2025-10-29 04:24:32', NULL, '2026-01-27 07:36:47', 'DailyDistribution', 'Cold', 'D', '400.00', 0, NULL, NULL, '99/9 หมู่บ้านสุขใจ ซอย 5 ถนนโชคชัย 4 แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพมหานคร 10230', 'แขวงลาดพร้าว', 'เขตลาดพร้าว', '10230', 0, 0, NULL, NULL, 0, NULL, 1, 0, NULL, NULL, 0, 0, 0),
('CUST-TH-003', 'สมปอง', 'คลองสามวา', '891234567', 'somchai@example.com', 'กรุงเทพมหานคร', 1, 2, '2025-10-29 07:42:04', '2025-10-29 07:42:04', NULL, '2026-01-27 07:42:43', 'New', 'Cold', 'D', '0.00', 0, NULL, NULL, '99/9 หมู่บ้านสุขใจ ซอย 5 ถนนโชคชัย 4 แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพมหานคร 10230', 'แขวงลาดพร้าว', 'เขตลาดพร้าว', '10230', 0, 0, NULL, NULL, 0, NULL, 1, 0, NULL, NULL, 0, 0, 0),
('CUST-TH-005', 'สมหมาย', 'ตายแล้วนะ', '891234567', 'somchai@example.com', 'กรุงเทพมหานคร', 1, NULL, '2025-10-29 09:37:13', NULL, NULL, NULL, NULL, NULL, NULL, '0.00', 0, NULL, NULL, '99/9 หมู่บ้านสุขใจ ซอย 5 ถนนโชคชัย 4 แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพมหานคร 10230', 'แขวงลาดพร้าว', 'เขตลาดพร้าว', '10230', 0, 0, NULL, NULL, 0, NULL, 1, 0, NULL, NULL, 0, 0, 0),
('CUST-TH-006', 'สมหมาย', 'ตายแล้วนะ', '891234567', 'somchai@example.com', 'กรุงเทพมหานคร', 1, 2, '2025-10-29 09:39:01', NULL, NULL, NULL, NULL, NULL, NULL, '0.00', 0, NULL, NULL, '99/9 หมู่บ้านสุขใจ ซอย 5 ถนนโชคชัย 4 แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพมหานคร 10230', 'แขวงลาดพร้าว', 'เขตลาดพร้าว', '10230', 0, 0, NULL, NULL, 0, NULL, 1, 0, NULL, NULL, 0, 0, 0),
('CUST-TH-007', 'สมหมวก', 'สวกตูด', '891234567', 'somchai@example.com', 'กรุงเทพมหานคร', 1, NULL, '2025-10-30 09:34:19', NULL, NULL, NULL, 'New', 'Cold', 'C', '0.00', 0, NULL, NULL, '99/9 หมู่บ้านสุขใจ ซอย 5 ถนนโชคชัย 4 แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพมหานคร 10230', 'แขวงลาดพร้าว', 'เขตลาดพร้าว', '10230', 0, 0, NULL, NULL, 0, NULL, 1, 0, NULL, NULL, 0, 0, 0),
('CUST-TH-008', 'สมเสร็จ', 'เสม็ดเสร็จฉัน', '891234567', 'somchai@example.com', 'กรุงเทพมหานคร', 1, NULL, '2025-10-30 09:35:23', NULL, NULL, NULL, 'New', 'Cold', 'C', '0.00', 0, NULL, NULL, '99/9 หมู่บ้านสุขใจ ซอย 5 ถนนโชคชัย 4 แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพมหานคร 10230', 'แขวงลาดพร้าว', 'เขตลาดพร้าว', '10230', 0, 0, NULL, NULL, 0, NULL, 1, 0, NULL, NULL, 0, 0, 0),
('CUST-TH-009', 'สมแล้ว1', 'นะมึง', '891234567', 'somchai@example.com', 'กรุงเทพมหานคร', 1, 2, '2025-10-30 09:50:10', '2025-10-30 09:50:10', NULL, '2026-01-28 09:50:10', 'New', 'Cold', 'C', '0.00', 0, NULL, NULL, '99/9 หมู่บ้านสุขใจ ซอย 5 ถนนโชคชัย 4 แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพมหานคร 10230', 'แขวงลาดพร้าว', 'เขตลาดพร้าว', '10230', 0, 0, NULL, NULL, 0, NULL, 1, 0, NULL, NULL, 0, 0, 0),
('CUST-TH-010', 'สมแล้ว2', 'นะมึง', '891234567', 'somchai@example.com', 'กรุงเทพมหานคร', 1, NULL, '2025-10-30 09:51:59', NULL, NULL, NULL, 'New', 'Cold', 'C', '0.00', 0, NULL, NULL, '99/9 หมู่บ้านสุขใจ ซอย 5 ถนนโชคชัย 4 แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพมหานคร 10230', 'แขวงลาดพร้าว', 'เขตลาดพร้าว', '10230', 0, 0, NULL, NULL, 0, NULL, 1, 0, NULL, NULL, 0, 0, 0),
('CUST-TH-011', 'สมแล้ว3', 'นะมึง', '891234567', 'somchai@example.com', 'กรุงเทพมหานคร', 1, NULL, '2025-10-30 09:51:59', NULL, NULL, NULL, 'New', 'Cold', 'C', '0.00', 0, NULL, NULL, '99/9 หมู่บ้านสุขใจ ซอย 5 ถนนโชคชัย 4 แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพมหานคร 10230', 'แขวงลาดพร้าว', 'เขตลาดพร้าว', '10230', 0, 0, NULL, NULL, 0, NULL, 1, 0, NULL, NULL, 0, 0, 0),
('CUST-TH-012', 'สมแล้ว4', 'นะมึง', '891234567', 'somchai@example.com', 'กรุงเทพมหานคร', 1, 2, '2025-10-30 03:23:33', NULL, NULL, '2026-01-28 03:23:33', 'DailyDistribution', 'Cold', 'C', '0.00', 0, NULL, NULL, '99/9 หมู่บ้านสุขใจ ซอย 5 ถนนโชคชัย 4 แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพมหานคร 10230', 'แขวงลาดพร้าว', 'เขตลาดพร้าว', '10230', 0, 0, NULL, NULL, 0, NULL, 1, 0, NULL, NULL, 0, 0, 0),
('CUST-TH-013', 'สมแล้ว5', 'นะมึง', '891234567', 'somchai@example.com', 'กรุงเทพมหานคร', 1, 2, '2025-10-30 09:51:59', '2025-10-30 09:51:59', NULL, '2026-01-28 09:51:59', 'New', 'Cold', 'C', '0.00', 0, NULL, NULL, '99/9 หมู่บ้านสุขใจ ซอย 5 ถนนโชคชัย 4 แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพมหานคร 10230', 'แขวงลาดพร้าว', 'เขตลาดพร้าว', '10230', 0, 0, NULL, NULL, 0, NULL, 1, 0, NULL, NULL, 0, 0, 0),
('CUST-TH-014', 'สมแล้ว6', 'นะมึง', '891234567', 'somchai@example.com', 'กรุงเทพมหานคร', 1, 2, '2025-10-30 09:52:00', '2025-10-30 09:52:00', NULL, '2026-01-28 09:52:00', 'New', 'Cold', 'C', '0.00', 0, NULL, NULL, '99/9 หมู่บ้านสุขใจ ซอย 5 ถนนโชคชัย 4 แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพมหานคร 10230', 'แขวงลาดพร้าว', 'เขตลาดพร้าว', '10230', 0, 0, NULL, NULL, 0, NULL, 1, 0, NULL, NULL, 0, 0, 0),
('CUST-TH-015', 'สมแล้ว7', 'นะมึง', '891234567', 'somchai@example.com', 'กรุงเทพมหานคร', 1, 2, '2025-10-30 09:52:00', '2025-10-30 09:52:00', NULL, '2026-01-28 09:52:00', 'New', 'Cold', 'C', '0.00', 0, NULL, NULL, '99/9 หมู่บ้านสุขใจ ซอย 5 ถนนโชคชัย 4 แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพมหานคร 10230', 'แขวงลาดพร้าว', 'เขตลาดพร้าว', '10230', 0, 0, NULL, NULL, 0, NULL, 1, 0, NULL, NULL, 0, 0, 0),
('CUST-TH-016', 'สมแล้ว8', 'นะมึง', '891234567', 'somchai@example.com', 'กรุงเทพมหานคร', 1, 2, '2025-10-30 09:52:00', '2025-10-30 09:52:00', NULL, '2026-01-28 09:52:00', 'New', 'Cold', 'C', '0.00', 0, NULL, NULL, '99/9 หมู่บ้านสุขใจ ซอย 5 ถนนโชคชัย 4 แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพมหานคร 10230', 'แขวงลาดพร้าว', 'เขตลาดพร้าว', '10230', 0, 0, NULL, NULL, 0, NULL, 1, 0, NULL, NULL, 0, 0, 0),
('CUST-TH-017', 'สมแล้ว9', 'นะมึง', '891234567', 'somchai@example.com', 'กรุงเทพมหานคร', 1, NULL, '2025-10-30 09:52:00', NULL, NULL, NULL, 'New', 'Cold', 'C', '0.00', 0, NULL, NULL, '99/9 หมู่บ้านสุขใจ ซอย 5 ถนนโชคชัย 4 แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพมหานคร 10230', 'แขวงลาดพร้าว', 'เขตลาดพร้าว', '10230', 0, 0, NULL, NULL, 0, NULL, 1, 0, NULL, NULL, 0, 0, 0);

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

--
-- Indexes for dumped tables
--

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
-- Constraints for dumped tables
--

--
-- Constraints for table `customers`
--
ALTER TABLE `customers`
  ADD CONSTRAINT `fk_customers_assigned_to` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `fk_customers_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
