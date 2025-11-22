<?php
require_once __DIR__ . '/../api/config.php';

try {
    $pdo = db_connect();
    $dbName = $pdo->query("SELECT DATABASE()")->fetchColumn();
    echo "Connected to database: $dbName\n";

    // Force drop triggers
    echo "Dropping triggers...\n";
    $pdo->exec("DROP TRIGGER IF EXISTS activities_customer_ref_bi");
    $pdo->exec("DROP TRIGGER IF EXISTS activities_customer_ref_bu");
    echo "Drop commands executed.\n";

    // List ALL triggers to verify
    echo "Listing all remaining triggers:\n";
    $stmt = $pdo->prepare("SELECT TRIGGER_NAME, EVENT_OBJECT_TABLE FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = ?");
    $stmt->execute([$dbName]);
    $triggers = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($triggers)) {
        echo "No triggers found in database.\n";
    } else {
        foreach ($triggers as $t) {
            $stmtBody = $pdo->prepare("SELECT ACTION_STATEMENT FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = ? AND TRIGGER_NAME = ?");
            $stmtBody->execute([$dbName, $t['TRIGGER_NAME']]);
            $body = $stmtBody->fetchColumn();
            
            if (stripos($body, 'customer_ref_id') !== false) {
                if ($t['EVENT_OBJECT_TABLE'] !== 'customers') {
                    echo "PROBLEM: " . $t['TRIGGER_NAME'] . "\n";
                }
            }
        }
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
