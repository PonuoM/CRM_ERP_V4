-- Migration: Add COD document header table and link COD records to document/order
-- Purpose:
--  - Store per-import COD document info (document no., datetime, bank) once per batch
--  - Link each COD record to a document and an order/sub-order (box) for box-level tracking

-- 1) Create cod_documents table (if not exists)
SET @cod_documents_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'cod_documents'
);

SET @sql := IF(@cod_documents_exists = 0,
    'CREATE TABLE cod_documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        document_number VARCHAR(64) NOT NULL,
        document_datetime DATETIME NOT NULL,
        bank_account_id INT NULL,
        company_id INT NOT NULL,
        total_input_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        total_order_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        notes TEXT NULL,
        created_by INT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_cod_documents_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        CONSTRAINT fk_cod_documents_bank FOREIGN KEY (bank_account_id) REFERENCES bank_account(id) ON DELETE SET NULL,
        CONSTRAINT fk_cod_documents_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE KEY uniq_cod_document_company_number (company_id, document_number),
        KEY idx_cod_documents_company (company_id),
        KEY idx_cod_documents_datetime (document_datetime)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;',
    'SELECT ''cod_documents already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2) Add document_id column to cod_records
SET @has_document_id := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'cod_records'
      AND COLUMN_NAME = 'document_id'
);

SET @sql := IF(@has_document_id = 0,
    'ALTER TABLE cod_records
        ADD COLUMN document_id INT NULL AFTER id,
        ADD INDEX idx_cod_records_document (document_id),
        ADD CONSTRAINT fk_cod_records_document FOREIGN KEY (document_id)
            REFERENCES cod_documents(id) ON DELETE SET NULL',
    'SELECT ''cod_records.document_id already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3) Add order_id column to cod_records (box-level order from order_items/order_tracking_numbers)
SET @has_order_id := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'cod_records'
      AND COLUMN_NAME = 'order_id'
);

SET @sql := IF(@has_order_id = 0,
    'ALTER TABLE cod_records
        ADD COLUMN order_id VARCHAR(32) NULL AFTER tracking_number,
        ADD INDEX idx_cod_records_order (order_id)',
    'SELECT ''cod_records.order_id already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4) Add order_amount column to cod_records to store expected COD per box
SET @has_order_amount := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'cod_records'
      AND COLUMN_NAME = 'order_amount'
);

SET @sql := IF(@has_order_amount = 0,
    'ALTER TABLE cod_records
        ADD COLUMN order_amount DECIMAL(12,2) NULL DEFAULT 0.00 AFTER cod_amount',
    'SELECT ''cod_records.order_amount already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 5) Ensure received_amount/difference remain consistent (no-op safeguard)
UPDATE cod_records
SET difference = cod_amount - COALESCE(received_amount, 0)
WHERE difference IS NULL;

-- 6) Verify indexes for faster lookup
SET @has_idx_tracking := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'cod_records'
      AND INDEX_NAME = 'idx_tracking'
);

SET @sql := IF(@has_idx_tracking = 0,
    'CREATE INDEX idx_tracking ON cod_records(tracking_number)',
    'SELECT ''idx_tracking already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

