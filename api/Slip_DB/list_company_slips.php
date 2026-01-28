<?php
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

mb_internal_encoding("UTF-8");
mb_http_output("UTF-8");

require_once __DIR__ . "/../config.php";

$company_id = 0;
// Connect to DB first for authentication
$conn = db_connect();

// Authenticate
$user = get_authenticated_user($conn);
if (!$user) {
  echo json_encode(['success' => false, 'message' => 'Unauthorized']);
  exit();
}

$company_id = $user['company_id'];
$user_id = $user['id'];
$user_role = $user['role'];
$user_team_id = $user['team_id'] ?? null;

$search = isset($_GET["search"]) ? trim($_GET["search"]) : "";
$status = isset($_GET["status"]) ? strtolower(trim($_GET["status"])) : "all";
$date_range = isset($_GET["date_range"]) ? strtolower(trim($_GET["date_range"])) : "all";
$date_from = isset($_GET["date_from"]) ? trim($_GET["date_from"]) : "";
$date_to = isset($_GET["date_to"]) ? trim($_GET["date_to"]) : "";
$payment_method = isset($_GET["payment_method"]) ? trim($_GET["payment_method"]) : "all";
$bank_account_id = isset($_GET["bank_account_id"]) ? trim($_GET["bank_account_id"]) : "all";
$min_amount = isset($_GET["min_amount"]) && $_GET["min_amount"] !== "" ? (float) $_GET["min_amount"] : null;
$max_amount = isset($_GET["max_amount"]) && $_GET["max_amount"] !== "" ? (float) $_GET["max_amount"] : null;
$exclude_reconciled = isset($_GET["exclude_reconciled"]) && $_GET["exclude_reconciled"] === 'true';

$page = isset($_GET["page"]) ? (int) $_GET["page"] : 1;
$pageSize = isset($_GET["pageSize"]) ? (int) $_GET["pageSize"] : 20;
if ($page < 1)
  $page = 1;
if ($pageSize < 1)
  $pageSize = 20;
if ($pageSize > 100)
  $pageSize = 100;

if ($company_id <= 0) {
  echo json_encode([
    "success" => false,
    "message" => "Company ID is required",
  ]);
  exit();
}

$conditions = ["o.company_id = ?"]; // Removed Unpaid restriction
$params = [$company_id];

if ($search !== "") {
  $like = "%" . $search . "%";
  $conditions[] =
    "(os.order_id LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ? OR c.phone LIKE ?)";
  $params[] = $like;
  $params[] = $like;
  $params[] = $like;
  $params[] = $like;
}

$allowedStatuses = ["pending", "verified", "rejected"];
// Status expression logic remains same
$statusExpr = "LOWER(
  CASE
    WHEN LOWER(o.payment_status) IN ('paid','verified','complete','completed') THEN 'verified'
    WHEN LOWER(o.payment_status) IN ('rejected','cancelled','void','refunded') THEN 'rejected'
    ELSE 'pending'
  END
)";

if (in_array($status, $allowedStatuses, true)) {
  $conditions[] = "$statusExpr = ?";
  $params[] = $status;
}

if ($date_range === "today") {
  $conditions[] = "DATE(os.created_at) = CURDATE()";
} elseif ($date_range === "week") {
  $conditions[] = "os.created_at >= (NOW() - INTERVAL 7 DAY)";
} elseif ($date_range === "month") {
  $conditions[] = "os.created_at >= (NOW() - INTERVAL 30 DAY)";
}

if ($date_from !== "") {
  $conditions[] = "DATE(os.created_at) >= ?";
  $params[] = $date_from;
}
if ($date_to !== "") {
  $conditions[] = "DATE(os.created_at) <= ?";
  $params[] = $date_to;
}

if ($payment_method !== "all" && $payment_method !== "") {
  $conditions[] = "o.payment_method = ?";
  $params[] = $payment_method;
}

if ($bank_account_id !== "all" && $bank_account_id !== "") {
  $conditions[] = "os.bank_account_id = ?";
  $params[] = $bank_account_id;
}

if ($min_amount !== null) {
  $conditions[] = "o.total_amount >= ?";
  $params[] = $min_amount;
}

if ($max_amount !== null) {
  $conditions[] = "o.total_amount <= ?";
  $params[] = $max_amount;
}

// 0. Check for statement_reconcile_logs table existence
$hasReconcileTable = false;
try {
  $stmt = $conn->query("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'statement_reconcile_logs'");
  $hasReconcileTable = ((int) $stmt->fetchColumn()) > 0;
} catch (Exception $e) {
  $hasReconcileTable = false;
}

$reconcileJoin = "";
if ($hasReconcileTable) {
  $reconcileJoin = "LEFT JOIN (
        SELECT order_id, SUM(COALESCE(confirmed_amount, statement_amount)) as reconciled_total
        FROM statement_reconcile_logs
        GROUP BY order_id
    ) recl ON recl.order_id = o.id";
}

if ($exclude_reconciled && $hasReconcileTable) {
  // Filter out orders where Reconciled >= Total Amount
  // Using a small epsilon for float comparison
  $conditions[] = "(o.total_amount - COALESCE(recl.reconciled_total, 0)) > 1.00";
  // Using 1.00 as buffer or 0.01? 
  // If order is 100, reconciled is 100. -> 0 > 1.00 FALSE -> Excluded. Correct.
  // If order is regular partially paid, e.g. 2000, paid 1000. -> 1000 > 1.00 TRUE -> Included. Correct.
  // Why 1.00? Sometimes there are small adjustments. 0.01 is stricter. Let's use 0.50 to be safe from rounding?
  // User usually pays exact or close. Let's use 0.01 for strictness first or just > 0.
  // Let's use > 0.1 to avoid floating point dust.
}

try {
  $uploadsDir = realpath(__DIR__ . "/../uploads/slips");

  // Add role-based order visibility filtering
  if ($user_role === "Admin Page") {
    $conditions[] = "o.creator_id = ?";
    $params[] = $user_id;
  } elseif ($user_role === "Telesale") {
    $conditions[] = "o.creator_id = ?";
    $params[] = $user_id;
  } elseif ($user_role === "Supervisor Telesale") {
    if ($user_team_id !== null) {
      $teamStmt = $conn->prepare("SELECT id FROM users WHERE team_id = ? AND role = 'Telesale'");
      $teamStmt->execute([$user_team_id]);
      $teamMemberIds = $teamStmt->fetchAll(PDO::FETCH_COLUMN);
      $teamMemberIds[] = $user_id;

      if (!empty($teamMemberIds)) {
        $placeholders = implode(",", array_fill(0, count($teamMemberIds), "?"));
        $conditions[] = "o.creator_id IN ({$placeholders})";
        $params = array_merge($params, $teamMemberIds);
      } else {
        $conditions[] = "o.creator_id = ?";
        $params[] = $user_id;
      }
    } else {
      $conditions[] = "o.creator_id = ?";
      $params[] = $user_id;
    }
  }

  $whereClause = implode(" AND ", $conditions);

  // Determine correct primary key column for customers (id vs customer_id)
  $customerPkColumn = "id";
  try {
    $stmt = $conn->query(
      "SELECT COLUMN_NAME FROM information_schema.columns 
       WHERE table_schema = DATABASE() 
         AND table_name = 'customers' 
         AND COLUMN_NAME IN ('id','customer_id')
       ORDER BY FIELD(COLUMN_NAME, 'id','customer_id')
       LIMIT 1",
    );
    $col = $stmt ? $stmt->fetchColumn() : false;
    if ($col) {
      $customerPkColumn = $col;
    }
  } catch (Exception $ignored) {
    $customerPkColumn = "id";
  }
  $customerJoin = "LEFT JOIN customers c ON c.$customerPkColumn = o.customer_id";

  // 1. Get Total Count first
  $countParams = $params; // Copy params for count query
  $countSql = "SELECT COUNT(*) as total 
               FROM order_slips os
               INNER JOIN orders o ON o.id = os.order_id
               $customerJoin
               LEFT JOIN users u ON u.id = o.creator_id
               $reconcileJoin
               WHERE $whereClause";

  // Special check for customer join if we need it for filtering (already included in countSql above)

  $countStmt = $conn->prepare($countSql);
  $countStmt->execute($countParams);
  $totalRecords = (int) $countStmt->fetch(PDO::FETCH_ASSOC)['total'];
  $totalPages = ceil($totalRecords / $pageSize);

  // 2. Prepare Data Query
  $hasBankAccountTable = false;
  try {
    $stmt = $conn->query(
      "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'bank_account'",
    );
    $hasBankAccountTable = ((int) $stmt->fetchColumn()) > 0;
  } catch (Exception $ignored) {
    $hasBankAccountTable = false;
  }

  $hasBankAccountIdColumn = false;
  try {
    $stmt = $conn->query(
      "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'order_slips' AND column_name = 'bank_account_id'",
    );
    $hasBankAccountIdColumn = ((int) $stmt->fetchColumn()) > 0;
  } catch (Exception $ignored) {
    $hasBankAccountIdColumn = false;
  }

  $hasTransferDateColumn = false;
  try {
    $stmt = $conn->query(
      "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'order_slips' AND column_name = 'transfer_date'",
    );
    $hasTransferDateColumn = ((int) $stmt->fetchColumn()) > 0;
  } catch (Exception $ignored) {
    $hasTransferDateColumn = false;
  }

  $bankDataAvailable = $hasBankAccountTable && $hasBankAccountIdColumn;

  $bankSelect = $bankDataAvailable
    ? "ba.bank AS bank_name,
        ba.bank_number,"
    : "NULL AS bank_name,
        NULL AS bank_number,";
  $bankJoin = $bankDataAvailable
    ? "LEFT JOIN bank_account ba ON ba.id = os.bank_account_id"
    : "";
  $bankAccountIdSelect = $hasBankAccountIdColumn
    ? "os.bank_account_id"
    : "NULL";
  $transferDateSelect = $hasTransferDateColumn
    ? "os.transfer_date"
    : "NULL";
  $hasUpdatedAtColumn = false;
  try {
    $stmt = $conn->query(
      "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'order_slips' AND column_name = 'updated_at'",
    );
    $hasUpdatedAtColumn = ((int) $stmt->fetchColumn()) > 0;
  } catch (Exception $ignored) {
    $hasUpdatedAtColumn = false;
  }
  $updatedAtSelect = $hasUpdatedAtColumn ? "os.updated_at" : "os.created_at";

  $hasAmountColumn = false;
  try {
    $stmt = $conn->query(
      "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'order_slips' AND column_name = 'amount'",
    );
    $hasAmountColumn = ((int) $stmt->fetchColumn()) > 0;
  } catch (Exception $ignored) {
    $hasAmountColumn = false;
  }
  $amountSelect = $hasAmountColumn ? "os.amount" : "NULL";

  $offset = ($page - 1) * $pageSize;

  $sql =
    "SELECT
        os.id,
        os.order_id,
        $amountSelect AS amount,
        $bankAccountIdSelect AS bank_account_id,
        $transferDateSelect AS transfer_date,
        os.url,
        os.created_at,
        $updatedAtSelect AS updated_at,
        o.total_amount,
        o.payment_status,
        o.payment_method,
        o.order_status,
        o.order_date,
        o.delivery_date,
        c.first_name,
        c.last_name,
        c.phone,
        c.email,
        u.first_name AS creator_first_name,
        u.last_name AS creator_last_name,
        $bankSelect
        $statusExpr AS slip_status
      FROM order_slips os
      INNER JOIN orders o ON o.id = os.order_id
      $customerJoin
      LEFT JOIN users u ON u.id = o.creator_id
      $bankJoin
      $reconcileJoin
      WHERE $whereClause
      ORDER BY os.created_at DESC
      LIMIT ? OFFSET ?";

  $params[] = $pageSize;
  $params[] = $offset;

  $stmt = $conn->prepare($sql);
  $stmt->execute($params);

  $rows = [];
  while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $customerName = trim(
      ($row["first_name"] ?? "") . " " . ($row["last_name"] ?? ""),
    );
    $uploadedBy = trim(
      ($row["creator_first_name"] ?? "") .
      " " .
      ($row["creator_last_name"] ?? ""),
    );
    $fileName = null;
    if (!empty($row["url"])) {
      $parsedPath = parse_url($row["url"], PHP_URL_PATH);
      $fileName = $parsedPath ? basename($parsedPath) : basename($row["url"]);
    }

    $rawUrl = $row["url"] ?? "";
    $normalizedUrl = null;
    $fileExists = false;

    if (is_string($rawUrl) && strlen($rawUrl) > 0) {
      if (preg_match('/^https?:\\/\\//i', $rawUrl)) {
        $normalizedUrl = $rawUrl;
        $fileExists = true;
      } else {
        $pathPart = "/" . ltrim(str_replace("\\", "/", $rawUrl), "/");
        if (
          preg_match('#(?:/api)?/uploads/slips/([^/?]+)$#i', $pathPart, $match) &&
          $uploadsDir
        ) {
          $localName = $match[1];
          $candidate = realpath(
            $uploadsDir . DIRECTORY_SEPARATOR . $localName,
          );
          if (
            $candidate &&
            strpos($candidate, $uploadsDir) === 0 &&
            is_file($candidate)
          ) {
            $normalizedUrl = "api/uploads/slips/" . $localName;
            $fileExists = true;
          }
        }
      }
    }

    $amountValue = null;
    if (isset($row["amount"]) && $row["amount"] !== null && $row["amount"] !== "") {
      $amountValue = (float) $row["amount"];
    } elseif (isset($row["total_amount"]) && $row["total_amount"] !== null) {
      $amountValue = (float) $row["total_amount"];
    }

    $rows[] = [
      "id" => (int) $row["id"],
      "order_id" => (string) $row["order_id"],
      "amount" => $amountValue,
      "order_total" => isset($row["total_amount"])
        ? (float) $row["total_amount"]
        : null,
      "transfer_date" => $row["transfer_date"],
      "url" => $normalizedUrl,
      "uploaded_at" => $row["created_at"],
      "updated_at" => $row["updated_at"],
      "status" => $row["slip_status"],
      "uploaded_by" => $uploadedBy !== "" ? $uploadedBy : null,
      "customer_name" => $customerName !== "" ? $customerName : null,
      "customer_phone" => $row["phone"],
      "customer_email" => $row["email"],
      "bank_name" => $row["bank_name"],
      "bank_number" => $row["bank_number"],
      "file_name" => $fileName,
      "file_exists" => $fileExists,
      "original_url" => $rawUrl,
      "payment_method" => $row["payment_method"],
    ];
  }

  echo json_encode(
    [
      "success" => true,
      "data" => $rows,
      "pagination" => [
        "total" => $totalRecords,
        "page" => $page,
        "pageSize" => $pageSize,
        "totalPages" => $totalPages
      ]
    ],
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
  );
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(
    [
      "success" => false,
      "message" => $e->getMessage(),
    ],
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
  );
}
