<?php
require_once __DIR__ . '/../api/config.php';

try {
    $pdo = db_connect();
    $dbName = $pdo->query("SELECT DATABASE()")->fetchColumn();
    echo "Scanning database: $dbName\n";

    // Select only necessary columns to avoid large data transfer issues
    $stmt = $pdo->prepare("
        SELECT TRIGGER_NAME, EVENT_OBJECT_TABLE 
        FROM information_schema.TRIGGERS 
        WHERE TRIGGER_SCHEMA = ?
    ");
    $stmt->execute([$dbName]);
    $triggers = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo "Found " . count($triggers) . " triggers. Checking content...\n";

    $found = false;
    foreach ($triggers as $trigger) {
        // Fetch body individually to avoid timeout/memory issues
        $stmtBody = $pdo->prepare("
            SELECT ACTION_STATEMENT 
            FROM information_schema.TRIGGERS 
            WHERE TRIGGER_SCHEMA = ? AND TRIGGER_NAME = ?
        ");
        $stmtBody->execute([$dbName, $trigger['TRIGGER_NAME']]);
        $body = $stmtBody->fetchColumn();

        if (stripos($body, 'customer_ref_id') !== false) {
            echo "--------------------------------------------------\n";
            echo "FOUND PROBLEM TRIGGER: " . $trigger['TRIGGER_NAME'] . "\n";
            echo "Table: " . $trigger['EVENT_OBJECT_TABLE'] . "\n";
            $found = true;
        }
    }

    if (!$found) {
        echo "No triggers found referencing 'customer_ref_id'.\n";
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
