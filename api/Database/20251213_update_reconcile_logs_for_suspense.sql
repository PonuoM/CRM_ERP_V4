-- Allow NULL in order_id column for Suspense/Held Funds entries
ALTER TABLE `statement_reconcile_logs` MODIFY COLUMN `order_id` VARCHAR(32) NULL;

-- Add reconcile_type column to distinguish between Order matches and Suspense entries
-- Default is 'Order' for backward compatibility
ALTER TABLE `statement_reconcile_logs` ADD COLUMN `reconcile_type` VARCHAR(20) NOT NULL DEFAULT 'Order' AFTER `order_id`;

-- Add index for reconcile_type for faster filtering
ALTER TABLE `statement_reconcile_logs` ADD INDEX `idx_statement_reconcile_type` (`reconcile_type`);
