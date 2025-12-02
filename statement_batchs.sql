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
-- Table structure for table `statement_batchs`
--

CREATE TABLE `statement_batchs` (
  `id` int(11) NOT NULL,
  `company_id` int(11) NOT NULL,
  `user_id` int(11) DEFAULT NULL,
  `row_count` int(11) NOT NULL,
  `transfer_min` datetime NOT NULL,
  `transfer_max` datetime NOT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `statement_batchs`
--

INSERT INTO `statement_batchs` (`id`, `company_id`, `user_id`, `row_count`, `transfer_min`, `transfer_max`, `created_at`) VALUES
(4, 1, 1651, 23, '2025-11-19 09:29:00', '2025-11-19 23:19:00', '2025-11-28 11:48:27'),
(7, 1, 1651, 2, '2025-11-26 15:31:00', '2025-11-26 15:48:00', '2025-11-28 11:50:49');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `statement_batchs`
--
ALTER TABLE `statement_batchs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `idx_statement_batchs_company_created` (`company_id`,`created_at`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `statement_batchs`
--
ALTER TABLE `statement_batchs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
