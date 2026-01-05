<?php
require_once __DIR__ . '/../config.php';
try {
    $pdo = db_connect();
    $stmt = $pdo->query("SHOW TABLES LIKE 'marketing_user_product'");
    $exists = $stmt->fetch();
    echo "Table marketing_user_product: " . ($exists ? "EXISTS" : "MISSING") . "\n";
    
    if ($exists) {
        $stmt = $pdo->query("SHOW COLUMNS FROM marketing_user_product");
        print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
