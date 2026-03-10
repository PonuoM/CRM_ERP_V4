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
    $where[] = "mal.store_id = ?";
    $params[] = $storeId;
  }
  if ($dateFrom) {
    $where[] = "mal.date >= ?";
    $params[] = $dateFrom;
  }
  if ($dateTo) {
    $where[] = "mal.date <= ?";
    $params[] = $dateTo;
  }
  if ($companyId) {
    $where[] = "ms.company_id = ?";
    $params[] = $companyId;
  }

  $whereSql = implode(" AND ", $where);

  $query = "
    SELECT mal.*, ms.name as store_name, ms.platform,
           CONCAT(u.first_name, ' ', COALESCE(u.last_name, '')) as entered_by
    FROM marketplace_ads_log mal
    JOIN marketplace_stores ms ON mal.store_id = ms.id
    LEFT JOIN users u ON mal.user_id = u.id
    WHERE $whereSql
    ORDER BY mal.date DESC, ms.name
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
