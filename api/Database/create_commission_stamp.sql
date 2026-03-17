-- ================================================================
-- Commission Stamp System — SQL Migration
-- ================================================================
-- ระบบ Stamp ค่าคอมมิชชัน
-- สร้าง 2 ตาราง: commission_stamp_batches, commission_stamp_orders
-- ================================================================

-- 1. commission_stamp_batches — รอบ Import (batch)
CREATE TABLE IF NOT EXISTS commission_stamp_batches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    order_count INT DEFAULT 0,
    total_commission DECIMAL(12,2) DEFAULT 0.00,
    created_by INT DEFAULT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    note TEXT DEFAULT NULL,
    INDEX idx_csb_company (company_id),
    INDEX idx_csb_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. commission_stamp_orders — ออเดอร์ที่ stamp แล้ว
CREATE TABLE IF NOT EXISTS commission_stamp_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    batch_id INT NOT NULL,
    order_id VARCHAR(50) NOT NULL,
    user_id INT DEFAULT NULL,
    commission_amount DECIMAL(12,2) DEFAULT NULL,
    note TEXT DEFAULT NULL,
    stamped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    stamped_by INT DEFAULT NULL,
    UNIQUE KEY uq_batch_order_user (batch_id, order_id, user_id),
    INDEX idx_cso_order (order_id),
    INDEX idx_cso_user (user_id),
    CONSTRAINT fk_cso_batch FOREIGN KEY (batch_id)
        REFERENCES commission_stamp_batches(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
