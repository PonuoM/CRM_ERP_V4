<?php
require_once __DIR__ . '/config.php';

header('Content-Type: text/plain; charset=utf-8');

try {
    $pdo = db_connect();
    
    // 1. Get Table Structure
    echo "=== TABLE STRUCTURE: statement_reconcile_logs ===\n";
    $stmt = $pdo->query("DESCRIBE statement_reconcile_logs");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($columns as $col) {
        echo str_pad($col['Field'], 30) . " | " . $col['Type'] . "\n";
    }

    // 2. Get Latest Data
    echo "\n=== LATEST 20 LOG ENTRIES ===\n";
    $stmt = $pdo->query("SELECT * FROM statement_reconcile_logs ORDER BY id DESC LIMIT 20");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (count($rows) === 0) {
        echo "No data found in table.\n";
    } else {
        foreach ($rows as $row) {
            echo "ID: " . $row['id'] . "\n";
            echo "  Order ID (col): [" . ($row['order_id'] ?? 'NULL') . "]\n";
            echo "  Confirmed ID (col): [" . ($row['confirmed_order_id'] ?? 'NULL') . "]\n";
            echo "  Action: [" . ($row['confirmed_action'] ?? 'NULL') . "]\n";
            echo "  Date: " . ($row['confirmed_at'] ?? 'NULL') . "\n";
            echo "--------------------------------------------------\n";
        }
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>
