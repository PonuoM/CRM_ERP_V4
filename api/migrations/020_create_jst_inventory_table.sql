-- Migration: 020_create_jst_inventory_table.sql
-- Description: Create table for background synced JST ERP inventory data

CREATE TABLE IF NOT EXISTS jst_inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    sku_id VARCHAR(100) NOT NULL,
    sku_name VARCHAR(255) DEFAULT '',
    warehouse_name VARCHAR(255) DEFAULT '',
    qty INT DEFAULT 0,
    available_qty INT DEFAULT 0,
    order_lock INT DEFAULT 0,
    pic TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_comp_sku_wh (company_id, sku_id, warehouse_name),
    INDEX idx_company_id (company_id),
    INDEX idx_sku_id (sku_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
