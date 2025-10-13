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
    error_log("Database connection successful for get_dashboard_stats.php with user: $username");
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
    // Get month and year from query parameters
    $month = isset($_GET['month']) ? intval($_GET['month']) : intval(date('m'));
    $year = isset($_GET['year']) ? intval($_GET['year']) : intval(date('Y'));
    
    // Calculate total calls
    $stmt = $pdo->prepare("SELECT COUNT(*) as total_calls FROM Onecall_Log WHERE MONTH(timestamp) = ? AND YEAR(timestamp) = ?");
    $stmt->execute([$month, $year]);
    $totalCalls = $stmt->fetch(PDO::FETCH_ASSOC)['total_calls'];
    
    // Calculate total duration in seconds and convert to minutes directly in SQL
    $stmt = $pdo->prepare("SELECT SUM(duration) / 60 as total_duration_minutes FROM Onecall_Log WHERE MONTH(timestamp) = ? AND YEAR(timestamp) = ?");
    $stmt->execute([$month, $year]);
    $totalMinutes = floor($stmt->fetch(PDO::FETCH_ASSOC)['total_duration_minutes'] ?: 0);
    
    // Calculate business days (excluding weekends)
    $businessDays = 0;
    $currentDay = intval(date('d'));
    $currentMonth = intval(date('m'));
    $currentYear = intval(date('Y'));
    
    // If we're in the same month, count only days up to today
    $daysInMonth = ($month == $currentMonth && $year == $currentYear) ? $currentDay : cal_days_in_month(CAL_GREGORIAN, $month, $year);
    
    for ($day = 1; $day <= $daysInMonth; $day++) {
        $dayOfWeek = date('N', mktime(0, 0, 0, $month, $day, $year));
        // 6 = Saturday, 7 = Sunday
        if ($dayOfWeek < 6) {
            $businessDays++;
        }
    }
    
    // Calculate average minutes per business day
    $avgMinutesPerDay = $businessDays > 0 ? round($totalMinutes / $businessDays, 2) : 0;
    
    // Return success response with stats
    echo json_encode([
        'success' => true, 
        'data' => [
            'totalCalls' => $totalCalls,
            'answeredCalls' => 0, // Always 0 as requested
            'totalMinutes' => $totalMinutes,
            'avgMinutes' => $avgMinutesPerDay,
            'businessDays' => $businessDays
        ]
    ]);
} catch (PDOException $e) {
    error_log("Failed to retrieve dashboard stats: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to retrieve dashboard stats: ' . $e->getMessage()]);
}
?>