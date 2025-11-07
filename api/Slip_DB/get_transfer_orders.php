<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

require_once "../config.php";

// Get company_id from session (for now, we'll get it from query parameter for testing)
// In production, this should come from proper session management
$company_id = isset($_GET["company_id"]) ? (int) $_GET["company_id"] : 0;

if ($company_id <= 0) {
  echo json_encode([
    "success" => false,
    "message" => "Company ID is required",
  ]);
  exit();
}

try {
  // Database connection using PDO
  $conn = db_connect();

  // Query to fetch transfer orders with customer data
  $sql = "SELECT
                o.id,
                o.order_date,
                o.delivery_date,
                o.total_amount,
                c.first_name,
                c.last_name,
                c.phone
            FROM orders o
            LEFT JOIN customers c ON c.id = o.customer_id
            WHERE o.company_id = :company_id
            AND o.payment_method = 'Transfer'
            ORDER BY o.order_date DESC";

  $stmt = $conn->prepare($sql);
  $stmt->bindParam(":company_id", $company_id, PDO::PARAM_INT);
  $stmt->execute();

  $orders = [];

  while ($row = $stmt->fetch()) {
    $orders[] = [
      "id" => $row["id"],
      "order_date" => $row["order_date"],
      "delivery_date" => $row["delivery_date"],
      "total_amount" => (float) $row["total_amount"],
      "first_name" => $row["first_name"],
      "last_name" => $row["last_name"],
      "phone" => $row["phone"],
      "full_name" => trim($row["first_name"] . " " . $row["last_name"]),
    ];
  }

  echo json_encode([
    "success" => true,
    "data" => $orders,
    "count" => count($orders),
  ]);
} catch (Exception $e) {
  echo json_encode([
    "success" => false,
    "message" => $e->getMessage(),
  ]);
}
?>
