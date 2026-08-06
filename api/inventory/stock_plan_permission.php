<?php
/**
 * สิทธิ์ของระบบ "แพลนรับสินค้า" (Stock Arrival Planning)
 *
 * มีสองระดับ:
 *  - can_manage : เพิ่ม/ลบแพลน และเพิ่มหมายเหตุได้
 *                 = อยู่ใน STOCK_PLAN_ADMIN_ROLES หรือมีแถวใน stock_arrival_plan_managers
 *  - can_grant  : ตั้งสิทธิ์ can_manage ให้บัญชีอื่นได้ (แท็บ "สิทธิ์การจัดการ" ในหน้าตั้งค่า)
 *                 = อยู่ใน STOCK_PLAN_ADMIN_ROLES เท่านั้น
 *
 * คนอื่นที่เข้าเมนูนี้ได้ยังคง "ดูอย่างเดียว" + กำหนดวันที่คาดว่าจะเข้า/ยืนยันรับเข้าได้ตามเดิม
 *
 * เทียบกับฝั่ง frontend: components/StockArrivalPlanning/types.ts (STOCK_PLAN_ADMIN_ROLES)
 * ถ้าจะเพิ่ม/ลด role ต้องแก้ทั้งสองที่
 */

// ใช้ชื่อ role ตาม users.role (ตรงกับ UserRole enum ฝั่ง frontend และ user_has_permission() ใน config.php)
if (!defined('STOCK_PLAN_ADMIN_ROLES')) {
    define('STOCK_PLAN_ADMIN_ROLES', ['Super Admin', 'Admin Control', 'CEO']);
}

/**
 * ชื่อ role ของ user (null ถ้าไม่พบ)
 */
function stock_plan_user_role(PDO $pdo, $userId)
{
    $userId = (int)$userId;
    if ($userId <= 0) {
        return null;
    }
    $stmt = $pdo->prepare('SELECT role FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$userId]);
    $role = $stmt->fetchColumn();
    return $role === false ? null : $role;
}

/**
 * ตั้งสิทธิ์ให้คนอื่นได้หรือไม่ (Super Admin / Admin Control / CEO)
 */
function stock_plan_can_grant(PDO $pdo, $userId)
{
    $role = stock_plan_user_role($pdo, $userId);
    return $role !== null && in_array($role, STOCK_PLAN_ADMIN_ROLES, true);
}

/**
 * เพิ่ม/ลบแพลน + เพิ่มหมายเหตุได้หรือไม่
 */
function stock_plan_can_manage(PDO $pdo, $userId)
{
    if (stock_plan_can_grant($pdo, $userId)) {
        return true;
    }
    $userId = (int)$userId;
    if ($userId <= 0) {
        return false;
    }
    $stmt = $pdo->prepare('SELECT can_manage FROM stock_arrival_plan_managers WHERE user_id = ? LIMIT 1');
    $stmt->execute([$userId]);
    return (int)$stmt->fetchColumn() === 1;
}

/**
 * Super Admin คือสิทธิ์สูงสุด — ลบหมายเหตุของคนอื่น / ลบแพลนแบบ force ได้
 */
function stock_plan_is_super_admin(PDO $pdo, $userId)
{
    return stock_plan_user_role($pdo, $userId) === 'Super Admin';
}

/**
 * โยน Exception ถ้าไม่มีสิทธิ์จัดการ — ใช้ต้นทางของ endpoint ที่แก้ไขข้อมูล
 */
function stock_plan_require_manage(PDO $pdo, $userId)
{
    if (!stock_plan_can_manage($pdo, $userId)) {
        throw new Exception('บัญชีนี้ไม่มีสิทธิ์จัดการแพลนรับสินค้า (ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์)');
    }
}
