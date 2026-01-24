-- ==========================================
-- Dashboard V2 Basket Logic Fixes
-- Date: 2026-01-22
-- ==========================================

-- ==========================================
-- 1. Fix fail_after_days and on_fail_basket_key
-- ==========================================

-- ลูกค้าใหม่: 60 วัน → รอคนมาจีบให้ติด (distribution)
UPDATE basket_config SET 
    fail_after_days = 60,
    on_fail_basket_key = 'waiting_for_match'
WHERE basket_key = 'new_customer' AND company_id = 1;

-- ส่วนตัว 1-2 เดือน: 60 วัน → โอกาสสุดท้าย (dashboard)
UPDATE basket_config SET 
    fail_after_days = 60,
    on_fail_basket_key = 'personal_last_chance'
WHERE basket_key = 'personal_1_2m' AND company_id = 1;

-- โอกาสสุดท้าย: 30 วัน → หาคนดูแลใหม่ (distribution) + พัก 30 วัน
UPDATE basket_config SET 
    fail_after_days = 30,
    on_fail_basket_key = 'find_new_owner',
    hold_days_before_redistribute = 30
WHERE basket_key = 'personal_last_chance' AND company_id = 1;

-- ==========================================
-- 2. Enable re-evaluate for dashboard tabs that need dynamic routing
-- ==========================================

UPDATE basket_config SET on_fail_reevaluate = 1 
WHERE basket_key IN (
    'waiting_for_match_dash', 
    'find_new_owner_dash', 
    'mid_6_12m_dash', 
    'mid_1_3y_dash',
    'ancient_dash'
) AND company_id = 1;

-- ==========================================
-- 3. Fix Upsell basket config
-- ==========================================

-- Upsell: ขายไม่ได้ → ลูกค้าใหม่
UPDATE basket_config SET 
    on_fail_basket_key = 'new_customer',
    fail_after_days = NULL  -- Upsell ไม่ใช้เวลา ใช้ order status เป็น trigger
WHERE basket_key = 'upsell' AND company_id = 1;

-- ==========================================
-- 4. Verify changes
-- ==========================================
SELECT basket_key, basket_name, fail_after_days, on_fail_basket_key, on_fail_reevaluate, hold_days_before_redistribute
FROM basket_config 
WHERE company_id = 1 
ORDER BY display_order;
