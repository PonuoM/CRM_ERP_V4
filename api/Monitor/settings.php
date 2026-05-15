<?php
/**
 * Monitor — Settings API
 *
 * GET  → returns current daily call target (per company)
 * POST → updates daily call target (Admin / Supervisor only)
 *
 * Stored in `env` table:
 *   key = MONITOR_DAILY_CALL_TARGET_{company_id}
 *   value = integer string (e.g. "40")
 */

require_once __DIR__ . '/../config.php';

cors();

try {
    $pdo = db_connect();
    $user = get_authenticated_user($pdo);
    if (!$user) {
        json_response(['success' => false, 'message' => 'Unauthorized'], 401);
        exit;
    }

    $companyId = (int) $user['company_id'];
    $role      = strtolower($user['role'] ?? '');
    $key       = "MONITOR_DAILY_CALL_TARGET_{$companyId}";

    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    if ($method === 'GET') {
        $stmt = $pdo->prepare("SELECT value FROM env WHERE `key` = ? LIMIT 1");
        $stmt->execute([$key]);
        $row = $stmt->fetch();
        json_response([
            'success' => true,
            'data' => [
                'daily_call_target' => $row ? (int) $row['value'] : 40,
            ],
        ]);
        exit;
    }

    if ($method === 'POST' || $method === 'PUT') {
        $isAdmin      = strpos($role, 'admin') !== false && strpos($role, 'admin page') === false;
        $isSupervisor = strpos($role, 'supervisor') !== false;
        $isCEO        = strpos($role, 'ceo') !== false;
        if (!$isAdmin && !$isSupervisor && !$isCEO) {
            json_response(['success' => false, 'message' => 'Only Admin/Supervisor may change settings'], 403);
            exit;
        }

        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $target = isset($body['daily_call_target']) ? (int) $body['daily_call_target'] : null;
        if ($target === null || $target < 1 || $target > 500) {
            json_response(['success' => false, 'message' => 'daily_call_target must be 1..500'], 400);
            exit;
        }

        // Upsert
        $stmt = $pdo->prepare("SELECT id FROM env WHERE `key` = ? LIMIT 1");
        $stmt->execute([$key]);
        $existing = $stmt->fetch();
        if ($existing) {
            $stmt = $pdo->prepare("UPDATE env SET value = ?, updated_at = NOW() WHERE id = ?");
            $stmt->execute([(string) $target, (int) $existing['id']]);
        } else {
            $stmt = $pdo->prepare("INSERT INTO env (`key`, value, company_id, created_at) VALUES (?, ?, ?, NOW())");
            $stmt->execute([$key, (string) $target, $companyId]);
        }

        json_response([
            'success' => true,
            'data' => ['daily_call_target' => $target],
        ]);
        exit;
    }

    json_response(['success' => false, 'message' => 'Method not allowed'], 405);

} catch (Throwable $e) {
    error_log("Monitor/settings.php error: " . $e->getMessage());
    json_response(['success' => false, 'message' => 'Server error', 'detail' => $e->getMessage()], 500);
}
