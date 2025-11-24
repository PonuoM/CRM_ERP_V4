-- Migration to cleanup customer_ref_id (VARCHAR) and standardize on customer_id (INT)
-- Created: 2025-11-21

START TRANSACTION;

-- 1. Cleanup Orders
-- Sync customer_id (INT) from customers using customer_ref_id (VARCHAR)
UPDATE orders o
JOIN customers c ON o.customer_ref_id = c.customer_ref_id
SET o.customer_id = c.customer_id
WHERE (o.customer_id IS NULL OR o.customer_id = 0) AND o.customer_ref_id IS NOT NULL;

-- Drop the redundant VARCHAR column
ALTER TABLE orders DROP COLUMN customer_ref_id;

-- Add FK if not exists (assuming customer_id is the INT PK of customers)
-- First drop existing FK if any (to be safe)
SET @sql := IF(
  EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_orders_customer'),
  'ALTER TABLE orders DROP FOREIGN KEY fk_orders_customer',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE orders ADD CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE ON UPDATE CASCADE;


-- 2. Cleanup Activities
UPDATE activities a
JOIN customers c ON a.customer_ref_id = c.customer_ref_id
SET a.customer_id = c.customer_id
WHERE (a.customer_id IS NULL OR a.customer_id = 0) AND a.customer_ref_id IS NOT NULL;

ALTER TABLE activities DROP COLUMN customer_ref_id;

SET @sql := IF(
  EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_activity_customer'),
  'ALTER TABLE activities DROP FOREIGN KEY fk_activity_customer',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE activities ADD CONSTRAINT fk_activity_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE ON UPDATE CASCADE;


-- 3. Cleanup Appointments
UPDATE appointments a
JOIN customers c ON a.customer_ref_id = c.customer_ref_id
SET a.customer_id = c.customer_id
WHERE (a.customer_id IS NULL OR a.customer_id = 0) AND a.customer_ref_id IS NOT NULL;

ALTER TABLE appointments DROP COLUMN customer_ref_id;

SET @sql := IF(
  EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_appt_customer'),
  'ALTER TABLE appointments DROP FOREIGN KEY fk_appt_customer',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE appointments ADD CONSTRAINT fk_appt_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE ON UPDATE CASCADE;


-- 4. Cleanup Call History
UPDATE call_history c
JOIN customers cust ON c.customer_ref_id = cust.customer_ref_id
SET c.customer_id = cust.customer_id
WHERE (c.customer_id IS NULL OR c.customer_id = 0) AND c.customer_ref_id IS NOT NULL;

ALTER TABLE call_history DROP COLUMN customer_ref_id;

SET @sql := IF(
  EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_call_customer'),
  'ALTER TABLE call_history DROP FOREIGN KEY fk_call_customer',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE call_history ADD CONSTRAINT fk_call_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE ON UPDATE CASCADE;


-- 5. Cleanup Customer Assignment History
UPDATE customer_assignment_history cah
JOIN customers c ON cah.customer_ref_id = c.customer_ref_id
SET cah.customer_id = c.customer_id
WHERE (cah.customer_id IS NULL OR cah.customer_id = 0) AND cah.customer_ref_id IS NOT NULL;

ALTER TABLE customer_assignment_history DROP COLUMN customer_ref_id;

SET @sql := IF(
  EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_cah_customer'),
  'ALTER TABLE customer_assignment_history DROP FOREIGN KEY fk_cah_customer',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE customer_assignment_history ADD CONSTRAINT fk_cah_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE ON UPDATE CASCADE;


-- 6. Cleanup Customer Tags
-- Note: customer_tags has customer_ref_id (INT) and customer_id (VARCHAR)
-- We want to keep the INT one and rename it to customer_id

-- Sync INT from VARCHAR if needed
UPDATE customer_tags ct
JOIN customers c ON ct.customer_id = c.customer_ref_id
SET ct.customer_ref_id = c.customer_id
WHERE (ct.customer_ref_id IS NULL OR ct.customer_ref_id = 0) AND ct.customer_id IS NOT NULL;

-- Drop VARCHAR column
ALTER TABLE customer_tags DROP COLUMN customer_id;

-- Rename INT column to customer_id
ALTER TABLE customer_tags CHANGE customer_ref_id customer_id INT NOT NULL;

-- Re-add Primary Key
-- First drop existing PK (it might be on the dropped column or the combination)
-- Usually dropping the column drops the key part, but let's be safe
-- ALTER TABLE customer_tags DROP PRIMARY KEY; -- Might fail if not exists
-- ADD PRIMARY KEY (customer_id, tag_id);

SET @sql := IF(
  EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_customer_tags_customer'),
  'ALTER TABLE customer_tags DROP FOREIGN KEY fk_customer_tags_customer',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE customer_tags ADD CONSTRAINT fk_customer_tags_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE ON UPDATE CASCADE;


COMMIT;
