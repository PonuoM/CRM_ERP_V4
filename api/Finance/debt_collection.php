<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config.php';

function json_response($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $pdo = get_pdo();
    $method = $_SERVER['REQUEST_METHOD'];
    $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    
    // Extract ID from path if present (e.g., /debt_collection/123)
    $pathParts = explode('/', trim($path, '/'));
    $id = null;
    if (count($pathParts) > 2 && is_numeric($pathParts[2])) {
        $id = (int)$pathParts[2];
    }

    switch ($method) {
        case 'GET':
            handleGet($pdo, $id);
            break;
        case 'POST':
            handlePost($pdo);
            break;
        case 'PUT':
            handlePut($pdo, $id);
            break;
        case 'DELETE':
            handleDelete($pdo, $id);
            break;
        default:
            json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
    }
} catch (Exception $e) {
    error_log("Debt Collection API Error: " . $e->getMessage());
    json_response(['ok' => false, 'error' => $e->getMessage()], 500);
}

/**
 * GET - Retrieve debt collection records
 * Query params:
 * - order_id: Filter by order ID
 * - user_id: Filter by user ID
 * - is_complete: Filter by completion status (0 or 1)
 */
function handleGet($pdo, $id) {
    if ($id) {
        // Get single record by ID
        $stmt = $pdo->prepare("
            SELECT dc.*, 
                   u.first_name, u.last_name,
                   os.url as slip_url
            FROM debt_collection dc
            LEFT JOIN users u ON dc.user_id = u.id
            LEFT JOIN order_slips os ON dc.slip_id = os.id
            WHERE dc.id = ?
        ");
        $stmt->execute([$id]);
        $record = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$record) {
            json_response(['ok' => false, 'error' => 'Record not found'], 404);
        }
        
        json_response(['ok' => true, 'data' => $record]);
    }
    
    // Get multiple records with filters
    $orderId = $_GET['order_id'] ?? null;
    $userId = $_GET['user_id'] ?? null;
    $isComplete = isset($_GET['is_complete']) ? (int)$_GET['is_complete'] : null;
    
    $sql = "
        SELECT dc.*, 
               u.first_name, u.last_name,
               os.url as slip_url
        FROM debt_collection dc
        LEFT JOIN users u ON dc.user_id = u.id
        LEFT JOIN order_slips os ON dc.slip_id = os.id
        WHERE 1=1
    ";
    $params = [];
    
    if ($orderId) {
        $sql .= " AND dc.order_id = ?";
        $params[] = $orderId;
    }
    
    if ($userId) {
        $sql .= " AND dc.user_id = ?";
        $params[] = $userId;
    }
    
    if ($isComplete !== null) {
        $sql .= " AND dc.is_complete = ?";
        $params[] = $isComplete;
    }
    
    $sql .= " ORDER BY dc.created_at DESC";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $records = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    json_response(['ok' => true, 'data' => $records]);
}

/**
 * POST - Create new debt collection record
 * Required fields: order_id, user_id, result_status
 * Optional fields: amount_collected, is_complete, note, slip_id
 */
function handlePost($pdo) {
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Validate required fields
    if (empty($input['order_id'])) {
        json_response(['ok' => false, 'error' => 'order_id is required'], 400);
    }
    if (empty($input['user_id'])) {
        json_response(['ok' => false, 'error' => 'user_id is required'], 400);
    }
    if (!isset($input['result_status']) || !in_array($input['result_status'], [1, 2, 3])) {
        json_response(['ok' => false, 'error' => 'result_status must be 1, 2, or 3'], 400);
    }
    
    $orderId = $input['order_id'];
    $userId = (int)$input['user_id'];
    $amountCollected = isset($input['amount_collected']) ? (float)$input['amount_collected'] : 0.00;
    $resultStatus = (int)$input['result_status'];
    $isComplete = isset($input['is_complete']) ? (int)$input['is_complete'] : 0;
    $note = $input['note'] ?? null;
    $slipId = isset($input['slip_id']) ? (int)$input['slip_id'] : null;
    
    // Validate amount_collected based on result_status
    if ($resultStatus === 1 && $amountCollected > 0) {
        json_response(['ok' => false, 'error' => 'amount_collected must be 0 when result_status is 1 (Unable to Collect)'], 400);
    }
    if (($resultStatus === 2 || $resultStatus === 3) && $amountCollected <= 0) {
        json_response(['ok' => false, 'error' => 'amount_collected must be greater than 0 when result_status is 2 or 3'], 400);
    }
    
    $stmt = $pdo->prepare("
        INSERT INTO debt_collection 
        (order_id, user_id, amount_collected, result_status, is_complete, note, slip_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");
    
    $stmt->execute([
        $orderId,
        $userId,
        $amountCollected,
        $resultStatus,
        $isComplete,
        $note,
        $slipId
    ]);
    
    $newId = $pdo->lastInsertId();
    
    // Fetch the created record
    $stmt = $pdo->prepare("
        SELECT dc.*, 
               u.first_name, u.last_name,
               os.url as slip_url
        FROM debt_collection dc
        LEFT JOIN users u ON dc.user_id = u.id
        LEFT JOIN order_slips os ON dc.slip_id = os.id
        WHERE dc.id = ?
    ");
    $stmt->execute([$newId]);
    $record = $stmt->fetch(PDO::FETCH_ASSOC);
    
    json_response(['ok' => true, 'data' => $record, 'id' => $newId], 201);
}

/**
 * PUT - Update debt collection record
 * Can update: amount_collected, result_status, is_complete, note, slip_id
 */
function handlePut($pdo, $id) {
    if (!$id) {
        json_response(['ok' => false, 'error' => 'ID is required'], 400);
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    // Check if record exists
    $stmt = $pdo->prepare("SELECT id FROM debt_collection WHERE id = ?");
    $stmt->execute([$id]);
    if (!$stmt->fetch()) {
        json_response(['ok' => false, 'error' => 'Record not found'], 404);
    }
    
    $updates = [];
    $params = [];
    
    if (isset($input['amount_collected'])) {
        $updates[] = "amount_collected = ?";
        $params[] = (float)$input['amount_collected'];
    }
    
    if (isset($input['result_status'])) {
        if (!in_array($input['result_status'], [1, 2, 3])) {
            json_response(['ok' => false, 'error' => 'result_status must be 1, 2, or 3'], 400);
        }
        $updates[] = "result_status = ?";
        $params[] = (int)$input['result_status'];
    }
    
    if (isset($input['is_complete'])) {
        $updates[] = "is_complete = ?";
        $params[] = (int)$input['is_complete'];
    }
    
    if (isset($input['note'])) {
        $updates[] = "note = ?";
        $params[] = $input['note'];
    }
    
    if (isset($input['slip_id'])) {
        $updates[] = "slip_id = ?";
        $params[] = $input['slip_id'] ? (int)$input['slip_id'] : null;
    }
    
    if (empty($updates)) {
        json_response(['ok' => false, 'error' => 'No fields to update'], 400);
    }
    
    $params[] = $id;
    $sql = "UPDATE debt_collection SET " . implode(', ', $updates) . " WHERE id = ?";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    
    // Fetch updated record
    $stmt = $pdo->prepare("
        SELECT dc.*, 
               u.first_name, u.last_name,
               os.url as slip_url
        FROM debt_collection dc
        LEFT JOIN users u ON dc.user_id = u.id
        LEFT JOIN order_slips os ON dc.slip_id = os.id
        WHERE dc.id = ?
    ");
    $stmt->execute([$id]);
    $record = $stmt->fetch(PDO::FETCH_ASSOC);
    
    json_response(['ok' => true, 'data' => $record]);
}

/**
 * DELETE - Delete debt collection record
 * Note: This should rarely be used as records are meant to be logs
 */
function handleDelete($pdo, $id) {
    if (!$id) {
        json_response(['ok' => false, 'error' => 'ID is required'], 400);
    }
    
    $stmt = $pdo->prepare("DELETE FROM debt_collection WHERE id = ?");
    $stmt->execute([$id]);
    
    if ($stmt->rowCount() === 0) {
        json_response(['ok' => false, 'error' => 'Record not found'], 404);
    }
    
    json_response(['ok' => true, 'message' => 'Record deleted']);
}
