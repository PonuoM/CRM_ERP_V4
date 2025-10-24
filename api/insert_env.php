<?php
require_once 'config.php';

// Enable CORS
cors();

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method not allowed'], 405);
}

try {
    // Get JSON input
    $input = json_input();

    // Validate required fields
    if (!isset($input['key']) || !isset($input['value'])) {
        json_response(['error' => 'Missing required fields: key and value'], 400);
    }

    $key = trim($input['key']);
    $value = trim($input['value']);

    if (empty($key) || empty($value)) {
        json_response(['error' => 'Key and value cannot be empty'], 400);
    }

    // Connect to database
    $pdo = db_connect();

    // Check if key already exists
    $stmt = $pdo->prepare("SELECT id FROM env WHERE `key` = ?");
    $stmt->execute([$key]);
    $existing = $stmt->fetch();

    $current_time = date('Y-m-d H:i:s');

    if ($existing) {
        // Update existing record
        $stmt = $pdo->prepare("UPDATE env SET `value` = ?, created_at = ? WHERE `key` = ?");
        $stmt->execute([$value, $current_time, $key]);

        json_response([
            'success' => true,
            'message' => 'Environment variable updated successfully',
            'action' => 'update',
            'key' => $key,
            'updated_at' => $current_time
        ]);
    } else {
        // Insert new record
        $stmt = $pdo->prepare("INSERT INTO env (`id`, `key`, `value`, `created_at`) VALUES (NULL, ?, ?, ?)");
        $stmt->execute([$key, $value, $current_time]);

        $inserted_id = $pdo->lastInsertId();

        json_response([
            'success' => true,
            'message' => 'Environment variable inserted successfully',
            'action' => 'insert',
            'id' => $inserted_id,
            'key' => $key,
            'created_at' => $current_time
        ]);
    }

} catch (Exception $e) {
    error_log('Error in insert_env.php: ' . $e->getMessage());
    json_response([
        'error' => 'Database operation failed',
        'details' => $e->getMessage()
    ], 500);
}
