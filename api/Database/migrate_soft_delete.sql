-- ========================================
-- Migration: Soft Delete + deleted_at
-- Date: 2026-03-16
-- ========================================

ALTER TABLE quota_products ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL;
ALTER TABLE quota_rate_schedules ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL;
ALTER TABLE quota_allocations ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL;
ALTER TABLE quota_usage ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL;

-- Drop UNIQUE constraint ที่ขัดกับ soft delete
-- (ลบ rate แล้วสร้างใหม่ effective_date เดิมจะ error ถ้ามี UNIQUE)
ALTER TABLE quota_rate_schedules DROP INDEX uq_product_effective;
