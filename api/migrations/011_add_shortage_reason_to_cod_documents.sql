-- Add shortage_reason column to cod_documents table
-- Used in Finance Approval page when the document total_input_amount does not match the statement amount.

ALTER TABLE cod_documents ADD COLUMN IF NOT EXISTS shortage_reason VARCHAR(255) DEFAULT NULL;
