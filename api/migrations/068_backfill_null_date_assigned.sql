-- 2026_07_20_backfill_null_date_assigned.sql
-- Fix customers where assigned_to is NOT NULL but date_assigned is NULL

-- Attempt to backfill from customer_audit_log
UPDATE customers c
SET c.date_assigned = COALESCE(
    (
        SELECT created_at 
        FROM customer_audit_log cal 
        WHERE cal.customer_id = c.customer_id 
          AND cal.field_name = 'assigned_to' 
          AND cal.new_value = c.assigned_to 
        ORDER BY cal.id DESC 
        LIMIT 1
    ),
    NOW()
)
WHERE c.assigned_to IS NOT NULL AND c.date_assigned IS NULL;
