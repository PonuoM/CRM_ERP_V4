<?php
require_once __DIR__ . '/../api/config.php';

function check_triggers($pdo, $table) {
    echo "Checking triggers for table: $table\n";
    $stmt = $pdo->prepare("SHOW TRIGGERS WHERE `Table` = ?");
    $stmt->execute([$table]);
    $triggers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($triggers)) {
        echo "  No triggers found.\n";
    } else {
        foreach ($triggers as $t) {
            echo "  Found trigger: " . $t['Trigger'] . "\n";
            // Get definition
            $stmtDef = $pdo->prepare("SHOW CREATE TRIGGER " . $t['Trigger']);
            $stmtDef->execute();
            $def = $stmtDef->fetch(PDO::FETCH_ASSOC);
            $body = $def['SQL Original Statement'];
            
            if (stripos($body, 'customer_ref_id') !== false) {
                echo "    !!! CONTAINS customer_ref_id !!!\n";
                echo "    Body snippet: " . substr(str_replace(["\r", "\n"], " ", $body), 0, 100) . "...\n";
            } else {
                echo "    (Clean)\n";
            }
        }
    }
    echo "\n";
}

try {
    $pdo = db_connect();
    check_triggers($pdo, 'activities');
    check_triggers($pdo, 'orders');
    check_triggers($pdo, 'customers');
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
