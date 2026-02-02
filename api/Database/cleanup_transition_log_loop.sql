-- =====================================================
-- Cleanup Basket Transition Log: Remove 52↔53 Loop Entries
-- Date: 2026-02-01
-- =====================================================

-- Step 1: Preview จำนวน records ที่จะลบ
SELECT 
    'Records to delete' as action,
    COUNT(*) as count,
    from_basket_key,
    to_basket_key
FROM basket_transition_log 
WHERE (from_basket_key = 52 AND to_basket_key = 53) 
   OR (from_basket_key = 53 AND to_basket_key = 52)
GROUP BY from_basket_key, to_basket_key;

-- Step 2: ดูว่ามีลูกค้ากี่คนที่โดน loop
SELECT 
    'Affected customers' as action,
    COUNT(DISTINCT customer_id) as customer_count
FROM basket_transition_log 
WHERE (from_basket_key = 52 AND to_basket_key = 53) 
   OR (from_basket_key = 53 AND to_basket_key = 52);

-- Step 3: ดู records ทั้งหมดของ customer 316373 ที่เป็น loop
SELECT * FROM basket_transition_log 
WHERE customer_id = 316373 
  AND ((from_basket_key = 52 AND to_basket_key = 53) 
       OR (from_basket_key = 53 AND to_basket_key = 52))
ORDER BY created_at DESC
LIMIT 50;

-- =====================================================
-- DANGER ZONE: Execute below to DELETE
-- =====================================================

-- Option A: ลบเฉพาะของ customer 316373
-- DELETE FROM basket_transition_log 
-- WHERE customer_id = 316373 
--   AND ((from_basket_key = 52 AND to_basket_key = 53) 
--        OR (from_basket_key = 53 AND to_basket_key = 52));

-- Option B: ลบทั้งหมดที่เป็น 52↔53 loop
-- DELETE FROM basket_transition_log 
-- WHERE (from_basket_key = 52 AND to_basket_key = 53) 
--    OR (from_basket_key = 53 AND to_basket_key = 52);

-- =====================================================
-- Verify after delete
-- =====================================================
-- SELECT COUNT(*) as remaining FROM basket_transition_log 
-- WHERE (from_basket_key = 52 AND to_basket_key = 53) 
--    OR (from_basket_key = 53 AND to_basket_key = 52);
