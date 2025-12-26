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

  // Get filters from query parameters
  $dateFrom = $_GET["date_from"] ?? null;
  $dateTo = $_GET["date_to"] ?? null;
  $pageIds = $_GET["page_ids"] ?? null;
  $userIds = $_GET["user_ids"] ?? null;
  $companyId = isset($_GET["company_id"]) ? (int) $_GET["company_id"] : null;

  // Get session user from localStorage (simulate login session)
  session_start();
  $sessionUser = $_SESSION["user"] ?? null;
  $currentUserId = $sessionUser ? $sessionUser["id"] : null;

  // If company_id is provided, fetch all pages for that company
  if ($companyId) {
    // Build WHERE conditions for pages
    $pageWhereConditions = ["p.company_id = ?"];
    $pageParams = [$companyId];

    // Add page IDs filter if provided
    if ($pageIds) {
      $pageIdArray = explode(",", $pageIds);
      $pageIdArray = array_map("intval", $pageIdArray);
      $pageIdArray = array_filter($pageIdArray);

      if (!empty($pageIdArray)) {
        $placeholders = str_repeat("?,", count($pageIdArray) - 1) . "?";
        $pageWhereConditions[] = "p.id IN ($placeholders)";
        $pageParams = array_merge($pageParams, $pageIdArray);
      }
    }

    $pageWhereClause = implode(" AND ", $pageWhereConditions);

    // Build WHERE conditions for ads log
    $logWhereConditions = ["1=1"];
    $logParams = [];

    if ($dateFrom && $dateTo) {
      $logWhereConditions[] = "date BETWEEN ? AND ?";
      $logParams[] = $dateFrom;
      $logParams[] = $dateTo;
    } elseif ($dateFrom) {
      $logWhereConditions[] = "date >= ?";
      $logParams[] = $dateFrom;
    } elseif ($dateTo) {
      $logWhereConditions[] = "date <= ?";
      $logParams[] = $dateTo;
    }

    // Add user IDs filter
    if ($userIds) {
      $userIdArray = explode(",", $userIds);
      $userIdArray = array_map("intval", $userIdArray);
      $userIdArray = array_filter($userIdArray);

      if (!empty($userIdArray)) {
        $placeholders = str_repeat("?,", count($userIdArray) - 1) . "?";
        $logWhereConditions[] = "user_id IN ($placeholders)";
        $logParams = array_merge($logParams, $userIdArray);
      }
    }

    $logWhereClause = implode(" AND ", $logWhereConditions);

    // Build WHERE conditions for orders
    $orderWhereConditions = ["1=1"];
    $orderParams = [];

    if ($dateFrom && $dateTo) {
      $orderWhereConditions[] = "order_date BETWEEN ? AND ?";
      $orderParams[] = $dateFrom;
      $orderParams[] = $dateTo;
    } elseif ($dateFrom) {
      $orderWhereConditions[] = "order_date >= ?";
      $orderParams[] = $dateFrom;
    } elseif ($dateTo) {
      $orderWhereConditions[] = "order_date <= ?";
      $orderParams[] = $dateTo;
    }

    // Add user IDs filter for orders
    if ($userIds) {
      $userIdArray = explode(",", $userIds);
      $userIdArray = array_map("intval", $userIdArray);
      $userIdArray = array_filter($userIdArray);

      if (!empty($userIdArray)) {
        $placeholders = str_repeat("?,", count($userIdArray) - 1) . "?";
        $orderWhereConditions[] = "creator_id IN ($placeholders)";
        $orderParams = array_merge($orderParams, $userIdArray);
      }
    }

    $orderWhereClause = implode(" AND ", $orderWhereConditions);

    // Query to get all pages for the company with aggregated ads log and order data
    // Aggregate by page only (not by date)
    $query = "
        SELECT
            p.id as page_id,
            p.name as page_name,
            p.platform,
            p.page_type,
            p.page_id as external_page_id,
            COALESCE(SUM(mal.ads_cost), 0) as ads_cost,
            COALESCE(SUM(mal.impressions), 0) as impressions,
            COALESCE(SUM(mal.reach), 0) as reach,
            COALESCE(SUM(mal.clicks), 0) as clicks,
            COALESCE(SUM(o.total_amount), 0) as total_sales,
            COALESCE(COUNT(DISTINCT o.id), 0) as total_orders,
            COALESCE(SUM(CASE WHEN o.customer_type = 'New Customer' THEN 1 ELSE 0 END), 0) as new_customer_orders,
            COALESCE(SUM(CASE WHEN o.customer_type = 'Reorder Customer' THEN 1 ELSE 0 END), 0) as reorder_customer_orders,
            COALESCE(SUM(CASE WHEN o.customer_type = 'New Customer' THEN o.total_amount ELSE 0 END), 0) as new_customer_sales,
            COALESCE(SUM(CASE WHEN o.customer_type = 'Reorder Customer' THEN o.total_amount ELSE 0 END), 0) as reorder_customer_sales,
            COALESCE(COUNT(DISTINCT o.customer_id), 0) as total_customers,
            staff.staff_names
        FROM pages p
        LEFT JOIN (
            SELECT * FROM marketing_ads_log
            WHERE $logWhereClause
        ) mal ON p.id = mal.page_id
        LEFT JOIN (
            SELECT * FROM orders
            WHERE $orderWhereClause
        ) o ON p.id = o.sales_channel_page_id
        LEFT JOIN (
            SELECT mup.page_id, GROUP_CONCAT(u.first_name SEPARATOR ', ') as staff_names
            FROM marketing_user_page mup
            JOIN users u ON mup.user_id = u.id
            GROUP BY mup.page_id
        ) staff ON p.id = staff.page_id
        WHERE $pageWhereClause
        GROUP BY p.id, p.name, p.platform, p.page_type, p.page_id, staff.staff_names
        ORDER BY p.name ASC
    ";

    // Combine parameters: logParams, orderParams, then pageParams
    $allParams = array_merge($logParams, $orderParams, $pageParams);

    // Prepare and execute query
    $stmt = $conn->prepare($query);
    if ($stmt === false) {
      throw new Exception("Query preparation failed");
    }

    // Execute query with parameters
    $stmt->execute($allParams);
    $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Return data
    header("Content-Type: application/json");
    echo json_encode([
      "success" => true,
      "data" => $data,
    ]);
  } else {
    // Original logic when company_id is not provided (backward compatibility)
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
            p.page_type as page_type,
            p.page_id as external_page_id,
            u.first_name,
            u.last_name,
            u.username
        FROM marketing_ads_log mal
        LEFT JOIN pages p ON mal.page_id = p.id
        LEFT JOIN users u ON mal.user_id = u.id
        WHERE $whereClause
        ORDER BY mal.date DESC, p.name ASC
    ";

    // Prepare and execute query
    $stmt = $conn->prepare($query);
    if ($stmt === false) {
      throw new Exception("Query preparation failed");
    }

    // Execute query with parameters
    $stmt->execute($params);
    $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Return data without pagination
    header("Content-Type: application/json");
    echo json_encode([
      "success" => true,
      "data" => $data,
    ]);
  }
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode([
    "success" => false,
    "error" => $e->getMessage(),
  ]);
}
?>
