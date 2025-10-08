-- phpMyAdmin SQL Dump
-- version 4.9.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Oct 08, 2025 at 09:32 AM
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `activities`
--

INSERT INTO `activities` (`id`, `customer_id`, `timestamp`, `type`, `description`, `actor_name`) VALUES
(1, 'CUS-100000001', '2025-09-21 10:31:32', 'order_created', 'Created order ORD-100000001', 'Somsri Telesale'),
(2, 'CUS-100000001', '2025-09-22 16:54:40', 'call_logged', 'บันทึกการโทร: สินค้ายังไม่หมด', 'Somsri Telesale'),
(3, 'CUS-100000001', '2025-09-22 16:55:10', 'appointment_set', 'นัดหมาย \"โทรติดตามผล (สินค้ายังไม่หมด)\" ถูกทำเครื่องหมายว่าเสร็จสิ้น', 'Somsri Telesale'),
(4, 'CUS-954564646', '2025-09-22 16:55:32', 'call_logged', 'บันทึกการโทร: สินค้ายังไม่หมด', 'Somsri Telesale'),
(5, 'CUS-954564646', '2025-09-22 17:13:24', 'appointment_set', 'นัดหมาย \"โทรติดตามผล (ยังไม่ได้ลองใช้)\" ถูกทำเครื่องหมายว่าเสร็จสิ้น', 'Somsri Telesale'),
(6, 'CUS-954564646', '2025-09-22 17:13:25', 'appointment_set', 'นัดหมาย \"ทดสอบ\" ถูกทำเครื่องหมายว่าเสร็จสิ้น', 'Somsri Telesale'),
(7, 'CUS-100000001', '2025-09-22 17:15:04', 'order_created', 'สร้างออเดอร์ใหม่ ORD-1758561303810', 'Somsri Telesale'),
(8, 'CUS-952513121', '2025-09-23 03:12:03', 'order_created', 'สร้างออเดอร์ใหม่ ORD-1758597123228', 'Somsri Telesale'),
(9, 'CUS-954564646', '2025-09-23 03:14:12', 'order_created', 'สร้างออเดอร์ใหม่ ORD-1758597252409', 'Somsri Telesale'),
(10, 'CUS-954564646', '2025-09-23 03:17:17', 'order_created', 'สร้างออเดอร์ใหม่ ORD-1758597436970', 'Somsri Telesale'),
(11, 'CUS-952513121', '2025-09-23 03:17:47', 'order_created', 'สร้างออเดอร์ใหม่ ORD-1758597466870', 'Somsri Telesale'),
(12, 'CUS-954564646', '2025-09-23 03:25:56', 'order_created', 'สร้างออเดอร์ใหม่ ORD-1758597956211', 'Somsri Telesale'),
(13, 'CUS-954564646', '2025-09-23 03:26:25', 'order_cancelled', 'ยกเลิกออเดอร์ ORD-1758597956211', 'Somsri Telesale'),
(14, 'CUS-954564646', '2025-09-23 03:31:42', 'order_created', 'สร้างออเดอร์ใหม่ ORD-1758598301831', 'Somsri Telesale'),
(15, 'CUS-952513121', '2025-09-23 03:32:36', 'order_created', 'สร้างออเดอร์ใหม่ ORD-1758598355828', 'Somsri Telesale'),
(16, 'CUS-954564646', '2025-09-23 03:35:12', 'order_created', 'สร้างออเดอร์ใหม่ ORD-1758598511994', 'Somsri Telesale'),
(17, 'CUS-954564646', '2025-09-24 07:59:33', 'order_status_changed', 'เปลี่ยนสถานะออเดอร์ ORD-1758598511994 จาก \'รอดำเนินการ\' เป็น \'กำลังจัดสินค้า\'', 'Sommai Backoffice'),
(18, 'CUS-954564646', '2025-09-24 07:59:33', 'order_status_changed', 'เปลี่ยนสถานะออเดอร์ ORD-1758598511994 จาก \'รอดำเนินการ\' เป็น \'กำลังจัดสินค้า\'', 'Sommai Backoffice'),
(19, 'CUS-954564646', '2025-09-24 07:59:33', 'order_status_changed', 'เปลี่ยนสถานะออเดอร์ ORD-1758598511994 จาก \'รอดำเนินการ\' เป็น \'กำลังจัดสินค้า\'', 'Sommai Backoffice'),
(20, 'CUS-954564646', '2025-09-24 08:04:41', 'order_status_changed', 'เปลี่ยนสถานะออเดอร์ ORD-1758598301831 จาก \'รอดำเนินการ\' เป็น \'กำลังจัดสินค้า\'', 'Sommai Backoffice'),
(21, 'CUS-954564646', '2025-09-24 08:04:41', 'order_status_changed', 'เปลี่ยนสถานะออเดอร์ ORD-1758598301831 จาก \'รอดำเนินการ\' เป็น \'กำลังจัดสินค้า\'', 'Sommai Backoffice'),
(22, 'CUS-954564646', '2025-09-24 08:04:41', 'order_status_changed', 'เปลี่ยนสถานะออเดอร์ ORD-1758598301831 จาก \'รอดำเนินการ\' เป็น \'กำลังจัดสินค้า\'', 'Sommai Backoffice'),
(23, 'CUS-952519797', '2025-09-24 08:06:52', 'order_created', 'สร้างออเดอร์ใหม่ ORD-1758701211599', 'Somchai Admin'),
(24, 'CUS-952141254', '2025-09-24 08:14:03', 'order_created', 'สร้างออเดอร์ใหม่ ORD-1758701642865', 'Somchai Admin'),
(25, 'CUS-958844578', '2025-09-24 08:52:22', 'order_created', 'สร้างออเดอร์ใหม่ ORD-1758703941450', 'Somchai Admin'),
(26, 'CUS-954564646', '2025-09-24 08:54:31', 'order_status_changed', 'เปลี่ยนสถานะออเดอร์ TEST-ORDER-001 จาก \'รอดำเนินการ\' เป็น \'กำลังจัดสินค้า\'', 'Sommai Backoffice'),
(27, 'CUS-954564646', '2025-09-24 08:54:31', 'order_status_changed', 'เปลี่ยนสถานะออเดอร์ TEST-ORDER-001 จาก \'รอดำเนินการ\' เป็น \'กำลังจัดสินค้า\'', 'Sommai Backoffice'),
(28, 'CUS-954564646', '2025-09-24 08:54:31', 'order_status_changed', 'เปลี่ยนสถานะออเดอร์ TEST-ORDER-001 จาก \'รอดำเนินการ\' เป็น \'กำลังจัดสินค้า\'', 'Sommai Backoffice'),
(29, 'CUS-958844578', '2025-09-24 12:38:57', 'order_status_changed', 'เปลี่ยนสถานะออเดอร์ ORD-1758703941450 จาก \'รอดำเนินการ\' เป็น \'กำลังจัดสินค้า\'', 'Sommai Backoffice'),
(30, 'CUS-958844578', '2025-09-24 12:38:57', 'order_status_changed', 'เปลี่ยนสถานะออเดอร์ ORD-1758703941450 จาก \'รอดำเนินการ\' เป็น \'กำลังจัดสินค้า\'', 'Sommai Backoffice'),
(31, 'CUS-958844578', '2025-09-24 12:38:57', 'order_status_changed', 'เปลี่ยนสถานะออเดอร์ ORD-1758703941450 จาก \'รอดำเนินการ\' เป็น \'กำลังจัดสินค้า\'', 'Sommai Backoffice'),
(32, 'CUS-952141254', '2025-09-24 14:57:51', 'order_created', 'สร้างออเดอร์ใหม่ ORD-1758725870868', 'Somsri Telesale'),
(33, 'CUS-001', '2025-09-27 14:30:24', 'call_logged', 'บันทึกการโทร: สินค้ายังไม่หมด', 'Somsri Telesale'),
(34, 'CUS-003', '2025-09-27 14:31:05', 'call_logged', 'บันทึกการโทร: สินค้ายังไม่หมด', 'Somsri Telesale'),
(35, 'CUS-002', '2025-09-27 14:45:22', 'call_logged', 'บันทึกการโทร: ใช้แล้วไม่เห็นผล', 'Somsri Telesale'),
(36, 'CUS-002', '2025-09-27 14:46:17', 'appointment_set', 'นัดหมาย \"โทรติดตามผล (ใช้แล้วไม่เห็นผล)\" ถูกทำเครื่องหมายว่าเสร็จสิ้น', 'Somsri Telesale'),
(37, 'CUS-002', '2025-09-27 14:51:10', 'call_logged', 'บันทึกการโทร: ใช้แล้วไม่เห็นผล', 'Somsri Telesale'),
(38, 'CUS-001', '2025-09-27 15:30:10', 'appointment_set', 'สร้างนัดหมาย: ทดสอบ', 'Somsri Telesale'),
(39, 'CUS-005', '2025-09-29 02:21:05', 'call_logged', 'บันทึกการโทร: สินค้ายังไม่หมด', 'Somsri Telesale'),
(40, 'CUS-954564646', '2025-09-29 03:15:00', 'call_logged', 'บันทึกการโทร: สินค้ายังไม่หมด', 'Somsri Telesale'),
(41, 'CUS-954564646', '2025-09-29 03:16:38', 'call_logged', 'บันทึกการโทร: ใช้แล้วไม่เห็นผล', 'Somsri Telesale'),
(42, 'CUS-004', '2025-09-29 03:38:27', 'call_logged', 'บันทึกการโทร: สินค้ายังไม่หมด', 'Somsri Telesale'),
(43, 'CUS-002', '2025-09-29 03:39:02', 'appointment_set', 'นัดหมาย \"โทรติดตามผล (ใช้แล้วไม่เห็นผล)\" ถูกทำเครื่องหมายว่าเสร็จสิ้น', 'Somsri Telesale'),
(44, 'CUS-002', '2025-09-29 03:52:59', 'call_logged', 'บันทึกการโทร: สินค้ายังไม่หมด', 'Somsri Telesale'),
(45, 'CUS-002', '2025-09-29 03:53:10', 'appointment_set', 'นัดหมาย \"โทรติดตามผล (สินค้ายังไม่หมด)\" ถูกทำเครื่องหมายว่าเสร็จสิ้น', 'Somsri Telesale'),
(46, 'CUS-001', '2025-09-29 04:30:34', 'appointment_set', 'นัดหมาย \"ทดสอบ\" ถูกทำเครื่องหมายว่าเสร็จสิ้น', 'Somsri Telesale'),
(47, 'CUS-005', '2025-09-29 04:30:53', 'appointment_set', 'นัดหมาย \"โทรติดตามผล (สินค้ายังไม่หมด)\" ถูกทำเครื่องหมายว่าเสร็จสิ้น', 'Somsri Telesale'),
(48, 'CUS-005', '2025-09-29 04:31:24', 'call_logged', 'บันทึกการโทร: ได้คุย', 'Somsri Telesale'),
(49, 'CUS-005', '2025-09-29 04:33:05', 'appointment_set', 'นัดหมาย \"โทรติดตามผล (ได้คุย)\" ถูกทำเครื่องหมายว่าเสร็จสิ้น', 'Somsri Telesale'),
(50, 'CUS-005', '2025-09-29 04:33:16', 'call_logged', 'บันทึกการโทร: เลิกทำสวน', 'Somsri Telesale'),
(51, 'CUS-005', '2025-09-29 04:33:46', 'appointment_set', 'นัดหมาย \"โทรติดตามผล (เลิกทำสวน)\" ถูกทำเครื่องหมายว่าเสร็จสิ้น', 'Somsri Telesale'),
(52, 'CUS-952513121', '2025-09-29 05:41:13', 'call_logged', 'บันทึกการโทร: สินค้ายังไม่หมด', 'Somsri Telesale'),
(53, 'CUS-003', '2025-09-29 07:15:55', 'appointment_set', 'นัดหมาย \"โทรติดตามผล (สินค้ายังไม่หมด)\" ถูกทำเครื่องหมายว่าเสร็จสิ้น', 'Somsri Telesale'),
(54, 'CUS-003', '2025-09-29 07:20:13', 'order_created', 'สร้างออเดอร์ใหม่ ORD-1759130412537', 'Somsri Telesale'),
(55, 'CUS-003', '2025-09-29 07:57:55', 'order_created', 'สร้างออเดอร์ใหม่ ORD-1759132675182', 'Somsri Telesale'),
(56, 'CUS-002', '2025-09-29 09:47:06', 'call_logged', 'บันทึกการโทร: ใช้แล้วไม่เห็นผล', 'Somsri Telesale'),
(57, 'CUS-005', '2025-09-29 10:00:43', 'call_logged', 'บันทึกการโทร: ใช้แล้วไม่เห็นผล', 'Somsri Telesale'),
(58, 'CUS-952513121', '2025-09-29 10:01:04', 'appointment_set', 'นัดหมาย \"โทรติดตามผล (สินค้ายังไม่หมด)\" ถูกทำเครื่องหมายว่าเสร็จสิ้น', 'Somsri Telesale'),
(59, 'CUS-952513121', '2025-09-29 10:01:18', 'call_logged', 'บันทึกการโทร: สินค้ายังไม่หมด', 'Somsri Telesale');

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `appointments`
--

INSERT INTO `appointments` (`id`, `customer_id`, `date`, `title`, `status`, `notes`) VALUES
(1, 'CUS-100000001', '2025-09-25 10:31:32', 'Follow-up Call', 'เสร็จสิ้น', 'Discuss pricing'),
(2, 'CUS-100000001', '2025-09-24 11:42:00', 'โทรติดตามผล (สินค้ายังไม่หมด)', 'เสร็จสิ้น', 'สร้างอัตโนมัติจากการบันทึกการโทร'),
(3, 'CUS-954564646', '2025-09-24 12:26:00', 'โทรติดตามผล (ยังไม่ได้ลองใช้)', 'เสร็จสิ้น', 'สร้างอัตโนมัติจากการบันทึกการโทร'),
(4, 'CUS-954564646', '2025-09-24 23:31:00', 'ทดสอบ', 'เสร็จสิ้น', NULL),
(5, 'CUS-100000001', '2025-09-23 23:40:00', 'โทรติดตามผล (ติดสายซ้อน)', 'เสร็จสิ้น', 'ทดสอบการติดตาม'),
(6, 'CUS-100000001', '2025-09-26 23:42:00', 'โทรติดตามผล (ฝากส่งไม่ได้ใช้เอง)', 'เสร็จสิ้น', 'สร้างอัตโนมัติจากการบันทึกการโทร'),
(7, 'CUS-100000001', '2025-09-24 23:54:00', 'โทรติดตามผล (สินค้ายังไม่หมด)', 'เสร็จสิ้น', 'สร้างอัตโนมัติจากการบันทึกการโทร'),
(8, 'CUS-003', '2025-10-01 21:30:00', 'โทรติดตามผล (สินค้ายังไม่หมด)', 'เสร็จสิ้น', 'ทดสอบ'),
(9, 'CUS-002', '2025-10-01 21:44:00', 'โทรติดตามผล (ใช้แล้วไม่เห็นผล)', 'เสร็จสิ้น', 'สร้างอัตโนมัติจากการบันทึกการโทร'),
(10, 'CUS-002', '2025-10-08 21:50:00', 'โทรติดตามผล (ใช้แล้วไม่เห็นผล)', 'เสร็จสิ้น', 'สร้างอัตโนมัติจากการบันทึกการโทร'),
(11, 'CUS-001', '2025-10-11 22:30:00', 'ทดสอบ', 'เสร็จสิ้น', NULL),
(12, 'CUS-005', '2025-10-10 09:21:00', 'โทรติดตามผล (สินค้ายังไม่หมด)', 'เสร็จสิ้น', 'สร้างอัตโนมัติจากการบันทึกการโทร'),
(13, 'CUS-954564646', '2025-10-08 10:14:00', 'โทรติดตามผล (สินค้ายังไม่หมด)', 'รอดำเนินการ', 'สร้างอัตโนมัติจากการบันทึกการโทร'),
(14, 'CUS-954564646', '2025-10-25 10:16:00', 'โทรติดตามผล (ใช้แล้วไม่เห็นผล)', 'รอดำเนินการ', 'สร้างอัตโนมัติจากการบันทึกการโทร'),
(15, 'CUS-004', '2025-10-12 10:38:00', 'โทรติดตามผล (สินค้ายังไม่หมด)', 'รอดำเนินการ', 'สร้างอัตโนมัติจากการบันทึกการโทร'),
(16, 'CUS-002', '2025-10-10 10:52:00', 'โทรติดตามผล (สินค้ายังไม่หมด)', 'เสร็จสิ้น', 'สร้างอัตโนมัติจากการบันทึกการโทร'),
(17, 'CUS-005', '2025-10-12 11:31:00', 'โทรติดตามผล (ได้คุย)', 'เสร็จสิ้น', 'ทดสอบ'),
(18, 'CUS-005', '2025-10-11 11:33:00', 'โทรติดตามผล (เลิกทำสวน)', 'เสร็จสิ้น', 'สร้างอัตโนมัติจากการบันทึกการโทร'),
(19, 'CUS-952513121', '2025-10-03 12:41:00', 'โทรติดตามผล (สินค้ายังไม่หมด)', 'เสร็จสิ้น', 'สร้างอัตโนมัติจากการบันทึกการโทร'),
(20, 'CUS-002', '2025-09-30 16:47:00', 'โทรติดตามผล (ใช้แล้วไม่เห็นผล)', 'รอดำเนินการ', 'สร้างอัตโนมัติจากการบันทึกการโทร'),
(21, 'CUS-005', '2025-10-02 17:00:00', 'โทรติดตามผล (ใช้แล้วไม่เห็นผล)', 'รอดำเนินการ', 'สร้างอัตโนมัติจากการบันทึกการโทร'),
(22, 'CUS-952513121', '2025-10-03 17:01:00', 'โทรติดตามผล (สินค้ายังไม่หมด)', 'รอดำเนินการ', 'สร้างอัตโนมัติจากการบันทึกการโทร');

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `call_history`
--

INSERT INTO `call_history` (`id`, `customer_id`, `date`, `caller`, `status`, `result`, `crop_type`, `area_size`, `notes`, `duration`) VALUES
(1, 'CUS-100000001', '2025-09-20 10:31:32', 'Somsri Telesale', 'connected', 'interested', 'Rice', '10 rai', 'Good lead', 300),
(2, 'CUS-100000001', '2025-09-22 04:43:09', 'Somsri Telesale', 'รับสาย', 'สินค้ายังไม่หมด', 'ทดสอบ', 'ทดสอบ2', NULL, 1),
(3, 'CUS-954564646', '2025-09-22 05:26:39', 'Somsri Telesale', 'รับสาย', 'ยังไม่ได้ลองใช้', NULL, NULL, NULL, 0),
(4, 'CUS-954564646', '2025-09-22 16:30:13', 'Somsri Telesale', 'รับสาย', 'ใช้แล้วไม่เห็นผล', 'ลำไย', '1ต้น', NULL, 1),
(5, 'CUS-100000001', '2025-09-22 16:40:57', 'Somsri Telesale', 'รับสาย', 'ติดสายซ้อน', 'ทุเรียน', '2 ต้น', 'ทดสอบการติดตาม', 1),
(6, 'CUS-100000001', '2025-09-22 16:42:33', 'Somsri Telesale', 'รับสาย', 'ฝากส่งไม่ได้ใช้เอง', '1', '1', NULL, 1),
(7, 'CUS-100000001', '2025-09-22 16:54:40', 'Somsri Telesale', 'รับสาย', 'สินค้ายังไม่หมด', 'ลำไย', '2000 ตารางวา', NULL, -7),
(8, 'CUS-954564646', '2025-09-22 16:55:32', 'Somsri Telesale', 'รับสาย', 'สินค้ายังไม่หมด', NULL, NULL, NULL, 0),
(9, 'CUS-001', '2025-09-27 14:30:24', 'Somsri Telesale', 'รับสาย', 'สินค้ายังไม่หมด', NULL, NULL, NULL, 1),
(10, 'CUS-003', '2025-09-27 14:31:05', 'Somsri Telesale', 'รับสาย', 'สินค้ายังไม่หมด', NULL, NULL, 'ทดสอบ', 0),
(11, 'CUS-002', '2025-09-27 14:45:21', 'Somsri Telesale', 'รับสาย', 'ใช้แล้วไม่เห็นผล', 'ลำไย', '2000 ตารางวา', NULL, 1),
(12, 'CUS-002', '2025-09-27 14:51:09', 'Somsri Telesale', 'รับสาย', 'ใช้แล้วไม่เห็นผล', 'ลำไย', '2000 ตารางวา', NULL, 1),
(13, 'CUS-005', '2025-09-29 02:21:05', 'Somsri Telesale', 'รับสาย', 'สินค้ายังไม่หมด', NULL, NULL, NULL, 1),
(14, 'CUS-954564646', '2025-09-29 03:15:00', 'Somsri Telesale', 'รับสาย', 'สินค้ายังไม่หมด', NULL, NULL, NULL, 1),
(15, 'CUS-954564646', '2025-09-29 03:16:38', 'Somsri Telesale', 'ได้คุย', 'ใช้แล้วไม่เห็นผล', NULL, NULL, NULL, 0),
(16, 'CUS-004', '2025-09-29 03:38:27', 'Somsri Telesale', 'รับสาย', 'สินค้ายังไม่หมด', NULL, NULL, NULL, 1),
(17, 'CUS-002', '2025-09-29 03:52:59', 'Somsri Telesale', 'รับสาย', 'สินค้ายังไม่หมด', NULL, NULL, NULL, 0),
(18, 'CUS-005', '2025-09-29 04:31:24', 'Somsri Telesale', 'รับสาย', 'ได้คุย', NULL, NULL, 'ทดสอบ', 2),
(19, 'CUS-005', '2025-09-29 04:33:16', 'Somsri Telesale', 'รับสาย', 'เลิกทำสวน', NULL, NULL, NULL, 2),
(20, 'CUS-952513121', '2025-09-29 05:41:13', 'Somsri Telesale', 'รับสาย', 'สินค้ายังไม่หมด', NULL, NULL, NULL, 1),
(21, 'CUS-002', '2025-09-29 09:47:06', 'Somsri Telesale', 'รับสาย', 'ใช้แล้วไม่เห็นผล', NULL, NULL, NULL, 0),
(22, 'CUS-005', '2025-09-29 10:00:43', 'Somsri Telesale', 'รับสาย', 'ใช้แล้วไม่เห็นผล', NULL, NULL, NULL, 4),
(23, 'CUS-952513121', '2025-09-29 10:01:18', 'Somsri Telesale', 'ได้คุย', 'สินค้ายังไม่หมด', NULL, NULL, NULL, 2);

-- --------------------------------------------------------

--
-- Table structure for table `companies`
--

CREATE TABLE `companies` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `companies`
--

INSERT INTO `companies` (`id`, `name`) VALUES
(1, 'Alpha Seeds Co.'),
(2, 'Company B Ltd.'),
(3, 'Alpha Seeds Co.'),
(4, 'Company B Ltd.'),
(5, 'Alpha Seeds Co.'),
(6, 'Company B Ltd.'),
(7, 'Alpha Seeds Co.'),
(8, 'Company B Ltd.');

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
  `followup_bonus_remaining` tinyint(1) NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `customers`
--

INSERT INTO `customers` (`id`, `first_name`, `last_name`, `phone`, `email`, `province`, `company_id`, `assigned_to`, `date_assigned`, `date_registered`, `follow_up_date`, `ownership_expires`, `lifecycle_status`, `behavioral_status`, `grade`, `total_purchases`, `total_calls`, `facebook_name`, `line_id`, `street`, `subdistrict`, `district`, `postal_code`, `has_sold_before`, `follow_up_count`, `last_follow_up_date`, `last_sale_date`, `is_in_waiting_basket`, `waiting_basket_start_date`, `followup_bonus_remaining`) VALUES
('CUS-001', 'สมชาย', 'ใจดี', '0812345678', 'somchai@email.com', 'กรุงเทพ', 1, 2, '2025-09-27 21:00:09', NULL, '2025-10-11 22:30:00', '2025-12-28 10:36:28', 'Old', 'Hot', 'A', '0.00', 1, 'Somchai Jaidee', 'somchai01', '123 ถนนสุขุมวิท', 'คลองตัน', 'วัฒนา', '10110', 0, 1, '2025-09-27 15:30:09', NULL, 0, NULL, 1),
('CUS-002', 'สมหญิง', 'รักดี', '0823456789', 'somying@email.com', 'กรุงเทพ', 1, 2, '2025-09-27 21:00:28', NULL, '2025-09-30 16:47:00', '2025-12-28 03:52:59', 'FollowUp', 'Warm', 'B', '1500.00', 6, 'Somying Rakdee', 'somying02', '456 ถนนพหลโยธิน', 'จตุจักร', 'จตุจักร', '10900', 0, 1, '2025-09-29 03:52:59', NULL, 0, NULL, 1),
('CUS-003', 'วิชัย', 'เก่งมาก', '0834567890', 'wichai@email.com', 'นนทบุรี', 1, 2, '2025-09-27 21:00:28', NULL, '2025-10-01 21:30:00', '2025-12-28 13:59:46', 'Old3Months', 'Cold', 'C', '800.00', 2, 'Wichai Kengmak', 'wichai03', '789 ถนนติวานนท์', 'บางกระสอ', 'เมืองนนทบุรี', '11000', 1, 0, '2025-09-29 05:45:10', '2025-09-29 07:57:55', 0, NULL, 1),
('CUS-004', 'มาลี', 'สวยงาม', '0845678901', 'malee@email.com', 'ปทุมธานี', 1, 2, '2025-09-27 21:00:28', NULL, '2025-10-12 10:38:00', '2025-12-28 03:38:27', 'FollowUp', 'Hot', 'A+', '0.00', 1, 'Malee Suayngam', 'malee04', '321 ถนนรังสิต', 'คลองหนึ่ง', 'คลองหลวง', '12120', 0, 1, '2025-09-29 03:38:27', NULL, 0, NULL, 1),
('CUS-005', 'ประเสริฐ', 'ดีมาก', '0856789012', 'prasert@email.com', 'สมุทรปราการ', 1, 2, '2025-09-27 21:00:28', NULL, '2025-10-02 17:00:00', '2025-11-01 21:03:36', 'FollowUp', 'Warm', 'B', '2200.00', 7, 'Prasert Deemak', 'prasert05', '654 ถนนสุขุมวิท', 'บางนา', 'บางนา', '10260', 0, 0, NULL, NULL, 0, NULL, 0),
('CUS-100000001', 'Mana', 'Jaidee', '0812345678', 'mana.j@example.com', 'Bangkok', 1, 2, '2025-09-17 10:31:32', '2025-09-12 10:31:32', '2025-09-24 23:54:00', '2025-12-11 10:31:32', 'Old3Months', 'Hot', 'B', '5850.00', 18, 'Mana Jaidee', 'mana.j', '123 Sukhumvit Rd', 'Khlong Toei', 'Khlong Toei', '10110', 0, 0, NULL, NULL, 0, NULL, 1),
('CUS-952141254', 'มาเรีย', 'สิกา', '0952141254', NULL, 'กรุงเทพ', 1, 1, '2025-09-24 08:14:03', '2025-09-24 08:14:03', NULL, '2025-10-24 08:14:03', 'New', 'Warm', 'D', '0.00', 0, 'อิอิ', '', '33/10', 'ออเงิน', 'สายไหม', '12120', 0, 0, NULL, NULL, 0, NULL, 1),
('CUS-952513121', 'มานี', 'พี่มานะ', '0952513121', NULL, 'ปทุมธานี', 1, 2, '2025-09-22 03:58:57', '2025-09-22 03:58:57', '2025-10-03 17:01:00', '2025-10-22 03:58:57', 'FollowUp', 'Warm', 'D', '0.00', 2, 'mana jaidee', 'manaza007', '33/10', 'ลำลูกกา', 'ลำลูกกา', '12150', 0, 0, NULL, NULL, 0, NULL, 1),
('CUS-952519797', 'พิมพ์พิกา', 'ณ ระนอง', '0952519797', NULL, 'กรุงเทพ', 1, 1, '2025-09-24 08:06:52', '2025-09-24 08:06:52', NULL, '2025-10-24 08:06:52', 'New', 'Warm', 'D', '0.00', 0, 'pimmy', 'ก็มาดิค๊าบ', '31/10', 'ออเงิน', 'สายไหม', '10210', 0, 0, NULL, NULL, 0, NULL, 1),
('CUS-954564646', 'มาโนช', 'ศรีบุญเรือง', '0954564646', NULL, 'กรุงเทพ', 1, 2, '2025-09-22 05:24:32', '2025-09-22 05:24:32', '2025-10-25 10:16:00', '2025-12-28 10:36:28', 'FollowUp', 'Warm', 'D', '0.00', 4, 'maNos', 'Manosza', '214', 'สายไหม', 'ออเงิน', '12150', 0, 2, '2025-09-29 03:16:37', NULL, 0, NULL, 1),
('CUS-958844578', 'มนัส', 'บุญจำนง', '0958844578', NULL, 'กรุงเทพ', 1, 1, '2025-09-24 08:52:21', '2025-09-24 08:52:21', NULL, '2025-10-24 08:52:21', 'New', 'Warm', 'D', '0.00', 0, 'manus', '', '32/458', 'ออเงิน', 'สายไหม', '12150', 0, 0, NULL, NULL, 0, NULL, 1);

-- --------------------------------------------------------

--
-- Table structure for table `customer_assignment_history`
--

CREATE TABLE `customer_assignment_history` (
  `id` bigint(20) NOT NULL,
  `customer_id` varchar(32) NOT NULL,
  `user_id` int(11) NOT NULL,
  `assigned_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customer_tags`
--

CREATE TABLE `customer_tags` (
  `customer_id` varchar(32) NOT NULL,
  `tag_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `customer_tags`
--

INSERT INTO `customer_tags` (`customer_id`, `tag_id`) VALUES
('CUS-100000001', 1),
('CUS-100000001', 3),
('CUS-954564646', 4),
('CUS-952513121', 5);

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
  `ocr_sender_name` varchar(255) DEFAULT NULL,
  `ocr_receiver_name` varchar(255) DEFAULT NULL,
  `ocr_account_number` varchar(255) DEFAULT NULL,
  `ocr_amount` decimal(12,2) DEFAULT NULL,
  `ocr_date` varchar(50) DEFAULT NULL,
  `ocr_time` varchar(50) DEFAULT NULL,
  `ocr_payment_date` datetime DEFAULT NULL,
  `sales_channel` varchar(128) DEFAULT NULL,
  `sales_channel_page_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `orders`
--

INSERT INTO `orders` (`id`, `customer_id`, `company_id`, `creator_id`, `order_date`, `delivery_date`, `street`, `subdistrict`, `district`, `province`, `postal_code`, `shipping_cost`, `bill_discount`, `total_amount`, `payment_method`, `payment_status`, `slip_url`, `amount_paid`, `cod_amount`, `order_status`, `notes`, `ocr_sender_name`, `ocr_receiver_name`, `ocr_account_number`, `ocr_amount`, `ocr_date`, `ocr_time`, `ocr_payment_date`, `sales_channel`, `sales_channel_page_id`) VALUES
('ORD-100000001', 'CUS-100000001', 1, 2, '2025-09-21 10:31:32', '2025-09-23 10:31:32', '123 Sukhumvit Rd', 'Khlong Toei', 'Khlong Toei', 'Bangkok', '10110', '50.00', '0.00', '2050.00', 'COD', 'PendingVerification', NULL, NULL, '2000.00', 'Delivered', 'First test order', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('ORD-1758513536907', 'CUS-952513121', 1, 2, '2025-09-22 03:58:57', '2025-09-23 00:00:00', '33/10', 'ลำลูกกา', 'ลำลูกกา', 'ปทุมธานี', '12150', '0.00', '0.00', '500.00', 'Transfer', 'Paid', NULL, '500.00', '0.00', 'Shipping', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('ORD-1758597956211', 'CUS-954564646', 1, 2, '2025-09-23 03:25:56', '2025-09-24 00:00:00', '214', 'สายไหม', 'ออเงิน', 'กรุงเทพ', '12150', '0.00', '0.00', '50.00', 'Transfer', 'Paid', 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAV6BIwDASIAAhEBAxEB/8QAHAABAAIDAQEBAAAAAAAAAAAAAAIDAQQGBQcI/8QAYhAAAQMCAwQFBQcMChEEAgMBAQACAwQRBRIhBhMxQQcUIlFhI3GBkdEVMjZTobGzFhckMzdCUnR1pLLBNVRVVnJzg', '50.00', '0.00', 'Picking', 'ข้อมูลจากสลิป: ผู้โอน: นาย ธนู ส, ผู้รับ: น.ส. ชุติกาญจน์ จันต๊ะยอด, เลขบัญชี: xxx-x-x3504-x, วันที่: 25 ก.ค. 68, เวลา: 09:45 น.\nข้อมูลจากสลิป: ผู้โอน: นาย ธนู ส, ผู้รับ: น.ส. ชุติกาญจน์ จันต๊ะยอด, เลขบัญชี: xxx-x-x3504-x\nข้อมูลจากสลิป: ผู้โอน: นาย ธนู ส, ผู้รับ: น.ส. ชุติกาญจน์ จันต๊ะยอด, เลขบัญชี: xxx-x-x3504-x', 'นาย ธนู ส', 'น.ส. ชุติกาญจน์ จันต๊ะยอด', 'xxx-x-x3504-x', '45.00', '25 ก.ค. 68', '09:45 น.', NULL, NULL, NULL),
('ORD-1758598301831', 'CUS-954564646', 1, 2, '2025-09-23 03:31:42', '2025-09-24 00:00:00', '214', 'สายไหม', 'ออเงิน', 'กรุงเทพ', '12150', '0.00', '0.00', '500.00', 'Transfer', 'Paid', 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAV6BIwDASIAAhEBAxEB/8QAHAABAAIDAQEBAAAAAAAAAAAAAAIDAQQGBQcI/8QAYhAAAQMCAwQFBQcMChEEAgMBAQACAwQRBRIhBhMxQQcUIlFhI3GBkdEVMjZTobGzFhckMzdCUnR1pLLBNVRVVnJzg', '500.00', '0.00', 'Picking', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('ORD-1758598355828', 'CUS-952513121', 1, 2, '2025-09-23 03:32:36', '2025-09-24 00:00:00', '33/10', 'ลำลูกกา', 'ลำลูกกา', 'ปทุมธานี', '12150', '0.00', '0.00', '120.00', 'Transfer', 'PendingVerification', 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAV6BIwDASIAAhEBAxEB/8QAHAABAAIDAQEBAAAAAAAAAAAAAAIDAQQGBQcI/8QAYxAAAQMCAwQEBwgJDBEEAgMBAQACAwQRBRIhBhMxQQcUIlEVI2FxgZHRFhcyNlOhsbMkM0JSVnR1pME1N0NUVXJzg', '100.00', '0.00', 'Picking', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('ORD-1758598511994', 'CUS-954564646', 1, 2, '2025-09-23 03:35:12', '2025-09-24 00:00:00', '214', 'สายไหม', 'ออเงิน', 'กรุงเทพ', '12150', '0.00', '0.00', '50.00', 'Transfer', 'Paid', 'api/uploads/slips/slip_ORD-1758598511994_20250924_140110.jpg', '50.00', '0.00', 'Picking', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('ORD-1758703941450', 'CUS-958844578', 1, 1, '2025-09-24 08:52:21', '2025-09-25 00:00:00', '32/458', 'ออเงิน', 'สายไหม', 'กรุงเทพ', '12150', '0.00', '0.00', '50.00', 'Transfer', 'Unpaid', NULL, '0.00', '0.00', 'Picking', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('ORD-1758725870868', 'CUS-952141254', 1, 2, '2025-09-24 14:57:51', '2025-09-25 00:00:00', '33/10', 'ออเงิน', 'สายไหม', 'กรุงเทพ', '12120', '0.00', '0.00', '500.00', 'Transfer', '', NULL, NULL, NULL, '', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('ORD-1759130412537', 'CUS-003', 1, 2, '2025-09-29 07:20:13', '2025-09-30 00:00:00', '789 ถนนติวานนท์', 'บางกระสอ', 'เมืองนนทบุรี', 'นนทบุรี', '11000', '0.00', '0.00', '520.00', 'COD', '', NULL, NULL, NULL, '', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('ORD-1759132675182', 'CUS-003', 1, 2, '2025-09-29 07:57:55', '2025-09-30 00:00:00', '789 ถนนติวานนท์', 'บางกระสอ', 'เมืองนนทบุรี', 'นนทบุรี', '11000', '0.00', '0.00', '50.00', 'Transfer', '', NULL, NULL, NULL, '', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
('TEST-ORDER-001', 'CUS-954564646', 1, 2, '2025-09-24 08:00:00', '2025-09-25 00:00:00', '123 Test St', 'Test Sub', 'Test Dist', 'Test Prov', '12345', '50.00', '0.00', '150.00', 'COD', 'Unpaid', NULL, NULL, NULL, 'Picking', 'Test order', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `order_boxes`
--

CREATE TABLE `order_boxes` (
  `id` int(11) NOT NULL,
  `order_id` varchar(32) NOT NULL,
  `box_number` int(11) NOT NULL,
  `cod_amount` decimal(12,2) NOT NULL DEFAULT '0.00'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- --------------------------------------------------------

--
-- Table structure for table `order_items`
--

CREATE TABLE `order_items` (
  `id` int(11) NOT NULL,
  `order_id` varchar(32) NOT NULL,
  `product_id` int(11) DEFAULT NULL,
  `product_name` varchar(255) DEFAULT NULL,
  `quantity` int(11) NOT NULL,
  `price_per_unit` decimal(12,2) NOT NULL,
  `discount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `is_freebie` tinyint(1) NOT NULL DEFAULT '0',
  `box_number` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `order_items`
--

INSERT INTO `order_items` (`id`, `order_id`, `product_id`, `product_name`, `quantity`, `price_per_unit`, `discount`, `is_freebie`, `box_number`) VALUES
(1, 'ORD-100000001', 1, 'Seed A', 10, '200.00', '0.00', 0, 1),
(2, 'ORD-1758513536907', NULL, 'กางเกงช้าง', 1, '500.00', '0.00', 0, 1),
(9, 'ORD-1758597956211', NULL, 'กางเกง', 1, '50.00', '0.00', 0, 1),
(10, 'ORD-1758598301831', NULL, 'กางเกง', 1, '500.00', '0.00', 0, 1),
(11, 'ORD-1758598355828', NULL, 'เกง', 1, '120.00', '0.00', 0, 1),
(12, 'ORD-1758598511994', NULL, 'เกาง', 1, '50.00', '0.00', 0, 1),
(15, 'TEST-ORDER-001', 1, 'Test Product', 1, '100.00', '0.00', 0, 1),
(16, 'ORD-1758703941450', NULL, 'TEST01', 1, '50.00', '0.00', 0, 1),
(17, 'ORD-1758725870868', NULL, 'กงเกง', 1, '500.00', '0.00', 0, 1),
(18, 'ORD-1759130412537', NULL, 'กางเกงลายเสื้อดาว', 1, '20.00', '0.00', 0, 1),
(19, 'ORD-1759130412537', NULL, 'เสื้อกันหนาวสีแดง', 1, '500.00', '0.00', 0, 1),
(20, 'ORD-1759132675182', NULL, '121', 1, '50.00', '0.00', 0, 1);

-- --------------------------------------------------------

--
-- Table structure for table `order_slips`
--

CREATE TABLE `order_slips` (
  `id` int(11) NOT NULL,
  `order_id` varchar(32) NOT NULL,
  `url` varchar(1024) NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `order_slips`
--

INSERT INTO `order_slips` (`id`, `order_id`, `url`, `created_at`) VALUES
(1, 'ORD-1758703941450', 'api/uploads/slips/slip_ORD-1758703941450_20250924_142320_248511.jpg', '2025-09-24 21:23:20'),
(3, 'ORD-1758703941450', 'api/uploads/slips/slip_ORD-1758703941450_20250924_144643_a55ab8.jpg', '2025-09-24 21:46:43');

-- --------------------------------------------------------

--
-- Table structure for table `order_tracking_numbers`
--

CREATE TABLE `order_tracking_numbers` (
  `id` int(11) NOT NULL,
  `order_id` varchar(32) NOT NULL,
  `tracking_number` varchar(128) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `order_tracking_numbers`
--

INSERT INTO `order_tracking_numbers` (`id`, `order_id`, `tracking_number`) VALUES
(11, 'ORD-100000001', 'TH1234567890'),
(14, 'ORD-1758513536907', '65465465465'),
(15, 'ORD-1758597956211', '654987'),
(19, 'ORD-1758598355828', '55555555'),
(21, 'ORD-1758598511994', '857458746');

-- --------------------------------------------------------

--
-- Table structure for table `pages`
--

CREATE TABLE `pages` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `platform` varchar(64) NOT NULL DEFAULT 'Facebook',
  `url` varchar(1024) DEFAULT NULL,
  `company_id` int(11) NOT NULL,
  `active` tinyint(1) NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `pages`
--

INSERT INTO `pages` (`id`, `name`, `platform`, `url`, `company_id`, `active`) VALUES
(1, '01 เพจแรก', 'Facebook', '', 1, 1);

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
  `company_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `products`
--

INSERT INTO `products` (`id`, `sku`, `name`, `description`, `category`, `unit`, `cost`, `price`, `stock`, `company_id`) VALUES
(1, 'SKU-001', 'Seed A', 'High yield seed', 'Seeds', 'bag', '100.00', '200.00', 500, 1),
(2, 'FERT-001', 'ปุ๋ย แสงราชสีห์', 'ปุ๋ยสูตร A', 'ปุ๋ย', 'ถุง', '80.00', '200.00', 500, 1),
(3, 'SEED-001', 'เมล็ดพันธุ์ A', 'เมล็ดผลผลิตสูง', 'เมล็ด', 'ซอง', '50.00', '120.00', 200, 1);

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `promotions`
--

INSERT INTO `promotions` (`id`, `sku`, `name`, `description`, `company_id`, `active`, `start_date`, `end_date`) VALUES
(1, 'PROMO-001', 'ปุ๋ย แสงราชสีห์ ซื้อ 4 แถม 1', 'ซื้อ 4 แถม 1 เซ็ตปุ๋ยแสงราชสีห์', 1, 1, NULL, NULL),
(2, 'PROMO-002', 'ชุดทดลองเมล็ด 3 แถม 1', 'เลือก 3 ซอง แถม 1 ซอง', 1, 1, NULL, NULL);

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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `promotion_items`
--

INSERT INTO `promotion_items` (`id`, `promotion_id`, `product_id`, `quantity`, `is_freebie`, `price_override`) VALUES
(5, 1, 1, 4, 0, NULL),
(6, 1, 1, 1, 1, '0.00');

-- --------------------------------------------------------

--
-- Table structure for table `role_permissions`
--

CREATE TABLE `role_permissions` (
  `role` varchar(64) NOT NULL,
  `data` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `role_permissions`
--

INSERT INTO `role_permissions` (`role`, `data`) VALUES
('Admin Control', '{\"home.dashboard\":{\"use\":true},\"home.sales_overview\":{\"use\":true},\"home.calls_overview\":{\"use\":true},\"data.users\":{\"use\":true},\"data.permissions\":{\"use\":true},\"data.products\":{\"use\":true},\"data.teams\":{\"use\":true},\"data.pages\":{\"use\":true},\"data.tags\":{\"use\":true},\"nav.share\":{\"use\":true},\"nav.search\":{\"use\":true},\"nav.settings\":{\"use\":true},\"nav.data\":{\"use\":true},\"nav.orders\":{\"view\":false},\"nav.customers\":{\"view\":false},\"nav.manage_orders\":{\"view\":false},\"nav.debt\":{\"view\":false},\"nav.bulk_tracking\":{\"view\":false},\"nav.reports\":{\"use\":true}}'),
('Admin Page', '{\"nav.orders\":{\"use\":true},\"nav.customers\":{\"use\":true},\"nav.search\":{\"use\":true},\"home.dashboard\":{\"use\":true},\"home.sales_overview\":{\"use\":true},\"home.calls_overview\":{\"view\":false},\"data.users\":{\"view\":false},\"data.permissions\":{\"view\":false},\"data.products\":{\"view\":false},\"data.teams\":{\"view\":false},\"data.pages\":{\"view\":false},\"data.tags\":{\"view\":false},\"nav.manage_orders\":{\"view\":false},\"nav.debt\":{\"view\":false},\"nav.reports\":{\"view\":false},\"nav.bulk_tracking\":{\"view\":false},\"nav.share\":{\"view\":false},\"nav.settings\":{\"view\":false},\"nav.data\":{\"view\":false}}'),
('Backoffice', '{\"home.dashboard\":{\"view\":true,\"use\":true},\"home.sales_overview\":{\"view\":false},\"home.calls_overview\":{\"view\":false},\"data.users\":{\"view\":false},\"data.permissions\":{\"view\":false},\"data.products\":{\"view\":false},\"data.teams\":{\"view\":false},\"data.pages\":{\"view\":false},\"data.tags\":{\"view\":false},\"nav.orders\":{\"use\":true},\"nav.manage_orders\":{\"use\":true},\"nav.debt\":{\"use\":true},\"nav.reports\":{\"use\":true},\"nav.bulk_tracking\":{\"use\":true},\"nav.search\":{\"use\":true},\"nav.customers\":{\"view\":false},\"nav.share\":{\"view\":false},\"nav.settings\":{\"view\":false},\"nav.data\":{\"view\":false}}'),
('Marketing', '{\"data.pages\":{\"use\":true},\"data.teams\":{\"view\":false},\"data.products\":{\"use\":true},\"data.permissions\":{\"view\":false},\"data.users\":{\"view\":false},\"home.calls_overview\":{\"view\":false},\"home.sales_overview\":{\"view\":false},\"home.dashboard\":{\"view\":true,\"use\":true},\"nav.orders\":{\"view\":false},\"nav.customers\":{\"view\":false},\"nav.manage_orders\":{\"view\":false},\"nav.debt\":{\"view\":false},\"nav.reports\":{\"view\":false},\"nav.bulk_tracking\":{\"view\":false},\"nav.search\":{\"view\":false},\"nav.share\":{\"view\":false},\"nav.settings\":{\"view\":false},\"nav.data\":{\"view\":false},\"data.tags\":{\"view\":false}}'),
('Super Admin', '{\"home.dashboard\":{\"use\":true},\"home.sales_overview\":{\"use\":true},\"home.calls_overview\":{\"use\":true},\"data.users\":{\"use\":true},\"data.permissions\":{\"use\":true},\"data.teams\":{\"use\":true},\"data.products\":{\"use\":true},\"data.tags\":{\"use\":true},\"data.pages\":{\"use\":true},\"nav.orders\":{\"use\":true},\"nav.customers\":{\"use\":true},\"nav.debt\":{\"use\":true},\"nav.manage_orders\":{\"use\":true},\"nav.reports\":{\"use\":true},\"nav.bulk_tracking\":{\"use\":true},\"nav.share\":{\"use\":true},\"nav.search\":{\"use\":true},\"nav.settings\":{\"use\":true},\"nav.data\":{\"use\":true}}'),
('Supervisor Telesale', '{\"home.dashboard\":{\"use\":true},\"home.calls_overview\":{\"use\":true},\"data.teams\":{\"use\":true},\"nav.orders\":{\"use\":true},\"nav.customers\":{\"use\":true},\"nav.search\":{\"use\":true},\"nav.share\":{\"view\":false},\"nav.settings\":{\"view\":false},\"nav.data\":{\"view\":false},\"nav.manage_orders\":{\"view\":false},\"nav.debt\":{\"view\":false},\"nav.reports\":{\"view\":false},\"nav.bulk_tracking\":{\"view\":false},\"data.tags\":{\"view\":false},\"data.pages\":{\"view\":false},\"data.products\":{\"view\":false},\"data.permissions\":{\"view\":false},\"data.users\":{\"view\":false},\"home.sales_overview\":{\"view\":false}}'),
('Telesale', '{\"nav.orders\":{\"use\":true},\"nav.customers\":{\"use\":true},\"nav.manage_orders\":{\"use\":true},\"nav.search\":{\"use\":true}}');

-- --------------------------------------------------------

--
-- Table structure for table `tags`
--

CREATE TABLE `tags` (
  `id` int(11) NOT NULL,
  `name` varchar(128) NOT NULL,
  `type` enum('SYSTEM','USER') NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `tags`
--

INSERT INTO `tags` (`id`, `name`, `type`) VALUES
(1, 'VIP', 'SYSTEM'),
(2, 'Lead', 'SYSTEM'),
(3, 'ใกล้หมดอายุ', 'SYSTEM'),
(4, 'Lead ใหม่', 'SYSTEM'),
(5, 'สนใจโปร', 'SYSTEM'),
(6, 'ลูกค้าประจำ', 'SYSTEM');

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
  `supervisor_id` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `username`, `password`, `first_name`, `last_name`, `email`, `phone`, `role`, `company_id`, `team_id`, `supervisor_id`) VALUES
(1, 'admin1', 'admin123', 'Somchai', 'Admin', 'admin1@example.com', '0810000001', 'Admin Page', 1, NULL, NULL),
(2, 'telesale1', 'telesale123', 'Somsri', 'Telesale', 'telesale1@example.com', '0810000002', 'Telesale', 1, 1, 3),
(3, 'supervisor1', 'supervisor123', 'Somying', 'Supervisor', 'supervisor1@example.com', '0810000003', 'Supervisor Telesale', 1, 1, NULL),
(4, 'backoffice1', 'backoffice123', 'Sommai', 'Backoffice', 'backoffice1@example.com', '0810000004', 'Backoffice', 1, NULL, NULL),
(5, 'owner1', 'owner123', 'Owner', 'Control', 'owner1@example.com', '0810000005', 'Admin Control', 1, NULL, NULL),
(6, 'superadmin', 'superadmin123', 'Super', 'Admin', 'superadmin@example.com', '0810000000', 'Super Admin', 1, NULL, NULL),
(21, 'thanu.m', '1234', 'th', 'df', 'admin@prima49.com', '0952519797', 'Marketing', 1, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `user_tags`
--

CREATE TABLE `user_tags` (
  `user_id` int(11) NOT NULL,
  `tag_id` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

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
  ADD KEY `idx_customers_date_assigned` (`date_assigned`);

--
-- Indexes for table `customer_assignment_history`
--
ALTER TABLE `customer_assignment_history`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_customer_user_first` (`customer_id`,`user_id`),
  ADD KEY `fk_cah_user` (`user_id`);

--
-- Indexes for table `customer_tags`
--
ALTER TABLE `customer_tags`
  ADD PRIMARY KEY (`customer_id`,`tag_id`),
  ADD KEY `fk_customer_tags_tag` (`tag_id`);

--
-- Indexes for table `exports`
--
ALTER TABLE `exports`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_exports_created_at` (`created_at`);

--
-- Indexes for table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_orders_creator` (`creator_id`),
  ADD KEY `idx_orders_company` (`company_id`),
  ADD KEY `idx_orders_customer` (`customer_id`),
  ADD KEY `fk_orders_page` (`sales_channel_page_id`);

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
  ADD KEY `fk_order_items_product` (`product_id`);

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
  ADD KEY `fk_pages_company` (`company_id`);

--
-- Indexes for table `products`
--
ALTER TABLE `products`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `sku` (`sku`),
  ADD KEY `idx_products_company` (`company_id`);

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
  ADD KEY `fk_users_company` (`company_id`);

--
-- Indexes for table `user_tags`
--
ALTER TABLE `user_tags`
  ADD PRIMARY KEY (`user_id`,`tag_id`),
  ADD KEY `fk_user_tags_tag` (`tag_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `activities`
--
ALTER TABLE `activities`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=60;

--
-- AUTO_INCREMENT for table `ad_spend`
--
ALTER TABLE `ad_spend`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `appointments`
--
ALTER TABLE `appointments`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=23;

--
-- AUTO_INCREMENT for table `call_history`
--
ALTER TABLE `call_history`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=24;

--
-- AUTO_INCREMENT for table `companies`
--
ALTER TABLE `companies`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `customer_assignment_history`
--
ALTER TABLE `customer_assignment_history`
  MODIFY `id` bigint(20) NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `exports`
--
ALTER TABLE `exports`
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
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

--
-- AUTO_INCREMENT for table `order_slips`
--
ALTER TABLE `order_slips`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `order_tracking_numbers`
--
ALTER TABLE `order_tracking_numbers`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;

--
-- AUTO_INCREMENT for table `pages`
--
ALTER TABLE `pages`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `products`
--
ALTER TABLE `products`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `promotions`
--
ALTER TABLE `promotions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `promotion_items`
--
ALTER TABLE `promotion_items`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `tags`
--
ALTER TABLE `tags`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `activities`
--
ALTER TABLE `activities`
  ADD CONSTRAINT `fk_activity_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE;

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
-- Constraints for table `orders`
--
ALTER TABLE `orders`
  ADD CONSTRAINT `fk_orders_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`),
  ADD CONSTRAINT `fk_orders_creator` FOREIGN KEY (`creator_id`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `fk_orders_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`),
  ADD CONSTRAINT `fk_orders_page` FOREIGN KEY (`sales_channel_page_id`) REFERENCES `pages` (`id`);

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
  ADD CONSTRAINT `fk_order_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`);

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
-- Constraints for table `products`
--
ALTER TABLE `products`
  ADD CONSTRAINT `fk_products_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`);

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
-- Constraints for table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `fk_users_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`);

--
-- Constraints for table `user_tags`
--
ALTER TABLE `user_tags`
  ADD CONSTRAINT `fk_user_tags_tag` FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_user_tags_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
