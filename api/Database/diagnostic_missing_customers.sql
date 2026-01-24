-- ================================================================
-- SQL Diagnostic: Customer count per Agent per Basket (Pivot Style)
-- แสดงยอดลูกค้าแยกตามถัง ของแต่ละ Agent
-- ================================================================

-- ================================================================
-- แสดงแบบ Pivot: แต่ละ Agent มีลูกค้าในแต่ละถังเท่าไหร่
-- ================================================================
SELECT 
    u.id AS agent_id,
    CONCAT(u.first_name, ' ', u.last_name) AS agent_name,
    COUNT(*) AS total_assigned,
    
    -- NULL basket
    SUM(CASE WHEN c.current_basket_key IS NULL THEN 1 ELSE 0 END) AS `NULL_basket`,
    
    -- Personal Basket (ID 39)
    SUM(CASE WHEN c.current_basket_key = 39 THEN 1 ELSE 0 END) AS `personal_39`,
    
    -- Distribution baskets
    SUM(CASE WHEN c.current_basket_key = 41 THEN 1 ELSE 0 END) AS `find_new_owner_41`,
    SUM(CASE WHEN c.current_basket_key = 42 THEN 1 ELSE 0 END) AS `waiting_match_42`,
    SUM(CASE WHEN c.current_basket_key = 43 THEN 1 ELSE 0 END) AS `mid_6_12m_43`,
    SUM(CASE WHEN c.current_basket_key = 44 THEN 1 ELSE 0 END) AS `mid_1_3y_44`,
    SUM(CASE WHEN c.current_basket_key = 45 THEN 1 ELSE 0 END) AS `ancient_45`,
    
    -- Dashboard baskets (ถ้ามี)
    SUM(CASE WHEN c.current_basket_key = 46 THEN 1 ELSE 0 END) AS `dash_new_46`,
    SUM(CASE WHEN c.current_basket_key = 47 THEN 1 ELSE 0 END) AS `dash_waiting_47`,
    SUM(CASE WHEN c.current_basket_key = 48 THEN 1 ELSE 0 END) AS `dash_6_12m_48`,
    SUM(CASE WHEN c.current_basket_key = 49 THEN 1 ELSE 0 END) AS `dash_1_3y_49`,
    SUM(CASE WHEN c.current_basket_key = 50 THEN 1 ELSE 0 END) AS `dash_ancient_50`,
    SUM(CASE WHEN c.current_basket_key = 51 THEN 1 ELSE 0 END) AS `personal_new_51`,
    
    -- Other (ไม่ตรงกับด้านบน)
    SUM(CASE WHEN c.current_basket_key NOT IN (39,41,42,43,44,45,46,47,48,49,50,51) AND c.current_basket_key IS NOT NULL THEN 1 ELSE 0 END) AS `other_basket`
    
FROM customers c
JOIN users u ON c.assigned_to = u.id
WHERE c.company_id = 1
GROUP BY u.id, u.first_name, u.last_name
ORDER BY total_assigned DESC
LIMIT 20;

-- ================================================================
-- ตรวจสอบ: Basket IDs ที่มีอยู่จริงในระบบ
-- ================================================================
SELECT id, basket_key, basket_name, target_page 
FROM basket_config 
WHERE company_id = 1 AND is_active = 1 
ORDER BY id;

-- ================================================================
-- สรุปรวม: ลูกค้าที่ถูก assign แยกตามถัง (ทุก agent รวมกัน)
-- ================================================================
SELECT 
    c.current_basket_key AS basket_id,
    bc.basket_name,
    bc.basket_key,
    bc.target_page,
    COUNT(*) AS assigned_customers
FROM customers c
LEFT JOIN basket_config bc ON bc.id = c.current_basket_key AND bc.company_id = 1
WHERE c.company_id = 1
  AND c.assigned_to IS NOT NULL
  AND c.assigned_to != 0
GROUP BY c.current_basket_key, bc.basket_name, bc.basket_key, bc.target_page
ORDER BY assigned_customers DESC;
