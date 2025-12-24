-- ============================================================
-- SQL Update Script: Stock Movement & Lot Schema Updates
-- Date: 2025-12-23
-- Description: 
-- 1. Updates stock_movements to include document_number.
-- 2. Standardizes movement_type values (Delete/Edit Document).
-- 3. Fixes product_lots unique constraint (Product + Lot).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Stock Movements: Add document_number column
-- ------------------------------------------------------------
-- Add column if it doesn't exist (MySQL 8.0+ supports IF NOT EXISTS, for older versions might fallback or ignore error)
SET @dbname = DATABASE();
SET @tablename = "stock_movements";
SET @columnname = "document_number";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_name = @tablename)
      AND (table_schema = @dbname)
      AND (column_name = @columnname)
  ) > 0,
  "SELECT 1",
  "ALTER TABLE stock_movements ADD COLUMN document_number VARCHAR(50) DEFAULT NULL AFTER product_id"
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- ------------------------------------------------------------
-- 2. Backfill Document Numbers
-- ------------------------------------------------------------
-- Sync document_number from stock_transactions
UPDATE stock_movements sm
JOIN stock_transactions st ON sm.reference_id = st.id AND sm.reference_type = 'stock_transactions'
SET sm.document_number = st.document_number
WHERE sm.document_number IS NULL;

-- ------------------------------------------------------------
-- 3. Update Movement Types for Clarity
-- ------------------------------------------------------------
-- Ensure column is VARCHAR large enough (if previously ENUM)
ALTER TABLE stock_movements MODIFY COLUMN movement_type VARCHAR(100) NOT NULL;

-- Rename 'VOID' to 'Delete Document'
UPDATE stock_movements SET movement_type = 'Delete Document' WHERE movement_type = 'VOID';

-- Rename 'UPDATE_REVERT' to 'Edit Document'
UPDATE stock_movements SET movement_type = 'Edit Document' WHERE movement_type = 'UPDATE_REVERT';

-- ------------------------------------------------------------
-- 4. Fix Product Lots Unique Constraint
-- ------------------------------------------------------------
-- Goal: Allow same Lot Number (e.g. '01-01') for DIFFERENT products.
-- Step A: Drop old strict unique index on just `lot_number` if it exists.
-- (Note: Index name might vary, assuming 'lot_number' based on strict create table defaults)
-- We use a safe procedure to drop index if exists.

SET @indexName = "lot_number"; -- Adjust if your index name is different
SET @tableName = "product_lots";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_name = @tableName)
      AND (table_schema = @dbname)
      AND (index_name = @indexName)
  ) > 0,
  "DROP INDEX lot_number ON product_lots",
  "SELECT 1"
));
PREPARE dropIndexIfExists FROM @preparedStatement;
EXECUTE dropIndexIfExists;
DEALLOCATE PREPARE dropIndexIfExists;

-- Step B: Add correct Composite Unique Index (product_id + lot_number)
SET @indexName = "idx_product_lot_unique";
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE
      (table_name = @tableName)
      AND (table_schema = @dbname)
      AND (index_name = @indexName)
  ) > 0,
  "SELECT 1",
  "CREATE UNIQUE INDEX idx_product_lot_unique ON product_lots (product_id, lot_number)"
));
PREPARE createIndexIfNotExists FROM @preparedStatement;
EXECUTE createIndexIfNotExists;
DEALLOCATE PREPARE createIndexIfNotExists;

-- Done
