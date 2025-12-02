-- phpMyAdmin SQL Dump
-- version 4.9.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Nov 30, 2025 at 05:33 AM
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
-- Table structure for table `order_slips`
--

CREATE TABLE `order_slips` (
  `id` int(11) NOT NULL,
  `amount` decimal(12,2) DEFAULT NULL,
  `bank_account_id` int(11) DEFAULT NULL,
  `transfer_date` datetime DEFAULT NULL,
  `order_id` varchar(32) NOT NULL,
  `url` varchar(1024) NOT NULL,
  `upload_by` int(11) DEFAULT NULL,
  `upload_by_name` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `order_slips`
--

INSERT INTO `order_slips` (`id`, `amount`, `bank_account_id`, `transfer_date`, `order_id`, `url`, `upload_by`, `upload_by_name`, `created_at`) VALUES
(27, NULL, 1, '2025-11-24 11:18:00', '251124-00024admin10n', 'api/uploads/slips/slip_251124-00024admin10n_20251124_101919_ed28b5.png', NULL, NULL, '2025-11-24 10:19:19'),
(28, NULL, 1, '2025-11-26 15:31:00', '251126-00033telesale1s8', 'api/uploads/slips/slip_251126-00033telesale1s8_20251126_153127_f97658.png', NULL, NULL, '2025-11-26 15:31:27'),
(29, NULL, NULL, NULL, '251126-00033telesale1s8', 'api/uploads/slips/slip_251126-00033telesale1s8_20251126_153215_769c3b.png', NULL, NULL, '2025-11-26 15:32:15'),
(30, '1200.00', 1, '2025-11-26 15:48:00', '251126-00035telesale1ad', 'api/uploads/slips/slip_251126-00035telesale1ad_20251126_154842_929851.png', NULL, NULL, '2025-11-26 15:48:42'),
(31, NULL, 2, '2025-11-29 11:53:00', '251127-00036telesale1z3', 'api/uploads/slips/slip_251127-00036telesale1z3_20251127_115347_8cd8f9.png', NULL, NULL, '2025-11-27 11:53:47'),
(32, NULL, 2, '2025-11-28 12:03:00', '251127-00037telesale1jo', 'api/uploads/slips/slip_251127-00037telesale1jo_20251127_120341_7a0c7f.png', NULL, NULL, '2025-11-27 12:03:41'),
(33, NULL, 2, '2025-11-28 12:13:00', '251127-00038telesale1hl', 'api/uploads/slips/slip_251127-00038telesale1hl_20251127_121350_f2f4b0.jpg', 1655, 'Thida Telesale', '2025-11-27 12:13:50'),
(34, NULL, 1, '2025-11-22 12:33:00', '251127-00039admin13f', 'api/uploads/slips/slip_251127-00039admin13f_20251127_123403_fe94d5.png', 1650, 'Anong Page', '2025-11-27 12:34:03'),
(35, NULL, NULL, NULL, '251127-00039admin13f', 'api/uploads/slips/slip_251127-00039admin13f_20251127_130302_05a069.png', 1655, 'Thida Telesale', '2025-11-27 13:03:02'),
(36, '3010.00', 1, '2025-11-19 19:55:00', '251128-00041telesale1km', 'api/uploads/slips/slip_251128-00041telesale1km_20251128_145856_c543a3.png', 1655, 'Thida Telesale', '2025-11-28 14:58:56'),
(37, '2345.00', 1, '2025-11-19 20:29:00', '251128-00041telesale1km', 'api/uploads/slips/slip_251128-00041telesale1km_20251128_145856_80393b.png', 1655, 'Thida Telesale', '2025-11-28 14:58:56'),
(38, '6920.00', 1, '2025-11-19 23:19:00', '251128-00041telesale1km', 'api/uploads/slips/slip_251128-00041telesale1km_20251128_145856_e4f442.png', 1655, 'Thida Telesale', '2025-11-28 14:58:56');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `order_slips`
--
ALTER TABLE `order_slips`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_order_slips_order` (`order_id`),
  ADD KEY `idx_order_slips_bank_account_id` (`bank_account_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `order_slips`
--
ALTER TABLE `order_slips`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=39;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `order_slips`
--
ALTER TABLE `order_slips`
  ADD CONSTRAINT `fk_order_slips_bank_account_id` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_account` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_order_slips_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
