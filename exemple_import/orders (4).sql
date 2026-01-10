-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Jan 10, 2026 at 09:43 AM
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
-- Table structure for table `orders`
--

CREATE TABLE `orders` (
  `id` varchar(32) NOT NULL,
  `customer_id` int(11) DEFAULT NULL,
  `company_id` int(11) DEFAULT NULL,
  `creator_id` int(11) DEFAULT NULL,
  `order_date` datetime DEFAULT NULL,
  `delivery_date` datetime DEFAULT NULL,
  `street` varchar(255) DEFAULT NULL,
  `subdistrict` varchar(128) DEFAULT NULL,
  `district` varchar(128) DEFAULT NULL,
  `province` varchar(128) DEFAULT NULL,
  `postal_code` varchar(16) DEFAULT NULL,
  `recipient_first_name` varchar(128) DEFAULT NULL,
  `recipient_last_name` varchar(128) DEFAULT NULL,
  `shipping_provider` varchar(128) DEFAULT NULL,
  `shipping_cost` decimal(12,2) DEFAULT NULL,
  `bill_discount` decimal(12,2) DEFAULT NULL,
  `total_amount` decimal(12,2) DEFAULT NULL,
  `payment_method` enum('COD','Transfer','PayAfter','Claim','FreeGift') DEFAULT NULL,
  `payment_status` varchar(255) DEFAULT NULL,
  `slip_url` varchar(1024) DEFAULT NULL,
  `amount_paid` decimal(12,2) DEFAULT NULL,
  `cod_amount` decimal(12,2) DEFAULT NULL,
  `order_status` varchar(255) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `ocr_payment_date` datetime DEFAULT NULL,
  `sales_channel` varchar(128) DEFAULT NULL,
  `sales_channel_page_id` int(11) DEFAULT NULL,
  `bank_account_id` int(11) DEFAULT NULL,
  `transfer_date` datetime DEFAULT NULL,
  `warehouse_id` int(11) DEFAULT NULL,
  `customer_type` varchar(50) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `orders`
--
ALTER TABLE `orders`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_orders_customer` (`customer_id`),
  ADD KEY `fk_orders_page` (`sales_channel_page_id`),
  ADD KEY `fk_orders_warehouse` (`warehouse_id`),
  ADD KEY `idx_orders_bank_account_id` (`bank_account_id`),
  ADD KEY `idx_orders_company` (`company_id`),
  ADD KEY `idx_orders_company_payment` (`company_id`,`payment_status`),
  ADD KEY `idx_orders_company_status` (`company_id`,`order_status`),
  ADD KEY `idx_orders_creator` (`creator_id`),
  ADD KEY `idx_orders_date` (`order_date`),
  ADD KEY `idx_orders_delivery_date` (`delivery_date`),
  ADD KEY `idx_orders_payment_status` (`payment_status`),
  ADD KEY `idx_orders_status` (`order_status`),
  ADD KEY `idx_customer_id` (`customer_id`);

--
-- Constraints for dumped tables
--

--
-- Constraints for table `orders`
--
ALTER TABLE `orders`
  ADD CONSTRAINT `fk_orders_bank_account` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_account` (`id`) ON UPDATE NO ACTION,
  ADD CONSTRAINT `fk_orders_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  ADD CONSTRAINT `fk_orders_creator` FOREIGN KEY (`creator_id`) REFERENCES `users` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  ADD CONSTRAINT `fk_orders_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`customer_id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_orders_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
