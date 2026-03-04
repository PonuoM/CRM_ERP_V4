-- ===========================================
-- Export Template System - Migration SQL
-- วันที่: 2026-03-04
-- Templates เป็น global (ใช้ร่วมกันทุกบริษัท)
-- Default template แยกตาม company_id
-- ===========================================

-- 1. ตาราง export_templates (เก็บรายชื่อ templates — global, ไม่แยก company)
CREATE TABLE IF NOT EXISTS export_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. ตาราง export_template_columns (เก็บ headers + data_source mapping)
CREATE TABLE IF NOT EXISTS export_template_columns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    template_id INT NOT NULL,
    header_name VARCHAR(100) NOT NULL,
    data_source VARCHAR(200) NOT NULL DEFAULT '',
    sort_order INT NOT NULL DEFAULT 0,
    default_value VARCHAR(100) DEFAULT NULL,
    display_mode VARCHAR(10) NOT NULL DEFAULT 'all' COMMENT 'all=แสดงทุก row, index=แสดงเฉพาะแถวแรก',
    INDEX idx_etc_template (template_id),
    FOREIGN KEY (template_id) REFERENCES export_templates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. ตาราง export_template_defaults (เก็บ default template แยกตาม company)
CREATE TABLE IF NOT EXISTS export_template_defaults (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    template_id INT NOT NULL,
    UNIQUE KEY uk_etd_company (company_id),
    INDEX idx_etd_template (template_id),
    FOREIGN KEY (template_id) REFERENCES export_templates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. เพิ่มคอลัมน์ template_id ในตาราง exports (ถ้ายังไม่มี)
ALTER TABLE exports ADD COLUMN template_id INT NULL AFTER category;

-- 5. ตาราง export_order_items (เก็บ order IDs ที่ถูก export ในแต่ละรอบ)
CREATE TABLE IF NOT EXISTS export_order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    export_id INT NOT NULL,
    order_id VARCHAR(50) NOT NULL,
    INDEX idx_eoi_export (export_id),
    INDEX idx_eoi_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
