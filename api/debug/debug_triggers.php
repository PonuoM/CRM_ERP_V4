<?php
require_once __DIR__ . '/config.php';

try {
    $pdo = db_connect();
    
    echo "=== TRIGGERS ===\n";
    $stmt = $pdo->query("SHOW TRIGGERS LIKE 'customers'");
    $triggers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($triggers as $trig) {
        echo "Trigger: " . $trig['Trigger'] . "\n";
        echo "Event: " . $trig['Event'] . "\n";
        echo "Timing: " . $trig['Timing'] . "\n";
        echo "Statement: " . $trig['Statement'] . "\n";
        echo "--------------------------------\n";
    }

    echo "\n=== CONSTRAINTS ===\n";
    // Check for UNIQUE constraints on customer_ref_id
    $stmt = $pdo->query("SHOW CREATE TABLE customers");
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    echo $row['Create Table'] . "\n";

} catch (Throwable $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
