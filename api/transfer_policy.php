<?php
/**
 * นโยบาย "ต้องขออนุมัติก่อนโอนลูกค้า" แยกตามบริษัท
 *
 * ระบบมีหลายบริษัทและไม่ใช่ทุกบริษัทที่มีนโยบายนี้ ตาราง role_permissions เป็นค่ากลางทั้งระบบ
 * การตัดสิทธิ์ที่นั่นอย่างเดียวจึงกระทบทุกบริษัทพร้อมกัน ไฟล์นี้คือสวิตช์ที่ทำให้เปิดทีละบริษัทได้
 *
 * ปิดอยู่ = พฤติกรรมเดิมทุกอย่าง เทเลโอนให้หัวหน้าตัวเองได้ หัวหน้าโอนหากันและโอนให้ลูกทีมได้
 * เปิด    = ทุกการเปลี่ยนผู้ดูแลต้องผ่านคนที่มีสิทธิ์ customers.transfer_owner คนอื่นยื่นคำขอแทน
 *
 * แยกเป็นไฟล์ของตัวเองโดยตั้งใจ ไม่ฝากไว้ใน config.php เพราะตอน deploy จริง host-build เอา
 * config.php ที่ root ไปทับ api/config.php helper ที่เพิ่มผิดที่จะ undefined บนเว็บจริง
 * (ดู CLAUDE.md หัวข้อกับดักตอน deploy)
 */

/** โฟลเดอร์ที่โค้ดชุดนี้ถูกวางไว้ ใช้แยก mini_erp ออกจาก beta_test */
function transfer_policy_app(): string
{
    $app = basename(dirname(str_replace('\\', '/', __DIR__)));
    return $app !== '' ? $app : 'unknown';
}

/**
 * ชื่อ setting ของ deployment นี้
 *
 * beta_test ใช้ฐานข้อมูลเดียวกับ prod ถ้าใช้ key เดียวกัน การเปิดทดสอบบน beta_test จะมีผลกับ
 * prod ทันที พนักงานเห็นทันทีทั้งบริษัท จึงต้องแยก key ตามโฟลเดอร์เหมือนที่ phone_privacy ทำ
 */
function transfer_policy_setting_key(): string
{
    $app = transfer_policy_app();
    return $app === 'mini_erp' ? 'transfer_approval_stage' : 'transfer_approval_stage_' . $app;
}

/**
 * อ่านค่า setting ดิบ
 *
 * เก็บเป็น JSON ก้อนเดียวเพื่อให้ทุกบริษัทอยู่ที่เดียวกัน และแก้บริษัทหนึ่งไม่ไปแตะอีกบริษัท
 *
 *   {"default":"off","companies":{"5":"on"}}
 *
 * รับสตริงเปล่า ๆ ("on" / "off") ด้วย ซึ่งหมายถึงใช้กับทุกบริษัท เผื่อวันที่ทยอยเปิดจนครบแล้ว
 * ไม่ต้องแยกรายบริษัทอีก
 */
function transfer_policy_config(?PDO $pdo = null): array
{
    static $config = null;

    if ($config !== null) {
        return $config;
    }
    if ($pdo === null) {
        return [];
    }

    try {
        $stmt = $pdo->prepare('SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1');
        $stmt->execute([transfer_policy_setting_key()]);
        $raw = $stmt->fetchColumn();
    } catch (Throwable $e) {
        return $config = [];
    }

    if ($raw === false || $raw === null || trim((string) $raw) === '') {
        return $config = [];
    }

    $decoded = json_decode((string) $raw, true);
    if (is_array($decoded)) {
        return $config = $decoded;
    }

    // สตริงเปล่า ๆ ให้ถือเป็น default ของทุกบริษัท
    $plain = strtolower(trim((string) $raw));
    return $config = ['default' => $plain, 'companies' => []];
}

/**
 * บริษัทนี้ต้องขออนุมัติก่อนโอนหรือไม่
 *
 * ไม่รู้ก็ตอบว่าไม่ต้อง โดยตั้งใจ ตรงข้ามกับ phone masking ที่ยิ่งเข้มยิ่งปลอดภัย เพราะการเดาผิด
 * ทางนี้แปลว่าหัวหน้าทั้งระบบสลับลูกค้าในทีมตัวเองไม่ได้ ซึ่งเป็นงานประจำวัน หยุดงานทั้งบริษัท
 * เสียหายกว่าการปล่อยให้โอนได้เหมือนเดิมอีกวันสองวัน
 *
 * @param int|null $companyId บริษัทของลูกค้าที่กำลังจะถูกโอน ไม่ส่งมาก็ใช้บริษัทของคนที่เรียก
 */
function transfer_approval_required(?PDO $pdo = null, ?int $companyId = null): bool
{
    $config = transfer_policy_config($pdo);
    if (!$config) {
        return false;
    }

    $default = strtolower(trim((string) ($config['default'] ?? 'off'))) === 'on';

    if ($companyId === null) {
        try {
            $user = function_exists('get_authenticated_user') && $pdo ? get_authenticated_user($pdo) : null;
            if ($user && isset($user['company_id'])) {
                $companyId = (int) $user['company_id'];
            }
        } catch (Throwable $e) {
            // ระบุตัวคนเรียกไม่ได้ ใช้ค่า default ไป
        }
    }

    if ($companyId === null) {
        return $default;
    }

    $key = (string) $companyId;
    if (!isset($config['companies'][$key])) {
        return $default;
    }

    return strtolower(trim((string) $config['companies'][$key])) === 'on';
}
