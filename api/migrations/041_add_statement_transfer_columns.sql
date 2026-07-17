-- 042: Statement cross-company transfer (โอนสิทธิ์ statement ให้บริษัทอื่น)
-- statement ownership เดิม = statement_batchs.company_id (ผ่าน batch_id)
-- assigned_company_id = NULL  → ยังเป็นของบริษัทที่อัพโหลด (พฤติกรรมเดิมทุกอย่าง)
-- assigned_company_id = X     → สิทธิ์ผูก/ยืนยันย้ายไปบริษัท X, ต้นทางเห็นแบบ read-only

ALTER TABLE statement_logs
  ADD COLUMN assigned_company_id INT NULL DEFAULT NULL AFTER bank_display_name,
  ADD COLUMN assigned_by INT NULL DEFAULT NULL AFTER assigned_company_id,
  ADD COLUMN assigned_at DATETIME NULL DEFAULT NULL AFTER assigned_by,
  ADD COLUMN assign_note VARCHAR(255) NULL DEFAULT NULL AFTER assigned_at;

ALTER TABLE statement_logs
  ADD INDEX idx_statement_logs_assigned_company (assigned_company_id, transfer_at);
