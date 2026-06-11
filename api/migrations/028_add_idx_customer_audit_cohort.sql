-- Add composite index to optimize Cohort Analysis in Telesale Matrix
-- This speeds up querying the historical basket of a customer.
ALTER TABLE `customer_audit_log` 
ADD INDEX `idx_customer_field_created` (`customer_id`, `field_name`, `created_at`);
