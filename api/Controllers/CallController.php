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

    /**
     * POST /api/call/cancel { session_id } — คอมกดวางสาย
     *
     * รวม 'answered' ด้วย เพราะพนักงานกดวางบนคอมได้ทั้งก่อนและหลังปลายทางรับ เครื่องจะ poll
     * เห็นสถานะกลายเป็น cancelled แล้วตัดสายจริงที่วิทยุ (เดิมครอบแค่ก่อนรับ เครื่องเลยยังโทรค้าง)
     */
    public static function cancel(PDO $pdo): void
    {
        $user = self::authUser($pdo);
        $in = json_input();
        $sessionId = isset($in['session_id']) ? (int) $in['session_id'] : 0;

        $stmt = $pdo->prepare(
            "UPDATE call_sessions
                SET status = 'cancelled', ended_at = NOW(), failure_reason = 'pc_hangup'
              WHERE id = ? AND agent_user_id = ? AND status IN ('queued','dispatched','ringing','answered')"
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
                id = LAST_INSERT_ID(id),
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
            // ลำดับแถวใน agent_devices — แอปเอาไปทำรหัสเครื่องสั้น ๆ "PHONE-07"
            // (LAST_INSERT_ID(id) ใน ON DUPLICATE ทำให้ได้ id เดิมแม้เป็นการอัปเดตซ้ำ)
            'device_no' => (int) $pdo->lastInsertId(),
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

    /**
     * GET /api/call/history?limit=
     *
     * ประวัติการโทรของพนักงานคนนี้ — โชว์ชื่อลูกค้าและรหัส ไม่มีเบอร์ (โทรกลับผ่าน customer_id)
     * ยึดจาก call_sessions ของ CRM ไม่ใช่ประวัติในเครื่องที่ถูกลบทิ้ง
     */
    public static function history(PDO $pdo): void
    {
        $user = self::authUser($pdo);
        $limit = min(200, max(1, (int) ($_GET['limit'] ?? 60)));

        // join call_history เพื่อได้ผลบันทึกจริง (ได้คุย/ไม่รับสาย/ขายได้) ไม่ใช่แค่สถานะสาย
        $stmt = $pdo->prepare(
            "SELECT s.id, s.customer_id, s.direction, s.status AS session_status, s.duration_sec,
                    s.answered_at, s.requested_at,
                    c.first_name, c.last_name,
                    ch.status AS disp_status, ch.result AS disp_result, ch.duration AS ch_duration
               FROM call_sessions s
               LEFT JOIN customers c ON c.customer_id = s.customer_id
               LEFT JOIN call_history ch ON ch.id = s.call_history_id
              WHERE s.agent_user_id = ?
              ORDER BY s.requested_at DESC
              LIMIT $limit"
        );
        $stmt->execute([(int) $user['id']]);

        $talked = ['ได้คุย', 'รับสาย'];
        $notTalked = ['ไม่รับสาย', 'สายไม่ว่าง', 'ติดสายซ้อน', 'ไม่มีสัญญาณ', 'ตัดสายทิ้ง'];

        $out = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $name = trim(($r['first_name'] ?? '') . ' ' . ($r['last_name'] ?? ''));
            $dispStatus = $r['disp_status'] !== null && $r['disp_status'] !== '' ? $r['disp_status'] : null;
            $answered = !empty($r['answered_at']) || in_array($dispStatus, $talked, true);
            // ไม่รับสาย: บันทึกไว้ว่าไม่ได้คุย หรือ (สายเข้าที่ไม่รับแล้วจบ)
            $missed = in_array($dispStatus, $notTalked, true)
                || ($dispStatus === null && $r['direction'] === 'inbound' && empty($r['answered_at'])
                    && in_array($r['session_status'], ['ended', 'failed'], true));
            $dur = $r['ch_duration'] !== null ? (int) $r['ch_duration']
                : ($r['duration_sec'] !== null ? (int) $r['duration_sec'] : 0);
            $out[] = [
                'session_id'   => (int) $r['id'],
                'customer_id'  => $r['customer_id'] !== null ? (int) $r['customer_id'] : null,
                'customer_name' => $name !== '' ? $name : null,
                'direction'    => $r['direction'],
                'status'       => $dispStatus,                       // ได้คุย/ไม่รับสาย/… (null ถ้ายังไม่บันทึก)
                'result'       => $r['disp_result'] ?: null,          // ขายได้/…
                'missed'       => $missed,
                'answered'     => $answered,
                'duration_sec' => $dur,
                'at'           => $r['requested_at'],
            ];
        }
        json_response(['ok' => true, 'calls' => $out]);
    }

    /**
     * POST /api/call/disposition
     *   { session_id, status, result, duration_sec?, crop_type?, area_size?, notes?, follow_up_date? }
     *
     * บันทึกผลการโทรจากมือถือ — อัปเดตแถว call_history เดียวกับที่ฝั่งคอมใช้ (ผูกผ่าน
     * call_sessions.call_history_id ที่ระบบเขียนไว้ตอนสายจบ) ถ้ายังไม่มีแถวก็สร้างให้
     * แล้วปักธง disposed_at เพื่อให้ฟอร์มอีกฝั่งปิดเอง
     */
    public static function disposition(PDO $pdo): void
    {
        $user = self::authUser($pdo);
        $in = json_input();
        $sessionId = (int) ($in['session_id'] ?? 0);
        if ($sessionId <= 0) {
            json_response(['ok' => false, 'error' => 'SESSION_REQUIRED'], 400);
        }

        $stmt = $pdo->prepare(
            'SELECT id, agent_user_id, customer_id, call_history_id, answered_at, duration_sec
               FROM call_sessions WHERE id = ? LIMIT 1'
        );
        $stmt->execute([$sessionId]);
        $s = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$s) {
            json_response(['ok' => false, 'error' => 'SESSION_NOT_FOUND'], 404);
        }
        if ((int) $s['agent_user_id'] !== (int) $user['id']) {
            json_response(['ok' => false, 'error' => 'FORBIDDEN'], 403);
        }

        $status   = trim((string) ($in['status'] ?? ''));
        $result   = trim((string) ($in['result'] ?? ''));
        $notes    = trim((string) ($in['notes'] ?? ''));
        $cropType = trim((string) ($in['crop_type'] ?? ''));
        $areaSize = trim((string) ($in['area_size'] ?? ''));
        $duration = isset($in['duration_sec'])
            ? max(0, (int) $in['duration_sec'])
            : (int) ($s['duration_sec'] ?? 0);

        $historyId = $s['call_history_id'] !== null ? (int) $s['call_history_id'] : 0;

        try {
            if ($historyId > 0) {
                // อัปเดตแถวเดิมที่ระบบเขียนไว้ตอนสายจบ
                $pdo->prepare(
                    'UPDATE call_history
                        SET status = ?, result = ?, crop_type = ?, area_size = ?, notes = ?, duration = ?
                      WHERE id = ?'
                )->execute([
                    $status ?: (!empty($s['answered_at']) ? 'ได้คุย' : 'ไม่รับสาย'),
                    $result ?: null,
                    $cropType ?: null,
                    $areaSize ?: null,
                    $notes ?: null,
                    $duration,
                    $historyId,
                ]);
            } else {
                // ไม่มีแถว (สายที่ไม่เข้า writeCallHistory) — สร้างใหม่แล้วผูกกลับ
                $u = $pdo->prepare('SELECT first_name, last_name FROM users WHERE id = ? LIMIT 1');
                $u->execute([(int) $user['id']]);
                $agent = $u->fetch(PDO::FETCH_ASSOC) ?: [];
                $pdo->prepare(
                    'INSERT INTO call_history (customer_id, caller_id, date, caller, status, result, crop_type, area_size, notes, duration)
                     VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?, ?)'
                )->execute([
                    (int) $s['customer_id'],
                    (int) $user['id'],
                    trim(($agent['first_name'] ?? '') . ' ' . ($agent['last_name'] ?? '')),
                    $status ?: 'ได้คุย',
                    $result ?: null,
                    $cropType ?: null,
                    $areaSize ?: null,
                    $notes ?: null,
                    $duration,
                ]);
                $historyId = (int) $pdo->lastInsertId();
                $pdo->prepare('UPDATE call_sessions SET call_history_id = ? WHERE id = ?')
                    ->execute([$historyId, $sessionId]);
            }

            // เขียนข้อมูลสวนลงโปรไฟล์ลูกค้า (customer_plots) ด้วย เหมือนฝั่งคอม — เพิ่มชุดใหม่/อัปเดตขนาด
            // ไม่ลบชุดอื่นทิ้ง (ต่างจาก savePlots ของ PC ที่แทนที่ทั้งชุดเพราะมีฟอร์มหลายชุด)
            if ($cropType !== '' && !empty($s['customer_id'])) {
                self::upsertFarmPlot($pdo, (int) $s['customer_id'], $cropType, $areaSize, (int) $user['id'], $historyId);
            }

            // ติด Tag ให้ลูกค้า เหมือนฝั่งคอม (LogCallModal) — เพิ่มอย่างเดียว ไม่ถอด
            // idempotent: ถ้าติดไว้แล้วข้าม ไม่ซ้ำ
            $tagIds = $in['tag_ids'] ?? [];
            if (is_array($tagIds) && $tagIds && !empty($s['customer_id'])) {
                self::assignTags($pdo, (int) $s['customer_id'], $tagIds, (int) $user['id']);
            }

            // ปักธงว่าบันทึกแล้ว ฟอร์มอีกฝั่งจะได้ปิดเอง
            $pdo->prepare('UPDATE call_sessions SET disposed_at = NOW() WHERE id = ?')->execute([$sessionId]);

            // นัดหมายครั้งถัดไป (ถ้ามี) — เขียน follow_up_date ให้ลูกค้า
            $followUp = trim((string) ($in['follow_up_date'] ?? ''));
            if ($followUp !== '' && !empty($s['customer_id'])) {
                try {
                    $pdo->prepare('UPDATE customers SET follow_up_date = ? WHERE customer_id = ?')
                        ->execute([$followUp, (int) $s['customer_id']]);
                    // สร้างนัดหมายในตาราง appointments ด้วย — เว็บ CRM อ่าน "ติดตามถัดไป/นัดหมาย"
                    // จากตารางนี้ (status<>'เสร็จสิ้น') ไม่ใช่ customers.follow_up_date
                    $title = 'ติดตามลูกค้า' . ($result !== '' ? " ($result)" : '');
                    $pdo->prepare(
                        "INSERT INTO appointments (customer_id, date, title, status, notes, created_by)
                         VALUES (?, ?, ?, 'รอดำเนินการ', ?, ?)"
                    )->execute([(int) $s['customer_id'], $followUp, $title, $notes ?: null, (int) $user['id']]);
                } catch (Throwable $e) {
                    // คอลัมน์ต่างชื่อในบางที่ — ไม่ให้ล้มการบันทึกหลัก
                    error_log('CallController::disposition follow_up: ' . $e->getMessage());
                }
            }
        } catch (Throwable $e) {
            error_log('CallController::disposition: ' . $e->getMessage());
            json_response(['ok' => false, 'error' => 'SAVE_FAILED'], 500);
        }

        json_response(['ok' => true, 'call_history_id' => $historyId]);
    }

    /**
     * เพิ่ม/อัปเดตข้อมูลสวนของลูกค้าจากการบันทึกการโทรมือถือ
     *
     * เพิ่มชุดใหม่ถ้ายังไม่มีพืชนี้ · อัปเดตขนาดถ้าพืชนี้มีอยู่แล้ว · ไม่ลบชุดอื่นทิ้ง
     * ล้มก็ไม่ให้กระทบการบันทึกสายหลัก (สายสำคัญกว่าโปรไฟล์สวน)
     */
    private static function upsertFarmPlot(
        PDO $pdo, int $customerId, string $cropName, string $areaRaw, int $userId, int $callId
    ): void {
        try {
            require_once __DIR__ . '/FarmProfileController.php';
            require_once __DIR__ . '/../Services/CropNormalizer.php';

            $cropId = FarmProfileController::resolveOrCreateCrop($pdo, $cropName, $userId);
            if (!$cropId) {
                return;
            }

            // แยกตัวเลข + หน่วยจากข้อความ เช่น "5 ไร่" / "12 ต้น"
            $val = null;
            $unit = null;
            if (preg_match('/([\d.]+)/u', $areaRaw, $m)) {
                $val = (float) $m[1];
            }
            if (preg_match('/(ไร่|ต้น|งาน|ตร\.ว\.)/u', $areaRaw, $mu)) {
                $unit = $mu[1];
            }
            if ($val !== null && $val <= 0) {
                $val = null;
            }
            if ($val === null) {
                $unit = null;
            }
            $bucket = CropNormalizer::sizeBucket($val, $unit);

            $ex = $pdo->prepare(
                'SELECT plot_id FROM customer_plots
                  WHERE customer_id = ? AND crop_id = ? AND is_active = 1 LIMIT 1'
            );
            $ex->execute([$customerId, $cropId]);
            $plotId = $ex->fetchColumn();

            if ($plotId) {
                // มีพืชนี้แล้ว อัปเดตขนาดถ้ามีค่าใหม่ ไม่งั้นปล่อยไว้
                if ($val !== null) {
                    $pdo->prepare(
                        'UPDATE customer_plots
                            SET size_value = ?, size_unit = ?, size_bucket = ?, source_call_id = ?
                          WHERE plot_id = ?'
                    )->execute([$val, $unit, $bucket, $callId, (int) $plotId]);
                }
            } else {
                $pdo->prepare(
                    "INSERT INTO customer_plots
                        (customer_id, crop_id, size_value, size_unit, size_bucket,
                         is_home_garden, note, source, source_call_id, created_by)
                     VALUES (?, ?, ?, ?, ?, 0, NULL, 'manual', ?, ?)"
                )->execute([$customerId, $cropId, $val, $unit, $bucket, $callId, $userId]);
            }

            $pdo->prepare(
                'UPDATE crops SET usage_count = (SELECT COUNT(*) FROM customer_plots
                                                  WHERE crop_id = ? AND is_active = 1)
                  WHERE crop_id = ?'
            )->execute([$cropId, $cropId]);
        } catch (Throwable $e) {
            error_log('CallController::upsertFarmPlot: ' . $e->getMessage());
        }
    }

    /**
     * GET /api/call/tags[?customer_id=] — รายการ Tag ที่พนักงานคนนี้ติดได้
     *
     * คืน Tag ระบบ (SYSTEM ทุกคนเห็น) + Tag ส่วนตัวของพนักงานคนนี้ (USER ผ่าน user_tags)
     * ถ้าส่ง customer_id มา จะบอกด้วยว่าอันไหนติดลูกค้ารายนี้ไว้แล้ว (selected)
     */
    public static function tags(PDO $pdo): void
    {
        $user = self::authUser($pdo);
        $customerId = isset($_GET['customer_id']) ? (int) $_GET['customer_id'] : 0;

        $stmt = $pdo->prepare(
            "SELECT DISTINCT t.id, t.name, t.color, t.type
               FROM tags t
               LEFT JOIN user_tags ut ON ut.tag_id = t.id
              WHERE t.type = 'SYSTEM' OR (t.type = 'USER' AND ut.user_id = ?)
              ORDER BY t.type, t.name"
        );
        $stmt->execute([(int) $user['id']]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $selected = [];
        if ($customerId > 0) {
            $sel = $pdo->prepare(
                'SELECT tag_id FROM customer_tags WHERE customer_id = ? AND deleted_at IS NULL'
            );
            $sel->execute([$customerId]);
            foreach ($sel->fetchAll(PDO::FETCH_COLUMN) as $tid) {
                $selected[(int) $tid] = true;
            }
        }

        $tags = array_map(function ($r) use ($selected) {
            return [
                'id'       => (int) $r['id'],
                'name'     => $r['name'],
                'color'    => $r['color'],
                'type'     => $r['type'],
                'selected' => isset($selected[(int) $r['id']]),
            ];
        }, $rows);

        json_response(['ok' => true, 'tags' => $tags]);
    }

    /** ติด Tag ให้ลูกค้าแบบ idempotent — ข้ามอันที่ติดไว้แล้ว ไม่ลบของเดิม */
    private static function assignTags(PDO $pdo, int $customerId, array $tagIds, int $userId): void
    {
        try {
            $check = $pdo->prepare(
                'SELECT id FROM customer_tags
                  WHERE customer_id = ? AND tag_id = ? AND deleted_at IS NULL LIMIT 1'
            );
            $ins = $pdo->prepare(
                'INSERT INTO customer_tags (customer_id, tag_id, created_by) VALUES (?, ?, ?)'
            );
            foreach ($tagIds as $tid) {
                $tid = (int) $tid;
                if ($tid <= 0) {
                    continue;
                }
                $check->execute([$customerId, $tid]);
                if (!$check->fetchColumn()) {
                    $ins->execute([$customerId, $tid, $userId]);
                }
            }
        } catch (Throwable $e) {
            error_log('CallController::assignTags: ' . $e->getMessage());
        }
    }

    /**
     * GET /api/call/disposition_status?session_id=
     *
     * บอกมือถือว่าผลการโทรของ session นี้ถูกบันทึกแล้วหรือยัง (โดยคอมหรือมือถือ) เพื่อปิดฟอร์มเอง
     * นับว่า "บันทึกแล้ว" ถ้า disposed_at ถูกปัก หรือมีแถว call_history ของลูกค้าคนนี้ที่ result
     * ถูกกรอกหลังสายจบ (ดักกรณีฝั่งคอมเขียนแถวแยกไม่ได้ผูก session)
     */
    public static function dispositionStatus(PDO $pdo): void
    {
        $user = self::authUser($pdo);
        $sessionId = (int) ($_GET['session_id'] ?? 0);
        if ($sessionId <= 0) {
            json_response(['ok' => false, 'error' => 'SESSION_REQUIRED'], 400);
        }

        $stmt = $pdo->prepare(
            'SELECT agent_user_id, customer_id, disposed_at, requested_at
               FROM call_sessions WHERE id = ? LIMIT 1'
        );
        $stmt->execute([$sessionId]);
        $s = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$s || (int) $s['agent_user_id'] !== (int) $user['id']) {
            json_response(['ok' => false, 'error' => 'FORBIDDEN'], 403);
        }

        $disposed = $s['disposed_at'] !== null;
        if (!$disposed && !empty($s['customer_id'])) {
            // ฝั่งคอมกรอก LogCallModal แล้ว INSERT แถวใหม่ ตรวจว่ามีแถวที่มี result หลังสายเริ่ม
            $chk = $pdo->prepare(
                "SELECT 1 FROM call_history
                  WHERE customer_id = ? AND result IS NOT NULL AND result <> ''
                    AND `date` >= ? LIMIT 1"
            );
            $chk->execute([(int) $s['customer_id'], $s['requested_at']]);
            $disposed = (bool) $chk->fetchColumn();
        }

        json_response(['ok' => true, 'disposed' => $disposed]);
    }

    /**
     * GET /api/call/customer?customer_id=
     *
     * รายละเอียดลูกค้าสำหรับมือถือ (กดจากประวัติการโทร) — ไม่มีเบอร์ โทรผ่าน customer_id เท่านั้น
     * scope ตามบริษัทเหมือน endpoint อื่น
     */
    public static function customer(PDO $pdo): void
    {
        $user = self::authUser($pdo);
        $customerId = (int) ($_GET['customer_id'] ?? 0);
        if ($customerId <= 0) {
            json_response(['ok' => false, 'error' => 'CUSTOMER_REQUIRED'], 400);
        }

        $stmt = $pdo->prepare(
            "SELECT c.customer_id, c.first_name, c.last_name, c.province, c.current_basket_key,
                    c.assigned_to, c.lifecycle_status, c.behavioral_status, c.grade,
                    c.total_purchases, c.total_calls, c.date_registered, c.company_id,
                    TRIM(CONCAT(COALESCE(u.first_name,''),' ',COALESCE(u.last_name,''))) AS owner_name,
                    bc.basket_name AS basket_name
               FROM customers c
               LEFT JOIN users u ON u.id = c.assigned_to
               -- current_basket_key เก็บเป็น id ของ basket_config (varchar) ไม่ใช่ basket_key string
               -- และ basket_config มีเฉพาะ company 1 ใช้ร่วมทุกบริษัท จึง join ที่ id ตรง ๆ
               LEFT JOIN basket_config bc ON bc.id = c.current_basket_key
              WHERE c.customer_id = ? LIMIT 1"
        );
        $stmt->execute([$customerId]);
        $c = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$c) {
            json_response(['ok' => false, 'error' => 'CUSTOMER_NOT_FOUND'], 404);
        }

        $isSuper = in_array($user['role'] ?? '', ['Super Admin', 'Developer'], true);
        if (!$isSuper && (int) $c['company_id'] !== (int) ($user['company_id'] ?? 0)) {
            json_response(['ok' => false, 'error' => 'FORBIDDEN'], 403);
        }

        // ประวัติการโทรย่อของลูกค้ารายนี้ (ไม่มีเบอร์)
        $callStmt = $pdo->prepare(
            "SELECT status, result, duration, `date`, crop_type
               FROM call_history WHERE customer_id = ? ORDER BY `date` DESC LIMIT 6"
        );
        $callStmt->execute([$customerId]);
        $calls = [];
        $latestCrop = null;
        foreach ($callStmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            if ($latestCrop === null && !empty($r['crop_type'])) $latestCrop = $r['crop_type'];
            $calls[] = [
                'status'       => $r['status'],
                'result'       => $r['result'],
                'duration_sec' => $r['duration'] !== null ? (int) $r['duration'] : 0,
                'at'           => $r['date'],
            ];
        }

        // สวนที่บันทึกไว้จริงในโปรไฟล์ (customer_plots) — โชว์ให้พนักงานเห็นจะได้ไม่กรอกซ้ำ
        $plots = [];
        try {
            $plotStmt = $pdo->prepare(
                "SELECT cr.name AS crop, p.size_value, p.size_unit
                   FROM customer_plots p
                   JOIN crops cr ON cr.crop_id = p.crop_id
                  WHERE p.customer_id = ? AND p.is_active = 1
                  ORDER BY p.plot_id"
            );
            $plotStmt->execute([$customerId]);
            foreach ($plotStmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
                $plots[] = [
                    'crop'       => $r['crop'],
                    'size_value' => $r['size_value'] !== null ? (float) $r['size_value'] : null,
                    'size_unit'  => $r['size_unit'] ?: null,
                ];
            }
        } catch (Throwable $e) {
            error_log('CallController::customer plots: ' . $e->getMessage());
        }

        $name = trim(($c['first_name'] ?? '') . ' ' . ($c['last_name'] ?? ''));
        json_response([
            'ok' => true,
            'customer' => [
                'customer_id'    => (int) $c['customer_id'],
                'name'           => $name !== '' ? $name : 'ไม่ทราบชื่อ',
                'province'       => $c['province'] ?: null,
                // ถ้าแมตช์ชื่อถังไม่ได้ ให้เป็น null ไปเลย ไม่โชว์เลข id ดิบ (ผู้ใช้อ่านไม่ออก)
                'basket'         => $c['basket_name'] ?: null,
                'owner'          => trim((string) $c['owner_name']) ?: null,
                'lifecycle'      => $c['lifecycle_status'] ?: null,
                'grade'          => $c['grade'] ?: null,
                'total_purchases' => $c['total_purchases'] !== null ? (float) $c['total_purchases'] : 0,
                'total_calls'    => $c['total_calls'] !== null ? (int) $c['total_calls'] : 0,
                'since'          => $c['date_registered'],
                'crop'           => $latestCrop,
                'plots'          => $plots,
            ],
            'calls' => $calls,
        ]);
    }

    /**
     * GET /api/call/appointments — รายการลูกค้าที่นัดไว้ต้องโทรวันนี้ (จอ 12)
     *
     * เพิ่มพืชหลัก + จังหวัด ให้พนักงานเห็นบริบทก่อนโทร (ไม่มีเบอร์)
     */
    public static function appointments(PDO $pdo): void
    {
        $user = self::authUser($pdo);
        $agent = (int) $user['id'];
        $list = [];
        try {
            // อ่านจากตาราง appointments (แหล่งเดียวกับเว็บ) — นัดที่ยังไม่เสร็จ วันนี้ ของพนักงานคนนี้
            $stmt = $pdo->prepare(
                "SELECT a.customer_id, c.first_name, c.last_name, c.province, a.date AS follow_up_date,
                        (SELECT cr.name FROM customer_plots p JOIN crops cr ON cr.crop_id = p.crop_id
                          WHERE p.customer_id = c.customer_id AND p.is_active = 1 ORDER BY p.plot_id LIMIT 1) AS crop,
                        (SELECT p.size_value FROM customer_plots p
                          WHERE p.customer_id = c.customer_id AND p.is_active = 1 ORDER BY p.plot_id LIMIT 1) AS crop_size,
                        (SELECT p.size_unit FROM customer_plots p
                          WHERE p.customer_id = c.customer_id AND p.is_active = 1 ORDER BY p.plot_id LIMIT 1) AS crop_unit
                   FROM appointments a
                   JOIN customers c ON c.customer_id = a.customer_id
                  WHERE a.status <> 'เสร็จสิ้น' AND a.date >= CURDATE() AND a.date < CURDATE() + INTERVAL 1 DAY
                    AND (a.created_by = ? OR c.assigned_to = ?)
                  ORDER BY a.date ASC LIMIT 40"
            );
            $stmt->execute([$agent, $agent]);
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
                $name = trim(($r['first_name'] ?? '') . ' ' . ($r['last_name'] ?? ''));
                $crop = null;
                if (!empty($r['crop'])) {
                    $crop = $r['crop'];
                    if ($r['crop_size'] !== null) {
                        $sz = (float) $r['crop_size'];
                        $szStr = $sz == floor($sz) ? (string) (int) $sz : (string) $sz;
                        $crop .= ' ' . $szStr . ($r['crop_unit'] ? ' ' . $r['crop_unit'] : '');
                    }
                }
                $list[] = [
                    'customer_id' => (int) $r['customer_id'],
                    'name'        => $name !== '' ? $name : 'ไม่ทราบชื่อ',
                    'at'          => substr((string) $r['follow_up_date'], 11, 5),
                    'province'    => $r['province'] ?: null,
                    'crop'        => $crop,
                ];
            }
        } catch (Throwable $e) {
            error_log('CallController::appointments: ' . $e->getMessage());
        }
        json_response(['ok' => true, 'appointments' => $list]);
    }

    /**
     * GET /api/call/daily_summary — สรุปผลงานสิ้นวันของพนักงาน (จอ 15)
     *
     * ตัวเลขวันนี้ + เฉลี่ยต่อสาย + เทียบเมื่อวาน + จำนวนสายรายชั่วโมง (ไว้ทำ bar chart)
     */
    public static function dailySummary(PDO $pdo): void
    {
        $user = self::authUser($pdo);
        $agent = (int) $user['id'];
        $today = ['calls' => 0, 'talked' => 0, 'missed' => 0, 'sold' => 0, 'talk_sec' => 0, 'avg_sec' => 0];
        $hourly = [];
        $yesterday = 0;
        $appointments = 0;
        try {
            $t = $pdo->prepare(
                "SELECT COUNT(*) AS calls,
                        SUM(CASE WHEN status IN ('ได้คุย','รับสาย') THEN 1 ELSE 0 END) AS talked,
                        SUM(CASE WHEN result = 'ขายได้' THEN 1 ELSE 0 END) AS sold,
                        COALESCE(SUM(duration),0) AS talk_sec
                   FROM call_history WHERE caller_id = ? AND `date` >= CURDATE()"
            );
            $t->execute([$agent]);
            if ($r = $t->fetch(PDO::FETCH_ASSOC)) {
                $c = (int) $r['calls']; $tk = (int) $r['talked']; $sec = (int) $r['talk_sec'];
                $today = [
                    'calls' => $c, 'talked' => $tk, 'missed' => max(0, $c - $tk),
                    'sold' => (int) $r['sold'], 'talk_sec' => $sec,
                    'avg_sec' => $tk > 0 ? intdiv($sec, $tk) : 0,
                ];
            }
            $h = $pdo->prepare(
                "SELECT HOUR(`date`) AS hh, COUNT(*) AS n
                   FROM call_history WHERE caller_id = ? AND `date` >= CURDATE()
                  GROUP BY HOUR(`date`) ORDER BY hh"
            );
            $h->execute([$agent]);
            foreach ($h->fetchAll(PDO::FETCH_ASSOC) as $r) {
                $hourly[] = ['hour' => (int) $r['hh'], 'count' => (int) $r['n']];
            }
            $y = $pdo->prepare(
                "SELECT COUNT(*) FROM call_history
                  WHERE caller_id = ? AND `date` >= CURDATE() - INTERVAL 1 DAY AND `date` < CURDATE()"
            );
            $y->execute([$agent]);
            $yesterday = (int) $y->fetchColumn();
            $a = $pdo->prepare(
                "SELECT COUNT(DISTINCT a.customer_id)
                   FROM appointments a JOIN customers c ON c.customer_id = a.customer_id
                  WHERE a.status <> 'เสร็จสิ้น' AND a.date >= CURDATE() AND a.date < CURDATE() + INTERVAL 1 DAY
                    AND (a.created_by = ? OR c.assigned_to = ?)"
            );
            $a->execute([$agent, $agent]);
            $appointments = (int) $a->fetchColumn();
        } catch (Throwable $e) {
            error_log('CallController::dailySummary: ' . $e->getMessage());
        }
        json_response([
            'ok' => true, 'today' => $today,
            'yesterday_calls' => $yesterday, 'appointments' => $appointments, 'hourly' => $hourly,
        ]);
    }

    /** ปิดเบอร์เปิดอยู่ไหม (gate ฟีเจอร์ออเดอร์รอเปิด) */
    private static function saleCaptureEnabled(PDO $pdo): bool
    {
        require_once __DIR__ . '/../phone_privacy.php';
        return function_exists('phone_masking_stage') && phone_masking_stage($pdo) !== 'off';
    }

    /**
     * GET /api/call/products?q= — รายการสินค้าสำหรับบันทึกการขาย (โผล่เฉพาะตอนปิดเบอร์เปิด)
     */
    public static function products(PDO $pdo): void
    {
        $user = self::authUser($pdo);
        if (!self::saleCaptureEnabled($pdo)) {
            json_response(['ok' => true, 'enabled' => false, 'products' => []]);
        }
        $q = trim((string) ($_GET['q'] ?? ''));
        $isSuper = in_array($user['role'] ?? '', ['Super Admin', 'Developer'], true);
        $where = ["p.deleted_at IS NULL", "p.status = 'Active'"];
        $params = [];
        if (!$isSuper) {
            $where[] = 'p.company_id = ?';
            $params[] = (int) ($user['company_id'] ?? 0);
        }
        if ($q !== '') {
            $where[] = "(p.name LIKE ? OR p.sku LIKE ?)";
            $params[] = "%$q%"; $params[] = "%$q%";
        }
        $out = [];
        try {
            $stmt = $pdo->prepare(
                "SELECT p.id, p.name, p.unit, p.price
                   FROM products p WHERE " . implode(' AND ', $where) . "
                  ORDER BY p.name LIMIT 100"
            );
            $stmt->execute($params);
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
                $out[] = [
                    'id'    => (int) $r['id'],
                    'name'  => $r['name'],
                    'unit'  => $r['unit'] ?: null,
                    'price' => $r['price'] !== null ? (float) $r['price'] : null,
                ];
            }
        } catch (Throwable $e) {
            error_log('CallController::products: ' . $e->getMessage());
        }
        json_response(['ok' => true, 'enabled' => true, 'products' => $out]);
    }

    /**
     * POST /api/call/pending_order — บันทึก "ออเดอร์รอเปิด" จากมือถือ (ขายได้ที่บ้าน)
     *   { session_id?, customer_id, note?, items:[{product_id?, name, qty, unit?}] }
     */
    public static function pendingOrder(PDO $pdo): void
    {
        $user = self::authUser($pdo);
        if (!self::saleCaptureEnabled($pdo)) {
            json_response(['ok' => false, 'error' => 'DISABLED'], 403);
        }
        $in = json_input();
        $customerId = (int) ($in['customer_id'] ?? 0);
        $items = $in['items'] ?? [];
        if ($customerId <= 0 || !is_array($items) || !$items) {
            json_response(['ok' => false, 'error' => 'INVALID'], 400);
        }

        $callHistoryId = null;
        $sessionId = (int) ($in['session_id'] ?? 0);
        if ($sessionId > 0) {
            $s = $pdo->prepare('SELECT call_history_id FROM call_sessions WHERE id = ? AND agent_user_id = ? LIMIT 1');
            $s->execute([$sessionId, (int) $user['id']]);
            $callHistoryId = $s->fetchColumn() ?: null;
        }
        $cs = $pdo->prepare('SELECT company_id FROM customers WHERE customer_id = ? LIMIT 1');
        $cs->execute([$customerId]);
        $companyId = $cs->fetchColumn();
        if ($companyId === false) {
            $companyId = $user['company_id'] ?? null;
        }
        $note = trim((string) ($in['note'] ?? ''));
        $openMode = (($in['open_mode'] ?? 'backoffice') === 'self') ? 'self' : 'backoffice';

        try {
            $pdo->prepare(
                'INSERT INTO pending_orders (customer_id, agent_user_id, company_id, call_history_id, note, open_mode)
                 VALUES (?, ?, ?, ?, ?, ?)'
            )->execute([
                $customerId, (int) $user['id'],
                $companyId !== null ? (int) $companyId : null,
                $callHistoryId ? (int) $callHistoryId : null,
                $note !== '' ? $note : null,
                $openMode,
            ]);
            $poId = (int) $pdo->lastInsertId();
            $ins = $pdo->prepare(
                'INSERT INTO pending_order_items (pending_order_id, product_id, product_name, qty, unit)
                 VALUES (?, ?, ?, ?, ?)'
            );
            foreach ($items as $it) {
                $name = trim((string) ($it['name'] ?? ''));
                if ($name === '') {
                    continue;
                }
                $ins->execute([
                    $poId,
                    isset($it['product_id']) && $it['product_id'] ? (int) $it['product_id'] : null,
                    $name,
                    max(0.01, (float) ($it['qty'] ?? 1)),
                    !empty($it['unit']) ? $it['unit'] : null,
                ]);
            }
            json_response(['ok' => true, 'pending_order_id' => $poId]);
        } catch (Throwable $e) {
            error_log('CallController::pendingOrder: ' . $e->getMessage());
            json_response(['ok' => false, 'error' => 'SAVE_FAILED'], 500);
        }
    }

    /**
     * GET /api/call/search?q= — ค้นหาลูกค้าด้วยชื่อหรือรหัส (ไม่มีเบอร์)
     *
     * กฎเหล็ก: ห้ามค้นด้วยเบอร์โทร — จึงแตะเฉพาะ customer_id (ตัวเลขสั้น ≤7 หลัก) กับชื่อ
     * ไม่มีคอลัมน์เบอร์ใน query เลย · scope เฉพาะบริษัทของพนักงาน (super เห็นหมด)
     */
    public static function search(PDO $pdo): void
    {
        $user = self::authUser($pdo);
        $q = trim((string) ($_GET['q'] ?? ''));
        if ($q === '') {
            json_response(['ok' => true, 'results' => []]);
        }

        $isSuper = in_array($user['role'] ?? '', ['Super Admin', 'Developer'], true);
        $where = [];
        $params = [];
        if (!$isSuper) {
            $where[] = 'c.company_id = ?';
            $params[] = (int) ($user['company_id'] ?? 0);
        }
        // รหัส (ตัวเลขสั้น) หรือชื่อ — กันเผลอค้นด้วยเบอร์ (ยาว) ให้ตกไปที่ค้นชื่ออย่างเดียว
        if (ctype_digit($q) && strlen($q) <= 7) {
            $where[] = "(c.customer_id = ? OR CONCAT(COALESCE(c.first_name,''),' ',COALESCE(c.last_name,'')) LIKE ?)";
            $params[] = (int) $q;
            $params[] = "%$q%";
        } else {
            $where[] = "CONCAT(COALESCE(c.first_name,''),' ',COALESCE(c.last_name,'')) LIKE ?";
            $params[] = "%$q%";
        }

        $sql = "SELECT c.customer_id, c.first_name, c.last_name, c.province, c.grade,
                       bc.basket_name
                  FROM customers c
                  LEFT JOIN basket_config bc ON bc.id = c.current_basket_key
                 WHERE " . implode(' AND ', $where) . "
                 ORDER BY c.customer_id DESC LIMIT 30";
        $results = [];
        try {
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
                $name = trim(($r['first_name'] ?? '') . ' ' . ($r['last_name'] ?? ''));
                $results[] = [
                    'customer_id' => (int) $r['customer_id'],
                    'name'        => $name !== '' ? $name : 'ไม่ทราบชื่อ',
                    'province'    => $r['province'] ?: null,
                    'grade'       => $r['grade'] ?: null,
                    'basket'      => $r['basket_name'] ?: null,
                ];
            }
        } catch (Throwable $e) {
            error_log('CallController::search: ' . $e->getMessage());
        }
        json_response(['ok' => true, 'results' => $results]);
    }

    /**
     * GET /api/call/home — ข้อมูลหน้า "พร้อมรับงาน" ของพนักงานคนนี้
     *
     * สรุปผลงานวันนี้ (โทร/ได้คุย/เวลาคุยรวม) + รายการลูกค้าที่นัดไว้ต้องโทรวันนี้ (ไม่มีเบอร์)
     * ทุกอย่างห่อ try/catch แยกกัน — จอหลักต้องไม่พังเพราะ query ส่วนใดส่วนหนึ่งล้ม
     */
    public static function home(PDO $pdo): void
    {
        $user = self::authUser($pdo);
        $agent = (int) $user['id'];

        $today = ['calls' => 0, 'talked' => 0, 'missed' => 0, 'sold' => 0, 'talk_sec' => 0];
        try {
            $t = $pdo->prepare(
                "SELECT COUNT(*) AS calls,
                        SUM(CASE WHEN status IN ('ได้คุย','รับสาย') THEN 1 ELSE 0 END) AS talked,
                        SUM(CASE WHEN result = 'ขายได้' THEN 1 ELSE 0 END) AS sold,
                        COALESCE(SUM(duration),0) AS talk_sec
                   FROM call_history
                  WHERE caller_id = ? AND `date` >= CURDATE()"
            );
            $t->execute([$agent]);
            if ($r = $t->fetch(PDO::FETCH_ASSOC)) {
                $calls = (int) $r['calls'];
                $talked = (int) $r['talked'];
                $today = [
                    'calls'    => $calls,
                    'talked'   => $talked,
                    'missed'   => max(0, $calls - $talked),   // ที่ไม่ได้คุย = ทั้งหมด − ได้คุย
                    'sold'     => (int) $r['sold'],
                    'talk_sec' => (int) $r['talk_sec'],
                ];
            }
        } catch (Throwable $e) {
            error_log('CallController::home today: ' . $e->getMessage());
        }

        $followups = [];
        try {
            // อ่านจากตาราง appointments (แหล่งเดียวกับเว็บ) — นัดที่ยังไม่เสร็จ วันนี้ ของพนักงานคนนี้
            $f = $pdo->prepare(
                "SELECT a.customer_id, c.first_name, c.last_name, a.date, a.title, a.notes
                   FROM appointments a
                   JOIN customers c ON c.customer_id = a.customer_id
                  WHERE a.status <> 'เสร็จสิ้น' AND a.date >= CURDATE() AND a.date < CURDATE() + INTERVAL 1 DAY
                    AND (a.created_by = ? OR c.assigned_to = ?)
                  ORDER BY a.date ASC LIMIT 20"
            );
            $f->execute([$agent, $agent]);
            foreach ($f->fetchAll(PDO::FETCH_ASSOC) as $r) {
                $name = trim(($r['first_name'] ?? '') . ' ' . ($r['last_name'] ?? ''));
                // บรรทัดโน้ตใต้ชื่อในแอป: หัวข้อนัดก่อน ไม่มีค่อยใช้รายละเอียด — ตัดสั้นกันล้นการ์ด
                $note = trim((string) ($r['title'] ?? ''));
                if ($note === '') $note = trim((string) ($r['notes'] ?? ''));
                if ($note !== '') $note = mb_substr(preg_replace('/\s+/u', ' ', $note), 0, 80);
                $followups[] = [
                    'customer_id' => (int) $r['customer_id'],
                    'name'        => $name !== '' ? $name : 'ไม่ทราบชื่อ',
                    'at'          => substr((string) $r['date'], 11, 5),
                    'note'        => $note !== '' ? $note : null,
                ];
            }
        } catch (Throwable $e) {
            error_log('CallController::home followups: ' . $e->getMessage());
        }

        // เป็นหัวหน้าไหม (มีลูกน้อง active) — ใช้บอกแอปว่าจะโชว์แท็บ "ทีม" หรือไม่
        $isSupervisor = false;
        try {
            $s = $pdo->prepare(
                "SELECT 1 FROM users WHERE supervisor_id = ? AND status = 'active' LIMIT 1"
            );
            $s->execute([$agent]);
            $isSupervisor = (bool) $s->fetchColumn();
        } catch (Throwable $e) {
            error_log('CallController::home is_supervisor: ' . $e->getMessage());
        }

        // ป้ายทีมในหน้า "ฉัน" — ระบบไม่มีตาราง teams ทีมจึงนิยามด้วยหัวหน้า (supervisor_id)
        // ใช้ชื่อเล่นหัวหน้า (first_name เก็บชื่อเล่น) → "ทีมหนิง"
        $team = null;
        try {
            $sv = $pdo->prepare(
                'SELECT s.first_name FROM users u JOIN users s ON s.id = u.supervisor_id WHERE u.id = ? LIMIT 1'
            );
            $sv->execute([$agent]);
            $n = trim((string) $sv->fetchColumn());
            if ($n !== '') $team = 'ทีม' . $n;
        } catch (Throwable $e) {
            error_log('CallController::home team: ' . $e->getMessage());
        }

        json_response([
            'ok' => true,
            'today' => $today,
            'followups' => $followups,
            'is_supervisor' => $isSupervisor,
            'team' => $team,
        ]);
    }

    /**
     * POST /api/call/verify_admin { username, password }
     *
     * ยืนยันว่าเป็นผู้ดูแลระดับสูง (roles.is_system = 1) ก่อนยอมให้ออกจากระบบบนเครื่องเทเล
     * เครื่องต้องลงชื่อเข้าใช้อยู่แล้วถึงเรียกได้ (กันคนสุ่มยิง) แล้วส่ง user/pass ของแอดมินมาตรวจ
     * รหัสในระบบนี้เก็บเป็น plaintext (ดู handle_auth ใน index.php) จึงเทียบตรง ๆ
     */
    public static function verifyAdmin(PDO $pdo): void
    {
        self::authUser($pdo); // เครื่องต้อง signed-in ก่อน
        $in = json_input();
        $username = trim((string) ($in['username'] ?? ''));
        $password = (string) ($in['password'] ?? '');
        if ($username === '' || $password === '') {
            json_response(['ok' => false, 'error' => 'MISSING',
                'message' => 'กรอกชื่อผู้ใช้และรหัสผ่านผู้ดูแล'], 400);
        }

        $stmt = $pdo->prepare(
            'SELECT u.password, u.status, u.role, r.is_system
               FROM users u LEFT JOIN roles r ON u.role = r.name
              WHERE u.username = ? LIMIT 1'
        );
        $stmt->execute([$username]);
        $a = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$a || $a['status'] !== 'active' || !hash_equals((string) $a['password'], $password)) {
            json_response(['ok' => false, 'error' => 'INVALID_CREDENTIALS',
                'message' => 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'], 401);
        }
        if (empty($a['is_system'])) {
            json_response(['ok' => false, 'error' => 'NOT_ADMIN',
                'message' => 'ต้องเป็นผู้ดูแลระดับสูงเท่านั้นจึงออกจากระบบได้'], 403);
        }
        json_response(['ok' => true, 'role' => $a['role']]);
    }

    /**
     * GET /api/call/team — แดชบอร์ดคุมทีมสำหรับหัวหน้า
     *
     * "หัวหน้า" นิยามจาก "มีลูกน้อง" (มี active user ที่ supervisor_id = ผู้เรียก) ไม่ใช่จาก role
     * เพราะ role ในระบบนี้ปนกัน (หัวหน้าทีมบางคนถือ role Marketing/Telesale เหมือนลูกทีม)
     *
     * คืนลูกน้องแต่ละคนพร้อม:
     *  - state สด: on_call (กำลังคุย) / calling (กำลังโทร) / online / offline
     *      จาก call_sessions (ยังไม่ ended) + agent_devices.last_seen_at ที่ poll เขียนทุก 2-3 วิอยู่แล้ว
     *  - ตัวเลขวันนี้: โทร/ได้คุย/ขายได้/เวลาคุย (สูตรเดียวกับ home เป๊ะ)
     *  - นัดหมายค้างวันนี้
     * ผู้เรียกที่ไม่มีลูกน้อง → is_supervisor=false, members=[] (แอปซ่อนแท็บ)
     */
    public static function team(PDO $pdo): void
    {
        $user = self::authUser($pdo);
        $meId = (int) $user['id'];
        $companyId = (int) ($user['company_id'] ?? 0);

        // 1) ลูกน้อง (active, บริษัทเดียวกัน)
        $members = [];
        $ids = [];
        try {
            $sql = "SELECT id, first_name, last_name, username
                      FROM users
                     WHERE supervisor_id = ? AND status = 'active'";
            $params = [$meId];
            if ($companyId > 0) { $sql .= " AND company_id = ?"; $params[] = $companyId; }
            $sql .= " ORDER BY first_name, last_name";
            $m = $pdo->prepare($sql);
            $m->execute($params);
            foreach ($m->fetchAll(PDO::FETCH_ASSOC) as $r) {
                $id = (int) $r['id'];
                $ids[] = $id;
                $nm = trim(($r['first_name'] ?? '') . ' ' . ($r['last_name'] ?? ''));
                $members[$id] = [
                    'id'            => $id,
                    'name'          => $nm !== '' ? $nm : ((string) ($r['username'] ?? ('#' . $id))),
                    'state'         => 'offline',   // offline | online | calling | on_call
                    'on_call_since' => null,
                    'last_seen'     => null,
                    'calls'         => 0,
                    'talked'        => 0,
                    'sold'          => 0,
                    'talk_sec'      => 0,
                    'appointments'  => 0,
                ];
            }
        } catch (Throwable $e) {
            error_log('CallController::team members: ' . $e->getMessage());
        }

        if (!$ids) {
            json_response(['ok' => true, 'is_supervisor' => false, 'members' => []]);
        }

        // ids เป็น int แน่นอน (cast แล้ว) — ปลอดภัยพอจะ inline ใน IN(...)
        $in = implode(',', array_map('intval', $ids));

        // 2) ตัวเลขวันนี้ (สูตรเดียวกับ home) — group ตามคนโทร
        try {
            $t = $pdo->query(
                "SELECT caller_id,
                        COUNT(*) AS calls,
                        SUM(CASE WHEN status IN ('ได้คุย','รับสาย') THEN 1 ELSE 0 END) AS talked,
                        SUM(CASE WHEN result = 'ขายได้' THEN 1 ELSE 0 END) AS sold,
                        COALESCE(SUM(duration),0) AS talk_sec
                   FROM call_history
                  WHERE caller_id IN ($in) AND `date` >= CURDATE()
                  GROUP BY caller_id"
            );
            foreach ($t->fetchAll(PDO::FETCH_ASSOC) as $r) {
                $id = (int) $r['caller_id'];
                if (!isset($members[$id])) continue;
                $members[$id]['calls']    = (int) $r['calls'];
                $members[$id]['talked']   = (int) $r['talked'];
                $members[$id]['sold']     = (int) $r['sold'];
                $members[$id]['talk_sec'] = (int) $r['talk_sec'];
            }
        } catch (Throwable $e) {
            error_log('CallController::team today: ' . $e->getMessage());
        }

        // 3) นัดหมายค้างวันนี้ (คนสร้างนัด = ลูกทีม)
        try {
            $a = $pdo->query(
                "SELECT a.created_by AS uid, COUNT(*) AS n
                   FROM appointments a
                  WHERE a.status <> 'เสร็จสิ้น'
                    AND a.date >= CURDATE() AND a.date < CURDATE() + INTERVAL 1 DAY
                    AND a.created_by IN ($in)
                  GROUP BY a.created_by"
            );
            foreach ($a->fetchAll(PDO::FETCH_ASSOC) as $r) {
                $id = (int) $r['uid'];
                if (isset($members[$id])) $members[$id]['appointments'] = (int) $r['n'];
            }
        } catch (Throwable $e) {
            error_log('CallController::team appts: ' . $e->getMessage());
        }

        // 4) สถานะสด จาก call_sessions ที่ยังไม่จบ
        try {
            $s = $pdo->query(
                "SELECT agent_user_id AS uid, status, answered_at
                   FROM call_sessions
                  WHERE agent_user_id IN ($in)
                    AND ended_at IS NULL
                    AND status IN ('queued','dispatched','ringing','answered')
                  ORDER BY id DESC"
            );
            foreach ($s->fetchAll(PDO::FETCH_ASSOC) as $r) {
                $id = (int) $r['uid'];
                if (!isset($members[$id])) continue;
                if ($members[$id]['state'] === 'on_call') continue; // มีสายที่คุยอยู่แล้ว เก็บอันนั้นไว้
                if (!empty($r['answered_at'])) {
                    $members[$id]['state'] = 'on_call';
                    $members[$id]['on_call_since'] = $r['answered_at'];
                } elseif ($members[$id]['state'] === 'offline') {
                    $members[$id]['state'] = 'calling';
                }
            }
        } catch (Throwable $e) {
            error_log('CallController::team live: ' . $e->getMessage());
        }

        // 5) ออนไลน์ล่าสุด จาก agent_devices.last_seen_at (poll เขียนทุก 2-3 วิ)
        try {
            $d = $pdo->query(
                "SELECT user_id, MAX(last_seen_at) AS seen
                   FROM agent_devices
                  WHERE user_id IN ($in) AND status = 'active'
                  GROUP BY user_id"
            );
            $onlineCut = time() - 90; // เห็นภายใน 90 วิ = ยังออนไลน์
            foreach ($d->fetchAll(PDO::FETCH_ASSOC) as $r) {
                $id = (int) $r['user_id'];
                if (!isset($members[$id])) continue;
                $members[$id]['last_seen'] = $r['seen'];
                if ($members[$id]['state'] === 'offline'
                    && $r['seen'] !== null && strtotime((string) $r['seen']) >= $onlineCut) {
                    $members[$id]['state'] = 'online';
                }
            }
        } catch (Throwable $e) {
            error_log('CallController::team presence: ' . $e->getMessage());
        }

        // เรียง: กำลังคุย → กำลังโทร → ออนไลน์ → ออฟไลน์ แล้วตามชื่อ
        $list = array_values($members);
        $rank = ['on_call' => 0, 'calling' => 1, 'online' => 2, 'offline' => 3];
        usort($list, function ($a, $b) use ($rank) {
            $da = $rank[$a['state']] ?? 9;
            $db = $rank[$b['state']] ?? 9;
            if ($da !== $db) return $da - $db;
            return strcmp($a['name'], $b['name']);
        });

        json_response(['ok' => true, 'is_supervisor' => true, 'members' => $list]);
    }
}
