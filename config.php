<?php
date_default_timezone_set("Asia/Bangkok");
ini_set('memory_limit', '256M');
// Database configuration
// Adjust host/port if your MySQL runs elsewhere
$DB_HOST = getenv("DB_HOST") ?: "localhost";
$DB_PORT = getenv("DB_PORT") ?: "3306";
$DB_NAME = getenv("DB_NAME") ?: "primacom_mini_erp";
$DB_USER = getenv("DB_USER") ?: "primacom_bloguser";
// $DB_PASS = getenv("DB_PASS") ?: "MzBpsVmDmhg8afrxgaUg"; 
$DB_PASS = getenv("DB_PASS") ?: "pJnL53Wkhju2LaGPytw8";



function db_connect(): PDO
{
  global $DB_HOST, $DB_PORT, $DB_NAME, $DB_USER, $DB_PASS;
  $hosts = [$DB_HOST];
  // If connecting over TCP to loopback is refused, try localhost (named pipe/shared memory on Windows)
  if ($DB_HOST === "127.0.0.1") {
    $hosts[] = "localhost";
  }
  if ($DB_HOST === "localhost") {
    $hosts[] = "127.0.0.1";
  }

  $lastError = null;
  foreach ($hosts as $host) {
    $dsn = "mysql:host={$host};port={$DB_PORT};dbname={$DB_NAME};charset=utf8mb4";
    $opts = [
      PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
      PDO::ATTR_EMULATE_PREPARES => false,
      // May be ignored by mysql driver, but harmless
      PDO::ATTR_TIMEOUT => 3,
      // CRITICAL: Force utf8mb4_unicode_ci collation at connection init to prevent MySQL 8 default utf8mb4_0900_ai_ci
      PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci, time_zone = '+07:00', collation_connection = 'utf8mb4_unicode_ci'",
    ];
    try {
      $pdo = new PDO($dsn, $DB_USER, $DB_PASS, $opts);
      return $pdo;
    } catch (Throwable $e) {
      $lastError = $e;
      // If it's a connection refused/2002 error, try next host; otherwise break
      $msg = (string) $e->getMessage();
      if (
        strpos($msg, "2002") === false &&
        stripos($msg, "refused") === false
      ) {
        break;
      }
    }
  }
  if ($lastError) {
    throw new RuntimeException(
      "MySQL connection failed for host " .
        $DB_HOST .
        ":" .
        $DB_PORT .
        " / db " .
        $DB_NAME .
        " - " .
        $lastError->getMessage(),
    );
  }
  throw new RuntimeException("MySQL connection failed (unknown error)");
}

function json_input(): array
{
  $raw = file_get_contents("php://input");
  $data = json_decode($raw, true);
  return is_array($data) ? $data : [];
}

function json_response($data, int $status = 200): void
{
  http_response_code($status);
  header("Content-Type: application/json; charset=utf-8");
  echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit();
}

function cors(): void
{
  header("Access-Control-Allow-Origin: *");
  header(
    "Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );
  header("Access-Control-Allow-Headers: Content-Type, Authorization");
  if (
    isset($_SERVER["REQUEST_METHOD"]) &&
    $_SERVER["REQUEST_METHOD"] === "OPTIONS"
  ) {
    http_response_code(204);
    exit();
  }
}

function validate_auth(PDO $pdo): void
{
  file_put_contents('auth_debug.log', date('Y-m-d H:i:s') . " AUTH CHECK: " . ($_SERVER['REQUEST_URI'] ?? 'unknown') . " Mem: " . memory_get_usage() . "\n", FILE_APPEND);
  $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
  
  if (!$auth && function_exists('getallheaders')) {
      $headers = getallheaders();
      $auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';
  }
  
  // Also check query param (for downloads)
  if (!$auth && isset($_GET['token'])) {
      $auth = 'Bearer ' . $_GET['token'];
  }

  if (!preg_match('/Bearer\s+(\S+)/', $auth, $matches)) {
    file_put_contents('auth_debug.log', date('Y-m-d H:i:s') . " AUTH FAIL: No Bearer token found in header: '$auth'\n", FILE_APPEND);
    json_response(['error' => 'UNAUTHORIZED', 'message' => 'Missing or invalid token'], 401);
  }
  $token = $matches[1];

  $stmt = $pdo->prepare('SELECT user_id, expires_at FROM user_tokens WHERE token = ?');
  $stmt->execute([$token]);
  $t = $stmt->fetch();

  if (!$t) {
    file_put_contents('auth_debug.log', date('Y-m-d H:i:s') . " AUTH FAIL: Token not found in DB: '$token'\n", FILE_APPEND);
    json_response(['error' => 'UNAUTHORIZED', 'message' => 'Invalid token'], 401);
  }

  if (strtotime($t['expires_at']) < time()) {
    file_put_contents('auth_debug.log', date('Y-m-d H:i:s') . " AUTH FAIL: Token expired. Expires: '{$t['expires_at']}', Now: " . date('Y-m-d H:i:s') . "\n", FILE_APPEND);
    json_response(['error' => 'UNAUTHORIZED', 'message' => 'Token expired'], 401);
  }
}

function get_authenticated_user(PDO $pdo): ?array
{
  $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
  
  if (!$auth && function_exists('getallheaders')) {
      $headers = getallheaders();
      $auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';
  }
  
  if (!$auth && isset($_GET['token'])) {
      $auth = 'Bearer ' . $_GET['token'];
  }

  if (!preg_match('/Bearer\s+(\S+)/', $auth, $matches)) {
      return null;
  }
  $token = $matches[1];

  $stmt = $pdo->prepare('
      SELECT u.id, u.username, u.role, u.company_id, u.status 
      FROM user_tokens ut
      JOIN users u ON u.id = ut.user_id
      WHERE ut.token = ? AND ut.expires_at > NOW()
  ');
  $stmt->execute([$token]);
  $user = $stmt->fetch();

  return $user ?: null;
}
