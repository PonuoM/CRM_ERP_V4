<?php
header("Content-Type: text/plain");
require_once "../config.php";

if (!defined("RECONCILE_CHARSET")) {
    define("RECONCILE_CHARSET", "utf8mb4");
    define("RECONCILE_COLLATION", "utf8mb4_0900_ai_ci");
}

try {
    $pdo = db_connect();
    echo "Connected to database.\n";
    $charset = RECONCILE_CHARSET;
    $collation = RECONCILE_COLLATION;
    
    // Drop foreign keys to allow conversion
    $fks = [
        "statement_reconcile_logs" => ["fk_statement_reconcile_order", "fk_statement_reconcile_batch", "fk_statement_reconcile_statement"],
        "statement_reconcile_batches" => ["fk_statement_reconcile_bank"]
    ];

    foreach ($fks as $table => $keys) {
        foreach ($keys as $key) {
            try {
                $pdo->exec("ALTER TABLE $table DROP FOREIGN KEY $key");
                echo "Dropped FK $key from $table\n";
            } catch (PDOException $e) {
                echo "FK $key might not exist or already dropped: " . $e->getMessage() . "\n";
            }
        }
    }

    // Convert tables
    echo "Converting statement_reconcile_batches to {$collation}...\n";
    $pdo->exec("ALTER TABLE statement_reconcile_batches CONVERT TO CHARACTER SET {$charset} COLLATE {$collation}");
    
    echo "Converting statement_reconcile_logs to {$collation}...\n";
    $pdo->exec("ALTER TABLE statement_reconcile_logs CONVERT TO CHARACTER SET {$charset} COLLATE {$collation}");

    // Re-add Foreign Keys
    echo "Re-adding Foreign Keys...\n";
    
    try {
      $pdo->exec("ALTER TABLE statement_reconcile_batches ADD CONSTRAINT fk_statement_reconcile_bank FOREIGN KEY (bank_account_id) REFERENCES bank_account(id) ON DELETE SET NULL ON UPDATE NO ACTION");
      echo "Added fk_statement_reconcile_bank\n";
    } catch (PDOException $e) { echo "Error adding fk_statement_reconcile_bank: " . $e->getMessage() . "\n"; }

    try {
      $pdo->exec("ALTER TABLE statement_reconcile_logs ADD CONSTRAINT fk_statement_reconcile_batch FOREIGN KEY (batch_id) REFERENCES statement_reconcile_batches(id) ON DELETE CASCADE ON UPDATE NO ACTION");
      echo "Added fk_statement_reconcile_batch\n";
    } catch (PDOException $e) { echo "Error adding fk_statement_reconcile_batch: " . $e->getMessage() . "\n"; }

    try {
      $pdo->exec("ALTER TABLE statement_reconcile_logs ADD CONSTRAINT fk_statement_reconcile_statement FOREIGN KEY (statement_log_id) REFERENCES statement_logs(id) ON DELETE CASCADE ON UPDATE NO ACTION");
      echo "Added fk_statement_reconcile_statement\n";
    } catch (PDOException $e) { echo "Error adding fk_statement_reconcile_statement: " . $e->getMessage() . "\n"; }

    try {
      $pdo->exec("ALTER TABLE statement_reconcile_logs ADD CONSTRAINT fk_statement_reconcile_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE ON UPDATE NO ACTION");
      echo "Added fk_statement_reconcile_order\n";
    } catch (PDOException $e) { echo "Error adding fk_statement_reconcile_order: " . $e->getMessage() . "\n"; }

    echo "\nDone! Please run verify_collation_fix.php to confirm.\n";
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
