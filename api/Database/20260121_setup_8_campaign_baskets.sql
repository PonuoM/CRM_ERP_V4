-- ==========================================
-- RFM Campaign Setup - 8 Baskets (Both Pages)
-- Based on: ระบบแคมเปญ Tele-CRM & Chat Script
-- ==========================================

-- Clear existing basket_config (optional - uncomment if needed)
-- DELETE FROM basket_config WHERE company_id = 1;

-- ==========================================
-- INSERT Campaign Baskets
-- ==========================================
-- ถัง 1-3: Dashboard only (ถังส่วนตัว)
-- ถัง 4-8: มีทั้ง Distribution + Dashboard (linked)
-- ==========================================

INSERT INTO basket_config (
    basket_key, basket_name, 
    min_order_count, max_order_count,
    min_days_since_order, max_days_since_order,
    days_since_first_order, days_since_registered,
    target_page, display_order, is_active, company_id,
    on_sale_basket_key, fail_after_days, on_fail_basket_key,
    max_distribution_count, hold_days_before_redistribute,
    linked_basket_key, on_max_dist_basket_key, on_fail_reevaluate, has_loop
) VALUES 

-- ==========================================
-- DASHBOARD ONLY (ถังส่วนตัว Telesale) - ถัง 1-3
-- ==========================================

-- 1. ลูกค้าใหม่ (0-30 วัน) - ConvRate 50%
('new_customer', 'ลูกค้าใหม่', 
 1, NULL,
 0, 30,
 NULL, NULL,
 'dashboard_v2', 1, 1, 1,
 'personal_1_2m', 7, 'waiting_for_match',
 2, 0,
 NULL, 'waiting_for_match', 0, 1),

-- 2. ส่วนตัว 1-2 เดือน (31-60 วัน) - ConvRate 50%
('personal_1_2m', 'ส่วนตัว 1-2 เดือน',
 1, NULL,
 31, 60,
 NULL, NULL,
 'dashboard_v2', 2, 1, 1,
 'personal_1_2m', 14, 'waiting_for_match',
 2, 0,
 NULL, 'personal_last_chance', 0, 1),

-- 3. ส่วนตัวโอกาสสุดท้ายเดือน 3 (61-90 วัน) - ConvRate 25%
('personal_last_chance', 'ส่วนตัวโอกาสสุดท้ายเดือน 3',
 1, NULL,
 61, 90,
 NULL, NULL,
 'dashboard_v2', 3, 1, 1,
 'personal_1_2m', 14, 'waiting_for_match',
 2, 0,
 NULL, 'find_new_owner', 0, 1),

-- ==========================================
-- DISTRIBUTION (Pool รอแจก) - ถัง 4-8
-- linked_basket_key จะเชื่อมไปยัง Dashboard tab
-- ==========================================

-- 4. หาคนดูแลใหม่ - Distribution Pool
('find_new_owner', 'หาคนดูแลใหม่',
 1, NULL,
 91, 180,
 NULL, NULL,
 'distribution', 4, 1, 1,
 'personal_1_2m', 30, 'waiting_for_match',
 2, 3,
 'find_new_owner_dash', 'mid_6_12m', 0, 1),

-- 5. รอคนมาจีบให้ติด - Distribution Pool
('waiting_for_match', 'รอคนมาจีบให้ติด',
 1, NULL,
 91, 180,
 NULL, NULL,
 'distribution', 5, 1, 1,
 'personal_1_2m', 30, 'waiting_for_match',
 3, 3,
 'waiting_for_match_dash', 'mid_6_12m', 0, 1),

-- 6. ถังกลาง 6-12 เดือน - Distribution Pool
('mid_6_12m', 'ถังกลาง 6-12 เดือน',
 1, NULL,
 181, 365,
 NULL, NULL,
 'distribution', 6, 1, 1,
 'personal_1_2m', 30, 'mid_6_12m',
 2, 7,
 'mid_6_12m_dash', 'mid_1_3y', 0, 1),

-- 7. ถังกลาง 1-3 ปี - Distribution Pool
('mid_1_3y', 'ถังกลาง 1-3 ปี',
 1, NULL,
 366, 1095,
 NULL, NULL,
 'distribution', 7, 1, 1,
 'personal_1_2m', 60, 'mid_1_3y',
 2, 14,
 'mid_1_3y_dash', 'ancient', 0, 1),

-- 8. ถังโบราณ เก่าเก็บ - Distribution Pool
('ancient', 'ถังโบราณ เก่าเก็บ',
 1, NULL,
 1096, NULL,
 NULL, NULL,
 'distribution', 8, 1, 1,
 'personal_1_2m', 90, 'ancient',
 2, 30,
 'ancient_dash', NULL, 0, 1),

-- ==========================================
-- DASHBOARD Tabs (สำหรับ Telesale เห็นหลังแจก) - ถัง 4-8
-- เชื่อมกลับไปหา Distribution pool ด้วย linked_basket_key
-- ==========================================

-- 4. หาคนดูแลใหม่ - Dashboard Tab
('find_new_owner_dash', 'หาคนดูแลใหม่',
 1, NULL,
 91, 180,
 NULL, NULL,
 'dashboard_v2', 4, 1, 1,
 'personal_1_2m', 30, 'waiting_for_match',
 2, 3,
 'find_new_owner', 'mid_6_12m', 0, 1),

-- 5. รอคนมาจีบให้ติด - Dashboard Tab
('waiting_for_match_dash', 'รอคนมาจีบให้ติด',
 1, NULL,
 91, 180,
 NULL, NULL,
 'dashboard_v2', 5, 1, 1,
 'personal_1_2m', 30, 'waiting_for_match',
 3, 3,
 'waiting_for_match', 'mid_6_12m', 0, 1),

-- 6. ถังกลาง 6-12 เดือน - Dashboard Tab
('mid_6_12m_dash', 'ถังกลาง 6-12 เดือน',
 1, NULL,
 181, 365,
 NULL, NULL,
 'dashboard_v2', 6, 1, 1,
 'personal_1_2m', 30, 'mid_6_12m',
 2, 7,
 'mid_6_12m', 'mid_1_3y', 0, 1),

-- 7. ถังกลาง 1-3 ปี - Dashboard Tab
('mid_1_3y_dash', 'ถังกลาง 1-3 ปี',
 1, NULL,
 366, 1095,
 NULL, NULL,
 'dashboard_v2', 7, 1, 1,
 'personal_1_2m', 60, 'mid_1_3y',
 2, 14,
 'mid_1_3y', 'ancient', 0, 1),

-- 8. ถังโบราณ เก่าเก็บ - Dashboard Tab
('ancient_dash', 'ถังโบราณ เก่าเก็บ',
 1, NULL,
 1096, NULL,
 NULL, NULL,
 'dashboard_v2', 8, 1, 1,
 'personal_1_2m', 90, 'ancient',
 2, 30,
 'ancient', NULL, 0, 1),

-- ==========================================
-- SPECIAL: UPSELL (Dashboard Only)
-- ==========================================
-- ถังนี้ไม่ใช้เกณฑ์วันนับจาก Order
-- ลูกค้ามาจาก Order ใหม่ที่ขายได้ → Auto Round-Robin แจกให้ Telesale
-- หายไปเมื่อ Order Status เปลี่ยนจาก pending → picking
-- ==========================================

('upsell', 'Upsell',
 NULL, NULL,              -- ไม่ใช้เกณฑ์ Order count
 NULL, NULL,              -- ไม่ใช้เกณฑ์ Days since order
 NULL, NULL,
 'dashboard_v2', 0, 1, 1, -- display_order = 0 (แสดงก่อน)
 'personal_1_2m', NULL, NULL,  -- เมื่อขายได้ → ส่วนตัว 1-2 เดือน
 0, 0,
 NULL, NULL, 0, 0);       -- ไม่มี loop (auto หายเมื่อ picking)

-- ==========================================
-- Summary:
-- ==========================================
-- Total: 14 basket configs
-- - 3 Dashboard only (ถัง 1-3)
-- - 5 Distribution pools (ถัง 4-8)
-- - 5 Dashboard tabs linked (ถัง 4-8)
-- - 1 Upsell (Dashboard, Auto Round-Robin)
--
-- Upsell Logic (ต้อง implement แยก):
-- 1. Order ใหม่ pending → Auto แจก Telesale แบบ Round-Robin
-- 2. Order status → picking = หายจาก Upsell tab
-- ==========================================
