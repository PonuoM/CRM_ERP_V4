-- Migration: Add order_status column to google_sheet_shipping
-- Date: 2025-12-15
-- Description: Adds order_status column to separate the official order status from delivery status

-- Check if column exists logic is usually handled by application code or specific migration tools.
-- For raw SQL, we use a standard ALTER TABLE.
-- If running multiple times, ensure to handle potential "Duplicate column name" error or wrap in a stored procedure if strictly required by MYSQL version (but simple ALTER is standard for these files).

ALTER TABLE google_sheet_shipping
ADD COLUMN order_status VARCHAR(50) NULL COMMENT 'สถานะคำสั่งซื้อ (Official)' AFTER order_number;

ALTER TABLE google_sheet_shipping
ADD INDEX idx_order_status (order_status);

SELECT 'Migration 20251215_add_order_status_to_gsheet_shipping.sql completed' AS message;
