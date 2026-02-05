-- Migration: Change unique key from statement_log_id only to (statement_log_id, order_id)
-- This allows one statement to be matched to multiple orders (for COD documents)

-- First, check the current foreign keys
-- SHOW CREATE TABLE statement_reconcile_logs;

-- Step 1: Drop foreign key that depends on the index
ALTER TABLE statement_reconcile_logs DROP FOREIGN KEY fk_statement_reconcile_statement;

-- Step 2: Now we can drop the unique index
ALTER TABLE statement_reconcile_logs DROP INDEX uniq_statement_log;

-- Step 3: Create new composite unique index
ALTER TABLE statement_reconcile_logs ADD UNIQUE KEY uniq_statement_order (statement_log_id, order_id);

-- Step 4: Re-create the foreign key (it will use the new index or create its own)
ALTER TABLE statement_reconcile_logs 
  ADD CONSTRAINT fk_statement_reconcile_statement 
  FOREIGN KEY (statement_log_id) REFERENCES statement_logs(id) 
  ON DELETE CASCADE ON UPDATE NO ACTION;

-- Verify the changes
SHOW INDEX FROM statement_reconcile_logs WHERE Key_name LIKE 'uniq_%';
