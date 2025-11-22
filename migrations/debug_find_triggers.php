<?php
require_once __DIR__ . '/../api/config.php';

try {
    $pdo = db_connect();
    $dbName = $pdo->query("SELECT DATABASE()")->fetchColumn();
    echo "Scanning database: $dbName\n";

    $stmt = $pdo->prepare("
        SELECT TRIGGER_NAME, EVENT_OBJECT_TABLE, ACTION_TIMING, EVENT_MANIPULATION, ACTION_STATEMENT 
        FROM information_schema.TRIGGERS 
        WHERE TRIGGER_SCHEMA = ?
    ");
    $stmt->execute([$dbName]);
    $triggers = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $found = false;
    foreach ($triggers as $trigger) {
        if (stripos($trigger['ACTION_STATEMENT'], 'customer_ref_id') !== false) {
            echo "--------------------------------------------------\n";
            echo "FOUND PROBLEM TRIGGER: " . $trigger['TRIGGER_NAME'] . "\n";
            echo "Table: " . $trigger['EVENT_OBJECT_TABLE'] . "\n";
            echo "Event: " . $trigger['ACTION_TIMING'] . " " . $trigger['EVENT_MANIPULATION'] . "\n";
            echo "Body Snippet: " . substr(str_replace(["\r", "\n"], " ", $trigger['ACTION_STATEMENT']), 0, 200) . "...\n";
            $found = true;
        }
    }

    if (!$found) {
        echo "No triggers found referencing 'customer_ref_id'.\n";
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
