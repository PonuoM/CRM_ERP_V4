<?php
require_once '../config.php';

// Use the same pattern as other API files in the project
cors();

try {
    $pdo = db_connect();
} catch (Throwable $e) {
    json_response(['ok' => false, 'error' => 'DB_CONNECT_FAILED', 'message' => $e->getMessage()], 500);
}

// Get request method
$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {
        case 'GET':
            // Get all env variables or a specific one
            if (isset($_GET['key'])) {
                $key = $_GET['key'];
                $stmt = $pdo->prepare("SELECT * FROM env WHERE `key` = :key");
                $stmt->bindParam(':key', $key);
                $stmt->execute();
                $result = $stmt->fetch(PDO::FETCH_ASSOC);
                json_response($result ?: ['error' => 'Environment variable not found']);
            } else {
                $stmt = $pdo->prepare("SELECT * FROM env ORDER BY `key`");
                $stmt->execute();
                $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
                json_response($results);
            }
            break;
            
        case 'POST':
            // Create or update env variable
            $in = json_input();
            
            if (!isset($in['key']) || !isset($in['value'])) {
                json_response(['error' => 'Key and value are required'], 400);
            }
            
            $key = $in['key'];
            $value = $in['value'];
            
            // Check if key already exists
            $stmt = $pdo->prepare("SELECT id FROM env WHERE `key` = :key");
            $stmt->bindParam(':key', $key);
            $stmt->execute();
            
            if ($stmt->fetch()) {
                // Update existing
                $stmt = $pdo->prepare("UPDATE env SET `value` = :value, updated_at = CURRENT_TIMESTAMP WHERE `key` = :key");
                $stmt->bindParam(':key', $key);
                $stmt->bindParam(':value', $value);
                $stmt->execute();
                json_response(['success' => true, 'message' => 'Environment variable updated']);
            } else {
                // Insert new
                $stmt = $pdo->prepare("INSERT INTO env (`key`, `value`, created_at, updated_at) VALUES (:key, :value, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)");
                $stmt->bindParam(':key', $key);
                $stmt->bindParam(':value', $value);
                $stmt->execute();
                json_response(['success' => true, 'message' => 'Environment variable created']);
            }
            break;
            
        case 'PUT':
            // Update env variable
            $in = json_input();
            
            if (!isset($in['key']) || !isset($in['value'])) {
                json_response(['error' => 'Key and value are required'], 400);
            }
            
            $key = $in['key'];
            $value = $in['value'];
            
            $stmt = $pdo->prepare("UPDATE env SET `value` = :value, updated_at = CURRENT_TIMESTAMP WHERE `key` = :key");
            $stmt->bindParam(':key', $key);
            $stmt->bindParam(':value', $value);
            $stmt->execute();
            
            if ($stmt->rowCount() > 0) {
                json_response(['success' => true, 'message' => 'Environment variable updated']);
            } else {
                json_response(['error' => 'Environment variable not found'], 404);
            }
            break;
            
        case 'DELETE':
            // Delete env variable
            if (!isset($_GET['key'])) {
                json_response(['error' => 'Key is required'], 400);
            }
            
            $key = $_GET['key'];
            $stmt = $pdo->prepare("DELETE FROM env WHERE `key` = :key");
            $stmt->bindParam(':key', $key);
            $stmt->execute();
            
            if ($stmt->rowCount() > 0) {
                json_response(['success' => true, 'message' => 'Environment variable deleted']);
            } else {
                json_response(['error' => 'Environment variable not found'], 404);
            }
            break;
            
        default:
            json_response(['error' => 'Method not allowed'], 405);
            break;
    }
} catch (PDOException $e) {
    json_response(['error' => 'Database error: ' . $e->getMessage()], 500);
}
?>