-- =====================================================
-- SQL สำหรับตรวจสอบข้อมูล Product Analysis
-- User ID: 100 (นุช [Telesale])
-- ปี: 2026, เดือน: มกราคม (1)
-- Company ID: 1
-- =====================================================

-- 1. ตรวจสอบ Summary (ยอดขายรวม, จำนวนสินค้า, จำนวนออเดอร์, จำนวนลูกค้า)
SELECT 
    'Summary' as section,
    SUM(oi.quantity * oi.price_per_unit) as total_revenue,
    SUM(oi.quantity) as total_quantity,
    COUNT(DISTINCT o.id) as total_orders,
    COUNT(DISTINCT o.customer_id) as total_customers
FROM order_items oi
JOIN orders o ON oi.parent_order_id = o.id
WHERE o.company_id = 1
AND YEAR(o.order_date) = 2026
AND MONTH(o.order_date) = 1
AND o.order_status NOT IN ('Cancelled', 'Returned', 'BadDebt')
AND o.creator_id = 100
AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL);

-- =====================================================
-- 2. Top 5 สินค้า (มูลค่า)
-- =====================================================
SELECT 
    'Top 5 by Value' as section,
    p.id,
    p.name,
    p.sku,
    p.category,
    SUM(oi.quantity * oi.price_per_unit) as total_value,
    SUM(oi.quantity) as total_quantity
FROM order_items oi
JOIN orders o ON oi.parent_order_id = o.id
JOIN products p ON oi.product_id = p.id
WHERE o.company_id = 1
AND YEAR(o.order_date) = 2026
AND MONTH(o.order_date) = 1
AND o.order_status NOT IN ('Cancelled', 'Returned', 'BadDebt')
AND o.creator_id = 100
AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
GROUP BY p.id, p.name, p.sku, p.category
ORDER BY total_value DESC
LIMIT 5;

-- =====================================================
-- 3. Top 5 สินค้า (จำนวน)
-- =====================================================
SELECT 
    'Top 5 by Quantity' as section,
    p.id,
    p.name,
    p.sku,
    p.category,
    SUM(oi.quantity) as total_quantity,
    SUM(oi.quantity * oi.price_per_unit) as total_value
FROM order_items oi
JOIN orders o ON oi.parent_order_id = o.id
JOIN products p ON oi.product_id = p.id
WHERE o.company_id = 1
AND YEAR(o.order_date) = 2026
AND MONTH(o.order_date) = 1
AND o.order_status NOT IN ('Cancelled', 'Returned', 'BadDebt')
AND o.creator_id = 100
AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
GROUP BY p.id, p.name, p.sku, p.category
ORDER BY total_quantity DESC
LIMIT 5;

-- =====================================================
-- 4. ยอดขายตามประเภทลูกค้า (New vs Reorder)
-- แบ่งตาม report_category: กระสอบใหญ่, กระสอบเล็ก, ชีวภัณฑ์, อื่นๆ
-- =====================================================
SELECT 
    'Sales by Category' as section,
    CASE 
        WHEN p.report_category IN ('กระสอบใหญ่', 'กระสอบเล็ก', 'ชีวภัณฑ์') THEN p.report_category
        ELSE 'อื่นๆ'
    END as category_group,
    COALESCE(o.customer_type, 'ไม่ระบุ') as customer_type,
    SUM(oi.quantity * oi.price_per_unit) as revenue,
    SUM(oi.quantity) as quantity,
    COUNT(DISTINCT o.id) as order_count
FROM order_items oi
JOIN orders o ON oi.parent_order_id = o.id
JOIN products p ON oi.product_id = p.id
WHERE o.company_id = 1
AND YEAR(o.order_date) = 2026
AND MONTH(o.order_date) = 1
AND o.order_status NOT IN ('Cancelled', 'Returned', 'BadDebt')
AND o.creator_id = 100
AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
GROUP BY category_group, customer_type
ORDER BY category_group, customer_type;

-- =====================================================
-- 5. ของแถม (Freebie) Summary
-- =====================================================
SELECT 
    'Freebie Summary' as section,
    SUM(oi.quantity) as total_quantity,
    COUNT(DISTINCT o.id) as total_orders
FROM order_items oi
JOIN orders o ON oi.parent_order_id = o.id
WHERE o.company_id = 1
AND YEAR(o.order_date) = 2026
AND MONTH(o.order_date) = 1
AND o.order_status NOT IN ('Cancelled', 'Returned', 'BadDebt')
AND o.creator_id = 100
AND oi.is_freebie = 1;

-- =====================================================
-- 6. ของแถม (Freebie) แยกตาม Category
-- =====================================================
SELECT 
    'Freebie by Category' as section,
    COALESCE(p.report_category, p.category, 'ไม่ระบุ') as category_group,
    COALESCE(o.customer_type, 'ไม่ระบุ') as customer_type,
    SUM(oi.quantity) as quantity,
    COUNT(DISTINCT o.id) as order_count
FROM order_items oi
JOIN orders o ON oi.parent_order_id = o.id
JOIN products p ON oi.product_id = p.id
WHERE o.company_id = 1
AND YEAR(o.order_date) = 2026
AND MONTH(o.order_date) = 1
AND o.order_status NOT IN ('Cancelled', 'Returned', 'BadDebt')
AND o.creator_id = 100
AND oi.is_freebie = 1
GROUP BY category_group, customer_type
ORDER BY category_group, customer_type;

-- =====================================================
-- 7. ยอดขายรายเดือน (Monthly Sales Breakdown) - ม.ค. 2026 เท่านั้น
-- =====================================================
SELECT 
    'Monthly Sales Breakdown' as section,
    p.id as product_id,
    p.name as product_name,
    p.sku,
    p.category,
    MONTH(o.order_date) as month,
    SUM(oi.quantity) as quantity,
    SUM(oi.quantity * oi.price_per_unit) as revenue
FROM order_items oi
JOIN orders o ON oi.parent_order_id = o.id
JOIN products p ON oi.product_id = p.id
WHERE o.company_id = 1
AND YEAR(o.order_date) = 2026
AND o.order_status NOT IN ('Cancelled', 'Returned', 'BadDebt')
AND o.creator_id = 100
AND (oi.is_freebie = 0 OR oi.is_freebie IS NULL)
GROUP BY p.id, p.name, p.sku, p.category, MONTH(o.order_date)
ORDER BY revenue DESC;

-- =====================================================
-- 8. ตรวจสอบข้อมูล user_id 100
-- =====================================================
SELECT 
    'User Info' as section,
    id, first_name, last_name, role, supervisor_id, company_id, status
FROM users
WHERE id = 100;

-- =====================================================
-- 9. ดู Order Status Distribution - เช็คว่ามี Cancelled orders กี่รายการ
-- =====================================================
SELECT 
    'Order Status Distribution' as section,
    o.order_status,
    COUNT(*) as order_count,
    SUM(oi.quantity) as total_items,
    SUM(oi.quantity * oi.price_per_unit) as total_value
FROM orders o
LEFT JOIN order_items oi ON o.id = oi.parent_order_id
WHERE o.company_id = 1
AND YEAR(o.order_date) = 2026
AND MONTH(o.order_date) = 1
AND o.creator_id = 100
GROUP BY o.order_status
ORDER BY order_count DESC;
