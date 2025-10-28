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

  // Get database connection using PDO
  $conn = db_connect();

  // Get date filters from query parameters
  $dateFrom = $_GET["date_from"] ?? null;
  $dateTo = $_GET["date_to"] ?? null;
  $pageIds = $_GET["page_ids"] ?? null;
  $userIds = $_GET["user_ids"] ?? null;

  // Build WHERE conditions with BETWEEN
  $whereConditions = ["1=1"];
  $params = [];

  if ($dateFrom && $dateTo) {
    $whereConditions[] = "date BETWEEN ? AND ?";
    $params[] = $dateFrom;
    $params[] = $dateTo;
  } elseif ($dateFrom) {
    $whereConditions[] = "date >= ?";
    $params[] = $dateFrom;
  } elseif ($dateTo) {
    $whereConditions[] = "date <= ?";
    $params[] = $dateTo;
  }

  // Add page IDs filter - page_ids is required
  if (!$pageIds) {
    echo json_encode([
      "success" => true,
      "data" => [],
    ]);
    exit();
  }

  $pageIdArray = explode(",", $pageIds);
  $pageIdArray = array_map("intval", $pageIdArray);
  $pageIdArray = array_filter($pageIdArray);

  if (!empty($pageIdArray)) {
    $placeholders = str_repeat("?,", count($pageIdArray) - 1) . "?";
    $whereConditions[] = "mal.page_id IN ($placeholders)";
    $params = array_merge($params, $pageIdArray);
  } else {
    // If page_ids parameter exists but contains no valid IDs, return empty data
    echo json_encode([
      "success" => true,
      "data" => [],
    ]);
    exit();
  }

  // Add user IDs filter
  if ($userIds) {
    $userIdArray = explode(",", $userIds);
    $userIdArray = array_map("intval", $userIdArray);
    $userIdArray = array_filter($userIdArray);

    if (!empty($userIdArray)) {
      $placeholders = str_repeat("?,", count($userIdArray) - 1) . "?";
      $whereConditions[] = "mal.user_id IN ($placeholders)";
      $params = array_merge($params, $userIdArray);
    }
  }

  $whereClause = implode(" AND ", $whereConditions);

  // Query to get marketing_ads_log data with page and user information
  $query = "
      SELECT
          mal.id,
          mal.date as log_date,
          mal.page_id,
          mal.user_id,
          mal.ads_cost,
          mal.impressions,
          mal.reach,
          mal.clicks,
          p.name as page_name,
          p.platform,
          u.first_name,
          u.last_name,
          u.username
      FROM marketing_ads_log mal
      LEFT JOIN pages p ON mal.page_id = p.id
      LEFT JOIN users u ON mal.user_id = u.id
      WHERE $whereClause
      ORDER BY mal.date DESC, p.name ASC
  ";

  $stmt = $conn->prepare($query);
  if ($stmt === false) {
    throw new Exception("Query preparation failed");
  }

  // Execute query with parameters
  $stmt->execute($params);
  $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

  echo json_encode([
    "success" => true,
    "data" => $data,
  ]);
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode([
    "success" => false,
    "error" => $e->getMessage(),
  ]);
}
?>
