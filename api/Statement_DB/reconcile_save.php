<?php
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
  http_response_code(204);
  exit();
}

require_once dirname(__DIR__) . "/config.php";

register_shutdown_function(function() {
    $error = error_get_last();
    if ($error !== null && $error['type'] === E_ERROR) {
        file_put_contents(__DIR__ . "/debug_reconcile.txt", "FATAL ERROR: " . print_r($error, true) . "\n", FILE_APPEND);
    }
});

if (!defined("RECONCILE_CHARSET")) {
  define("RECONCILE_CHARSET", "utf8mb4");
  define("RECONCILE_COLLATION", "utf8mb4_0900_ai_ci");
}

/**
 * Ensure reconciliation tables exist (idempotent).
 */
function ensure_reconcile_tables(PDO $pdo): void
{
  $charset = RECONCILE_CHARSET;
  $collation = RECONCILE_COLLATION;

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
    ) ENGINE=InnoDB DEFAULT CHARSET={$charset} COLLATE={$collation};
  ");

  $pdo->exec("
    CREATE TABLE IF NOT EXISTS statement_reconcile_logs (
      id INT NOT NULL AUTO_INCREMENT,
      batch_id INT NOT NULL,
      statement_log_id INT NOT NULL,
      order_id VARCHAR(32) NOT NULL,
      statement_amount DECIMAL(12,2) NOT NULL,
      confirmed_amount DECIMAL(12,2) DEFAULT NULL,
      reconcile_type VARCHAR(20) NOT NULL DEFAULT 'Order',
      auto_matched TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_statement_log (statement_log_id),
      KEY idx_statement_reconcile_order (order_id),
      KEY idx_statement_reconcile_batch (batch_id),
      KEY idx_statement_reconcile_type (reconcile_type),
      KEY idx_statement_reconcile_order_statement (order_id, statement_log_id),
      CONSTRAINT fk_statement_reconcile_batch FOREIGN KEY (batch_id) REFERENCES statement_reconcile_batches(id) ON DELETE CASCADE ON UPDATE NO ACTION,
      CONSTRAINT fk_statement_reconcile_statement FOREIGN KEY (statement_log_id) REFERENCES statement_logs(id) ON DELETE CASCADE ON UPDATE NO ACTION
    ) ENGINE=InnoDB DEFAULT CHARSET={$charset} COLLATE={$collation};
  ");

  // Allow multiple statement rows to be reconciled to the same order (up to the order total).
  try {
    $pdo->exec("ALTER TABLE statement_reconcile_logs DROP INDEX uniq_order_log");
  } catch (PDOException $e) {
    // Ignore if the index does not exist.
  }
}

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
$companyId = isset($payload["company_id"]) ? (int) $payload["company_id"] : 0;
$userId = isset($payload["user_id"]) ? (int) $payload["user_id"] : 0;
$bankAccountId = isset($payload["bank_account_id"]) ? (int) $payload["bank_account_id"] : 0;
$startDateRaw = $payload["start_date"] ?? null;
$endDateRaw = $payload["end_date"] ?? null;
$items = isset($payload["items"]) && is_array($payload["items"]) ? $payload["items"] : [];
$pdo = null;

file_put_contents(__DIR__ . "/debug_reconcile.txt", "Start " . date("Y-m-d H:i:s") . "\n", FILE_APPEND);
file_put_contents(__DIR__ . "/debug_reconcile.txt", "Payload: " . print_r($payload, true) . "\n", FILE_APPEND);

if ($companyId <= 0 || $userId <= 0 || $bankAccountId <= 0 || !$startDateRaw || !$endDateRaw) {
  echo json_encode(
    [
      "ok" => false,
      "error" => "company_id, user_id, bank_account_id, start_date, end_date and items are required",
    ],
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
  );
  exit();
}

if (count($items) === 0) {
  echo json_encode(
    [
      "ok" => false,
      "error" => "No items to save",
    ],
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
  );
  exit();
}

try {
  $pdo = db_connect();
  // Enable error reporting for PDO FIRST before any queries
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  
  // Set connection to the unified collation - MUST be set before any queries
  // Use SET SESSION to ensure it applies to this connection only
  // Force set multiple times to be absolutely sure
  $pdo->exec("SET SESSION collation_connection = 'utf8mb4_0900_ai_ci'");
  $pdo->exec("SET SESSION character_set_connection = 'utf8mb4'");
  $pdo->exec("SET SESSION collation_database = 'utf8mb4_0900_ai_ci'");
  $pdo->exec("SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci");
  $pdo->exec("SET CHARACTER SET utf8mb4");
  
  // Verify connection collation
  $verifyCollation = $pdo->query("SELECT @@collation_connection as coll")->fetch(PDO::FETCH_ASSOC);
  if ($verifyCollation['coll'] !== 'utf8mb4_0900_ai_ci') {
    error_log("WARNING: Connection collation is '{$verifyCollation['coll']}', not 'utf8mb4_0900_ai_ci'");
    // Force set again
    $pdo->exec("SET collation_connection = 'utf8mb4_0900_ai_ci'");
  }

  ensure_reconcile_tables($pdo);

  $startDate = normalize_date($startDateRaw, false);
  $endDate = normalize_date($endDateRaw, true);

  $pdo->beginTransaction();

  // Validate bank account
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

  $documentNo = generate_document_no($pdo, $bankAccountId, $bank["bank_number"], date("Y-m-d"));

  // Create batch
  $batchStmt = $pdo->prepare("
    INSERT INTO statement_reconcile_batches
      (document_no, bank_account_id, bank_display_name, company_id, start_date, end_date, created_by)
    VALUES
      (:doc, :bankId, :bankName, :companyId, :startDate, :endDate, :userId)
  ");
  $batchStmt->execute([
    ":doc" => $documentNo,
    ":bankId" => $bankAccountId,
    ":bankName" => $bankDisplayName,
    ":companyId" => $companyId,
    ":startDate" => $startDate,
    ":endDate" => $endDate,
    ":userId" => $userId,
  ]);
  $batchId = (int) $pdo->lastInsertId();

  $insertLogStmt = $pdo->prepare("
    INSERT INTO statement_reconcile_logs
      (batch_id, statement_log_id, order_id, statement_amount, confirmed_amount, reconcile_type, auto_matched, note)
    VALUES
      (:batchId, :statementId, :orderId, :statementAmount, :confirmedAmount, :reconcileType, :autoMatched, :note)
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

  $saved = 0;
  $batchRunningTotals = [];
  $existingReconCache = [];
  
  // Prepare statement fetch query
  $stmtFetchSql = $pdo->prepare("SELECT amount FROM statement_logs WHERE id = :id");

  foreach ($items as $item) {
    $statementId = isset($item["statement_id"]) ? (int) $item["statement_id"] : 0;
    $reconcileType = isset($item["reconcile_type"]) ? $item["reconcile_type"] : "Order";
    $confirmedAmount = isset($item["confirmed_amount"]) ? (float) $item["confirmed_amount"] : null;
    $autoMatched = isset($item["auto_matched"]) ? (int) $item["auto_matched"] : 0;
    $orderId = isset($item["order_id"]) ? $item["order_id"] : "";

    // Fetch statement details
    $stmtFetchSql->execute([':id' => $statementId]);
    $stmtInfo = $stmtFetchSql->fetch(PDO::FETCH_ASSOC);
    if (!$stmtInfo) {
        file_put_contents(__DIR__ . "/debug_reconcile.txt", "Error: Statement not found $statementId\n", FILE_APPEND);
        throw new RuntimeException("Statement log not found for ID: " . $statementId);
    }
    $statementAmount = (float) $stmtInfo['amount'];
    file_put_contents(__DIR__ . "/debug_reconcile.txt", "Process Item: StmtId=$statementId, Type=$reconcileType, Amount=$statementAmount\n", FILE_APPEND);

    $note = isset($item["note"]) ? trim($item["note"]) : null;

    if ($reconcileType === "Suspense" || $reconcileType === "Deposit") {
      // For Suspense/Deposit, orderId can be empty/null
      $orderId = null; 
      $order = null;
    } else {
      // For Order type, validate Order ID
      if ($orderId === "") {
        throw new RuntimeException("Invalid item payload: Order ID required for Order reconciliation");
      }
      
      // Validate order
      $orderStmt = $pdo->prepare("
        SELECT id, total_amount, amount_paid, payment_method, payment_status, order_status
        FROM orders
        WHERE id = :id AND company_id = :companyId
        FOR UPDATE
      ");
      $orderStmt->execute([
        ":id" => $orderId,
        ":companyId" => $companyId,
      ]);
      $order = $orderStmt->fetch(PDO::FETCH_ASSOC);
      if (!$order) {
        throw new RuntimeException("Order not found: {$orderId}");
      }
    }

    // $statementAmount already set above
    // $statementAmount = (float) $stmtInfo["amount"];
    if ($confirmedAmount === null) {
      $confirmedAmount = $statementAmount;
    }
    if ($confirmedAmount < 0) {
      $confirmedAmount = 0;
    }

    // Only check existing reconciled amounts for Orders, not Suspense
    if ($reconcileType === "Order" && $order) {
      if (!array_key_exists($orderId, $existingReconCache)) {
        $orderReconSumStmt->execute([
          ":orderId" => $orderId,
          ":companyId" => $companyId,
        ]);
        $existingReconCache[$orderId] = (float) $orderReconSumStmt->fetchColumn();
      }
      $existingReconciled = $existingReconCache[$orderId];
  
      $running = $batchRunningTotals[$orderId] ?? 0.0;
      $proposedTotal = $existingReconciled + $running + $confirmedAmount;
      if ($proposedTotal > (float) $order["total_amount"] + 0.01) {
        throw new RuntimeException("Order {$orderId} would exceed total amount with this statement");
      }
      $runningAfter = $running + $confirmedAmount;
      $batchRunningTotals[$orderId] = $runningAfter;
    }

    try {
      // Ensure order_id is treated as string with correct collation
      $orderIdStr = (string) $orderId;
      
      $insertLogStmt->execute([
        ":batchId" => $batchId,
        ":statementId" => $statementId,
        ":orderId" => $orderId, // Can be null for Suspense/Deposit
        ":statementAmount" => $statementAmount,
        ":confirmedAmount" => $confirmedAmount,
        ":reconcileType" => $reconcileType,
        ":autoMatched" => $autoMatched,
        ":note" => $note,
      ]);
      $saved += 1;
    } catch (PDOException $insertError) {
      error_log("Failed to insert reconcile log: " . $insertError->getMessage());
      error_log("SQL State: " . $insertError->getCode());
      error_log("Order ID: {$orderId} (type: " . gettype($orderId) . "), Statement ID: {$statementId}");
      error_log("Stack trace: " . $insertError->getTraceAsString());
      
      // Check if it's a collation error
      if (strpos($insertError->getMessage(), "collation") !== false || 
          strpos($insertError->getMessage(), "1267") !== false ||
          strpos($insertError->getMessage(), "COERCIBLE") !== false) {
        error_log("COLLATION ERROR DETECTED!");
        error_log("Connection collation: " . $pdo->query("SELECT @@collation_connection")->fetchColumn());
        error_log("Order ID collation check:");
        $orderInfo = $pdo->query("
          SELECT COLLATION_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'orders'
            AND COLUMN_NAME = 'id'
        ")->fetch(PDO::FETCH_ASSOC);
        error_log("  orders.id: " . ($orderInfo['COLLATION_NAME'] ?? 'NULL'));
        
        $logInfo = $pdo->query("
          SELECT COLLATION_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'statement_reconcile_logs'
            AND COLUMN_NAME = 'order_id'
        ")->fetch(PDO::FETCH_ASSOC);
        error_log("  statement_reconcile_logs.order_id: " . ($logInfo['COLLATION_NAME'] ?? 'NULL'));
      }
      
      throw new RuntimeException("Failed to insert reconciliation record: " . $insertError->getMessage(), 0, $insertError);
    }

    // Update order payment status/amount
    $currentPaid = $order["amount_paid"] !== null ? (float) $order["amount_paid"] : 0.0;
    $accumulatedPaid = $existingReconciled + $batchRunningTotals[$orderId];
    $amountToSave = min((float) $order["total_amount"], max($currentPaid, $accumulatedPaid));

    $targetStatus = $amountToSave >= ((float) $order["total_amount"] - 0.01) ? "Approved" : "PreApproved";
    $currentPaymentStatus = $order["payment_status"];
    if ($currentPaymentStatus === "Approved" || $currentPaymentStatus === "Paid") {
      $targetStatus = $currentPaymentStatus;
    }
    
    // Determine order status based on payment status
    // STOP AUTO-DELIVERY: Payment received implies Deposit/PreApproved, NOT Delivered.
    $currentStatus = $order["order_status"];
    if ($targetStatus === "Approved" || $targetStatus === "Paid") {
      // Payment approved - set to PreApproved (Approved by finance, ready to move to Picking/Shipping)
      // Do NOT set to Delivered here. Delivered implies shipment completion.
      $nextOrderStatus = "PreApproved";
    } else if (in_array($currentStatus, ["Pending", "AwaitingVerification", "Confirmed"], true)) {
      // Payment not fully approved yet - set to Preparing/Confirmed
      $nextOrderStatus = "Confirmed";
    } else {
      // Keep current status if it's already further along (e.g. Picking, Shipping)
      $nextOrderStatus = $currentStatus;
    }

    // Only update order if it's an Order reconciliation
    if ($reconcileType === "Order" && $orderId) {
      $orderUpdateStmt->execute([
        ":amountPaid" => $amountToSave,
        ":paymentStatus" => (string) $targetStatus,
        ":orderStatus" => (string) $nextOrderStatus,
        ":orderId" => (string) $orderId,
        ":companyId" => $companyId,
      ]);
    }
  }

  $pdo->commit();

  echo json_encode(
    [
      "ok" => true,
      "document_no" => $documentNo,
      "batch_id" => $batchId,
      "saved" => $saved,
    ],
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
  );
} catch (PDOException $e) {
  if ($pdo && $pdo->inTransaction()) {
    $pdo->rollBack();
  }
  file_put_contents(__DIR__ . "/debug_reconcile.txt", "PDOException: " . $e->getMessage() . "\n", FILE_APPEND);
  // Log the full error for debugging
  error_log("reconcile_save.php PDOException: " . $e->getMessage());
  error_log("SQL State: " . $e->getCode());
  error_log("Trace: " . $e->getTraceAsString());
  
  http_response_code(500);
  $errorMessage = $e->getMessage();
  // If it's a collation error, provide more specific message
  if (strpos($errorMessage, "collation") !== false || strpos($errorMessage, "COERCIBLE") !== false) {
    $errorMessage = "Collation mismatch error. Please contact administrator. Details: " . $errorMessage;
  }
  echo json_encode(
    [
      "ok" => false,
      "error" => $errorMessage,
      "sql_state" => $e->getCode(),
    ],
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
  );
} catch (Exception $e) {
  if ($pdo && $pdo->inTransaction()) {
    $pdo->rollBack();
  }
  file_put_contents(__DIR__ . "/debug_reconcile.txt", "Exception: " . $e->getMessage() . "\n", FILE_APPEND);
  // Log the full error for debugging
  error_log("reconcile_save.php Exception: " . $e->getMessage());
  error_log("Trace: " . $e->getTraceAsString());
  
  http_response_code(500);
  echo json_encode(
    [
      "ok" => false,
      "error" => $e->getMessage(),
    ],
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
  );
}
