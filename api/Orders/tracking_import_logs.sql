-- tracking_import_logs: เก็บ log ข้อมูลที่ผู้ใช้ import tracking number
-- เพื่อใช้ตรวจสอบกรณีข้อมูลหาย
CREATE TABLE IF NOT EXISTS tracking_import_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_id VARCHAR(36) NOT NULL COMMENT 'UUID ระบุรอบ import เดียวกัน',
  user_id INT NULL,
  username VARCHAR(100) NULL,
  company_id INT NULL,
  order_id VARCHAR(100) NOT NULL COMMENT 'Order ID ตามที่ผู้ใช้กรอก (raw)',
  resolved_order_id VARCHAR(100) NULL COMMENT 'Order ID ที่ระบบ resolve ได้หลัง validate',
  tracking_number VARCHAR(100) NOT NULL,
  box_number INT DEFAULT 1,
  action VARCHAR(20) DEFAULT 'import' COMMENT 'import | validate',
  status VARCHAR(20) DEFAULT 'success' COMMENT 'success | error | duplicate',
  message TEXT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_batch_id (batch_id),
  INDEX idx_order_id (order_id),
  INDEX idx_tracking_number (tracking_number),
  INDEX idx_user_id (user_id),
  INDEX idx_company_id (company_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
