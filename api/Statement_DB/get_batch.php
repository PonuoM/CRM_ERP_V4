<?php
require_once __DIR__ . '/../config.php';

cors();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
}

$batch = isset($_GET['batch']) ? (int) $_GET['batch'] : 0;

if ($batch <= 0) {
  json_response(['ok' => false, 'error' => 'Missing or invalid batch'], 400);
}

function ensure_statement_bank_columns(PDO $pdo): void {
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

try {
  $pdo = db_connect();

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
  ensure_statement_bank_columns($pdo);

  $stmt = $pdo->prepare(
    "SELECT 
        sl.id,
        sl.batch_id,
        DATE(sl.transfer_at) AS entry_date,
        TIME(sl.transfer_at) AS entry_time,
        sl.amount,
        sl.channel,
        sl.description,
        sl.bank_account_id,
        COALESCE(sl.bank_display_name, CONCAT_WS(' - ', ba.bank, ba.bank_number)) AS bank_display_name,
        ba.bank AS bank_name,
        ba.bank_number AS bank_number,
        sl.created_at
     FROM statement_logs sl
     LEFT JOIN bank_account ba ON ba.id = sl.bank_account_id
     WHERE sl.batch_id = :batch
     ORDER BY sl.transfer_at, sl.id"
  );

  $stmt->execute([':batch' => $batch]);
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

  json_response([
    'ok' => true,
    'batch' => $batch,
    'rows' => $rows,
  ]);
} catch (Throwable $e) {
  json_response([
    'ok' => false,
    'error' => 'Failed to get batch details',
    'detail' => $e->getMessage(),
  ], 500);
}
