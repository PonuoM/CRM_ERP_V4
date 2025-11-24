<?php
require_once __DIR__ . '/../api/config.php';

try {
    $pdo = db_connect();
    $triggers = ['customers_before_insert', 'customers_before_update'];
    
    foreach ($triggers as $t) {
        $stmt = $pdo->prepare("SHOW CREATE TRIGGER $t");
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        echo "TRIGGER: $t\n";
        echo $row['SQL Original Statement'] . "\n\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
