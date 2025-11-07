<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

require_once "../config.php";

// Get pagination parameters
$page = isset($_GET["page"]) ? (int) $_GET["page"] : 1;
$pageSize = isset($_GET["pageSize"]) ? (int) $_GET["pageSize"] : 10;

// Validate pagination parameters
if ($page < 1) {
  $page = 1;
}
if ($pageSize < 1 || $pageSize > 100) {
  $pageSize = 10;
} // Max 100 items per page

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

  // First query to get total count for pagination calculation
  $countSql = "SELECT COUNT(*) as total
               FROM orders o
               WHERE o.company_id = :company_id
               AND o.payment_method = 'Transfer'";

  $countStmt = $conn->prepare($countSql);
  $countStmt->bindParam(":company_id", $company_id, PDO::PARAM_INT);
  $countStmt->execute();
  $totalCount = $countStmt->fetch()["total"];

  // Calculate pagination
  $maxPage = ceil($totalCount / $pageSize);
  $offset = ($page - 1) * $pageSize;

  // Main query to fetch transfer orders with customer data and payment status (with pagination)
  $sql = "SELECT
                o.id,
                o.order_date,
                o.delivery_date,
                o.total_amount,
                c.first_name,
                c.last_name,
                c.phone,
                CASE
                    WHEN os.order_id IS NOT NULL THEN 'จ่ายแล้ว'
                    ELSE 'ค้างจ่าย'
                END as payment_status
            FROM orders o
            LEFT JOIN customers c ON c.id = o.customer_id
            LEFT JOIN order_slips os ON os.order_id = o.id
            WHERE o.company_id = :company_id
            AND o.payment_method = 'Transfer'
            ORDER BY o.order_date DESC
            LIMIT :pageSize OFFSET :offset";

  $stmt = $conn->prepare($sql);
  $stmt->bindParam(":company_id", $company_id, PDO::PARAM_INT);
  $stmt->bindParam(":pageSize", $pageSize, PDO::PARAM_INT);
  $stmt->bindParam(":offset", $offset, PDO::PARAM_INT);
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
      "payment_status" => $row["payment_status"],
    ];
  }

  echo json_encode([
    "success" => true,
    "data" => $orders,
    "count" => count($orders),
    "totalCount" => (int) $totalCount,
    "currentPage" => $page,
    "pageSize" => $pageSize,
    "maxPage" => (int) $maxPage,
  ]);
} catch (Exception $e) {
  echo json_encode([
    "success" => false,
    "message" => $e->getMessage(),
  ]);
}
?>
