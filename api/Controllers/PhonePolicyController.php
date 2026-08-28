<?php
/**
 * The control panel behind customer-number masking.
 *
 * Two things used to live in places an administrator could not reach: the per-company stage sat in a
 * settings row that only SQL could edit, and the list of roles allowed to read real numbers was a
 * constant in the source, so changing who could see a phone number meant a code change and a deploy.
 * Both now live in one settings row that this controller reads and writes.
 *
 * Changing this decides who in the company can read customer phone numbers, so it is deliberately
 * limited to the people who administer the system rather than to everyone who can currently see a
 * number themselves.
 */
class PhonePolicyController
{
    /** Roles allowed to change the policy. Narrower than the roles allowed to READ numbers. */
    const ADMIN_ROLES = ['super admin', 'developer', 'admin system', 'ceo'];

    const VALID_STAGES = ['off', 'exports_only', 'full'];

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

    /**
     * GET /api/phone_policy_settings
     *
     * Returns the stored policy plus everything the screen needs to render it: the company list, the
     * role list, and which roles apply when nobody has chosen any.
     */
    public static function read(PDO $pdo): void
    {
        self::requireAdmin($pdo);
        $config = phone_masking_config($pdo);

        $companies = $pdo->query('SELECT id, name FROM companies ORDER BY id')->fetchAll(PDO::FETCH_ASSOC);
        $roles = $pdo->query('SELECT id, name FROM roles ORDER BY id')->fetchAll(PDO::FETCH_ASSOC);

        $stages = [];
        foreach ($companies as $c) {
            $key = (string) $c['id'];
            $stage = strtolower(trim((string) ($config['companies'][$key] ?? '')));
            $stages[] = [
                'company_id' => (int) $c['id'],
                'company_name' => $c['name'],
                // null means "follow the default" rather than a stage of its own.
                'stage' => in_array($stage, self::VALID_STAGES, true) ? $stage : null,
            ];
        }

        // Compare case-insensitively: the stored list is lowercased, roles.name is not.
        $visible = phone_visible_roles();
        $roleRows = [];
        foreach ($roles as $r) {
            $roleRows[] = [
                'id' => (int) $r['id'],
                'name' => $r['name'],
                'can_view_phone' => in_array(strtolower(trim((string) $r['name'])), $visible, true),
            ];
        }

        json_response([
            'ok' => true,
            'deployment' => phone_privacy_app(),
            'setting_key' => phone_masking_setting_key(),
            'default_stage' => strtolower(trim((string) ($config['default'] ?? 'off'))) ?: 'off',
            'using_default_roles' => !isset($config['visible_roles']),
            'companies' => $stages,
            'roles' => $roleRows,
        ]);
    }

    /**
     * POST /api/phone_policy_settings
     * { default_stage, companies: [{company_id, stage|null}], visible_roles: ["Admin Control", …] }
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
            // Only store a company that differs from the default; anything else is noise that makes
            // the stored policy harder to read than the screen that produced it.
            if ($id > 0 && in_array($stage, self::VALID_STAGES, true)) {
                $companies[(string) $id] = $stage;
            }
        }

        $roles = [];
        foreach ((array) ($in['visible_roles'] ?? []) as $name) {
            $name = strtolower(trim((string) $name));
            if ($name !== '') {
                $roles[] = $name;
            }
        }
        $roles = array_values(array_unique($roles));

        // Refusing an empty list is not pedantry: saving one would hide numbers from every role at
        // once, including whoever is trying to undo it.
        if (!$roles) {
            json_response([
                'ok' => false,
                'error' => 'NO_ROLES',
                'message' => 'ต้องเลือกอย่างน้อย 1 role ที่เห็นเบอร์ได้ ไม่งั้นจะไม่มีใครเห็นเบอร์เลยแม้แต่ผู้ดูแลระบบ',
            ], 422);
        }

        $config = [
            'default' => $default,
            'companies' => (object) $companies,
            'visible_roles' => $roles,
        ];

        $stmt = $pdo->prepare(
            'INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)'
        );
        $stmt->execute([
            phone_masking_setting_key(),
            json_encode($config, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ]);

        error_log(sprintf(
            'phone policy changed by user %d (%s): default=%s companies=%s roles=%s',
            (int) $user['id'], $user['username'] ?? '?', $default,
            json_encode($companies), json_encode($roles)
        ));

        json_response(['ok' => true, 'setting_key' => phone_masking_setting_key()]);
    }
}
