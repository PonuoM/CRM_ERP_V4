<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET");

require_once __DIR__ . '/../config.php';

try {
  $conn = db_connect();

  $dateFrom = $_GET['date_from'] ?? null;
  $dateTo = $_GET['date_to'] ?? null;
  $companyId = $_GET['company_id'] ?? null;
  $storeId = $_GET['store_id'] ?? null;

  // Ads WHERE
  $adsWhere = ["1=1"];
  $adsParams = [];
  if ($dateFrom) { $adsWhere[] = "mal.date >= ?"; $adsParams[] = $dateFrom; }
  if ($dateTo) { $adsWhere[] = "mal.date <= ?"; $adsParams[] = $dateTo; }
  if ($companyId) { $adsWhere[] = "ms.company_id = ?"; $adsParams[] = $companyId; }
  if ($storeId) { $adsWhere[] = "mal.store_id = ?"; $adsParams[] = $storeId; }

  // Sales WHERE (reads from marketplace_sales_orders — raw CSV imported data)
  $salesWhere = ["1=1"];
  $salesParams = [];
  if ($dateFrom) { $salesWhere[] = "mso.order_date >= ?"; $salesParams[] = $dateFrom; }
  if ($dateTo) { $salesWhere[] = "mso.order_date <= ?"; $salesParams[] = $dateTo; }
  if ($companyId) { $salesWhere[] = "ms2.company_id = ?"; $salesParams[] = $companyId; }
  if ($storeId) { $salesWhere[] = "mso.store_id = ?"; $salesParams[] = $storeId; }

  $adsWhereSql = implode(" AND ", $adsWhere);
  $salesWhereSql = implode(" AND ", $salesWhere);

  // Store driving table
  $storeWhere = ["ms_main.active = 1"];
  $storeParams = [];
  if ($companyId) { $storeWhere[] = "ms_main.company_id = ?"; $storeParams[] = $companyId; }
  if ($storeId) { $storeWhere[] = "ms_main.id = ?"; $storeParams[] = $storeId; }
  $storeWhereSql = implode(" AND ", $storeWhere);

  $query = "
    SELECT 
      ms_main.id as store_id,
      ms_main.name as store_name,
      ms_main.platform,
      COALESCE(ads.total_ads_cost, 0) as ads_cost,
      COALESCE(ads.total_impressions, 0) as impressions,
      COALESCE(ads.total_clicks, 0) as clicks,
      COALESCE(sales.total_sales, 0) as total_sales,
      COALESCE(sales.total_orders, 0) as total_orders,
      COALESCE(sales.total_returns, 0) as returns_amount,
      COALESCE(sales.total_cancelled, 0) as cancelled_amount
    FROM marketplace_stores ms_main
    LEFT JOIN (
      SELECT mal.store_id,
             SUM(mal.ads_cost) as total_ads_cost,
             SUM(mal.impressions) as total_impressions,
             SUM(mal.clicks) as total_clicks
      FROM marketplace_ads_log mal
      JOIN marketplace_stores ms ON mal.store_id = ms.id
      WHERE $adsWhereSql
      GROUP BY mal.store_id
    ) ads ON ms_main.id = ads.store_id
    LEFT JOIN (
      SELECT mso.store_id,
             SUM(mso.total_price) as total_sales,
             COUNT(DISTINCT mso.online_order_id) as total_orders,
             SUM(CASE WHEN mso.order_status IN ('คืนสินค้า','ตีกลับ') THEN mso.total_price ELSE 0 END) as total_returns,
             SUM(CASE WHEN mso.order_status = 'ยกเลิกแล้ว' THEN mso.total_price ELSE 0 END) as total_cancelled
      FROM marketplace_sales_orders mso
      JOIN marketplace_stores ms2 ON mso.store_id = ms2.id
      WHERE $salesWhereSql
      GROUP BY mso.store_id
    ) sales ON ms_main.id = sales.store_id
    WHERE $storeWhereSql
    ORDER BY ads.total_ads_cost DESC, sales.total_sales DESC
  ";

  $allParams = array_merge($adsParams, $salesParams, $storeParams);

  $stmt = $conn->prepare($query);
  $stmt->execute($allParams);
  $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

  echo json_encode(["success" => true, "data" => $data]);
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(["success" => false, "error" => $e->getMessage()]);
}
?>
