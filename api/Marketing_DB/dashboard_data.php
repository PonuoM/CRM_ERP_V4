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

    // Add user IDs filter for Pages (Show only pages assigned to selected users)
    if ($userIds) {
      $userIdArray = explode(",", $userIds);
      $userIdArray = array_map("intval", $userIdArray);
      $userIdArray = array_filter($userIdArray);

      if (!empty($userIdArray)) {
        $placeholders = str_repeat("?,", count($userIdArray) - 1) . "?";
        $pageWhereConditions[] = "p.id IN (SELECT page_id FROM marketing_user_page WHERE user_id IN ($placeholders))";
        $pageParams = array_merge($pageParams, $userIdArray);
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
      // Fix: Append time to ensure full day is included
      // BETWEEN 'date' AND 'date' only matches 00:00:00, missing all orders with time
      $orderWhereConditions[] = "order_date BETWEEN ? AND ?";
      $orderParams[] = $dateFrom . ' 00:00:00';
      $orderParams[] = $dateTo . ' 23:59:59';
    } elseif ($dateFrom) {
      $orderWhereConditions[] = "order_date >= ?";
      $orderParams[] = $dateFrom . ' 00:00:00';
    } elseif ($dateTo) {
      $orderWhereConditions[] = "order_date <= ?";
      $orderParams[] = $dateTo . ' 23:59:59';
    }

    // NOTE: Do NOT filter orders by user_ids here!
    // user_ids = Marketing staff who manage Pages (กรอกค่าแอด)
    // creator_id = Sales/Telesale staff who create Orders
    // These are different people, so filtering orders by Marketing user_ids causes 0 sales.
    // Orders are already filtered by sales_channel_page_id (which page the order came from).

    $orderWhereClause = implode(" AND ", $orderWhereConditions);

    // Query to get all pages for the company with aggregated ads log and order data
    // FIX: Pre-aggregate ads_log and orders BEFORE joining to prevent Cartesian Product
    // The previous query caused ads_cost to be multiplied by order count
    $query = "
        SELECT
            p.id as page_id,
            p.name as page_name,
            p.platform,
            p.page_type,
            p.sell_product_type,
            p.page_id as external_page_id,
            COALESCE(ads_agg.ads_cost, 0) as ads_cost,
            COALESCE(ads_agg.impressions, 0) as impressions,
            COALESCE(ads_agg.reach, 0) as reach,
            COALESCE(ads_agg.clicks, 0) as clicks,
            COALESCE(orders_agg.total_sales, 0) as total_sales,
            COALESCE(orders_agg.total_orders, 0) as total_orders,
            COALESCE(orders_agg.new_customer_orders, 0) as new_customer_orders,
            COALESCE(orders_agg.reorder_customer_orders, 0) as reorder_customer_orders,
            COALESCE(orders_agg.new_customer_sales, 0) as new_customer_sales,
            COALESCE(orders_agg.reorder_customer_sales, 0) as reorder_customer_sales,
            COALESCE(orders_agg.total_customers, 0) as total_customers,
            COALESCE(returned_boxes_agg.returned_sales, 0) as returned_sales,
            COALESCE(returned_boxes_agg.returned_orders, 0) as returned_orders,
            COALESCE(orders_agg.cancelled_sales, 0) as cancelled_sales,
            COALESCE(orders_agg.cancelled_orders, 0) as cancelled_orders,
            staff.staff_names
        FROM pages p
        LEFT JOIN (
            SELECT 
                page_id,
                SUM(ads_cost) as ads_cost,
                SUM(impressions) as impressions,
                SUM(reach) as reach,
                SUM(clicks) as clicks
            FROM marketing_ads_log
            WHERE $logWhereClause
            GROUP BY page_id
        ) ads_agg ON p.id = ads_agg.page_id
        LEFT JOIN (
            SELECT 
                sales_channel_page_id,
                SUM(CASE WHEN order_status NOT IN ('Cancelled', 'Returned') THEN total_amount ELSE 0 END) as total_sales,
                COUNT(DISTINCT CASE WHEN order_status NOT IN ('Cancelled', 'Returned') THEN id END) as total_orders,
                SUM(CASE WHEN customer_type = 'New Customer' AND order_status NOT IN ('Cancelled', 'Returned') THEN 1 ELSE 0 END) as new_customer_orders,
                SUM(CASE WHEN customer_type = 'Reorder Customer' AND order_status NOT IN ('Cancelled', 'Returned') THEN 1 ELSE 0 END) as reorder_customer_orders,
                SUM(CASE WHEN customer_type = 'New Customer' AND order_status NOT IN ('Cancelled', 'Returned') THEN total_amount ELSE 0 END) as new_customer_sales,
                SUM(CASE WHEN customer_type = 'Reorder Customer' AND order_status NOT IN ('Cancelled', 'Returned') THEN total_amount ELSE 0 END) as reorder_customer_sales,
                COUNT(DISTINCT CASE WHEN order_status NOT IN ('Cancelled', 'Returned') THEN customer_id END) as total_customers,
                SUM(CASE WHEN order_status = 'Cancelled' THEN total_amount ELSE 0 END) as cancelled_sales,
                COUNT(CASE WHEN order_status = 'Cancelled' THEN 1 END) as cancelled_orders
            FROM orders
            WHERE $orderWhereClause
            GROUP BY sales_channel_page_id
        ) orders_agg ON p.id = orders_agg.sales_channel_page_id
        LEFT JOIN (
            SELECT 
                o.sales_channel_page_id,
                SUM(ob.cod_amount) as returned_sales,
                COUNT(DISTINCT ob.id) as returned_orders
            FROM order_boxes ob
            JOIN orders o ON ob.order_id = o.id
            WHERE ob.status = 'RETURNED'
            AND $orderWhereClause
            GROUP BY o.sales_channel_page_id
        ) returned_boxes_agg ON p.id = returned_boxes_agg.sales_channel_page_id
        LEFT JOIN (
            SELECT mup.page_id, GROUP_CONCAT(u.first_name SEPARATOR ', ') as staff_names
            FROM marketing_user_page mup
            JOIN users u ON mup.user_id = u.id
            GROUP BY mup.page_id
        ) staff ON p.id = staff.page_id
        WHERE $pageWhereClause
        ORDER BY p.name ASC
    ";

    // Combine parameters: logParams, orderParams, orderParams (for returned_boxes_agg), then pageParams
    $allParams = array_merge($logParams, $orderParams, $orderParams, $pageParams);

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
            p.sell_product_type,
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