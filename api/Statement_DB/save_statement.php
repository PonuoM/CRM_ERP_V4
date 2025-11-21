<?php
require_once __DIR__ . '/../config.php';

cors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
}

$input = json_input();

try {
  $pdo = db_connect();

  // Ensure table exists (idempotent)
  $pdo->exec(
    "CREATE TABLE IF NOT EXISTS statement_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      user_id INT NULL,
      batch INT NOT NULL DEFAULT 1,
      entry_date DATE NOT NULL,
      entry_time TIME NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      channel VARCHAR(64) NULL,
      description TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_statement_logs_company_date (company_id, entry_date),
      INDEX idx_statement_logs_batch (batch)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"
  );

  // Multi-row mode: expect rows[] from client
  if (isset($input['rows']) && is_array($input['rows'])) {
    $rows = $input['rows'];
    $companyId = $input['company_id'] ?? null;
    $userId = $input['user_id'] ?? null;

    if ($companyId === null || empty($rows)) {
      json_response(
        ['ok' => false, 'error' => 'Missing company_id or rows'],
        400,
      );
    }

    // Determine batch for this round (same for all rows in this request)
    $batchStmt = $pdo->query(
      "SELECT COALESCE(MAX(batch), 0) + 1 AS next_batch FROM statement_logs",
    );
    $batchRow = $batchStmt->fetch(PDO::FETCH_ASSOC);
    $batch = (int) ($batchRow['next_batch'] ?? 1);

    $stmt = $pdo->prepare(
      "INSERT INTO statement_logs
        (company_id, user_id, batch, entry_date, entry_time, amount, channel, description)
       VALUES
        (:company_id, :user_id, :batch, :entry_date, :entry_time, :amount, :channel, :description)",
    );

    $inserted = 0;
    foreach ($rows as $row) {
      $date = $row['date'] ?? null;
      $time = $row['time'] ?? null;
      $amount = $row['amount'] ?? null;
      $channel = $row['channel'] ?? '';
      $description = $row['description'] ?? '';

      if (!$date || !$time || $amount === null) {
        continue;
      }

      $stmt->execute([
        ':company_id' => (int) $companyId,
        ':user_id' => $userId !== null ? (int) $userId : null,
        ':batch' => $batch,
        ':entry_date' => $date,
        ':entry_time' => $time,
        ':amount' => (float) $amount,
        ':channel' => $channel !== '' ? $channel : null,
        ':description' => $description !== '' ? $description : null,
      ]);
      $inserted++;
    }

    json_response([
      'ok' => true,
      'batch' => $batch,
      'inserted' => $inserted,
    ]);
  } else {
    // Backwards-compatible single-row mode (not used by current UI)
    $date = $input['date'] ?? null;
    $time = $input['time'] ?? null;
    $amount = $input['amount'] ?? null;
    $channel = $input['channel'] ?? '';
    $description = $input['description'] ?? '';
    $companyId = $input['company_id'] ?? null;
    $userId = $input['user_id'] ?? null;

    if (!$date || !$time || $amount === null || $companyId === null) {
      json_response(
        ['ok' => false, 'error' => 'Missing required fields'],
        400,
      );
    }

    $batchStmt = $pdo->query(
      "SELECT COALESCE(MAX(batch), 0) + 1 AS next_batch FROM statement_logs",
    );
    $batchRow = $batchStmt->fetch(PDO::FETCH_ASSOC);
    $batch = (int) ($batchRow['next_batch'] ?? 1);

    $stmt = $pdo->prepare(
      "INSERT INTO statement_logs
        (company_id, user_id, batch, entry_date, entry_time, amount, channel, description)
       VALUES
        (:company_id, :user_id, :batch, :entry_date, :entry_time, :amount, :channel, :description)",
    );

    $stmt->execute([
      ':company_id' => (int) $companyId,
      ':user_id' => $userId !== null ? (int) $userId : null,
      ':batch' => $batch,
      ':entry_date' => $date,
      ':entry_time' => $time,
      ':amount' => (float) $amount,
      ':channel' => $channel !== '' ? $channel : null,
      ':description' => $description !== '' ? $description : null,
    ]);

    json_response([
      'ok' => true,
      'batch' => $batch,
      'inserted' => 1,
    ]);
  }
} catch (Throwable $e) {
  json_response([
    'ok' => false,
    'error' => 'Failed to save statement log',
    'detail' => $e->getMessage(),
  ], 500);
}
