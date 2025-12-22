-- phpMyAdmin SQL Dump
-- version 4.9.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Dec 20, 2025 at 09:25 AM
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
  `bucket_type` varchar(16) COLLATE utf8mb4_unicode_ci GENERATED ALWAYS AS ((case when (coalesce(`is_blocked`,0) = 1) then _utf8mb4'blocked' when (coalesce(`is_in_waiting_basket`,0) = 1) then _utf8mb4'waiting' when (`assigned_to` is null) then _utf8mb4'ready' else _utf8mb4'assigned' end)) STORED
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `customers`
--

INSERT INTO `customers` (`customer_id`, `customer_ref_id`, `first_name`, `last_name`, `phone`, `backup_phone`, `email`, `province`, `company_id`, `assigned_to`, `date_assigned`, `date_registered`, `follow_up_date`, `ownership_expires`, `lifecycle_status`, `behavioral_status`, `grade`, `total_purchases`, `total_calls`, `facebook_name`, `line_id`, `street`, `subdistrict`, `district`, `postal_code`, `recipient_first_name`, `recipient_last_name`, `has_sold_before`, `follow_up_count`, `last_follow_up_date`, `last_sale_date`, `is_in_waiting_basket`, `waiting_basket_start_date`, `followup_bonus_remaining`, `is_blocked`, `first_order_date`, `last_order_date`, `order_count`, `is_new_customer`, `is_repeat_customer`) VALUES
(1, 'CUS-812345624-1', 'สมชาย', 'ใจดี', '0812345624', NULL, 'somchai@email.com', 'กรุงเทพ', 1, NULL, '2025-09-27 21:00:09', '2025-09-27 21:00:09', '2025-10-11 22:30:00', '2025-12-28 10:36:28', 'Old', 'Hot', 'D', '0.00', 1, 'Somchai Jaidee', 'somchai01', '123 ถนนสุขุมวิท', 'คลองตัน', 'วัฒนา', '10110', 'สมชาย', 'ใจดี', 0, 1, '2025-09-27 15:30:09', NULL, 0, NULL, 1, 0, NULL, NULL, 0, 0, 0),
(3, 'CUS-834567890-1', 'วิชัย', 'เก่งมาก', '0834567890', NULL, 'wichai@email.com', 'นนทบุรี', 1, NULL, '2025-09-27 21:00:28', '2025-09-27 21:00:28', '2025-10-01 21:30:00', '2026-03-18 17:01:46', 'Old3Months', 'Cold', 'B', '6430.00', 2, 'Wichai Kengmak', 'wichai03', '789 ถนนติวานนท์', 'บางกระสอ', 'เมืองนนทบุรี', '11000', 'วิชัย', 'เก่งมาก', 1, 0, '2025-09-29 05:45:10', '2025-12-19 00:00:00', 0, NULL, 1, 0, '2025-09-29 07:20:13', '2025-10-20 08:59:55', 7, 0, 1),
(4, 'CUS-845678901-1', 'มาลี', 'สวยงาม', '0845678901', NULL, 'malee@email.com', 'ปทุมธานี', 1, NULL, '2025-09-27 21:00:28', '2025-09-27 21:00:28', '2025-10-12 10:38:00', '2025-12-28 03:38:27', 'Old3Months', 'Hot', 'D', '600.00', 2, 'Malee Suayngam', 'malee04', '321 ถนนรังสิต', 'คลองหนึ่ง', 'คลองหลวง', '12120', 'มาลี', 'สวยงาม', 0, 1, '2025-09-29 03:38:27', NULL, 0, NULL, 1, 0, NULL, NULL, 0, 0, 0),
(5, 'CUS-123521452-1', 'ประเสริฐ', 'ดีมาก', '0123521452', NULL, 'prasert@email.com', 'สมุทรปราการ', 1, NULL, '2025-09-27 21:00:28', '2025-09-27 21:00:28', '2025-10-02 17:00:00', '2026-01-02 14:40:00', 'Old', 'Warm', 'D', '0.00', 7, 'Prasert Deemak', 'prasert05', '654 ถนนสุขุมวิท', 'บางนา', 'บางนา', '10260', 'ประเสริฐ', 'ดีมาก', 0, 0, NULL, NULL, 0, NULL, 1, 0, NULL, NULL, 0, 0, 0),
(6, 'CUS-999999990-1', 'Mana', 'Jaidee', '0999999990', '0987454654', 'mana.j@example.com', 'กรุงเทพมหานคร', 1, NULL, '2025-09-17 10:31:32', '2025-09-12 10:31:32', '2025-09-24 23:54:00', '2026-03-15 14:39:33', 'Old3Months', 'Hot', 'B', '7320.00', 18, 'Mana Jaidee', 'mana.j', '123 Sukhumvit Rd', 'คลองต้นไทร', 'เขตคลองสาน', '10600', 'Mana', 'Jaidee', 1, 0, NULL, '2025-12-16 00:00:00', 0, NULL, 1, 0, '2025-09-21 10:31:32', '2025-10-17 05:25:53', 3, 0, 1),
(7, 'CUS-666666666-1', 'สุดจัด', 'ปลัดบอก', '0666666666', '0989898987', NULL, 'กรุงเทพมหานคร', 1, NULL, '2025-11-04 03:58:45', '2025-10-31 08:44:25', NULL, '2026-03-18 16:42:29', 'Old3Months', 'Warm', 'D', '0.00', 0, 'กด', '', '99/9 หมู่บ้านสุขใจ ซอย 5 ถนนโชคชัย 4 แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพมหานคร 10230', 'ทรายกองดิน', 'เขตคลองสามวา', '10510', 'สุดจัด', 'ปลัดบอก', 1, 0, NULL, '2025-12-19 00:00:00', 1, '2025-12-03 12:26:00', 1, 0, NULL, NULL, 0, 0, 0),
(8, 'CUS-952141253-1', 'กดกดกด', 'ดดด', '0952141253', NULL, NULL, 'กรุงเทพมหานคร', 1, NULL, '2025-11-04 03:26:10', '2025-10-31 09:02:16', NULL, '2025-11-30 09:02:16', 'FollowUp', 'Warm', 'D', '0.00', 0, 'ก', '', '33/10 ภูริคลอง 7', 'คลองต้นไทร', 'เขตคลองสาน', '10600', 'กดกดกด', 'ดดด', 0, 0, NULL, NULL, 1, '2025-12-03 12:26:00', 1, 0, NULL, NULL, 0, 0, 0),
(9, 'CUS-952141254-1', 'มาเรีย', 'สิกา', '0952141254', NULL, NULL, 'กรุงเทพมหานคร', 1, NULL, '2025-09-24 08:14:03', '2025-09-24 08:14:03', NULL, '2026-03-16 16:47:35', 'Old3Months', 'Warm', 'D', '500.00', 0, 'อิอิ', '', '123/325', 'ทรายกองดินใต้', 'เขตคลองสามวา', '10510', 'มาเรีย', 'ลิกา', 1, 0, NULL, '2025-12-17 00:00:00', 0, NULL, 1, 0, '2025-09-24 14:57:51', '2025-09-24 14:57:51', 1, 1, 0),
(10, 'CUS-952513121-1', 'มานี', 'พี่มานะ', '0952513121', NULL, NULL, 'ปทุมธานี', 1, NULL, '2025-09-22 03:58:57', '2025-09-22 03:58:57', '2025-10-03 17:01:00', '2026-01-02 14:40:00', 'Old', 'Warm', 'D', '620.00', 2, 'mana jaidee', 'manaza007', '33/10', 'ลำลูกกา', 'ลำลูกกา', '12150', 'มานี', 'พี่มานะ', 0, 0, NULL, NULL, 0, NULL, 1, 0, '2025-09-22 03:58:57', '2025-09-23 03:32:36', 2, 0, 1),
(11, 'CUS-952519795-1', 'ธนู', '', '0952519795', NULL, NULL, 'กรุงเทพมหานคร', 1, NULL, '2025-11-13 07:42:22', '2025-11-13 07:42:22', NULL, '2025-12-13 07:42:22', 'New', 'Warm', 'D', '0.00', 0, '', '', '456 ถนนพหลโยธิน', 'ทรายกองดิน', 'เขตคลองสามวา', '10510', 'ธนู', '', 0, 0, NULL, NULL, 1, '2025-11-13 07:42:22', 1, 0, NULL, NULL, 0, 0, 0),
(12, 'CUS-952519797-1', 'พิมพ์พิกา', 'ณ ระนอง', '0952519797', NULL, NULL, 'กรุงเทพมหานคร', 1, NULL, '2025-09-24 08:06:52', '2025-09-24 08:06:52', NULL, '2026-03-16 16:33:15', 'Old3Months', 'Warm', 'D', '0.00', 0, 'pimmy', 'ก็มาดิค๊าบ', '31/10', 'ออเงิน', 'เขตสายไหม', '10220', 'พิมพ์พิกา', 'ณ ระนอง', 1, 0, NULL, '2025-12-17 00:00:00', 0, NULL, 1, 0, NULL, NULL, 0, 0, 0),
(14, 'CUS-954564646-1', 'มาโนช', 'ศรีบุญเรือง', '0954564646', NULL, NULL, 'กรุงเทพ', 1, NULL, '2025-09-22 05:24:32', '2025-09-22 05:24:32', '2025-10-25 10:16:00', '2025-12-28 10:36:28', 'Old3Months', 'Warm', 'D', '600.00', 5, 'maNos', 'Manosza', '214', 'สายไหม', 'ออเงิน', '12150', 'มาโนช', 'ศรีบุญเรือง', 0, 2, '2025-09-29 03:16:37', NULL, 0, NULL, 1, 0, '2025-09-23 03:25:56', '2025-09-23 03:35:12', 3, 0, 1),
(15, 'CUS-958844578-1', 'มนัส', 'บุญจำนง', '0958844578', NULL, NULL, 'กรุงเทพ', 1, NULL, '2025-09-24 08:52:21', '2025-09-24 08:52:21', NULL, '2026-01-02 14:40:00', 'Old', 'Warm', 'D', '1625.00', 0, 'manus', '', '32/458', 'ออเงิน', 'สายไหม', '12150', 'มนัส', 'บุญจำนง', 0, 0, NULL, NULL, 0, NULL, 1, 0, '2025-09-24 08:52:21', '2025-10-17 02:47:28', 2, 0, 1),
(16, 'CUS-26789000-1', 'บริษัท', 'เอ็กแซมเพิล จำกัด', '26789000', NULL, 'info@example.co.th', 'กรุงเทพมหานคร', 1, NULL, '2025-10-27 04:58:03', '2025-10-27 04:58:03', NULL, '2025-11-26 04:58:03', 'FollowUp', 'Hot', 'C', '2000.00', 2, 'บริษัท เอ็กแซมเพิล จำกัด', '', '128/12 ถนนพระราม 1 แขวงวังใหม่ เขตปทุมวัน', 'ลุมพินี', 'ปทุมวัน', '10330', 'บริษัท', 'เอ็กแซมเพิล จำกัด', 0, 0, NULL, NULL, 1, '2025-12-03 12:26:00', 1, 0, NULL, NULL, 0, 0, 0),
(17, 'CUS-891234567-1', 'สมชาย', 'สุขใจ', '891234567', NULL, 'somchai@example.com', 'กรุงเทพมหานคร', 1, NULL, '2025-10-29 04:20:47', '2025-10-29 03:50:19', NULL, '2025-11-28 03:50:19', 'FollowUp', 'Cold', 'D', '1000.00', 0, NULL, NULL, '99/9 หมู่บ้านสุขใจ ซอย 5 ถนนโชคชัย 4 แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพมหานคร 10230', 'แขวงลาดพร้าว', 'เขตลาดพร้าว', '10230', 'สมชาย', 'สุขใจ', 0, 0, NULL, NULL, 1, '2025-12-03 12:26:00', 1, 0, NULL, NULL, 0, 0, 0),
(99999, 'CUS-366655444-1', 'สุเมา', 'เสาร์อาทิตย์', '0366655444', '0958585858', NULL, 'ปทุมธานี', 1, NULL, '2025-11-14 09:54:09', '2025-11-14 09:54:09', '2025-11-22 21:19:00', '2025-12-02 09:54:09', 'Old', 'Warm', 'D', '0.00', 2, 'กดกดกด', 'กดกดกด', 'Thailand', 'บึงยี่โถ', 'ธัญบุรี', '12130', 'หกดดกด', 'กดกดด', 0, 0, NULL, NULL, 1, '2025-12-03 14:40:00', 1, 0, NULL, NULL, 0, 0, 0),
(100000, 'CUS-111333332-1', 'มาทดสอบ', 'upsell', '0111333332', '0878976511', NULL, 'กรุงเทพมหานคร', 1, NULL, '2025-11-23 08:50:46', '2025-11-23 08:50:46', NULL, '2025-12-23 08:50:46', 'New', 'Warm', 'D', '0.00', 0, 'Test1', 'Test01', '33/10 ภูริคลอง 7', 'ทรายกองดินใต้', 'เขตคลองสามวา', '10510', NULL, NULL, 0, 0, NULL, NULL, 0, NULL, 1, 0, NULL, NULL, 0, 0, 0),
(100001, 'CUS-111333335-1', 'มาทดสอบ2', 'upsell2', '0111333335', '0878976512', NULL, 'กรุงเทพมหานคร', 1, NULL, '2025-11-23 09:13:23', '2025-11-23 08:54:23', NULL, '2026-02-21 09:13:23', 'DailyDistribution', 'Warm', 'D', '0.00', 0, 'Test1', 'Test01', '33/10 ภูริคลอง 7', 'ทรายกองดินใต้', 'เขตคลองสามวา', '10510', NULL, NULL, 0, 0, NULL, NULL, 0, NULL, 1, 1, NULL, NULL, 0, 0, 0),
(100002, 'CUS-955412135-1', 'สนทนา', 'มานะทดสอบ', '0955412135', NULL, NULL, 'ปทุมธานี', 1, NULL, '2025-11-24 02:55:47', '2025-11-24 02:55:15', '2025-12-03 11:48:00', '2025-12-02 02:55:47', 'Old', 'Warm', 'D', '0.00', 1, '', '', 'Thailand', 'บึงยี่โถ', 'ธัญบุรี', '12130', 'สนทนา', 'มานะทดสอบ', 0, 0, NULL, NULL, 1, '2025-12-03 14:40:00', 1, 0, NULL, NULL, 0, 0, 0),
(100003, 'CUS-952114256-1', 'มาม่า', 'ไวๆ', '0952114256', '0952147465', NULL, 'ปทุมธานี', 1, 1655, '2025-11-24 03:12:30', '2025-11-24 03:12:10', NULL, '2026-02-26 00:00:00', 'Old3Months', 'Warm', 'D', '0.00', 0, 'กกกกก', '', 'Thailand', 'ระแหง', 'ลาดหลุมแก้ว', '12140', 'มาม่า', 'ไวๆ', 1, 0, NULL, '2025-11-28 00:00:00', 0, NULL, 1, 0, NULL, NULL, 0, 0, 0),
(100004, 'CUS-952154648-1', 'ddfdf', 'sdfsdfsdfsdf', '0952154648', NULL, NULL, 'ปทุมธานี', 1, 1655, '2025-11-24 03:19:49', '2025-11-24 03:17:29', NULL, '2025-12-24 03:19:49', 'DailyDistribution', 'Warm', 'D', '0.00', 0, '', '', 'Thailand', 'คูคต', 'ลำลูกกา', '12130', NULL, NULL, 0, 0, NULL, NULL, 0, NULL, 1, 0, NULL, NULL, 0, 0, 0),
(100005, 'CUS-956546845-1', 'asdddasdad', 'asdsada', '0956546845', NULL, NULL, 'ปทุมธานี', 1, 1655, '2025-11-24 03:19:49', '2025-11-24 03:18:28', '2025-12-04 11:26:00', '2025-12-24 03:19:49', 'FollowUp', 'Warm', 'D', '0.00', 1, 'dfdfdsf', '', 'Thailand', 'บึงยี่โถ', 'ธัญบุรี', '12130', NULL, NULL, 0, 0, NULL, NULL, 0, NULL, 1, 0, NULL, NULL, 0, 0, 0),
(100006, 'CUS-952513213-1', 'ssdfsfsfsf', 'dfsfsf', '0952513213', NULL, NULL, 'กาญจนบุรี', 1, 1655, '2025-11-24 03:19:49', '2025-11-24 03:19:20', NULL, '2025-12-24 03:19:49', 'DailyDistribution', 'Warm', 'D', '0.00', 0, 'dsfdsfs', '', 'sfdfsdfsdf', 'ปิล๊อก', 'ทองผาภูมิ', '71180', NULL, NULL, 0, 0, NULL, NULL, 0, NULL, 1, 0, NULL, NULL, 0, 0, 0),
(100007, 'CUS-925154689-1', 'ทัศนัย', 'อามัยนามอ', '0925154689', '0648745321', NULL, 'ปทุมธานี', 1, 1654, '2025-12-16 04:23:36', '2025-11-24 03:51:04', '2025-12-03 12:14:00', '2026-01-15 11:23:36', 'DailyDistribution', 'Warm', 'D', '0.00', 2, 'กดกดกดกด', 'กดกดกด', 'Thailand', 'คูบางหลวง', 'ลาดหลุมแก้ว', '12140', NULL, NULL, 0, 0, NULL, NULL, 0, NULL, 1, 0, NULL, NULL, 0, 0, 0),
(100008, 'CUS-952515468-1', 'sdfsdfdsfsdfsdfsdf', 'dsfsdxcvcxvxcvsdf', '0952515468', NULL, NULL, 'ปทุมธานี', 1, 1655, '2025-11-24 04:06:10', '2025-11-24 04:05:24', NULL, '2026-02-23 00:00:00', 'Old3Months', 'Warm', 'D', '0.00', 0, '', '', 'Thailand', 'คูบางหลวง', 'ลาดหลุมแก้ว', '12140', 'sdfsdfdsfsdfsdfsdf', 'dsfsdxcvcxvxcvsdf', 1, 0, NULL, '2025-11-25 00:00:00', 0, NULL, 1, 0, NULL, NULL, 0, 0, 0),
(100009, 'CUS-352145521-1', 'ขอโทดด', 'ทดสอบงาน', '0352145521', NULL, NULL, 'กาฬสินธุ์', 1, 1655, '2025-12-16 03:05:13', '2025-11-25 08:07:50', '2025-12-03 12:14:00', '2026-01-15 10:05:12', 'Old', 'Warm', 'D', '0.00', 1, '', '', 'หกดหกดหดห', 'จุมจัง', 'กุฉินารายณ์', '46110', 'ขอโทดด', 'ทดสอบงาน', 0, 0, NULL, NULL, 0, NULL, 1, 0, NULL, NULL, 0, 0, 0);

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

--
-- Indexes for dumped tables
--

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
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `customers`
--
ALTER TABLE `customers`
  MODIFY `customer_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=100010;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
