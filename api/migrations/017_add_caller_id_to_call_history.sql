-- Migration: Add caller_id to call_history and migrate old data
-- Created: 2026-06-05

-- 1. Add caller_id column
ALTER TABLE call_history ADD COLUMN caller_id INT NULL DEFAULT NULL AFTER customer_id;

-- 2. Update existing data by joining customers (for company_id) and users (for name matching)
UPDATE call_history ch 
JOIN customers c ON ch.customer_id = c.customer_id 
JOIN users u ON u.company_id = c.company_id 
  AND TRIM(CONCAT(u.first_name, ' ', IFNULL(u.last_name, ''))) = TRIM(ch.caller) 
SET ch.caller_id = u.id 
WHERE ch.caller_id IS NULL;
