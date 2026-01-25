-- Add blocked_target_baskets column to basket_config
-- Purpose: Prevent cross-lane basket transitions during re-evaluate
-- Format: Comma-separated basket IDs, e.g., "42,39,38"

ALTER TABLE basket_config 
ADD COLUMN `blocked_target_baskets` TEXT DEFAULT NULL 
COMMENT 'Comma-separated basket IDs ที่ห้ามย้ายไป เช่น "42,39,38"';

-- Example: Block "หาคนดูแลใหม่" (ID:46) from going to blue lane baskets (42,39,38)
-- UPDATE basket_config SET blocked_target_baskets = '42,39,38' WHERE id = 46;
