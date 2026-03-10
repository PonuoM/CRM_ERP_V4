-- Migration: Create return_images table
-- Date: 2026-03-10

CREATE TABLE IF NOT EXISTS return_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sub_order_id VARCHAR(100) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  url VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sub_order_id (sub_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
