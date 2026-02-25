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

$payload = json_decode(file_get_contents("php://input"), true);
$companyId = isset($payload["company_id"]) ? (int) $payload["company_id"] : 0;
$userId = isset($payload["user_id"]) ? (int) $payload["user_id"] : 0;
$bankAccountId = isset($payload["bank_account_id"]) ? (int) $payload["bank_account_id"] : 0;
$statementId = isset($payload["statement_id"]) ? (int) $payload["statement_id"] : 0;
$orderId = isset($payload["order_id"]) ? trim($payload["order_id"]) : "";
$confirmedAmount = isset($payload["confirmed_amount"]) ? (float) $payload["confirmed_amount"] : null;
$startDateRaw = $payload["start_date"] ?? null;
$endDateRaw = $payload["end_date"] ?? null;

if ($companyId <= 0 || $userId <= 0 || $bankAccountId <= 0 || $statementId <= 0 || $orderId === "") {
    echo json_encode(["ok" => false, "error" => "Missing required fields: company_id, user_id, bank_account_id, statement_id, order_id"], JSON_UNESCAPED_UNICODE);
    exit();
}

try {
    $pdo = db_connect();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // 1. Get statement amount
    $stmtFetch = $pdo->prepare("SELECT id, amount FROM statement_logs WHERE id = :id");
    $stmtFetch->execute([':id' => $statementId]);
    $stmtInfo = $stmtFetch->fetch(PDO::FETCH_ASSOC);
    if (!$stmtInfo) {
        echo json_encode(["ok" => false, "error" => "Statement not found"], JSON_UNESCAPED_UNICODE);
        exit();
    }
    $statementAmount = (float) $stmtInfo['amount'];
    if ($confirmedAmount === null) {
        $confirmedAmount = $statementAmount;
    }

    // 2. Validate order
    $orderStmt = $pdo->prepare("
    SELECT id, total_amount, amount_paid, payment_method, payment_status, order_status
    FROM orders
    WHERE id = :id AND company_id = :companyId
  ");
    $orderStmt->execute([":id" => $orderId, ":companyId" => $companyId]);
    $order = $orderStmt->fetch(PDO::FETCH_ASSOC);
    if (!$order) {
        echo json_encode(["ok" => false, "error" => "Order not found: {$orderId}"], JSON_UNESCAPED_UNICODE);
        exit();
    }

    // 3. Check if this (statement_id, order_id) pair already exists
    $existCheck = $pdo->prepare("SELECT id FROM statement_reconcile_logs WHERE statement_log_id = :stmtId AND order_id = :orderId");
    $existCheck->execute([':stmtId' => $statementId, ':orderId' => $orderId]);
    if ($existCheck->fetch()) {
        echo json_encode(["ok" => false, "error" => "ออเดอร์นี้ถูกผูกกับ statement นี้แล้ว"], JSON_UNESCAPED_UNICODE);
        exit();
    }

    $pdo->beginTransaction();

    // 4. Find existing batch for this statement, or create new one
    $batchStmt = $pdo->prepare("
    SELECT srb.id as batch_id 
    FROM statement_reconcile_logs srl
    INNER JOIN statement_reconcile_batches srb ON srb.id = srl.batch_id
    WHERE srl.statement_log_id = :stmtId AND srb.company_id = :companyId
    LIMIT 1
  ");
    $batchStmt->execute([':stmtId' => $statementId, ':companyId' => $companyId]);
    $existingBatch = $batchStmt->fetch(PDO::FETCH_ASSOC);

    if ($existingBatch) {
        $batchId = (int) $existingBatch['batch_id'];
    } else {
        // Create new batch
        $bankStmt = $pdo->prepare("SELECT bank, bank_number FROM bank_account WHERE id = :id AND company_id = :companyId AND deleted_at IS NULL");
        $bankStmt->execute([":id" => $bankAccountId, ":companyId" => $companyId]);
        $bank = $bankStmt->fetch(PDO::FETCH_ASSOC);
        $bankDisplayName = $bank ? trim($bank["bank"] . " - " . $bank["bank_number"]) : "Unknown";

        $prefix = $bank ? preg_replace("/[^0-9A-Za-z]/", "", $bank["bank_number"]) : "BANK" . $bankAccountId;
        $ym = date("Ym");
        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM statement_reconcile_batches WHERE bank_account_id = :bankId AND DATE_FORMAT(created_at, '%Y%m') = :ym");
        $countStmt->execute([":bankId" => $bankAccountId, ":ym" => $ym]);
        $seq = ((int) $countStmt->fetchColumn()) + 1;
        $documentNo = sprintf("%s-%s-%03d", $prefix, date("Ymd"), $seq);

        $startDate = $startDateRaw ? date("Y-m-d 00:00:00", strtotime($startDateRaw)) : date("Y-m-d 00:00:00");
        $endDate = $endDateRaw ? date("Y-m-d 23:59:59", strtotime($endDateRaw)) : date("Y-m-d 23:59:59");

        $createBatch = $pdo->prepare("
      INSERT INTO statement_reconcile_batches (document_no, bank_account_id, bank_display_name, company_id, start_date, end_date, created_by)
      VALUES (:doc, :bankId, :bankName, :companyId, :startDate, :endDate, :userId)
    ");
        $createBatch->execute([
            ":doc" => $documentNo,
            ":bankId" => $bankAccountId,
            ":bankName" => $bankDisplayName,
            ":companyId" => $companyId,
            ":startDate" => $startDate,
            ":endDate" => $endDate,
            ":userId" => $userId,
        ]);
        $batchId = (int) $pdo->lastInsertId();
    }

    // 5. INSERT new reconcile log (no replace)
    $insertStmt = $pdo->prepare("
    INSERT INTO statement_reconcile_logs
      (batch_id, statement_log_id, order_id, statement_amount, confirmed_amount, reconcile_type, auto_matched, note, confirmed_payment_method)
    VALUES
      (:batchId, :stmtId, :orderId, :stmtAmount, :confirmedAmount, 'Order', 0, NULL, :paymentMethod)
  ");
    $insertStmt->execute([
        ":batchId" => $batchId,
        ":stmtId" => $statementId,
        ":orderId" => $orderId,
        ":stmtAmount" => $statementAmount,
        ":confirmedAmount" => $confirmedAmount,
        ":paymentMethod" => $order['payment_method'] ?? null,
    ]);
    $reconcileLogId = (int) $pdo->lastInsertId();

    // 6. Update order payment status
    $reconSumStmt = $pdo->prepare("
    SELECT COALESCE(SUM(srl.confirmed_amount), 0) AS total_reconciled
    FROM statement_reconcile_logs srl
    INNER JOIN statement_reconcile_batches srb ON srb.id = srl.batch_id
    WHERE srl.order_id = :orderId AND srb.company_id = :companyId
  ");
    $reconSumStmt->execute([":orderId" => $orderId, ":companyId" => $companyId]);
    $totalReconciled = (float) $reconSumStmt->fetchColumn();

    $currentPaid = (float) ($order["amount_paid"] ?? 0);
    $amountToSave = min((float) $order["total_amount"], max($currentPaid, $totalReconciled));

    $targetStatus = "PreApproved";
    $currentPaymentStatus = $order["payment_status"];
    if ($currentPaymentStatus === "Approved" || $currentPaymentStatus === "Paid") {
        $targetStatus = $currentPaymentStatus;
    }

    $currentOrderStatus = $order["order_status"];
    $earlyStages = ["Pending", "Picking", "Preparing"];
    if (in_array($currentOrderStatus, $earlyStages, true)) {
        $nextOrderStatus = $currentOrderStatus;
    } else if ($targetStatus === "Approved" || $targetStatus === "Paid") {
        $nextOrderStatus = "PreApproved";
    } else if (in_array($currentOrderStatus, ["AwaitingVerification", "Confirmed"], true)) {
        $nextOrderStatus = "Confirmed";
    } else {
        $nextOrderStatus = $currentOrderStatus;
    }

    $orderUpdateStmt = $pdo->prepare("
    UPDATE orders SET amount_paid = :amountPaid, payment_status = :paymentStatus, order_status = :orderStatus
    WHERE id = :orderId AND company_id = :companyId
  ");
    $orderUpdateStmt->execute([
        ":amountPaid" => $amountToSave,
        ":paymentStatus" => $targetStatus,
        ":orderStatus" => $nextOrderStatus,
        ":orderId" => $orderId,
        ":companyId" => $companyId,
    ]);

    $pdo->commit();

    echo json_encode([
        "ok" => true,
        "reconcile_log_id" => $reconcileLogId,
        "batch_id" => $batchId,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(["ok" => false, "error" => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
?>