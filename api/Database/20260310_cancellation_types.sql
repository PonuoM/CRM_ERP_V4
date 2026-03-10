-- =============================================
-- Migration: Cancellation Types System
-- Date: 2026-03-10
-- Description: สร้างตารางสำหรับระบบจัดประเภทการยกเลิก
-- =============================================

-- 1. ตาราง master สำหรับ dropdown ประเภทการยกเลิก
CREATE TABLE IF NOT EXISTS cancellation_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  label VARCHAR(100) NOT NULL,
  description TEXT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed ข้อมูลเริ่มต้น
INSERT INTO cancellation_types (label, description, sort_order) VALUES
('ยกเลิกก่อนเข้าระบบ', 'ลูกค้าสั่งใหม่ ยกเลิกออเดอร์เก่า (มีออเดอร์ทดแทนจาก creator เดียวกัน)', 1),
('ยกเลิกหลังเข้าระบบ', 'ยกเลิกออเดอร์หลังเข้าระบบแล้ว ไม่มีออเดอร์ทดแทน', 2),
('ลูกค้าปฏิเสธการรับสินค้า', 'ลูกค้าปฏิเสธไม่รับสินค้าหลังจัดส่ง', 3);

-- 2. ตาราง mapping: order → cancellation type  
CREATE TABLE IF NOT EXISTS order_cancellations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(32) NOT NULL,
  cancellation_type_id INT NOT NULL,
  notes TEXT NULL,
  classified_by INT NULL,
  classified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_order (order_id),
  INDEX idx_ctype (cancellation_type_id),
  CONSTRAINT fk_oc_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_oc_ctype FOREIGN KEY (cancellation_type_id) REFERENCES cancellation_types(id),
  CONSTRAINT fk_oc_user FOREIGN KEY (classified_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
