<?php
require_once __DIR__ . '/api/config.php';

try {
    $pdo = db_connect();
    
    echo "--- All Triggers on customers ---\n";
    $stmt = $pdo->query("SHOW TRIGGERS WHERE `Table` = 'customers'");
    $triggers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($triggers as $t) {
        echo "Trigger: " . $t['Trigger'] . "\n";
        echo "Timing: " . $t['Timing'] . "\n";
        echo "Event: " . $t['Event'] . "\n";
        echo "Statement:\n" . $t['Statement'] . "\n";
        echo "--------------------------------\n";
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
