<?php
require_once __DIR__ . '/../config.php';

cors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
}

$input = json_input();

/**
 * Normalize incoming date strings into YYYY-MM-DD.
 * Supports:
 * - YYYY-MM-DD
 * - DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY (also DD/MM/YY with Buddhist year support)
 */
function normalize_request_date(?string $raw): ?string
{
  $value = trim((string) $raw);
  if ($value === '') {
    return null;
  }

  if (preg_match('/^(\\d{4})-(\\d{1,2})-(\\d{1,2})$/', $value, $m)) {
    $y = (int) $m[1];
    $mth = (int) $m[2];
    $d = (int) $m[3];
    if ($y > 0 && $mth >= 1 && $mth <= 12 && $d >= 1 && $d <= 31) {
      return sprintf('%04d-%02d-%02d', $y, $mth, $d);
    }
  }

  if (preg_match('/^(\\d{1,2})[\\/\\.\\-](\\d{1,2})[\\/\\.\\-](\\d{2,4})$/', $value, $m)) {
    $d = (int) $m[1];
    $mth = (int) $m[2];
    $yRaw = (int) $m[3];
    if ($yRaw < 100) {
      $yRaw += 2000;
    } elseif ($yRaw > 2500) {
      // Convert Buddhist years
      $yRaw -= 543;
    }
    if ($yRaw > 0 && $mth >= 1 && $mth <= 12 && $d >= 1 && $d <= 31) {
      return sprintf('%04d-%02d-%02d', $yRaw, $mth, $d);
    }
  }

  return null;
}

/**
 * Validate and combine date + time into a MySQL-compatible DATETIME string.
 * Returns string "Y-m-d H:i:s" if valid, or null if invalid.
 */
function build_valid_transfer_at(?string $date, ?string $time): ?string
{
  $normalizedDate = normalize_request_date($date);
  $timeValue = str_replace('.', ':', trim((string) $time));

  if ($normalizedDate === null || $timeValue === '') {
    return null;
  }

  // Validate time HH:MM or HH:MM:SS
  if (!preg_match('/^(\\d{1,2}):(\\d{2})(?::(\\d{2}))?$/', $timeValue, $m)) {
    return null;
  }
  $h = (int) $m[1];
  $i = (int) $m[2];
  $s = isset($m[3]) ? (int) $m[3] : 0;

  if ($h < 0 || $h > 23 || $i < 0 || $i > 59 || $s < 0 || $s > 59) {
    return null;
  }

  $timeNorm = sprintf('%02d:%02d:%02d', $h, $i, $s);
  return $normalizedDate . ' ' . $timeNorm;
}

function ensure_statement_bank_columns(PDO $pdo): void
{
  $hasBankId = $pdo->query("SHOW COLUMNS FROM statement_logs LIKE 'bank_account_id'")->fetch();
  if (!$hasBankId) {
    $pdo->exec("ALTER TABLE statement_logs ADD COLUMN bank_account_id INT NULL AFTER amount");
  }

  $hasBankName = $pdo->query("SHOW COLUMNS FROM statement_logs LIKE 'bank_display_name'")->fetch();
  if (!$hasBankName) {
    $pdo->exec("ALTER TABLE statement_logs ADD COLUMN bank_display_name VARCHAR(150) NULL AFTER bank_account_id");
  }

  $hasIndex = $pdo->query("SHOW INDEX FROM statement_logs WHERE Key_name = 'idx_statement_logs_bank_date'")->fetch();
  if (!$hasIndex) {
    $pdo->exec("CREATE INDEX idx_statement_logs_bank_date ON statement_logs (bank_account_id, transfer_at)");
  }
}

function fetch_bank_account(PDO $pdo, int $bankAccountId, int $companyId): ?array
{
  $stmt = $pdo->prepare(
    "SELECT id, bank, bank_number
     FROM bank_account
     WHERE id = :id AND company_id = :company_id AND (deleted_at IS NULL) AND (is_active = 1 OR is_active IS NULL)
     LIMIT 1"
  );
  $stmt->execute([
    ':id' => $bankAccountId,
    ':company_id' => $companyId,
  ]);

  $bank = $stmt->fetch(PDO::FETCH_ASSOC);
  return $bank !== false ? $bank : null;
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
      bank_account_id INT NULL,
      bank_display_name VARCHAR(150) NULL,
      channel VARCHAR(64) NULL,
      description TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_statement_logs_batch_transfer (batch_id, transfer_at),
      INDEX idx_statement_logs_bank_date (bank_account_id, transfer_at),
      CONSTRAINT fk_statement_logs_batch
        FOREIGN KEY (batch_id) REFERENCES statement_batchs(id)
        ON DELETE CASCADE ON UPDATE NO ACTION,
      CONSTRAINT fk_statement_logs_bank_account
        FOREIGN KEY (bank_account_id) REFERENCES bank_account(id)
        ON DELETE SET NULL ON UPDATE NO ACTION
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"
  );

  // If the table existed before adding the bank columns, upgrade it now so inserts won't fail.
  ensure_statement_bank_columns($pdo);

  // Normalize incoming payload into a rows array (supports legacy single-row payloads)
  $rowsInput = null;
  if (isset($input['rows']) && is_array($input['rows'])) {
    $rowsInput = $input['rows'];
  } else {
    $singleDate = $input['date'] ?? null;
    $singleTime = $input['time'] ?? null;
    $singleAmount = $input['amount'] ?? null;
    if ($singleDate !== null || $singleTime !== null || $singleAmount !== null) {
      $rowsInput = [
        [
          'date' => $singleDate,
          'time' => $singleTime,
          'amount' => $singleAmount,
          'channel' => $input['channel'] ?? '',
          'description' => $input['description'] ?? '',
        ]
      ];
    }
  }

  $companyId = $input['company_id'] ?? null;
  $userId = $input['user_id'] ?? null;
  $bankAccountId = isset($input['bank_account_id']) ? (int) $input['bank_account_id'] : 0;

  if ($companyId === null || !$rowsInput || $bankAccountId <= 0) {
    json_response(
      [
        'ok' => false,
        'error' => 'Missing required fields',
        'detail' => 'company_id, bank_account_id and rows are required',
      ],
      400,
    );
  }

  $bank = fetch_bank_account($pdo, $bankAccountId, (int) $companyId);
  if ($bank === null) {
    json_response(
      [
        'ok' => false,
        'error' => 'Invalid bank account',
        'detail' => 'Bank account not found for this company or inactive',
      ],
      400,
    );
  }
  $bankDisplayName = trim(($bank['bank'] ?? '') . ' - ' . ($bank['bank_number'] ?? ''));

  // Validate all rows first; if any row is invalid, abort without inserting anything.
  $preparedRows = [];
  $rowIndex = 0;
  foreach ($rowsInput as $row) {
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

    // Strip thousand separators from amount if provided
    $normalizedAmount = str_replace(',', '', (string) $amount);
    if (!is_numeric($normalizedAmount)) {
      json_response(
        [
          'ok' => false,
          'error' => 'Invalid amount',
          'detail' => "Row {$rowIndex}: amount is not a number",
        ],
        400,
      );
    }

    $preparedRows[] = [
      'transfer_at' => $transferAt,
      'transfer_date' => substr($transferAt, 0, 10),
      'amount' => (float) $normalizedAmount,
      'channel' => trim($channel) !== '' ? trim($channel) : null,
      'description' => trim($description) !== '' ? trim($description) : null,
    ];
  }

  // Duplicate detection: bank + transfer date should be unique unless allow_duplicate is set.
  $allowDuplicate = !empty($input['allow_duplicate']);
  $uniqueDates = array_values(array_unique(array_column($preparedRows, 'transfer_date')));
  if (!empty($uniqueDates) && !$allowDuplicate) {
    $placeholders = implode(',', array_fill(0, count($uniqueDates), '?'));
    $checkStmt = $pdo->prepare(
      "SELECT DATE(sl.transfer_at) AS transfer_date
       FROM statement_logs sl
       INNER JOIN statement_batchs sb ON sb.id = sl.batch_id
       WHERE sb.company_id = ?
         AND sl.bank_account_id = ?
         AND DATE(sl.transfer_at) IN ($placeholders)
       GROUP BY DATE(sl.transfer_at)"
    );
    $checkStmt->execute(array_merge([(int) $companyId, $bankAccountId], $uniqueDates));
    $existingDates = $checkStmt->fetchAll(PDO::FETCH_COLUMN);

    if (!empty($existingDates)) {
      $dateList = implode(', ', $existingDates);
      json_response(
        [
          'ok' => false,
          'error' => 'Duplicate import detected',
          'detail' => "มีการนำเข้าข้อมูลของ {$bankDisplayName} ในวันที่ {$dateList} แล้ว ต้องการนำเข้าเพิ่มเติมหรือไม่?",
          'existing_dates' => $existingDates,
          'can_force' => true,
        ],
        409,
      );
    }
  }

  // Group rows by date so each day gets its own batch
  $rowsByDate = [];
  foreach ($preparedRows as $row) {
    $rowsByDate[$row['transfer_date']][] = $row;
  }

  $pdo->beginTransaction();
  try {
    $batchStmt = $pdo->prepare(
      "INSERT INTO statement_batchs
        (company_id, user_id, row_count, transfer_min, transfer_max, created_at)
       VALUES
        (:company_id, :user_id, :row_count, :transfer_min, :transfer_max, NOW())"
    );

    $logStmt = $pdo->prepare(
      "INSERT INTO statement_logs
        (batch_id, transfer_at, amount, bank_account_id, bank_display_name, channel, description)
       VALUES
        (:batch_id, :transfer_at, :amount, :bank_account_id, :bank_display_name, :channel, :description)"
    );

    $createdBatches = [];
    $totalInserted = 0;

    foreach ($rowsByDate as $dateKey => $dateRows) {
      $transferTimes = array_column($dateRows, 'transfer_at');
      $transferMin = min($transferTimes);
      $transferMax = max($transferTimes);
      $rowCount = count($dateRows);

      $batchStmt->execute([
        ':company_id' => (int) $companyId,
        ':user_id' => $userId !== null ? (int) $userId : null,
        ':row_count' => $rowCount,
        ':transfer_min' => $transferMin,
        ':transfer_max' => $transferMax,
      ]);
      $batchId = (int) $pdo->lastInsertId();

      foreach ($dateRows as $row) {
        $logStmt->execute([
          ':batch_id' => $batchId,
          ':transfer_at' => $row['transfer_at'],
          ':amount' => $row['amount'],
          ':bank_account_id' => $bankAccountId,
          ':bank_display_name' => $bankDisplayName !== '' ? $bankDisplayName : null,
          ':channel' => $row['channel'],
          ':description' => $row['description'],
        ]);
      }

      $createdBatches[] = [
        'batch_id' => $batchId,
        'transfer_date' => $dateKey,
        'row_count' => $rowCount,
        'transfer_min' => $transferMin,
        'transfer_max' => $transferMax,
      ];
      $totalInserted += $rowCount;
    }

    $pdo->commit();

    json_response([
      'ok' => true,
      'batch' => $createdBatches[0]['batch_id'] ?? null,
      'batches' => $createdBatches,
      'inserted' => $totalInserted,
      'bank_account_id' => $bankAccountId,
    ]);
  } catch (Throwable $e) {
    $pdo->rollBack();
    throw $e;
  }
} catch (Throwable $e) {
  json_response([
    'ok' => false,
    'error' => 'Failed to save statement log',
    'detail' => $e->getMessage(),
  ], 500);
}
