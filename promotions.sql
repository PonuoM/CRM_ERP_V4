-- phpMyAdmin SQL Dump
-- version 4.9.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Oct 16, 2025 at 08:05 AM
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
(1, 'PROMO-001', 'ปุ๋ย แสงราชสีห์ ซื้อ 4 แถม 1', 'ซื้อ 4 แถม 1 เซ็ตปุ๋ยแสงราชสีห์', 1, 1, '2025-10-16 00:00:00', '2025-11-12 00:00:00'),
(2, 'PROMO-002', 'ชุดทดลองเมล็ด 3 แถม 1', 'เลือก 3 ซอง แถม 1 ซอง', 1, 1, '2025-10-17 00:00:00', '2025-10-24 00:00:00'),
(4, 'API-TEST-001', 'โปรโมชั่นทดสอบ API (แก้ไขแล้ว)', 'โปรโมชั่นที่แก้ไขผ่าน API', 1, 0, '2024-01-01 00:00:00', '2024-12-31 00:00:00'),
(5, 'PROMO-003', 'ปุ๋ย แสงราชสีห์ ซื้อ 4 แถม 1', 'ปุ๋ยดีปุ๋ยเด่น', 1, 1, '2025-10-15 00:00:00', '2025-12-31 00:00:00'),
(6, 'DATE-TEST-001', 'โปรโมชั่นทดสอบวันที่ (แก้ไขแล้ว)', 'ทดสอบการแก้ไขวันที่', 1, 0, '2024-02-01 00:00:00', '2024-11-30 00:00:00'),
(7, 'DISPLAY-TEST-001', 'โปรโมชั่นทดสอบการแสดงวันที่', 'ทดสอบการแสดงวันที่ใน Frontend', 1, 0, '2024-01-15 00:00:00', '2024-12-15 00:00:00');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `promotions`
--
ALTER TABLE `promotions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_promotions_company` (`company_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `promotions`
--
ALTER TABLE `promotions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `promotions`
--
ALTER TABLE `promotions`
  ADD CONSTRAINT `fk_promotions_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
