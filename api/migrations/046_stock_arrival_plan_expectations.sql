-- 044: Split stock_arrival_plan_items status into stock_arrival_plan_expectations
-- ให้ 1 SKU แตกเป็นหลายวันที่คาดว่าจะเข้าได้ (เช่น แพลน 500 แต่คาดว่าเข้าจริง 2 งวด 250+250 คนละวัน)
-- item = ยอดรวมที่แพลนไว้ต่อ SKU (คงที่ แก้ไม่ได้หลังสร้าง)
-- expectation = ตารางวันที่คาดว่าจะเข้าจริงของ item นั้น (แตกย่อยได้ และเปลี่ยนสถานะเมื่อยืนยันรับเข้า)

CREATE TABLE `stock_arrival_plan_expectations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `item_id` int(11) NOT NULL,
  `expected_qty` int(11) NOT NULL,
  `expected_date` date NOT NULL,
  `status` enum('expected','confirmed','closed_short') NOT NULL DEFAULT 'expected',
  `actual_qty` int(11) DEFAULT NULL,
  `actual_date` date DEFAULT NULL,
  `note` text DEFAULT NULL,
  `next_expectation_id` int(11) DEFAULT NULL,
  `confirmed_by` int(11) DEFAULT NULL,
  `confirmed_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_sape_item` (`item_id`),
  KEY `idx_sape_status` (`status`),
  KEY `idx_sape_dates` (`expected_date`,`actual_date`),
  CONSTRAINT `fk_sape_item` FOREIGN KEY (`item_id`) REFERENCES `stock_arrival_plan_items` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT `fk_sape_next` FOREIGN KEY (`next_expectation_id`) REFERENCES `stock_arrival_plan_expectations` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Backfill: one expectation per existing item, carrying over its current status/actual data
INSERT INTO stock_arrival_plan_expectations
  (item_id, expected_qty, expected_date, status, actual_qty, actual_date, note, confirmed_by, confirmed_at, created_at, updated_at)
SELECT
  i.id,
  i.planned_qty,
  p.planned_date,
  CASE
    WHEN i.status IN ('matched','excess','rescheduled') THEN 'confirmed'
    WHEN i.status = 'closed_short' THEN 'closed_short'
    ELSE 'expected'
  END,
  i.actual_qty,
  CASE WHEN i.status IN ('matched','excess','closed_short','rescheduled') THEN COALESCE(DATE(i.closed_at), p.planned_date) ELSE NULL END,
  i.resolution_note,
  i.closed_by,
  i.closed_at,
  i.created_at,
  i.updated_at
FROM stock_arrival_plan_items i
JOIN stock_arrival_plans p ON i.plan_id = p.id;

-- Old per-item status tracking now lives on expectations
ALTER TABLE stock_arrival_plan_items
  DROP FOREIGN KEY fk_stock_arrival_plan_items_reschedule,
  DROP COLUMN status,
  DROP COLUMN actual_qty,
  DROP COLUMN resolution_note,
  DROP COLUMN rescheduled_to_item_id,
  DROP COLUMN closed_by,
  DROP COLUMN closed_at;
