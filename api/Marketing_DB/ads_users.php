<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
  exit(0);
}

try {
  require_once "../config.php";
  $conn = db_connect();

  // Returns distinct users who have ever logged ads for pages in a company
  $companyId = $_GET['company_id'] ?? null;
  if (!$companyId) {
    echo json_encode([]);
    exit;
  }

  $stmt = $conn->prepare("
    SELECT DISTINCT mal.user_id as id, u.first_name, u.last_name, u.username
    FROM marketing_ads_log mal
    JOIN pages p ON mal.page_id = p.id
    JOIN users u ON mal.user_id = u.id
    WHERE p.company_id = ?
    ORDER BY u.first_name ASC
  ");
  $stmt->execute([$companyId]);
  echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['error' => $e->getMessage()]);
}
