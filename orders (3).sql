-- phpMyAdmin SQL Dump
-- version 4.9.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Nov 30, 2025 at 05:35 AM
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
  `customer_id` int(11) DEFAULT NULL,
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
  `shipping_provider` varchar(128) DEFAULT NULL,
  `shipping_cost` decimal(12,2) NOT NULL DEFAULT '0.00',
  `bill_discount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `total_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `payment_method` enum('COD','Transfer','PayAfter') DEFAULT NULL,
  `payment_status` enum('Unpaid','PendingVerification','Verified','PreApproved','Approved','Paid') DEFAULT NULL,
  `slip_url` varchar(1024) DEFAULT NULL,
  `amount_paid` decimal(12,2) DEFAULT NULL,
  `cod_amount` decimal(12,2) DEFAULT NULL,
  `order_status` enum('Pending','AwaitingVerification','Confirmed','Preparing','Picking','Shipping','PreApproved','Delivered','Returned','Cancelled') DEFAULT NULL,
  `notes` text,
  `ocr_payment_date` datetime DEFAULT NULL,
  `sales_channel` varchar(128) DEFAULT NULL,
  `sales_channel_page_id` int(11) DEFAULT NULL,
  `bank_account_id` int(11) DEFAULT NULL,
  `transfer_date` datetime DEFAULT NULL,
  `warehouse_id` int(11) DEFAULT NULL COMMENT 'รหัสคลังสินค้าที่จัดส่ง'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `orders`
--

INSERT INTO `orders` (`id`, `customer_id`, `company_id`, `creator_id`, `order_date`, `delivery_date`, `street`, `subdistrict`, `district`, `province`, `postal_code`, `recipient_first_name`, `recipient_last_name`, `shipping_provider`, `shipping_cost`, `bill_discount`, `total_amount`, `payment_method`, `payment_status`, `slip_url`, `amount_paid`, `cod_amount`, `order_status`, `notes`, `ocr_payment_date`, `sales_channel`, `sales_channel_page_id`, `bank_account_id`, `transfer_date`, `warehouse_id`) VALUES
('251121-00005telesale1yx', 99999, 1, 1655, '2025-11-21 16:03:15', '2025-11-22 00:00:00', 'Thailand', 'บึงยี่โถ', 'ธัญบุรี', 'ปทุมธานี', '12130', 'หกดดกด', 'กดกดด', NULL, '0.00', '0.00', '120.00', 'COD', 'Unpaid', NULL, NULL, NULL, 'Picking', NULL, NULL, 'โทร', NULL, NULL, NULL, 1),
('251121-00006telesale1x3', 99999, 1, 1655, '2025-11-21 16:39:08', '2025-11-22 00:00:00', 'Thailand', 'บึงยี่โถ', 'ธัญบุรี', 'ปทุมธานี', '12130', 'หกดดกด', 'กดกดด', NULL, '0.00', '0.00', '200.00', 'COD', 'Unpaid', NULL, NULL, NULL, 'Picking', NULL, NULL, 'โทร', NULL, NULL, NULL, 1),
('251121-00007telesale1h8', 5, 1, 1655, '2025-11-21 16:44:53', '2025-11-22 00:00:00', '654 ถนนสุขุมวิท', 'บางนา', 'บางนา', 'สมุทรปราการ', '10260', 'ประเสริฐ', 'ดีมาก', NULL, '0.00', '0.00', '120.00', 'COD', 'Unpaid', NULL, NULL, NULL, 'Picking', NULL, NULL, 'โทร', NULL, NULL, NULL, 1),
('251122-00008telesale19d', 5, 1, 1655, '2025-11-22 04:06:31', '2025-11-23 00:00:00', '654 ถนนสุขุมวิท', 'บางนา', 'บางนา', 'สมุทรปราการ', '10260', 'ประเสริฐ', 'ดีมาก', NULL, '0.00', '0.00', '200.00', 'COD', 'Unpaid', NULL, NULL, NULL, 'Pending', NULL, NULL, 'โทร', NULL, NULL, NULL, 1),
('251122-00009telesale1kw', 99999, 1, 1655, '2025-11-22 13:31:05', '2025-11-23 00:00:00', 'Thailand', 'บึงยี่โถ', 'ธัญบุรี', 'ปทุมธานี', '12130', 'หกดดกด', 'กดกดด', NULL, '0.00', '0.00', '200.00', 'COD', 'Unpaid', NULL, NULL, NULL, 'Pending', NULL, NULL, 'โทร', NULL, NULL, NULL, 1),
('251122-00010telesale1oc', 99999, 1, 1655, '2025-11-22 13:35:41', '2025-11-23 00:00:00', 'Thailand', 'บึงยี่โถ', 'ธัญบุรี', 'ปทุมธานี', '12130', 'หกดดกด', 'กดกดด', NULL, '0.00', '0.00', '120.00', 'COD', 'Unpaid', NULL, NULL, NULL, 'Pending', NULL, NULL, 'โทร', NULL, NULL, NULL, 1),
('251122-00011telesale19m', 99999, 1, 1655, '2025-11-22 13:40:13', '2025-11-23 00:00:00', 'Thailand', 'บึงยี่โถ', 'ธัญบุรี', 'ปทุมธานี', '12130', 'หกดดกด', 'กดกดด', NULL, '0.00', '0.00', '200.00', 'COD', 'Unpaid', NULL, NULL, NULL, 'Pending', NULL, NULL, 'โทร', NULL, NULL, NULL, 1),
('251122-00012telesale1bb', 99999, 1, 1655, '2025-11-22 13:46:36', '2025-11-23 00:00:00', 'Thailand', 'บึงยี่โถ', 'ธัญบุรี', 'ปทุมธานี', '12130', 'หกดดกด', 'กดกดด', NULL, '0.00', '0.00', '200.00', 'PayAfter', 'Unpaid', NULL, NULL, NULL, 'Pending', NULL, NULL, 'โทร', NULL, NULL, NULL, 1),
('251122-00013telesale17f', 99999, 1, 1655, '2025-11-22 13:49:58', '2025-11-23 00:00:00', 'Thailand', 'บึงยี่โถ', 'ธัญบุรี', 'ปทุมธานี', '12130', 'หกดดกด', 'กดกดด', NULL, '0.00', '0.00', '200.00', '', 'Unpaid', NULL, NULL, NULL, 'Pending', NULL, NULL, 'โทร', NULL, NULL, NULL, 1),
('251122-00014telesale16x', 99999, 1, 1655, '2025-11-22 13:50:57', '2025-11-23 00:00:00', 'Thailand', 'บึงยี่โถ', 'ธัญบุรี', 'ปทุมธานี', '12130', 'หกดดกด', 'กดกดด', 'Aiport Logistic', '0.00', '0.00', '200.00', '', 'Unpaid', NULL, NULL, NULL, 'Pending', NULL, NULL, 'โทร', NULL, NULL, NULL, 1),
('251122-00015telesale1e5', 99999, 1, 1655, '2025-11-22 13:57:21', '2025-11-23 00:00:00', 'Thailand', 'บึงยี่โถ', 'ธัญบุรี', 'ปทุมธานี', '12130', 'หกดดกด', 'กดกดด', NULL, '0.00', '0.00', '200.00', '', 'Unpaid', NULL, NULL, NULL, 'Pending', NULL, NULL, 'โทร', NULL, NULL, NULL, 1),
('251122-00016telesale1tf', 99999, 1, 1655, '2025-11-22 14:01:12', '2025-11-23 00:00:00', 'Thailand', 'บึงยี่โถ', 'ธัญบุรี', 'ปทุมธานี', '12130', 'หกดดกด', 'กดกดด', 'Aiport Logistic', '0.00', '0.00', '200.00', '', 'Unpaid', NULL, NULL, NULL, 'Pending', NULL, NULL, 'โทร', NULL, NULL, NULL, 1),
('251122-00017telesale1ci', 99999, 1, 1655, '2025-11-22 14:01:59', '2025-11-23 00:00:00', 'Thailand', 'บึงยี่โถ', 'ธัญบุรี', 'ปทุมธานี', '12130', 'หกดดกด', 'กดกดด', NULL, '0.00', '0.00', '200.00', '', 'Unpaid', NULL, NULL, NULL, 'Pending', NULL, NULL, 'โทร', NULL, NULL, NULL, 1),
('251123-00019admin15u', 100001, 1, 1650, '2025-11-23 08:54:23', '2025-11-24 00:00:00', '33/10 ภูริคลอง 7', 'ทรายกองดินใต้', 'เขตคลองสามวา', 'กรุงเทพมหานคร', '10510', 'มาทดสอบ', 'ปลัดบอก', NULL, '0.00', '0.00', '200.00', '', 'Unpaid', NULL, NULL, NULL, 'Pending', NULL, NULL, 'Facebook', 27, NULL, NULL, 1),
('251124-00020admin1cc', 100002, 1, 1650, '2025-11-24 02:55:15', '2025-11-25 00:00:00', 'Thailand', 'บึงยี่โถ', 'ธัญบุรี', 'ปทุมธานี', '12130', 'สนทนา', 'ปลัดบอก', 'Aiport Logistic', '0.00', '0.00', '200.00', 'PayAfter', 'Unpaid', NULL, NULL, NULL, 'Pending', NULL, NULL, 'Line', 6, NULL, NULL, 1),
('251124-00021admin1d1', 100003, 1, 1650, '2025-11-24 03:12:10', '2025-11-25 00:00:00', 'Thailand', 'ระแหง', 'ลาดหลุมแก้ว', 'ปทุมธานี', '12140', 'มาม่า', 'กด', 'Aiport Logistic', '0.00', '0.00', '120.00', 'PayAfter', 'Unpaid', NULL, NULL, NULL, 'Pending', NULL, NULL, 'Facebook', 16, NULL, NULL, 1),
('251124-00022admin1v9', 100004, 1, 1650, '2025-11-24 03:17:29', '2025-11-25 00:00:00', 'Thailand', 'คูคต', 'ลำลูกกา', 'ปทุมธานี', '12130', 'ddfdf', 'sdfsfsfs', 'Aiport Logistic', '0.00', '0.00', '120.00', 'PayAfter', 'Unpaid', NULL, NULL, NULL, 'Pending', NULL, NULL, 'Facebook', 18, NULL, NULL, 1),
('251124-00023admin1go', 100005, 1, 1650, '2025-11-24 03:18:28', '2025-11-25 00:00:00', 'Thailand', 'บึงยี่โถ', 'ธัญบุรี', 'ปทุมธานี', '12130', 'asdddasdad', 'sdfsdfdsff', 'Aiport Logistic', '0.00', '0.00', '120.00', 'COD', 'Unpaid', NULL, NULL, NULL, 'Pending', NULL, NULL, 'โทร(FaceBook)', 20, NULL, NULL, 1),
('251124-00024admin10n', 100006, 1, 1650, '2025-11-24 03:19:20', '2025-11-25 00:00:00', 'sfdfsdfsdf', 'ปิล๊อก', 'ทองผาภูมิ', 'กาญจนบุรี', '71180', 'ssdfsfsfsf', 'sdfdssdf', NULL, '0.00', '0.00', '200.00', 'Transfer', 'Verified', 'api/uploads/slips/slip_251124-00024admin10n_20251127_150001.png', '400.00', '0.00', 'Pending', NULL, NULL, 'TikTok', 2, 1, '2025-11-24 11:18:00', 2),
('251124-00025telesale1gi', 7, 1, 1655, '2025-11-24 03:49:26', '2025-11-25 00:00:00', '99/9 หมู่บ้านสุขใจ ซอย 5 ถนนโชคชัย 4 แขวงลาดพร้าว เขตลาดพร้าว กรุงเทพมหานคร 10230', 'ทรายกองดิน', 'เขตคลองสามวา', 'กรุงเทพมหานคร', '10510', 'สุดจัด', 'ปลัดบอก', NULL, '0.00', '0.00', '200.00', 'PayAfter', 'Unpaid', NULL, NULL, NULL, 'Pending', NULL, NULL, 'โทร', NULL, NULL, NULL, 1),
('251124-00026admin1py', 100007, 1, 1650, '2025-11-24 03:51:04', '2025-11-25 00:00:00', 'Thailand', 'คูบางหลวง', 'ลาดหลุมแก้ว', 'ปทุมธานี', '12140', 'ddfdfdfdfdfsfsf', 'sdfsdfsdfsdfsdfsdf', NULL, '0.00', '0.00', '120.00', 'COD', 'Unpaid', NULL, NULL, NULL, 'Picking', NULL, NULL, 'Facebook', 13, NULL, NULL, 1),
('251124-00027admin1bq', 100008, 1, 1650, '2025-11-24 04:05:24', '2025-11-25 00:00:00', 'Thailand', 'คูบางหลวง', 'ลาดหลุมแก้ว', 'ปทุมธานี', '12140', 'sdfsdfdsfsdfsdfsdf', 'dsfdfdsfdsf', NULL, '0.00', '0.00', '200.00', 'PayAfter', 'Unpaid', NULL, NULL, NULL, 'Picking', NULL, NULL, 'Facebook', 13, NULL, NULL, 1),
('251125-00028admin12t', 100003, 1, 1650, '2025-11-25 03:16:25', '2025-11-26 00:00:00', 'Thailand', 'ระแหง', 'ลาดหลุมแก้ว', 'ปทุมธานี', '12140', 'มาม่า', 'ไวๆ', 'Aiport Logistic', '0.00', '0.00', '120.00', 'PayAfter', 'Unpaid', NULL, '0.00', '0.00', 'Pending', NULL, NULL, 'โทร(FaceBook)', 17, NULL, NULL, 1),
('251125-00029admin1jn', 99999, 1, 1650, '2025-11-25 03:44:16', '2025-11-28 00:00:00', 'Thailand', 'บึงยี่โถ', 'ธัญบุรี', 'ปทุมธานี', '12130', 'ทดสอบ แก้ไข', 'แก้ไข ทดสอบ', 'Aiport Logistic', '0.00', '0.00', '200.00', 'COD', 'Unpaid', NULL, '0.00', '0.00', 'Pending', NULL, NULL, 'Facebook', 28, NULL, NULL, 1),
('251125-00030admin1j8', 100009, 1, 1650, '2025-11-25 08:07:50', '2025-11-26 00:00:00', 'หกดหกดหดห', 'จุมจัง', 'กุฉินารายณ์', 'กาฬสินธุ์', '46110', 'ขอโทดด', 'กดหกด', 'J&T Express', '0.00', '0.00', '110.00', 'COD', 'Unpaid', NULL, NULL, NULL, 'Shipping', NULL, NULL, 'Facebook', 27, NULL, NULL, 7),
('251126-00031telesale17x', 100003, 1, 1655, '2025-11-26 02:32:38', '2025-11-27 00:00:00', 'Thailand', 'ระแหง', 'ลาดหลุมแก้ว', 'ปทุมธานี', '12140', 'มาม่า', 'ไวๆ', 'J&T Express', '0.00', '0.00', '2880.00', 'COD', 'PreApproved', NULL, '2880.00', '2880.00', 'PreApproved', NULL, NULL, 'โทร', NULL, NULL, NULL, 1),
('251126-00032telesale17g', 100003, 1, 1655, '2025-11-26 08:29:45', '2025-11-27 00:00:00', 'Thailand', 'ระแหง', 'ลาดหลุมแก้ว', 'ปทุมธานี', '12140', 'มาม่า', 'ไวๆ', 'Kerry Express', '0.00', '0.00', '1800.00', 'COD', 'PreApproved', NULL, '1800.00', '1800.00', 'PreApproved', NULL, NULL, 'โทร', NULL, NULL, NULL, 1),
('251126-00033telesale1s8', 100002, 1, 1655, '2025-11-26 08:31:28', '2025-11-27 00:00:00', 'Thailand', 'บึงยี่โถ', 'ธัญบุรี', 'ปทุมธานี', '12130', 'สนทนา', 'มานะทดสอบ', 'J&T Express', '0.00', '0.00', '1700.00', 'Transfer', 'Verified', 'api/uploads/slips/slip_251126-00033telesale1s8_20251127_163055.png', '1700.00', NULL, 'Shipping', NULL, NULL, 'โทร', NULL, 1, '2025-11-26 15:31:00', 1),
('251126-00034telesale1gf', 99999, 1, 1655, '2025-11-26 08:39:19', '2025-11-27 00:00:00', 'Thailand', 'บึงยี่โถ', 'ธัญบุรี', 'ปทุมธานี', '12130', 'หกดดกด', 'กดกดด', 'Kerry Express', '0.00', '0.00', '3040.00', 'COD', 'Unpaid', NULL, NULL, '3040.00', 'Shipping', NULL, NULL, 'โทร', NULL, NULL, NULL, 1),
('251126-00035telesale1ad', 99999, 1, 1655, '2025-11-26 08:48:42', '2025-11-27 00:00:00', 'Thailand', 'บึงยี่โถ', 'ธัญบุรี', 'ปทุมธานี', '12130', 'หกดดกด', 'กดกดด', 'J&T Express', '0.00', '0.00', '1200.00', 'Transfer', 'Verified', 'api/uploads/slips/slip_251126-00035telesale1ad_20251126_154932.png', '1200.00', NULL, 'Shipping', NULL, NULL, 'โทร', NULL, 1, '2025-11-26 15:48:00', 1),
('251127-00036telesale1z3', 5, 1, 1655, '2025-11-27 04:53:47', '2025-11-28 00:00:00', '654 ถนนสุขุมวิท', 'บางนา', 'บางนา', 'สมุทรปราการ', '10260', 'ประเสริฐ', 'ดีมาก', 'Aiport Logistic', '0.00', '0.00', '840.00', 'Transfer', 'Verified', 'api/uploads/slips/slip_251127-00036telesale1z3_20251127_145955.png', '840.00', NULL, 'Pending', NULL, NULL, 'โทร', NULL, 2, '2025-11-29 11:53:00', 1),
('251127-00037telesale1jo', 99999, 1, 1655, '2025-11-27 05:03:41', '2025-11-28 00:00:00', 'Thailand', 'บึงยี่โถ', 'ธัญบุรี', 'ปทุมธานี', '12130', 'หกดดกด', 'กดกดด', NULL, '0.00', '0.00', '2000.00', 'Transfer', 'Verified', 'api/uploads/slips/slip_251127-00037telesale1jo_20251127_145947.png', '2000.00', NULL, 'Pending', NULL, NULL, 'โทร', NULL, 2, '2025-11-28 12:03:00', 1),
('251127-00038telesale1hl', 99999, 1, 1655, '2025-11-27 05:13:50', '2025-11-28 00:00:00', 'Thailand', 'บึงยี่โถ', 'ธัญบุรี', 'ปทุมธานี', '12130', 'หกดดกด', 'กดกดด', 'Aiport Logistic', '0.00', '0.00', '1080.00', 'Transfer', 'Verified', 'api/uploads/slips/slip_251127-00038telesale1hl_20251127_145941.jpg', '1080.00', NULL, 'Pending', NULL, NULL, 'โทร', NULL, 2, '2025-11-28 12:13:00', 1),
('251127-00039admin13f', 100003, 1, 1650, '2025-11-27 05:34:03', '2025-11-28 00:00:00', 'Thailand', 'ระแหง', 'ลาดหลุมแก้ว', 'ปทุมธานี', '12140', 'มาม่า', 'ไวๆ', NULL, '0.00', '0.00', '200.00', 'Transfer', 'Verified', 'api/uploads/slips/slip_251127-00039admin13f_20251127_145930.png', '1800.00', NULL, 'Pending', NULL, NULL, 'Facebook', 20, 1, '2025-11-22 12:33:00', 1),
('251128-00040telesale1jv', 100009, 1, 1655, '2025-11-28 07:48:37', '2025-11-29 00:00:00', 'หกดหกดหดห', 'จุมจัง', 'กุฉินารายณ์', 'กาฬสินธุ์', '46110', 'ขอโทดด', 'ทดสอบงาน', NULL, '0.00', '0.00', '11810.00', 'Transfer', 'PendingVerification', NULL, NULL, NULL, 'Pending', NULL, NULL, 'โทร', NULL, 1, '2025-11-19 10:55:00', 7),
('251128-00041telesale1km', 99999, 1, 1655, '2025-11-28 07:58:56', '2025-11-29 00:00:00', 'Thailand', 'บึงยี่โถ', 'ธัญบุรี', 'ปทุมธานี', '12130', 'หกดดกด', 'กดกดด', 'J&T Express', '0.00', '0.00', '12275.00', 'Transfer', 'Verified', NULL, '12275.00', NULL, 'Shipping', NULL, NULL, 'โทร', NULL, 1, '2025-11-19 19:55:00', 1);

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

--
-- Indexes for dumped tables
--

--
-- Indexes for table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_orders_company` (`company_id`),
  ADD KEY `fk_orders_page` (`sales_channel_page_id`),
  ADD KEY `fk_orders_warehouse` (`warehouse_id`),
  ADD KEY `idx_orders_creator` (`creator_id`),
  ADD KEY `idx_orders_status` (`order_status`),
  ADD KEY `idx_orders_payment_status` (`payment_status`),
  ADD KEY `idx_orders_company_status` (`company_id`,`order_status`),
  ADD KEY `idx_orders_date` (`order_date`),
  ADD KEY `idx_orders_delivery_date` (`delivery_date`),
  ADD KEY `idx_orders_company_payment` (`company_id`,`payment_status`),
  ADD KEY `idx_orders_bank_account_id` (`bank_account_id`),
  ADD KEY `fk_orders_customer` (`customer_id`);

--
-- Constraints for dumped tables
--

--
-- Constraints for table `orders`
--
ALTER TABLE `orders`
  ADD CONSTRAINT `fk_orders_bank_account` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_account` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_orders_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`),
  ADD CONSTRAINT `fk_orders_creator` FOREIGN KEY (`creator_id`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `fk_orders_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_orders_page` FOREIGN KEY (`sales_channel_page_id`) REFERENCES `pages` (`id`),
  ADD CONSTRAINT `fk_orders_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
