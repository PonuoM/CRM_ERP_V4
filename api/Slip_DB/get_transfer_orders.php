<?php
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

// Set UTF-8 encoding
mb_internal_encoding("UTF-8");
mb_http_output("UTF-8");

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

// Get filter parameters with proper UTF-8 handling
$filters = [];
$conditions = [];
$bindParams = [];

if (!empty($_GET["order_id"])) {
  $filters["order_id"] = trim($_GET["order_id"]);
  $conditions[] = "o.id LIKE ?";
  $bindParams[] = "%" . $filters["order_id"] . "%";
}

if (!empty($_GET["customer_name"])) {
  // Convert to UTF-8 and normalize
  $customerName = trim($_GET["customer_name"]);
  $customerName = mb_convert_encoding(
    $customerName,
    "UTF-8",
    "UTF-8,ISO-8859-1,WINDOWS-1252",
  );
  $filters["customer_name"] = $customerName;
  $conditions[] = "(c.first_name LIKE ? OR c.last_name LIKE ?)";
  $bindParams[] = "%" . $customerName . "%";
  $bindParams[] = "%" . $customerName . "%";
}

if (!empty($_GET["phone"])) {
  $filters["phone"] = trim($_GET["phone"]);
  $conditions[] = "c.phone LIKE ?";
  $bindParams[] = "%" . $filters["phone"] . "%";
}

if (!empty($_GET["sale_month"])) {
  $filters["sale_month"] = (int) $_GET["sale_month"];
  if ($filters["sale_month"] >= 1 && $filters["sale_month"] <= 12) {
    $conditions[] = "MONTH(o.order_date) = ?";
    $bindParams[] = $filters["sale_month"];
  }
}

if (!empty($_GET["sale_year"])) {
  $filters["sale_year"] = (int) $_GET["sale_year"];
  $conditions[] = "YEAR(o.order_date) = ?";
  $bindParams[] = $filters["sale_year"];
}

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
  // Database connection using PDO with UTF-8
  $conn = db_connect();
  $conn->exec("SET NAMES utf8mb4");
  $conn->exec("SET CHARACTER SET utf8mb4");

  // Build WHERE clause
  $whereClause = "o.company_id = ? AND o.payment_method = 'Transfer'";
  $allParams = [$company_id];

  if (!empty($conditions)) {
    $whereClause .= " AND " . implode(" AND ", $conditions);
    $allParams = array_merge($allParams, $bindParams);
  }

  // First query to get total count for pagination calculation
  $countSql = "SELECT COUNT(*) as total
               FROM orders o
               LEFT JOIN customers c ON c.id = o.customer_id
               WHERE {$whereClause}";

  $countStmt = $conn->prepare($countSql);
  $countStmt->execute($allParams);
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
            WHERE {$whereClause}
            ORDER BY o.order_date DESC
            LIMIT ? OFFSET ?";

  $stmt = $conn->prepare($sql);

  // Bind all parameters including pagination
  $finalParams = array_merge($allParams, [$pageSize, $offset]);
  $stmt->execute($finalParams);

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

  // Set proper JSON encoding flags for UTF-8
  echo json_encode(
    [
      "success" => true,
      "data" => $orders,
      "count" => count($orders),
      "totalCount" => (int) $totalCount,
      "currentPage" => $page,
      "pageSize" => $pageSize,
      "maxPage" => (int) $maxPage,
      "filters" => $filters,
    ],
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
  );
} catch (Exception $e) {
  echo json_encode(
    [
      "success" => false,
      "message" => $e->getMessage(),
    ],
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
  );
}
?>
