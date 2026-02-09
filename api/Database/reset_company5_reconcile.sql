-- ============================================================
-- Reset ข้อมูล Reconciliation ทั้งหมดของ Company 5 (Test)
-- เพื่อทดสอบ Bank Audit ใหม่
-- ============================================================

-- 1. Reset orders กลับเป็นสถานะก่อน reconcile
--    (คืน payment_status, order_status, amount_paid)
UPDATE orders 
SET payment_status = 'Pending',
    order_status = 'Confirmed',
    amount_paid = 0
WHERE company_id = 5
  AND order_status NOT IN ('Cancelled', 'Returned');

-- 2. ลบ statement_reconcile_logs (ข้อมูลจับคู่)
DELETE srl FROM statement_reconcile_logs srl
INNER JOIN statement_reconcile_batches srb ON srb.id = srl.batch_id
WHERE srb.company_id = 5;

-- 3. ลบ statement_reconcile_batches 
DELETE FROM statement_reconcile_batches
WHERE company_id = 5;

-- 4. Reset cod_documents กลับเป็นยังไม่ verified
UPDATE cod_documents
SET verified_at = NULL,
    verified_by = NULL,
    status = 'pending',
    matched_statement_log_id = NULL
WHERE company_id = 5;

-- 5. Reset cod_records กลับเป็น pending
UPDATE cod_records cr
INNER JOIN cod_documents cd ON cd.id = cr.document_id
SET cr.status = 'pending'
WHERE cd.company_id = 5;

-- ============================================================
-- ตรวจสอบหลัง reset
-- ============================================================
SELECT 'orders' as tbl, COUNT(*) as cnt, 
       GROUP_CONCAT(DISTINCT order_status) as statuses,
       GROUP_CONCAT(DISTINCT payment_status) as pay_statuses
FROM orders WHERE company_id = 5
UNION ALL
SELECT 'reconcile_logs', COUNT(*), NULL, NULL
FROM statement_reconcile_logs srl
INNER JOIN statement_reconcile_batches srb ON srb.id = srl.batch_id
WHERE srb.company_id = 5
UNION ALL
SELECT 'reconcile_batches', COUNT(*), NULL, NULL
FROM statement_reconcile_batches WHERE company_id = 5
UNION ALL
SELECT 'cod_documents', COUNT(*), GROUP_CONCAT(DISTINCT status), NULL
FROM cod_documents WHERE company_id = 5;
