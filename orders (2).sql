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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `orders`
--

INSERT INTO `orders` (`id`, `customer_id`, `company_id`, `creator_id`, `order_date`, `delivery_date`, `street`, `subdistrict`, `district`, `province`, `postal_code`, `shipping_cost`, `bill_discount`, `total_amount`, `payment_method`, `payment_status`, `slip_url`, `amount_paid`, `cod_amount`, `order_status`, `notes`, `ocr_payment_date`, `sales_channel`, `sales_channel_page_id`, `warehouse_id`) VALUES
('ORD-100000001', 'CUS-100000001', 1, 2, '2025-09-21 10:31:32', '2025-09-23 10:31:32', '123 Sukhumvit Rd', 'Khlong Toei', 'Khlong Toei', 'Bangkok', '10110', '50.00', '0.00', '2050.00', 'COD', 'PendingVerification', NULL, NULL, '2000.00', 'Delivered', 'First test order', NULL, NULL, NULL, NULL),
('ORD-1758513536907', 'CUS-952513121', 1, 2, '2025-09-22 03:58:57', '2025-09-23 00:00:00', '33/10', 'ลำลูกกา', 'ลำลูกกา', 'ปทุมธานี', '12150', '0.00', '0.00', '500.00', 'Transfer', 'Paid', NULL, '500.00', '0.00', 'Shipping', NULL, NULL, NULL, NULL, NULL),
('ORD-1758597956211', 'CUS-954564646', 1, 2, '2025-09-23 03:25:56', '2025-09-24 00:00:00', '214', 'สายไหม', 'ออเงิน', 'กรุงเทพ', '12150', '0.00', '0.00', '50.00', 'Transfer', 'Paid', 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAV6BIwDASIAAhEBAxEB/8QAHAABAAIDAQEBAAAAAAAAAAAAAAIDAQQGBQcI/8QAYhAAAQMCAwQFBQcMChEEAgMBAQACAwQRBRIhBhMxQQcUIlFhI3GBkdEVMjZTobGzFhckMzdCUnR1pLLBNVRVVnJzg', '50.00', '0.00', 'Picking', 'ข้อมูลจากสลิป: ผู้โอน: นาย ธนู ส, ผู้รับ: น.ส. ชุติกาญจน์ จันต๊ะยอด, เลขบัญชี: xxx-x-x3504-x, วันที่: 25 ก.ค. 68, เวลา: 09:45 น.\nข้อมูลจากสลิป: ผู้โอน: นาย ธนู ส, ผู้รับ: น.ส. ชุติกาญจน์ จันต๊ะยอด, เลขบัญชี: xxx-x-x3504-x\nข้อมูลจากสลิป: ผู้โอน: นาย ธนู ส, ผู้รับ: น.ส. ชุติกาญจน์ จันต๊ะยอด, เลขบัญชี: xxx-x-x3504-x', NULL, NULL, NULL, NULL),
('ORD-1758598301831', 'CUS-954564646', 1, 2, '2025-09-23 03:31:42', '2025-09-24 00:00:00', '214', 'สายไหม', 'ออเงิน', 'กรุงเทพ', '12150', '0.00', '0.00', '500.00', 'Transfer', 'Paid', 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAV6BIwDASIAAhEBAxEB/8QAHAABAAIDAQEBAAAAAAAAAAAAAAIDAQQGBQcI/8QAYhAAAQMCAwQFBQcMChEEAgMBAQACAwQRBRIhBhMxQQcUIlFhI3GBkdEVMjZTobGzFhckMzdCUnR1pLLBNVRVVnJzg', '500.00', '0.00', 'Picking', NULL, NULL, NULL, NULL, NULL),
('ORD-1758598355828', 'CUS-952513121', 1, 2, '2025-09-23 03:32:36', '2025-09-24 00:00:00', '33/10', 'ลำลูกกา', 'ลำลูกกา', 'ปทุมธานี', '12150', '0.00', '0.00', '120.00', 'Transfer', 'Paid', 'api/uploads/slips/slip_ORD-1758598355828_20251024_090631.jpg', '120.00', '0.00', 'Picking', NULL, NULL, NULL, NULL, NULL),
('ORD-1758598511994', 'CUS-954564646', 1, 2, '2025-09-23 03:35:12', '2025-09-24 00:00:00', '214', 'สายไหม', 'ออเงิน', 'กรุงเทพ', '12150', '0.00', '0.00', '50.00', 'Transfer', 'Paid', 'api/uploads/slips/slip_ORD-1758598511994_20250924_140110.jpg', '50.00', '0.00', 'Picking', NULL, NULL, NULL, NULL, NULL),
('ORD-1758703941450', 'CUS-958844578', 1, 1, '2025-09-24 08:52:21', '2025-09-25 00:00:00', '32/458', 'ออเงิน', 'สายไหม', 'กรุงเทพ', '12150', '0.00', '0.00', '50.00', 'Transfer', 'Unpaid', NULL, '0.00', '0.00', 'Picking', NULL, NULL, NULL, NULL, NULL),
('ORD-1758725870868', 'CUS-952141254', 1, 2, '2025-09-24 14:57:51', '2025-09-25 00:00:00', '33/10', 'ออเงิน', 'สายไหม', 'กรุงเทพ', '12120', '0.00', '0.00', '500.00', 'Transfer', '', NULL, NULL, NULL, '', NULL, NULL, NULL, NULL, NULL),
('ORD-1759130412537', 'CUS-003', 1, 2, '2025-09-29 07:20:13', '2025-09-30 00:00:00', '789 ถนนติวานนท์', 'บางกระสอ', 'เมืองนนทบุรี', 'นนทบุรี', '11000', '0.00', '0.00', '520.00', 'COD', '', NULL, NULL, NULL, 'Picking', NULL, NULL, NULL, NULL, NULL),
('ORD-1759132675182', 'CUS-003', 1, 2, '2025-09-29 07:57:55', '2025-09-30 00:00:00', '789 ถนนติวานนท์', 'บางกระสอ', 'เมืองนนทบุรี', 'นนทบุรี', '11000', '0.00', '0.00', '50.00', 'Transfer', '', NULL, NULL, NULL, '', NULL, NULL, NULL, NULL, NULL),
('ORD-1760669247836', 'CUS-958844578', 1, 2, '2025-10-17 02:47:28', '2025-10-18 00:00:00', '32/458', 'ออเงิน', 'สายไหม', 'กรุงเทพ', '12150', '0.00', '10.00', '1575.00', 'Transfer', '', NULL, NULL, NULL, '', NULL, NULL, NULL, NULL, NULL),
('ORD-1760670875680', 'CUS-002', 1, 2, '2025-10-17 03:14:36', '2025-10-18 00:00:00', '456 ถนนพหลโยธิน', 'จตุจักร', 'จตุจักร', 'กรุงเทพ', '10900', '40.00', '4.00', '1720.00', 'Transfer', '', NULL, NULL, NULL, '', NULL, NULL, NULL, NULL, NULL),
('ORD-1760672505732', 'CUS-100000001', 1, 2, '2025-10-17 03:41:46', '2025-10-18 00:00:00', '123 Sukhumvit Rd', 'Khlong Toei', 'Khlong Toei', 'Bangkok', '10110', '0.00', '0.00', '1250.00', 'Transfer', '', NULL, NULL, NULL, '', NULL, NULL, NULL, NULL, NULL),
('ORD-1760673128688', 'CUS-002', 1, 2, '2025-10-17 03:52:09', '2025-10-18 00:00:00', '456 ถนนพหลโยธิน', 'จตุจักร', 'จตุจักร', 'กรุงเทพ', '10900', '0.00', '0.00', '1750.00', 'Transfer', '', NULL, NULL, NULL, 'Picking', NULL, NULL, NULL, NULL, NULL),
('ORD-1760673567816', 'CUS-002', 1, 2, '2025-10-17 03:59:28', '2025-10-18 00:00:00', '456 ถนนพหลโยธิน', 'จตุจักร', 'จตุจักร', 'กรุงเทพ', '10900', '0.00', '0.00', '120.00', 'Transfer', '', NULL, NULL, NULL, 'Picking', NULL, NULL, NULL, NULL, NULL),
('ORD-1760673763984', 'CUS-002', 1, 2, '2025-10-17 04:02:44', '2025-10-18 00:00:00', '456 ถนนพหลโยธิน', 'จตุจักร', 'จตุจักร', 'กรุงเทพ', '10900', '0.00', '0.00', '1990.00', 'Transfer', '', NULL, NULL, NULL, 'Picking', NULL, NULL, NULL, NULL, NULL),
('ORD-1760678753047', 'CUS-100000001', 1, 2, '2025-10-17 05:25:53', '2025-10-18 00:00:00', '123 Sukhumvit Rd', 'Khlong Toei', 'Khlong Toei', 'Bangkok', '10110', '0.00', '0.00', '1750.00', 'Transfer', '', NULL, NULL, NULL, 'Picking', NULL, NULL, NULL, NULL, NULL),
('ORD-1760679028514', 'CUS-100000001', 1, 2, '2025-10-17 05:30:29', '2025-10-18 00:00:00', '123 Sukhumvit Rd', 'Khlong Toei', 'Khlong Toei', 'Bangkok', '10110', '0.00', '0.00', '1870.00', 'Transfer', '', NULL, NULL, NULL, 'Cancelled', NULL, NULL, NULL, NULL, NULL),
('ORD-1760679975662', 'CUS-002', 1, 2, '2025-10-17 05:46:16', '2025-10-18 00:00:00', '456 ถนนพหลโยธิน', 'จตุจักร', 'จตุจักร', 'กรุงเทพ', '10900', '0.00', '0.00', '1750.00', 'Transfer', '', NULL, NULL, NULL, 'Cancelled', NULL, NULL, NULL, NULL, NULL),
('ORD-1760680043751', 'CUS-002', 1, 2, '2025-10-17 05:47:24', '2025-10-18 00:00:00', '456 ถนนพหลโยธิน', 'จตุจักร', 'จตุจักร', 'กรุงเทพ', '10900', '0.00', '0.00', '1950.00', 'Transfer', '', NULL, NULL, NULL, 'Cancelled', NULL, NULL, NULL, NULL, NULL),
('ORD-1760945441327', 'CUS-002', 1, 1, '2025-10-20 07:30:41', '2025-10-21 00:00:00', '456 ถนนพหลโยธิน', 'จตุจักร', 'จตุจักร', 'กรุงเทพ', '10900', '0.00', '0.00', '1870.00', 'Transfer', '', NULL, NULL, NULL, '', NULL, NULL, NULL, NULL, NULL),
('ORD-1760947550715', 'CUS-003', 1, 1, '2025-10-20 08:05:51', '2025-10-21 00:00:00', '789 ถนนติวานนท์', 'บางกระสอ', 'เมืองนนทบุรี', 'นนทบุรี', '11000', '0.00', '0.00', '120.00', 'Transfer', '', NULL, NULL, NULL, '', NULL, NULL, 'Facebook', 14, NULL),
('ORD-1760948302845', 'CUS-003', 1, 2, '2025-10-20 08:18:23', '2025-10-21 00:00:00', '789 ถนนติวานนท์', 'บางกระสอ', 'เมืองนนทบุรี', 'นนทบุรี', '11000', '0.00', '0.00', '1750.00', 'Transfer', '', NULL, NULL, NULL, '', NULL, NULL, '', NULL, NULL),
('ORD-1760949151533', 'CUS-003', 1, 2, '2025-10-20 08:32:32', '2025-10-21 00:00:00', '789 ถนนติวานนท์', 'บางกระสอ', 'เมืองนนทบุรี', 'นนทบุรี', '11000', '0.00', '0.00', '1750.00', 'Transfer', '', NULL, NULL, NULL, '', NULL, NULL, '', NULL, NULL),
('ORD-1760950639386', 'CUS-003', 1, 2, '2025-10-20 08:57:19', '2025-10-21 00:00:00', '789 ถนนติวานนท์', 'บางกระสอ', 'เมืองนนทบุรี', 'นนทบุรี', '11000', '0.00', '0.00', '120.00', 'Transfer', 'Paid', NULL, '120.00', '0.00', 'Picking', NULL, NULL, 'Facebook', 28, 1),
('ORD-1760950795424', 'CUS-003', 1, 2, '2025-10-20 08:59:55', '2025-10-21 00:00:00', '789 ถนนติวานนท์', 'บางกระสอ', 'เมืองนนทบุรี', 'นนทบุรี', '11000', '0.00', '0.00', '120.00', 'COD', '', NULL, NULL, NULL, 'Picking', NULL, NULL, 'Facebook', 18, 1),
('ORD-1761279213225', 'CUS-002', 1, 1, '2025-10-24 04:13:33', '2025-10-25 00:00:00', '33/10 ภูริคลอง 7', 'คูคต', 'ลำลูกกา', 'ปทุมธานี', '12130', '0.00', '0.00', '100.00', 'Transfer', 'Unpaid', 'api/uploads/slips/slip_ORD-1761279213225_20251024_041333_6a59f4.jpg', '0.00', '0.00', 'Cancelled', NULL, NULL, 'Facebook', 32, 1),
('ORD-1761281352625', 'CUS-002', 1, 1, '2025-10-24 04:49:13', '2025-10-25 00:00:00', '33/10 ภูริคลอง 7', 'คูคต', 'ลำลูกกา', 'ปทุมธานี', '12130', '0.00', '0.00', '1750.00', 'Transfer', 'Paid', 'api/uploads/slips/slip_ORD-1761281352625_20251024_044912_1ad2d2.jpg', '1750.00', '0.00', 'Picking', NULL, NULL, 'Facebook', 28, 1),
('ORD-1761282292085', 'CUS-002', 1, 1, '2025-10-24 05:04:52', '2025-10-25 00:00:00', '33/10 ภูริคลอง 7', 'คูคต', 'ลำลูกกา', 'ปทุมธานี', '12130', '0.00', '0.00', '120.00', 'Transfer', 'Unpaid', 'api/uploads/slips/slip_ORD-1761282292085_20251024_050452_b0f498.jpg', '0.00', '0.00', 'Cancelled', NULL, NULL, 'Facebook', 26, 1),
('ORD-1761285041247', 'CUS-002', 1, 1, '2025-10-24 05:50:41', '2025-10-25 00:00:00', '456 ถนนพหลโยธิน', 'จตุจักร', 'จตุจักร', 'กรุงเทพ', '10900', '0.00', '0.00', '120.00', 'Transfer', 'Unpaid', 'api/uploads/slips/slip_ORD-1761285041247_20251024_055041_b7e77c.jpg', NULL, NULL, 'Pending', NULL, NULL, 'Facebook', 32, 7),
('ORD-1761533589243', 'CUS-100000001', 1, 2, '2025-10-27 02:53:09', '2025-10-28 00:00:00', '123 Sukhumvit Rd', 'Khlong Toei', 'Khlong Toei', 'Bangkok', '10110', '0.00', '0.00', '400.00', 'COD', 'Unpaid', NULL, NULL, NULL, 'Picking', NULL, NULL, 'โทร', NULL, 7),
('ORD-1761622007989', 'CUST-001', 1, 2, '2025-10-28 03:26:48', '2025-10-29 00:00:00', '128/12 ถนนพระราม 1 แขวงวังใหม่ เขตปทุมวัน', 'ลุมพินี', 'ปทุมวัน', 'กรุงเทพมหานคร', '10330', '0.00', '0.00', '200.00', 'COD', 'Unpaid', NULL, NULL, NULL, 'Picking', NULL, NULL, 'โทร', NULL, 1),
('ORD-1761622787497', 'CUS-004', 1, 2, '2025-10-28 03:39:47', '2025-10-29 00:00:00', '321 ถนนรังสิต', 'คลองหนึ่ง', 'คลองหลวง', 'ปทุมธานี', '12120', '0.00', '0.00', '600.00', 'Transfer', 'PendingVerification', NULL, NULL, NULL, 'Pending', NULL, NULL, 'โทร', NULL, 1),
('ORD-1761622870309', 'CUS-003', 1, 2, '2025-10-28 03:41:10', '2025-10-29 00:00:00', '789 ถนนติวานนท์', 'บางกระสอ', 'เมืองนนทบุรี', 'นนทบุรี', '11000', '0.00', '0.00', '2000.00', 'Transfer', 'PendingVerification', NULL, NULL, NULL, 'Pending', NULL, NULL, 'โทร', NULL, 1),
('ORD-1761625258789', 'CUST-001', 1, 2, '2025-10-28 04:20:59', '2025-10-29 00:00:00', '128/12 ถนนพระราม 1 แขวงวังใหม่ เขตปทุมวัน', 'ลุมพินี', 'ปทุมวัน', 'กรุงเทพมหานคร', '10330', '0.00', '0.00', '600.00', 'Transfer', 'Paid', 'api/uploads/slips/slip_ORD-1761625258789_20251028_042058_409814.png', '600.00', '0.00', 'Pending', NULL, NULL, 'โทร', NULL, 1),
('ORD-1761625451361', 'CUST-001', 1, 2, '2025-10-28 04:24:11', '2025-10-29 00:00:00', '128/12 ถนนพระราม 1 แขวงวังใหม่ เขตปทุมวัน', 'ลุมพินี', 'ปทุมวัน', 'กรุงเทพมหานคร', '10330', '0.00', '0.00', '400.00', 'Transfer', 'Paid', 'api/uploads/slips/slip_ORD-1761625451361_20251028_042411_991f87.png', '400.00', '0.00', 'Pending', NULL, NULL, 'โทร', NULL, 1),
('ORD-1761625974435', 'CUST-001', 1, 2, '2025-10-28 04:32:54', '2025-10-29 00:00:00', '128/12 ถนนพระราม 1 แขวงวังใหม่ เขตปทุมวัน', 'ลุมพินี', 'ปทุมวัน', 'กรุงเทพมหานคร', '10330', '0.00', '0.00', '200.00', 'Transfer', 'PendingVerification', 'api/uploads/slips/slip_ORD-1761625974435_20251028_043254_59d73d.png', NULL, NULL, 'Pending', NULL, NULL, 'โทร', NULL, 1),
('ORD-1761629121525', 'CUS-002', 1, 2, '2025-10-28 05:25:22', '2025-10-29 00:00:00', '456 ถนนพหลโยธิน', 'จตุจักร', 'จตุจักร', 'กรุงเทพ', '10900', '0.00', '0.00', '400.00', 'COD', 'Unpaid', NULL, NULL, NULL, 'Pending', NULL, NULL, 'โทร', NULL, 7),
('ORD-1761636425498', 'CUST-001', 1, 1, '2025-10-28 07:27:05', '2025-10-29 00:00:00', '128/12 ถนนพระราม 1 แขวงวังใหม่ เขตปทุมวัน', 'ลุมพินี', 'ปทุมวัน', 'กรุงเทพมหานคร', '10330', '0.00', '0.00', '360.00', 'COD', 'Unpaid', NULL, NULL, NULL, 'Pending', NULL, NULL, 'Facebook', 32, 1),
('ORD-1761642243789', 'CUST-001', 1, 1, '2025-10-28 09:04:04', '2025-10-29 00:00:00', '128/12 ถนนพระราม 1 แขวงวังใหม่ เขตปทุมวัน', 'ลุมพินี', 'ปทุมวัน', 'กรุงเทพมหานคร', '10330', '0.00', '0.00', '240.00', 'COD', 'Unpaid', NULL, NULL, NULL, 'Pending', NULL, NULL, 'Facebook', 18, 1),
('SO-1001', 'CUST-TH-001', 1, 47, '2025-10-29 03:50:19', '2025-10-29 03:50:19', '99/9 หมู่บ้านสุขใจ ซอย 5 ถนนโชคชัย 4 แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพมหานคร 10230', 'แขวงลาดพร้าว', 'เขตลาดพร้าว', 'กรุงเทพมหานคร', '10230', '0.00', '0.00', '600.00', 'Transfer', 'Paid', NULL, '600.00', NULL, 'Pending', 'คำสั่งซื้อแรกจากแคมเปญเดือนตุลาคม', NULL, NULL, NULL, NULL),
('SO-1002', 'CUST-TH-001', 1, 47, '2025-10-29 04:20:47', '2025-10-29 04:20:47', '99/9 หมู่บ้านสุขใจ ซอย 5 ถนนโชคชัย 4 แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพมหานคร 10230', 'แขวงลาดพร้าว', 'เขตลาดพร้าว', 'กรุงเทพมหานคร', '10230', '0.00', '0.00', '400.00', 'COD', 'Paid', NULL, '400.00', '400.00', 'Pending', 'คำสั่งซื้อที่สองจากแคมเปญเดือนตุลาคม', NULL, NULL, NULL, NULL),
('SO-1003', 'CUST-TH-002', 1, 47, '2025-10-29 04:24:32', '2025-10-29 04:24:32', '99/9 หมู่บ้านสุขใจ ซอย 5 ถนนโชคชัย 4 แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพมหานคร 10230', 'แขวงลาดพร้าว', 'เขตลาดพร้าว', 'กรุงเทพมหานคร', '10230', '0.00', '0.00', '400.00', 'COD', 'Paid', NULL, '400.00', '400.00', 'Pending', 'คำสั่งซื้อที่สองจากแคมเปญเดือนตุลาคม', NULL, NULL, NULL, NULL),
('SO-1005', 'CUST-TH-005', 1, 47, '2025-10-29 09:37:14', '2025-10-29 09:37:14', '99/9 หมู่บ้านสุขใจ ซอย 5 ถนนโชคชัย 4 แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพมหานคร 10230', 'แขวงลาดพร้าว', 'เขตลาดพร้าว', 'กรุงเทพมหานคร', '10230', '0.00', '0.00', '2000.00', 'COD', 'Paid', NULL, '2000.00', '2000.00', 'Pending', 'คำสั่งซื้อที่สองจากแคมเปญเดือนตุลาคม', NULL, NULL, NULL, NULL),
('SO-1006', 'CUST-TH-006', 1, 47, '2025-10-29 09:39:01', '2025-10-29 09:39:01', '99/9 หมู่บ้านสุขใจ ซอย 5 ถนนโชคชัย 4 แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพมหานคร 10230', 'แขวงลาดพร้าว', 'เขตลาดพร้าว', 'กรุงเทพมหานคร', '10230', '0.00', '0.00', '2000.00', 'COD', 'Paid', NULL, '2000.00', '2000.00', 'Pending', 'คำสั่งซื้อที่สองจากแคมเปญเดือนตุลาคม', NULL, NULL, NULL, NULL),
('SO-1007', 'CUST-TH-007', 1, 47, '2025-10-30 09:34:20', '2025-10-30 09:34:20', '99/9 หมู่บ้านสุขใจ ซอย 5 ถนนโชคชัย 4 แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพมหานคร 10230', 'แขวงลาดพร้าว', 'เขตลาดพร้าว', 'กรุงเทพมหานคร', '10230', '0.00', '0.00', '2000.00', 'COD', 'Paid', NULL, '2000.00', '2000.00', 'Pending', 'คำสั่งซื้อที่สองจากแคมเปญเดือนตุลาคม', NULL, NULL, NULL, NULL),
('SO-1008', 'CUST-TH-008', 1, 47, '2025-10-30 09:35:23', '2025-10-30 09:35:23', '99/9 หมู่บ้านสุขใจ ซอย 5 ถนนโชคชัย 4 แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพมหานคร 10230', 'แขวงลาดพร้าว', 'เขตลาดพร้าว', 'กรุงเทพมหานคร', '10230', '0.00', '0.00', '2000.00', 'COD', 'Paid', NULL, '2000.00', '2000.00', 'Pending', 'คำสั่งซื้อที่สองจากแคมเปญเดือนตุลาคม', NULL, NULL, NULL, NULL),
('SO-1009', 'CUST-TH-009', 1, 47, '2025-10-30 09:50:10', '2025-10-30 09:50:10', '99/9 หมู่บ้านสุขใจ ซอย 5 ถนนโชคชัย 4 แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพมหานคร 10230', 'แขวงลาดพร้าว', 'เขตลาดพร้าว', 'กรุงเทพมหานคร', '10230', '0.00', '0.00', '2000.00', 'COD', 'Paid', NULL, '2000.00', '2000.00', 'Pending', 'คำสั่งซื้อที่สองจากแคมเปญเดือนตุลาคม', NULL, NULL, NULL, NULL),
('SO-1010', 'CUST-TH-010', 1, 47, '2025-10-30 09:51:59', '2025-10-30 09:51:59', '99/9 หมู่บ้านสุขใจ ซอย 5 ถนนโชคชัย 4 แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพมหานคร 10230', 'แขวงลาดพร้าว', 'เขตลาดพร้าว', 'กรุงเทพมหานคร', '10230', '0.00', '0.00', '1200.00', 'COD', 'Paid', NULL, '1200.00', '1200.00', 'Pending', 'คำสั่งซื้อที่สองจากแคมเปญเดือนตุลาคม', NULL, NULL, NULL, NULL),
('SO-1011', 'CUST-TH-011', 1, 47, '2025-10-30 09:51:59', '2025-10-30 09:51:59', '99/9 หมู่บ้านสุขใจ ซอย 5 ถนนโชคชัย 4 แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพมหานคร 10230', 'แขวงลาดพร้าว', 'เขตลาดพร้าว', 'กรุงเทพมหานคร', '10230', '0.00', '0.00', '1400.00', 'COD', 'Paid', NULL, '1400.00', '1400.00', 'Pending', 'คำสั่งซื้อที่สองจากแคมเปญเดือนตุลาคม', NULL, NULL, NULL, NULL),
('SO-1012', 'CUST-TH-012', 1, 47, '2025-10-30 09:51:59', '2025-10-30 09:51:59', '99/9 หมู่บ้านสุขใจ ซอย 5 ถนนโชคชัย 4 แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพมหานคร 10230', 'แขวงลาดพร้าว', 'เขตลาดพร้าว', 'กรุงเทพมหานคร', '10230', '0.00', '0.00', '1600.00', 'COD', 'Paid', NULL, '1600.00', '1600.00', 'Pending', 'คำสั่งซื้อที่สองจากแคมเปญเดือนตุลาคม', NULL, NULL, NULL, NULL),
('SO-1013', 'CUST-TH-013', 1, 47, '2025-10-30 09:52:00', '2025-10-30 09:52:00', '99/9 หมู่บ้านสุขใจ ซอย 5 ถนนโชคชัย 4 แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพมหานคร 10230', 'แขวงลาดพร้าว', 'เขตลาดพร้าว', 'กรุงเทพมหานคร', '10230', '0.00', '0.00', '2000.00', 'COD', 'Paid', NULL, '2000.00', '2000.00', 'Pending', 'คำสั่งซื้อที่สองจากแคมเปญเดือนตุลาคม', NULL, NULL, NULL, NULL),
('SO-1014', 'CUST-TH-014', 1, 47, '2025-10-30 09:52:00', '2025-10-30 09:52:00', '99/9 หมู่บ้านสุขใจ ซอย 5 ถนนโชคชัย 4 แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพมหานคร 10230', 'แขวงลาดพร้าว', 'เขตลาดพร้าว', 'กรุงเทพมหานคร', '10230', '0.00', '0.00', '16000.00', 'COD', 'Paid', NULL, '16000.00', '16000.00', 'Pending', 'คำสั่งซื้อที่สองจากแคมเปญเดือนตุลาคม', NULL, NULL, NULL, NULL),
('SO-1015', 'CUST-TH-015', 1, 47, '2025-10-30 09:52:00', '2025-10-30 09:52:00', '99/9 หมู่บ้านสุขใจ ซอย 5 ถนนโชคชัย 4 แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพมหานคร 10230', 'แขวงลาดพร้าว', 'เขตลาดพร้าว', 'กรุงเทพมหานคร', '10230', '0.00', '0.00', '6000.00', 'COD', 'Paid', NULL, '6000.00', '6000.00', 'Pending', 'คำสั่งซื้อที่สองจากแคมเปญเดือนตุลาคม', NULL, NULL, NULL, NULL),
('SO-1016', 'CUST-TH-016', 1, 47, '2025-10-30 09:52:00', '2025-10-30 09:52:00', '99/9 หมู่บ้านสุขใจ ซอย 5 ถนนโชคชัย 4 แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพมหานคร 10230', 'แขวงลาดพร้าว', 'เขตลาดพร้าว', 'กรุงเทพมหานคร', '10230', '0.00', '0.00', '4000.00', 'COD', 'Paid', NULL, '4000.00', '4000.00', 'Pending', 'คำสั่งซื้อที่สองจากแคมเปญเดือนตุลาคม', NULL, NULL, NULL, NULL),
('SO-1017', 'CUST-TH-017', 1, 47, '2025-10-30 09:52:00', '2025-10-30 09:52:00', '99/9 หมู่บ้านสุขใจ ซอย 5 ถนนโชคชัย 4 แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพมหานคร 10230', 'แขวงลาดพร้าว', 'เขตลาดพร้าว', 'กรุงเทพมหานคร', '10230', '0.00', '0.00', '10800.00', 'COD', 'Paid', NULL, '10800.00', '10800.00', 'Pending', 'คำสั่งซื้อที่สองจากแคมเปญเดือนตุลาคม', NULL, NULL, NULL, NULL);

--
-- Indexes for dumped tables
--

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
-- Constraints for dumped tables
--

--
-- Constraints for table `orders`
--
ALTER TABLE `orders`
  ADD CONSTRAINT `fk_orders_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`),
  ADD CONSTRAINT `fk_orders_creator` FOREIGN KEY (`creator_id`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `fk_orders_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  ADD CONSTRAINT `fk_orders_page` FOREIGN KEY (`sales_channel_page_id`) REFERENCES `pages` (`id`),
  ADD CONSTRAINT `fk_orders_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
