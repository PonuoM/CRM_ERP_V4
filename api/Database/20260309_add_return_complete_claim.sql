-- Migration: 20260309_add_return_complete_claim.sql
-- Description: เพิ่ม return_complete และ return_claim สำหรับระบบจบเคส/เคลมตีกลับ

ALTER TABLE `order_boxes`
  ADD COLUMN `return_complete` TINYINT(1) DEFAULT 0 COMMENT 'จบเคสแล้ว (1 = จบเคส, 0 = ยังไม่จบ)',
  ADD COLUMN `return_claim` DECIMAL(10,2) DEFAULT NULL COMMENT 'จำนวนเงินเคลม (กรณีเสียหาย/สูญหาย)';
