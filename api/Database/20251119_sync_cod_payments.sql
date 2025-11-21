-- Migration: Sync COD payments back into orders from cod_records
-- This script aggregates every COD record by tracking number,
-- maps it to the parent order via order_tracking_numbers, and updates
-- orders.amount_paid / payment_status accordingly.

SET @has_cod_records =
  (SELECT COUNT(*)
     FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = 'cod_records');

SET @has_tracking_table =
  (SELECT COUNT(*)
     FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = 'order_tracking_numbers');

-- Only run when both tables exist
SET @sql = IF(
  @has_cod_records > 0 AND @has_tracking_table > 0,
  'WITH cod_totals AS (
      SELECT
        otn.parent_order_id AS order_id,
        SUM(cr.received_amount) AS total_received
      FROM cod_records cr
      JOIN order_tracking_numbers otn
        ON otn.tracking_number = cr.tracking_number
      GROUP BY otn.parent_order_id
    )
    UPDATE orders o
    JOIN cod_totals ct ON ct.order_id = o.id
    SET
      o.amount_paid = ct.total_received,
      o.payment_status = CASE
        WHEN ct.total_received >= IFNULL(o.total_amount, 0) THEN ''Paid''
        ELSE ''PendingVerification''
      END;',
  'SELECT ''Skipping COD payment sync - missing cod_records or order_tracking_numbers'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT ''COD payment sync completed'' AS message;
