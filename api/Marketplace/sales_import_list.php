<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET");

require_once __DIR__ . '/../config.php';

try {
  $conn = db_connect();

  $storeId = $_GET['store_id'] ?? null;
  $dateFrom = $_GET['date_from'] ?? null;
  $dateTo = $_GET['date_to'] ?? null;
  $companyId = $_GET['company_id'] ?? null;

  $where = ["1=1"];
  $params = [];

  if ($storeId) {
    $where[] = "msi.store_id = ?";
    $params[] = $storeId;
  }
  if ($dateFrom) {
    $where[] = "msi.date >= ?";
    $params[] = $dateFrom;
  }
  if ($dateTo) {
    $where[] = "msi.date <= ?";
    $params[] = $dateTo;
  }
  if ($companyId) {
    $where[] = "ms.company_id = ?";
    $params[] = $companyId;
  }

  $whereSql = implode(" AND ", $where);

  $query = "
    SELECT msi.*, ms.name as store_name, ms.platform,
           CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')) as imported_by
    FROM marketplace_sales_import msi
    JOIN marketplace_stores ms ON msi.store_id = ms.id
    LEFT JOIN users u ON msi.user_id = u.id
    WHERE $whereSql
    ORDER BY msi.date DESC, ms.name
  ";

  $stmt = $conn->prepare($query);
  $stmt->execute($params);
  $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

  echo json_encode(["success" => true, "data" => $data]);
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(["success" => false, "error" => $e->getMessage()]);
}
?>
