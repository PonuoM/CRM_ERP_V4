<?php
require_once __DIR__ . '/../config.php';

cors();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
}

try {
  $pdo = db_connect();

  // Ensure summary table exists so queries don't fail on fresh DB
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

  $stmt = $pdo->query(
    "SELECT 
        id AS batch,
        row_count,
        transfer_min AS transfer_from,
        transfer_max AS transfer_to,
        created_at AS first_at,
        created_at AS last_at
     FROM statement_batchs
     ORDER BY id DESC"
  );

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
