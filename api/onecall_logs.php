<?php
// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

// Load environment variables
$envFile = __DIR__ . '/../.env';
if (file_exists($envFile)) {
    $envContent = file_get_contents($envFile);
    $envLines = explode("\n", $envContent);
    
    foreach ($envLines as $line) {
        // Skip comments and empty lines
        if (empty($line) || strpos(trim($line), '#') === 0) {
            continue;
        }
        
        // Parse KEY=VALUE format
        if (strpos($line, '=') !== false) {
            list($key, $value) = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value);
            
            // Remove quotes if present
            if ((substr($value, 0, 1) === '"' && substr($value, -1) === '"') ||
                (substr($value, 0, 1) === "'" && substr($value, -1) === "'")) {
                $value = substr($value, 1, -1);
            }
            
            // Set environment variable
            putenv("$key=$value");
            $_ENV[$key] = $value;
        }
    }
}

// Database connection
$host = 'localhost';
$dbname = 'mini_erp';
$username = getenv('DATABASE_NAME') ?: 'root';
$password = getenv('DATABASE_PASSWORD') ?: '';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Log successful database connection
    error_log("Database connection successful for onecall_logs.php with user: $username");
} catch (PDOException $e) {
    error_log("Database connection failed: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection failed: ' . $e->getMessage()]);
    exit;
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

// Get JSON input
$json = file_get_contents('php://input');
$data = json_decode($json);

// Log incoming data for debugging
error_log("Received data in onecall_logs.php: " . $json);

// Validate input
if (!isset($data->logs) || !isset($data->batch_id) || !is_array($data->logs)) {
    error_log("Missing required fields or invalid logs data in onecall_logs.php");
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing required fields or invalid logs data']);
    exit;
}

try {
    // Begin transaction
    $pdo->beginTransaction();
    
    // Prepare statement for inserting logs
    $stmt = $pdo->prepare("INSERT INTO Onecall_Log (id, timestamp, duration, localParty, remoteParty, direction, phone_telesale, batch_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    
    // Insert each log
    $insertedCount = 0;
    foreach ($data->logs as $log) {
        // Validate required fields for each log
        if (!isset($log->id) || !isset($log->timestamp) || !isset($log->duration) ||
            !isset($log->localParty) || !isset($log->remoteParty) || !isset($log->direction)) {
            throw new Exception('Missing required fields in log data');
        }
        
        $stmt->execute([
            $log->id,
            $log->timestamp,
            $log->duration,
            $log->localParty,
            $log->remoteParty,
            $log->direction,
            isset($log->phone_telesale) ? $log->phone_telesale : '',
            $data->batch_id
        ]);
        
        $insertedCount++;
    }
    
    // Commit transaction
    $pdo->commit();
    
    // Log successful logs insertion
    error_log("Successfully inserted $insertedCount logs for batch ID: " . $data->batch_id);
    
    // Return success response
    http_response_code(201);
    echo json_encode(['success' => true, 'message' => 'Logs saved successfully', 'count' => $insertedCount]);
} catch (Exception $e) {
    // Rollback transaction on error
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    
    error_log("Failed to save logs: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to save logs: ' . $e->getMessage()]);
}
?>