-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: localhost
-- Generation Time: Oct 13, 2025 at 04:02 AM
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
-- Database: `primacom_Customer`
--

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `user_id` int(11) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `full_name` varchar(100) NOT NULL,
  `email` varchar(100) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `role_id` int(11) NOT NULL,
  `company_id` int(11) DEFAULT NULL,
  `supervisor_id` int(11) DEFAULT NULL COMMENT 'References user_id of supervisor who manages this user',
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `last_login` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`user_id`, `username`, `password_hash`, `full_name`, `email`, `phone`, `role_id`, `company_id`, `supervisor_id`, `is_active`, `created_at`, `updated_at`, `last_login`) VALUES
(1, 'admin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'ผู้ดูแลระบบ', 'admin@prima49.com', '081-234-5678', 1, NULL, NULL, 1, '2025-08-03 07:19:20', '2025-09-19 03:14:57', '2025-09-19 03:14:57'),
(2, 'supervisor', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'หัวหน้าทีมขาย', 'supervisor@prima49.com', '081-234-5679', 3, 1, NULL, 1, '2025-08-03 07:19:20', '2025-09-10 09:03:00', '2025-09-10 09:03:00'),
(3, 'telesales1', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'พนักงานขาย 1', 'telesales1@prima49.com', '081-234-5680', 4, 1, 2, 1, '2025-08-03 07:19:20', '2025-10-13 03:37:41', '2025-10-13 03:37:41'),
(4, 'telesales2', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'พนักงานขาย 2', 'telesales2@prima49.com', '081-234-5681', 4, 5, NULL, 1, '2025-08-03 07:19:20', '2025-10-13 02:59:22', '2025-10-13 02:59:22'),
(6, 'gif', '$2y$10$GLCrR7q.uR1seJ1Vm6YcUuMZB9HGi1vSxCUhwzAV9oEY.wedIiIYC', 'กิ๊ฟ Telesale', 'gif-prionic@gmail.com', '-', 4, 2, NULL, 1, '2025-08-07 13:31:30', '2025-10-11 04:07:50', '2025-10-11 04:07:50'),
(7, 'poz', '$2y$10$FCU60hz0YpmGOMPFGK.vR.m7Rc5JQMgVTS6OZ2jaEEoMHxdRRxcWm', 'พลอย Telesale', 'poz_ponic@gmail.com', '', 4, 2, NULL, 1, '2025-08-12 07:11:20', '2025-10-13 01:57:35', '2025-10-13 01:57:35'),
(8, 'mew', '$2y$10$7BRh0DOD4xSRQXZaVguTOO2sGeolYfc1vTleRoDLe1jH7TswJy24m', 'เหมียว Telesale', 'mew-peonic@gmail.com', '', 4, 2, NULL, 1, '2025-08-12 07:12:48', '2025-10-13 02:05:13', '2025-10-13 02:05:13'),
(9, 'ice', '$2y$10$ku0GvZq4l1ks6BG3ihMzC.mPNZNNSfQLEMxS1ph8wN5aB2UAybgGK', 'ไอซ์ Telesale', 'ice-peonic@gmail.com', '-', 4, 2, NULL, 1, '2025-08-12 07:13:48', '2025-10-13 01:56:08', '2025-10-13 01:56:08'),
(10, 'ben', '$2y$10$Iz.ZpNtN9fNFOFV83QaAGuCnyjCP0CnGU2RzI0BxWPVbd08wyGSKa', 'เบญ Admin page', 'ben-peonic@gmail.com', '-', 5, 2, NULL, 1, '2025-08-13 04:38:00', '2025-08-13 04:38:00', NULL),
(11, 'mpp', '$2y$10$C89ZGqRhC9P1wxfQZwbyZu18tbFPb0s5sQspHFOFKrbPnwNTJzoYC', 'ปราย Admin page', 'mpp-peonic@gmail.com', '-', 5, 2, NULL, 1, '2025-08-13 04:40:03', '2025-08-13 04:40:03', NULL),
(12, 'jan', '$2y$10$iZoHgY05lv6m8tkmQWYOXeT6ygbg.Uf4zVfs9RbRw0z3tqiiFy/MO', 'แจนนี่ Adminpage', 'jan-peonic@gmail.com', '-', 5, 2, NULL, 1, '2025-08-13 04:41:32', '2025-08-13 04:41:32', NULL),
(13, 'toro', '$2y$10$1vZPx4rMD8LQFEArH8zkLOnGVL1mC7bK7.w4ni9TiL315q/UxGpje', 'พี่โต admin', 'toro@gmail.com', '-', 6, 2, NULL, 1, '2025-08-15 02:36:55', '2025-10-12 13:42:33', '2025-10-12 13:42:33'),
(14, 'yng', '$2y$10$HMDxlwzDpgpwzQR/fl70gO2SPqDz.pRHn8RzLfBeX66Yjkif4.uMC', 'หญิง Admin', 'ying@gmail.com', '-', 5, 2, NULL, 1, '2025-08-15 08:34:15', '2025-08-15 08:34:15', NULL),
(15, 'sry', '$2y$10$Aird2RU9Wcil8rBbgQn.A.aouCzz6v5HeI04DlXwSc97teVRtyi4q', 'ปอ Admin', 'sry@gmail.com', '-', 5, 2, NULL, 1, '2025-08-15 08:36:01', '2025-08-15 08:36:01', NULL),
(16, 'bow', '$2y$10$yIvTlEYVeo1797PpBmXr4OHa/OvipQiCRzJr9kTENB3Bg6PfhN2QC', 'โบว์ Admin', 'bow@gmail.com', '-', 5, 2, NULL, 1, '2025-08-15 08:36:51', '2025-08-15 08:36:51', NULL),
(17, 'pla', '$2y$10$hshnR5d5IRnOAS0j2Rm1zempU8XWDtS5.dZPAcb6CedJTfEPuQDk2', 'เพลง Admin', 'pla@gmail.com', '-', 5, 2, NULL, 1, '2025-08-15 08:38:00', '2025-08-15 08:38:00', NULL),
(18, 'icc', '$2y$10$rJm6XmbSDTkpWaLiUx1VIeMvzetXxwY0SgjrXE0MrljyXcKQhwDwS', 'ไอซ์ Admin', 'icc@gmail.com', '-', 5, 2, NULL, 1, '2025-08-15 08:38:47', '2025-08-15 08:38:47', NULL),
(19, 'tuu', '$2y$10$LGvzo/0L8qi5k4H4QN/KH.6KCjqC52R/yRotnp1kVCTxEITt0jBja', 'ตู่ Admin', 'tuu@gmail.com', '-', 5, 2, NULL, 1, '2025-08-15 08:39:44', '2025-08-15 08:39:44', NULL),
(20, 'jkk', '$2y$10$.lODXRPjPSCG4805tN/u1OYuEJV6NOhD182SnYDEQHHZ4CJSzSCFW', 'แจง พรีออนิค', 'jkk@gmail.com', '-', 6, 2, NULL, 1, '2025-08-15 08:40:51', '2025-10-09 07:18:30', '2025-10-09 07:18:30'),
(21, 'ang', '$2y$10$GS0B/TinCDYH8nM5LYeKb.hZfWF0BGyWDy6HXGiKoP6nXsfRrS5yG', 'อังคณา  สุนทรท้วม', 'aung@gmail.com', '09491446644', 4, 2, NULL, 1, '2025-08-22 02:11:46', '2025-10-13 01:57:06', '2025-10-13 01:57:06'),
(22, 'testadmin3', '$2y$10$fehzYkbZr4T26xC5jDuKkux6Indso8P.ZmlmoLnLWd/LyYPd2BlDO', 'test2', 'test@gmail.com', 'd', 6, 5, NULL, 1, '2025-09-02 12:12:56', '2025-10-13 02:34:36', '2025-10-13 02:34:36'),
(23, 'telesale6', '$2y$10$ku0GvZq4l1ks6BG3ihMzC.mPNZNNSfQLEMxS1ph8wN5aB2UAybgGK', 'ทดสอบ 6', 'kapoala@gmail.com', '', 4, 5, NULL, 1, '2025-09-02 16:21:46', '2025-09-18 05:57:29', '2025-09-18 05:57:29'),
(24, 'pnr', '$2y$10$l4joWR/2fWvy0G6DTZLiQOtQib7IwLka9cck5pwtBWiwywqdtHtVC', 'ปอนด์ [Supervisor]', 'pnr@gmail.com', '66950546556', 3, 1, NULL, 1, '2025-09-03 07:13:09', '2025-10-13 02:22:11', '2025-10-13 02:22:11'),
(25, 'nnn', '$2y$10$cSPe4ETmRkgsjWJ/fAwrf.ljSJlF1pn8E2coqt.258uegKnrT8Cy6', 'หนิง [Supervisor]', 'nnn@gmail.com', '66994164440', 3, 1, NULL, 1, '2025-09-03 07:14:15', '2025-10-13 02:43:10', '2025-10-13 02:43:10'),
(26, 'nam', '$2y$10$FjKnxKfd22gfNqg5Vrpk6.rt8lt2wRO7X99RiNj2I6ZwaZS1gBxLy', 'น้ำ [Supervisor]', 'nam@gmail.com', '66944272646', 3, 1, NULL, 1, '2025-09-03 07:15:03', '2025-10-13 02:14:54', '2025-10-13 02:14:54'),
(27, 'dva', '$2y$10$r1OmnOKy8BB28eQlR1Squ.YNo93k6fOoK4WYJzGQCAUpHQ0G/KuEm', 'แหวว [Supervisor]', 'dva@gmail.com', '66634656660', 3, 1, NULL, 1, '2025-09-03 07:15:53', '2025-10-13 01:59:38', '2025-10-13 01:59:38'),
(28, 'bee', '$2y$10$pYSt3siqB0Xm4RtnRWmpluo68VKVzpJyfYke4.7xGNOJ1.vUC5Jwi', 'บี telesale', 'bee@gmail.com', '66626209650', 4, 1, 24, 1, '2025-09-03 07:26:06', '2025-10-13 01:58:02', '2025-10-13 01:58:02'),
(29, 'fff', '$2y$10$dnUMlLX/Y/9WoH1owK1jD.XqV/n/nf/vHR.Z6IqFwZsIwgqFU6uq.', 'ฝ้าย [Telesale]', 'fff@gmail.com', '66942491352', 4, 1, 25, 1, '2025-09-03 07:27:57', '2025-10-13 02:14:03', '2025-10-13 02:14:03'),
(30, 'fon', '$2y$10$ui6aGf3/RgoMIR8bEb3b2eV0vvIAK89Ba6JvLrKMux4XoX2IZNWNy', 'ฝน [Telesale]', 'fon@gmail.com', '66617060440', 4, 1, 25, 1, '2025-09-03 07:29:17', '2025-10-13 02:13:10', '2025-10-13 02:13:10'),
(31, 'viv', '$2y$10$d/33xisbZJ6moggBZhXBd.Ervk2qY/8X7rrtm5YDKcQ/XVL5eF/GC', 'กวาง [Telesale]', 'viv@gmail.com', '66652041252', 4, 1, 26, 1, '2025-09-03 07:30:25', '2025-10-13 01:43:01', '2025-10-13 01:43:01'),
(32, 'eng', '$2y$10$T6sFOBRpAEQZH.uP3hrbR.vDtNzGGUR0t4y5I8E/RiNCYXuYLp.j6', 'พลอยใส [Telesale]', 'eng@gmail.com', '66945547266', 4, 1, 26, 1, '2025-09-03 07:31:34', '2025-10-13 02:08:07', '2025-10-13 02:08:07'),
(33, 'noi', '$2y$10$abNXcnn3cS.gtAyOILxQrOY6rOoBMdOFSCN9GdQcF7Ma9g2TPSiry', 'หน่อย [Telesale]', 'noi@gmail.com', '66660624651', 4, 1, 27, 1, '2025-09-03 07:32:24', '2025-10-13 02:11:19', '2025-10-13 02:11:19'),
(34, 'min', '$2y$10$2y3Kb/bRC7gorJDk1w82OOVmixLXlDZdbapx9ftKUCzgBwboRKHrS', 'มินนี่ [Telesale]', 'min@gmail.com', '66660524963', 4, 1, 27, 1, '2025-09-03 07:33:19', '2025-10-13 02:15:42', '2025-10-13 02:15:42'),
(35, 'ggg', '$2y$10$8aUltAiom5JTww2olUsKkeL9Gv7MB7HK7goZrsqBxDB/Sqzkn2rSq', 'แกรน [Telelsale]', 'ggg@gmail.com', '66626633267', 4, 1, 27, 1, '2025-09-03 07:34:10', '2025-10-13 01:51:36', '2025-10-13 01:51:36'),
(36, 'gof', '$2y$10$9o8EFoM53/51wdV4KE4Arul0t/sO54JPBhE4MwBykg31hukox0qAe', 'กล๊อฟ [Telesale]', 'gof@gmail.com', '66945547598', 4, 1, 24, 1, '2025-09-03 07:35:09', '2025-10-13 02:04:45', '2025-10-13 02:04:45'),
(37, 'api', '$2y$10$Z8XWSz0nxbi3GdB.OKGLfuuoHAB323Dj4n/vM3kdwr5V5uUBi9RkO', 'ตูน [Telesale]', 'api@gmail.com', '66831092265', 4, 1, 24, 1, '2025-09-03 07:37:15', '2025-10-13 02:08:13', '2025-10-13 02:08:13'),
(38, 'cha', '$2y$10$mPt5tt2Ft9jWepZkcyF8COfa1oOkMUBCgV5hE9ubd/zQnEKE51GKW', 'เอ้ [Telesale]', 'cha@gmail.com', '66991451323', 4, 1, 26, 1, '2025-09-03 07:37:59', '2025-10-13 01:36:46', '2025-10-13 01:36:46'),
(39, 'see', '$2y$10$GldawxLPxNF.y6LJEAzAxOZEaO.upNy.PjAqpOP6x2wqDT1eQtFDm', 'ซี [Telesale]', 'see@gmail.com', '66831092262', 4, 1, 25, 1, '2025-09-03 07:38:54', '2025-10-13 02:06:03', '2025-10-13 02:06:03'),
(40, 'nut', '$2y$10$Z9mhuWLbuSrEWYrVNthqqOS627MSY3CRAJqw8RMfNxVN7yLiPKCKa', 'นัท [Telesale]', 'nut@gmail.com', '66831092264', 4, 1, 27, 1, '2025-09-03 07:39:51', '2025-10-13 01:43:28', '2025-10-13 01:43:28'),
(47, 'thanu', '$2y$10$lz3J2kekKS1idcZMVkvq5O0AH.L5kvdfDT1ss5MWkqy2zJZjoX3jK', 'ธนู สุริวงศ์', 'prima.thanu.s@gmail.com', '0952519797', 6, 1, NULL, 1, '2025-09-03 16:03:32', '2025-10-08 09:40:51', '2025-10-08 09:40:51'),
(48, 'Boss', '$2y$10$lz3J2kekKS1idcZMVkvq5O0AH.L5kvdfDT1ss5MWkqy2zJZjoX3jK', 'วัชรพัน ลิ้มถาวรวิวัฒน์', 'watcharaphan.prima@gmail.com', '0958765410', 6, 1, NULL, 1, '2025-09-04 02:31:21', '2025-10-13 01:59:00', '2025-10-13 01:59:00'),
(49, 'thanu_prionic', '$2y$10$lwJhb0vxwmzpORmuhKlvqeejKWyykesatdMcf2YA7Pteq6ojLcK26', 'ธนู สุริวงศ์', 'prima.thanu.s@gmail.com', '0952519797', 6, 2, NULL, 1, '2025-09-04 02:43:14', '2025-09-04 02:43:19', '2025-09-04 02:43:19'),
(50, 'puidee', '$2y$10$k.Qd6i.YxVWmALv8uVfyDOmUcna/HnjOV.YjMlL/3xJK8B.onaUFS', 'ปุ๋ยดี [ Admin ]', 'puidee93@gmail.com', '0915146693', 6, 6, NULL, 1, '2025-09-04 03:02:19', '2025-10-13 03:49:23', '2025-10-13 03:49:23'),
(51, 'psp661199', '$2y$10$Bp2wX9ovg0L2ixuOJRo5Eu/C3Tqwkl1fesgwXIe8wFhjHC5RNtNp.', 'แพชชั่น พลัส [Admin]', 'info@PASSIONPLUSS.com', '0636632526', 6, 7, NULL, 1, '2025-09-04 04:36:00', '2025-10-12 03:05:25', '2025-10-12 03:05:25'),
(52, '100002', '$2y$10$EUih8HciiHr5Y5qVneMf.u.Cw1Df.hCzE4frje5xOQ8Yca4qNV7c6', 'สมสกุล โต๊ะทอง', '', '0613984482', 4, 6, 54, 1, '2025-09-04 04:40:37', '2025-10-13 03:29:07', '2025-10-13 03:29:07'),
(53, '100003', '$2y$10$FLAjY6Q2nHDUSVPqN6TIGuDidEPkqGKz0gaehMTwjoU7LcNEvCDMa', 'เกษร เจ๊ะมะ', '', '0624429188', 4, 6, 54, 1, '2025-09-04 04:43:33', '2025-10-13 02:29:14', '2025-10-13 02:29:14'),
(54, '100004', '$2y$10$uOXuTZuFrTEkA4fyy/SsaeCZZqS6q4a8xuV.QCPDGnVG7vkXvzl8i', 'ฤทัยภัทร รุ่งเรือง', '', '', 3, 6, NULL, 1, '2025-09-04 04:44:35', '2025-10-13 02:47:00', '2025-10-13 02:47:00'),
(55, '100005', '$2y$10$qkjoGeqlx6xfWu0e0CI8u.cPln1AdYcr/4PV9/RiKd.vkZfXQMmcq', 'ดาริกา อยู่สนิท', '', '0924512984', 4, 6, 56, 1, '2025-09-04 04:45:49', '2025-10-13 01:48:48', '2025-10-13 01:48:48'),
(56, '100006', '$2y$10$zCU8y7f0vEtSKEMEoAt1melD7TMdHyY9AlSYBL/6IVN6HbHsO9QXe', 'พจนีย์ ใจซื่อ', '', '0660917985', 3, 6, NULL, 1, '2025-09-04 04:47:19', '2025-10-13 03:29:25', '2025-10-13 03:29:25'),
(57, '100007', '$2y$10$/XLXr1FdZVSCuR.76MpGy.5BDLB8bsiGNvMKNwyWdRx1XawA01VSW', 'อมิตตา โสมนะวัด', '', '0991658540', 4, 6, 56, 1, '2025-09-04 04:49:04', '2025-10-13 02:04:14', '2025-10-13 02:04:14'),
(58, '100008', '$2y$10$NBtWnSj3TLDlnuIGu7QxVeNIy3QH36/PHEx0jCbKOy2vbsEUIATc2', 'พิมพ์นิภา กุลวัฒนเกียรติ', '', '0617896892', 4, 6, 56, 1, '2025-09-04 04:50:11', '2025-10-13 01:46:49', '2025-10-13 01:46:49'),
(59, 'bsalecrm619', '$2y$10$typp3sew5UQeFXUwzuCb5.pJ3dI3m2zpo9J1yP2rvAsMOIWAAucxO', 'รุ่งไพลิน อยู่เจริญ', '', '0813036263', 4, 7, NULL, 1, '2025-09-04 07:00:44', '2025-10-13 03:25:39', '2025-10-13 03:25:39'),
(60, 'fasalecrm619', '$2y$10$KcHilGtG3PjdBY5RHtqPJuk.evvm4WsPBnC8BmuN0ecFlrDHMyUZC', 'ยุวดี แต่งศรี', '', '0821020480', 4, 7, NULL, 1, '2025-09-04 07:02:22', '2025-10-13 03:32:20', '2025-10-13 03:32:20'),
(61, 'famsalecrm619', '$2y$10$cRNfzL/kt7QtsRdCZRkVWedVH7fZ.o2CpfYZf1DcRhX1uG2/EQuGm', 'รติมา พวงแก้ว', '', '0821020490', 4, 7, NULL, 1, '2025-09-04 07:03:51', '2025-10-13 03:46:21', '2025-10-13 03:46:21'),
(62, 'tai', '$2y$10$ZEuQp2Qi32W06oh9gDGzmu6bKSEiqEKsCVzhyAuuMHEO1RdAWuui2', 'ต่าย [Telesale]', 'tai@gmail.com', '626831777', 4, 1, 25, 1, '2025-09-04 07:04:38', '2025-10-13 01:50:08', '2025-10-13 01:50:08'),
(63, 'psalecrm619', '$2y$10$jY5eWgJ0doqjLj.XULP8ieSy7Gz95Vy/bxviDsRbzyeCXRtGncYpq', 'กาญจนา ฤทธิ์มหันต์', '', '0633451534', 4, 7, NULL, 1, '2025-09-04 07:05:34', '2025-10-13 03:22:31', '2025-10-13 03:22:31'),
(64, 'sry1', '$2y$10$XVkG4eQ/CP9Md5R6K52lVeLMBKinBePckK1bWJmkf9D/x0FJQG/M6', 'ปอ  Admin  Page', 'sry1@prima49.com', '-', 5, 1, NULL, 1, '2025-09-05 06:43:18', '2025-09-05 06:43:18', NULL),
(65, 'bow1', '$2y$10$5/RUA/w/q/nnXpsG.w8ACekCU.fWHbdsYmpP1sFFIXhfVYugWSMuC', 'โบว์ Admin  Page', 'bow1@prima49.com', '-', 5, 1, NULL, 1, '2025-09-05 06:43:58', '2025-09-05 06:43:58', NULL),
(66, 'may1', '$2y$10$v/wiQ.S.ZPBw8U7LCl.Ff.C5K/S9rFbDirR5ds1XNvuMy5K51BlOS', 'เมล์ Admin  Page', 'may1@gmail.com', '-', 5, 1, NULL, 1, '2025-09-05 06:44:55', '2025-09-05 06:44:55', NULL),
(67, 'yng1', '$2y$10$2ftl.SGNSaFIx4GyuA/gBu5JaA1yGtG7oK05pOuJagvrA3CBmOD0y', 'หญิง Admin  Page', 'yng1@prima49.com', '-', 5, 1, NULL, 1, '2025-09-05 06:48:12', '2025-09-05 06:48:12', NULL),
(68, 'pla1', '$2y$10$9TgpLzK7bcBjq7NrlA1.zOR33utkWhwZtJ8waGAHuv3Idp06tsj2K', 'เพลง Admin  Page', 'pla1@prima49.com', '-', 5, 1, NULL, 1, '2025-09-05 06:48:52', '2025-09-05 06:48:52', NULL),
(69, 'ice1', '$2y$10$1ZCJtpb4IOgbbR/lj5eg9evEqaBeK6/lW0V32Dy4qD47m1AVyBMGu', 'ไอซ์ Admin  Page', 'ice1@prima49.com', '-', 5, 1, NULL, 1, '2025-09-05 06:49:32', '2025-09-05 06:49:32', NULL),
(70, 'imp1', '$2y$10$bZB7WEJqtzoLZCatDExpKuyhl26Wp.z1qDzmprEUpcLgJRdm0S5tG', 'อิ๊ม Admin  Page', 'imp1@prima49.com', '-', 5, 1, NULL, 1, '2025-09-05 06:50:11', '2025-09-05 06:50:11', NULL),
(71, 'may11', '$2y$10$5DN43blqNAXuENMTLxIhjOlwJCjz3wg/BugmbRbz5.hPio4MxMs2C', 'พี่่เมย์ Admin  Page', 'may1@prima49.com', '-', 5, 1, NULL, 1, '2025-09-05 06:51:21', '2025-09-05 06:51:21', NULL),
(72, 'tuu1', '$2y$10$UJ2Z9WY6YS1lOhBXQBtkDO7vmjGokTuvqj.bEDP4767jJtEEkBcAK', 'ตู่ Admin  Page', 'test1@test.com', '-', 5, 1, NULL, 1, '2025-09-09 04:42:42', '2025-09-09 04:43:14', NULL),
(73, 'mpp1', '$2y$10$HOwwTzYq30ZuqO5iIvTenu9uaVNXMweOpjffI2VB6TTY3obtB9KL2', 'ปราย Admin page', 'test1@test.com', '-', 5, 1, NULL, 1, '2025-09-09 04:45:08', '2025-09-09 04:46:47', NULL),
(74, 'ben1', '$2y$10$VWXB78u1EpKROFMUR6MRleeQ9wyXJvXy./yyDDKOhRrHaLBH2fQT.', 'เบญ Admin page', 'test1@test.com', '-', 5, 1, NULL, 1, '2025-09-09 04:45:55', '2025-09-09 04:46:50', NULL),
(75, 'jay1', '$2y$10$Sa.pvRZ0cqKGx4iZ4tk87ekA9/aVciafcOaqyappDYWgWey1PUPnO', 'เจ Admin page', 'test1@test.com', '-', 5, 1, NULL, 1, '2025-09-09 04:46:29', '2025-09-09 04:46:58', NULL),
(76, 'aum', '$2y$10$lX.JdMHjlDxjvkLQS34u/eC1rMLf27LJgHgGsUXPjrBIkBYuO7d6K', 'อุ้ม [Admin pages]', 'aum@PASSIONPLUSS.com', '-', 5, 7, NULL, 1, '2025-09-12 03:19:55', '2025-10-02 05:14:12', NULL),
(77, 'jaa', '$2y$10$k3nmpl.f2GfiA5AqQGL5p.0cAOtuZd8rlcnfyyBC3YLnIdp4N6x6C', 'จ๋า [Admin Pages]', 'jaa@PASSIONPLUSS.com', '-', 5, 7, NULL, 1, '2025-09-12 03:21:58', '2025-10-02 05:14:16', NULL),
(78, 'AAA', '$2y$10$c8WbfJ/R2U/hBdNWkuC0je4C5bG3jMsnnnm2wlxoGsD8uIeedA1wi', 'เอ [admin pages]', 'aaa@PASSIONPLUSS.com', '-', 5, 7, NULL, 1, '2025-09-12 03:29:04', '2025-10-02 05:14:19', NULL),
(79, 'BBB', '$2y$10$8uotLMzkpAeaQ2X9nqcJPuMizWZmS4I7QsHd3UaQJ/J.A7384Ui4S', 'บี [Admin pages]', 'bbb@PASSIONPLUSS.com', '-', 5, 7, NULL, 1, '2025-09-12 03:30:29', '2025-10-02 05:14:23', NULL),
(80, 'phone', '$2y$10$3zCuIChn3gh6nxUCdiFHeuaRLYZsLksSWMfBiVtCQ3XU6T2LzZ7Nu', 'โฟน [Admin pages]', 'phone@PASSIONPLUSS.com', '-', 5, 7, NULL, 1, '2025-09-12 03:31:58', '2025-10-02 05:14:26', NULL),
(81, 'wan', '$2y$10$WDwtzA5lI9YBtyG90rFQmOXzJ2sfo.QEq1xLgWbpgsWGvc8q2PwJG', 'หวาน [admin pages]', 'wan@PASSIONPLUSS.com', '-', 5, 7, NULL, 1, '2025-09-12 03:32:50', '2025-10-02 05:14:30', NULL),
(82, 'aoy', '$2y$10$PBFtmuDyyxUohlAsNs9TaOsH/SwfvK5Tzj3f2.1zqYd.7JU5vvKZW', 'ออย [admin pages]', 'aoy@PASSIONPLUSS.com', '-', 5, 7, NULL, 1, '2025-09-12 03:34:26', '2025-10-02 05:14:33', NULL),
(83, 'Zim', '$2y$10$r3buFU.cUE4FS3FuOAddBecWQrg6EpLFmReuz9NaBdCLGN/CAyeyS', 'ซิ้ม [Telesale]', 'prima.telesale.001@gmail.com', '945551165', 4, 1, 27, 1, '2025-09-12 07:34:54', '2025-10-13 01:38:37', '2025-10-13 01:38:37'),
(84, 'aee', '$2y$10$vXklAquA6g54/VAR475FUeMiUBqAWXr0LaopuBaEA5NdZ345f76Lm', 'เอ๋ [Telesale]', 'aee@gmail.com', '-', 4, 1, 24, 1, '2025-09-13 01:31:36', '2025-10-13 01:50:18', '2025-10-13 01:50:18'),
(85, 'pie', '$2y$10$fyC.OGG/2N07DzqegVakKu5e.zUnzP4YNC7qmFXrf9ZpJDJPE0/jK', 'เปิ้ล Telesale', 'pie@gmail.com', '66945463805', 4, 1, 24, 1, '2025-09-25 09:26:27', '2025-10-13 02:00:49', '2025-10-13 02:00:49'),
(88, 'som', '$2y$10$C7XHbk6srJegbA6hl74GReSNlKOw/la.ec8JTLQA/dPeWq59itIA.', 'ส้ม [Telesale]', 'prima.telesale.003@gmail.com', '805604433', 4, 1, 26, 1, '2025-09-26 07:33:18', '2025-10-13 01:06:44', '2025-10-13 01:06:44'),
(89, 'Nook', '$2y$10$TIl9KZZmGYqEfcVb.NKggeeMV.BhYC7lWzyOKYiWamy4GZKOc7K3m', 'นุ๊ก [Telesale]', 'prima.telesale.004@gmail.com', '', 4, 1, 27, 1, '2025-09-26 07:35:51', '2025-10-13 02:00:18', '2025-10-13 02:00:18'),
(91, 'Took', '$2y$10$ZjkwVNWjlE3CTi.I7ckZwuzlX0eTv/78YL3WAm5FFcTDEq9YEM17C', 'ตุ๊กตา [Telesale]', 'prima.telesale.005@gmail.com', '', 4, 1, 27, 1, '2025-09-26 07:38:39', '2025-10-07 09:38:29', '2025-10-07 09:38:29'),
(92, 'TIKTOK', '$2y$10$Rt4mujhgbQdxfP6Z.EMcRO31WrtryHTTp8VKC3SKhr2Irt6JT0Nr.', 'TIK TOK SHOP', 'TIKTOK@Gmail.com', '', 5, 1, NULL, 1, '2025-10-02 05:11:33', '2025-10-02 05:13:13', NULL),
(93, 'Admin12', '$2y$10$nb5dp4UBx/pCj5jsfLukruqRNcoEnVm8rzUVrM6ibCKuIA37n.9k.', 'AdminPage [ไม่ทราบชื่อ]', 'Admin@prima.com', '', 4, 1, NULL, 1, '2025-10-02 08:44:25', '2025-10-02 08:44:25', NULL);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`user_id`),
  ADD UNIQUE KEY `username` (`username`),
  ADD KEY `company_id` (`company_id`),
  ADD KEY `idx_username` (`username`),
  ADD KEY `idx_role` (`role_id`),
  ADD KEY `idx_active` (`is_active`),
  ADD KEY `idx_users_username` (`username`),
  ADD KEY `idx_users_role_id` (`role_id`),
  ADD KEY `idx_supervisor_id` (`supervisor_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `user_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=94;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `users_ibfk_1` FOREIGN KEY (`role_id`) REFERENCES `roles` (`role_id`),
  ADD CONSTRAINT `users_ibfk_2` FOREIGN KEY (`company_id`) REFERENCES `companies` (`company_id`),
  ADD CONSTRAINT `users_ibfk_3` FOREIGN KEY (`supervisor_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
