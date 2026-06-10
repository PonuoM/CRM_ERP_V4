CREATE TABLE IF NOT EXISTS shopee_loyalty_settings (
    company_id INT PRIMARY KEY,
    spend_per_point DECIMAL(10,2) NOT NULL DEFAULT 1500.00,
    points_for_coupon INT NOT NULL DEFAULT 10,
    coupon_prefix VARCHAR(10) NOT NULL DEFAULT 'CAT3000',
    coupon_discount DECIMAL(10,2) NOT NULL DEFAULT 300.00,
    coupon_min_spend DECIMAL(10,2) NOT NULL DEFAULT 1500.00,
    coupon_expiry_days INT NOT NULL DEFAULT 30,
    baseline_aov DECIMAL(10,2) NOT NULL DEFAULT 696.00,
    target_aov DECIMAL(10,2) NOT NULL DEFAULT 850.00,
    baseline_repeat_rate DECIMAL(5,2) NOT NULL DEFAULT 17.78,
    target_repeat_rate DECIMAL(5,2) NOT NULL DEFAULT 25.00,
    target_members INT NOT NULL DEFAULT 100,
    target_10_points INT NOT NULL DEFAULT 20,
    target_sales_percent DECIMAL(5,2) NOT NULL DEFAULT 30.00,
    points_calculation_mode VARCHAR(20) NOT NULL DEFAULT 'capped',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS shopee_loyalty_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    shopee_username VARCHAR(255) NOT NULL UNIQUE,
    total_points INT NOT NULL DEFAULT 0,
    company_id INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_shopee_loyalty_members_username (shopee_username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS shopee_loyalty_orders (
    order_id VARCHAR(128) PRIMARY KEY,
    shopee_username VARCHAR(255) NOT NULL,
    order_date DATETIME NOT NULL,
    total_amount DECIMAL(12,2) NOT NULL,
    points_earned INT NOT NULL DEFAULT 1,
    company_id INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_shopee_loyalty_orders_username (shopee_username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS loyalty_coupons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(32) NOT NULL UNIQUE,
    shopee_username VARCHAR(255) NOT NULL,
    discount_value DECIMAL(10,2) NOT NULL DEFAULT 300.00,
    min_spend DECIMAL(10,2) NOT NULL DEFAULT 1500.00,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    expiry_date DATETIME NOT NULL,
    company_id INT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    used_at DATETIME NULL,
    used_in_order_id VARCHAR(128) NULL,
    INDEX idx_loyalty_coupons_username (shopee_username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS shopee_loyalty_order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(128) NOT NULL,
    sku_reference VARCHAR(500) NULL,
    variation_name VARCHAR(1000) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_shopee_loyalty_order_items_order_id (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
