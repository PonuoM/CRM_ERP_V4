<?php
date_default_timezone_set("Asia/Bangkok");
// Database configuration
// Adjust host/port if your MySQL runs elsewhere
$DB_HOST = getenv("DB_HOST") ?: "127.0.0.1";
$DB_PORT = getenv("DB_PORT") ?: "3306";
$DB_NAME = getenv("DB_NAME") ?: "mini_erp";
$DB_USER = getenv("DB_USER") ?: "root";
$DB_PASS = getenv("DB_PASS") ?: "12345678";

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
