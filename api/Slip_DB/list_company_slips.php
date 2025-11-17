<?php
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

mb_internal_encoding("UTF-8");
mb_http_output("UTF-8");

require_once __DIR__ . "/../config.php";

$company_id = isset($_GET["company_id"]) ? (int) $_GET["company_id"] : 0;
$search = isset($_GET["search"]) ? trim($_GET["search"]) : "";
$status = isset($_GET["status"]) ? strtolower(trim($_GET["status"])) : "all";
$date_range = isset($_GET["date_range"]) ? strtolower(trim($_GET["date_range"])) : "all";
$date_from = isset($_GET["date_from"]) ? trim($_GET["date_from"]) : "";
$date_to = isset($_GET["date_to"]) ? trim($_GET["date_to"]) : "";

if ($company_id <= 0) {
  echo json_encode([
    "success" => false,
    "message" => "Company ID is required",
  ]);
  exit();
}

$conditions = ["o.company_id = ?"];
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

$whereClause = implode(" AND ", $conditions);

try {
  $conn = db_connect();
  $conn->exec("SET NAMES utf8mb4");
  $conn->exec("SET CHARACTER SET utf8mb4");
  $uploadsDir = realpath(__DIR__ . "/../uploads/slips");

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
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN users u ON u.id = o.creator_id
      $bankJoin
      WHERE $whereClause
      ORDER BY os.created_at DESC";

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

    $rows[] = [
      "id" => (int) $row["id"],
      "order_id" => (string) $row["order_id"],
      "amount" => isset($row["amount"]) ? (float) $row["amount"] : null,
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
    ];
  }

  echo json_encode(
    [
      "success" => true,
      "data" => $rows,
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
