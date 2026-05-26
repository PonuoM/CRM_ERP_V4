-- Migration 002: Add configurable appointment retention fields to basket_config
-- These fields allow specific dashboard baskets to dynamically extend holding time based on appointments.

ALTER TABLE basket_config 
ADD COLUMN extend_days_per_appointment INT NULL DEFAULT 0 COMMENT 'จำนวนวันที่บวกเพิ่มต่อ 1 นัดหมาย',
ADD COLUMN max_total_days INT NULL DEFAULT NULL COMMENT 'เพดานเวลาถือครองสูงสุดรวม (วัน)';
