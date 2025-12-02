-- Add bank metadata to statement logs for per-bank imports and duplicate detection
SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'statement_logs'
    AND COLUMN_NAME = 'bank_account_id'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE statement_logs ADD COLUMN bank_account_id INT NULL AFTER amount;',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'statement_logs'
    AND COLUMN_NAME = 'bank_display_name'
);
SET @sql := IF(
  @col_exists = 0,
  'ALTER TABLE statement_logs ADD COLUMN bank_display_name VARCHAR(150) NULL AFTER bank_account_id;',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Index on bank/date for faster duplicate checks
SET @idx_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'statement_logs'
    AND INDEX_NAME = 'idx_statement_logs_bank_date'
);
SET @sql := IF(
  @idx_exists = 0,
  'CREATE INDEX idx_statement_logs_bank_date ON statement_logs (bank_account_id, transfer_at);',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Foreign key to bank_account (nullable to preserve legacy rows)
SET @fk_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'statement_logs'
    AND CONSTRAINT_NAME = 'fk_statement_logs_bank_account'
);
SET @sql := IF(
  @fk_exists = 0,
  'ALTER TABLE statement_logs ADD CONSTRAINT fk_statement_logs_bank_account FOREIGN KEY (bank_account_id) REFERENCES bank_account(id) ON DELETE SET NULL ON UPDATE NO ACTION;',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
