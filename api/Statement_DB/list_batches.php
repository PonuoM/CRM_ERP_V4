<?php
require_once __DIR__ . '/../config.php';

cors();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
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

  // Ensure detail table (and bank columns) exist for joins
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

  $companyId = isset($_GET['company_id']) ? (int) $_GET['company_id'] : 0;

  $sql = "SELECT 
        sb.id AS batch,
        sb.row_count,
        sb.transfer_min AS transfer_from,
        sb.transfer_max AS transfer_to,
        sb.created_at AS first_at,
        sb.created_at AS last_at,
        agg.bank_account_id,
        COALESCE(agg.bank_display_name, CONCAT_WS(' - ', ba.bank, ba.bank_number)) AS bank_display_name,
        ba.bank AS bank_name,
        ba.bank_number AS bank_number
     FROM statement_batchs sb
     LEFT JOIN (
       SELECT batch_id, MIN(bank_account_id) AS bank_account_id, MAX(bank_display_name) AS bank_display_name
       FROM statement_logs
       GROUP BY batch_id
     ) agg ON agg.batch_id = sb.id
     LEFT JOIN bank_account ba ON ba.id = agg.bank_account_id
     WHERE sb.company_id = ?
     ORDER BY sb.id DESC";

  $stmt = $pdo->prepare($sql);
  $stmt->execute([$companyId]);

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
