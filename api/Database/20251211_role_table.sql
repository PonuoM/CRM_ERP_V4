-- ============================================================================
-- Migration: Role Management System with User-Level Permission Override
-- File: 20251211_role_table.sql
-- Created: 2025-12-11
-- Description: 
--   1. สร้างตาราง roles สำหรับจัดการ Role แบบ Master Data
--   2. เพิ่ม role_id ใน users และ Migrate ข้อมูลจาก role (VARCHAR)
--   3. สร้างตาราง user_permission_overrides สำหรับ Override สิทธิ์เฉพาะ User
--   4. รองรับการจัดการสิทธิ์แบบละเอียด (เช่น Backoffice เห็นแค่ขนส่ง, ใส่ Tracking)
-- ============================================================================

-- ============================================================================
-- STEP 1: Create roles table (Master Data)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `roles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(64) NOT NULL UNIQUE COMMENT 'รหัส Role เช่น super_admin, backoffice',
  `name` VARCHAR(128) NOT NULL COMMENT 'ชื่อ Role ภาษาไทย/อังกฤษ',
  `description` TEXT COMMENT 'คำอธิบาย Role',
  `is_active` BOOLEAN DEFAULT TRUE COMMENT 'สถานะใช้งาน',
  `is_system` BOOLEAN DEFAULT FALSE COMMENT 'เป็น Role ระบบ (ห้ามลบ)',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='ตาราง Master สำหรับจัดการ Roles';

-- ============================================================================
-- STEP 2: Insert existing roles from current system
-- ============================================================================
INSERT INTO `roles` (`code`, `name`, `description`, `is_active`, `is_system`) VALUES
('super_admin', 'Super Admin', 'ผู้ดูแลระบบสูงสุด - สิทธิ์ทุกอย่าง', TRUE, TRUE),
('admin_control', 'Admin Control', 'ผู้ดูแลระบบ - จัดการข้อมูลหลักและสิทธิ์', TRUE, TRUE),
('admin_page', 'Admin Page', 'ผู้ดูแลเพจ - จัดการออเดอร์และลูกค้า', TRUE, FALSE),
('backoffice', 'Backoffice', 'ฝ่ายปฏิบัติการ - จัดการออเดอร์และการจัดส่ง', TRUE, FALSE),
('marketing', 'Marketing', 'ฝ่ายการตลาด - จัดการเพจและสินค้า', TRUE, FALSE),
('supervisor_telesale', 'Supervisor Telesale', 'หัวหน้าทีมขาย - ดูแลทีมและรายงาน', TRUE, FALSE),
('telesale', 'Telesale', 'พนักงานขาย - รับออเดอร์และติดตามลูกค้า', TRUE, FALSE),
('finance', 'Finance', 'ฝ่ายการเงิน - จัดการการเงินและบัญชี', TRUE, FALSE)
ON DUPLICATE KEY UPDATE 
  `name` = VALUES(`name`),
  `description` = VALUES(`description`);

-- ============================================================================
-- STEP 3: Add role_id to users table (keep old role column for now)
-- ============================================================================
ALTER TABLE `users` 
ADD COLUMN `role_id` INT NULL COMMENT 'อ้างอิง roles.id' AFTER `role`,
ADD INDEX `idx_users_role_id` (`role_id`),
ADD CONSTRAINT `fk_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE RESTRICT;

-- ============================================================================
-- STEP 4: Migrate existing role data to role_id
-- ============================================================================
-- Map current VARCHAR role to role_id
UPDATE `users` u
INNER JOIN `roles` r ON u.`role` = r.`name`
SET u.`role_id` = r.`id`
WHERE u.`role_id` IS NULL;

-- Handle any unmapped roles (create as new roles if needed)
INSERT INTO `roles` (`code`, `name`, `description`, `is_active`, `is_system`)
SELECT 
  LOWER(REPLACE(REPLACE(u.`role`, ' ', '_'), '-', '_')) as code,
  u.`role` as name,
  CONCAT('Auto-migrated role: ', u.`role`) as description,
  TRUE as is_active,
  FALSE as is_system
FROM `users` u
LEFT JOIN `roles` r ON u.`role` = r.`name`
WHERE r.`id` IS NULL 
  AND u.`role` IS NOT NULL 
  AND u.`role` != ''
GROUP BY u.`role`
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- Update any remaining users with role_id
UPDATE `users` u
INNER JOIN `roles` r ON u.`role` = r.`name`
SET u.`role_id` = r.`id`
WHERE u.`role_id` IS NULL AND u.`role` IS NOT NULL;

-- ============================================================================
-- STEP 5: Create user_permission_overrides table
-- ============================================================================
CREATE TABLE IF NOT EXISTS `user_permission_overrides` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL COMMENT 'อ้างอิง users.id',
  `permission_key` VARCHAR(128) NOT NULL COMMENT 'รหัสสิทธิ์ เช่น nav.orders, nav.bulk_tracking',
  `permission_value` JSON NOT NULL COMMENT 'ค่าสิทธิ์ เช่น {"view": true, "use": false}',
  `notes` TEXT COMMENT 'หมายเหตุการ Override',
  `created_by` INT COMMENT 'ผู้สร้าง',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_user_permission` (`user_id`, `permission_key`),
  INDEX `idx_user_permission_user` (`user_id`),
  CONSTRAINT `fk_user_permission_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_permission_creator` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Override สิทธิ์เฉพาะ User - ใช้เมื่อต้องการให้ User มีสิทธิ์ต่างจาก Role';

-- ============================================================================
-- STEP 6: Modify role_permissions table structure (optional)
-- ============================================================================
-- Add metadata columns to role_permissions if not exists
ALTER TABLE `role_permissions`
ADD COLUMN `description` TEXT COMMENT 'คำอธิบาย Permission Set' AFTER `data`,
ADD COLUMN `updated_by` INT COMMENT 'ผู้แก้ไขล่าสุด' AFTER `description`,
ADD COLUMN `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER `updated_by`,
ADD INDEX `idx_role_permissions_updated` (`updated_at`);

-- ============================================================================
-- STEP 7: Create indexes for performance
-- ============================================================================
CREATE INDEX `idx_roles_code` ON `roles`(`code`);
CREATE INDEX `idx_roles_active` ON `roles`(`is_active`);
CREATE INDEX `idx_user_overrides_key` ON `user_permission_overrides`(`permission_key`);

-- ============================================================================
-- STEP 8: Insert default permissions for new roles
-- ============================================================================
-- Make sure all roles have their permissions in role_permissions table
INSERT INTO `role_permissions` (`role`, `data`, `description`) 
SELECT 
  r.`code`,
  COALESCE(rp.`data`, '{}'),
  CONCAT('Permissions for ', r.`name`)
FROM `roles` r
LEFT JOIN `role_permissions` rp ON rp.`role` = r.`code`
WHERE rp.`role` IS NULL
ON DUPLICATE KEY UPDATE `role` = VALUES(`role`);

-- ============================================================================
-- STEP 9: Create view for easy permission lookup
-- ============================================================================
CREATE OR REPLACE VIEW `v_user_effective_permissions` AS
SELECT 
  u.`id` as user_id,
  u.`username`,
  u.`first_name`,
  u.`last_name`,
  r.`id` as role_id,
  r.`code` as role_code,
  r.`name` as role_name,
  rp.`data` as role_permissions,
  GROUP_CONCAT(
    CONCAT(upo.`permission_key`, ':', upo.`permission_value`) 
    SEPARATOR '||'
  ) as user_overrides
FROM `users` u
LEFT JOIN `roles` r ON u.`role_id` = r.`id`
LEFT JOIN `role_permissions` rp ON rp.`role` = r.`code`
LEFT JOIN `user_permission_overrides` upo ON upo.`user_id` = u.`id`
WHERE u.`status` = 'active'
GROUP BY u.`id`, r.`id`, rp.`data`;

-- ============================================================================
-- EXAMPLES: How to use permission overrides
-- ============================================================================

-- Example 1: Backoffice User 1 เห็นแค่เมนู "ขนส่ง"
-- INSERT INTO `user_permission_overrides` (`user_id`, `permission_key`, `permission_value`, `notes`) VALUES
-- (1651, 'nav.orders', '{"view": false, "use": false}', 'ปิดเมนู Orders'),
-- (1651, 'nav.manage_orders', '{"view": true, "use": true}', 'เปิดแค่ Manage Orders (ขนส่ง)'),
-- (1651, 'nav.bulk_tracking', '{"view": false, "use": false}', 'ปิด Bulk Tracking'),
-- (1651, 'nav.debt', '{"view": false, "use": false}', 'ปิด Debt');

-- Example 2: Backoffice User 2 เห็นแค่ "ใส่ Tracking"
-- INSERT INTO `user_permission_overrides` (`user_id`, `permission_key`, `permission_value`, `notes`) VALUES
-- (1652, 'nav.orders', '{"view": false, "use": false}', 'ปิดเมนู Orders'),
-- (1652, 'nav.manage_orders', '{"view": false, "use": false}', 'ปิด Manage Orders'),
-- (1652, 'nav.bulk_tracking', '{"view": true, "use": true}', 'เปิดแค่ Bulk Tracking'),
-- (1652, 'nav.debt', '{"view": false, "use": false}', 'ปิด Debt');

-- Example 3: ลบ Override กลับไปใช้ Role Default
-- DELETE FROM `user_permission_overrides` WHERE `user_id` = 1651;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check all roles
-- SELECT * FROM `roles` ORDER BY `id`;

-- Check users with their roles
-- SELECT u.id, u.username, u.first_name, u.last_name, u.role as old_role, r.code, r.name 
-- FROM users u 
-- LEFT JOIN roles r ON u.role_id = r.id
-- LIMIT 20;

-- Check user permission overrides
-- SELECT u.username, upo.permission_key, upo.permission_value, upo.notes
-- FROM user_permission_overrides upo
-- JOIN users u ON upo.user_id = u.id
-- ORDER BY u.username, upo.permission_key;

-- Get effective permissions for a user (combine role + overrides)
-- SELECT * FROM v_user_effective_permissions WHERE user_id = 1;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- IMPORTANT NOTES:
-- 1. Column users.role (VARCHAR) is kept for backward compatibility
-- 2. New system uses users.role_id (INT) instead
-- 3. Permission override ทำงานแบบ: User Override > Role Permission > Default Deny
-- 4. ใช้ view v_user_effective_permissions สำหรับดึงข้อมูล Permission รวม
-- ============================================================================
