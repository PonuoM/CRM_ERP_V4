<?php
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
  http_response_code(204);
  exit();
}

require_once "../config.php";

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
      o.payment_method
    FROM statement_logs sl
    INNER JOIN statement_batchs sb ON sl.batch_id = sb.id
    LEFT JOIN statement_reconcile_logs srl ON sl.id = srl.statement_log_id
    LEFT JOIN orders o ON srl.order_id = o.id
    WHERE sb.company_id = :companyId
      AND sl.bank_account_id = :bankAccountId
      AND sl.transfer_at BETWEEN :startDate AND :endDate
    ORDER BY sl.transfer_at DESC
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
    
    if ($row['order_id']) {
        $stmtAmt = (float)$row['statement_amount'];
        $orderAmt = (float)$row['order_amount'];
        // Use confirmed_amount if available (reconciled amount), otherwise statement amount
        // But usually audit compares Statement vs Order
        
        $diff = $stmtAmt - $orderAmt;
        
        if (abs($diff) < 0.01) {
            $status = 'Exact'; // พอดี
        } elseif ($diff > 0) {
            $status = 'Over'; // เกิน
        } else {
            $status = 'Short'; // ขาด
        }
    }
    
    $results[] = [
        'id' => $row['id'],
        'transfer_at' => $row['transfer_at'],
        'statement_amount' => $row['statement_amount'],
        'channel' => $row['channel'],
        'description' => $row['description'],
        'order_id' => $row['order_id'],
        'order_amount' => $row['order_amount'],
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
