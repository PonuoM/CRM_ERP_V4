<?php
require_once __DIR__ . '/../config.php';

cors();
$pdo = db_connect();
validate_auth($pdo);

$user = get_authenticated_user($pdo);
$companyId = $user['company_id'];
$isSuperAdmin = ($user['role'] === 'SuperAdmin');

$method = $_SERVER['REQUEST_METHOD'];

// Helper to determine target company ID
function getTargetCompanyId($user, $inputCompanyId = null) {
    if ($user['role'] === 'SuperAdmin' && $inputCompanyId) {
        return (int)$inputCompanyId;
    }
    return $user['company_id'];
}

switch ($method) {
    case 'GET':
        // List rules
        // Optional filter by tab_key
        $tabKey = $_GET['tab_key'] ?? null;
        
        $sql = "SELECT * FROM order_tab_rules WHERE company_id = ? OR company_id = 0"; // Include global rules (0) + company specific
        $params = [$companyId];

        if ($tabKey) {
            $sql .= " AND tab_key = ?";
            $params[] = $tabKey;
        }

        $sql .= " ORDER BY tab_key, display_order, id";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rules = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        json_response(['ok' => true, 'rules' => $rules]);
        break;

    case 'POST':
        // Create rule
        $input = json_decode(file_get_contents('php://input'), true);
        
        $tabKey = $input['tab_key'] ?? null;
        if (!$tabKey) json_response(['ok' => false, 'error' => 'tab_key is required'], 400);
        
        $paymentMethod = $input['payment_method'] ?? null;
        $paymentStatus = $input['payment_status'] ?? null;
        $orderStatus = $input['order_status'] ?? null;
        $description = $input['description'] ?? null;
        $displayOrder = (int)($input['display_order'] ?? 0);
        
        // Scope to current company unless SuperAdmin specifies otherwise
        $targetCompanyId = getTargetCompanyId($user, $input['company_id'] ?? null);

        $stmt = $pdo->prepare("INSERT INTO order_tab_rules (tab_key, payment_method, payment_status, order_status, description, company_id, display_order) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$tabKey, $paymentMethod, $paymentStatus, $orderStatus, $description, $targetCompanyId, $displayOrder]);
        
        json_response(['ok' => true, 'id' => $pdo->lastInsertId()]);
        break;

    case 'PUT':
        // Update rule
        $input = json_decode(file_get_contents('php://input'), true);
        $id = $input['id'] ?? null;
        
        if (!$id) json_response(['ok' => false, 'error' => 'id is required'], 400);

        // Verify ownership/permission
        $check = $pdo->prepare("SELECT company_id FROM order_tab_rules WHERE id = ?");
        $check->execute([$id]);
        $rule = $check->fetch();
        
        if (!$rule) json_response(['ok' => false, 'error' => 'Rule not found'], 404);
        if (!$isSuperAdmin && $rule['company_id'] != $companyId && $rule['company_id'] != 0) {
             if ($rule['company_id'] == 0) json_response(['ok' => false, 'error' => 'Cannot edit system rules'], 403);
             json_response(['ok' => false, 'error' => 'Unauthorized'], 403);
        }

        $updates = [];
        $params = [];
        
        if (array_key_exists('payment_method', $input)) { $updates[] = 'payment_method = ?'; $params[] = $input['payment_method']; }
        if (array_key_exists('payment_status', $input)) { $updates[] = 'payment_status = ?'; $params[] = $input['payment_status']; }
        if (array_key_exists('order_status', $input)) { $updates[] = 'order_status = ?'; $params[] = $input['order_status']; }
        if (array_key_exists('description', $input)) { $updates[] = 'description = ?'; $params[] = $input['description']; }
        if (array_key_exists('display_order', $input)) { $updates[] = 'display_order = ?'; $params[] = $input['display_order']; }
        if (array_key_exists('is_active', $input)) { $updates[] = 'is_active = ?'; $params[] = $input['is_active']; }
        
        if (empty($updates)) json_response(['ok' => true, 'message' => 'No changes']);

        $sql = "UPDATE order_tab_rules SET " . implode(', ', $updates) . " WHERE id = ?";
        $params[] = $id;
        
        $pdo->prepare($sql)->execute($params);
        json_response(['ok' => true]);
        break;

    case 'DELETE':
        $id = $_GET['id'] ?? null;
        if (!$id) json_response(['ok' => false, 'error' => 'id is required'], 400);

        $check = $pdo->prepare("SELECT company_id FROM order_tab_rules WHERE id = ?");
        $check->execute([$id]);
        $rule = $check->fetch();

        if (!$rule) json_response(['ok' => false, 'error' => 'Rule not found'], 404);
        if (!$isSuperAdmin && $rule['company_id'] != $companyId) {
             if ($rule['company_id'] == 0) json_response(['ok' => false, 'error' => 'Cannot delete system rules'], 403);
             json_response(['ok' => false, 'error' => 'Unauthorized'], 403);
        }

        $pdo->prepare("DELETE FROM order_tab_rules WHERE id = ?")->execute([$id]);
        json_response(['ok' => true]);
        break;
}
