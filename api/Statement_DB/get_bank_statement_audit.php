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

  if ($companyId <= 0 || !$startDateRaw || !$endDateRaw) {
    echo json_encode(['ok' => false, 'error' => 'Missing required fields'], JSON_UNESCAPED_UNICODE);
    exit();
  }

  $pdo = db_connect();

  // Format dates
  $startDate = date("Y-m-d 00:00:00", strtotime($startDateRaw));
  $endDate = date("Y-m-d 23:59:59", strtotime($endDateRaw));

  // Bank account filter (optional — 0 means all banks)
  $bankFilter = "";
  if ($bankAccountId > 0) {
    $bankFilter = "AND sl.bank_account_id = :bankAccountId";
  }

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
      -- Aggregate reconcile logs (with creator/confirmer names)
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
              'confirmed_payment_method', srl.confirmed_payment_method,
              'created_by', srl.created_by,
              'created_by_name', IFNULL(CONCAT(u_creator.first_name, ' ', u_creator.last_name), NULL),
              'confirmed_by', srl.confirmed_by,
              'confirmed_by_name', IFNULL(CONCAT(u_confirmer.first_name, ' ', u_confirmer.last_name), NULL)
            ),
            NULL
         )
      ) as reconcile_items
    FROM statement_logs sl
    INNER JOIN statement_batchs sb ON sl.batch_id = sb.id
    LEFT JOIN statement_reconcile_logs srl ON sl.id = srl.statement_log_id
    LEFT JOIN users u_creator ON u_creator.id = srl.created_by
    LEFT JOIN users u_confirmer ON u_confirmer.id = srl.confirmed_by
    LEFT JOIN cod_documents cd ON cd.matched_statement_log_id = sl.id
    WHERE sb.company_id = :companyId
      {$bankFilter}
      AND sl.transfer_at BETWEEN :startDate AND :endDate
    GROUP BY sl.id, cd.id, cd.document_number, cd.total_input_amount, cd.status
    ORDER BY sl.transfer_at ASC

  ";

  $stmt = $pdo->prepare($sql);
  $params = [
    ':companyId' => $companyId,
    ':startDate' => $startDate,
    ':endDate' => $endDate
  ];
  if ($bankAccountId > 0) {
    $params[':bankAccountId'] = $bankAccountId;
  }
  $stmt->execute($params);

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
      ':slipRangeStart' => $rangeStart,
      ':slipRangeEnd' => $rangeEnd,
      ':companyRecon' => $companyId
    ];

    $orderBankFilter = "";
    if ($bankAccountId > 0) {
      $orderBankFilter = " AND (o.bank_account_id = :obankId OR o.bank_account_id IS NULL OR os.slip_bank_account_id = :oSlipBankId)";
      $orderParams[":obankId"] = $bankAccountId;
      $orderParams[":oSlipBankId"] = $bankAccountId;
    }

    $orderSql = "
        SELECT
          o.id,
          o.total_amount,
          o.amount_paid,
          COALESCE(r.reconciled_amount, 0) AS reconciled_amount,
          COALESCE(r.reconciled_count, 0) AS reconciled_count,
          o.payment_method,
          o.transfer_date,
          o.bank_account_id,
          o.order_status,
          IFNULL(os.total_slip, 0) AS slip_total,
          IFNULL(os.slip_count, 0) AS slip_count,
          os.slip_transfer_date,
          os.slip_bank_account_id,
          oss.slip_items
        FROM orders o
        LEFT JOIN (
          SELECT
            order_id,
            SUM(COALESCE(amount, 0)) AS total_slip,
            COUNT(*) AS slip_count,
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
             SUM(COALESCE(srl.confirmed_amount, 0)) AS reconciled_amount,
             COUNT(*) AS reconciled_count
          FROM statement_reconcile_logs srl
          INNER JOIN statement_reconcile_batches srb ON srb.id = srl.batch_id
          WHERE srb.company_id = :companyRecon
          GROUP BY srl.order_id
        ) r ON r.order_id = o.id
        WHERE o.company_id = :companyId
          {$orderBankFilter}
          AND (o.payment_method IN ('Transfer', 'COD', 'PayAfter') OR os.total_slip > 0)
          AND os.order_id IS NOT NULL
          AND o.order_status NOT IN ('Cancelled', 'Returned')
          AND o.id NOT LIKE '%external' AND o.id NOT LIKE '%EXTERNAL'
          AND (
            o.transfer_date BETWEEN :rangeStart AND :rangeEnd
            OR o.transfer_date IS NULL
            OR os.slip_transfer_date BETWEEN :slipRangeStart AND :slipRangeEnd
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

  // Track which slips have already been suggested (to allow per-slip matching)
  // Key: "orderId:slipIndex" => true
  $usedSlips = [];

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
    $suggestedSlipCount = 0;
    $suggestedSlipIndex = 0;

    if ($matchStatement && $status === 'Unmatched') {
      $stmtAmount = (float) $row['statement_amount'];
      $stmtDate = $row['transfer_at'];

      foreach ($candidateOrders as $ord) {
        $matchFound = false;
        $matchedSlipIdx = null;
        // 1. Check individual Slips (per-slip matching)
        if (!empty($ord['slip_items'])) {
          $slips = json_decode($ord['slip_items'], true);
          if (is_array($slips)) {
            foreach ($slips as $slipIdx => $slip) {
              // Skip slips already suggested for another statement
              $slipKey = $ord['id'] . ':' . $slipIdx;
              if (isset($usedSlips[$slipKey])) continue;

              $slipAmount = (float) $slip['amount'];
              $slipDate = $slip['transfer_date'];
              $slipBankId = isset($slip['bank_account_id']) ? (int) $slip['bank_account_id'] : null;

              // Exact Amount
              if (abs($slipAmount - $stmtAmount) > 0.01)
                continue;

              // Bank Match (if slip has bank)
              if ($slipBankId && $slipBankId !== $bankAccountId)
                continue;

              // Time Match (within 15 min)
              if ($slipDate) {
                $timeDiff = abs(strtotime($stmtDate) - strtotime($slipDate));
                if ($timeDiff <= 900) {
                  $matchFound = true;
                  $matchedSlipIdx = $slipIdx;
                  break;
                }
              }
            }
          }
        }

        // 2. Check Main Order (if no slip match found and no slips were already used for this order)
        if (!$matchFound) {
          // Only use main-order fallback if no individual slips have been used yet for this order
          $orderUsedCount = 0;
          foreach ($usedSlips as $key => $v) {
            if (strpos($key, $ord['id'] . ':') === 0) $orderUsedCount++;
          }
          $slipCount = (int) ($ord['slip_count'] ?? 0);
          // If all slips are used, skip this order entirely
          if ($slipCount > 0 && $orderUsedCount >= $slipCount) continue;

          $payAmount = (float) $ord['amount_paid'];
          $slipTotal = (float) $ord['slip_total'];
          $totalAmount = (float) $ord['total_amount'];

          $targetAmount = ($slipTotal > 0) ? $slipTotal : (($payAmount > 0) ? $payAmount : $totalAmount);

          if (abs($targetAmount - $stmtAmount) <= 0.01) {
            $ordBankId = $ord['bank_account_id'] ?? $ord['slip_bank_account_id'];
            if (!$ordBankId || (int) $ordBankId === $bankAccountId) {
              $ordDate = $ord['slip_transfer_date'] ?? $ord['transfer_date'];
              if ($ordDate) {
                $timeDiff = abs(strtotime($stmtDate) - strtotime($ordDate));
                if ($timeDiff <= 900) {
                  $matchFound = true;
                }
              }
            }
          }
        }

        if ($matchFound) {
          $slipCount = (int) ($ord['slip_count'] ?? 0);
          $reconCount = (int) ($ord['reconciled_count'] ?? 0);
          // Count how many times this order has been suggested in this batch
          $suggestedCount = 0;
          foreach ($usedSlips as $key => $v) {
            if (strpos($key, $ord['id'] . ':') === 0) $suggestedCount++;
          }
          $currentSlipNum = $reconCount + $suggestedCount + 1;

          $suggestedOrderId = $ord['id'];
          $suggestedOrderInfo = $slipCount > 1
            ? "สลิป {$currentSlipNum}/{$slipCount} — ยอด " . number_format($stmtAmount, 2)
            : "ยอดตรงกัน " . number_format($stmtAmount, 2);
          $suggestedOrderAmount = (float) $stmtAmount;
          $suggestedPaymentMethod = $ord['payment_method'];
          $suggestedSlipCount = $slipCount;
          $suggestedSlipIndex = $currentSlipNum;

          // Mark this slip as used
          if ($matchedSlipIdx !== null) {
            $usedSlips[$ord['id'] . ':' . $matchedSlipIdx] = true;
          } else {
            // For main-order match, use a generic key
            $usedSlips[$ord['id'] . ':main_' . $suggestedCount] = true;
          }
          break;
        }
      }

      // Fallback: amount + bank match, but time within 7 hours
      if (!$suggestedOrderId) {
        foreach ($candidateOrders as $ord) {
          $totalAmount = (float) $ord['total_amount'];
          $slipTotal = (float) $ord['slip_total'];
          $slipCount = (int) ($ord['slip_count'] ?? 0);

          // Check if all slips for this order are already used
          $orderUsedCount = 0;
          foreach ($usedSlips as $key => $v) {
            if (strpos($key, $ord['id'] . ':') === 0) $orderUsedCount++;
          }
          if ($slipCount > 0 && $orderUsedCount >= $slipCount) continue;

          // Try matching individual slips first
          if (!empty($ord['slip_items'])) {
            $slips = json_decode($ord['slip_items'], true);
            if (is_array($slips)) {
              foreach ($slips as $slipIdx => $slip) {
                $slipKey = $ord['id'] . ':' . $slipIdx;
                if (isset($usedSlips[$slipKey])) continue;

                $slipAmount = (float) $slip['amount'];
                $slipDate = $slip['transfer_date'];
                $slipBankId = isset($slip['bank_account_id']) ? (int) $slip['bank_account_id'] : null;

                if (abs($slipAmount - $stmtAmount) > 0.01) continue;
                if ($slipBankId && $slipBankId !== $bankAccountId) continue;

                if ($slipDate) {
                  $timeDiffSec = abs(strtotime($stmtDate) - strtotime($slipDate));
                  if ($timeDiffSec <= 7 * 3600) {
                    $timeDiffMin = round($timeDiffSec / 60);
                    $reconCount = (int) ($ord['reconciled_count'] ?? 0);
                    $sugCount = 0;
                    foreach ($usedSlips as $key => $v) {
                      if (strpos($key, $ord['id'] . ':') === 0) $sugCount++;
                    }
                    $currentNum = $reconCount + $sugCount + 1;

                    $suggestedOrderId = $ord['id'];
                    $suggestedOrderInfo = $slipCount > 1
                      ? "สลิป {$currentNum}/{$slipCount} — ยอด " . number_format($stmtAmount, 2) . " (เวลาต่าง {$timeDiffMin} นาที)"
                      : "ยอดตรงกัน " . number_format($stmtAmount, 2) . " (เวลาต่าง {$timeDiffMin} นาที)";
                    $suggestedOrderAmount = $slipAmount;
                    $suggestedPaymentMethod = $ord['payment_method'];
                    $suggestedSlipCount = $slipCount;
                    $suggestedSlipIndex = $currentNum;
                    $usedSlips[$slipKey] = true;
                    break 2; // break out of both foreach loops
                  }
                }
              }
            }
          }

          // Fallback: match by total_amount
          $amountMatch = false;
          if (abs($totalAmount - $stmtAmount) <= 0.01) {
            $amountMatch = true;
          } elseif ($slipTotal > 0 && abs($slipTotal - $stmtAmount) <= 0.01) {
            $amountMatch = true;
          }

          if ($amountMatch) {
            $ordBankId = $ord['bank_account_id'] ?? $ord['slip_bank_account_id'] ?? null;
            if (!$ordBankId || (int) $ordBankId === $bankAccountId) {
              $ordDate = $ord['slip_transfer_date'] ?? $ord['transfer_date'] ?? null;
              if ($ordDate) {
                $timeDiffSec = abs(strtotime($stmtDate) - strtotime($ordDate));
                if ($timeDiffSec <= 7 * 3600) {
                  $timeDiffMin = round($timeDiffSec / 60);
                  $suggestedOrderId = $ord['id'];
                  $suggestedOrderInfo = "ยอดตรงกัน " . number_format($stmtAmount, 2) . " (เวลาต่าง " . $timeDiffMin . " นาที)";
                  $suggestedOrderAmount = $totalAmount;
                  $suggestedPaymentMethod = $ord['payment_method'];
                  $suggestedSlipCount = $slipCount;
                  $suggestedSlipIndex = 0;
                  $usedSlips[$ord['id'] . ':main_fallback'] = true;
                  break;
                }
              }
            }
          }
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

    // Build matched_orders array for multi-order display
    $matchedOrders = [];
    foreach ($reconcileItems as $item) {
      if (!empty($item['order_id']) && ($item['reconcile_type'] ?? '') === 'Order') {
        $matchedOrders[] = [
          'reconcile_id' => $item['reconcile_id'],
          'order_id' => $item['order_id'],
          'confirmed_amount' => (float) ($item['confirmed_amount'] ?? 0),
          'confirmed_at' => $item['confirmed_at'] ?? null,
          'payment_method' => $item['confirmed_payment_method'] ?? null,
        ];
      }
    }

    $results[] = [
      'id' => $row['id'],
      'reconcile_id' => !empty($reconcileItems) ? $reconcileItems[0]['reconcile_id'] : null,
      'confirmed_at' => !empty($confirmedAts) ? $confirmedAts[0] : null,
      'confirmed_action' => !empty($confirmedActions) ? implode(', ', array_unique($confirmedActions)) : null,
      'reconcile_type' => $primaryType,
      'note' => !empty($notes) ? implode(', ', array_unique($notes)) : null,
      'transfer_at' => $row['transfer_at'],
      'statement_amount' => $row['statement_amount'],
      'channel' => $row['channel'],
      'description' => $row['description'],
      'order_id' => !empty($orderIds) ? implode(',', array_unique($orderIds)) : null,
      'order_display' => $displayOrderId,
      'order_amount' => $displayOrderAmount,
      'payment_method' => $derivedPaymentMethod,
      'status' => $status,
      'diff' => $diff,
      'suggested_order_id' => $suggestedOrderId,
      'suggested_order_info' => $suggestedOrderInfo,
      'suggested_order_amount' => $suggestedOrderAmount,
      'suggested_payment_method' => $suggestedPaymentMethod,
      'suggested_slip_count' => $suggestedSlipCount,
      'suggested_slip_index' => $suggestedSlipIndex,
      'reconcile_items' => $reconcileItems,
      'matched_orders' => $matchedOrders,
      // User audit info (from first reconcile item)
      'created_by_name' => !empty($reconcileItems) ? ($reconcileItems[0]['created_by_name'] ?? null) : null,
      'confirmed_by_name' => !empty($reconcileItems) ? ($reconcileItems[0]['confirmed_by_name'] ?? null) : null,
      // COD document info
      'cod_document_id' => $row['cod_document_id'] ?? null,
      'cod_document_number' => $row['cod_document_number'] ?? null,
      'cod_total_amount' => $codTotalAmount,
      'cod_status' => $row['cod_status'] ?? null,
      'is_cod_document' => $isCodDocument,
    ];
  }

  // Detect REAL duplicate reconcile: compare SUM(confirmed_amount) vs order total_amount
  // 1 order with 2 statements is NORMAL if sum ≈ total (split payment)
  // 1 order with 2 statements is DUPLICATE if sum >> total (e.g. 2x)
  $allOrderIds = [];
  foreach ($results as $r) {
    if (!empty($r['matched_orders'])) {
      foreach ($r['matched_orders'] as $mo) {
        if (!empty($mo['order_id'])) {
          $allOrderIds[$mo['order_id']] = true;
        }
      }
    }
  }
  $duplicateInfo = []; // order_id => ['count' => N, 'sum' => X, 'total' => Y, 'is_over' => bool]
  if (!empty($allOrderIds)) {
    $orderIdList = array_keys($allOrderIds);
    $placeholders = implode(',', array_fill(0, count($orderIdList), '?'));
    $dupStmt = $pdo->prepare("
      SELECT srl.order_id,
             COUNT(*) as log_count,
             SUM(COALESCE(srl.confirmed_amount, 0)) as sum_confirmed,
             COALESCE(o.total_amount, 0) as total_amount
      FROM statement_reconcile_logs srl
      LEFT JOIN orders o ON o.id = srl.order_id
      WHERE srl.order_id IN ({$placeholders})
      GROUP BY srl.order_id, o.total_amount
    ");
    $dupStmt->execute($orderIdList);
    while ($dr = $dupStmt->fetch(PDO::FETCH_ASSOC)) {
      $count = (int) $dr['log_count'];
      $sumConfirmed = (float) $dr['sum_confirmed'];
      $totalAmount = (float) $dr['total_amount'];
      // Over-reconciled = sum exceeds 1.5x total (real duplicate / double match)
      $isOver = ($totalAmount > 0 && $sumConfirmed > $totalAmount * 1.5);
      $duplicateInfo[$dr['order_id']] = [
        'count' => $count,
        'sum_confirmed' => $sumConfirmed,
        'total_amount' => $totalAmount,
        'is_over' => $isOver,
      ];
    }
  }
  // Inject duplicate info into matched_orders
  foreach ($results as &$r) {
    if (!empty($r['matched_orders'])) {
      foreach ($r['matched_orders'] as &$mo) {
        $oid = $mo['order_id'] ?? '';
        $info = $duplicateInfo[$oid] ?? null;
        $mo['duplicate_reconcile_count'] = $info ? $info['count'] : 0;
        $mo['is_over_reconciled'] = $info ? $info['is_over'] : false;
        $mo['total_reconciled_amount'] = $info ? $info['sum_confirmed'] : 0;
        $mo['order_total_amount'] = $info ? $info['total_amount'] : 0;
      }
      unset($mo);
    }
  }
  unset($r);

  // Fetch cod_records for each COD document and attach to results
  $codDocIds = [];
  foreach ($results as $idx => $r) {
    if (!empty($r['cod_document_id'])) {
      $codDocIds[$r['cod_document_id']] = $idx;
    }
  }
  if (!empty($codDocIds)) {
    $placeholders = implode(',', array_fill(0, count($codDocIds), '?'));
    $crStmt = $pdo->prepare("
      SELECT id, document_id, tracking_number, order_id, cod_amount, status
      FROM cod_records
      WHERE document_id IN ({$placeholders})
      ORDER BY id
    ");
    $crStmt->execute(array_keys($codDocIds));
    $crRows = $crStmt->fetchAll(PDO::FETCH_ASSOC);
    // Group by document_id
    $grouped = [];
    foreach ($crRows as $cr) {
      $grouped[(int) $cr['document_id']][] = $cr;
    }
    foreach ($grouped as $docId => $records) {
      $resultIdx = $codDocIds[$docId];
      $results[$resultIdx]['cod_records'] = $records;
    }
  }

  echo json_encode(['ok' => true, 'data' => $results], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(['ok' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
?>