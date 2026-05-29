-- Migration: Add mismatch_reason to statement_reconcile_logs
-- Run this on existing databases to support tracking shortage/overage reasons

ALTER TABLE statement_reconcile_logs 
  ADD COLUMN mismatch_reason VARCHAR(255) DEFAULT NULL AFTER note;
