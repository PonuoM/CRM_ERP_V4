<?php
/**
 * Who may see a customer's real phone number, and what everyone else sees instead.
 *
 * Standalone file on purpose. In production host-build deploys the project-root config.php OVER
 * api/config.php (see the note on user_has_permission there), so a helper that lives only in
 * api/config.php is undefined on the live site. Keeping the policy in its own required file means
 * one copy and one truth.
 *
 * Fail closed on identity: anything not positively identified as an allowed role is masked,
 * unauthenticated callers included — several export endpoints still have no auth at all, so this is
 * the only thing standing between them and a downloadable customer list.
 *
 * ── Per company, in three stages ──────────────────────────────────────────────────────────────
 * Companies move to the new way of working one at a time, and a company that has not moved must
 * behave exactly as it did before. So the stage is resolved per company and defaults to 'off':
 * deploying this code changes nothing anywhere until a company is opted in, and opting back out is
 * the same one-row edit in reverse.
 *
 *   off           Nothing is masked. Identical to how the system behaved before this file existed.
 *   exports_only  CSV / Excel / downloadable JSON are masked; screens still show real numbers.
 *                 The safe first step — nobody needs a spreadsheet of numbers to do their job, and
 *                 a file that leaves the building is the exfiltration route that matters.
 *   full          Screens are masked too. Only turn this on for a company whose telesale have
 *                 another way to place a call, or they simply cannot work.
 *
 * ── Two contexts, on purpose ──────────────────────────────────────────────────────────────────
 *   customer_phone_export()  Bulk output. Masked from stage 'exports_only' upward.
 *   customer_phone_ui()      Interactive screens. Masked only at stage 'full'.
 */

/**
 * The character standing in for a hidden digit.
 *
 * Everything that has to tell a masked value from a real one keys off this rather than off "has no
 * digits", because a partial mask keeps four of them. Get that test wrong and a masked number gets
 * written back into the database as if it were real.
 */
const PHONE_MASK_CHAR = 'x';

/** Shown when there is a number but this caller may not see it and no digits can be offered. */
const PHONE_MASK = 'ซ่อน';

/**
 * A number with its middle removed: 0812345678 becomes 08xxxxxx78.
 *
 * Keeping the first and last two digits is a deliberate trade. It leaves enough for an agent to tell
 * two customers apart and to sanity-check they are calling the right person, while a partial number
 * is not enough to reach anyone or to rebuild a contact list from. Short or non-numeric input is
 * masked completely rather than guessed at.
 */
function mask_phone_number(string $phone): string
{
    $digits = preg_replace('/\D/', '', $phone);
    if (strlen($digits) < 7) {
        return PHONE_MASK;
    }
    return substr($digits, 0, 2)
        . str_repeat(PHONE_MASK_CHAR, strlen($digits) - 4)
        . substr($digits, -2);
}

/**
 * backup_phone holds several numbers in one comma-separated string. Mask each one so the agent can
 * still see there are two numbers on file and tell them apart, without either being reachable.
 */
function mask_phone_list(string $raw): string
{
    $parts = split_phone_list($raw);
    if (!$parts) {
        return PHONE_MASK;
    }
    return implode(', ', array_map('mask_phone_number', $parts));
}

/**
 * Split a stored multi-number string into its parts.
 *
 * Shared with the call bridge on purpose: the browser picks a number by its position in the masked
 * list it was shown, and the server dials the number at that same position. If the two ever split
 * the string differently, an agent would ring the wrong customer.
 *
 * @return string[] re-indexed from 0
 */
function split_phone_list(?string $raw): array
{
    $raw = trim((string) $raw);
    if ($raw === '') {
        return [];
    }
    return array_values(array_filter(array_map('trim', preg_split('/[,;|\/]+/', $raw))));
}

/** Is this value one we produced, rather than a real number? */
function is_masked_phone(?string $value): bool
{
    $value = trim((string) $value);
    if ($value === '') {
        return false;
    }
    return $value === PHONE_MASK
        || stripos($value, PHONE_MASK_CHAR) !== false
        || !preg_match('/\d/', $value);
}

/**
 * Roles that keep seeing real customer numbers. Matched against users.role (the role NAME, which is
 * what get_authenticated_user returns) and against roles.code, case-insensitively.
 *
 * Allowlist, not denylist: a role added to the system later starts masked until someone decides
 * otherwise. Telesale and Supervisor Telesale are deliberately absent — this whole change exists so
 * a salesperson cannot walk out with the customer book, and a team lead walking out with the whole
 * team's book is the worse version of that. Revisit by editing this one array.
 */
const PHONE_VISIBLE_ROLES_DEFAULT = [
    'super admin', 'super_admin',
    'admin system', 'admin_system',
    'developer',
    'admin control', 'admin_control',
    'admin page', 'admin_page',
    'sup admin', 'supervisor_admin_page',
    'backoffice',
    'sup backoffice', 'supervisor_backoffice',
    'finance',
    'account',
    'ceo',
];

/**
 * Resolve — once per request — whether this caller's ROLE is allowed to see real numbers.
 *
 * Pass the PDO on the first call. Later calls may omit it and get the cached answer. Never
 * initialised means never allowed, so a caller that forgets to initialise degrades to masked
 * rather than to a leak.
 */
function phone_visibility(?PDO $pdo = null): bool
{
    static $resolved = null;

    if ($resolved !== null) {
        return $resolved;
    }
    $user = phone_privacy_user($pdo);
    if (!$user || empty($user['role'])) {
        return $resolved = false;
    }

    return $resolved = in_array(strtolower(trim((string) $user['role'])), phone_visible_roles(), true);
}

/**
 * Roles allowed to read real numbers, lowercased.
 *
 * Comes from the settings row when an administrator has chosen a list, and falls back to the
 * constant above when they have not. Keeping it in settings means adjusting who can see numbers is
 * a screen an administrator can use, not a code change and a deploy.
 */
function phone_visible_roles(): array
{
    $config = phone_masking_config();
    $roles = $config['visible_roles'] ?? null;

    if (!is_array($roles)) {
        return PHONE_VISIBLE_ROLES_DEFAULT;
    }
    $clean = [];
    foreach ($roles as $r) {
        $r = strtolower(trim((string) $r));
        if ($r !== '') {
            $clean[] = $r;
        }
    }
    // An empty list would hide numbers from literally everyone, including the admin trying to undo
    // it. Treat that as "not configured" rather than locking the company out of its own data.
    return $clean ?: PHONE_VISIBLE_ROLES_DEFAULT;
}

/** The acting user, looked up at most once per request. Null when unauthenticated or not yet initialised. */
function phone_privacy_user(?PDO $pdo = null): ?array
{
    static $user = null;
    static $looked = false;

    if ($looked) {
        return $user;
    }
    if ($pdo === null || !function_exists('get_authenticated_user')) {
        return null;
    }

    $looked = true;
    try {
        $user = get_authenticated_user($pdo) ?: null;
    } catch (Throwable $e) {
        $user = null;
    }
    return $user;
}

/**
 * Which deployment is this code running as — 'mini_erp', 'beta_test', a local checkout, …
 *
 * Every deployment on the host points at the SAME production database, so a setting stored under
 * one key is shared by all of them. beta_test separates code, not data. Without this, switching
 * masking on to try it out on beta_test would blind every telesale on mini_erp at the same instant.
 *
 * The app folder is the segment above api/ — /domains/…/public_html/beta_test/api → 'beta_test'.
 */
function phone_privacy_app(): string
{
    $app = basename(dirname(str_replace('\\', '/', __DIR__)));
    return $app !== '' ? $app : 'unknown';
}

/** Setting key for THIS deployment. Production keeps the bare key; everything else gets a suffix. */
function phone_masking_setting_key(): string
{
    $app = phone_privacy_app();
    return $app === 'mini_erp' ? 'phone_masking_stage' : 'phone_masking_stage_' . $app;
}

/**
 * The stage in force for the acting user's company: 'off', 'exports_only' or 'full'.
 *
 * The setting row holds JSON so every company lives in one place and switching one does not touch
 * the others:
 *
 *   {"default":"off","companies":{"5":"full","1":"exports_only"}}
 *
 * A bare string ("full", "exports_only", "off") is also accepted and applies to every company —
 * useful once the rollout is finished and per-company differences no longer matter.
 *
 * Missing row, unreadable table, unknown value, or an unidentified caller all mean 'off'. This
 * fails OPEN on purpose: guessing wrong here leaves telesale unable to phone anyone, which is far
 * worse than a number staying visible on a screen where it is already visible today.
 */
/**
 * The whole settings row, parsed once per request.
 *
 * One row holds every part of the policy — the per-company stage and the role list — so an
 * administrator edits one thing and nothing can drift out of step with anything else.
 */
function phone_masking_config(?PDO $pdo = null): array
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
        $stmt->execute([phone_masking_setting_key()]);
        $raw = $stmt->fetchColumn();
    } catch (Throwable $e) {
        return $config = [];
    }

    $raw = trim((string) ($raw === false ? '' : $raw));
    if ($raw === '') {
        return $config = [];
    }
    // A bare stage string is still accepted, so a rollout that finished with one value for everyone
    // keeps working without being rewritten as JSON.
    if ($raw[0] !== '{') {
        return $config = ['default' => strtolower($raw)];
    }

    $parsed = json_decode($raw, true);
    return $config = is_array($parsed) ? $parsed : [];
}

function phone_masking_stage(?PDO $pdo = null): string
{
    static $resolved = null;

    if ($resolved !== null) {
        return $resolved;
    }

    $config = phone_masking_config($pdo);
    if (!$config) {
        return $pdo === null ? 'off' : ($resolved = 'off');
    }

    $valid = ['off', 'exports_only', 'full'];
    $default = strtolower(trim((string) ($config['default'] ?? 'off')));
    if (!in_array($default, $valid, true)) {
        $default = 'off';
    }

    $user = phone_privacy_user();
    $companyId = $user && isset($user['company_id']) ? (string) (int) $user['company_id'] : '';

    // Caller could not be identified — and five export endpoints still have no auth at all, so this
    // is reachable by anyone with the URL. Attributing them to a company is impossible, so apply the
    // strictest stage any company is running. An unknown caller never gets more than the most
    // protected company allows, while companies still opted out are unaffected.
    if ($companyId === '') {
        $rank = ['off' => 0, 'exports_only' => 1, 'full' => 2];
        $strictest = $default;
        foreach ((array) ($config['companies'] ?? []) as $stage) {
            $stage = strtolower(trim((string) $stage));
            if (isset($rank[$stage]) && $rank[$stage] > $rank[$strictest]) {
                $strictest = $stage;
            }
        }
        return $resolved = $strictest;
    }

    if (!isset($config['companies'][$companyId])) {
        return $resolved = $default;
    }

    $stage = strtolower(trim((string) $config['companies'][$companyId]));
    return $resolved = in_array($stage, $valid, true) ? $stage : $default;
}

/** Are interactive screens masked for this caller's company? */
function phone_masking_full(?PDO $pdo = null): bool
{
    return phone_masking_stage($pdo) === 'full';
}

/** Are exports masked for this caller's company? True at both 'exports_only' and 'full'. */
function phone_masking_exports(?PDO $pdo = null): bool
{
    return phone_masking_stage($pdo) !== 'off';
}

/** Initialise every decision for this request. Call once, right after db_connect(). */
function phone_privacy_init(PDO $pdo): void
{
    phone_privacy_user($pdo);
    // Config first: role visibility now reads from it, so resolving visibility before the row is
    // loaded would silently fall back to the built-in list.
    phone_masking_config($pdo);
    phone_masking_stage($pdo);
    phone_visibility($pdo);
}

/**
 * May this caller search customers BY phone number?
 *
 * Matters because search is a partial match: `phone LIKE '%081234%'` returns whoever matches, so
 * someone who cannot read a number can still recover one digit at a time by refining the term.
 * That turns a masked screen back into a readable one, which is why searching has to close with it.
 *
 * Only closes at stage 'full'. Below that the number is on screen anyway and search keeps working
 * exactly as it always has — nothing changes for a company that has not moved.
 */
function can_search_by_phone(): bool
{
    if (phone_visibility()) {
        return true;
    }
    return !phone_masking_full();
}

// ─── Bulk output: CSV, Excel, downloadable JSON. Enforced now. ──────────────────────────────────

/**
 * One customer number, ready to write into an export. Empty stays empty so a blank field does not
 * turn into a mask that implies a number exists.
 */
function customer_phone_export(?string $phone): string
{
    $phone = trim((string) $phone);
    if ($phone === '' || !phone_masking_exports()) {
        return $phone;
    }
    return phone_visibility() ? $phone : mask_phone_number($phone);
}

/**
 * customers.backup_phone holds several numbers in one comma-separated string (see
 * api/cron/run_batch_merge.php, which appends to it when it merges duplicates). Mask the whole
 * string as one value: masking each entry separately would still publish how many numbers a
 * customer has.
 */
function customer_backup_phones_export(?string $raw): string
{
    $raw = trim((string) $raw);
    if ($raw === '' || !phone_masking_exports()) {
        return $raw;
    }
    return phone_visibility() ? $raw : mask_phone_list($raw);
}

// ─── Interactive screens. Enforced only at stage 'full'. ────────────────────────────────────────

/** One customer number for a screen. Real until the dialer ships, then role-gated like exports. */
function customer_phone_ui(?string $phone): string
{
    $phone = trim((string) $phone);
    if ($phone === '' || !phone_masking_full()) {
        return $phone;
    }
    return phone_visibility() ? $phone : mask_phone_number($phone);
}

/** Same, for the comma-separated backup_phone string. */
function customer_backup_phones_ui(?string $raw): string
{
    $raw = trim((string) $raw);
    if ($raw === '' || !phone_masking_full()) {
        return $raw;
    }
    return phone_visibility() ? $raw : mask_phone_list($raw);
}

// ─── Whole-row helpers ─────────────────────────────────────────────────────────────────────────

/**
 * Strip customer numbers out of a row fetched with FETCH_ASSOC, for endpoints that json_encode
 * whole rows. Covers the aliases actually used across the API — plain `phone`, `customer_phone`,
 * `backup_phone`, `recipient_phone` (the shipping contact, usually the same number) — plus
 * customer_ref_id, which embeds the phone in every single row (`CUS-<number>-<company>`) and so
 * has to go wherever the number goes.
 *
 * @param string $context 'export' enforces now; 'ui' waits for stage 'full'.
 */
function scrub_customer_row(array $row, string $context = 'export'): array
{
    $ui = ($context === 'ui');
    $phoneKeys = ['phone', 'customer_phone', 'customerPhone', 'recipient_phone'];
    $backupKeys = ['backup_phone', 'customer_backup_phone'];

    foreach ($phoneKeys as $key) {
        if (array_key_exists($key, $row)) {
            $value = isset($row[$key]) ? (string) $row[$key] : '';
            $row[$key] = $ui ? customer_phone_ui($value) : customer_phone_export($value);
        }
    }
    foreach ($backupKeys as $key) {
        if (array_key_exists($key, $row)) {
            $value = isset($row[$key]) ? (string) $row[$key] : '';
            $row[$key] = $ui ? customer_backup_phones_ui($value) : customer_backup_phones_export($value);
        }
    }

    $hideRef = $ui
        ? (phone_masking_full() && !phone_visibility())
        : (phone_masking_exports() && !phone_visibility());
    if ($hideRef) {
        unset($row['customer_ref_id']);
    }
    return $row;
}
