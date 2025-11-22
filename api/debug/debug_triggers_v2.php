<?php
require_once __DIR__ . '/config.php';

try {
    $pdo = db_connect();
    
    echo "=== TRIGGER: customers_before_update ===\n";
    $stmt = $pdo->prepare("SELECT ACTION_STATEMENT FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE() AND TRIGGER_NAME = 'customers_before_update'");
    $stmt->execute();
    $body = $stmt->fetchColumn();
    echo $body ? $body : "Trigger not found";
    echo "\n\n";

    echo "=== TRIGGER: customers_before_insert ===\n";
    $stmt = $pdo->prepare("SELECT ACTION_STATEMENT FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE() AND TRIGGER_NAME = 'customers_before_insert'");
    $stmt->execute();
    $body = $stmt->fetchColumn();
    echo $body ? $body : "Trigger not found";
    echo "\n\n";

    echo "=== UNIQUE KEYS ===\n";
    $stmt = $pdo->query("SHOW INDEX FROM customers WHERE Key_name LIKE '%ref_id%' OR Non_unique = 0");
    $indexes = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($indexes as $idx) {
        echo "Key: " . $idx['Key_name'] . ", Column: " . $idx['Column_name'] . ", Unique: " . ($idx['Non_unique'] == 0 ? 'YES' : 'NO') . "\n";
    }

} catch (Throwable $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
