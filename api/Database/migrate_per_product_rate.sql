-- ========================================
-- Per-Product Rate Migration
-- เพิ่ม sales_per_quota ใน quota_rate_scope
-- ทำให้ 1 rate กำหนด rate ต่อ product ได้
-- ========================================

-- Idempotent: จะไม่ error ถ้ารันซ้ำ
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'quota_rate_scope'
    AND COLUMN_NAME = 'sales_per_quota'
);

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE quota_rate_scope ADD COLUMN sales_per_quota DECIMAL(12,2) DEFAULT NULL COMMENT ''ยอดขาย/โควตาเฉพาะสินค้านี้ (NULL = ใช้ค่าจาก rate schedule)''',
  'SELECT ''Column already exists'' AS result'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
