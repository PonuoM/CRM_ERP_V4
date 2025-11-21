<?php
require_once __DIR__ . '/../config.php';

cors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
}

$input = json_input();

$date = $input['date'] ?? null;        // YYYY-MM-DD
$time = $input['time'] ?? null;        // HH:MM or HH:MM:SS
$amount = $input['amount'] ?? null;    // number
$channel = $input['channel'] ?? '';
$description = $input['description'] ?? '';
$companyId = $input['company_id'] ?? null;
$userId = $input['user_id'] ?? null;

if (!$date || !$time || $amount === null || $companyId === null) {
  json_response([
    'ok' => false,
    'error' => 'Missing required fields',
  ], 400);
}

try {
  $pdo = db_connect();

  // Ensure table exists (idempotent)
  $pdo->exec(
    "CREATE TABLE IF NOT EXISTS statement_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      user_id INT NULL,
      entry_date DATE NOT NULL,
      entry_time TIME NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      channel VARCHAR(64) NULL,
      description TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_statement_logs_company_date (company_id, entry_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"
  );

  $stmt = $pdo->prepare(
    "INSERT INTO statement_logs
      (company_id, user_id, entry_date, entry_time, amount, channel, description)
     VALUES
      (:company_id, :user_id, :entry_date, :entry_time, :amount, :channel, :description)"
  );

  $stmt->execute([
    ':company_id' => (int) $companyId,
    ':user_id' => $userId !== null ? (int) $userId : null,
    ':entry_date' => $date,
    ':entry_time' => $time,
    ':amount' => (float) $amount,
    ':channel' => $channel !== '' ? $channel : null,
    ':description' => $description !== '' ? $description : null,
  ]);

  json_response([
    'ok' => true,
    'id' => (int) $pdo->lastInsertId(),
  ]);
} catch (Throwable $e) {
  json_response([
    'ok' => false,
    'error' => 'Failed to save statement log',
    'detail' => $e->getMessage(),
  ], 500);
}

