-- Script สำหรับลบข้อมูลการ reconcile COD document JAT-261125-1535 กับ Statement #103
-- รัน script นี้เพื่อ reset ข้อมูลให้สามารถทดสอบใหม่ได้

-- 1. ลบ statement_reconcile_logs ที่เชื่อมกับ statement 103
DELETE srl FROM statement_reconcile_logs srl
INNER JOIN statement_reconcile_batches srb ON srb.id = srl.batch_id
WHERE srl.statement_log_id = 103
  AND srb.notes LIKE '%JAT-261125-1535%';

-- 2. ลบ statement_reconcile_batches ที่เกี่ยวข้อง (ถ้ายังมี logs อยู่จะลบไม่ได้ ต้องลบ logs ก่อน)
-- ตรวจสอบก่อนว่ามี logs เหลืออยู่หรือไม่
DELETE srb FROM statement_reconcile_batches srb
WHERE srb.notes LIKE '%JAT-261125-1535%'
  AND NOT EXISTS (
    SELECT 1 FROM statement_reconcile_logs srl WHERE srl.batch_id = srb.id
  );

-- 3. Reset cod_documents กลับเป็น pending
UPDATE cod_documents 
SET status = 'pending', 
    matched_statement_log_id = NULL, 
    verified_by = NULL, 
    verified_at = NULL,
    updated_at = NOW()
WHERE document_number = 'JAT-261125-1535';

-- 4. Reset cod_records กลับเป็น pending
UPDATE cod_records 
SET status = 'pending',
    updated_at = NOW()
WHERE document_id = (SELECT id FROM cod_documents WHERE document_number = 'JAT-261125-1535');

-- 5. (Optional) Reset orders ที่เกี่ยวข้อง - ถ้าต้องการให้ orders กลับสถานะเดิม
-- ตรวจสอบ orders ก่อนว่ามีอยู่จริงหรือไม่
-- UPDATE orders 
-- SET amount_paid = 0,
--     payment_status = 'PendingVerification',
--     order_status = 'Pending'
-- WHERE id IN ('251126-00032telesale17g-1', '251126-00032telesale17g-2')
--   AND company_id = 1;

-- ตรวจสอบผลลัพธ์
SELECT 'COD Document Status:' as info;
SELECT id, document_number, status, matched_statement_log_id, verified_by, verified_at 
FROM cod_documents 
WHERE document_number = 'JAT-261125-1535';

SELECT 'COD Records Status:' as info;
SELECT cr.id, cr.tracking_number, cr.order_id, cr.status 
FROM cod_records cr
INNER JOIN cod_documents cd ON cd.id = cr.document_id
WHERE cd.document_number = 'JAT-261125-1535';

SELECT 'Statement Reconcile Logs (should be empty):' as info;
SELECT srl.*, srb.document_no 
FROM statement_reconcile_logs srl 
INNER JOIN statement_reconcile_batches srb ON srb.id = srl.batch_id 
WHERE srl.statement_log_id = 103;

SELECT 'Statement Reconcile Batches (should be empty or no notes):' as info;
SELECT srb.* 
FROM statement_reconcile_batches srb 
WHERE srb.notes LIKE '%JAT-261125-1535%';

