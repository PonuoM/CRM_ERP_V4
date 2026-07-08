-- 043: Stock Arrival Planning (แพลนรับสินค้า)
-- แพลนว่าสินค้ารุ่นไหนเข้าวันไหน + reconcile ของจริงเทียบกับแพลน
-- สถานะรายการ: planned -> matched/excess (auto-close) หรือ partial -> เลื่อน(rescheduled, สร้างรายการใหม่) / ปิดไม่ครบ(closed_short)

CREATE TABLE `stock_arrival_plans` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `company_id` int(11) DEFAULT NULL,
  `planned_date` date NOT NULL,
  `notes` text DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_stock_arrival_plans_company_date` (`company_id`,`planned_date`),
  CONSTRAINT `fk_stock_arrival_plans_company` FOREIGN KEY (`company_id`) REFERENCES `companies` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `stock_arrival_plan_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `plan_id` int(11) NOT NULL,
  `product_id` int(11) NOT NULL,
  `planned_qty` int(11) NOT NULL,
  `actual_qty` int(11) DEFAULT NULL,
  `status` enum('planned','matched','excess','partial','rescheduled','closed_short') NOT NULL DEFAULT 'planned',
  `resolution_note` text DEFAULT NULL,
  `rescheduled_to_item_id` int(11) DEFAULT NULL,
  `closed_by` int(11) DEFAULT NULL,
  `closed_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_stock_arrival_plan_items_plan` (`plan_id`),
  KEY `idx_stock_arrival_plan_items_product` (`product_id`),
  KEY `idx_stock_arrival_plan_items_status` (`status`),
  CONSTRAINT `fk_stock_arrival_plan_items_plan` FOREIGN KEY (`plan_id`) REFERENCES `stock_arrival_plans` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_stock_arrival_plan_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_stock_arrival_plan_items_reschedule` FOREIGN KEY (`rescheduled_to_item_id`) REFERENCES `stock_arrival_plan_items` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
