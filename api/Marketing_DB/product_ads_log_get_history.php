<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Pragma: no-cache");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
  exit(0);
}

try {
  require_once "../config.php";
  
  $startDate = $_GET['start_date'] ?? null;
  $endDate = $_GET['end_date'] ?? null;
  $productIds = $_GET['product_ids'] ?? null; // Comma separated
  $userIds = $_GET['user_ids'] ?? null; // Comma separated
  $adsGroups = $_GET['ads_groups'] ?? null; // Comma separated
  
  $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
  $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
  $offset = ($page - 1) * $limit;

  $conn = db_connect();
  
  $whereClauses = [];
  $params = [];
  
  // Date filter
  if ($startDate && $endDate) {
    if ($startDate === $endDate) {
        $whereClauses[] = "l.date = ?";
        $params[] = $startDate;
    } else {
        $whereClauses[] = "l.date BETWEEN ? AND ?";
        $params[] = $startDate;
        $params[] = $endDate;
    }
  }

  // User filter
  if ($userIds) {
      $userIdArray = explode(',', $userIds);
      $placeholders = implode(',', array_fill(0, count($userIdArray), '?'));
      $whereClauses[] = "l.user_id IN ($placeholders)";
      $params = array_merge($params, $userIdArray);
  }
  
  // Product filter
  if ($productIds) {
    $productIdArray = explode(',', $productIds);
    $placeholders = implode(',', array_fill(0, count($productIdArray), '?'));
    $whereClauses[] = "l.product_id IN ($placeholders)";
    $params = array_merge($params, $productIdArray);
  }

  // Ads group filter
  if ($adsGroups) {
    $adsGroupArray = explode(',', $adsGroups);
    $placeholders = implode(',', array_fill(0, count($adsGroupArray), '?'));
    $whereClauses[] = "l.ads_group IN ($placeholders)";
    $params = array_merge($params, $adsGroupArray);
  }

  $whereSql = "";
  if (count($whereClauses) > 0) {
      $whereSql = "WHERE " . implode(" AND ", $whereClauses);
  }

  // Count total for pagination
  $countSql = "SELECT COUNT(*) as total FROM marketing_product_ads_log l $whereSql";
  $stmt = $conn->prepare($countSql);
  $stmt->execute($params);
  $total = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
  $totalPages = ceil($total / $limit);

  // Main query
  $sql = "SELECT 
            l.*,
            pr.name as product_name,
            pr.sku as product_sku,
            CONCAT(u.first_name, ' ', u.last_name) as user_fullname,
            u.username as user_username
          FROM marketing_product_ads_log l
          LEFT JOIN products pr ON l.product_id = pr.id
          LEFT JOIN users u ON l.user_id = u.id
          $whereSql
          ORDER BY l.date DESC, l.created_at DESC
          LIMIT $limit OFFSET $offset";

  $stmt = $conn->prepare($sql);
  $stmt->execute($params);
  $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
  
  echo json_encode([
      "success" => true, 
      "data" => $data,
      "pagination" => [
          "total" => $total,
          "totalPages" => $totalPages,
          "currentPage" => $page,
          "limit" => $limit
      ]
  ]);

} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(["success" => false, "error" => $e->getMessage()]);
}
?>
