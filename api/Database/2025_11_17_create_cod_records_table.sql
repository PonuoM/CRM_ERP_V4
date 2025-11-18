-- Migration: Create cod_records table for COD payment tracking
-- Date: 2025-11-15

SET @dbname = DATABASE();
SET @tablename = 'cod_records';

-- Check if table exists
SET @tableExists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
  WHERE table_schema = @dbname AND table_name = @tablename);

SET @preparedStatement = (SELECT IF(
  @tableExists > 0,
  'SELECT 1',
  CONCAT('CREATE TABLE IF NOT EXISTS ', @tablename, ' (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tracking_number VARCHAR(128) NOT NULL,
    delivery_start_date DATE NULL,
    delivery_end_date DATE NULL,
    cod_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    received_amount DECIMAL(12,2) NULL DEFAULT 0,
    difference DECIMAL(12,2) NULL DEFAULT 0,
    status ENUM(\'pending\',\'received\',\'partial\',\'missing\') NULL DEFAULT \'pending\',
    company_id INT NOT NULL,
    created_by INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tracking (tracking_number),
    INDEX idx_company (company_id),
    INDEX idx_status (status),
    CONSTRAINT fk_cod_records_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    CONSTRAINT fk_cod_records_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4')
));
PREPARE createIfNotExists FROM @preparedStatement;
EXECUTE createIfNotExists;
DEALLOCATE PREPARE createIfNotExists;

