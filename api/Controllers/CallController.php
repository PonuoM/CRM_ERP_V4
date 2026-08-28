<?php
/**
 * The bridge between the CRM on the desk and the phone in the rack.
 *
 * The browser asks to call customer 12345. It never learns the number — the server resolves it and
 * hands it to the one registered device belonging to that agent, over TLS. The device dials, reports
 * back, and the result lands in call_history like any other call.
 *
 * Transport is deliberately plain polling. FCM would shave a second off, but it means a Firebase
 * project, a service account and a google-services.json in the build — a dependency that can break
 * a working phone system from outside. agent_devices.push_token is reserved so push can be added
 * later without another migration.
 *
 * Every number that leaves this file leaves through dispatch(), and only to a device that is
 * registered, active, and owned by the agent whose session it is.
 */
class CallController
{
    /** งานที่เครื่องไม่มารับภายในเวลานี้ ถือว่าตกไป — ต่ำกว่านี้จะตัดสายที่กำลังจะดังพอดี */
    const DISPATCH_TIMEOUT_SEC = 120;

    /** ป้องกันการรัวปุ่มโทร: กันไม่ให้เปิดงานใหม่ขณะที่คนเดิมยังมีงานค้าง */
    const ACTIVE_STATUSES = "'queued','dispatched','ringing','answered'";

    /** สายที่เริ่มแล้วแต่ไม่เคยถูกปิด — ไม่มีสายจริงที่ยาวขนาดนี้ */
    const CALL_ABANDON_SEC = 7200;

    /** อายุ token ประจำเครื่อง — ต่ออายุทุกครั้งที่ poll เครื่องที่ยังใช้งานจึงไม่มีวันหมดอายุ */
    const DEVICE_TOKEN_DAYS = 365;

    /**
     * Who is calling: a signed-in person, or a registered handset.
     *
     * Handsets carry their own long-lived token because the web session token they would otherwise
     * use expires nightly for geo-fenced staff — correct for a browser someone could carry home,
     * useless for a phone bolted to a desk. That token is only ever accepted here, so a leaked one
     * can place and report calls but cannot read anything else in the CRM.
     */
    private static function authUser(PDO $pdo): array
    {
        $user = get_authenticated_user($pdo);
        if ($user) {
            return $user;
        }

        $user = self::deviceUser($pdo);
        if ($user) {
            return $user;
        }

        json_response(['ok' => false, 'error' => 'UNAUTHORIZED'], 401);
    }

    /** Resolve a device token to the agent who owns the handset, or null. */
    private static function deviceUser(PDO $pdo): ?array
    {
        $token = self::bearerToken();
        if ($token === null) {
            return null;
        }

        try {
            $stmt = $pdo->prepare(
                "SELECT u.id, u.username, u.role, u.company_id, u.status, d.device_id
                   FROM agent_devices d
                   JOIN users u ON u.id = d.user_id
                  WHERE d.device_token = ?
                    AND d.status = 'active'
                    AND d.revoked_at IS NULL
                    AND (d.token_expires_at IS NULL OR d.token_expires_at > NOW())
                  LIMIT 1"
            );
            $stmt->execute([$token]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (Throwable $e) {
            // Migration 091 not applied yet — fall back to session tokens rather than break calling.
            error_log('CallController::deviceUser: ' . $e->getMessage());
            return null;
        }

        if (!$row || ($row['status'] ?? '') !== 'active') {
            return null;
        }

        // Sliding expiry: a handset in daily use never ages out, one left in a drawer does.
        try {
            $pdo->prepare(
                'UPDATE agent_devices SET token_expires_at = DATE_ADD(NOW(), INTERVAL ? DAY)
                  WHERE device_token = ?'
            )->execute([self::DEVICE_TOKEN_DAYS, $token]);
        } catch (Throwable $e) {
            // Refreshing is a convenience, not a requirement for this request to succeed.
        }

        return $row;
    }

    private static function bearerToken(): ?string
    {
        $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
        if (!$auth && function_exists('getallheaders')) {
            $headers = getallheaders();
            $auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';
        }
        if (!$auth && isset($_GET['token'])) {
            $auth = 'Bearer ' . $_GET['token'];
        }
        return preg_match('/Bearer\s+(\S+)/', $auth, $m) ? $m[1] : null;
    }

    /**
     * Close out sessions nobody is going to finish.
     *
     * Two separate leaks, both of which lock an agent out of calling entirely because only one live
     * call is allowed at a time:
     *
     *  - a job the handset never claimed, which times out in seconds;
     *  - a call that started but was never reported as ended. Inbound sessions opened by identify()
     *    have no handset event to close them at all, and a crash mid-call leaks an outbound one.
     *    No real call runs for hours, so anything that old is certainly over.
     */
    private static function expireStale(PDO $pdo): void
    {
        $pdo->prepare(
            "UPDATE call_sessions
                SET status = 'failed', failure_reason = 'timeout', ended_at = NOW()
              WHERE status IN ('queued','dispatched')
                AND requested_at < DATE_SUB(NOW(), INTERVAL ? SECOND)"
        )->execute([self::DISPATCH_TIMEOUT_SEC]);

        $pdo->prepare(
            "UPDATE call_sessions
                SET status = 'ended', failure_reason = 'abandoned', ended_at = NOW()
              WHERE status IN ('ringing','answered')
                AND requested_at < DATE_SUB(NOW(), INTERVAL ? SECOND)"
        )->execute([self::CALL_ABANDON_SEC]);
    }

    /**
     * Every number this customer can be reached on, primary first.
     *
     * @return string[] indexed 0..n, matching the order the browser was shown
     */
    private static function customerNumbers(array $customer): array
    {
        $numbers = [];
        $primary = trim((string) ($customer['phone'] ?? ''));
        if ($primary !== '') {
            $numbers[] = $primary;
        }
        foreach (split_phone_list($customer['backup_phone'] ?? '') as $extra) {
            if ($extra !== '' && !in_array($extra, $numbers, true)) {
                $numbers[] = $extra;
            }
        }
        return $numbers;
    }

    /**
     * GET /api/call/numbers?customer_id=
     *
     * The list to choose from, masked. Positions here are what /call/dial expects as phone_index.
     */
    public static function numbers(PDO $pdo): void
    {
        $user = self::authUser($pdo);
        $customerId = (int) ($_GET['customer_id'] ?? 0);

        $stmt = $pdo->prepare(
            'SELECT customer_id, phone, backup_phone, company_id FROM customers WHERE customer_id = ? LIMIT 1'
        );
        $stmt->execute([$customerId]);
        $customer = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$customer) {
            json_response(['ok' => false, 'error' => 'CUSTOMER_NOT_FOUND'], 404);
        }

        $isSuper = in_array($user['role'] ?? '', ['Super Admin', 'Developer'], true);
        if (!$isSuper && (int) $customer['company_id'] !== (int) ($user['company_id'] ?? 0)) {
            json_response(['ok' => false, 'error' => 'FORBIDDEN'], 403);
        }

        $out = [];
        foreach (self::customerNumbers($customer) as $i => $number) {
            $out[] = [
                'index' => $i,
                'label' => $i === 0 ? 'เบอร์หลัก' : 'เบอร์สำรอง ' . $i,
                'display' => customer_phone_ui($number),
            ];
        }
        json_response(['ok' => true, 'numbers' => $out]);
    }

    // ── ฝั่งเบราว์เซอร์ ────────────────────────────────────────────────────────────────────

    /**
     * POST /api/call/dial  { customer_id }
     *
     * Answers with an id and the customer's name — never the number, whatever the caller's role.
     * This endpoint exists precisely so the browser does not need it.
     */
    public static function dial(PDO $pdo): void
    {
        $user = self::authUser($pdo);
        $in = json_input();
        $customerId = isset($in['customer_id']) ? (int) $in['customer_id'] : 0;
        // Which of the customer's numbers to ring. The browser picks by position in the masked list
        // it was shown; split_phone_list() keeps both sides using the same order.
        $phoneIndex = isset($in['phone_index']) ? max(0, (int) $in['phone_index']) : 0;

        if ($customerId <= 0) {
            json_response(['ok' => false, 'error' => 'CUSTOMER_REQUIRED'], 400);
        }

        self::expireStale($pdo);

        $stmt = $pdo->prepare(
            'SELECT customer_id, first_name, last_name, phone, backup_phone, company_id
               FROM customers WHERE customer_id = ? LIMIT 1'
        );
        $stmt->execute([$customerId]);
        $customer = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$customer) {
            json_response(['ok' => false, 'error' => 'CUSTOMER_NOT_FOUND'], 404);
        }

        // Company scope, same rule the rest of the API follows.
        $isSuper = in_array($user['role'] ?? '', ['Super Admin', 'Developer'], true);
        if (!$isSuper && (int) $customer['company_id'] !== (int) ($user['company_id'] ?? 0)) {
            json_response(['ok' => false, 'error' => 'FORBIDDEN'], 403);
        }

        $numbers = self::customerNumbers($customer);
        if (!$numbers) {
            json_response(['ok' => false, 'error' => 'NO_PHONE',
                'message' => 'ลูกค้ารายนี้ไม่มีเบอร์โทรในระบบ'], 422);
        }
        if (!isset($numbers[$phoneIndex])) {
            json_response(['ok' => false, 'error' => 'BAD_PHONE_INDEX',
                'message' => 'ไม่พบเบอร์ที่เลือก กรุณาเลือกใหม่'], 422);
        }

        // No registered handset means the call can never happen — say so now rather than leaving a
        // queued row and a spinner that never resolves.
        $devStmt = $pdo->prepare(
            "SELECT device_id, last_seen_at FROM agent_devices
              WHERE user_id = ? AND status = 'active'
              ORDER BY last_seen_at DESC LIMIT 1"
        );
        $devStmt->execute([(int) $user['id']]);
        $device = $devStmt->fetch(PDO::FETCH_ASSOC);

        if (!$device) {
            json_response(['ok' => false, 'error' => 'NO_DEVICE',
                'message' => 'ยังไม่ได้ผูกมือถือกับบัญชีนี้ ติดต่อแอดมินเพื่อลงทะเบียนเครื่อง'], 409);
        }

        // One live call per agent. A second press while the first is ringing returns the first.
        $busy = $pdo->prepare(
            'SELECT id, status FROM call_sessions
              WHERE agent_user_id = ? AND status IN (' . self::ACTIVE_STATUSES . ')
              ORDER BY id DESC LIMIT 1'
        );
        $busy->execute([(int) $user['id']]);
        if ($existing = $busy->fetch(PDO::FETCH_ASSOC)) {
            json_response([
                'ok' => true,
                'session_id' => (int) $existing['id'],
                'status' => $existing['status'],
                'already_active' => true,
            ]);
        }

        $ins = $pdo->prepare(
            "INSERT INTO call_sessions (company_id, agent_user_id, customer_id, phone_index, direction, status)
             VALUES (?, ?, ?, ?, 'outbound', 'queued')"
        );
        $ins->execute([
            (int) $customer['company_id'],
            (int) $user['id'],
            $customerId,
            $phoneIndex,
        ]);

        json_response([
            'ok' => true,
            'session_id' => (int) $pdo->lastInsertId(),
            'status' => 'queued',
            'customer_name' => trim(($customer['first_name'] ?? '') . ' ' . ($customer['last_name'] ?? '')),
            'customer_id' => $customerId,
            // Echo back what is being rung, masked to this caller's policy, so the screen can say
            // "calling 08xxxxxx78" without ever having been told the number.
            'dialing' => customer_phone_ui($numbers[$phoneIndex]),
        ]);
    }

    /**
     * GET /api/call/status?session_id=
     * What the browser polls so the UI can show ringing / answered / ended without the number.
     */
    public static function status(PDO $pdo): void
    {
        $user = self::authUser($pdo);
        $sessionId = (int) ($_GET['session_id'] ?? 0);

        $stmt = $pdo->prepare(
            'SELECT id, status, direction, customer_id, requested_at, answered_at, ended_at,
                    duration_sec, failure_reason
               FROM call_sessions WHERE id = ? AND agent_user_id = ? LIMIT 1'
        );
        $stmt->execute([$sessionId, (int) $user['id']]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            json_response(['ok' => false, 'error' => 'NOT_FOUND'], 404);
        }
        json_response(['ok' => true, 'session' => $row]);
    }

    /** POST /api/call/cancel { session_id } — agent changed their mind before it connected. */
    public static function cancel(PDO $pdo): void
    {
        $user = self::authUser($pdo);
        $in = json_input();
        $sessionId = isset($in['session_id']) ? (int) $in['session_id'] : 0;

        $stmt = $pdo->prepare(
            "UPDATE call_sessions
                SET status = 'cancelled', ended_at = NOW()
              WHERE id = ? AND agent_user_id = ? AND status IN ('queued','dispatched','ringing')"
        );
        $stmt->execute([$sessionId, (int) $user['id']]);
        json_response(['ok' => true, 'cancelled' => $stmt->rowCount() > 0]);
    }

    // ── ฝั่งมือถือ ─────────────────────────────────────────────────────────────────────────

    /**
     * POST /api/device/register { device_id, label?, sim_phone?, app_version?, push_token? }
     * Binds this handset to the signed-in agent. Re-registering the same device_id updates it.
     */
    public static function registerDevice(PDO $pdo): void
    {
        $user = self::authUser($pdo);
        $in = json_input();
        $deviceId = trim((string) ($in['device_id'] ?? ''));

        if ($deviceId === '' || strlen($deviceId) > 64) {
            json_response(['ok' => false, 'error' => 'DEVICE_ID_REQUIRED'], 400);
        }

        // A fresh token on every registration. Re-enrolling a handset therefore invalidates the one
        // the previous install was holding, which is what you want when a phone changes hands.
        $deviceToken = bin2hex(random_bytes(32));

        $stmt = $pdo->prepare(
            "INSERT INTO agent_devices (user_id, device_id, label, sim_phone, app_version, push_token,
                                        device_token, token_expires_at, revoked_at, status, last_seen_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY), NULL, 'active', NOW())
             ON DUPLICATE KEY UPDATE
                user_id = VALUES(user_id), label = VALUES(label), sim_phone = VALUES(sim_phone),
                app_version = VALUES(app_version), push_token = VALUES(push_token),
                device_token = VALUES(device_token), token_expires_at = VALUES(token_expires_at),
                revoked_at = NULL, status = 'active', last_seen_at = NOW()"
        );
        $stmt->execute([
            (int) $user['id'],
            $deviceId,
            substr(trim((string) ($in['label'] ?? '')), 0, 128) ?: null,
            substr(preg_replace('/\D/', '', (string) ($in['sim_phone'] ?? '')), 0, 32) ?: null,
            substr(trim((string) ($in['app_version'] ?? '')), 0, 32) ?: null,
            substr(trim((string) ($in['push_token'] ?? '')), 0, 255) ?: null,
            $deviceToken,
            self::DEVICE_TOKEN_DAYS,
        ]);

        json_response([
            'ok' => true,
            'device_id' => $deviceId,
            'user_id' => (int) $user['id'],
            // The handset stores this and uses it from now on, so a nightly web-session expiry
            // never reaches the phone on the desk.
            'device_token' => $deviceToken,
            'expires_in_days' => self::DEVICE_TOKEN_DAYS,
        ]);
    }

    /**
     * GET /api/call/poll?device_id=
     *
     * The one place a real customer number is served, and only to the agent who owns the device.
     * Claiming a session in the same breath as reading it keeps two handsets from dialling one job.
     */
    public static function poll(PDO $pdo): void
    {
        $user = self::authUser($pdo);
        $deviceId = trim((string) ($_GET['device_id'] ?? ''));

        if ($deviceId === '') {
            json_response(['ok' => false, 'error' => 'DEVICE_ID_REQUIRED'], 400);
        }

        $dev = $pdo->prepare(
            "SELECT id FROM agent_devices
              WHERE device_id = ? AND user_id = ? AND status = 'active' LIMIT 1"
        );
        $dev->execute([$deviceId, (int) $user['id']]);
        if (!$dev->fetch()) {
            json_response(['ok' => false, 'error' => 'DEVICE_NOT_REGISTERED'], 403);
        }

        $pdo->prepare('UPDATE agent_devices SET last_seen_at = NOW() WHERE device_id = ?')
            ->execute([$deviceId]);

        self::expireStale($pdo);

        // Claim first, read second. The UPDATE is atomic, so whichever handset wins gets the job and
        // the other sees nothing to do.
        $claim = $pdo->prepare(
            "UPDATE call_sessions
                SET status = 'dispatched', dispatched_at = NOW(), device_id = ?
              WHERE agent_user_id = ? AND status = 'queued' AND direction = 'outbound'
              ORDER BY id ASC LIMIT 1"
        );
        $claim->execute([$deviceId, (int) $user['id']]);

        if ($claim->rowCount() === 0) {
            json_response(['ok' => true, 'call' => null]);
        }

        $stmt = $pdo->prepare(
            "SELECT s.id, s.customer_id, s.phone_index, c.phone, c.backup_phone,
                    c.first_name, c.last_name
               FROM call_sessions s
               JOIN customers c ON c.customer_id = s.customer_id
              WHERE s.device_id = ? AND s.status = 'dispatched'
              ORDER BY s.id DESC LIMIT 1"
        );
        $stmt->execute([$deviceId]);
        $job = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$job) {
            json_response(['ok' => true, 'call' => null]);
        }

        // Resolve the position back to a number now, from the live customer record — the session
        // stored a position precisely so no second copy of the number had to exist.
        $numbers = self::customerNumbers($job);
        $dial = $numbers[(int) $job['phone_index']] ?? ($numbers[0] ?? '');
        if ($dial === '') {
            $pdo->prepare("UPDATE call_sessions SET status = 'failed', failure_reason = 'no_number',
                           ended_at = NOW() WHERE id = ?")->execute([(int) $job['id']]);
            json_response(['ok' => true, 'call' => null]);
        }

        json_response([
            'ok' => true,
            'call' => [
                'session_id'    => (int) $job['id'],
                'customer_id'   => (int) $job['customer_id'],
                'customer_name' => trim(($job['first_name'] ?? '') . ' ' . ($job['last_name'] ?? '')),
                // The number, to this device only. The app dials it and never shows it.
                'dial'          => $dial,
            ],
        ]);
    }

    /**
     * POST /api/call/event { session_id, status, duration_sec?, failure_reason? }
     * The handset reporting what actually happened.
     */
    public static function event(PDO $pdo): void
    {
        $user = self::authUser($pdo);
        $in = json_input();
        $sessionId = isset($in['session_id']) ? (int) $in['session_id'] : 0;
        $status = (string) ($in['status'] ?? '');

        $allowed = ['ringing', 'answered', 'ended', 'failed'];
        if ($sessionId <= 0 || !in_array($status, $allowed, true)) {
            json_response(['ok' => false, 'error' => 'BAD_EVENT'], 400);
        }

        $stmt = $pdo->prepare(
            'SELECT id, customer_id, agent_user_id, answered_at
               FROM call_sessions WHERE id = ? AND agent_user_id = ? LIMIT 1'
        );
        $stmt->execute([$sessionId, (int) $user['id']]);
        $session = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$session) {
            json_response(['ok' => false, 'error' => 'NOT_FOUND'], 404);
        }

        $sets = ['status = ?'];
        $params = [$status];

        if ($status === 'answered') {
            $sets[] = 'answered_at = COALESCE(answered_at, NOW())';
        }
        if ($status === 'ended' || $status === 'failed') {
            $sets[] = 'ended_at = NOW()';
            if (isset($in['duration_sec'])) {
                $sets[] = 'duration_sec = ?';
                $params[] = max(0, (int) $in['duration_sec']);
            }
            if (!empty($in['failure_reason'])) {
                $sets[] = 'failure_reason = ?';
                $params[] = substr((string) $in['failure_reason'], 0, 128);
            }
        }

        $params[] = $sessionId;
        $pdo->prepare('UPDATE call_sessions SET ' . implode(', ', $sets) . ' WHERE id = ?')
            ->execute($params);

        // A finished call belongs in call_history, where every report already looks.
        if ($status === 'ended' && !empty($session['customer_id'])) {
            self::writeCallHistory($pdo, $sessionId, $session, $in);
        }

        json_response(['ok' => true]);
    }

    private static function writeCallHistory(PDO $pdo, int $sessionId, array $session, array $in): void
    {
        try {
            $u = $pdo->prepare('SELECT first_name, last_name FROM users WHERE id = ? LIMIT 1');
            $u->execute([(int) $session['agent_user_id']]);
            $agent = $u->fetch(PDO::FETCH_ASSOC) ?: [];

            $ins = $pdo->prepare(
                'INSERT INTO call_history (customer_id, caller_id, date, caller, status, duration)
                 VALUES (?, ?, NOW(), ?, ?, ?)'
            );
            $ins->execute([
                (int) $session['customer_id'],
                (int) $session['agent_user_id'],
                trim(($agent['first_name'] ?? '') . ' ' . ($agent['last_name'] ?? '')),
                !empty($session['answered_at']) ? 'ได้คุย' : 'ไม่รับสาย',
                max(0, (int) ($in['duration_sec'] ?? 0)),
            ]);

            $pdo->prepare('UPDATE call_sessions SET call_history_id = ? WHERE id = ?')
                ->execute([(int) $pdo->lastInsertId(), $sessionId]);
        } catch (Throwable $e) {
            // The call happened whatever the bookkeeping does — never fail the handset for this.
            error_log('CallController::writeCallHistory: ' . $e->getMessage());
        }
    }

    /**
     * POST /api/call/identify { phone }
     *
     * Incoming call: the handset knows the number, the agent must not. Returns who it is so the app
     * can show a name and a customer id and nothing else.
     */
    public static function identify(PDO $pdo): void
    {
        $user = self::authUser($pdo);
        $in = json_input();
        $digits = preg_replace('/\D/', '', (string) ($in['phone'] ?? ''));
        $core = ltrim($digits, '0');

        if (strlen($core) < 9) {
            json_response(['ok' => true, 'customer' => null]);
        }
        $needle = substr($core, -9);

        $stmt = $pdo->prepare(
            "SELECT customer_id, first_name, last_name, current_basket_key, assigned_to
               FROM customers
              WHERE company_id = ?
                AND (REPLACE(REPLACE(phone,'-',''),' ','') LIKE ? OR backup_phone LIKE ?)
              LIMIT 1"
        );
        $stmt->execute([(int) ($user['company_id'] ?? 0), '%' . $needle . '%', '%' . $needle . '%']);
        $c = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$c) {
            json_response(['ok' => true, 'customer' => null]);
        }

        // Open a session so an inbound call lands in the reports alongside outbound ones.
        $ins = $pdo->prepare(
            "INSERT INTO call_sessions (company_id, agent_user_id, customer_id, direction, status)
             VALUES (?, ?, ?, 'inbound', 'ringing')"
        );
        $ins->execute([(int) ($user['company_id'] ?? 0), (int) $user['id'], (int) $c['customer_id']]);

        json_response([
            'ok' => true,
            'session_id' => (int) $pdo->lastInsertId(),
            'customer' => [
                'customer_id' => (int) $c['customer_id'],
                'name'        => trim(($c['first_name'] ?? '') . ' ' . ($c['last_name'] ?? '')),
                'assigned_to' => $c['assigned_to'] !== null ? (int) $c['assigned_to'] : null,
            ],
        ]);
    }
}
