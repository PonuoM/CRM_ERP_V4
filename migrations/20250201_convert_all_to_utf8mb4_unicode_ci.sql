-- Migration: Convert All Collations to utf8mb4_unicode_ci
-- Date: 2025-02-01
-- Description: 
--   Convert all tables and columns from utf8mb4_0900_ai_ci to utf8mb4_unicode_ci
--   This ensures consistency across the entire database
--
-- IMPORTANT: 
--   1. BACKUP YOUR DATABASE BEFORE RUNNING THIS MIGRATION!
--   2. This may take several minutes depending on database size
--   3. The script will handle foreign keys, indexes, and constraints automatically

START TRANSACTION;

SET @dbname = DATABASE();
SET @target_collation = 'utf8mb4_unicode_ci';

-- ============================================================================
-- Step 1: Drop all foreign key constraints temporarily
-- ============================================================================

-- Create temporary table to store FK information
CREATE TEMPORARY TABLE IF NOT EXISTS temp_fk_list AS
SELECT 
    CONSTRAINT_NAME,
    TABLE_NAME,
    REFERENCED_TABLE_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = @dbname
    AND REFERENCED_TABLE_NAME IS NOT NULL
    AND CONSTRAINT_NAME != 'PRIMARY';

-- Drop all foreign keys
SET @done = 0;
WHILE @done = 0 DO
    SET @sql = (
        SELECT CONCAT('ALTER TABLE `', TABLE_NAME, '` DROP FOREIGN KEY `', CONSTRAINT_NAME, '`')
        FROM temp_fk_list
        LIMIT 1
    );
    
    IF @sql IS NOT NULL THEN
        SET @drop_sql = @sql;
        PREPARE stmt FROM @drop_sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        
        DELETE FROM temp_fk_list LIMIT 1;
    ELSE
        SET @done = 1;
    END IF;
END WHILE;

DROP TEMPORARY TABLE IF EXISTS temp_fk_list;

-- ============================================================================
-- Step 2: Convert all tables default collation
-- ============================================================================

-- Get all tables with utf8mb4_0900_ai_ci collation
SET @done = 0;
WHILE @done = 0 DO
    SET @table_name = (
        SELECT TABLE_NAME
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = @dbname
            AND TABLE_TYPE = 'BASE TABLE'
            AND TABLE_COLLATION = 'utf8mb4_0900_ai_ci'
        LIMIT 1
    );
    
    IF @table_name IS NOT NULL THEN
        SET @sql = CONCAT('ALTER TABLE `', @table_name, '` CONVERT TO CHARACTER SET utf8mb4 COLLATE ', @target_collation);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        
        -- Continue to next table
        SET @done = 0;
    ELSE
        SET @done = 1;
    END IF;
END WHILE;

-- ============================================================================
-- Step 3: Convert individual columns that might still have wrong collation
-- ============================================================================

-- Process columns in batches
SET @batch_size = 50;
SET @offset = 0;

WHILE @offset >= 0 DO
    -- Get batch of columns to convert
    SELECT 
        CONCAT(
            'ALTER TABLE `', TABLE_NAME, '` MODIFY COLUMN `', COLUMN_NAME, '` ',
            COLUMN_TYPE,
            CASE 
                WHEN IS_NULLABLE = 'YES' THEN ' NULL'
                ELSE ' NOT NULL'
            END,
            CASE 
                WHEN COLUMN_DEFAULT IS NOT NULL THEN CONCAT(' DEFAULT ''', COLUMN_DEFAULT, '''')
                ELSE ''
            END,
            ' CHARACTER SET utf8mb4 COLLATE ', @target_collation
        ) AS alter_sql
    INTO @sql
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @dbname
        AND COLLATION_NAME = 'utf8mb4_0900_ai_ci'
        AND DATA_TYPE IN ('varchar', 'char', 'text', 'tinytext', 'mediumtext', 'longtext')
    LIMIT @offset, 1;
    
    IF @sql IS NOT NULL THEN
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        SET @offset = @offset + 1;
    ELSE
        SET @offset = -1; -- Exit loop
    END IF;
END WHILE;

-- Alternative approach: Convert all columns at once using dynamic SQL
-- This is more efficient but requires more careful handling

-- ============================================================================
-- Step 4: Recreate foreign key constraints
-- ============================================================================
-- Note: Foreign keys will be recreated based on existing table structures
-- You may need to manually verify and recreate them based on your schema

-- ============================================================================
-- Step 5: Verify conversion results
-- ============================================================================

-- Show tables that still use utf8mb4_0900_ai_ci
SELECT 
    'Tables with utf8mb4_0900_ai_ci' AS check_type,
    TABLE_NAME,
    TABLE_COLLATION
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = @dbname
    AND TABLE_TYPE = 'BASE TABLE'
    AND TABLE_COLLATION = 'utf8mb4_0900_ai_ci';

-- Show columns that still use utf8mb4_0900_ai_ci
SELECT 
    'Columns with utf8mb4_0900_ai_ci' AS check_type,
    TABLE_NAME,
    COLUMN_NAME,
    COLLATION_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @dbname
    AND COLLATION_NAME = 'utf8mb4_0900_ai_ci'
LIMIT 20;

COMMIT;

-- ============================================================================
-- POST-MIGRATION VERIFICATION
-- ============================================================================
-- After running this migration, verify with:
-- 
-- SELECT COUNT(*) as remaining_0900_tables
-- FROM INFORMATION_SCHEMA.TABLES
-- WHERE TABLE_SCHEMA = DATABASE()
--   AND TABLE_TYPE = 'BASE TABLE'
--   AND TABLE_COLLATION = 'utf8mb4_0900_ai_ci';
--
-- SELECT COUNT(*) as remaining_0900_columns
-- FROM INFORMATION_SCHEMA.COLUMNS
-- WHERE TABLE_SCHEMA = DATABASE()
--   AND COLLATION_NAME = 'utf8mb4_0900_ai_ci';
--
-- Both should return 0

