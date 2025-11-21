<?php
require_once __DIR__ . '/../config.php';

cors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
}

$input = json_input();

/**
 * Validate and combine date + time into a MySQL-compatible DATETIME string.
 * Returns string "Y-m-d H:i:s" if valid, or null if invalid.
 */
function build_valid_transfer_at(?string $date, ?string $time): ?string {
  $date = trim((string) $date);
  $time = trim((string) $time);

  if ($date === '' || $time === '') {
    return null;
  }

  // Validate date
  $dtDate = DateTime::createFromFormat('Y-m-d', $date);
  $dateErrors = DateTime::getLastErrors();
  if ($dtDate === false || $dateErrors['warning_count'] > 0 || $dateErrors['error_count'] > 0) {
    return null;
  }

  // Validate time HH:MM or HH:MM:SS
  if (!preg_match('/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/', $time, $m)) {
    return null;
  }
  $h = (int) $m[1];
  $i = (int) $m[2];
  $s = isset($m[3]) ? (int) $m[3] : 0;

  // Hour 0–23, minute 0–59, second 0–59
  if ($h < 0 || $h > 23 || $i < 0 || $i > 59 || $s < 0 || $s > 59) {
    return null;
  }

  $timeNorm = sprintf('%02d:%02d:%02d', $h, $i, $s);
  return $date . ' ' . $timeNorm;
}

try {
  $pdo = db_connect();

  // Ensure table exists (idempotent) - new structure uses single transfer_at column
  $pdo->exec(
    "CREATE TABLE IF NOT EXISTS statement_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      user_id INT NULL,
      batch INT NOT NULL DEFAULT 1,
      transfer_at DATETIME NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      channel VARCHAR(64) NULL,
      description TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_statement_logs_company_date (company_id, transfer_at),
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

    // Check whether new column transfer_at (preferred) or legacy entry_at exists
    $hasTransferAt = false;
    $hasEntryAt = false;

    $colStmt = $pdo->query(
      "SHOW COLUMNS FROM statement_logs LIKE 'transfer_at'",
    );
    if ($colStmt !== false && $colStmt->fetch(PDO::FETCH_ASSOC)) {
      $hasTransferAt = true;
    } else {
      $colStmt = $pdo->query(
        "SHOW COLUMNS FROM statement_logs LIKE 'entry_at'",
      );
      if ($colStmt !== false && $colStmt->fetch(PDO::FETCH_ASSOC)) {
        $hasEntryAt = true;
      }
    }

    // Validate all rows first; if any row is invalid, abort without inserting anything.
    $preparedRows = [];
    $rowIndex = 0;
    foreach ($rows as $row) {
      $rowIndex++;
      $date = $row['date'] ?? null;
      $time = $row['time'] ?? null;
      $amount = $row['amount'] ?? null;
      $channel = $row['channel'] ?? '';
      $description = $row['description'] ?? '';

      if ($date === null || $time === null || $amount === null) {
        json_response(
          [
            'ok' => false,
            'error' => 'Invalid row data',
            'detail' => "Row {$rowIndex}: missing date, time or amount",
          ],
          400,
        );
      }

      $transferAt = build_valid_transfer_at($date, $time);
      if ($transferAt === null) {
        json_response(
          [
            'ok' => false,
            'error' => 'Invalid date or time format',
            'detail' => "Row {$rowIndex}: invalid date/time '{$date} {$time}'",
          ],
          400,
        );
      }

      $preparedRows[] = [
        'transfer_at' => $transferAt,
        'date' => $date,
        'time' => $time,
        'amount' => (float) $amount,
        'channel' => $channel !== '' ? $channel : null,
        'description' => $description !== '' ? $description : null,
      ];
    }

    // All rows are valid: determine batch and perform inserts
    $batchStmt = $pdo->query(
      "SELECT COALESCE(MAX(batch), 0) + 1 AS next_batch FROM statement_logs",
    );
    $batchRow = $batchStmt->fetch(PDO::FETCH_ASSOC);
    $batch = (int) ($batchRow['next_batch'] ?? 1);

    if ($hasTransferAt || $hasEntryAt) {
      $stmt = $pdo->prepare(
        "INSERT INTO statement_logs
          (company_id, user_id, batch, " . ($hasTransferAt ? "transfer_at" : "entry_at") . ", amount, channel, description)
         VALUES
          (:company_id, :user_id, :batch, :transfer_at, :amount, :channel, :description)",
      );
    } else {
      // Legacy structure with entry_date + entry_time
      $stmt = $pdo->prepare(
        "INSERT INTO statement_logs
          (company_id, user_id, batch, entry_date, entry_time, amount, channel, description)
         VALUES
          (:company_id, :user_id, :batch, :entry_date, :entry_time, :amount, :channel, :description)",
      );
    }

    $inserted = 0;
    foreach ($preparedRows as $row) {
      if ($hasTransferAt || $hasEntryAt) {
        $stmt->execute([
          ':company_id' => (int) $companyId,
          ':user_id' => $userId !== null ? (int) $userId : null,
          ':batch' => $batch,
          ':transfer_at' => $row['transfer_at'],
          ':amount' => $row['amount'],
          ':channel' => $row['channel'],
          ':description' => $row['description'],
        ]);
      } else {
        $stmt->execute([
          ':company_id' => (int) $companyId,
          ':user_id' => $userId !== null ? (int) $userId : null,
          ':batch' => $batch,
          ':entry_date' => $row['date'],
          ':entry_time' => $row['time'],
          ':amount' => $row['amount'],
          ':channel' => $row['channel'],
          ':description' => $row['description'],
        ]);
      }
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

    $transferAt = build_valid_transfer_at($date, $time);
    if ($transferAt === null) {
      json_response(
        ['ok' => false, 'error' => 'Invalid date or time format'],
        400,
      );
    }

    $batchStmt = $pdo->query(
      "SELECT COALESCE(MAX(batch), 0) + 1 AS next_batch FROM statement_logs",
    );
    $batchRow = $batchStmt->fetch(PDO::FETCH_ASSOC);
    $batch = (int) ($batchRow['next_batch'] ?? 1);

    if (!isset($hasTransferAt) || !isset($hasEntryAt)) {
      // When coming from single-row path, detect columns again
      $hasTransferAt = false;
      $hasEntryAt = false;
      $colStmt = $pdo->query(
        "SHOW COLUMNS FROM statement_logs LIKE 'transfer_at'",
      );
      if ($colStmt !== false && $colStmt->fetch(PDO::FETCH_ASSOC)) {
        $hasTransferAt = true;
      } else {
        $colStmt = $pdo->query(
          "SHOW COLUMNS FROM statement_logs LIKE 'entry_at'",
        );
        if ($colStmt !== false && $colStmt->fetch(PDO::FETCH_ASSOC)) {
          $hasEntryAt = true;
        }
      }
    }

    if ($hasTransferAt || $hasEntryAt) {
      $stmtSingle = $pdo->prepare(
        "INSERT INTO statement_logs
          (company_id, user_id, batch, " . ($hasTransferAt ? "transfer_at" : "entry_at") . ", amount, channel, description)
         VALUES
          (:company_id, :user_id, :batch, :transfer_at, :amount, :channel, :description)",
      );
      $stmtSingle->execute([
        ':company_id' => (int) $companyId,
        ':user_id' => $userId !== null ? (int) $userId : null,
        ':batch' => $batch,
        ':transfer_at' => $transferAt,
        ':amount' => (float) $amount,
        ':channel' => $channel !== '' ? $channel : null,
        ':description' => $description !== '' ? $description : null,
      ]);
    } else {
      $stmtSingle = $pdo->prepare(
        "INSERT INTO statement_logs
          (company_id, user_id, batch, entry_date, entry_time, amount, channel, description)
         VALUES
          (:company_id, :user_id, :batch, :entry_date, :entry_time, :amount, :channel, :description)",
      );
      $stmtSingle->execute([
        ':company_id' => (int) $companyId,
        ':user_id' => $userId !== null ? (int) $userId : null,
        ':batch' => $batch,
        ':entry_date' => $date,
        ':entry_time' => $time,
        ':amount' => (float) $amount,
        ':channel' => $channel !== '' ? $channel : null,
        ':description' => $description !== '' ? $description : null,
      ]);
    }

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
