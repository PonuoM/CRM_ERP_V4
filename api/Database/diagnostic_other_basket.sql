-- ================================================================
-- SQL: หา other_basket คืออะไร (Basket IDs ที่ไม่ได้ระบุไว้)
-- ================================================================

-- หาว่า other_basket คือ basket IDs อะไรบ้าง
SELECT 
    c.current_basket_key AS basket_id,
    bc.basket_name,
    bc.basket_key,
    bc.target_page,
    COUNT(*) AS customer_count
FROM customers c
LEFT JOIN basket_config bc ON bc.id = c.current_basket_key AND bc.company_id = 1
WHERE c.company_id = 1
  AND c.assigned_to IS NOT NULL
  AND c.assigned_to != 0
  AND c.current_basket_key NOT IN (39, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51)
  AND c.current_basket_key IS NOT NULL
GROUP BY c.current_basket_key, bc.basket_name, bc.basket_key, bc.target_page
ORDER BY customer_count DESC;

-- ดู basket_config ทั้งหมดเพื่อเปรียบเทียบ
SELECT id, basket_key, basket_name, target_page, is_active
FROM basket_config 
WHERE company_id = 1
ORDER BY id;
