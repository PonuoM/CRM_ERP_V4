<?php
require_once __DIR__ . '/../config.php';

try {
    $pdo = db_connect();
    
    // Check if column exists
    $stmt = $pdo->query("SHOW COLUMNS FROM products LIKE 'deleted_at'");
    $exists = $stmt->fetch();
    
    if (!$exists) {
        $pdo->exec("ALTER TABLE products ADD COLUMN deleted_at DATETIME DEFAULT NULL");
        echo "Column 'deleted_at' added successfully.\n";
    } else {
        echo "Column 'deleted_at' already exists.\n";
    }
    
    echo "Migration completed.";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
