-- =============================================
-- Migration: Add Acknowledgement to Order Cancellations
-- Date: 2026-06-03
-- Description: เพิ่มระบบ "รับทราบ" (Acknowledge) ให้กับ Supervisor สำหรับออเดอร์ที่ถูกยกเลิก
-- =============================================

ALTER TABLE order_cancellations
ADD COLUMN is_acknowledged TINYINT(1) NOT NULL DEFAULT 0,
ADD COLUMN acknowledged_by INT NULL,
ADD COLUMN acknowledged_at TIMESTAMP NULL;

ALTER TABLE order_cancellations
ADD CONSTRAINT fk_oc_ack_user FOREIGN KEY (acknowledged_by) REFERENCES users(id);
