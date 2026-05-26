-- Migration 003: Add created_at and created_by to appointments table
-- For Dynamic Basket Retention (Strict Mode)

ALTER TABLE appointments 
ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN created_by INT NULL;
