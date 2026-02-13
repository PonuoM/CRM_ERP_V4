<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
  exit(0);
}

try {
  require_once "../config.php";

  $conn = db_connect();

  // Filters
  $dateFrom = $_GET["date_from"] ?? $_GET["start_date"] ?? null;
  $dateTo = $_GET["date_to"] ?? $_GET["end_date"] ?? null;
  $pageIds = $_GET["page_ids"] ?? null;
  $userIds = $_GET["user_ids"] ?? null;
  $companyId = $_GET["company_id"] ?? null;
  $adsGroups = $_GET["ads_groups"] ?? null;

  // 1. Where clause for Ads Log (marketing_product_ads_log)
  $logWhere = ["1=1"];
  $logParams = [];

  if ($dateFrom) {
    $logWhere[] = "mal.date >= ?";
    $logParams[] = $dateFrom;
  }
  if ($dateTo) {
    $logWhere[] = "mal.date <= ?";
    $logParams[] = $dateTo;
  }
  if ($userIds) {
    $uIds = array_filter(explode(',', $userIds), 'is_numeric');
    if (!empty($uIds)) {
      $in = str_repeat('?,', count($uIds) - 1) . '?';
      $logWhere[] = "mal.user_id IN ($in)";
      $logParams = array_merge($logParams, $uIds);
    }
  }
  // Company filter via JOIN users
  if ($companyId) {
    $logWhere[] = "u.company_id = ?";
    $logParams[] = $companyId;
  }
  // Ads group filter
  if ($adsGroups) {
    $adsGroupArray = array_filter(explode(',', $adsGroups));
    if (!empty($adsGroupArray)) {
      $in = implode(',', array_fill(0, count($adsGroupArray), '?'));
      $logWhere[] = "mal.ads_group IN ($in)";
      $logParams = array_merge($logParams, $adsGroupArray);
    }
  }

  $logWhereSql = implode(" AND ", $logWhere);

  // 2. Where clause for Orders (for sales subquery)
  $orderWhere = ["1=1"];
  $orderParams = [];

  if ($dateFrom) {
    $orderWhere[] = "o.order_date >= ?";
    $orderParams[] = $dateFrom;
  }
  if ($dateTo) {
    $orderWhere[] = "o.order_date <= ?";
    $orderParams[] = $dateTo;
  }
  // page_ids filter removed from orders - only applies to ads log
  if ($userIds) {
    $uIds = array_filter(explode(',', $userIds), 'is_numeric');
    if (!empty($uIds)) {
      $in = str_repeat('?,', count($uIds) - 1) . '?';
      $orderWhere[] = "o.creator_id IN ($in)";
      $orderParams = array_merge($orderParams, $uIds);
    }
  }
  // Company filter for orders
  if ($companyId) {
    $orderWhere[] = "o.company_id = ?";
    $orderParams[] = $companyId;
  }

  $orderWhereSql = implode(" AND ", $orderWhere);

  // Main Query: group by ads_group
  $query = "
    SELECT 
        ads_agg.ads_group,
        COALESCE(ads_agg.total_ads_cost, 0) as ads_cost,
        COALESCE(ads_agg.total_impressions, 0) as impressions,
        COALESCE(ads_agg.total_reach, 0) as reach,
        COALESCE(ads_agg.total_clicks, 0) as clicks,
        COALESCE(sales.total_sales, 0) as total_sales,
        COALESCE(sales.total_qty, 0) as total_qty,
        COALESCE(sales.total_orders, 0) as total_orders,
        COALESCE(sales.new_customer_sales, 0) as new_customer_sales,
        COALESCE(sales.reorder_customer_sales, 0) as reorder_customer_sales,
        COALESCE(sales.total_customers, 0) as total_customers,
        COALESCE(returned_boxes.returned_sales, 0) as returned_sales,
        COALESCE(returned_boxes.returned_orders, 0) as returned_orders,
        COALESCE(sales.cancelled_sales, 0) as cancelled_sales,
        COALESCE(sales.cancelled_orders, 0) as cancelled_orders
    FROM (
        SELECT 
            mal.ads_group,
            SUM(mal.ads_cost) as total_ads_cost,
            SUM(mal.impressions) as total_impressions,
            SUM(mal.reach) as total_reach,
            SUM(mal.clicks) as total_clicks
        FROM marketing_product_ads_log mal
        JOIN users u ON mal.user_id = u.id
        WHERE $logWhereSql
        AND mal.ads_group IS NOT NULL AND mal.ads_group != ''
        GROUP BY mal.ads_group
    ) ads_agg
    LEFT JOIN (
        SELECT 
            p.ads_group,
            SUM(CASE WHEN o.order_status NOT IN ('Cancelled', 'Returned') THEN oi.net_total ELSE 0 END) as total_sales,
            SUM(CASE WHEN o.order_status NOT IN ('Cancelled', 'Returned') THEN oi.quantity ELSE 0 END) as total_qty,
            COUNT(DISTINCT CASE WHEN o.order_status NOT IN ('Cancelled', 'Returned') THEN oi.parent_order_id END) as total_orders,
            SUM(CASE WHEN o.customer_type = 'New Customer' AND o.order_status NOT IN ('Cancelled', 'Returned') THEN oi.net_total ELSE 0 END) as new_customer_sales,
            SUM(CASE WHEN o.customer_type = 'Reorder Customer' AND o.order_status NOT IN ('Cancelled', 'Returned') THEN oi.net_total ELSE 0 END) as reorder_customer_sales,
            COUNT(DISTINCT CASE WHEN o.order_status NOT IN ('Cancelled', 'Returned') THEN o.customer_id END) as total_customers,
            SUM(CASE WHEN o.order_status = 'Cancelled' THEN oi.net_total ELSE 0 END) as cancelled_sales,
            COUNT(DISTINCT CASE WHEN o.order_status = 'Cancelled' THEN oi.parent_order_id END) as cancelled_orders
        FROM order_items oi
        JOIN orders o ON oi.parent_order_id = o.id
        JOIN products p ON oi.product_id = p.id
        WHERE $orderWhereSql
        AND p.ads_group IS NOT NULL AND p.ads_group != ''
        GROUP BY p.ads_group
    ) sales ON ads_agg.ads_group = sales.ads_group
    LEFT JOIN (
        SELECT 
            p.ads_group,
            SUM(oi.net_total) as returned_sales,
            COUNT(DISTINCT ob.id) as returned_orders
        FROM order_items oi
        JOIN order_boxes ob ON oi.order_id = ob.sub_order_id
        JOIN orders o ON ob.order_id = o.id
        JOIN products p ON oi.product_id = p.id
        WHERE ob.status = 'RETURNED'
        AND $orderWhereSql
        AND p.ads_group IS NOT NULL AND p.ads_group != ''
        GROUP BY p.ads_group
    ) returned_boxes ON ads_agg.ads_group = returned_boxes.ads_group
    ORDER BY ads_agg.total_ads_cost DESC
  ";

  // Merge params: logParams, orderParams, orderParams (returned_boxes)
  $allParams = array_merge($logParams, $orderParams, $orderParams);

  $stmt = $conn->prepare($query);
  $stmt->execute($allParams);
  $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

  echo json_encode(["success" => true, "data" => $data]);

} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(["success" => false, "error" => $e->getMessage()]);
}
?>