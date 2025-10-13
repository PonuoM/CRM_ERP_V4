-- Mini ERP schema (MySQL >= 5.7), utf8mb4 for full Unicode
CREATE DATABASE IF NOT EXISTS `mini_erp` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `mini_erp`;

SET NAMES utf8mb4;

-- Companies
CREATE TABLE IF NOT EXISTS companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  password VARCHAR(255) NULL,
  first_name VARCHAR(128) NOT NULL,
  last_name VARCHAR(128) NOT NULL,
  email VARCHAR(255) NULL,
  phone VARCHAR(64) NULL,
  role VARCHAR(64) NOT NULL,
  company_id INT NOT NULL,
  team_id INT NULL,
  supervisor_id INT NULL,
  status ENUM('active', 'inactive', 'resigned') NOT NULL DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login DATETIME NULL,
  login_count INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_users_company FOREIGN KEY (company_id) REFERENCES companies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tags
CREATE TABLE IF NOT EXISTS tags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  type ENUM('SYSTEM','USER') NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- User <-> Tag
CREATE TABLE IF NOT EXISTS user_tags (
  user_id INT NOT NULL,
  tag_id INT NOT NULL,
  PRIMARY KEY (user_id, tag_id),
  CONSTRAINT fk_user_tags_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_user_tags_tag FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Customers
CREATE TABLE IF NOT EXISTS customers (
  id VARCHAR(32) PRIMARY KEY,
  first_name VARCHAR(128) NOT NULL,
  last_name VARCHAR(128) NOT NULL,
  phone VARCHAR(64) NOT NULL,
  email VARCHAR(255) NULL,
  province VARCHAR(128) NOT NULL,
  company_id INT NOT NULL,
  assigned_to INT NULL,
  date_assigned DATETIME NOT NULL,
  date_registered DATETIME NULL,
  follow_up_date DATETIME NULL,
  ownership_expires DATETIME NULL,
  lifecycle_status ENUM('New','Old','FollowUp','Old3Months','DailyDistribution') NULL,
  behavioral_status ENUM('Hot','Warm','Cold','Frozen') NULL,
  grade ENUM('D','C','B','A','A+') NULL,
  total_purchases DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_calls INT NOT NULL DEFAULT 0,
  facebook_name VARCHAR(255) NULL,
  line_id VARCHAR(128) NULL,
  street VARCHAR(255) NULL,
  subdistrict VARCHAR(128) NULL,
  district VARCHAR(128) NULL,
  postal_code VARCHAR(16) NULL,
  -- Ownership management fields
  has_sold_before BOOLEAN DEFAULT FALSE,
  follow_up_count INT DEFAULT 0,
  last_follow_up_date DATETIME NULL,
  last_sale_date DATETIME NULL,
  is_in_waiting_basket BOOLEAN DEFAULT FALSE,
  waiting_basket_start_date DATETIME NULL,
  CONSTRAINT fk_customers_company FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT fk_customers_assigned_to FOREIGN KEY (assigned_to) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Customer <-> Tag
CREATE TABLE IF NOT EXISTS customer_tags (
  customer_id VARCHAR(32) NOT NULL,
  tag_id INT NOT NULL,
  PRIMARY KEY (customer_id, tag_id),
  CONSTRAINT fk_customer_tags_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_customer_tags_tag FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Products
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sku VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  category VARCHAR(128) NOT NULL,
  unit VARCHAR(32) NOT NULL,
  cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  stock INT NOT NULL DEFAULT 0,
  company_id INT NOT NULL,
  CONSTRAINT fk_products_company FOREIGN KEY (company_id) REFERENCES companies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Promotions (bundled products / discounts)
CREATE TABLE IF NOT EXISTS promotions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sku VARCHAR(64) NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  company_id INT NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  start_date DATETIME NULL,
  end_date DATETIME NULL,
  CONSTRAINT fk_promotions_company FOREIGN KEY (company_id) REFERENCES companies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS promotion_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  promotion_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  is_freebie TINYINT(1) NOT NULL DEFAULT 0,
  price_override DECIMAL(12,2) NULL,
  CONSTRAINT fk_pitems_promotion FOREIGN KEY (promotion_id) REFERENCES promotions(id) ON DELETE CASCADE,
  CONSTRAINT fk_pitems_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(32) PRIMARY KEY,
  customer_id VARCHAR(32) NOT NULL,
  company_id INT NOT NULL,
  creator_id INT NOT NULL,
  order_date DATETIME NOT NULL,
  delivery_date DATETIME NULL,
  street VARCHAR(255) NULL,
  subdistrict VARCHAR(128) NULL,
  district VARCHAR(128) NULL,
  province VARCHAR(128) NULL,
  postal_code VARCHAR(16) NULL,
  shipping_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  bill_discount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  payment_method ENUM('COD','Transfer','PayAfter') NULL,
  payment_status ENUM('Unpaid','PendingVerification','Paid') NULL,
  slip_url VARCHAR(1024) NULL,
  amount_paid DECIMAL(12,2) NULL,
  cod_amount DECIMAL(12,2) NULL,
  order_status ENUM('Pending','Picking','Shipping','Delivered','Returned','Cancelled') NULL,
  notes TEXT NULL,
  sales_channel VARCHAR(128) NULL,
  sales_channel_page_id INT NULL,
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_orders_company FOREIGN KEY (company_id) REFERENCES companies(id),
  CONSTRAINT fk_orders_creator FOREIGN KEY (creator_id) REFERENCES users(id),
  CONSTRAINT fk_orders_page FOREIGN KEY (sales_channel_page_id) REFERENCES pages(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Order Items
CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(32) NOT NULL,
  product_id INT NULL,
  product_name VARCHAR(255) NULL,
  quantity INT NOT NULL,
  price_per_unit DECIMAL(12,2) NOT NULL,
  discount DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_freebie TINYINT(1) NOT NULL DEFAULT 0,
  box_number INT NULL,
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tracking numbers (1:N)
CREATE TABLE IF NOT EXISTS order_tracking_numbers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(32) NOT NULL,
  tracking_number VARCHAR(128) NOT NULL,
  CONSTRAINT fk_order_tracking_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- COD boxes (optional)
CREATE TABLE IF NOT EXISTS order_boxes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id VARCHAR(32) NOT NULL,
  box_number INT NOT NULL,
  cod_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  CONSTRAINT fk_order_boxes_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Call history
CREATE TABLE IF NOT EXISTS call_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id VARCHAR(32) NOT NULL,
  date DATETIME NOT NULL,
  caller VARCHAR(128) NOT NULL,
  status VARCHAR(64) NOT NULL,
  result VARCHAR(255) NOT NULL,
  crop_type VARCHAR(128) NULL,
  area_size VARCHAR(128) NULL,
  notes TEXT NULL,
  duration INT NULL,
  CONSTRAINT fk_call_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Appointments
CREATE TABLE IF NOT EXISTS appointments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id VARCHAR(32) NOT NULL,
  date DATETIME NOT NULL,
  title VARCHAR(255) NOT NULL,
  status VARCHAR(64) NOT NULL,
  notes TEXT NULL,
  CONSTRAINT fk_appt_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Activities (audit log)
CREATE TABLE IF NOT EXISTS activities (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  customer_id VARCHAR(32) NOT NULL,
  timestamp DATETIME NOT NULL,
  type VARCHAR(64) NOT NULL,
  description TEXT NOT NULL,
  actor_name VARCHAR(128) NOT NULL,
  CONSTRAINT fk_activity_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Marketing: Sales pages (Facebook pages or other channels)
CREATE TABLE IF NOT EXISTS pages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  platform VARCHAR(64) NOT NULL DEFAULT 'Facebook',
  url VARCHAR(1024) NULL,
  company_id INT NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_pages_company FOREIGN KEY (company_id) REFERENCES companies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Daily ad spend per page (optional)
CREATE TABLE IF NOT EXISTS ad_spend (
  id INT AUTO_INCREMENT PRIMARY KEY,
  page_id INT NOT NULL,
  spend_date DATE NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes VARCHAR(255) NULL,
  CONSTRAINT fk_adspend_page FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_page_date (page_id, spend_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Useful indexes
CREATE INDEX idx_customers_company ON customers(company_id);
CREATE INDEX idx_customers_assigned_to ON customers(assigned_to);
CREATE INDEX idx_customers_lifecycle_status ON customers(lifecycle_status);
CREATE INDEX idx_customers_ownership_expires ON customers(ownership_expires);
CREATE INDEX idx_customers_date_assigned ON customers(date_assigned);
CREATE INDEX idx_orders_company ON orders(company_id);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_products_company ON products(company_id);
CREATE INDEX idx_appointments_customer_id ON appointments(customer_id);
CREATE INDEX idx_appointments_date ON appointments(date);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_call_history_customer_id ON call_history(customer_id);
CREATE INDEX idx_activities_customer_id ON activities(customer_id);
CREATE INDEX idx_activities_timestamp ON activities(timestamp);

-- User login history
CREATE TABLE IF NOT EXISTS user_login_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  login_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  logout_time DATETIME NULL,
  session_duration INT NULL COMMENT 'Session duration in seconds',
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_login_user_id (user_id),
  INDEX idx_login_time (login_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Assignment history (tracks first-time ownership per agent)
CREATE TABLE IF NOT EXISTS customer_assignment_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  customer_id VARCHAR(32) NOT NULL,
  user_id INT NOT NULL,
  assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_customer_user_first (customer_id, user_id),
  CONSTRAINT fk_cah_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_cah_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

