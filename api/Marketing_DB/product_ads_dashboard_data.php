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
  $dateFrom = $_GET["date_from"] ?? null;
  $dateTo = $_GET["date_to"] ?? null;
  $pageIds = $_GET["page_ids"] ?? null;
  $userIds = $_GET["user_ids"] ?? null;
  $companyId = $_GET["company_id"] ?? null;
  $productIds = $_GET["product_ids"] ?? null;
  
  // 1. Where clause for Ads Log
  $logWhere = ["1=1"];
  $logParams = [];
  
  if ($dateFrom) {
    $logWhere[] = "date >= ?";
    $logParams[] = $dateFrom;
  }
  if ($dateTo) {
    $logWhere[] = "date <= ?";
    $logParams[] = $dateTo;
  }
  /*
  if ($pageIds) {
    $logWhere[] = "page_id IN ($pageIds)";
  }
  */
  if ($userIds) {
    $logWhere[] = "user_id IN ($userIds)";
  }
  if ($productIds) {
    // Only process if valid IDs exist to avoid SQL error or empty IN ()
    $pIds = array_filter(explode(',', $productIds), 'is_numeric');
    if (!empty($pIds)) {
        $in = str_repeat('?,', count($pIds) - 1) . '?';
        $logWhere[] = "product_id IN ($in)";
        $logParams = array_merge($logParams, $pIds);
    }
  }

  // 2. Where clause for Orders (Order Items)
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
  if ($pageIds) {
    $orderWhere[] = "o.sales_channel_page_id IN ($pageIds)";
  }
  if ($userIds) {
    $uIds = array_filter(explode(',', $userIds), 'is_numeric');
    if (!empty($uIds)) {
        $in = str_repeat('?,', count($uIds) - 1) . '?';
        $orderWhere[] = "o.creator_id IN ($in)";
        $orderParams = array_merge($orderParams, $uIds);
    }
  }
  if ($productIds) {
    $pIds = array_filter(explode(',', $productIds), 'is_numeric');
    if (!empty($pIds)) {
        $in = str_repeat('?,', count($pIds) - 1) . '?';
        $orderWhere[] = "oi.product_id IN ($in)";
        $orderParams = array_merge($orderParams, $pIds);
    }
  }
  
  $logWhereSql = implode(" AND ", $logWhere);
  $orderWhereSql = implode(" AND ", $orderWhere);
  
  // Main Product Where Clause
  $productWhere = ["1=1"];
  $productParams = [];
  if ($companyId) {
      $productWhere[] = "p.company_id = ?";
      $productParams[] = $companyId;
  }
  if ($productIds) {
    $pIds = array_filter(explode(',', $productIds), 'is_numeric');
    if (!empty($pIds)) {
        $in = str_repeat('?,', count($pIds) - 1) . '?';
        $productWhere[] = "p.id IN ($in)";
        $productParams = array_merge($productParams, $pIds);
    }
  }
  $productWhereSql = implode(" AND ", $productWhere);

  // Combine Queries
  /*
    Logic:
    - Get all products (or relevant ones)
    - Join Aggregated Ads Data (grouped by product_id)
    - Join Aggregated Sales Data (grouped by product_id from order_items)
  */
  
  $query = "
    SELECT 
        p.id as product_id,
        p.sku,
        p.name as product_name,
        COALESCE(ads.total_ads_cost, 0) as ads_cost,
        COALESCE(ads.total_impressions, 0) as impressions,
        COALESCE(ads.total_clicks, 0) as clicks,
        COALESCE(sales.total_sales, 0) as total_sales,
        COALESCE(sales.total_qty, 0) as total_qty,
        COALESCE(sales.total_orders, 0) as total_orders,
        COALESCE(sales.new_customer_sales, 0) as new_customer_sales,
        COALESCE(sales.reorder_customer_sales, 0) as reorder_customer_sales,
        COALESCE(sales.total_customers, 0) as total_customers
    FROM products p
    LEFT JOIN (
        SELECT 
            product_id,
            SUM(ads_cost) as total_ads_cost,
            SUM(impressions) as total_impressions,
            SUM(clicks) as total_clicks
        FROM marketing_product_ads_log
        WHERE $logWhereSql
        GROUP BY product_id
    ) ads ON p.id = ads.product_id
    LEFT JOIN (
        SELECT 
            oi.product_id,
            SUM(oi.net_total) as total_sales,
            SUM(oi.quantity) as total_qty,
            COUNT(DISTINCT oi.order_id) as total_orders,
            SUM(CASE WHEN o.customer_type = 'New Customer' THEN oi.net_total ELSE 0 END) as new_customer_sales,
            SUM(CASE WHEN o.customer_type = 'Reorder Customer' THEN oi.net_total ELSE 0 END) as reorder_customer_sales,
            COUNT(DISTINCT o.customer_id) as total_customers
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE $orderWhereSql
        GROUP BY oi.product_id
    ) sales ON p.id = sales.product_id
    WHERE $productWhereSql
    ORDER BY sales.total_sales DESC, ads.total_ads_cost DESC
  ";
  
  // Merge params: logParams, orderParams, then productParams
  $allParams = array_merge($logParams, $orderParams, $productParams);
  
  $stmt = $conn->prepare($query);
  $stmt->execute($allParams);
  $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
  
  echo json_encode(["success" => true, "data" => $data]);

} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(["success" => false, "error" => $e->getMessage()]);
}
?>
