<?php
require_once __DIR__ . '/config.php';

try {
    $pdo = db_connect();
    
    // Check for ai_score column
    $stmt = $pdo->query("SHOW COLUMNS FROM customers LIKE 'ai_score'");
    if (!$stmt->fetch()) {
        echo "Adding ai_score...\n";
        $pdo->exec("ALTER TABLE customers ADD COLUMN ai_score INT DEFAULT NULL");
    }

    // Check for ai_reason_thai column
    $stmt = $pdo->query("SHOW COLUMNS FROM customers LIKE 'ai_reason_thai'");
    if (!$stmt->fetch()) {
        echo "Adding ai_reason_thai...\n";
        $pdo->exec("ALTER TABLE customers ADD COLUMN ai_reason_thai TEXT DEFAULT NULL");
    }

    // Check for ai_last_updated column
    $stmt = $pdo->query("SHOW COLUMNS FROM customers LIKE 'ai_last_updated'");
    if (!$stmt->fetch()) {
        echo "Adding ai_last_updated...\n";
        $pdo->exec("ALTER TABLE customers ADD COLUMN ai_last_updated DATETIME DEFAULT NULL");
    }

    echo "Schema updated successfully.\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
