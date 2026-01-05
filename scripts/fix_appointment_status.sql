-- Fix appointment status values with trailing newline/whitespace
-- Run this script on the production database to clean up imported data

-- First, check what will be affected
SELECT status, HEX(status), LENGTH(status), COUNT(*) as cnt 
FROM appointments 
GROUP BY status, HEX(status);

-- Fix: Remove trailing whitespace and newlines from status
UPDATE appointments 
SET status = TRIM(BOTH '\n' FROM TRIM(BOTH '\r' FROM TRIM(status)))
WHERE status != TRIM(BOTH '\n' FROM TRIM(BOTH '\r' FROM TRIM(status)));

-- Alternative: More aggressive cleanup using REPLACE
-- UPDATE appointments 
-- SET status = REPLACE(REPLACE(TRIM(status), '\n', ''), '\r', '')
-- WHERE status LIKE '%\n' OR status LIKE '%\r' OR status != TRIM(status);

-- Verify the fix
SELECT status, HEX(status), LENGTH(status), COUNT(*) as cnt 
FROM appointments 
GROUP BY status, HEX(status);
