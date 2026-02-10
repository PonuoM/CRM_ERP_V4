<?php
// Suppress any output before headers
if (ob_get_level() > 0) {
  ob_clean();
} else {
  ob_start();
}

header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
  if (ob_get_level() > 0) {
    ob_end_clean();
  }
  http_response_code(204);
  exit();
}

require_once "../config.php";

// Include reconcile_save.php functions without executing its headers
// We need to define the function ourselves to avoid header conflicts
if (!defined("RECONCILE_CHARSET")) {
  define("RECONCILE_CHARSET", "utf8mb4");
  define("RECONCILE_COLLATION", ""); // use server/database default collation
}

/**
 * Ensure reconciliation tables exist (idempotent).
 * Copied from reconcile_save.php to avoid header conflicts
 */
function ensure_reconcile_tables(PDO $pdo): void
{
  $pdo->exec("
    CREATE TABLE IF NOT EXISTS statement_reconcile_batches (
      id INT NOT NULL AUTO_INCREMENT,
      document_no VARCHAR(120) NOT NULL,
      bank_account_id INT NULL,
      bank_display_name VARCHAR(150) NULL,
      company_id INT NOT NULL,
      start_date DATETIME NULL,
      end_date DATETIME NULL,
      created_by INT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      notes TEXT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_statement_reconcile_document (document_no),
      KEY idx_statement_reconcile_company_created (company_id, created_at),
      KEY idx_statement_reconcile_bank (bank_account_id),
      CONSTRAINT fk_statement_reconcile_bank FOREIGN KEY (bank_account_id) REFERENCES bank_account(id) ON DELETE SET NULL ON UPDATE NO ACTION
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  ");

  $pdo->exec("
    CREATE TABLE IF NOT EXISTS statement_reconcile_logs (
      id INT NOT NULL AUTO_INCREMENT,
      batch_id INT NOT NULL,
      statement_log_id INT NOT NULL,
      order_id VARCHAR(32) NOT NULL,
      statement_amount DECIMAL(12,2) NOT NULL,
      confirmed_amount DECIMAL(12,2) DEFAULT NULL,
      auto_matched TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_statement_order (statement_log_id, order_id),
      KEY idx_statement_reconcile_order (order_id),
      KEY idx_statement_reconcile_batch (batch_id),
      KEY idx_statement_reconcile_order_statement (order_id, statement_log_id),
      CONSTRAINT fk_statement_reconcile_batch FOREIGN KEY (batch_id) REFERENCES statement_reconcile_batches(id) ON DELETE CASCADE ON UPDATE NO ACTION,
      CONSTRAINT fk_statement_reconcile_statement FOREIGN KEY (statement_log_id) REFERENCES statement_logs(id) ON DELETE CASCADE ON UPDATE NO ACTION,
      CONSTRAINT fk_statement_reconcile_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE ON UPDATE NO ACTION
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  ");

  // Allow multiple statement rows to be reconciled to the same order (up to the order total).
  try {
    $pdo->exec("ALTER TABLE statement_reconcile_logs DROP INDEX uniq_order_log");
  } catch (PDOException $e) {
    // Ignore if the index does not exist.
  }

  // Migration: Change unique key from statement_log_id only to (statement_log_id, order_id)
  // This allows one statement to be matched to multiple orders (for COD documents)
  try {
    $pdo->exec("ALTER TABLE statement_reconcile_logs DROP INDEX uniq_statement_log");
    $pdo->exec("ALTER TABLE statement_reconcile_logs ADD UNIQUE KEY uniq_statement_order (statement_log_id, order_id)");
  } catch (PDOException $e) {
    // Ignore if the index does not exist or already changed.
  }

}

// RECONCILE_CHARSET / RECONCILE_COLLATION already defined above

function normalize_date(string $value, bool $endOfDay = false): string
{
  $ts = strtotime($value);
  if ($ts === false) {
    throw new InvalidArgumentException("Invalid date: {$value}");
  }
  return $endOfDay
    ? date("Y-m-d 23:59:59", $ts)
    : date("Y-m-d 00:00:00", $ts);
}

function generate_document_no(PDO $pdo, int $bankAccountId, string $bankNumber, string $today): string
{
  $prefix = preg_replace("/[^0-9A-Za-z]/", "", $bankNumber);
  if ($prefix === "") {
    $prefix = "BANK" . $bankAccountId;
  }

  $ym = date("Ym", strtotime($today));
  $countStmt = $pdo->prepare("
    SELECT COUNT(*) FROM statement_reconcile_batches
    WHERE bank_account_id = :bankId AND DATE_FORMAT(created_at, '%Y%m') = :yearMonth
  ");
  $countStmt->execute([
    ":bankId" => $bankAccountId,
    ":yearMonth" => $ym,
  ]);
  $seq = ((int) $countStmt->fetchColumn()) + 1;
  $documentNo = sprintf("%s-%s-%03d", $prefix, date("Ymd", strtotime($today)), $seq);

  // Ensure uniqueness in rare case of race conditions
  $suffix = $seq;
  $checkStmt = $pdo->prepare("SELECT COUNT(*) FROM statement_reconcile_batches WHERE document_no = :doc");
  while (true) {
    $checkStmt->execute([":doc" => $documentNo]);
    $exists = (int) $checkStmt->fetchColumn();
    if ($exists === 0) {
      break;
    }
    $suffix += 1;
    $documentNo = sprintf("%s-%s-%03d", $prefix, date("Ymd", strtotime($today)), $suffix);
  }

  return $documentNo;
}

$payload = json_decode(file_get_contents("php://input"), true);
if (json_last_error() !== JSON_ERROR_NONE) {
  http_response_code(400);
  echo json_encode(
    [
      "ok" => false,
      "error" => "Invalid JSON: " . json_last_error_msg(),
    ],
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
  );
  exit();
}

$companyId = isset($payload["company_id"]) ? (int) $payload["company_id"] : 0;
$userId = isset($payload["user_id"]) ? (int) $payload["user_id"] : 0;
$codDocumentId = isset($payload["cod_document_id"]) ? (int) $payload["cod_document_id"] : 0;
$statementLogId = isset($payload["statement_log_id"]) ? (int) $payload["statement_log_id"] : 0;
$pdo = null;

if ($companyId <= 0 || $userId <= 0 || $codDocumentId <= 0 || $statementLogId <= 0) {
  http_response_code(400);
  echo json_encode(
    [
      "ok" => false,
      "error" => "company_id, user_id, cod_document_id, and statement_log_id are required",
    ],
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
  );
  exit();
}

try {
  $pdo = db_connect();
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

  // Align connection charset/collation with the database default
  try {
    $collInfo = $pdo->query("SELECT @@collation_database AS coll, @@character_set_database AS ch")->fetch(PDO::FETCH_ASSOC);
    if (is_array($collInfo)) {
      $dbCollation = $collInfo["coll"] ?? null;
      $dbCharset = $collInfo["ch"] ?? null;
      if ($dbCharset && $dbCollation) {
        $pdo->exec("SET NAMES {$dbCharset} COLLATE {$dbCollation}");
        $pdo->exec("SET collation_connection = '{$dbCollation}'");
      }
    }
  } catch (Throwable $ignored) {
    // If this fails, continue with existing connection settings
  }

  ensure_reconcile_tables($pdo);

  $pdo->beginTransaction();

  error_log("cod_reconcile_save: Starting reconciliation for COD doc {$codDocumentId}, statement {$statementLogId}");

  // 1. Validate and get COD document
  $codDocStmt = $pdo->prepare("
    SELECT cd.*, b.bank, b.bank_number
    FROM cod_documents cd
    LEFT JOIN bank_account b ON b.id = cd.bank_account_id
    WHERE cd.id = :docId AND cd.company_id = :companyId
  ");
  $codDocStmt->execute([
    ":docId" => $codDocumentId,
    ":companyId" => $companyId,
  ]);
  $codDoc = $codDocStmt->fetch(PDO::FETCH_ASSOC);
  if (!$codDoc) {
    throw new RuntimeException("COD document not found or does not belong to this company");
  }

  // 2. Validate statement log
  $stmtInfoStmt = $pdo->prepare("
    SELECT sl.id, sl.amount, sl.bank_account_id, sl.transfer_at, sb.company_id
    FROM statement_logs sl
    INNER JOIN statement_batchs sb ON sb.id = sl.batch_id
    WHERE sl.id = :id
  ");
  $stmtInfoStmt->execute([":id" => $statementLogId]);
  $stmtInfo = $stmtInfoStmt->fetch(PDO::FETCH_ASSOC);
  if (!$stmtInfo) {
    throw new RuntimeException("Statement log not found: {$statementLogId}");
  }
  if ((int) $stmtInfo["company_id"] !== $companyId) {
    throw new RuntimeException("Statement log does not belong to this company");
  }

  // Check if statement already reconciled
  $existsStmt = $pdo->prepare("
    SELECT COUNT(*) FROM statement_reconcile_logs srl
    INNER JOIN statement_reconcile_batches srb ON srb.id = srl.batch_id
    WHERE srl.statement_log_id = :sid AND srb.company_id = :companyId
  ");
  $existsStmt->execute([
    ":sid" => $statementLogId,
    ":companyId" => $companyId,
  ]);
  if ((int) $existsStmt->fetchColumn() > 0) {
    throw new RuntimeException("Statement log {$statementLogId} already reconciled");
  }

  // 3. Get ALL COD records for this document (including forced records without order_id)
  // This is needed to calculate correct proportions for the statement amount
  $allCodRecordsStmt = $pdo->prepare("
    SELECT * FROM cod_records
    WHERE document_id = :docId
    ORDER BY id
  ");
  $allCodRecordsStmt->execute([":docId" => $codDocumentId]);
  $allCodRecords = $allCodRecordsStmt->fetchAll(PDO::FETCH_ASSOC);

  // Filter to only records with valid order_id for reconciliation
  $codRecords = array_filter($allCodRecords, function($rec) {
    $orderId = trim((string) ($rec["order_id"] ?? ""));
    return $orderId !== "";
  });
  $codRecords = array_values($codRecords); // Re-index

  if (empty($codRecords)) {
    throw new RuntimeException("No COD records with order_id found for this document");
  }

  // Calculate total COD amount from ALL records (including forced)
  // This ensures forced amounts are distributed proportionally to valid orders
  $totalCodAmountAll = 0.0;
  foreach ($allCodRecords as $rec) {
    $totalCodAmountAll += (float) ($rec["cod_amount"] ?? 0);
  }

  // Calculate total COD amount from records WITH order_id only
  $totalCodAmountWithOrders = 0.0;
  foreach ($codRecords as $rec) {
    $totalCodAmountWithOrders += (float) ($rec["cod_amount"] ?? 0);
  }

  error_log("cod_reconcile_save: Found " . count($allCodRecords) . " total COD records, " . count($codRecords) . " with order_id");
  error_log("cod_reconcile_save: Total COD amount (all): {$totalCodAmountAll}, with orders: {$totalCodAmountWithOrders}");

  // 4. Get bank account info
  $bankAccountId = $codDoc["bank_account_id"] ? (int) $codDoc["bank_account_id"] : (int) $stmtInfo["bank_account_id"];
  if ($bankAccountId <= 0) {
    throw new RuntimeException("Bank account ID is required");
  }

  $bankStmt = $pdo->prepare("SELECT id, bank, bank_number FROM bank_account WHERE id = :id AND company_id = :companyId AND deleted_at IS NULL");
  $bankStmt->execute([
    ":id" => $bankAccountId,
    ":companyId" => $companyId,
  ]);
  $bank = $bankStmt->fetch(PDO::FETCH_ASSOC);
  if (!$bank) {
    throw new RuntimeException("Bank account not found for this company");
  }
  $bankDisplayName = trim($bank["bank"] . " - " . $bank["bank_number"]);

  // 5. Generate document number and create batch
  $documentNo = generate_document_no($pdo, $bankAccountId, $bank["bank_number"], date("Y-m-d"));
  $documentDatetime = $codDoc["document_datetime"] ? normalize_date($codDoc["document_datetime"], false) : date("Y-m-d 00:00:00");
  $endDate = normalize_date($codDoc["document_datetime"], true);

  $batchStmt = $pdo->prepare("
    INSERT INTO statement_reconcile_batches
      (document_no, bank_account_id, bank_display_name, company_id, start_date, end_date, created_by, notes)
    VALUES
      (:doc, :bankId, :bankName, :companyId, :startDate, :endDate, :userId, :notes)
  ");
  $batchStmt->execute([
    ":doc" => $documentNo,
    ":bankId" => $bankAccountId,
    ":bankName" => $bankDisplayName,
    ":companyId" => $companyId,
    ":startDate" => $documentDatetime,
    ":endDate" => $endDate,
    ":userId" => $userId,
    ":notes" => "COD Document: " . $codDoc["document_number"],
  ]);
  $batchId = (int) $pdo->lastInsertId();

  // 6. Create reconcile logs for each COD record
  $insertLogStmt = $pdo->prepare("
    INSERT INTO statement_reconcile_logs
      (batch_id, statement_log_id, order_id, statement_amount, confirmed_amount, auto_matched, 
       reconcile_type, confirmed_at, confirmed_order_id, confirmed_order_amount, confirmed_payment_method, confirmed_action)
    VALUES
      (:batchId, :statementId, :orderId, :statementAmount, :confirmedAmount, :autoMatched,
       'Order', NULL, :confirmedOrderId, :confirmedOrderAmount, 'COD', NULL)
  ");

  $orderUpdateStmt = $pdo->prepare("
    UPDATE orders
    SET
      amount_paid = :amountPaid,
      payment_status = :paymentStatus,
      order_status = :orderStatus
    WHERE id = :orderId AND company_id = :companyId
  ");

  $orderReconSumStmt = $pdo->prepare("
    SELECT COALESCE(SUM(srl.confirmed_amount), 0) AS total_reconciled
    FROM statement_reconcile_logs srl
    INNER JOIN statement_reconcile_batches srb ON srb.id = srl.batch_id
    WHERE srl.order_id = :orderId AND srb.company_id = :companyId
  ");

  $codRecordUpdateStmt = $pdo->prepare("
    UPDATE cod_records
    SET status = 'matched', updated_at = NOW()
    WHERE id = :recordId
  ");

  $saved = 0;
  $batchRunningTotals = [];
  $existingReconCache = [];
  $statementAmount = (float) $stmtInfo["amount"];
  
  // Use totalCodAmountWithOrders for proportion calculation
  // This distributes the FULL statement amount to orders with valid order_id
  // Forced amounts (no order_id) are effectively distributed proportionally to all orders

  // Calculate proportional amounts - distribute FULL statement to orders with order_id
  $allocatedAmounts = [];
  $totalAllocated = 0.0;
  $validIndices = [];
  foreach ($codRecords as $idx => $codRecord) {
    $orderId = trim((string) $codRecord["order_id"]);
    if ($orderId === "") {
      continue; // Skip records without order_id
    }
    $validIndices[] = $idx;
    $codAmount = (float) $codRecord["cod_amount"];
    // Use totalCodAmountWithOrders as denominator so FULL statement amount is distributed
    $proportion = $totalCodAmountWithOrders > 0 ? ($codAmount / $totalCodAmountWithOrders) : (1.0 / count($codRecords));
    $allocatedAmounts[$idx] = round($statementAmount * $proportion, 2);
    $totalAllocated += $allocatedAmounts[$idx];
  }

  // Adjust last valid record to account for rounding differences
  if (count($validIndices) > 0 && abs($totalAllocated - $statementAmount) > 0.01) {
    $lastIdx = $validIndices[count($validIndices) - 1];
    $allocatedAmounts[$lastIdx] = round($statementAmount - ($totalAllocated - $allocatedAmounts[$lastIdx]), 2);
  }

  error_log("cod_reconcile_save: Allocated amounts calculated. Total: " . array_sum($allocatedAmounts) . ", Expected: {$statementAmount}");

  // Distribute statement amount across COD records proportionally
  // Group by parent order (remove -1, -2 suffix)
  $orderGroups = [];
  foreach ($codRecords as $idx => $codRecord) {
    $orderId = trim((string) $codRecord["order_id"]);
    if ($orderId === "") {
      continue;
    }

    // Get parent order ID (remove sub-order suffix like -1, -2)
    $parentOrderId = preg_replace('/-\d+$/', '', $orderId);

    if (!isset($orderGroups[$parentOrderId])) {
      $orderGroups[$parentOrderId] = [];
    }
    $orderGroups[$parentOrderId][] = [
      'record' => $codRecord,
      'idx' => $idx,
      'original_order_id' => $orderId
    ];
  }

  foreach ($orderGroups as $parentOrderId => $group) {
    // Validate parent order
    $orderStmt = $pdo->prepare("
      SELECT id, total_amount, amount_paid, payment_method, payment_status, order_status
      FROM orders
      WHERE id = :id AND company_id = :companyId
      FOR UPDATE
    ");
    $orderStmt->execute([
      ":id" => $parentOrderId,
      ":companyId" => $companyId,
    ]);
    $order = $orderStmt->fetch(PDO::FETCH_ASSOC);
    if (!$order) {
      error_log("Parent order not found: {$parentOrderId}, skipping COD records");
      continue;
    }

    // Calculate total confirmed amount for all sub-orders in this parent
    $totalConfirmedForParent = 0.0;
    foreach ($group as $item) {
      $idx = $item['idx'];
      $confirmedAmount = isset($allocatedAmounts[$idx]) ? $allocatedAmounts[$idx] : 0.0;
      if ($confirmedAmount > 0) {
        $totalConfirmedForParent += $confirmedAmount;
      }
    }

    // Get existing reconciled amount for parent order
    if (!array_key_exists($parentOrderId, $existingReconCache)) {
      $orderReconSumStmt->execute([
        ":orderId" => $parentOrderId,
        ":companyId" => $companyId,
      ]);
      $existingReconCache[$parentOrderId] = (float) $orderReconSumStmt->fetchColumn();
    }
    $existingReconciled = $existingReconCache[$parentOrderId];

    $running = $batchRunningTotals[$parentOrderId] ?? 0.0;
    $proposedTotal = $existingReconciled + $running + $totalConfirmedForParent;
    if ($proposedTotal > (float) $order["total_amount"] + 0.01) {
      error_log("Parent order {$parentOrderId} would exceed total amount, adjusting");
      $totalConfirmedForParent = max(0, (float) $order["total_amount"] - $existingReconciled - $running);
    }
    $runningAfter = $running + $totalConfirmedForParent;
    $batchRunningTotals[$parentOrderId] = $runningAfter;

    // Insert reconcile log for parent order (once per parent, not per sub-order)
    try {
      $insertLogStmt->execute([
        ":batchId" => $batchId,
        ":statementId" => $statementLogId,
        ":orderId" => $parentOrderId,
        ":statementAmount" => $statementAmount,
        ":confirmedAmount" => $totalConfirmedForParent,
        ":autoMatched" => 0,
        ":confirmedOrderId" => $parentOrderId,
        ":confirmedOrderAmount" => $totalConfirmedForParent,
      ]);
      $saved += 1;
    } catch (PDOException $insertError) {
      error_log("Failed to insert reconcile log: " . $insertError->getMessage());
      throw new RuntimeException("Failed to insert reconciliation record: " . $insertError->getMessage(), 0, $insertError);
    }

    // Update all COD records for this parent order
    foreach ($group as $item) {
      $codRecord = $item['record'];
      $codRecordUpdateStmt->execute([":recordId" => $codRecord["id"]]);
    }

    // Update parent order payment status/amount (once per parent order, after all sub-orders processed)
    if (!array_key_exists($parentOrderId, $existingReconCache)) {
      $orderReconSumStmt->execute([
        ":orderId" => $parentOrderId,
        ":companyId" => $companyId,
      ]);
      $existingReconCache[$parentOrderId] = (float) $orderReconSumStmt->fetchColumn();
    }
    $existingReconciled = $existingReconCache[$parentOrderId];

    $running = $batchRunningTotals[$parentOrderId] ?? 0.0;
    $accumulatedPaid = $existingReconciled + $running;
    $amountToSave = min((float) $order["total_amount"], max((float) $order["amount_paid"], $accumulatedPaid));

    // Finance Approval stage: Always set PreApproved
    // Final Approved status will be set by Bank Audit confirmation (confirm_cod_document.php)
    $currentPaymentStatus = $order["payment_status"];
    if ($currentPaymentStatus === "Approved" || $currentPaymentStatus === "Paid") {
      // Don't downgrade if already approved
      $targetStatus = $currentPaymentStatus;
    } else {
      // Set to PreApproved (รอตรวจสอบ) - Bank Audit will change to Approved
      $targetStatus = "PreApproved";
    }

    // Determine order status based on payment status
    // GUARD: Don't change order_status for orders still in fulfillment pipeline
    $currentStatus = $order["order_status"];
    $earlyFulfillmentStages = ["Pending", "Picking", "Preparing"];
    if (in_array($currentStatus, $earlyFulfillmentStages, true)) {
      // Order hasn't shipped yet — keep order_status unchanged
      $nextOrderStatus = $currentStatus;
    } else if ($currentPaymentStatus === "Approved" || $currentPaymentStatus === "Paid") {
      // Already approved and past fulfillment stages - set Delivered
      $nextOrderStatus = "Delivered";
    } else if (in_array($currentStatus, ["AwaitingVerification", "Confirmed", "Delivered"], true)) {
      // Payment not approved yet - set to Preparing (COD waiting for Bank Audit verification)
      $nextOrderStatus = "Preparing";
    } else {
      // Keep current status
      $nextOrderStatus = $currentStatus;
    }

    $orderUpdateStmt->execute([
      ":amountPaid" => $amountToSave,
      ":paymentStatus" => (string) $targetStatus,
      ":orderStatus" => (string) $nextOrderStatus,
      ":orderId" => $parentOrderId,
      ":companyId" => $companyId,
    ]);
  }

  // 6b. Also update forced COD records (without order_id) to 'matched' status
  foreach ($allCodRecords as $rec) {
    $orderId = trim((string) ($rec["order_id"] ?? ""));
    if ($orderId === "") {
      // This is a forced record - update its status too
      $codRecordUpdateStmt->execute([":recordId" => $rec["id"]]);
    }
  }

  // 7. Update COD document
  $verifiedAt = date("Y-m-d H:i:s");
  $updateCodDocStmt = $pdo->prepare("
    UPDATE cod_documents
    SET
      matched_statement_log_id = :statementId,
      status = 'verified',
      verified_by = :userId,
      verified_at = :verifiedAt,
      updated_at = NOW()
    WHERE id = :docId
  ");
  $updateCodDocStmt->execute([
    ":statementId" => $statementLogId,
    ":userId" => $userId,
    ":verifiedAt" => $verifiedAt,
    ":docId" => $codDocumentId,
  ]);

  $pdo->commit();

  echo json_encode(
    [
      "ok" => true,
      "document_no" => $documentNo,
      "batch_id" => $batchId,
      "saved" => $saved,
      "cod_document_id" => $codDocumentId,
    ],
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
  );
} catch (PDOException $e) {
  if ($pdo && $pdo->inTransaction()) {
    try {
      $pdo->rollBack();
    } catch (Exception $rollbackEx) {
      error_log("cod_reconcile_save.php Rollback failed: " . $rollbackEx->getMessage());
    }
  }
  error_log("cod_reconcile_save.php PDOException: " . $e->getMessage());
  error_log("SQL State: " . $e->getCode());
  error_log("File: " . $e->getFile() . " Line: " . $e->getLine());
  error_log("Trace: " . $e->getTraceAsString());

  http_response_code(500);
  $errorMessage = $e->getMessage();
  if (strpos($errorMessage, "collation") !== false || strpos($errorMessage, "COERCIBLE") !== false) {
    $errorMessage = "Collation mismatch error. Please contact administrator. Details: " . $errorMessage;
  }
  echo json_encode(
    [
      "ok" => false,
      "error" => $errorMessage,
      "sql_state" => $e->getCode(),
      "file" => basename($e->getFile()),
      "line" => $e->getLine(),
    ],
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
  );
} catch (Exception $e) {
  if ($pdo && $pdo->inTransaction()) {
    try {
      $pdo->rollBack();
    } catch (Exception $rollbackEx) {
      error_log("cod_reconcile_save.php Rollback failed: " . $rollbackEx->getMessage());
    }
  }
  error_log("cod_reconcile_save.php Exception: " . $e->getMessage());
  error_log("File: " . $e->getFile() . " Line: " . $e->getLine());
  error_log("Trace: " . $e->getTraceAsString());

  http_response_code(500);
  echo json_encode(
    [
      "ok" => false,
      "error" => $e->getMessage(),
      "file" => basename($e->getFile()),
      "line" => $e->getLine(),
    ],
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
  );
} catch (Throwable $e) {
  if ($pdo && $pdo->inTransaction()) {
    try {
      $pdo->rollBack();
    } catch (Exception $rollbackEx) {
      error_log("cod_reconcile_save.php Rollback failed: " . $rollbackEx->getMessage());
    }
  }
  error_log("cod_reconcile_save.php Throwable: " . $e->getMessage());
  error_log("File: " . $e->getFile() . " Line: " . $e->getLine());
  error_log("Trace: " . $e->getTraceAsString());

  http_response_code(500);
  echo json_encode(
    [
      "ok" => false,
      "error" => $e->getMessage(),
      "file" => basename($e->getFile()),
      "line" => $e->getLine(),
    ],
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
  );
}
