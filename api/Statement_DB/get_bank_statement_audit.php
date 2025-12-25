<?php
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
  http_response_code(204);
  exit();
}

// Use API config (same file already loaded by index.php; require_once keeps it safe)
require_once __DIR__ . "/../config.php";

try {
  $input = json_decode(file_get_contents("php://input"), true);
  
  // Validate Inputs
  $companyId = isset($input["company_id"]) ? (int) $input["company_id"] : 0;
  $bankAccountId = isset($input["bank_account_id"]) ? (int) $input["bank_account_id"] : 0;
  $startDateRaw = $input["start_date"] ?? null;
  $endDateRaw = $input["end_date"] ?? null;
  
  if ($companyId <= 0 || $bankAccountId <= 0 || !$startDateRaw || !$endDateRaw) {
    echo json_encode(['ok' => false, 'error' => 'Missing required fields'], JSON_UNESCAPED_UNICODE);
    exit();
  }
  
  $pdo = db_connect();
  
  // Format dates
  $startDate = date("Y-m-d 00:00:00", strtotime($startDateRaw));
  $endDate = date("Y-m-d 23:59:59", strtotime($endDateRaw));
  
  // Query: Statement Logs LEFT JOIN Reconcile Logs LEFT JOIN Orders
  $sql = "
    SELECT 
      sl.id,
      sl.transfer_at,
      sl.amount as statement_amount,
      sl.channel,
      sl.description,
      srl.order_id,
      srl.confirmed_amount,
      o.total_amount as order_amount,
      o.payment_method,
      srl.id as reconcile_id,
      srl.confirmed_at,
      srl.confirmed_action,
      srl.reconcile_type,
      srl.note,
      -- Use row_number to disambiguate multiple matches for the same order (box-level)
      ROW_NUMBER() OVER (PARTITION BY srl.order_id ORDER BY sl.transfer_at, sl.id) AS order_match_no
    FROM statement_logs sl
    INNER JOIN statement_batchs sb ON sl.batch_id = sb.id
    LEFT JOIN statement_reconcile_logs srl ON sl.id = srl.statement_log_id
    LEFT JOIN orders o ON srl.order_id = o.id
    WHERE sb.company_id = :companyId
      AND sl.bank_account_id = :bankAccountId
      AND sl.transfer_at BETWEEN :startDate AND :endDate
    ORDER BY sl.transfer_at ASC
  ";
  
  $stmt = $pdo->prepare($sql);
  $stmt->execute([
    ':companyId' => $companyId,
    ':bankAccountId' => $bankAccountId,
    ':startDate' => $startDate,
    ':endDate' => $endDate
  ]);
  
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
  
  // Process Rows to calculate Status
  $results = [];
  foreach ($rows as $row) {
    $status = 'Unmatched';
    $diff = 0;
    
    // Check reconcile_type first
    $reconcileType = $row['reconcile_type'] ?? null;

    if ($reconcileType === 'Suspense') {
        $status = 'Suspense';
    } elseif ($reconcileType === 'Deposit') {
        $status = 'Deposit';
    } elseif ($row['order_id']) {
        $stmtAmt = (float)$row['statement_amount'];
        // Prefer per-row confirmed amount to avoid using full order total
        $orderAmt = $row['confirmed_amount'] !== null
            ? (float)$row['confirmed_amount']
            : ($row['order_amount'] !== null ? (float)$row['order_amount'] : null);

        if ($orderAmt !== null) {
            $diff = $stmtAmt - $orderAmt;

            if (abs($diff) < 0.01) {
                $status = 'Exact'; // พอดี
            } elseif ($diff > 0) {
                $status = 'Over'; // เกิน
            } else {
                $status = 'Short'; // ขาด
            }
        }
    }
    
    $orderMatchNo = isset($row['order_match_no']) ? (int)$row['order_match_no'] : null;
    $orderDisplay = $row['order_id'] ?? null;
    if ($orderDisplay && $orderMatchNo && $orderMatchNo > 1) {
        // Append -N to indicate box-level match when there are multiple matches for the order
        $orderDisplay = $orderDisplay . '-' . $orderMatchNo;
    }

    $results[] = [
        'id' => $row['id'],
        'reconcile_id' => $row['reconcile_id'],
        'confirmed_at' => $row['confirmed_at'],
        'confirmed_action' => $row['confirmed_action'],
        'reconcile_type' => $reconcileType,
        'note' => $row['note'],
        'transfer_at' => $row['transfer_at'],
        'statement_amount' => $row['statement_amount'],
        'channel' => $row['channel'],
        'description' => $row['description'],
        'order_id' => $row['order_id'],
        'order_display' => $orderDisplay,
        // Show box-level confirmed amount when available; otherwise full order amount
        'order_amount' => $row['confirmed_amount'] !== null ? $row['confirmed_amount'] : $row['order_amount'],
        'payment_method' => $row['payment_method'],
        'status' => $status,
        'diff' => $diff
    ];
  }
  
  echo json_encode(['ok' => true, 'data' => $results], JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
?>
