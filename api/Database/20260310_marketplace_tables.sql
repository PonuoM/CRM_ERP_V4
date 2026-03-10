-- Marketplace Module - Database Migration
-- Created: 2026-03-10

-- 1. marketplace_stores - ร้านค้า
CREATE TABLE IF NOT EXISTS marketplace_stores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    platform VARCHAR(100) NOT NULL COMMENT 'e.g. Shopee, Lazada, TikTok',
    url VARCHAR(500) DEFAULT NULL,
    manager_user_id INT DEFAULT NULL,
    company_id INT NOT NULL,
    active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id),
    INDEX idx_company (company_id),
    INDEX idx_platform (platform)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. marketplace_ads_log - บันทึกค่า Ads
CREATE TABLE IF NOT EXISTS marketplace_ads_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    store_id INT NOT NULL,
    date DATE NOT NULL,
    ads_cost DECIMAL(12,2) DEFAULT 0,
    impressions INT DEFAULT 0,
    clicks INT DEFAULT 0,
    user_id INT NOT NULL COMMENT 'who entered this',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_store_date (store_id, date),
    FOREIGN KEY (store_id) REFERENCES marketplace_stores(id) ON DELETE CASCADE,
    INDEX idx_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. marketplace_sales_import - นำเข้ายอดขาย
CREATE TABLE IF NOT EXISTS marketplace_sales_import (
    id INT AUTO_INCREMENT PRIMARY KEY,
    store_id INT NOT NULL,
    date DATE NOT NULL,
    total_sales DECIMAL(12,2) DEFAULT 0,
    total_orders INT DEFAULT 0,
    returns_amount DECIMAL(12,2) DEFAULT 0,
    cancelled_amount DECIMAL(12,2) DEFAULT 0,
    user_id INT NOT NULL COMMENT 'who imported this',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_store_date (store_id, date),
    FOREIGN KEY (store_id) REFERENCES marketplace_stores(id) ON DELETE CASCADE,
    INDEX idx_date (date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
