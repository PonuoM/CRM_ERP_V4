<?php
require_once __DIR__ . '/../config.php';

cors();

// Get POST data
$json = file_get_contents('php://input');
$data = json_decode($json, true);

if (!$data) {
    json_response([
        'success' => false,
        'error' => 'Invalid JSON data'
    ], 400);
    exit;
}

// Validate required fields
$required_fields = ['page_id', 'user_id', 'date'];
foreach ($required_fields as $field) {
    if (empty($data[$field])) {
        json_response([
            'success' => false,
            'error' => "Missing required field: {$field}"
        ], 400);
        exit;
    }
}

try {
    $pdo = db_connect();

    // Check if record already exists
    $checkStmt = $pdo->prepare("
        SELECT id FROM marketing_ads_log
        WHERE page_id = ? AND user_id = ? AND date = ?
    ");
    $checkStmt->execute([
        $data['page_id'],
        $data['user_id'],
        $data['date']
    ]);

    if ($checkStmt->fetch()) {
        json_response([
            'success' => false,
            'error' => 'Record already exists for this page, user, and date'
        ], 409);
        exit;
    }

    // Insert new record
    $stmt = $pdo->prepare("
        INSERT INTO marketing_ads_log (
            page_id,
            user_id,
            date,
            ads_cost,
            impressions,
            reach,
            clicks
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ");

    $stmt->execute([
        $data['page_id'],
        $data['user_id'],
        $data['date'],
        !empty($data['ads_cost']) ? $data['ads_cost'] : null,
        !empty($data['impressions']) ? $data['impressions'] : null,
        !empty($data['reach']) ? $data['reach'] : null,
        !empty($data['clicks']) ? $data['clicks'] : null
    ]);

    $insertId = $pdo->lastInsertId();

    json_response([
        'success' => true,
        'message' => 'Ads log created successfully',
        'data' => [
            'id' => $insertId,
            'page_id' => $data['page_id'],
            'user_id' => $data['user_id'],
            'date' => $data['date'],
            'ads_cost' => $data['ads_cost'] ?? null,
            'impressions' => $data['impressions'] ?? null,
            'reach' => $data['reach'] ?? null,
            'clicks' => $data['clicks'] ?? null
        ]
    ]);

} catch (Exception $e) {
    error_log("Error in ads_log_insert.php: " . $e->getMessage());
    json_response([
        'success' => false,
        'error' => $e->getMessage(),
        'message' => 'Failed to create ads log'
    ], 500);
}
