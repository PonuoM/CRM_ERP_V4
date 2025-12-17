<?php
require_once __DIR__ . '/../config.php';

try {
    $pdo = db_connect();
    $triggers = ['trg_order_status_update', 'trg_tracking_insert', 'trg_tracking_update'];
    
    foreach ($triggers as $trg) {
        $pdo->exec("DROP TRIGGER IF EXISTS $trg");
        echo "Dropped trigger: $trg\n";
    }
    echo "Done.\n";
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
