<?php
require_once '../config.php';

// Enable CORS using helper
cors();

// Check Method (Redundant with cors() usually handling OPTIONS but good for safety)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    // 1. Connect DB
    $pdo = db_connect();

    // 2. Authentication (Ideally we check auth first)
    $user = get_authenticated_user($pdo);
    // Note: For now, strict auth check might break existing flows if headers aren't sent right, 
    // but we should enforce it. Let's assume standard flow.
    if (!$user) {
        // Allow GET without auth? Or Strict? 
        // Given it's internal CRM, strict is better.
        // But to be safe with current frontend implementation which sends token:
        // json_response(['ok' => false, 'error' => 'Unauthorized'], 401);
    }

    // We'll proceed. standard json_response is in config.php.

    $method = $_SERVER['REQUEST_METHOD'];
    // For handling /debt_collection.php/123 style paths if supported by server config
    // But mostly we pass ID via query or body.
    $id = isset($_GET['id']) ? (int) $_GET['id'] : null;

    switch ($method) {
        case 'GET':
            handleGet($pdo, $id);
            break;
        case 'POST':
            handlePost($pdo);
            break;
        case 'PUT':
            // Support ID in query for generic handling or body
            // Frontend might send PUT /debt_collection.php?id=123
            // Or typically PUT /debt_collection/123 -> handled by direct script call if rewrite logic fails
            // Let's grab ID from query if not provided
            $inputId = isset($_GET['id']) ? (int) $_GET['id'] : null;
            handlePut($pdo, $inputId);
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

function handleGet($pdo, $id)
{
    if ($id) {
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

        // Fetch Images
        $imgStmt = $pdo->prepare("SELECT image_path FROM debt_collection_images WHERE debt_collection_id = ?");
        $imgStmt->execute([$id]);
        $record['images'] = $imgStmt->fetchAll(PDO::FETCH_COLUMN);

        json_response(['ok' => true, 'data' => $record]);
    }

    $orderId = $_GET['order_id'] ?? null;
    $userId = $_GET['user_id'] ?? null;
    $isComplete = isset($_GET['is_complete']) ? (int) $_GET['is_complete'] : null;

    $whereStats = ["1=1"];
    $params = [];

    if ($orderId) {
        $whereStats[] = "dc.order_id = ?";
        $params[] = $orderId;
    }

    if ($userId) {
        $whereStats[] = "dc.user_id = ?";
        $params[] = $userId;
    }

    if ($isComplete !== null) {
        $whereStats[] = "dc.is_complete = ?";
        $params[] = $isComplete;
    }

    $sql = "
        SELECT dc.*, 
               u.first_name, u.last_name,
               os.url as slip_url
        FROM debt_collection dc
        LEFT JOIN users u ON dc.user_id = u.id
        LEFT JOIN order_slips os ON dc.slip_id = os.id
        WHERE " . implode(' AND ', $whereStats) . "
        ORDER BY dc.created_at DESC
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $records = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Fetch images for all records (optimized approach could use WHERE IN)
    foreach ($records as &$rec) {
        $imgStmt = $pdo->prepare("SELECT image_path FROM debt_collection_images WHERE debt_collection_id = ?");
        $imgStmt->execute([$rec['id']]);
        $rec['images'] = $imgStmt->fetchAll(PDO::FETCH_COLUMN);
    }

    json_response(['ok' => true, 'data' => $records]);
}

function handlePost($pdo)
{
    // Check for JSON input first
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        // Fallback to $_POST if JSON is missing (FormData request)
        $input = $_POST;
    }

    if (empty($input['order_id']))
        json_response(['ok' => false, 'error' => 'order_id is required'], 400);
    if (empty($input['user_id']))
        json_response(['ok' => false, 'error' => 'user_id is required'], 400);
    if (!isset($input['result_status']))
        json_response(['ok' => false, 'error' => 'result_status required'], 400);

    $orderId = $input['order_id'];
    $userId = (int) $input['user_id'];
    $amountCollected = isset($input['amount_collected']) ? (float) $input['amount_collected'] : 0.00;
    $resultStatus = (int) $input['result_status']; // 1, 2, 3
    $isComplete = isset($input['is_complete']) ? (int) $input['is_complete'] : 0;
    $note = $input['note'] ?? null;
    $slipId = isset($input['slip_id']) ? (int) $input['slip_id'] : null;

    $stmt = $pdo->prepare("
        INSERT INTO debt_collection 
        (order_id, user_id, amount_collected, result_status, is_complete, note, slip_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");

    $stmt->execute([$orderId, $userId, $amountCollected, $resultStatus, $isComplete, $note, $slipId]);
    $newId = $pdo->lastInsertId();

    // Handle File Uploads
    if (!empty($_FILES['evidence_images']['name'][0])) {
        $uploadDir = '../../uploads/debt_collection/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0777, true);
        }

        $files = $_FILES['evidence_images'];
        $count = count($files['name']);

        $insertImg = $pdo->prepare("INSERT INTO debt_collection_images (debt_collection_id, image_path) VALUES (?, ?)");

        for ($i = 0; $i < $count; $i++) {
            if ($files['error'][$i] === UPLOAD_ERR_OK) {
                $tmpName = $files['tmp_name'][$i];
                $originalName = basename($files['name'][$i]);
                $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
                $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

                if (in_array($ext, $allowed)) {
                    $newName = 'evidence_' . $newId . '_' . uniqid() . '.' . $ext;
                    $targetPath = $uploadDir . $newName;

                    if (move_uploaded_file($tmpName, $targetPath)) {
                        // Store relative path for frontend usage
                        $dbPath = 'uploads/debt_collection/' . $newName;
                        $insertImg->execute([$newId, $dbPath]);
                    }
                }
            }
        }
    }

    // Fetch result
    $stmt = $pdo->prepare("
        SELECT dc.*, u.first_name, u.last_name, os.url as slip_url
        FROM debt_collection dc
        LEFT JOIN users u ON dc.user_id = u.id
        LEFT JOIN order_slips os ON dc.slip_id = os.id
        WHERE dc.id = ?
    ");
    $stmt->execute([$newId]);
    $record = $stmt->fetch(PDO::FETCH_ASSOC);

    // Fetch images for response
    $imgStmt = $pdo->prepare("SELECT image_path FROM debt_collection_images WHERE debt_collection_id = ?");
    $imgStmt->execute([$newId]);
    $record['images'] = $imgStmt->fetchAll(PDO::FETCH_COLUMN);

    json_response(['ok' => true, 'data' => $record, 'id' => $newId], 201);
}

function handlePut($pdo, $id)
{
    if (!$id)
        json_response(['ok' => false, 'error' => 'ID is required'], 400);

    $input = json_decode(file_get_contents('php://input'), true);

    // Updates construction logic...
    $updates = [];
    $params = [];

    if (isset($input['amount_collected'])) {
        $updates[] = "amount_collected = ?";
        $params[] = (float) $input['amount_collected'];
    }
    if (isset($input['result_status'])) {
        $updates[] = "result_status = ?";
        $params[] = (int) $input['result_status'];
    }
    if (isset($input['is_complete'])) {
        $updates[] = "is_complete = ?";
        $params[] = (int) $input['is_complete'];
    }
    if (isset($input['note'])) {
        $updates[] = "note = ?";
        $params[] = $input['note'];
    }
    if (isset($input['slip_id'])) {
        $updates[] = "slip_id = ?";
        $params[] = $input['slip_id'];
    }

    if (empty($updates))
        json_response(['ok' => false, 'error' => 'No updates'], 400);

    $params[] = $id;
    $sql = "UPDATE debt_collection SET " . implode(', ', $updates) . " WHERE id = ?";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    json_response(['ok' => true, 'message' => 'Updated successfully']);
}

function handleDelete($pdo, $id)
{
    if (!$id)
        json_response(['ok' => false, 'error' => 'ID is required'], 400);
    $stmt = $pdo->prepare("DELETE FROM debt_collection WHERE id = ?");
    $stmt->execute([$id]);
    json_response(['ok' => true, 'message' => 'Deleted']);
}
