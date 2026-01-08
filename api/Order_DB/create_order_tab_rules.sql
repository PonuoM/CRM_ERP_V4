CREATE TABLE IF NOT EXISTS order_tab_rules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tab_key VARCHAR(50) NOT NULL COMMENT 'The tab identifier (e.g., unpaid, pending)',
    payment_method VARCHAR(50) NULL COMMENT 'Payment method filter value',
    payment_status VARCHAR(50) NULL COMMENT 'Payment status filter value',
    order_status VARCHAR(50) NULL COMMENT 'Order status filter value',
    description TEXT NULL,
    company_id INT NOT NULL DEFAULT 0,
    display_order INT DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tab_key (tab_key),
    INDEX idx_company (company_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
