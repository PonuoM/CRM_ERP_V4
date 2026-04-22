<?php
/**
 * Commission Settings API
 * GET ?company_id=X&role_id=Y (optional role_id)
 * POST { company_id, role_id, user_id, config_data }
 */
require_once __DIR__ . "/../config.php";

header('Content-Type: application/json; charset=utf-8');

try {
    $pdo = db_connect();
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        $company_id = isset($_GET['company_id']) ? (int)$_GET['company_id'] : 0;
        $role_id = isset($_GET['role_id']) ? (int)$_GET['role_id'] : 0;

        if (!$company_id) {
            echo json_encode(['ok' => false, 'error' => 'Missing company_id']);
            exit;
        }

        if ($role_id > 0) {
            $stmt = $pdo->prepare("SELECT id, role_id, config_data, updated_at, updated_by FROM commission_settings WHERE company_id = ? AND role_id = ? LIMIT 1");
            $stmt->execute([$company_id, $role_id]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($row) {
                $row['config_data'] = json_decode($row['config_data'], true);
            }

            echo json_encode(['ok' => true, 'data' => $row ?: null]);
        } else {
            $stmt = $pdo->prepare("SELECT id, role_id, config_data, updated_at, updated_by FROM commission_settings WHERE company_id = ?");
            $stmt->execute([$company_id]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($rows as &$r) {
                $r['config_data'] = json_decode($r['config_data'], true);
            }

            echo json_encode(['ok' => true, 'data' => $rows]);
        }
    } elseif ($method === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $company_id = (int)($input['company_id'] ?? 0);
        $role_id = (int)($input['role_id'] ?? 0);
        $user_id = (int)($input['user_id'] ?? 0);
        $config_data = isset($input['config_data']) ? json_encode($input['config_data'], JSON_UNESCAPED_UNICODE) : null;

        if (!$company_id || !$role_id) {
            echo json_encode(['ok' => false, 'error' => 'Missing company_id or role_id']);
            exit;
        }

        // Upsert logic
        $stmt = $pdo->prepare("
            INSERT INTO commission_settings (company_id, role_id, config_data, updated_by, updated_at)
            VALUES (?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE 
                config_data = VALUES(config_data),
                updated_by = VALUES(updated_by),
                updated_at = NOW()
        ");
        $stmt->execute([$company_id, $role_id, $config_data, $user_id > 0 ? $user_id : null]);

        echo json_encode(['ok' => true, 'message' => 'Settings saved successfully']);
    } else {
        http_response_code(405);
        echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    }

} catch (Exception $e) {
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
