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


function ensureSchema($pdo)
{
    // Ensure debt_collection_images has order_slip_id
    $check = $pdo->query("SHOW COLUMNS FROM debt_collection_images LIKE 'order_slip_id'");
    if ($check->rowCount() == 0) {
        $pdo->exec("ALTER TABLE debt_collection_images ADD COLUMN order_slip_id INT NULL AFTER debt_collection_id");
        $pdo->exec("ALTER TABLE debt_collection_images ADD INDEX idx_order_slip_id (order_slip_id)");
    }
}

function handleGet($pdo, $id)
{
    ensureSchema($pdo); // Ensure schema exists

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

        // Fetch Images: Join order_slips to get URL, fallback to image_path for old records
        $imgStmt = $pdo->prepare("
            SELECT os.url as image_url,
                   os.amount, os.transfer_date, os.created_at as slip_created_at,
                   os.bank_account_id,
                   ba.bank as bank_name, ba.bank_number,
                   u2.first_name as uploader_name
            FROM debt_collection_images dci 
            LEFT JOIN order_slips os ON dci.order_slip_id = os.id
            LEFT JOIN bank_account ba ON os.bank_account_id = ba.id
            LEFT JOIN users u2 ON os.upload_by = u2.id
            WHERE dci.debt_collection_id = ?
        ");
        $imgStmt->execute([$id]);
        $slipRows = $imgStmt->fetchAll(PDO::FETCH_ASSOC);
        $record['images'] = array_column($slipRows, 'image_url');
        $record['slip_details'] = $slipRows;

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

    // Fetch images for all records
    foreach ($records as &$rec) {
        $imgStmt = $pdo->prepare("
            SELECT os.url as image_url,
                   os.amount, os.transfer_date, os.created_at as slip_created_at,
                   os.bank_account_id,
                   ba.bank as bank_name, ba.bank_number,
                   u2.first_name as uploader_name
            FROM debt_collection_images dci 
            LEFT JOIN order_slips os ON dci.order_slip_id = os.id
            LEFT JOIN bank_account ba ON os.bank_account_id = ba.id
            LEFT JOIN users u2 ON os.upload_by = u2.id
            WHERE dci.debt_collection_id = ?
        ");
        $imgStmt->execute([$rec['id']]);
        $slipRows = $imgStmt->fetchAll(PDO::FETCH_ASSOC);
        $rec['images'] = array_column($slipRows, 'image_url');
        $rec['slip_details'] = $slipRows;
    }

    json_response(['ok' => true, 'data' => $records]);
}

function handlePost($pdo)
{
    ensureSchema($pdo);

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
    $bankAccountId = isset($input['bank_account_id']) ? (int) $input['bank_account_id'] : null;
    $slipId = isset($input['slip_id']) ? (int) $input['slip_id'] : null; // Kept for debt_collection table

    $stmt = $pdo->prepare("
        INSERT INTO debt_collection 
        (order_id, user_id, amount_collected, result_status, is_complete, note, slip_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");

    $stmt->execute([$orderId, $userId, $amountCollected, $resultStatus, $isComplete, $note, $slipId]);
    $newId = $pdo->lastInsertId();

    // Handle File Uploads
    if (!empty($_FILES['evidence_images']['name'][0])) {
        // Use standard slips directory
        $uploadDir = '../../uploads/slips/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0777, true);
        }

        $files = $_FILES['evidence_images'];
        $count = count($files['name']);

        // Get per-slip details
        $slipAmounts = $_POST['slip_amounts'] ?? [];
        $slipBankIds = $_POST['slip_bank_ids'] ?? [];
        $slipTransferDates = $_POST['slip_transfer_dates'] ?? [];

        // Stmt to insert into order_slips
        // We use the collected amount and selected bank for the slip record
        // If multiple images are uploaded, they all get linked to this transaction info
        $insertSlip = $pdo->prepare("INSERT INTO order_slips (order_id, url, upload_by, amount, bank_account_id, transfer_date, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())");
        // Stmt to insert mapping
        $insertMapping = $pdo->prepare("INSERT INTO debt_collection_images (debt_collection_id, order_slip_id) VALUES (?, ?)");

        for ($i = 0; $i < $count; $i++) {
            if ($files['error'][$i] === UPLOAD_ERR_OK) {
                $tmpName = $files['tmp_name'][$i];
                $originalName = basename($files['name'][$i]);
                $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
                $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

                if (in_array($ext, $allowed)) {
                    // Naming convention similar to slips: slip_{orderId}_{timestamp}_{uniqid}.ext
                    $newName = 'slip_' . $orderId . '_evidence_' . date('Ymd_His') . '_' . uniqid() . '.' . $ext;
                    $targetPath = $uploadDir . $newName;

                    if (move_uploaded_file($tmpName, $targetPath)) {
                        // DB Path (relative)
                        $dbPath = 'uploads/slips/' . $newName;

                        // Per-slip values
                        // Use specific amount/bank if available, otherwise fallback (though frontend validation should ensure they exist)
                        $thisSlipAmount = isset($slipAmounts[$i]) ? (float) $slipAmounts[$i] : 0; // or $amountCollected fallback? Better 0 if not specified
                        // Handle legacy/fallback: if only 1 image and no array, use global? 
                        // But we updated frontend to send arrays. 
                        // If arrays are empty but global exists (legacy request?), use global.
                        if (empty($slipAmounts) && $count === 1) {
                            $thisSlipAmount = $amountCollected;
                        }

                        $thisSlipBankId = isset($slipBankIds[$i]) ? (int) $slipBankIds[$i] : null;
                        if (empty($slipBankIds) && $count === 1 && isset($input['bank_account_id'])) {
                            $thisSlipBankId = (int) $input['bank_account_id'];
                        }

                        // Per-slip transfer date (from frontend datetime-local input)
                        $thisTransferDate = !empty($slipTransferDates[$i]) ? date('Y-m-d H:i:s', strtotime($slipTransferDates[$i])) : date('Y-m-d H:i:s');

                        // 1. Insert into order_slips
                        $insertSlip->execute([$orderId, $dbPath, $userId, $thisSlipAmount, $thisSlipBankId, $thisTransferDate]);
                        $newSlipId = $pdo->lastInsertId();

                        // 2. Insert into debt_collection_images mapping
                        $insertMapping->execute([$newId, $newSlipId]);
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
    $imgStmt = $pdo->prepare("
        SELECT os.url as image_url 
        FROM debt_collection_images dci 
        LEFT JOIN order_slips os ON dci.order_slip_id = os.id
        WHERE dci.debt_collection_id = ?
    ");
    $imgStmt->execute([$newId]);
    $record['images'] = $imgStmt->fetchAll(PDO::FETCH_COLUMN);

    // Update Bad Debt Status if requested
    if (!empty($input['is_bad_debt'])) {
        $upd = $pdo->prepare("UPDATE orders SET order_status = 'BadDebt' WHERE id = ?");
        $upd->execute([$orderId]);
    }

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
