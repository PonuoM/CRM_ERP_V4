<?php
// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET");
header("Access-Control-Allow-Headers: Content-Type");

// Load environment variables from .env at project root
$envFile = __DIR__ . '/../../.env';
if (file_exists($envFile)) {
    $envContent = file_get_contents($envFile);
    $envLines = explode("\n", $envContent);
    foreach ($envLines as $line) {
        if (empty($line) || strpos(trim($line), '#') === 0) continue;
        if (strpos($line, '=') !== false) {
            list($key, $value) = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value);
            if ((substr($value, 0, 1) === '"' && substr($value, -1) === '"') ||
                (substr($value, 0, 1) === "'" && substr($value, -1) === "'")) {
                $value = substr($value, 1, -1);
            }
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
} catch (PDOException $e) {
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
    $year = isset($_GET['year']) ? intval($_GET['year']) : intval(date('Y'));
    $userId = isset($_GET['user_id']) ? intval($_GET['user_id']) : null;

    $params = [':year' => $year];
    $userFirstName = null;

    if (!empty($userId)) {
        // Map user_id to first_name to match onecall_log.phone_telesale
        $uStmt = $pdo->prepare("SELECT first_name FROM users WHERE id = :uid LIMIT 1");
        $uStmt->execute([':uid' => $userId]);
        $row = $uStmt->fetch(PDO::FETCH_ASSOC);
        if ($row && !empty($row['first_name'])) {
            $userFirstName = $row['first_name'];
        } else {
            // If user not found, return empty data for all months
            $empty = [];
            for ($m = 1; $m <= 12; $m++) {
                $empty[] = ['month' => $m, 'count' => 0, 'total_minutes' => 0];
            }
            echo json_encode(['success' => true, 'year' => $year, 'data' => $empty]);
            exit;
        }
    }

    $where = "WHERE YEAR(`timestamp`) = :year";
    if ($userFirstName !== null) {
        $where .= " AND phone_telesale = :firstname";
        $params[':firstname'] = $userFirstName;
    }

    // Aggregate by month
    $sql = "SELECT MONTH(`timestamp`) AS m, COUNT(*) AS cnt, FLOOR(SUM(duration)/60) AS total_min
            FROM onecall_log
            $where
            GROUP BY MONTH(`timestamp`)
            ORDER BY m";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Normalize to 12 months
    $byMonth = [];
    foreach ($rows as $r) {
        $byMonth[intval($r['m'])] = [
            'month' => intval($r['m']),
            'count' => intval($r['cnt']),
            'total_minutes' => intval($r['total_min'] ?? 0)
        ];
    }

    $result = [];
    for ($m = 1; $m <= 12; $m++) {
        if (isset($byMonth[$m])) {
            $result[] = $byMonth[$m];
        } else {
            $result[] = ['month' => $m, 'count' => 0, 'total_minutes' => 0];
        }
    }

    echo json_encode(['success' => true, 'year' => $year, 'data' => $result]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to retrieve monthly calls: ' . $e->getMessage()]);
}
?>

