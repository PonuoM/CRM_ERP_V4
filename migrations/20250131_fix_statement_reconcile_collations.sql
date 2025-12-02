-- Migration: Fix Statement Reconcile Tables Collation
-- Date: 2025-01-31
-- Description: 
--   Fix collation mismatch between statement_reconcile tables and related tables
--   to prevent "Illegal mix of collations" error (1267)
--
-- Issues Fixed:
--   1. statement_reconcile_batches.bank_display_name must match bank_account.bank collation
--   2. statement_reconcile_logs.order_id must match orders.id collation
--
-- IMPORTANT: Backup your database before running this migration!

START TRANSACTION;

-- ============================================================================
-- Step 1: Detect and align bank_display_name collation
-- ============================================================================

-- Get current collation of bank_account.bank (should be utf8mb4_unicode_ci)
SET @bank_collation := (
  SELECT COLLATION_NAME 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'bank_account' 
    AND COLUMN_NAME = 'bank'
  LIMIT 1
);

-- If bank_account doesn't exist or has no collation, use utf8mb4_unicode_ci as default
SET @bank_collation := IFNULL(@bank_collation, 'utf8mb4_unicode_ci');

-- Drop foreign key constraint if exists before modifying column
SET @fk_exists := (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
  WHERE CONSTRAINT_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'statement_reconcile_logs' 
    AND CONSTRAINT_NAME = 'fk_statement_reconcile_order'
);

SET @sql := IF(@fk_exists > 0,
  'ALTER TABLE statement_reconcile_logs DROP FOREIGN KEY fk_statement_reconcile_order',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Align bank_display_name collation with bank_account
SET @sql := CONCAT(
  'ALTER TABLE statement_reconcile_batches ',
  'MODIFY bank_display_name VARCHAR(150) ',
  'CHARACTER SET utf8mb4 ',
  'COLLATE ', @bank_collation, ' NULL'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- Step 2: Detect and align order_id collation
-- ============================================================================

-- Get current collation of orders.id (should be utf8mb4_0900_ai_ci)
SET @orders_collation := (
  SELECT COLLATION_NAME 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'orders' 
    AND COLUMN_NAME = 'id'
  LIMIT 1
);

-- If orders doesn't exist or has no collation, use utf8mb4_0900_ai_ci as default
SET @orders_collation := IFNULL(@orders_collation, 'utf8mb4_0900_ai_ci');

-- Align order_id collation with orders.id
SET @sql := CONCAT(
  'ALTER TABLE statement_reconcile_logs ',
  'MODIFY order_id VARCHAR(32) ',
  'CHARACTER SET utf8mb4 ',
  'COLLATE ', @orders_collation, ' NOT NULL'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- Step 3: Recreate foreign key constraint with correct collation
-- ============================================================================

-- Recreate foreign key constraint
SET @sql := CONCAT(
  'ALTER TABLE statement_reconcile_logs ',
  'ADD CONSTRAINT fk_statement_reconcile_order ',
  'FOREIGN KEY (order_id) ',
  'REFERENCES orders(id) ',
  'ON DELETE CASCADE ',
  'ON UPDATE NO ACTION'
);

-- Check if constraint already exists
SET @fk_exists := (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
  WHERE CONSTRAINT_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'statement_reconcile_logs' 
    AND CONSTRAINT_NAME = 'fk_statement_reconcile_order'
);

SET @sql := IF(@fk_exists = 0, @sql, 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- Step 4: Verify collations are aligned
-- ============================================================================

-- Show collation alignment status
SELECT 
  'bank_display_name collation check' AS check_type,
  TABLE_NAME,
  COLUMN_NAME,
  COLLATION_NAME AS current_collation,
  CASE 
    WHEN TABLE_NAME = 'bank_account' AND COLUMN_NAME = 'bank' THEN 'SOURCE'
    WHEN TABLE_NAME = 'statement_reconcile_batches' AND COLUMN_NAME = 'bank_display_name' THEN 'TARGET'
  END AS role
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND (
    (TABLE_NAME = 'bank_account' AND COLUMN_NAME = 'bank')
    OR (TABLE_NAME = 'statement_reconcile_batches' AND COLUMN_NAME = 'bank_display_name')
  )
ORDER BY role DESC, TABLE_NAME;

SELECT 
  'order_id collation check' AS check_type,
  TABLE_NAME,
  COLUMN_NAME,
  COLLATION_NAME AS current_collation,
  CASE 
    WHEN TABLE_NAME = 'orders' AND COLUMN_NAME = 'id' THEN 'SOURCE'
    WHEN TABLE_NAME = 'statement_reconcile_logs' AND COLUMN_NAME = 'order_id' THEN 'TARGET'
  END AS role
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND (
    (TABLE_NAME = 'orders' AND COLUMN_NAME = 'id')
    OR (TABLE_NAME = 'statement_reconcile_logs' AND COLUMN_NAME = 'order_id')
  )
ORDER BY role DESC, TABLE_NAME;

COMMIT;

-- ============================================================================
-- Verification Query (Run separately to check results)
-- ============================================================================
-- 
-- Run this query to verify collations are aligned:
--
-- SELECT 
--   'Collation Alignment Check' AS check_name,
--   CASE 
--     WHEN 
--       (SELECT COLLATION_NAME FROM INFORMATION_SCHEMA.COLUMNS 
--        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bank_account' AND COLUMN_NAME = 'bank') =
--       (SELECT COLLATION_NAME FROM INFORMATION_SCHEMA.COLUMNS 
--        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'statement_reconcile_batches' AND COLUMN_NAME = 'bank_display_name')
--     THEN '✅ ALIGNED'
--     ELSE '❌ MISMATCH'
--   END AS bank_display_name_status,
--   CASE 
--     WHEN 
--       (SELECT COLLATION_NAME FROM INFORMATION_SCHEMA.COLUMNS 
--        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'id') =
--       (SELECT COLLATION_NAME FROM INFORMATION_SCHEMA.COLUMNS 
--        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'statement_reconcile_logs' AND COLUMN_NAME = 'order_id')
--     THEN '✅ ALIGNED'
--     ELSE '❌ MISMATCH'
--   END AS order_id_status;
--

