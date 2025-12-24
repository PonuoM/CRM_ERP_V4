-- 1. Modify column to VARCHAR to support flexible values (if it was ENUM)
ALTER TABLE stock_movements MODIFY COLUMN movement_type VARCHAR(100) NOT NULL;

-- 2. Update existing historical data to match new convention
UPDATE stock_movements SET movement_type = 'Delete Document' WHERE movement_type = 'VOID';
UPDATE stock_movements SET movement_type = 'Edit Document' WHERE movement_type = 'UPDATE_REVERT';
