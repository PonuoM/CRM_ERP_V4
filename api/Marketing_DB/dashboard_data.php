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
  $managerUserIds = $_GET["manager_user_ids"] ?? null;
  $adsUserIds = $_GET["ads_user_ids"] ?? null;
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

    // Filter pages by manager_user_ids via marketing_user_page
    if ($managerUserIds) {
      $mgrArray = explode(",", $managerUserIds);
      $mgrArray = array_map("intval", $mgrArray);
      $mgrArray = array_filter($mgrArray);

      if (!empty($mgrArray)) {
        $placeholders = str_repeat("?,", count($mgrArray) - 1) . "?";
        $pageWhereConditions[] = "p.id IN (SELECT page_id FROM marketing_user_page WHERE user_id IN ($placeholders))";
        $pageParams = array_merge($pageParams, $mgrArray);
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

    // Filter ads log by ads_user_ids (show only selected user's ads rows)
    if ($adsUserIds) {
      $adsArray = explode(",", $adsUserIds);
      $adsArray = array_map("intval", $adsArray);
      $adsArray = array_filter($adsArray);

      if (!empty($adsArray)) {
        $placeholdersLog = str_repeat("?,", count($adsArray) - 1) . "?";
        $logWhereConditions[] = "user_id IN ($placeholdersLog)";
        $logParams = array_merge($logParams, $adsArray);
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

    // returned_boxes uses same orderWhereClause (filter by order_date)
    $returnWhereClause = "ob.status = 'RETURNED' AND " . $orderWhereClause;

    // Build WHERE for NOT EXISTS subquery (uses mal. alias prefix)
    $logExistsConditions = ["1=1"];
    $logExistsParams = [];

    if ($dateFrom && $dateTo) {
      $logExistsConditions[] = "mal.date BETWEEN ? AND ?";
      $logExistsParams[] = $dateFrom;
      $logExistsParams[] = $dateTo;
    } elseif ($dateFrom) {
      $logExistsConditions[] = "mal.date >= ?";
      $logExistsParams[] = $dateFrom;
    } elseif ($dateTo) {
      $logExistsConditions[] = "mal.date <= ?";
      $logExistsParams[] = $dateTo;
    }

    // Also filter NOT EXISTS by ads_user_ids
    if ($adsUserIds) {
      $adsArrayExists = explode(",", $adsUserIds);
      $adsArrayExists = array_map("intval", $adsArrayExists);
      $adsArrayExists = array_filter($adsArrayExists);

      if (!empty($adsArrayExists)) {
        $placeholdersExists = str_repeat("?,", count($adsArrayExists) - 1) . "?";
        $logExistsConditions[] = "mal.user_id IN ($placeholdersExists)";
        $logExistsParams = array_merge($logExistsParams, $adsArrayExists);
      }
    }

    $logWhereClauseForExists = implode(" AND ", $logExistsConditions);

    // Query: Two-part UNION
    // Part 1: Pages WITH ads data (per-user, ads_cost > 0, sales attributed by ads dates)
    // Part 2: Pages with sales on dates NOT covered by any ads log (shows as page-level, no user)
    $query = "
        (SELECT
            p.id as page_id,
            p.name as page_name,
            p.platform,
            p.page_type,
            p.sell_product_type,
            p.page_id as external_page_id,
            ads_agg.user_id,
            u.first_name as staff_first_name,
            u.last_name as staff_last_name,
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
            COALESCE(page_mgr.manager_names, '') as page_managers
        FROM pages p
        INNER JOIN (
            SELECT 
                page_id,
                user_id,
                SUM(ads_cost) as ads_cost,
                SUM(impressions) as impressions,
                SUM(reach) as reach,
                SUM(clicks) as clicks
            FROM marketing_ads_log
            WHERE $logWhereClause
            GROUP BY page_id, user_id
            HAVING SUM(ads_cost) > 0
        ) ads_agg ON p.id = ads_agg.page_id
        LEFT JOIN users u ON ads_agg.user_id = u.id
        LEFT JOIN (
            SELECT 
                o.sales_channel_page_id,
                ads_dates.user_id,
                SUM(CASE WHEN o.order_status NOT IN ('Cancelled', 'Returned') THEN o.total_amount ELSE 0 END) as total_sales,
                COUNT(DISTINCT CASE WHEN o.order_status NOT IN ('Cancelled', 'Returned') THEN o.id END) as total_orders,
                SUM(CASE WHEN o.customer_type = 'New Customer' AND o.order_status NOT IN ('Cancelled', 'Returned') THEN 1 ELSE 0 END) as new_customer_orders,
                SUM(CASE WHEN o.customer_type = 'Reorder Customer' AND o.order_status NOT IN ('Cancelled', 'Returned') THEN 1 ELSE 0 END) as reorder_customer_orders,
                SUM(CASE WHEN o.customer_type = 'New Customer' AND o.order_status NOT IN ('Cancelled', 'Returned') THEN o.total_amount ELSE 0 END) as new_customer_sales,
                SUM(CASE WHEN o.customer_type = 'Reorder Customer' AND o.order_status NOT IN ('Cancelled', 'Returned') THEN o.total_amount ELSE 0 END) as reorder_customer_sales,
                COUNT(DISTINCT CASE WHEN o.order_status NOT IN ('Cancelled', 'Returned') THEN o.customer_id END) as total_customers,
                SUM(CASE WHEN o.order_status = 'Cancelled' THEN o.total_amount ELSE 0 END) as cancelled_sales,
                COUNT(CASE WHEN o.order_status = 'Cancelled' THEN 1 END) as cancelled_orders
            FROM orders o
            INNER JOIN (
                SELECT DISTINCT page_id, user_id, date
                FROM marketing_ads_log
                WHERE $logWhereClause
            ) ads_dates ON o.sales_channel_page_id = ads_dates.page_id AND DATE(o.order_date) = ads_dates.date
            WHERE $orderWhereClause
            GROUP BY o.sales_channel_page_id, ads_dates.user_id
        ) orders_agg ON p.id = orders_agg.sales_channel_page_id AND ads_agg.user_id = orders_agg.user_id
        LEFT JOIN (
            SELECT 
                o.sales_channel_page_id,
                ads_dates.user_id,
                SUM(ob.cod_amount) as returned_sales,
                COUNT(DISTINCT ob.id) as returned_orders
            FROM order_boxes ob
            JOIN orders o ON ob.order_id = o.id
            INNER JOIN (
                SELECT DISTINCT page_id, user_id, date
                FROM marketing_ads_log
                WHERE $logWhereClause
            ) ads_dates ON o.sales_channel_page_id = ads_dates.page_id AND DATE(o.order_date) = ads_dates.date
            WHERE $returnWhereClause
            GROUP BY o.sales_channel_page_id, ads_dates.user_id
        ) returned_boxes_agg ON p.id = returned_boxes_agg.sales_channel_page_id AND ads_agg.user_id = returned_boxes_agg.user_id
        LEFT JOIN (
            SELECT mup.page_id, GROUP_CONCAT(DISTINCT u2.first_name ORDER BY u2.first_name SEPARATOR ', ') as manager_names
            FROM marketing_user_page mup
            JOIN users u2 ON mup.user_id = u2.id
            GROUP BY mup.page_id
        ) page_mgr ON p.id = page_mgr.page_id
        WHERE $pageWhereClause)
    ";

    // Part 1 params
    $allParams = array_merge($logParams, $logParams, $orderParams, $logParams, $orderParams, $pageParams);

    // Part 2: Hide only when filtering by specific ads user (their rows only)
    // Keep when filtering by manager (to include sales on dates without ads in totals)
    if (!$adsUserIds) {
      $query .= "

        UNION ALL

        (SELECT
            p.id as page_id,
            p.name as page_name,
            p.platform,
            p.page_type,
            p.sell_product_type,
            p.page_id as external_page_id,
            NULL as user_id,
            'ยังไม่ลงแอด' as staff_first_name,
            '' as staff_last_name,
            0 as ads_cost,
            0 as impressions,
            0 as reach,
            0 as clicks,
            COALESCE(noads_orders.total_sales, 0) as total_sales,
            COALESCE(noads_orders.total_orders, 0) as total_orders,
            COALESCE(noads_orders.new_customer_orders, 0) as new_customer_orders,
            COALESCE(noads_orders.reorder_customer_orders, 0) as reorder_customer_orders,
            COALESCE(noads_orders.new_customer_sales, 0) as new_customer_sales,
            COALESCE(noads_orders.reorder_customer_sales, 0) as reorder_customer_sales,
            COALESCE(noads_orders.total_customers, 0) as total_customers,
            COALESCE(noads_returned.returned_sales, 0) as returned_sales,
            COALESCE(noads_returned.returned_orders, 0) as returned_orders,
            COALESCE(noads_orders.cancelled_sales, 0) as cancelled_sales,
            COALESCE(noads_orders.cancelled_orders, 0) as cancelled_orders,
            COALESCE(page_mgr2.manager_names, '') as page_managers
        FROM pages p
        INNER JOIN (
            SELECT 
                o.sales_channel_page_id,
                SUM(CASE WHEN o.order_status NOT IN ('Cancelled', 'Returned') THEN o.total_amount ELSE 0 END) as total_sales,
                COUNT(DISTINCT CASE WHEN o.order_status NOT IN ('Cancelled', 'Returned') THEN o.id END) as total_orders,
                SUM(CASE WHEN o.customer_type = 'New Customer' AND o.order_status NOT IN ('Cancelled', 'Returned') THEN 1 ELSE 0 END) as new_customer_orders,
                SUM(CASE WHEN o.customer_type = 'Reorder Customer' AND o.order_status NOT IN ('Cancelled', 'Returned') THEN 1 ELSE 0 END) as reorder_customer_orders,
                SUM(CASE WHEN o.customer_type = 'New Customer' AND o.order_status NOT IN ('Cancelled', 'Returned') THEN o.total_amount ELSE 0 END) as new_customer_sales,
                SUM(CASE WHEN o.customer_type = 'Reorder Customer' AND o.order_status NOT IN ('Cancelled', 'Returned') THEN o.total_amount ELSE 0 END) as reorder_customer_sales,
                COUNT(DISTINCT CASE WHEN o.order_status NOT IN ('Cancelled', 'Returned') THEN o.customer_id END) as total_customers,
                SUM(CASE WHEN o.order_status = 'Cancelled' THEN o.total_amount ELSE 0 END) as cancelled_sales,
                COUNT(CASE WHEN o.order_status = 'Cancelled' THEN 1 END) as cancelled_orders
            FROM orders o
            WHERE $orderWhereClause
            AND NOT EXISTS (
                SELECT 1 FROM marketing_ads_log mal
                WHERE mal.page_id = o.sales_channel_page_id
                AND mal.date = DATE(o.order_date)
                AND mal.ads_cost > 0
                AND $logWhereClauseForExists
            )
            GROUP BY o.sales_channel_page_id
            HAVING total_sales > 0 OR cancelled_sales > 0
        ) noads_orders ON p.id = noads_orders.sales_channel_page_id
        LEFT JOIN (
            SELECT 
                o.sales_channel_page_id,
                SUM(ob.cod_amount) as returned_sales,
                COUNT(DISTINCT ob.id) as returned_orders
            FROM order_boxes ob
            JOIN orders o ON ob.order_id = o.id
            WHERE $returnWhereClause
            AND NOT EXISTS (
                SELECT 1 FROM marketing_ads_log mal
                WHERE mal.page_id = o.sales_channel_page_id
                AND mal.date = DATE(o.order_date)
                AND mal.ads_cost > 0
                AND $logWhereClauseForExists
            )
            GROUP BY o.sales_channel_page_id
        ) noads_returned ON p.id = noads_returned.sales_channel_page_id
        LEFT JOIN (
            SELECT mup.page_id, GROUP_CONCAT(DISTINCT u2.first_name ORDER BY u2.first_name SEPARATOR ', ') as manager_names
            FROM marketing_user_page mup
            JOIN users u2 ON mup.user_id = u2.id
            GROUP BY mup.page_id
        ) page_mgr2 ON p.id = page_mgr2.page_id
        WHERE $pageWhereClause)
      ";
      $allParams = array_merge($allParams, $orderParams, $logExistsParams, $orderParams, $logExistsParams, $pageParams);
    }

    $query .= " ORDER BY page_name ASC, staff_first_name ASC";

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