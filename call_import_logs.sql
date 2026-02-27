-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Feb 27, 2026 at 06:03 AM
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
-- Table structure for table `call_import_logs`
--

CREATE TABLE `call_import_logs` (
  `id` int(11) NOT NULL,
  `batch_id` int(11) NOT NULL,
  `record_id` varchar(32) NOT NULL,
  `business_group_name` varchar(255) DEFAULT NULL,
  `call_date` date DEFAULT NULL,
  `call_origination` varchar(32) DEFAULT NULL,
  `display_number` varchar(32) DEFAULT NULL,
  `call_termination` varchar(32) DEFAULT NULL,
  `status` tinyint(4) DEFAULT 0,
  `start_time` time DEFAULT NULL,
  `ringing_duration` varchar(16) DEFAULT NULL,
  `answered_time` varchar(16) DEFAULT NULL,
  `terminated_time` varchar(16) DEFAULT NULL,
  `terminated_reason` varchar(8) DEFAULT NULL,
  `reason_change` varchar(8) DEFAULT NULL,
  `final_number` varchar(32) DEFAULT NULL,
  `duration` varchar(16) DEFAULT NULL,
  `rec_type` tinyint(4) DEFAULT NULL,
  `charging_group` varchar(128) DEFAULT NULL,
  `agent_phone` varchar(32) DEFAULT NULL,
  `matched_user_id` int(11) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `call_import_logs`
--
ALTER TABLE `call_import_logs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uk_record_id` (`record_id`),
  ADD KEY `idx_cil_batch` (`batch_id`),
  ADD KEY `idx_cil_call_date` (`call_date`),
  ADD KEY `idx_cil_agent_phone` (`agent_phone`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `call_import_logs`
--
ALTER TABLE `call_import_logs`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `call_import_logs`
--
ALTER TABLE `call_import_logs`
  ADD CONSTRAINT `call_import_logs_ibfk_1` FOREIGN KEY (`batch_id`) REFERENCES `call_import_batches` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
