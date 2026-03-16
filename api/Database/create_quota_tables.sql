-- ========================================
-- Product Quota System — Migration
-- Created: 2026-03-13
-- ========================================

-- 1. สินค้าที่มีระบบโควตา
CREATE TABLE IF NOT EXISTS quota_products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL COMMENT 'FK → products.id',
    company_id INT NOT NULL COMMENT 'FK → companies.id',
    display_name VARCHAR(255) NOT NULL COMMENT 'ชื่อที่แสดงในระบบ',
    csv_label VARCHAR(255) DEFAULT NULL COMMENT 'ชื่อที่แสดงใน CSV export',
    quota_cost INT NOT NULL DEFAULT 1 COMMENT 'จำนวนโควตาที่ต้องใช้ต่อ 1 ชิ้น',
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_product_company (product_id, company_id),
    INDEX idx_company (company_id),
    INDEX idx_active (company_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. อัตรา ยอดขาย/โควตา (ตั้งล่วงหน้าตามวันที่)
CREATE TABLE IF NOT EXISTS quota_rate_schedules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    quota_product_id INT NOT NULL COMMENT 'FK → quota_products.id',
    sales_per_quota DECIMAL(10,2) NOT NULL COMMENT 'ยอดขายกี่บาท = 1 โควตา',
    effective_date DATE NOT NULL COMMENT 'มีผลตั้งแต่วันนี้เป็นต้นไป',
    order_date_field ENUM('order_date', 'delivery_date') DEFAULT 'order_date' COMMENT 'ใช้วันไหนคำนวณ',
    quota_mode ENUM('reset', 'cumulative') DEFAULT 'reset' COMMENT 'reset=รีเซ็ตตามรอบ, cumulative=สะสม',
    reset_interval_days INT DEFAULT 30 COMMENT 'จำนวนวันต่อรอบ (ใช้กับ mode reset + interval)',
    reset_day_of_month TINYINT DEFAULT NULL COMMENT 'วันที่รีเซ็ตของแต่ละเดือน 1-28 (ใช้กับ mode reset + monthly)',
    reset_anchor_date DATE DEFAULT NULL COMMENT 'วันเริ่มนับรอบ (ใช้กับ mode reset + interval)',
    created_by INT DEFAULT NULL COMMENT 'FK → users.id',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_product_effective (quota_product_id, effective_date),
    INDEX idx_effective (quota_product_id, effective_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Log การแจกโควตา (ทั้ง auto + admin)
CREATE TABLE IF NOT EXISTS quota_allocations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    quota_product_id INT NOT NULL COMMENT 'FK → quota_products.id',
    user_id INT NOT NULL COMMENT 'FK → users.id (พนักงานที่ได้โควตา)',
    company_id INT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL COMMENT 'จำนวนโควตาที่ให้',
    source ENUM('auto', 'admin') NOT NULL COMMENT 'auto=จากยอดขาย, admin=เพิ่มเอง',
    source_detail TEXT DEFAULT NULL COMMENT 'รายละเอียด เช่น order_id, หมายเหตุ',
    allocated_by INT DEFAULT NULL COMMENT 'FK → users.id (admin ที่เพิ่ม)',
    period_start DATE DEFAULT NULL COMMENT 'เริ่มต้นรอบ',
    period_end DATE DEFAULT NULL COMMENT 'สิ้นสุดรอบ',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_product (user_id, quota_product_id),
    INDEX idx_company (company_id),
    INDEX idx_period (quota_product_id, user_id, period_start, period_end)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Log การใช้โควตา
CREATE TABLE IF NOT EXISTS quota_usage (
    id INT AUTO_INCREMENT PRIMARY KEY,
    quota_product_id INT NOT NULL COMMENT 'FK → quota_products.id',
    user_id INT NOT NULL COMMENT 'FK → users.id',
    company_id INT NOT NULL,
    order_id VARCHAR(50) NOT NULL COMMENT 'FK → orders.id',
    quantity_used DECIMAL(10,2) NOT NULL COMMENT 'จำนวนโควตาที่ใช้',
    period_start DATE DEFAULT NULL,
    period_end DATE DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_product (user_id, quota_product_id),
    INDEX idx_order (order_id),
    INDEX idx_period (quota_product_id, user_id, period_start, period_end)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
