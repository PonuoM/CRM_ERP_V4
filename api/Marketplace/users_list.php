<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET");

require_once __DIR__ . '/../config.php';

try {
  $conn = db_connect();

  $companyId = $_GET['company_id'] ?? null;

  $where = ["u.status = 'active'"];
  $params = [];

  if ($companyId) {
    $where[] = "u.company_id = ?";
    $params[] = $companyId;
  }

  $whereSql = implode(" AND ", $where);

  $query = "
    SELECT u.id, u.first_name, u.last_name, u.role, u.role_id, u.company_id,
           r.name as role_name, COALESCE(r.is_system, 0) as is_system
    FROM users u
    LEFT JOIN roles r ON r.id = u.role_id
    WHERE $whereSql
    ORDER BY u.first_name
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
