<?php
require_once __DIR__ . '/../config.php';

header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    $pdo = db_connect();
    $method = $_SERVER['REQUEST_METHOD'];

    // GET: List all cancellation types
    if ($method === 'GET') {
        $stmt = $pdo->prepare("SELECT id, label, description, sort_order, is_active, created_at FROM cancellation_types ORDER BY sort_order ASC");
        $stmt->execute();
        $types = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Get default type setting
        $defaultTypeId = null;
        try {
            $pdo->exec("CREATE TABLE IF NOT EXISTS app_settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                setting_key VARCHAR(100) NOT NULL UNIQUE,
                setting_value TEXT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

            $settingStmt = $pdo->prepare("SELECT setting_value FROM app_settings WHERE setting_key = 'default_cancellation_type_id' LIMIT 1");
            $settingStmt->execute();
            $row = $settingStmt->fetch(PDO::FETCH_ASSOC);
            $defaultTypeId = $row ? (int) $row['setting_value'] : null;
        } catch (Exception $e) {
            // ignore if table creation fails
        }

        echo json_encode([
            'status' => 'success',
            'data' => $types,
            'default_type_id' => $defaultTypeId,
        ]);
        exit();
    }

    // POST: Create new cancellation type
    if ($method === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true);

        // Handle default type setting
        if (isset($data['action']) && $data['action'] === 'set_default') {
            $typeId = (int) ($data['default_type_id'] ?? 0);

            // Ensure app_settings table exists
            $pdo->exec("CREATE TABLE IF NOT EXISTS app_settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                setting_key VARCHAR(100) NOT NULL UNIQUE,
                setting_value TEXT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

            $stmt = $pdo->prepare("
                INSERT INTO app_settings (setting_key, setting_value)
                VALUES ('default_cancellation_type_id', ?)
                ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
            ");
            $stmt->execute([$typeId]);

            echo json_encode(['status' => 'success', 'message' => 'Default cancellation type updated']);
            exit();
        }

        $label = trim($data['label'] ?? '');
        $description = trim($data['description'] ?? '');
        $sortOrder = (int) ($data['sort_order'] ?? 0);

        if (empty($label)) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Label is required']);
            exit();
        }

        // Get max sort_order if not provided
        if ($sortOrder === 0) {
            $maxStmt = $pdo->query("SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order FROM cancellation_types");
            $sortOrder = (int) $maxStmt->fetch(PDO::FETCH_ASSOC)['next_order'];
        }

        $stmt = $pdo->prepare("INSERT INTO cancellation_types (label, description, sort_order) VALUES (?, ?, ?)");
        $stmt->execute([$label, $description, $sortOrder]);

        echo json_encode([
            'status' => 'success',
            'data' => ['id' => (int) $pdo->lastInsertId(), 'label' => $label, 'description' => $description, 'sort_order' => $sortOrder],
        ]);
        exit();
    }

    // PUT: Update cancellation type
    if ($method === 'PUT') {
        $data = json_decode(file_get_contents('php://input'), true);
        $id = (int) ($data['id'] ?? 0);
        $label = trim($data['label'] ?? '');
        $description = trim($data['description'] ?? '');
        $sortOrder = isset($data['sort_order']) ? (int) $data['sort_order'] : null;
        $isActive = isset($data['is_active']) ? (int) $data['is_active'] : null;

        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Invalid ID']);
            exit();
        }

        $fields = [];
        $params = [];

        if (!empty($label)) {
            $fields[] = 'label = ?';
            $params[] = $label;
        }
        if ($description !== '') {
            $fields[] = 'description = ?';
            $params[] = $description;
        }
        if ($sortOrder !== null) {
            $fields[] = 'sort_order = ?';
            $params[] = $sortOrder;
        }
        if ($isActive !== null) {
            $fields[] = 'is_active = ?';
            $params[] = $isActive;
        }

        if (empty($fields)) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'No fields to update']);
            exit();
        }

        $params[] = $id;
        $stmt = $pdo->prepare("UPDATE cancellation_types SET " . implode(', ', $fields) . " WHERE id = ?");
        $stmt->execute($params);

        echo json_encode(['status' => 'success', 'message' => 'Updated successfully']);
        exit();
    }

    // DELETE: Soft delete (set is_active = 0)
    if ($method === 'DELETE') {
        $data = json_decode(file_get_contents('php://input'), true);
        $id = (int) ($data['id'] ?? $_GET['id'] ?? 0);

        if ($id <= 0) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Invalid ID']);
            exit();
        }

        // Check if type is in use
        $usageStmt = $pdo->prepare("SELECT COUNT(*) as cnt FROM order_cancellations WHERE cancellation_type_id = ?");
        $usageStmt->execute([$id]);
        $usage = (int) $usageStmt->fetch(PDO::FETCH_ASSOC)['cnt'];

        if ($usage > 0) {
            // Soft delete
            $stmt = $pdo->prepare("UPDATE cancellation_types SET is_active = 0 WHERE id = ?");
            $stmt->execute([$id]);
            echo json_encode(['status' => 'success', 'message' => "Deactivated (used by $usage orders)"]);
        } else {
            // Hard delete
            $stmt = $pdo->prepare("DELETE FROM cancellation_types WHERE id = ?");
            $stmt->execute([$id]);
            echo json_encode(['status' => 'success', 'message' => 'Deleted successfully']);
        }
        exit();
    }

    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Method not allowed']);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>
