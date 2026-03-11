-- Marketplace CSV Import - Database Migration
-- Created: 2026-03-10

-- 1. Import batches - log แต่ละครั้งที่ import
CREATE TABLE IF NOT EXISTS marketplace_import_batches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    filename VARCHAR(500),
    total_rows INT DEFAULT 0,
    imported_rows INT DEFAULT 0,
    skipped_rows INT DEFAULT 0,
    user_id INT NOT NULL,
    company_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_company (company_id),
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Sales orders - ข้อมูลระดับ order-item จาก CSV
CREATE TABLE IF NOT EXISTS marketplace_sales_orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    batch_id INT NOT NULL,
    product_code VARCHAR(100),
    product_name VARCHAR(500),
    variant_code VARCHAR(100),
    variant_name VARCHAR(200),
    internal_order_id VARCHAR(50),
    online_order_id VARCHAR(50),
    quantity INT DEFAULT 0,
    total_price DECIMAL(12,2) DEFAULT 0,
    order_date DATE DEFAULT NULL,
    shipping_date DATE DEFAULT NULL,
    order_status VARCHAR(100),
    platform VARCHAR(100),
    store_name VARCHAR(255),
    warehouse VARCHAR(255),
    tracking_number VARCHAR(100),
    status VARCHAR(100),
    store_id INT DEFAULT NULL,
    company_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (batch_id) REFERENCES marketplace_import_batches(id) ON DELETE CASCADE,
    INDEX idx_batch (batch_id),
    INDEX idx_order_date (order_date),
    INDEX idx_store (store_id),
    INDEX idx_online_order (online_order_id),
    INDEX idx_company (company_id),
    INDEX idx_platform (platform)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
