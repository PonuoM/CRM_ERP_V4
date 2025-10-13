-- SQL script to convert users from old schema to new schema
-- This script will:
-- 1. Create a temporary table with the converted data
-- 2. Insert data into the new users table
-- 3. Clean up the temporary table

-- Step 1: Create a temporary table with converted data
CREATE TEMPORARY TABLE temp_converted_users AS
SELECT 
    user_id AS id,
    username,
    -- For passwords, we'll use a default password since we can't decrypt hashes
    -- In a real scenario, you would need to either:
    -- 1. Ask users to reset their passwords
    -- 2. Have a list of original passwords
    -- 3. Use a password migration tool
    'temp123' AS password,  -- Default temporary password
    CASE 
        WHEN LOCATE(' ', full_name) > 0 
        THEN SUBSTRING_INDEX(full_name, ' ', 1)
        ELSE full_name
    END AS first_name,
    CASE 
        WHEN LOCATE(' ', full_name) > 0 
        THEN SUBSTRING(full_name, LOCATE(' ', full_name) + 1)
        ELSE ''
    END AS last_name,
    email,
    phone,
    CASE role_id
        WHEN 1 THEN 'Super Admin'
        WHEN 2 THEN 'Admin Control'
        WHEN 3 THEN 'Supervisor Telesale'
        WHEN 4 THEN 'Telesale'
        WHEN 5 THEN 'Admin Page'
        WHEN 6 THEN 'Marketing'
        WHEN 7 THEN 'Backoffice'
        ELSE 'Telesale'
    END AS role,
    1 AS company_id,  -- Set all users to company_id = 1 as requested
    NULL AS team_id,  -- Not available in old schema
    supervisor_id,
    CASE is_active
        WHEN 1 THEN 'active'
        ELSE 'inactive'
    END AS status,
    created_at,
    updated_at,
    last_login,
    0 AS login_count  -- Default value
FROM users;

-- Step 2: Insert data into the new users table
-- This will skip any existing users with the same ID
INSERT IGNORE INTO users (
    id, username, password, first_name, last_name, email, phone, 
    role, company_id, team_id, supervisor_id, status, 
    created_at, updated_at, last_login, login_count
)
SELECT 
    id, username, password, first_name, last_name, email, phone, 
    role, company_id, team_id, supervisor_id, status, 
    created_at, updated_at, last_login, login_count
FROM temp_converted_users;

-- Step 3: Clean up
DROP TEMPORARY TABLE temp_converted_users;

-- Note: All users have been set with a temporary password 'temp123'
-- You should ask users to change their passwords after migration
-- Or update them individually if you know the original passwords

-- Example of updating a specific user's password:
-- UPDATE users SET password = 'original_password' WHERE id = 1;
