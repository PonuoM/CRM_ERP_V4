-- ออเดอร์รอเปิด (ขายได้ผ่านมือถือ → มาเปิดที่บริษัท)
-- ผูกกับฟังก์ชันปิดเบอร์: เมนู/ช่องกรอกจะโผล่เฉพาะตอน phone_masking เปิด
-- additive ล้วน ไม่แตะข้อมูลเดิม

CREATE TABLE IF NOT EXISTS pending_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  agent_user_id INT NOT NULL,
  company_id INT NULL,
  call_history_id INT NULL,
  note VARCHAR(500) NULL,
  status ENUM('pending','opened','cancelled') NOT NULL DEFAULT 'pending',
  order_id INT NULL,                               -- ออเดอร์จริงที่เปิดจาก draft นี้ (ตอนกดเปิดบน PC)
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  opened_at DATETIME NULL,
  opened_by INT NULL,
  KEY idx_status_company (status, company_id),
  KEY idx_customer (customer_id),
  KEY idx_agent (agent_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS pending_order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pending_order_id INT NOT NULL,
  product_id INT NULL,
  product_name VARCHAR(255) NOT NULL,
  qty DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit VARCHAR(32) NULL,
  KEY idx_po (pending_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
