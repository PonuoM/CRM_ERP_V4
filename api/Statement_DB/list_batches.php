<?php
require_once __DIR__ . '/../config.php';

cors();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
}

try {
  $pdo = db_connect();

  // Ensure table exists so queries don't fail on fresh DB
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

  // Prefer new transfer_at column; fall back to entry_at or entry_date/entry_time if needed
  $hasTransferAt = false;
  $hasEntryAt = false;

  $colStmt = $pdo->query("SHOW COLUMNS FROM statement_logs LIKE 'transfer_at'");
  if ($colStmt !== false && $colStmt->fetch(PDO::FETCH_ASSOC)) {
    $hasTransferAt = true;
  } else {
    $colStmt = $pdo->query("SHOW COLUMNS FROM statement_logs LIKE 'entry_at'");
    if ($colStmt !== false && $colStmt->fetch(PDO::FETCH_ASSOC)) {
      $hasEntryAt = true;
    }
  }

  if ($hasTransferAt) {
    $stmt = $pdo->query(
      "SELECT 
        batch,
        COUNT(*) AS row_count,
        MIN(transfer_at) AS transfer_from,
        MAX(transfer_at) AS transfer_to,
        MIN(created_at) AS first_at,
        MAX(created_at) AS last_at
       FROM statement_logs
       GROUP BY batch
       ORDER BY batch DESC"
    );
  } elseif ($hasEntryAt) {
    $stmt = $pdo->query(
      "SELECT 
        batch,
        COUNT(*) AS row_count,
        MIN(entry_at) AS transfer_from,
        MAX(entry_at) AS transfer_to,
        MIN(created_at) AS first_at,
        MAX(created_at) AS last_at
       FROM statement_logs
       GROUP BY batch
       ORDER BY batch DESC"
    );
  } else {
    $stmt = $pdo->query(
      "SELECT 
        batch,
        COUNT(*) AS row_count,
        MIN(CONCAT(entry_date, ' ', entry_time)) AS transfer_from,
        MAX(CONCAT(entry_date, ' ', entry_time)) AS transfer_to,
        MIN(created_at) AS first_at,
        MAX(created_at) AS last_at
       FROM statement_logs
       GROUP BY batch
       ORDER BY batch DESC"
    );
  }

  $batches = $stmt->fetchAll(PDO::FETCH_ASSOC);

  json_response([
    'ok' => true,
    'batches' => $batches,
  ]);
} catch (Throwable $e) {
  json_response([
    'ok' => false,
    'error' => 'Failed to list batches',
    'detail' => $e->getMessage(),
  ], 500);
}
