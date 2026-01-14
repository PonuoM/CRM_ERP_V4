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
  
  // Check if auto-matching is requested
  $matchStatement = isset($input['matchStatement']) && $input['matchStatement'] === true;

  // Process Rows to calculate Status
  $results = [];
  
  // If matching is requested, fetch candidate orders first
  $candidateOrders = [];
  if ($matchStatement) {
      // Logic adapted from reconcile_list.php
      $rangeStart = date("Y-m-d H:i:s", strtotime($startDateRaw . " -1 day"));
      $rangeEnd = date("Y-m-d H:i:s", strtotime($endDateRaw . " +1 day"));
      
      $orderParams = [
          ':companyId' => $companyId,
          ':rangeStart' => $rangeStart,
          ':rangeEnd' => $rangeEnd,
          ':companyRecon' => $companyId
      ];
      
      $orderBankFilter = "";
      if ($bankAccountId > 0) {
          $orderBankFilter = " AND (o.bank_account_id = :obankId OR o.bank_account_id IS NULL)";
          $orderParams[":obankId"] = $bankAccountId;
      }

      $orderSql = "
        SELECT
          o.id,
          o.total_amount,
          o.amount_paid,
          COALESCE(r.reconciled_amount, 0) AS reconciled_amount,
          o.payment_method,
          o.transfer_date,
          o.bank_account_id,
          o.order_status,
          IFNULL(os.total_slip, 0) AS slip_total,
          os.slip_transfer_date,
          os.slip_bank_account_id,
          oss.slip_items
        FROM orders o
        LEFT JOIN (
          SELECT
            order_id,
            SUM(COALESCE(amount, 0)) AS total_slip,
            MAX(transfer_date) AS slip_transfer_date,
            MAX(bank_account_id) AS slip_bank_account_id
          FROM order_slips
          GROUP BY order_id
        ) os ON os.order_id = o.id
        LEFT JOIN (
          SELECT
            order_id,
            JSON_ARRAYAGG(
              JSON_OBJECT(
                'amount', amount,
                'transfer_date', transfer_date,
                'bank_account_id', bank_account_id
              )
            ) AS slip_items
          FROM order_slips
          GROUP BY order_id
        ) oss ON oss.order_id = o.id
        LEFT JOIN (
          SELECT
             srl.order_id,
             SUM(COALESCE(srl.confirmed_amount, 0)) AS reconciled_amount
          FROM statement_reconcile_logs srl
          INNER JOIN statement_reconcile_batches srb ON srb.id = srl.batch_id
          WHERE srb.company_id = :companyRecon
          GROUP BY srl.order_id
        ) r ON r.order_id = o.id
        WHERE o.company_id = :companyId
          {$orderBankFilter}
          AND (o.payment_method = 'Transfer' OR os.total_slip > 0)
          AND o.order_status NOT IN ('Cancelled', 'Returned')
          AND (
            o.transfer_date BETWEEN :rangeStart AND :rangeEnd
            OR o.transfer_date IS NULL
          )
          AND (
            COALESCE(r.reconciled_amount, 0) < o.total_amount - 0.009
          )
      ";
      
      $ordersStmt = $pdo->prepare($orderSql);
      $ordersStmt->execute($orderParams);
      while ($orow = $ordersStmt->fetch(PDO::FETCH_ASSOC)) {
          $candidateOrders[] = $orow;
      }
  }

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
        $orderDisplay = $orderDisplay . '-' . $orderMatchNo;
    }
    
    // Auto-match logic if Unmatched
    $suggestedOrderId = null;
    $suggestedOrderInfo = null;
    $suggestedOrderAmount = null;
    $suggestedPaymentMethod = null;
    
    if ($matchStatement && $status === 'Unmatched') {
        $stmtAmount = (float)$row['statement_amount'];
        $stmtDate = $row['transfer_at'];
        
        foreach ($candidateOrders as $ord) {
            $matchFound = false;
            // ... (matching logic remains the same) ...
            
            // 1. Check Slips
            if (!empty($ord['slip_items'])) {
                $slips = json_decode($ord['slip_items'], true);
                if (is_array($slips)) {
                    foreach ($slips as $slip) {
                        $slipAmount = (float)$slip['amount'];
                        $slipDate = $slip['transfer_date'];
                        $slipBankId = isset($slip['bank_account_id']) ? (int)$slip['bank_account_id'] : null;
                        
                        // Exact Amount
                        if (abs($slipAmount - $stmtAmount) > 0.01) continue;
                        
                        // Bank Match (if slip has bank)
                        if ($slipBankId && $slipBankId !== $bankAccountId) continue;
                        
                        // Time Match (within 60s)
                        if ($slipDate) {
                            $timeDiff = abs(strtotime($stmtDate) - strtotime($slipDate));
                            if ($timeDiff <= 60) {
                                $matchFound = true;
                                break;
                            }
                        }
                    }
                }
            }
            
            // 2. Check Main Order (if no slip match found yet)
            if (!$matchFound) {
                 $payAmount = (float)$ord['amount_paid'];
                 $slipTotal = (float)$ord['slip_total'];
                 $totalAmount = (float)$ord['total_amount'];
                 
                 // Determine which amount to match against
                 $targetAmount = ($slipTotal > 0) ? $slipTotal : (($payAmount > 0) ? $payAmount : $totalAmount);
                 
                 if (abs($targetAmount - $stmtAmount) <= 0.01) {
                     // Check Bank
                     $ordBankId = $ord['bank_account_id'] ?? $ord['slip_bank_account_id'];
                     if (!$ordBankId || (int)$ordBankId === $bankAccountId) {
                         // Check Time
                         $ordDate = $ord['slip_transfer_date'] ?? $ord['transfer_date'];
                         if ($ordDate) {
                             $timeDiff = abs(strtotime($stmtDate) - strtotime($ordDate));
                             if ($timeDiff <= 60) {
                                 $matchFound = true;
                             }
                         }
                     }
                 }
            }
            
            if ($matchFound) {
                $suggestedOrderId = $ord['id'];
                $suggestedOrderInfo = "Found matching amount " . number_format($stmtAmount, 2) . " and time";
                $suggestedOrderAmount = (float)$stmtAmount; // Since we matched on exact amount, this is safe
                $suggestedPaymentMethod = $ord['payment_method'];
                break; 
            }
        }
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
        'order_amount' => in_array($reconcileType, ['Suspense', 'Deposit']) ? null : ($row['confirmed_amount'] !== null ? $row['confirmed_amount'] : $row['order_amount']),
        'payment_method' => $row['payment_method'],
        'status' => $status,
        'diff' => $diff,
        'suggested_order_id' => $suggestedOrderId,
        'suggested_order_info' => $suggestedOrderInfo,
        'suggested_order_amount' => $suggestedOrderAmount,
        'suggested_payment_method' => $suggestedPaymentMethod
    ];
  }
  
  echo json_encode(['ok' => true, 'data' => $results], JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
?>
