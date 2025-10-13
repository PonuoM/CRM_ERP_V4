<?php
// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

// Load environment variables
$envFile = __DIR__ . '/../../.env';
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
    error_log("Database connection successful for onecall_batch.php with user: $username");
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
error_log("Received data in onecall_batch.php: " . $json);

// Validate input
if (!isset($data->startdate) || !isset($data->enddate) || !isset($data->amount_record)) {
    error_log("Missing required fields in onecall_batch.php");
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing required fields']);
    exit;
}

try {
    // Check for exact matching batches and don't create duplicates
    error_log("Checking for exact matching batches with startdate: {$data->startdate}, enddate: {$data->enddate}");
    $stmt = $pdo->prepare("SELECT id FROM Onecall_batch WHERE startdate = ? AND enddate = ?");
    $stmt->execute([$data->startdate, $data->enddate]);
    $existingBatch = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($existingBatch) {
        error_log("Batch with the same date range already exists with ID: {$existingBatch['id']}");
        echo json_encode(['success' => true, 'id' => $existingBatch['id'], 'existing' => true]);
        exit;
    }
    
    // Insert batch record
    $stmt = $pdo->prepare("INSERT INTO Onecall_batch (startdate, enddate, amount_record) VALUES (?, ?, ?)");
    $stmt->execute([$data->startdate, $data->enddate, $data->amount_record]);
    
    // Get the ID of the inserted record
    $batchId = $pdo->lastInsertId();
    
    // Log successful batch creation
    error_log("Batch created successfully with ID: $batchId");
    
    // Return success response with the batch ID
    http_response_code(201);
    echo json_encode(['success' => true, 'id' => $batchId, 'existing' => false]);
} catch (PDOException $e) {
    error_log("Failed to save batch: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to save batch: ' . $e->getMessage()]);
}
?>