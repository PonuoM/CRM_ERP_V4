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

  // Ensure summary and detail tables exist
  $pdo->exec(
    "CREATE TABLE IF NOT EXISTS statement_batchs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      user_id INT NULL,
      row_count INT NOT NULL,
      transfer_min DATETIME NOT NULL,
      transfer_max DATETIME NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_statement_batchs_company_created (company_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"
  );

  // Detail table references batch_id
  $pdo->exec(
    "CREATE TABLE IF NOT EXISTS statement_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      batch_id INT NOT NULL,
      transfer_at DATETIME NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      channel VARCHAR(64) NULL,
      description TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_statement_logs_batch_transfer (batch_id, transfer_at),
      CONSTRAINT fk_statement_logs_batch
        FOREIGN KEY (batch_id) REFERENCES statement_batchs(id)
        ON DELETE CASCADE ON UPDATE NO ACTION
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

    // All rows valid: create batch summary then detail rows in a transaction
    $pdo->beginTransaction();
    try {
      $rowCount = count($preparedRows);
      $transferMin = $preparedRows[0]['transfer_at'];
      $transferMax = $preparedRows[0]['transfer_at'];
      foreach ($preparedRows as $row) {
        if ($row['transfer_at'] < $transferMin) {
          $transferMin = $row['transfer_at'];
        }
        if ($row['transfer_at'] > $transferMax) {
          $transferMax = $row['transfer_at'];
        }
      }

      $batchStmt = $pdo->prepare(
        "INSERT INTO statement_batchs
          (company_id, user_id, row_count, transfer_min, transfer_max, created_at)
         VALUES
          (:company_id, :user_id, :row_count, :transfer_min, :transfer_max, NOW())",
      );
      $batchStmt->execute([
        ':company_id' => (int) $companyId,
        ':user_id' => $userId !== null ? (int) $userId : null,
        ':row_count' => $rowCount,
        ':transfer_min' => $transferMin,
        ':transfer_max' => $transferMax,
      ]);
      $batchId = (int) $pdo->lastInsertId();

      $stmt = $pdo->prepare(
        "INSERT INTO statement_logs
          (batch_id, transfer_at, amount, channel, description)
         VALUES
          (:batch_id, :transfer_at, :amount, :channel, :description)",
      );

      foreach ($preparedRows as $row) {
        $stmt->execute([
          ':batch_id' => $batchId,
          ':transfer_at' => $row['transfer_at'],
          ':amount' => $row['amount'],
          ':channel' => $row['channel'],
          ':description' => $row['description'],
        ]);
      }

      $pdo->commit();
    } catch (Throwable $e) {
      $pdo->rollBack();
      throw $e;
    }

    json_response([
      'ok' => true,
      'batch' => $batchId,
      'inserted' => $rowCount,
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

    // Single row: create one batch summary + one detail row
    $pdo->beginTransaction();
    try {
      $batchStmt = $pdo->prepare(
        "INSERT INTO statement_batchs
          (company_id, user_id, row_count, transfer_min, transfer_max, created_at)
         VALUES
          (:company_id, :user_id, :row_count, :transfer_min, :transfer_max, NOW())",
      );
      $batchStmt->execute([
        ':company_id' => (int) $companyId,
        ':user_id' => $userId !== null ? (int) $userId : null,
        ':row_count' => 1,
        ':transfer_min' => $transferAt,
        ':transfer_max' => $transferAt,
      ]);
      $batchId = (int) $pdo->lastInsertId();

      $stmtSingle = $pdo->prepare(
        "INSERT INTO statement_logs
          (batch_id, transfer_at, amount, channel, description)
         VALUES
          (:batch_id, :transfer_at, :amount, :channel, :description)",
      );
      $stmtSingle->execute([
        ':batch_id' => $batchId,
        ':transfer_at' => $transferAt,
        ':amount' => (float) $amount,
        ':channel' => $channel !== '' ? $channel : null,
        ':description' => $description !== '' ? $description : null,
      ]);

      $pdo->commit();
    } catch (Throwable $e) {
      $pdo->rollBack();
      throw $e;
    }

    json_response([
      'ok' => true,
      'batch' => $batchId,
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
