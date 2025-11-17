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

// Payment method selector (default Transfer for backward compatibility)
$allowedPaymentMethods = ["Transfer", "PayAfter"];
$paymentMethodAliases = [
  "Transfer" => ["Transfer", "โอน", "โอนเงิน", "transfer"],
  "PayAfter" => ["PayAfter", "หลังจากรับสินค้า", "รับสินค้าก่อน"],
];
$paymentMethodInput = isset($_GET["payment_method"])
  ? trim($_GET["payment_method"])
  : "Transfer";
$paymentMethodToken = strtolower($paymentMethodInput);

if ($paymentMethodToken === "payafter" || $paymentMethodToken === "pay_after" || $paymentMethodToken === "pay-after") {
  $paymentMethod = "PayAfter";
} elseif ($paymentMethodToken === "transfer" || $paymentMethodToken === "transfer_bank") {
  $paymentMethod = "Transfer";
} else {
  $paymentMethod = in_array($paymentMethodInput, $allowedPaymentMethods, true)
    ? $paymentMethodInput
    : "Transfer";
}

$selectedPaymentValues = $paymentMethodAliases[$paymentMethod] ?? [$paymentMethod];
$selectedPaymentValues = array_values(
  array_unique(
    array_filter(
      array_map("trim", $selectedPaymentValues),
      function ($value) {
        return $value !== "";
      },
    ),
  ),
);
if (empty($selectedPaymentValues)) {
  $selectedPaymentValues = [$paymentMethod];
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

  // Build WHERE clause - get all orders with desired payment method (support aliases)
  // We'll filter out fully paid orders using HAVING clause based on slip totals
  $methodPlaceholder = count($selectedPaymentValues) === 1
    ? "o.payment_method = ?"
    : "o.payment_method IN (" .
      implode(",", array_fill(0, count($selectedPaymentValues), "?")) .
      ")";
  $whereClause = "o.company_id = ? AND {$methodPlaceholder}";
  $allParams = array_merge([$company_id], $selectedPaymentValues);

  if (!empty($conditions)) {
    $whereClause .= " AND " . implode(" AND ", $conditions);
    $allParams = array_merge($allParams, $bindParams);
  }

  // Check if order_slips.amount column exists (single check, reuse result)
  // Use a more reliable check by trying to describe the table structure
  $check_amount_col = 0;
  try {
    $check_result = $conn->query("SELECT COUNT(*) as cnt FROM information_schema.columns 
      WHERE table_schema = DATABASE() 
      AND table_name = 'order_slips' 
      AND column_name = 'amount'");
    $check_amount_col = (int) $check_result->fetchColumn();
  } catch (Exception $e) {
    // If check fails, assume column doesn't exist
    $check_amount_col = 0;
  }
  
  // First query to get total count for pagination calculation
  // Must match the HAVING clause from main query
  $countSql = "SELECT COUNT(*) as total
               FROM (
                   SELECT o.id
                   FROM orders o
                   LEFT JOIN customers c ON c.id = o.customer_id
                   LEFT JOIN order_slips os ON os.order_id = o.id
                   WHERE {$whereClause}
                   GROUP BY o.id";
  
  // Only add HAVING clause if amount column exists
  if ($check_amount_col > 0) {
    $countSql .= " HAVING COALESCE(SUM(os.amount), 0) < COALESCE(o.total_amount, 0) OR SUM(os.amount) IS NULL";
  }
  
  $countSql .= ") as grouped_orders";

  $countStmt = $conn->prepare($countSql);
  $countStmt->execute($allParams);
  $totalCount = $countStmt->fetch()["total"];

  // Calculate pagination
  $maxPage = ceil($totalCount / $pageSize);
  $offset = ($page - 1) * $pageSize;

  // Main query to fetch transfer orders with customer data and payment status (with pagination)
  // Filter out orders that are already fully paid based on slip totals
  $sql = "SELECT
                o.id,
                o.order_date,
                o.delivery_date,
                o.total_amount,
                c.first_name,
                c.last_name,
                c.phone";
  
  // Add slip_total calculation based on column existence
  if ($check_amount_col > 0) {
    $sql .= ",
                COALESCE(SUM(os.amount), 0) as slip_total,
                CASE
                    WHEN COALESCE(SUM(os.amount), 0) >= COALESCE(o.total_amount, 0) THEN 'จ่ายแล้ว'
                    WHEN COALESCE(SUM(os.amount), 0) > 0 THEN 'จ่ายยังไม่ครบ'
                    ELSE 'ค้างจ่าย'
                END as payment_status";
  } else {
    // Column doesn't exist, show all as unpaid
    $sql .= ",
                0 as slip_total,
                'ค้างจ่าย' as payment_status";
  }
  
  $sql .= "
            FROM orders o
            LEFT JOIN customers c ON c.id = o.customer_id
            LEFT JOIN order_slips os ON os.order_id = o.id
            WHERE {$whereClause}
            GROUP BY o.id, o.order_date, o.delivery_date, o.total_amount, c.first_name, c.last_name, c.phone";
  
  // Only add HAVING clause if amount column exists
  if ($check_amount_col > 0) {
    $sql .= " HAVING COALESCE(SUM(os.amount), 0) < COALESCE(o.total_amount, 0) OR SUM(os.amount) IS NULL";
  }
  
  $sql .= " ORDER BY o.order_date DESC LIMIT ? OFFSET ?";

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
      "slip_total" => (float) ($row["slip_total"] ?? 0),
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
