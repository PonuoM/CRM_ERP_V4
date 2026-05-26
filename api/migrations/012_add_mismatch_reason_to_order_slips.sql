-- Migration: 012_add_mismatch_reason_to_order_slips.sql
-- Description: Add mismatch_reason column to order_slips for tracking overpayment and shortage reasons.

ALTER TABLE `order_slips` ADD COLUMN `mismatch_reason` VARCHAR(255) NULL AFTER `transfer_date`;
