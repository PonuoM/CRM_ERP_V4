<?php
// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET");
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
    error_log("Database connection successful for get_users.php with user: $username");
} catch (PDOException $e) {
    error_log("Database connection failed: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection failed: ' . $e->getMessage()]);
    exit;
}

// Only allow GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

try {
    // Query to get users with Telesale and Supervisor Telesale roles
    $stmt = $pdo->prepare("SELECT id, first_name, last_name, role FROM users WHERE role IN ('Telesale', 'Supervisor Telesale')");
    $stmt->execute();
    
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Convert keys from snake_case to camelCase for frontend compatibility
    $formattedUsers = array_map(function($user) {
        return [
            'id' => $user['id'],
            'firstname' => $user['first_name'],
            'lastname' => $user['last_name'],
            'role' => $user['role']
        ];
    }, $users);
    
    // Log successful users retrieval
    error_log("Successfully retrieved " . count($formattedUsers) . " users with Telesale and Supervisor Telesale roles");
    
    // Return success response with users data
    echo json_encode(['success' => true, 'data' => $formattedUsers]);
} catch (PDOException $e) {
    error_log("Failed to retrieve users: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to retrieve users: ' . $e->getMessage()]);
}
?>