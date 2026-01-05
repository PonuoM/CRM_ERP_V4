-- Performance Optimization: Add Missing Database Indexes
-- Run this on the production database (primacom_mini_erp)

-- ============================================
-- STEP 1: Add indexes to customers table
-- ============================================

-- Index for filtering by company and assigned user (most common query pattern)
ALTER TABLE customers ADD INDEX idx_company_assigned (company_id, assigned_to);

-- Index for filtering by company only
ALTER TABLE customers ADD INDEX idx_company_id (company_id);

-- Index for filtering by assigned_to only
ALTER TABLE customers ADD INDEX idx_assigned_to (assigned_to);

-- Index for date_assigned sorting
ALTER TABLE customers ADD INDEX idx_date_assigned (date_assigned);

-- ============================================
-- STEP 2: Add indexes to call_history table
-- ============================================

-- Index for customer_id (used in subqueries)
ALTER TABLE call_history ADD INDEX idx_customer_id (customer_id);

-- Composite index for customer + date (for activity checks)
ALTER TABLE call_history ADD INDEX idx_customer_date (customer_id, date);

-- ============================================
-- STEP 3: Add indexes to orders table
-- ============================================

-- Index for customer_id (used in subqueries)
ALTER TABLE orders ADD INDEX idx_customer_id (customer_id);

-- Composite index for upsell checks
ALTER TABLE orders ADD INDEX idx_customer_status_date (customer_id, order_status, order_date);

-- ============================================
-- STEP 4: Add indexes to activities table
-- ============================================

-- Index for customer_id (used in activity checks)
ALTER TABLE activities ADD INDEX idx_customer_id (customer_id);

-- ============================================
-- STEP 5: Add indexes to appointments table
-- ============================================

-- Index for customer_id
ALTER TABLE appointments ADD INDEX idx_customer_id (customer_id);

-- Index for date filtering
ALTER TABLE appointments ADD INDEX idx_date (date);

-- ============================================
-- STEP 6: Verify indexes were created
-- ============================================
SHOW INDEX FROM customers;
SHOW INDEX FROM call_history;
SHOW INDEX FROM orders;
SHOW INDEX FROM activities;
SHOW INDEX FROM appointments;
