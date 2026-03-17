-- ========================================
-- Global Quota + Multi-Product Scope Migration
-- Run this on PRODUCTION if DB already exists
-- ========================================

-- Allow NULL quota_product_id for global/scoped rates
ALTER TABLE quota_rate_schedules MODIFY quota_product_id INT DEFAULT NULL COMMENT 'FK → quota_products.id (NULL = global/scoped)';
ALTER TABLE quota_allocations MODIFY quota_product_id INT DEFAULT NULL COMMENT 'FK → quota_products.id (NULL = global)';

-- Scope table: which products a scoped rate applies to
CREATE TABLE IF NOT EXISTS quota_rate_scope (
    rate_schedule_id INT NOT NULL COMMENT 'FK → quota_rate_schedules.id',
    quota_product_id INT NOT NULL COMMENT 'FK → quota_products.id',
    PRIMARY KEY (rate_schedule_id, quota_product_id),
    INDEX idx_product (quota_product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
