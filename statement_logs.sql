-- phpMyAdmin SQL Dump
-- version 4.9.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Nov 30, 2025 at 05:34 AM
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
-- Table structure for table `statement_logs`
--

CREATE TABLE `statement_logs` (
  `id` int(11) NOT NULL,
  `batch_id` int(11) NOT NULL,
  `transfer_at` datetime NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `bank_account_id` int(11) DEFAULT NULL,
  `bank_display_name` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `channel` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `statement_logs`
--

INSERT INTO `statement_logs` (`id`, `batch_id`, `transfer_at`, `amount`, `bank_account_id`, `bank_display_name`, `channel`, `description`, `created_at`) VALUES
(53, 4, '2025-11-19 09:29:00', '14800.00', 1, 'กสิกรไทย - 9876854464', 'Internet/Mobile SCB', 'จาก SCB X4052 นาย ชัชวาลย์ ชัยสว++', '2025-11-28 11:48:27'),
(54, 4, '2025-11-19 10:05:00', '225.00', 1, 'กสิกรไทย - 9876854464', 'Internet/Mobile KTB', 'จาก KTB X8781 MR.SONGYOS CHAICHA++', '2025-11-28 11:48:27'),
(55, 4, '2025-11-19 10:30:00', '1195.00', 1, 'กสิกรไทย - 9876854464', 'K PLUS', 'จาก X2098 นาย ประชัน สุวรรณภ++', '2025-11-28 11:48:27'),
(56, 4, '2025-11-19 10:38:00', '4000.00', 1, 'กสิกรไทย - 9876854464', 'K PLUS', 'จาก X5724 น.ส. ณัฏฐพิชา ย่าน++', '2025-11-28 11:48:27'),
(57, 4, '2025-11-19 10:55:00', '1195.00', 1, 'กสิกรไทย - 9876854464', 'Internet/Mobile GSB', 'จาก GSB X1921 นาง ลำดวน หมอยาเก++', '2025-11-28 11:48:27'),
(58, 4, '2025-11-19 11:23:00', '790.00', 1, 'กสิกรไทย - 9876854464', 'Internet/Mobile GSB', 'จาก GSB X9172 น.ส. ไพรินทร์ เห็น++', '2025-11-28 11:48:27'),
(59, 4, '2025-11-19 12:44:00', '9825.00', 1, 'กสิกรไทย - 9876854464', 'LINE BK', 'จาก X2115 นาย ขรรคทนนท์ บุญ++', '2025-11-28 11:48:27'),
(60, 4, '2025-11-19 13:19:00', '1215.00', 1, 'กสิกรไทย - 9876854464', 'K PLUS', 'จาก X2364 นาย เรวัฒน์ จังกิ++', '2025-11-28 11:48:27'),
(61, 4, '2025-11-19 13:30:00', '1340.00', 1, 'กสิกรไทย - 9876854464', 'Internet/Mobile BAAC', 'จาก BAAC X2397 นาย อิบรอเฮง นาสอ++', '2025-11-28 11:48:27'),
(62, 4, '2025-11-19 13:40:00', '1215.00', 1, 'กสิกรไทย - 9876854464', 'K PLUS', 'จาก X2657 นาย บุญศรี คักกัน++', '2025-11-28 11:48:27'),
(63, 4, '2025-11-19 14:21:00', '1215.00', 1, 'กสิกรไทย - 9876854464', 'Internet/Mobile SCB', 'จาก SCB X0477 นาย ทักษิณ เตียตระ++', '2025-11-28 11:48:27'),
(64, 4, '2025-11-19 14:39:00', '3700.00', 1, 'กสิกรไทย - 9876854464', 'Internet/Mobile SCB', 'จาก SCB X8916 นางสาว ปุณณ์ภินันท++', '2025-11-28 11:48:27'),
(65, 4, '2025-11-19 14:49:00', '1940.00', 1, 'กสิกรไทย - 9876854464', 'Internet/Mobile BAY', 'จาก BAY X1615 PIYACH++', '2025-11-28 11:48:27'),
(66, 4, '2025-11-19 15:12:00', '790.00', 1, 'กสิกรไทย - 9876854464', 'Internet/Mobile KTB', 'จาก KTB X3958 MRS.YOTHAKA LAPE++', '2025-11-28 11:48:27'),
(67, 4, '2025-11-19 15:37:00', '1150.00', 1, 'กสิกรไทย - 9876854464', 'Internet/Mobile SCB', 'จาก SCB X3944 นาย อับดุลการิม เป++', '2025-11-28 11:48:27'),
(68, 4, '2025-11-19 16:09:00', '790.00', 1, 'กสิกรไทย - 9876854464', 'K PLUS', 'จาก X6219 นาง พักพริ้ง เรือง++', '2025-11-28 11:48:27'),
(69, 4, '2025-11-19 16:14:00', '1215.00', 1, 'กสิกรไทย - 9876854464', 'Internet/Mobile SCB', 'จาก SCB X3158 นาย สุรสิทธิ์ ตันต++', '2025-11-28 11:48:27'),
(70, 4, '2025-11-19 18:18:00', '790.00', 1, 'กสิกรไทย - 9876854464', 'Internet/Mobile KTB', 'จาก KTB X2346 SAMATI TEPMAT++', '2025-11-28 11:48:27'),
(71, 4, '2025-11-19 18:21:00', '1195.00', 1, 'กสิกรไทย - 9876854464', 'Internet/Mobile KTB', 'จาก KTB X5063 SUMALEE A++', '2025-11-28 11:48:27'),
(72, 4, '2025-11-19 18:45:00', '1215.00', 1, 'กสิกรไทย - 9876854464', 'ATM', 'จาก KTB X4759', '2025-11-28 11:48:27'),
(73, 4, '2025-11-19 19:55:00', '3010.00', 1, 'กสิกรไทย - 9876854464', 'Internet/Mobile KTB', 'จาก KTB X0106 SOMPOL GUNUR++', '2025-11-28 11:48:27'),
(74, 4, '2025-11-19 20:29:00', '2345.00', 1, 'กสิกรไทย - 9876854464', 'Internet/Mobile BBL', 'จาก BBL X0157 MR MUKHATA LAN++', '2025-11-28 11:48:27'),
(75, 4, '2025-11-19 23:19:00', '6920.00', 1, 'กสิกรไทย - 9876854464', 'EDC/K SHOP/MYQR', 'จาก KB000001996251 พรีออนิค', '2025-11-28 11:48:27'),
(101, 7, '2025-11-26 15:48:00', '1200.00', 1, 'กสิกรไทย - 9876854464', 'Internet/Mobile KTB', 'จาก KTB X8773 MR.THANAWAT LOETWA++', '2025-11-28 11:50:49'),
(102, 7, '2025-11-26 15:31:00', '1700.00', 1, 'กสิกรไทย - 9876854464', 'Internet/Mobile SCB', 'จาก SCB X0718 นาย นฤชาญ ศุภรสหัส++', '2025-11-28 11:50:49');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `statement_logs`
--
ALTER TABLE `statement_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_statement_logs_batch_transfer` (`batch_id`,`transfer_at`),
  ADD KEY `idx_statement_logs_bank_date` (`bank_account_id`,`transfer_at`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `statement_logs`
--
ALTER TABLE `statement_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=103;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `statement_logs`
--
ALTER TABLE `statement_logs`
  ADD CONSTRAINT `statement_logs_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `statement_batchs` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
