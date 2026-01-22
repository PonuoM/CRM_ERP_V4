CREATE TABLE `order_returns` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sub_order_id` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'รหัสคำสั่งซื้อย่อย (Main Key)',
  `status` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'returned' COMMENT 'สถานะ: returned, returning, delivered, delivering',
  `note` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sub_order_id` (`sub_order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
