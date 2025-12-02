-- Statement reconciliation tables for Finance Approval
CREATE TABLE IF NOT EXISTS statement_reconcile_batches (
  id INT NOT NULL AUTO_INCREMENT,
  document_no VARCHAR(120) NOT NULL,
  bank_account_id INT NULL,
  bank_display_name VARCHAR(150) NULL,
  company_id INT NOT NULL,
  start_date DATETIME NULL,
  end_date DATETIME NULL,
  created_by INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes TEXT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_statement_reconcile_document (document_no),
  KEY idx_statement_reconcile_company_created (company_id, created_at),
  KEY idx_statement_reconcile_bank (bank_account_id),
  CONSTRAINT fk_statement_reconcile_bank FOREIGN KEY (bank_account_id) REFERENCES bank_account(id) ON DELETE SET NULL ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS statement_reconcile_logs (
  id INT NOT NULL AUTO_INCREMENT,
  batch_id INT NOT NULL,
  statement_log_id INT NOT NULL,
  order_id VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  statement_amount DECIMAL(12,2) NOT NULL,
  confirmed_amount DECIMAL(12,2) DEFAULT NULL,
  auto_matched TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_statement_log (statement_log_id),
  KEY idx_statement_reconcile_order (order_id),
  KEY idx_statement_reconcile_batch (batch_id),
  KEY idx_statement_reconcile_order_statement (order_id, statement_log_id),
  CONSTRAINT fk_statement_reconcile_batch FOREIGN KEY (batch_id) REFERENCES statement_reconcile_batches(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT fk_statement_reconcile_statement FOREIGN KEY (statement_log_id) REFERENCES statement_logs(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT fk_statement_reconcile_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
