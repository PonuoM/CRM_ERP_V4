-- ============================================================================
-- Migration: 027_add_idx_appointments_customer_date
-- Description: เพิ่ม Composite Index ให้ตาราง appointments ที่ customer_id และ date
-- Reason: เพื่อเพิ่มความเร็วให้การเช็ค "ไม่มีนัดหมาย" (NOT EXISTS ... date >= CURDATE())
-- ============================================================================

ALTER TABLE `appointments` 
ADD INDEX `idx_appointments_customer_date` (`customer_id`, `date`);
