<?php
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
  http_response_code(204);
  exit();
}

require_once "../config.php";

/**
 * Ensure reconciliation tables exist (idempotent).
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
      UNIQUE KEY uniq_statement_log (statement_log_id),
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

$companyId = isset($_GET["company_id"]) ? (int) $_GET["company_id"] : 0;
$bankAccountId = isset($_GET["bank_account_id"]) && $_GET["bank_account_id"] !== ""
  ? (int) $_GET["bank_account_id"]
  : null;
$startDateRaw = $_GET["start_date"] ?? null;
$endDateRaw = $_GET["end_date"] ?? null;

if ($companyId <= 0 || !$startDateRaw || !$endDateRaw) {
  echo json_encode(
    [
      "ok" => false,
      "error" => "company_id, start_date, end_date are required",
    ],
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
  );
  exit();
}

try {
  $pdo = db_connect();
  ensure_reconcile_tables($pdo);

  $startDate = normalize_date($startDateRaw, false);
  $endDate = normalize_date($endDateRaw, true);

  // Fetch statement logs for the company/bank/date range excluding already reconciled ones
  $stmtParams = [
    ":companyId" => $companyId,
    ":startDate" => $startDate,
    ":endDate" => $endDate,
    ":companyIdEx" => $companyId,
  ];
  $bankFilter = "";
  if ($bankAccountId !== null) {
    $bankFilter = " AND sl.bank_account_id = :bankId";
    $stmtParams[":bankId"] = $bankAccountId;
    $stmtParams[":bankEx"] = $bankAccountId;
  }

  // Add Amount filtering
  $amountFilter = "";
  $minAmount = isset($_GET["min_amount"]) && $_GET["min_amount"] !== "" ? (float) $_GET["min_amount"] : null;
  $maxAmount = isset($_GET["max_amount"]) && $_GET["max_amount"] !== "" ? (float) $_GET["max_amount"] : null;

  if ($minAmount !== null) {
    $amountFilter .= " AND sl.amount >= :minAmount";
    $stmtParams[":minAmount"] = $minAmount;
  }
  if ($maxAmount !== null) {
    $amountFilter .= " AND sl.amount <= :maxAmount";
    $stmtParams[":maxAmount"] = $maxAmount;
  }

  $statementSql = "
    SELECT
      sl.id,
      sl.transfer_at,
      sl.amount,
      sl.bank_account_id,
      sl.bank_display_name,
      sl.channel,
      sl.description,
      sb.company_id
    FROM statement_logs sl
    INNER JOIN statement_batchs sb ON sb.id = sl.batch_id
    WHERE sb.company_id = :companyId
      {$bankFilter}
      {$amountFilter}
      AND sl.transfer_at BETWEEN :startDate AND :endDate
      AND NOT EXISTS (
        SELECT 1
        FROM statement_reconcile_logs srl
        INNER JOIN statement_reconcile_batches srb ON srb.id = srl.batch_id
      WHERE srl.statement_log_id = sl.id
        AND srb.company_id = :companyIdEx" . ($bankAccountId !== null ? " AND srb.bank_account_id = :bankEx" : "") . "
    )
    ORDER BY sl.transfer_at ASC
  ";

  $stmt = $pdo->prepare($statementSql);
  $stmt->execute($stmtParams);
  $statements = [];
  while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $statements[] = [
      "id" => (int) $row["id"],
      "transfer_at" => $row["transfer_at"],
      "amount" => (float) $row["amount"],
      "bank_account_id" => $row["bank_account_id"] !== null ? (int) $row["bank_account_id"] : null,
      "bank_display_name" => $row["bank_display_name"],
      "channel" => $row["channel"],
      "description" => $row["description"],
    ];
  }

  // Candidate transfer orders in range (slightly padded) excluding reconciled ones
  $orderParams = [
    ":companyId" => $companyId,
    ":rangeStart" => date("Y-m-d H:i:s", strtotime($startDate . " -1 day")),
    ":rangeEnd" => date("Y-m-d H:i:s", strtotime($endDate . " +1 day")),
    ":companyRecon" => $companyId,
  ];
  $orderBankFilter = "";
  if ($bankAccountId !== null) {
    $orderBankFilter = " AND (o.bank_account_id = :obankId OR o.bank_account_id IS NULL)";
    $orderParams[":obankId"] = $bankAccountId;
  }

  $orderSql = "
    SELECT
      o.id,
      o.total_amount,
      o.amount_paid,
      COALESCE(r.reconciled_amount, 0) AS reconciled_amount,
      o.payment_status,
      o.payment_method,
      o.transfer_date,
      o.bank_account_id,
      o.order_status,
      o.order_date,
      o.delivery_date,
      o.sales_channel,
      o.notes,
      o.recipient_first_name,
      o.recipient_last_name,
      c.first_name AS customer_first_name,
      c.last_name AS customer_last_name,
      c.phone AS customer_phone,
      u.first_name AS seller_first_name,
      u.last_name AS seller_last_name,
      IFNULL(os.total_slip, 0) AS slip_total,
      os.slip_transfer_date,
      os.slip_bank_account_id,
      oss.slip_items
    FROM orders o
    LEFT JOIN customers c ON c.customer_id = o.customer_id
    LEFT JOIN users u ON u.id = o.creator_id
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
    ORDER BY o.order_date DESC

  ";

  $ordersStmt = $pdo->prepare($orderSql);
  $ordersStmt->execute($orderParams);
  $orders = [];
  while ($row = $ordersStmt->fetch(PDO::FETCH_ASSOC)) {
    $paid = null;
    if ($row["reconciled_amount"] !== null) {
      $paid = (float) $row["reconciled_amount"];
    } elseif ($row["amount_paid"] !== null) {
      $paid = (float) $row["amount_paid"];
    }
    if ($paid === null) {
      $paid = (float) $row["slip_total"];
    }

    $slipItems = [];
    if (!empty($row["slip_items"])) {
      $decoded = json_decode($row["slip_items"], true);
      if (is_array($decoded)) {
        foreach ($decoded as $slip) {
          $slipItems[] = [
            "amount" => isset($slip["amount"]) ? (float) $slip["amount"] : null,
            "transfer_date" => $slip["transfer_date"] ?? null,
            "bank_account_id" => isset($slip["bank_account_id"]) && $slip["bank_account_id"] !== null
              ? (int) $slip["bank_account_id"]
              : null,
          ];
        }
      }
    }

    $orders[] = [
      "id" => $row["id"],
      "total_amount" => (float) $row["total_amount"],
      "amount_paid" => $paid,
      "reconciled_amount" => $row["reconciled_amount"] !== null ? (float) $row["reconciled_amount"] : null,
      "slips" => $slipItems,
      "payment_status" => $row["payment_status"],
      "payment_method" => $row["payment_method"],
      "transfer_date" => $row["transfer_date"],
      "bank_account_id" => $row["bank_account_id"] !== null ? (int) $row["bank_account_id"] : null,
      "order_status" => $row["order_status"],
      "order_date" => $row["order_date"],
      "delivery_date" => $row["delivery_date"],
      "sales_channel" => $row["sales_channel"],
      "notes" => $row["notes"],
      "recipient_first_name" => $row["recipient_first_name"],
      "recipient_last_name" => $row["recipient_last_name"],
      "customer_name" => trim(($row["customer_first_name"] ?? "") . " " . ($row["customer_last_name"] ?? "")),
      "customer_phone" => $row["customer_phone"],
      "seller_name" => trim(($row["seller_first_name"] ?? "") . " " . ($row["seller_last_name"] ?? "")),
      "slip_total" => (float) $row["slip_total"],
      "slip_transfer_date" => $row["slip_transfer_date"],
      "slip_bank_account_id" => $row["slip_bank_account_id"] !== null ? (int) $row["slip_bank_account_id"] : null,
    ];
  }

  echo json_encode(
    [
      "ok" => true,
      "statements" => $statements,
      "orders" => $orders,
      "count" => [
        "statements" => count($statements),
        "orders" => count($orders),
      ],
    ],
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
  );
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(
    [
      "ok" => false,
      "error" => $e->getMessage(),
    ],
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES,
  );
}
