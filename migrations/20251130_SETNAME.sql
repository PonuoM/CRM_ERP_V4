-- Migration: Standardize all collations to utf8mb4_unicode_ci
-- Date: 2025-11-30
-- Goal: eliminate "Illegal mix of collations" errors by forcing every table
--       and string column in the current database to use one collation.
-- Target collation: utf8mb4_unicode_ci
-- How to run:
--   mysql -u <user> -p <db_name> < migrations/20251130_SETNAME.sql
--
-- Notes:
-- - This script converts every BASE TABLE in the selected database.
-- - DDL causes implicit commits; run during maintenance windows.
-- - FOREIGN_KEY_CHECKS is disabled during conversion to avoid dependency order issues.

SET @target_charset := 'utf8mb4';
SET @target_collation := 'utf8mb4_unicode_ci';
SET @db_name := DATABASE();

-- Safety: show which database will be altered
SELECT @db_name AS target_database;

-- Disable FK checks (preserve previous setting)
SET @old_foreign_key_checks := @@FOREIGN_KEY_CHECKS;
SET FOREIGN_KEY_CHECKS = 0;

-- Align database default
SET @sql := CONCAT(
  'ALTER DATABASE `',
  @db_name,
  '` CHARACTER SET ',
  @target_charset,
  ' COLLATE ',
  @target_collation
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Convert every table to the target collation/charset
DELIMITER $$
BEGIN
  DECLARE done INT DEFAULT 0;
  DECLARE tbl VARCHAR(255);

  DECLARE cur CURSOR FOR
    SELECT TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = @db_name
      AND TABLE_TYPE = 'BASE TABLE';

  DECLARE CONTINUE HANDLER FOR NOT FOUND SET done = 1;

  OPEN cur;
  read_loop: LOOP
    FETCH cur INTO tbl;
    IF done THEN
      LEAVE read_loop;
    END IF;

    SET @sql := CONCAT(
      'ALTER TABLE `',
      tbl,
      '` CONVERT TO CHARACTER SET ',
      @target_charset,
      ' COLLATE ',
      @target_collation
    );
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END LOOP;
  CLOSE cur;
END$$
DELIMITER ;

-- Restore FK checks
SET FOREIGN_KEY_CHECKS = @old_foreign_key_checks;

-- Verification: tables/columns that are still NOT using the target collation
SELECT
  TABLE_NAME,
  TABLE_COLLATION
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = @db_name
  AND TABLE_TYPE = 'BASE TABLE'
  AND TABLE_COLLATION <> @target_collation;

SELECT
  TABLE_NAME,
  COLUMN_NAME,
  COLLATION_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = @db_name
  AND COLLATION_NAME IS NOT NULL
  AND COLLATION_NAME <> @target_collation;
