ALTER TABLE `statement_reconcile_logs`
ADD COLUMN `confirmed_at` DATETIME DEFAULT NULL,
ADD COLUMN `confirmed_order_id` VARCHAR(100) DEFAULT NULL,
ADD COLUMN `confirmed_order_amount` DECIMAL(10,2) DEFAULT NULL,
ADD COLUMN `confirmed_payment_method` VARCHAR(50) DEFAULT NULL,
ADD COLUMN `confirmed_action` VARCHAR(50) DEFAULT NULL;
