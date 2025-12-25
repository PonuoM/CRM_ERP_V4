<?php
require_once __DIR__ . "/../config.php";

try {
    $pdo = db_connect();
    echo "Checking statement_reconcile_logs table...\n";

    // Check if column exists
    $stmt = $pdo->prepare("SHOW COLUMNS FROM statement_reconcile_logs LIKE 'note'");
    $stmt->execute();
    if ($stmt->fetch()) {
        echo "Column 'note' already exists.\n";
    } else {
        echo "Adding 'note' column...\n";
        $pdo->exec("ALTER TABLE statement_reconcile_logs ADD COLUMN note TEXT NULL AFTER auto_matched");
        echo "Column 'note' added successfully.\n";
    }

} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
