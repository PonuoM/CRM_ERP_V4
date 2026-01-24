-- ================================================================
-- SQL Diagnostic: Distribution Basket Analysis (Company 1)
-- Purpose: ตรวจสอบยอดลูกค้าในแต่ละถัง (Distribution Baskets)
-- ================================================================

-- ================================================================
-- 1. แสดง Basket Config ทั้งหมด (Distribution)
-- ================================================================
SELECT 
    id AS basket_id,
    basket_key,
    basket_name,
    target_page,
    min_days_since_order,
    max_days_since_order,
    linked_basket_key,
    is_active
FROM basket_config 
WHERE company_id = 1 
  AND target_page = 'distribution'
ORDER BY display_order;

-- ================================================================
-- 2. นับลูกค้าในแต่ละถัง สำหรับ Company 1
-- ================================================================
SELECT 
    bc.id AS basket_id,
    bc.basket_key,
    bc.basket_name,
    COUNT(c.customer_id) AS total_customers,
    SUM(CASE WHEN c.assigned_to IS NULL OR c.assigned_to = 0 THEN 1 ELSE 0 END) AS available_for_distribution,
    SUM(CASE WHEN c.assigned_to IS NOT NULL AND c.assigned_to != 0 THEN 1 ELSE 0 END) AS already_assigned
FROM basket_config bc
LEFT JOIN customers c ON c.current_basket_key = bc.id AND c.company_id = 1
WHERE bc.company_id = 1 
  AND bc.target_page = 'distribution'
  AND bc.is_active = 1
GROUP BY bc.id, bc.basket_key, bc.basket_name
ORDER BY bc.display_order;

-- ================================================================
-- 3. ลูกค้าที่ยังไม่ได้ assign ถัง (current_basket_key = NULL) - Company 1
-- ================================================================
SELECT 
    COUNT(*) AS customers_without_basket
FROM customers c
WHERE c.company_id = 1
  AND c.current_basket_key IS NULL;

-- ================================================================
-- 4. สรุป current_basket_key ทั้งหมดใน Company 1
-- ================================================================
SELECT 
    c.current_basket_key AS basket_id,
    COALESCE(bc.basket_name, CONCAT('Unknown (ID:', c.current_basket_key, ')')) AS basket_name,
    bc.target_page,
    COUNT(*) AS customer_count,
    SUM(CASE WHEN c.assigned_to IS NULL OR c.assigned_to = 0 THEN 1 ELSE 0 END) AS unassigned,
    SUM(CASE WHEN c.assigned_to IS NOT NULL AND c.assigned_to != 0 THEN 1 ELSE 0 END) AS assigned
FROM customers c
LEFT JOIN basket_config bc ON bc.id = c.current_basket_key AND bc.company_id = 1
WHERE c.company_id = 1
GROUP BY c.current_basket_key, bc.basket_name, bc.target_page
ORDER BY customer_count DESC;

-- ================================================================
-- 5. ตัวอย่างลูกค้า 10 คนใน Distribution Baskets (Company 1)
-- ================================================================
SELECT 
    c.customer_id,
    CONCAT(c.first_name, ' ', c.last_name) AS full_name,
    c.phone,
    c.current_basket_key,
    bc.basket_name,
    c.assigned_to,
    c.last_order_date,
    DATEDIFF(CURDATE(), c.last_order_date) AS days_since_order,
    c.basket_entered_date
FROM customers c
LEFT JOIN basket_config bc ON bc.id = c.current_basket_key AND bc.company_id = 1
WHERE c.company_id = 1
  AND bc.target_page = 'distribution'
  AND (c.assigned_to IS NULL OR c.assigned_to = 0)
LIMIT 10;

-- ================================================================
-- 6. เปรียบเทียบ: ถังใน Dashboard VS Distribution (Company 1)
-- ================================================================
SELECT 
    bc.target_page,
    bc.id AS basket_id,
    bc.basket_key,
    bc.basket_name,
    COUNT(c.customer_id) AS total_company_1
FROM basket_config bc
LEFT JOIN customers c ON c.current_basket_key = bc.id AND c.company_id = 1
WHERE bc.company_id = 1 
  AND bc.is_active = 1
GROUP BY bc.target_page, bc.id, bc.basket_key, bc.basket_name
ORDER BY bc.target_page, bc.display_order;
