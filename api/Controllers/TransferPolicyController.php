<?php
/**
 * แผงควบคุมนโยบาย "ต้องขออนุมัติก่อนโอนลูกค้า" แยกตามบริษัท
 *
 * ระบบมีหลายบริษัท และไม่ใช่ทุกบริษัทที่ต้องการให้การเปลี่ยนผู้ดูแลผ่านการอนุมัติ ตาราง
 * role_permissions เป็นค่ากลางทั้งระบบ ตัดสิทธิ์ที่นั่นอย่างเดียวจึงกระทบทุกบริษัทพร้อมกัน
 * ที่นี่คือสวิตช์ที่ทำให้เปิดทีละบริษัทได้ และปิดกลับไปเป็นพฤติกรรมเดิมได้ทันที
 *
 * จำกัดคนแก้ให้แคบกว่าคนที่โอนลูกค้าได้ เพราะการปิดสวิตช์นี้เท่ากับยกเลิกการควบคุมทั้งชุด
 */
require_once __DIR__ . '/../transfer_policy.php';

class TransferPolicyController
{
    /** ตำแหน่งที่แก้นโยบายได้ แคบกว่าตำแหน่งที่โอนลูกค้าได้โดยตั้งใจ */
    const ADMIN_ROLES = ['super admin', 'developer', 'admin system', 'ceo'];

    const VALID_STAGES = ['off', 'on'];

    private static function requireAdmin(PDO $pdo): array
    {
        $user = get_authenticated_user($pdo);
        if (!$user) {
            json_response(['ok' => false, 'error' => 'UNAUTHORIZED'], 401);
        }
        if (!in_array(strtolower(trim((string) ($user['role'] ?? ''))), self::ADMIN_ROLES, true)) {
            json_response([
                'ok' => false,
                'error' => 'FORBIDDEN',
                'message' => 'เฉพาะผู้ดูแลระบบเท่านั้นที่แก้ไขนโยบายนี้ได้',
            ], 403);
        }
        return $user;
    }

    /** GET /api/transfer_policy — นโยบายที่มีผลกับคนที่เรียก ใช้ตัดสินว่าจะโชว์ปุ่มไหน */
    public static function mine(PDO $pdo): void
    {
        $required = false;
        try {
            $required = transfer_approval_required($pdo);
        } catch (Throwable $e) {
            // อ่านไม่ได้ก็ถือว่าไม่ต้องขออนุมัติ ตรงกับที่ฝั่งเซิร์ฟเวอร์ตัดสิน หน้าจอจะได้ไม่ขัดกัน
            error_log('TransferPolicyController::mine ' . $e->getMessage());
        }
        json_response(['ok' => true, 'approval_required' => $required]);
    }

    /** GET /api/transfer_policy_settings — ค่าที่เก็บไว้ พร้อมรายชื่อบริษัทให้หน้าจอวาด */
    public static function read(PDO $pdo): void
    {
        self::requireAdmin($pdo);
        $config = transfer_policy_config($pdo);

        $companies = $pdo->query('SELECT id, name FROM companies ORDER BY id')->fetchAll(PDO::FETCH_ASSOC);

        $rows = [];
        foreach ($companies as $c) {
            $key = (string) $c['id'];
            $stage = strtolower(trim((string) ($config['companies'][$key] ?? '')));
            $rows[] = [
                'company_id'   => (int) $c['id'],
                'company_name' => $c['name'],
                // null แปลว่า "ตามค่าเริ่มต้น" ไม่ใช่ค่าของตัวเอง
                'stage'        => in_array($stage, self::VALID_STAGES, true) ? $stage : null,
            ];
        }

        json_response([
            'ok'            => true,
            'deployment'    => transfer_policy_app(),
            'setting_key'   => transfer_policy_setting_key(),
            'default_stage' => strtolower(trim((string) ($config['default'] ?? 'off'))) === 'on' ? 'on' : 'off',
            'companies'     => $rows,
        ]);
    }

    /**
     * POST /api/transfer_policy_settings
     * { default_stage: 'on'|'off', companies: [{company_id, stage: 'on'|'off'|null}] }
     */
    public static function save(PDO $pdo): void
    {
        $user = self::requireAdmin($pdo);
        $in = json_input();

        $default = strtolower(trim((string) ($in['default_stage'] ?? 'off')));
        if (!in_array($default, self::VALID_STAGES, true)) {
            $default = 'off';
        }

        $companies = [];
        foreach ((array) ($in['companies'] ?? []) as $row) {
            $id = isset($row['company_id']) ? (int) $row['company_id'] : 0;
            $stage = strtolower(trim((string) ($row['stage'] ?? '')));
            // เก็บเฉพาะบริษัทที่ต่างจากค่าเริ่มต้น ที่เหลือเป็นเสียงรบกวนทำให้ค่าที่เก็บอ่านยาก
            // กว่าหน้าจอที่สร้างมันขึ้นมา
            if ($id > 0 && in_array($stage, self::VALID_STAGES, true)) {
                $companies[(string) $id] = $stage;
            }
        }

        $payload = json_encode(
            ['default' => $default, 'companies' => (object) $companies],
            JSON_UNESCAPED_UNICODE
        );

        $stmt = $pdo->prepare(
            'INSERT INTO app_settings (setting_key, setting_value)
             VALUES (?, ?)
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)'
        );
        $stmt->execute([transfer_policy_setting_key(), $payload]);

        // ใครเปลี่ยนนโยบายนี้เป็นเรื่องที่ต้องตามรอยได้ ไม่ใช่แค่ผลลัพธ์สุดท้าย
        error_log(sprintf(
            'transfer_policy changed by user %d (%s): %s',
            (int) ($user['id'] ?? 0),
            (string) ($user['role'] ?? ''),
            $payload
        ));

        json_response(['ok' => true, 'saved' => json_decode($payload, true)]);
    }
}
