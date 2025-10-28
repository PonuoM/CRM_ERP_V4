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
  $limit = isset($_GET["limit"]) ? (int) $_GET["limit"] : null;
  $offset = isset($_GET["offset"]) ? (int) $_GET["offset"] : 0;

  // Get session user from localStorage (simulate login session)
  session_start();
  $sessionUser = $_SESSION["user"] ?? null;
  $currentUserId = $sessionUser ? $sessionUser["id"] : null;

  // Build WHERE conditions with BETWEEN
  $whereConditions = ["1=1"];
  $params = [];

  // Add automatic current user filtering if no user_ids provided but user is logged in
  if (empty($userIdArray) && $currentUserId) {
    $whereConditions[] = "mal.user_id = ?";
    $params[] = $currentUserId;
  }

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

  // Add pagination if specified
  if ($limit) {
    $query .= " LIMIT ? OFFSET ?";
    $params[] = $limit;
    $params[] = $offset;
  }

  // Prepare and execute query
  $stmt = $conn->prepare($query);
  if ($stmt === false) {
    throw new Exception("Query preparation failed");
  }

  // Execute query with parameters
  $stmt->execute($params);
  $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

  // Get total count for pagination (without LIMIT/OFFSET)
  $countQuery = "
      SELECT COUNT(*) as total
      FROM marketing_ads_log mal
      LEFT JOIN pages p ON mal.page_id = p.id
      LEFT JOIN users u ON mal.user_id = u.id
      WHERE $whereClause
  ";

  $countStmt = $conn->prepare($countQuery);
  if ($countStmt === false) {
    throw new Exception("Count query preparation failed");
  }

  // Execute count query with same parameters
  $countParams = $params;
  // Remove LIMIT and OFFSET parameters from count query
  if ($limit) {
    array_pop($countParams); // Remove offset
    array_pop($countParams); // Remove limit
  }

  $countStmt->execute($countParams);
  $totalCount = $countStmt->fetch(PDO::FETCH_ASSOC)["total"];

  // Calculate pagination info
  $pageSize = $limit ?: 10; // Default page size if not specified
  $totalPages = $pageSize > 0 ? ceil($totalCount / $pageSize) : 1;
  $currentPage = $pageSize > 0 ? floor($offset / $pageSize) + 1 : 1;

  // Add debug info and pagination to response
  header("Content-Type: application/json");
  echo json_encode([
    "success" => true,
    "data" => $data,
    "pagination" => [
      "total" => (int) $totalCount,
      "limit" => $limit,
      "offset" => $offset,
      "page_size" => $pageSize,
      "current_page" => (int) $currentPage,
      "total_pages" => (int) $totalPages,
      "has_more" => $limit ? $offset + $limit < $totalCount : false,
      "has_previous" => $offset > 0,
    ],
    "debug" => [
      "current_user_id" => $currentUserId,
      "provided_user_ids" => $userIds,
      "auto_filtered" => empty($userIdArray) && $currentUserId ? true : false,
      "where_clause" => $whereClause,
      "params" => $params,
    ],
  ]);
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode([
    "success" => false,
    "error" => $e->getMessage(),
  ]);
}
?>
