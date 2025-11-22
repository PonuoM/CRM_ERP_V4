<?php
require_once __DIR__ . '/../api/config.php';

try {
    $pdo = db_connect();
    $stmt = $pdo->prepare("SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE() AND TRIGGER_NAME IN ('activities_customer_ref_bi', 'activities_customer_ref_bu')");
    $stmt->execute();
    $triggers = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    if (empty($triggers)) {
        echo "Verification SUCCESS: Triggers not found.\n";
    } else {
        echo "Verification FAILED: Found triggers: " . implode(', ', $triggers) . "\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
