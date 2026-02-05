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

  // Query: Statement Logs LEFT JOIN Reconcile Logs LEFT JOIN Orders LEFT JOIN COD Documents
  $sql = "
    SELECT 
      sl.id,
      sl.transfer_at,
      sl.amount as statement_amount,
      sl.channel,
      sl.description,
      -- COD document info (if this statement was matched to a COD document)
      cd.id as cod_document_id,
      cd.document_number as cod_document_number,
      cd.total_input_amount as cod_total_amount,
      cd.status as cod_status,
      -- Aggregate reconcile logs
      JSON_ARRAYAGG(
         IF(srl.id IS NOT NULL, 
            JSON_OBJECT(
              'reconcile_id', srl.id,
              'order_id', srl.order_id,
              'confirmed_amount', srl.confirmed_amount,
              'confirmed_at', srl.confirmed_at,
              'confirmed_action', srl.confirmed_action,
              'reconcile_type', srl.reconcile_type,
              'note', srl.note,
              'confirmed_payment_method', srl.confirmed_payment_method
            ),
            NULL
         )
      ) as reconcile_items
    FROM statement_logs sl
    INNER JOIN statement_batchs sb ON sl.batch_id = sb.id
    LEFT JOIN statement_reconcile_logs srl ON sl.id = srl.statement_log_id
    LEFT JOIN cod_documents cd ON cd.matched_statement_log_id = sl.id
    WHERE sb.company_id = :companyId
      AND sl.bank_account_id = :bankAccountId
      AND sl.transfer_at BETWEEN :startDate AND :endDate
    GROUP BY sl.id, cd.id, cd.document_number, cd.total_input_amount, cd.status
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
          AND (o.payment_method IN ('Transfer', 'COD', 'PayAfter') OR os.total_slip > 0)
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

    // Parse aggregated items
    $reconcileItems = [];
    $rawItems = json_decode($row['reconcile_items'], true);
    if (is_array($rawItems)) {
      // filter nulls (if left join matched nothing, json_arrayagg might contain [null] or null)
      foreach ($rawItems as $itm) {
        if ($itm !== null)
          $reconcileItems[] = $itm;
      }
    }

    $totalConfirmed = 0.0;
    $orderIds = [];
    $reconcileTypes = [];
    $notes = [];
    $confirmedAts = [];
    $confirmedActions = [];

    foreach ($reconcileItems as $item) {
      $amt = (float) ($item['confirmed_amount'] ?? 0);
      $totalConfirmed += $amt;

      if (!empty($item['order_id'])) {
        $orderIds[] = $item['order_id'];
      }
      if (!empty($item['reconcile_type'])) {
        $reconcileTypes[] = $item['reconcile_type'];
      }
      if (!empty($item['note'])) {
        $notes[] = $item['note'];
      }
      if (!empty($item['confirmed_at'])) {
        $confirmedAts[] = $item['confirmed_at'];
      }
      if (!empty($item['confirmed_action'])) {
        $confirmedActions[] = $item['confirmed_action'];
      }
    }

    // Deduplicate types
    $reconcileTypes = array_unique($reconcileTypes);

    $primaryType = 'Unmatched';
    // For COD documents without reconcile logs, use cod_total_amount for comparison
    $isCodDocument = !empty($row['cod_document_id']);
    $codTotalAmountForCalc = !empty($row['cod_total_amount']) ? (float) $row['cod_total_amount'] : 0;
    
    if (count($reconcileItems) > 0) {
      if (in_array('Suspense', $reconcileTypes)) {
        $primaryType = 'Suspense';
        $status = 'Suspense';
      } elseif (in_array('Deposit', $reconcileTypes)) {
        $primaryType = 'Deposit';
        $status = 'Deposit';
      } else {
        $primaryType = 'Order';
        // Check Amount Logic
        $stmtAmt = (float) $row['statement_amount'];
        
        // For COD documents, use cod_total_amount for accurate comparison
        // This accounts for forced records that may not be in reconcile logs
        $compareAmount = $totalConfirmed;
        if ($isCodDocument && $codTotalAmountForCalc > 0) {
          $compareAmount = $codTotalAmountForCalc;
        }
        
        $diff = $stmtAmt - $compareAmount;

        if (abs($diff) < 0.01) {
          $status = 'Exact';
        } elseif ($diff > 0) {
          $status = 'Over';
        } else {
          $status = 'Short';
        }
      }
    } elseif ($isCodDocument && $codTotalAmountForCalc > 0) {
      // COD document matched but no reconcile logs yet - use cod_total_amount for status
      $primaryType = 'Order';
      $stmtAmt = (float) $row['statement_amount'];
      $diff = $stmtAmt - $codTotalAmountForCalc;
      
      if (abs($diff) < 0.01) {
        $status = 'Exact';
      } elseif ($diff > 0) {
        $status = 'Over';
      } else {
        $status = 'Short';
      }
    }

    $orderDisplay = empty($orderIds) ? null : implode(', ', array_unique($orderIds));

    // Auto-match logic if Unmatched
    $suggestedOrderId = null;
    $suggestedOrderInfo = null;
    $suggestedOrderAmount = null;
    $suggestedPaymentMethod = null;

    if ($matchStatement && $status === 'Unmatched') {
      // ... existing match logic ...
      $stmtAmount = (float) $row['statement_amount'];
      $stmtDate = $row['transfer_at'];

      foreach ($candidateOrders as $ord) {
        $matchFound = false;
        // 1. Check Slips
        if (!empty($ord['slip_items'])) {
          $slips = json_decode($ord['slip_items'], true);
          if (is_array($slips)) {
            foreach ($slips as $slip) {
              $slipAmount = (float) $slip['amount'];
              $slipDate = $slip['transfer_date'];
              $slipBankId = isset($slip['bank_account_id']) ? (int) $slip['bank_account_id'] : null;

              // Exact Amount
              if (abs($slipAmount - $stmtAmount) > 0.01)
                continue;

              // Bank Match (if slip has bank)
              if ($slipBankId && $slipBankId !== $bankAccountId)
                continue;

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
          $payAmount = (float) $ord['amount_paid'];
          $slipTotal = (float) $ord['slip_total'];
          $totalAmount = (float) $ord['total_amount'];

          // Determine which amount to match against
          $targetAmount = ($slipTotal > 0) ? $slipTotal : (($payAmount > 0) ? $payAmount : $totalAmount);

          if (abs($targetAmount - $stmtAmount) <= 0.01) {
            // Check Bank
            $ordBankId = $ord['bank_account_id'] ?? $ord['slip_bank_account_id'];
            if (!$ordBankId || (int) $ordBankId === $bankAccountId) {
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
          $suggestedOrderAmount = (float) $stmtAmount;
          $suggestedPaymentMethod = $ord['payment_method'];
          break;
        }
      }
    }

    // Determine payment method from reconcile items (especially for COD)
    $paymentMethods = [];
    foreach ($reconcileItems as $item) {
      if (!empty($item['confirmed_payment_method'])) {
        $paymentMethods[] = $item['confirmed_payment_method'];
      }
    }
    $paymentMethods = array_unique($paymentMethods);
    $derivedPaymentMethod = !empty($paymentMethods) ? implode(', ', $paymentMethods) : null;

    // For COD documents, use document_number as display instead of order_id
    $isCodDocument = !empty($row['cod_document_id']);
    $displayOrderId = $isCodDocument ? $row['cod_document_number'] : $orderDisplay;

    // For COD documents, use cod_total_amount if no reconcile logs yet
    $codTotalAmount = !empty($row['cod_total_amount']) ? (float) $row['cod_total_amount'] : null;
    $displayOrderAmount = null;
    if (!in_array($primaryType, ['Suspense', 'Deposit'])) {
      // For COD documents, always use cod_total_amount (includes forced records)
      if ($isCodDocument && $codTotalAmount !== null) {
        $displayOrderAmount = $codTotalAmount;
      } elseif ($totalConfirmed > 0) {
        $displayOrderAmount = $totalConfirmed;
      }
    }

    $results[] = [
      'id' => $row['id'],
      'reconcile_id' => !empty($reconcileItems) ? $reconcileItems[0]['reconcile_id'] : null, // Just use first for now or null
      'confirmed_at' => !empty($confirmedAts) ? $confirmedAts[0] : null,
      'confirmed_action' => !empty($confirmedActions) ? implode(', ', array_unique($confirmedActions)) : null,
      'reconcile_type' => $primaryType,
      'note' => !empty($notes) ? implode(', ', array_unique($notes)) : null,
      'transfer_at' => $row['transfer_at'],
      'statement_amount' => $row['statement_amount'],
      'channel' => $row['channel'],
      'description' => $row['description'],
      'order_id' => !empty($orderIds) ? implode(',', array_unique($orderIds)) : null, // Return as CSV for raw
      'order_display' => $displayOrderId,
      'order_amount' => $displayOrderAmount,
      'payment_method' => $derivedPaymentMethod,
      'status' => $status,
      'diff' => $diff,
      'suggested_order_id' => $suggestedOrderId,
      'suggested_order_info' => $suggestedOrderInfo,
      'suggested_order_amount' => $suggestedOrderAmount,
      'suggested_payment_method' => $suggestedPaymentMethod,
      'reconcile_items' => $reconcileItems, // Pass full details if frontend wants to show breakdown
      // COD document info
      'cod_document_id' => $row['cod_document_id'] ?? null,
      'cod_document_number' => $row['cod_document_number'] ?? null,
      'cod_total_amount' => $codTotalAmount,
      'cod_status' => $row['cod_status'] ?? null,
      'is_cod_document' => $isCodDocument,
    ];
  }

  echo json_encode(['ok' => true, 'data' => $results], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
?>