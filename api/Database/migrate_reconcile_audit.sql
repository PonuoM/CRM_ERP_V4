-- Migration: Add created_by and confirmed_by to statement_reconcile_logs
-- Run this on existing databases

ALTER TABLE statement_reconcile_logs
  ADD COLUMN created_by INT DEFAULT NULL AFTER auto_matched,
  ADD COLUMN confirmed_by INT DEFAULT NULL AFTER created_by;
