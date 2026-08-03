-- 074: Point-in-time snapshot of customer ownership (assigned_to x basket)
--
-- Why: reports such as "แคมเปญรายคน" (Telesale Campaign Compare) show a
-- "ลูกค้าที่ดูแล" column that was read live from `customers`, so it always
-- reflected TODAY — after the month-end reclaim cron (`monthly_cron`, runs
-- 01:00 on day 1) has already stripped ownership. This table stores the
-- aggregated count per (date, company, agent, basket) so a report can show
-- the number as it stood at the END of each month, before the reclaim.
--
-- Grain: one row per (snapshot_date, company_id, agent_id, basket_key).
-- Size:  ~460 rows/day across all companies (~170K rows/year) — tiny.
--
-- `basket_key` is stored NOT NULL ('' when the customer has no basket) so the
-- UNIQUE key actually de-duplicates (MySQL treats NULLs as distinct in a
-- unique index, which would let duplicates through).

CREATE TABLE IF NOT EXISTS `customer_ownership_snapshots` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `snapshot_date` DATE NOT NULL COMMENT 'วันที่ที่ค่านี้แทน (สิ้นเดือน = วันสุดท้ายของเดือน)',
  `company_id` INT NOT NULL,
  `agent_id` INT NOT NULL COMMENT 'customers.assigned_to',
  `basket_key` VARCHAR(50) NOT NULL DEFAULT '' COMMENT 'basket_config.id เป็น string, "" = ไม่มีถัง',
  `owned_count` INT NOT NULL DEFAULT 0,
  `is_month_end` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = แถวนี้คือยอดสิ้นเดือน (ก่อนดึงกลับ)',
  `captured_at` DATETIME NOT NULL COMMENT 'เวลาจริงที่ state นี้แทน (backfill = ก่อน cron ดึงกลับ)',
  `source` VARCHAR(16) NOT NULL DEFAULT 'cron' COMMENT 'cron | backfill | manual',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_snapshot` (`snapshot_date`, `company_id`, `agent_id`, `basket_key`),
  KEY `idx_month_end` (`company_id`, `is_month_end`, `snapshot_date`),
  KEY `idx_agent_date` (`agent_id`, `snapshot_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ยอดลูกค้าที่ดูแล ณ จุดเวลา (รายวัน + สิ้นเดือน)';
