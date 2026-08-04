-- 075: Per-customer month-end basket/owner snapshot
--
-- Companion to 074. Where `customer_ownership_snapshots` stores the AGGREGATE
-- ("agent X owned N customers in basket B on date D"), this stores the per-customer
-- detail for MONTH-END dates only — because a report needs to bucket a customer's
-- CALLS into the basket they were in during that month, not the basket they happen
-- to sit in today.
--
-- Without it, Telesale Campaign Compare grouped "ลูกค้าที่ดูแล" by month-end basket
-- but "ชื่อที่โทร" by today's basket, so one segment could show 19 owned against
-- 100 called. Re-bucketed on the same basis those become 19 owned / 15 called.
--
-- Grain: one row per (snapshot_date, customer_id). MONTH-END dates only —
-- daily per-customer rows would be ~234K/day, which is not worth storing.
-- Size: ~234K rows per month-end (~15 MB/month, ~100 MB for the Feb–Jul backfill).
--
-- Composite PK instead of a surrogate id: the table is written in bulk and only ever
-- read by (date, company) or joined by customer_id, so an AUTO_INCREMENT would be
-- pure overhead on 1.5M+ rows.

CREATE TABLE IF NOT EXISTS `customer_basket_snapshots` (
  `snapshot_date` DATE NOT NULL COMMENT 'วันสุดท้ายของเดือนที่ค่านี้แทน',
  `customer_id` INT NOT NULL COMMENT 'customers.customer_id',
  `company_id` INT NOT NULL,
  `agent_id` INT DEFAULT NULL COMMENT 'เจ้าของ ณ ตอนนั้น (NULL = ไม่มีเจ้าของ)',
  `basket_key` VARCHAR(50) NOT NULL DEFAULT '' COMMENT 'basket_config.id เป็น string, "" = ไม่มีถัง',
  PRIMARY KEY (`snapshot_date`, `customer_id`),
  KEY `idx_company_date` (`company_id`, `snapshot_date`),
  KEY `idx_date_agent` (`snapshot_date`, `agent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ถัง/เจ้าของของลูกค้าแต่ละราย, เก็บเฉพาะสิ้นเดือน';
