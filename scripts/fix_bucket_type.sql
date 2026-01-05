-- Fix bucket_type Values
-- Correct values are: assigned, waiting, ready, blocked

-- Fix all bucket_type based on correct logic:
-- blocked = ถูกบล็อค (is_blocked = 1) - check first priority
-- waiting = ตะกร้าพัก (is_in_waiting_basket = 1)
-- assigned = มีผู้ดูแล (assigned_to IS NOT NULL)
-- ready = ตะกร้ารอแจก (assigned_to IS NULL AND is_in_waiting_basket = 0)

-- First, fix any 'unassigned' to 'ready'
UPDATE customers SET bucket_type = 'ready' WHERE bucket_type = 'unassigned';

-- Now fix all bucket_type based on correct logic
UPDATE customers 
SET bucket_type = CASE
    WHEN COALESCE(is_blocked, 0) = 1 THEN 'blocked'
    WHEN COALESCE(is_in_waiting_basket, 0) = 1 THEN 'waiting'
    WHEN assigned_to IS NOT NULL THEN 'assigned'
    ELSE 'ready'
END
WHERE bucket_type IS NULL
   OR bucket_type NOT IN ('assigned', 'waiting', 'ready', 'blocked')
   OR bucket_type <> CASE
        WHEN COALESCE(is_blocked, 0) = 1 THEN 'blocked'
        WHEN COALESCE(is_in_waiting_basket, 0) = 1 THEN 'waiting'
        WHEN assigned_to IS NOT NULL THEN 'assigned'
        ELSE 'ready'
   END;

-- Verify the fix
SELECT bucket_type, COUNT(*) as count FROM customers GROUP BY bucket_type;
