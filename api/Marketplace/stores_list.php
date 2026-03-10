<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET");

require_once __DIR__ . '/../config.php';

try {
  $conn = db_connect();

  $companyId = $_GET['company_id'] ?? null;
  $activeOnly = ($_GET['active_only'] ?? 'false') === 'true';

  $where = ["1=1"];
  $params = [];

  if ($companyId) {
    $where[] = "ms.company_id = ?";
    $params[] = $companyId;
  }
  if ($activeOnly) {
    $where[] = "ms.active = 1";
  }

  $whereSql = implode(" AND ", $where);

  $query = "
    SELECT ms.*
    FROM marketplace_stores ms
    WHERE $whereSql
    ORDER BY ms.platform, ms.name
  ";

  $stmt = $conn->prepare($query);
  $stmt->execute($params);
  $data = $stmt->fetchAll(PDO::FETCH_ASSOC);

  // Resolve manager names from comma-separated IDs
  foreach ($data as &$row) {
    $row['manager_names'] = [];
    if (!empty($row['manager_user_id'])) {
      $ids = array_filter(explode(',', $row['manager_user_id']), 'is_numeric');
      if (!empty($ids)) {
        $in = str_repeat('?,', count($ids) - 1) . '?';
        $uStmt = $conn->prepare("SELECT id, CONCAT(first_name, ' ', COALESCE(last_name, '')) as name FROM users WHERE id IN ($in)");
        $uStmt->execute($ids);
        $row['manager_names'] = $uStmt->fetchAll(PDO::FETCH_COLUMN, 1);
      }
    }
    $row['manager_name'] = implode(', ', $row['manager_names']);
  }

  echo json_encode(["success" => true, "data" => $data]);
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(["success" => false, "error" => $e->getMessage()]);
}
?>
