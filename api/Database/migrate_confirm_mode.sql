-- ========================================
-- Migration: Confirm Mode (กำหนดเอง)
-- Date: 2026-03-16
-- Base commit: ce1d040ae51c3b6d4ed541b5dcd63297c3b7ff81
-- ========================================

-- 1. quota_rate_schedules: เพิ่ม confirm mode + fields ใหม่
ALTER TABLE quota_rate_schedules
  MODIFY COLUMN quota_mode ENUM('reset','cumulative','confirm') DEFAULT 'reset' COMMENT 'reset=รีเซ็ตตามรอบ, cumulative=สะสม, confirm=กำหนดเอง',
  ADD COLUMN calc_period_start DATE DEFAULT NULL COMMENT 'ช่วงออเดอร์เริ่มต้น (confirm mode)' AFTER reset_anchor_date,
  ADD COLUMN calc_period_end DATE DEFAULT NULL COMMENT 'ช่วงออเดอร์สิ้นสุด (confirm mode)' AFTER calc_period_start,
  ADD COLUMN usage_start_date DATE DEFAULT NULL COMMENT 'โควตาเริ่มใช้ได้เมื่อไหร่ (confirm mode)' AFTER calc_period_end,
  ADD COLUMN usage_end_date DATE DEFAULT NULL COMMENT 'วันหมดอายุโควตา (confirm mode)' AFTER usage_start_date,
  ADD COLUMN require_confirm TINYINT NOT NULL DEFAULT 1 COMMENT '1=รอ admin ยืนยัน (freeze), 0=คำนวณอัตโนมัติ' AFTER usage_end_date;

-- 2. quota_allocations: เปลี่ยน source เป็น VARCHAR รองรับ 'auto_confirmed'
ALTER TABLE quota_allocations
  MODIFY COLUMN source VARCHAR(50) NOT NULL DEFAULT 'admin' COMMENT 'auto | admin | auto_confirmed';
