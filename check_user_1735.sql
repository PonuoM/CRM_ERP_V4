-- =============================================
-- SQL สำหรับตรวจสอบและแก้ไข role_id = NULL
-- รันใน phpMyAdmin ทีละ query
-- =============================================

-- =============================================
-- 1) ตรวจสอบ Users ทั้งหมดที่ role_id = NULL แต่เป็น Telesale
-- =============================================
SELECT id, username, first_name, last_name, role, role_id, status
FROM users
WHERE role_id IS NULL 
  AND role IN ('Telesale', 'Supervisor Telesale')
ORDER BY status, id;

-- =============================================
-- 2) ตรวจสอบ User 1735 โดยเฉพาะ
-- =============================================
SELECT id, username, first_name, last_name, role, role_id, status, company_id, team_id
FROM users
WHERE id = 1735;

-- =============================================
-- 3) [OPTIONAL] แก้ data: UPDATE role_id ให้ users ที่เป็น Telesale แต่ role_id = NULL
-- ⚠️ ตรวจสอบผลจาก Query 1 ก่อนรัน!
-- =============================================
-- UPDATE users SET role_id = 7 WHERE role IN ('telesale', 'telesale_senior') AND role_id IS NULL;

-- =============================================
-- 4) ตรวจสอบ basket_transition_log ของลูกค้า 242358 
--    (เคสตัวอย่างที่ user แจ้ง)
-- =============================================
SELECT 
    btl.id,
    btl.customer_id,
    btl.from_basket_key,
    btl.to_basket_key,
    btl.transition_type,
    btl.assigned_to_old,
    btl.assigned_to_new,
    btl.triggered_by,
    btl.order_id,
    btl.notes,
    btl.created_at
FROM basket_transition_log btl
WHERE btl.customer_id = 242358
ORDER BY btl.created_at DESC
LIMIT 20;

-- =============================================
-- 5) ตรวจสอบว่ามี Orders อื่นที่ได้รับผลกระทบจาก bug นี้มั้ย
--    (Orders ที่ Telesale role_id=NULL สร้าง แล้วถูก route ผิดเป็น admin)
-- =============================================
SELECT 
    btl.id,
    btl.customer_id,
    btl.from_basket_key,
    btl.to_basket_key,
    btl.transition_type,
    btl.order_id,
    btl.notes,
    btl.created_at,
    u.id AS user_id,
    u.username,
    u.role,
    u.role_id
FROM basket_transition_log btl
JOIN orders o ON btl.order_id = o.id
JOIN users u ON o.creator_id = u.id
WHERE u.role_id IS NULL
  AND u.role IN ('Telesale', 'Supervisor Telesale')
  AND btl.transition_type LIKE 'pending_admin%'
ORDER BY btl.created_at DESC
LIMIT 50;
