-- Disable COD validation triggers to fix save error
-- Issue: Trigger validates totals during intermediate steps of update, causing false failures
-- Solution: Remove database-level triggers and rely on application-level validation

DROP TRIGGER IF EXISTS trg_order_boxes_bi_enforce;
DROP TRIGGER IF EXISTS trg_order_boxes_bu_enforce;

SELECT 'Successfully disabled order_boxes triggers.' AS Status;
