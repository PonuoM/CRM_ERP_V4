-- Migration: Add Holding Basket ("พักรอแจก")
-- Date: 2026-03-03
-- Purpose: Create a holding basket that pauses customers for 30 days before redistribution

USE primacom_mini_erp;

-- Step 1: Insert new holding basket
INSERT INTO basket_config (
    basket_key, basket_name, 
    target_page, display_order, is_active, company_id,
    on_fail_basket_key, fail_after_days, 
    on_fail_reevaluate, hold_days_before_redistribute,
    max_distribution_count
) VALUES (
    'holding_before_redistribute', 'พักรอแจก',
    'distribution', 3, 1, 1,
    'find_new_owner', 30,
    0, 0,
    0
);

-- Step 2: Update basket 40 (ส่วนตัวโอกาสสุดท้าย) to point to holding basket instead of find_new_owner
UPDATE basket_config 
SET on_fail_basket_key = 'holding_before_redistribute'
WHERE id = 40;

-- Verify
SELECT id, basket_key, basket_name, on_fail_basket_key, fail_after_days, target_page 
FROM basket_config 
WHERE basket_key IN ('holding_before_redistribute', 'personal_last_chance', 'find_new_owner')
ORDER BY id;
