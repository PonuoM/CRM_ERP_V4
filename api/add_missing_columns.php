<?php
require_once __DIR__ . '/config.php';

try {
    $pdo = db_connect();
    
    // Add last_call_note if not exists
    $stmt = $pdo->query("SHOW COLUMNS FROM customers LIKE 'last_call_note'");
    if (!$stmt->fetch()) {
        echo "Adding column 'last_call_note'...\n";
        $pdo->exec("ALTER TABLE customers ADD COLUMN last_call_note TEXT DEFAULT NULL");
        echo "Column 'last_call_note' added successfully.\n";
    } else {
        echo "Column 'last_call_note' already exists.\n";
    }

    // Add last_call_date if not exists
    $stmt = $pdo->query("SHOW COLUMNS FROM customers LIKE 'last_call_date'");
    if (!$stmt->fetch()) {
        echo "Adding column 'last_call_date'...\n";
        $pdo->exec("ALTER TABLE customers ADD COLUMN last_call_date DATETIME DEFAULT NULL");
        echo "Column 'last_call_date' added successfully.\n";
    } else {
        echo "Column 'last_call_date' already exists.\n";
    }
    
    echo "Schema migration completed successfully.\n";

} catch (PDOException $e) {
    echo "Database error: " . $e->getMessage() . "\n";
    exit(1);
} catch (Throwable $e) {
    echo "General error: " . $e->getMessage() . "\n";
    exit(1);
}
