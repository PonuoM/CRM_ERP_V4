<?php
/**
 * สิทธิ์ของระบบ "สั่งผลิต & ใบขน" (Factory Production)
 *
 * สามระดับ:
 *  - can_manage : เปิด/แก้ SO, คีย์ใบขน, กดรับเข้าคลัง
 *                 = อยู่ใน PRODUCTION_ADMIN_ROLES หรือมีแถวใน production_managers
 *  - can_grant  : ตั้งสิทธิ์ can_manage + ล็อกโรงงานให้บัญชีอื่น (แท็บ "สิทธิ์" ในหน้าตั้งค่า)
 *                 = อยู่ใน PRODUCTION_ADMIN_ROLES เท่านั้น
 *  - factory scope : บัญชี read-only ฝั่งโรงงาน (น้องเนม) ถูกล็อกให้เห็นเฉพาะโรงงานตัวเอง
 *                    ผ่าน production_user_factories -- ไม่มีแถว = เห็นทุกโรงงาน (ทีมคลัง Airport)
 *
 * คนอื่นที่เข้าเมนูนี้ได้ (permission key inv2.production) = ดูอย่างเดียว
 *
 * เทียบกับฝั่ง frontend: components/FactoryProduction/types.ts (PRODUCTION_ADMIN_ROLES)
 * ถ้าจะเพิ่ม/ลด role ต้องแก้ทั้งสองที่
 */

if (!defined('PRODUCTION_ADMIN_ROLES')) {
    define('PRODUCTION_ADMIN_ROLES', ['Super Admin', 'Admin Control', 'CEO']);
}

/**
 * ชื่อ role ของ user (null ถ้าไม่พบ)
 */
function production_user_role(PDO $pdo, $userId)
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
function production_can_grant(PDO $pdo, $userId)
{
    $role = production_user_role($pdo, $userId);
    return $role !== null && in_array($role, PRODUCTION_ADMIN_ROLES, true);
}

/**
 * แก้ไขข้อมูลสั่งผลิต/ใบขนได้หรือไม่
 */
function production_can_manage(PDO $pdo, $userId)
{
    if (production_can_grant($pdo, $userId)) {
        return true;
    }
    $userId = (int)$userId;
    if ($userId <= 0) {
        return false;
    }
    $stmt = $pdo->prepare('SELECT can_manage FROM production_managers WHERE user_id = ? LIMIT 1');
    $stmt->execute([$userId]);
    return (int)$stmt->fetchColumn() === 1;
}

/**
 * Super Admin = สิทธิ์สูงสุด (ลบใบขนที่รับเข้าแล้ว / คีย์เกินยอด SO ได้)
 */
function production_is_super_admin(PDO $pdo, $userId)
{
    return production_user_role($pdo, $userId) === 'Super Admin';
}

/**
 * โยน Exception ถ้าไม่มีสิทธิ์แก้ไข — เรียกต้นทางของทุก endpoint ที่เขียนข้อมูล
 */
function production_require_manage(PDO $pdo, $userId)
{
    if (!production_can_manage($pdo, $userId)) {
        throw new Exception('บัญชีนี้ไม่มีสิทธิ์แก้ไขข้อมูลสั่งผลิต (ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์)');
    }
}

/**
 * โรงงานที่บัญชีนี้มองเห็นได้
 * คืน [] = ไม่ถูกล็อก (เห็นทุกโรงงาน) -- ผู้เรียกต้องเช็ค empty() ก่อนเอาไปทำ WHERE IN
 */
function production_visible_factory_ids(PDO $pdo, $userId)
{
    $userId = (int)$userId;
    if ($userId <= 0) {
        return [];
    }
    // คนที่แก้ข้อมูลได้ = ทีมส่วนกลาง เห็นทุกโรงงานเสมอ
    if (production_can_manage($pdo, $userId)) {
        return [];
    }
    $stmt = $pdo->prepare('SELECT factory_id FROM production_user_factories WHERE user_id = ?');
    $stmt->execute([$userId]);
    return array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
}

/**
 * ต่อท้าย WHERE ด้วยขอบเขตโรงงานของผู้ใช้ (ถ้าถูกล็อกไว้)
 * $alias = ชื่อ alias ของตารางที่มีคอลัมน์ factory_id
 */
function production_apply_factory_scope(PDO $pdo, $userId, $alias, array &$where, array &$params)
{
    $ids = production_visible_factory_ids($pdo, $userId);
    if (empty($ids)) {
        return;
    }
    $ph = implode(',', array_fill(0, count($ids), '?'));
    $where[] = "$alias.factory_id IN ($ph)";
    foreach ($ids as $id) {
        $params[] = $id;
    }
}
