<?php
require_once __DIR__ . '/config.php';
header('Content-Type: text/plain; charset=utf-8');

try {
    $pdo = db_connect();
    
    echo "--- TRIGGERS ON order_boxes ---\n";
    $stmt = $pdo->query("SHOW TRIGGERS LIKE 'order_boxes'");
    $triggers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($triggers)) {
        echo "No triggers found on order_boxes.\n";
    } else {
        foreach ($triggers as $trig) {
            echo "Trigger: " . $trig['Trigger'] . "\n";
            echo "Timing: " . $trig['Timing'] . "\n";
            echo "Event: " . $trig['Event'] . "\n";
            
            // Fetch detailed statement
            $stmt2 = $pdo->query("SHOW CREATE TRIGGER " . $trig['Trigger']);
            $row = $stmt2->fetch(PDO::FETCH_ASSOC);
            echo "Body:\n" . $row['SQL Original Statement'] . "\n";
            echo "--------------------------------------------------\n";
        }
    }
    
} catch (Throwable $e) {
    echo "Error: " . $e->getMessage();
}
