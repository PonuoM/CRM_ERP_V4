-- =====================================================================
-- DIAGNOSTIC: ลูกค้าที่หาย Owner แต่มี Telesale Activity
-- วิเคราะห์ว่าใครควรได้กลับไปหา Telesale คนเดิม
-- =====================================================================
-- Schema:
--   call_history: uses `date` (not start_time), `caller` (not user_id)
--   order_items: has `parent_order_id`, `creator_id` (NOT in orders table)

-- =========================
-- QUERY 1: ลูกค้าที่ assigned_to = NULL แต่อยู่ถัง Dashboard
-- พร้อมข้อมูล Order ล่าสุด และ Activity ของ Telesale
-- =========================

SELECT 
    c.customer_id,
    c.first_name,
    c.last_name,
    c.phone,
    c.assigned_to,
    c.current_basket_key,
    bc.basket_name,
    bc.target_page,
    
    -- Order ล่าสุด
    o.id AS last_order_id,
    o.order_date AS last_order_date,
    o.creator_id AS order_creator_id,
    u_order.first_name AS order_creator_name,
    
    -- การโทรล่าสุด (ใช้ date และ caller)
    (SELECT MAX(ch.date) 
     FROM call_history ch 
     WHERE ch.customer_id = c.customer_id) AS last_call_time,
    
    (SELECT ch.caller 
     FROM call_history ch 
     WHERE ch.customer_id = c.customer_id 
     ORDER BY ch.date DESC LIMIT 1) AS last_caller_id,
    
    (SELECT CONCAT(u.first_name, ' ', u.last_name)
     FROM call_history ch 
     JOIN users u ON u.id = ch.caller
     WHERE ch.customer_id = c.customer_id 
     ORDER BY ch.date DESC LIMIT 1) AS last_caller_name,
    
    -- Upsell Items จาก order_items (creator_id ต่างจากเจ้าของ order)
    (SELECT COUNT(DISTINCT oi.creator_id) 
     FROM order_items oi 
     JOIN orders ord ON oi.parent_order_id = ord.id
     WHERE ord.customer_id = c.customer_id 
       AND oi.creator_id != ord.creator_id) AS upsell_item_count,
    
    (SELECT oi.creator_id 
     FROM order_items oi 
     JOIN orders ord ON oi.parent_order_id = ord.id
     WHERE ord.customer_id = c.customer_id 
       AND oi.creator_id != ord.creator_id
     ORDER BY oi.id DESC LIMIT 1) AS last_upsell_creator_id,
    
    (SELECT CONCAT(u.first_name, ' ', u.last_name)
     FROM order_items oi 
     JOIN orders ord ON oi.parent_order_id = ord.id
     JOIN users u ON u.id = oi.creator_id
     WHERE ord.customer_id = c.customer_id 
       AND oi.creator_id != ord.creator_id
     ORDER BY oi.id DESC LIMIT 1) AS last_upsell_creator_name,
    
    -- สรุป: ใครควรเป็น owner
    CASE 
        WHEN (SELECT MAX(ch.date) FROM call_history ch WHERE ch.customer_id = c.customer_id) IS NOT NULL THEN 'HAS_CALL - ควรได้คืน Owner'
        WHEN (SELECT COUNT(*) FROM order_items oi JOIN orders ord ON oi.parent_order_id = ord.id WHERE ord.customer_id = c.customer_id AND oi.creator_id != ord.creator_id) > 0 THEN 'HAS_UPSELL - ควรได้คืน Owner'
        ELSE 'NO_ACTIVITY - ต้องเช็คต่อ'
    END AS status_analysis,
    
    -- แนะนำ owner ใหม่ (เลือกจาก caller ล่าสุด หรือ upsell creator ล่าสุด หรือ order creator)
    COALESCE(
        (SELECT ch.caller FROM call_history ch WHERE ch.customer_id = c.customer_id ORDER BY ch.date DESC LIMIT 1),
        (SELECT oi.creator_id FROM order_items oi JOIN orders ord ON oi.parent_order_id = ord.id WHERE ord.customer_id = c.customer_id AND oi.creator_id != ord.creator_id ORDER BY oi.id DESC LIMIT 1),
        o.creator_id
    ) AS recommended_owner_id

FROM customers c
LEFT JOIN basket_config bc ON bc.id = c.current_basket_key
LEFT JOIN orders o ON o.id = (
    SELECT MAX(o2.id) FROM orders o2 WHERE o2.customer_id = c.customer_id
)
LEFT JOIN users u_order ON u_order.id = o.creator_id

WHERE c.assigned_to IS NULL
  AND bc.target_page = 'dashboard_v2'  -- อยู่ถัง Dashboard V2
  AND COALESCE(c.is_blocked, 0) = 0    -- ไม่ถูก block

ORDER BY 
    CASE 
        WHEN (SELECT MAX(ch.date) FROM call_history ch WHERE ch.customer_id = c.customer_id) IS NOT NULL THEN 0
        WHEN (SELECT COUNT(*) FROM order_items oi JOIN orders ord ON oi.parent_order_id = ord.id WHERE ord.customer_id = c.customer_id AND oi.creator_id != ord.creator_id) > 0 THEN 1
        ELSE 2
    END,
    o.order_date DESC;


-- =========================
-- QUERY 2: สรุปจำนวนตาม Status
-- =========================

SELECT 
    CASE 
        WHEN (SELECT MAX(ch.date) FROM call_history ch WHERE ch.customer_id = c.customer_id) IS NOT NULL THEN 'มีประวัติโทร'
        WHEN (SELECT COUNT(*) FROM order_items oi JOIN orders ord ON oi.parent_order_id = ord.id WHERE ord.customer_id = c.customer_id AND oi.creator_id != ord.creator_id) > 0 THEN 'มี Upsell Items'
        ELSE 'ไม่มี Activity'
    END AS activity_status,
    COUNT(*) AS customer_count
FROM customers c
LEFT JOIN basket_config bc ON bc.id = c.current_basket_key
WHERE c.assigned_to IS NULL
  AND bc.target_page = 'dashboard_v2'
  AND COALESCE(c.is_blocked, 0) = 0
GROUP BY activity_status;


-- =========================
-- QUERY 3: รายชื่อที่ควรได้คืน Owner (SELECT ก่อน)
-- =========================

SELECT 
    c.customer_id,
    c.first_name,
    c.phone,
    bc.basket_name,
    COALESCE(
        (SELECT ch.caller FROM call_history ch WHERE ch.customer_id = c.customer_id ORDER BY ch.date DESC LIMIT 1),
        (SELECT oi.creator_id FROM order_items oi JOIN orders ord ON oi.parent_order_id = ord.id WHERE ord.customer_id = c.customer_id AND oi.creator_id != ord.creator_id ORDER BY oi.id DESC LIMIT 1)
    ) AS should_be_owner,
    (SELECT CONCAT(u.first_name, ' ', u.last_name) 
     FROM users u 
     WHERE u.id = COALESCE(
        (SELECT ch.caller FROM call_history ch WHERE ch.customer_id = c.customer_id ORDER BY ch.date DESC LIMIT 1),
        (SELECT oi.creator_id FROM order_items oi JOIN orders ord ON oi.parent_order_id = ord.id WHERE ord.customer_id = c.customer_id AND oi.creator_id != ord.creator_id ORDER BY oi.id DESC LIMIT 1)
     )) AS owner_name
FROM customers c
LEFT JOIN basket_config bc ON bc.id = c.current_basket_key
WHERE c.assigned_to IS NULL
  AND bc.target_page = 'dashboard_v2'
  AND COALESCE(c.is_blocked, 0) = 0
  AND (
      (SELECT ch.caller FROM call_history ch WHERE ch.customer_id = c.customer_id ORDER BY ch.date DESC LIMIT 1) IS NOT NULL
      OR (SELECT oi.creator_id FROM order_items oi JOIN orders ord ON oi.parent_order_id = ord.id WHERE ord.customer_id = c.customer_id AND oi.creator_id != ord.creator_id ORDER BY oi.id DESC LIMIT 1) IS NOT NULL
  );


-- =========================
-- QUERY 4: UPDATE คืน Owner (รัน AFTER ตรวจสอบ Query 3)
-- ⚠️ DANGER: ตรวจสอบให้ดีก่อนรัน!
-- =========================

/*
UPDATE customers c
SET c.assigned_to = COALESCE(
    (SELECT ch.caller FROM call_history ch WHERE ch.customer_id = c.customer_id ORDER BY ch.date DESC LIMIT 1),
    (SELECT oi.creator_id FROM order_items oi JOIN orders ord ON oi.parent_order_id = ord.id WHERE ord.customer_id = c.customer_id AND oi.creator_id != ord.creator_id ORDER BY oi.id DESC LIMIT 1)
),
c.date_assigned = NOW(),
c.lifecycle_status = 'Assigned'
WHERE c.assigned_to IS NULL
  AND c.current_basket_key IN (SELECT id FROM basket_config WHERE target_page = 'dashboard_v2')
  AND COALESCE(c.is_blocked, 0) = 0
  AND (
      (SELECT ch.caller FROM call_history ch WHERE ch.customer_id = c.customer_id ORDER BY ch.date DESC LIMIT 1) IS NOT NULL
      OR (SELECT oi.creator_id FROM order_items oi JOIN orders ord ON oi.parent_order_id = ord.id WHERE ord.customer_id = c.customer_id AND oi.creator_id != ord.creator_id ORDER BY oi.id DESC LIMIT 1) IS NOT NULL
  );
*/
