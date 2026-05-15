<?php
/**
 * Monitor — Settings API
 *
 * GET  → returns current daily call target + minute target (per company)
 * POST → updates settings (Admin / Supervisor only)
 *
 * Stored in `env` table:
 *   MONITOR_DAILY_CALL_TARGET_{company_id}         (talked calls/day, default 40)
 *   MONITOR_DAILY_CALL_MINUTE_TARGET_{company_id}  (call minutes/day, default 100)
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
    $callKey   = "MONITOR_DAILY_CALL_TARGET_{$companyId}";
    $minKey    = "MONITOR_DAILY_CALL_MINUTE_TARGET_{$companyId}";

    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    if ($method === 'GET') {
        json_response([
            'success' => true,
            'data' => [
                'daily_call_target'   => (int) (fetch_setting($pdo, $callKey) ?: 40),
                'daily_minute_target' => (int) (fetch_setting($pdo, $minKey) ?: 100),
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

        $updated = [];

        if (isset($body['daily_call_target'])) {
            $val = (int) $body['daily_call_target'];
            if ($val < 1 || $val > 500) {
                json_response(['success' => false, 'message' => 'daily_call_target must be 1..500'], 400);
                exit;
            }
            upsert_setting($pdo, $callKey, (string) $val, $companyId);
            $updated['daily_call_target'] = $val;
        }

        if (isset($body['daily_minute_target'])) {
            $val = (int) $body['daily_minute_target'];
            if ($val < 1 || $val > 1440) {
                json_response(['success' => false, 'message' => 'daily_minute_target must be 1..1440'], 400);
                exit;
            }
            upsert_setting($pdo, $minKey, (string) $val, $companyId);
            $updated['daily_minute_target'] = $val;
        }

        if (empty($updated)) {
            json_response(['success' => false, 'message' => 'No valid fields to update'], 400);
            exit;
        }

        json_response(['success' => true, 'data' => $updated]);
        exit;
    }

    json_response(['success' => false, 'message' => 'Method not allowed'], 405);

} catch (Throwable $e) {
    error_log("Monitor/settings.php error: " . $e->getMessage());
    json_response(['success' => false, 'message' => 'Server error', 'detail' => $e->getMessage()], 500);
}

function fetch_setting(PDO $pdo, string $key)
{
    $stmt = $pdo->prepare("SELECT value FROM env WHERE `key` = ? LIMIT 1");
    $stmt->execute([$key]);
    $row = $stmt->fetch();
    return $row ? $row['value'] : null;
}

function upsert_setting(PDO $pdo, string $key, string $value, int $companyId): void
{
    $stmt = $pdo->prepare("SELECT id FROM env WHERE `key` = ? LIMIT 1");
    $stmt->execute([$key]);
    $row = $stmt->fetch();
    if ($row) {
        $stmt = $pdo->prepare("UPDATE env SET value = ?, updated_at = NOW() WHERE id = ?");
        $stmt->execute([$value, (int) $row['id']]);
    } else {
        $stmt = $pdo->prepare("INSERT INTO env (`key`, value, company_id, created_at) VALUES (?, ?, ?, NOW())");
        $stmt->execute([$key, $value, $companyId]);
    }
}
