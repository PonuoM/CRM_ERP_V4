<?php
require_once __DIR__ . '/config.php';

function testColumnExists(PDO $pdo, string $table, string $column) {
    echo "Testing $table.$column:\n";
    
    // Method 1: Prepare + Execute
    try {
        $stmt = $pdo->prepare("SHOW COLUMNS FROM `$table` LIKE ?");
        $stmt->execute([$column]);
        $res = $stmt->fetch();
        echo "  Method 1 (Prepare): " . ($res ? "FOUND" : "NOT FOUND") . "\n";
    } catch (Throwable $e) {
        echo "  Method 1 Error: " . $e->getMessage() . "\n";
    }

    // Method 2: Query directly
    try {
        $stmt = $pdo->query("SHOW COLUMNS FROM `$table` LIKE '$column'");
        $res = $stmt->fetch();
        echo "  Method 2 (Query): " . ($res ? "FOUND" : "NOT FOUND") . "\n";
    } catch (Throwable $e) {
        echo "  Method 2 Error: " . $e->getMessage() . "\n";
    }
    
    // Method 3: Describe
    try {
        $stmt = $pdo->query("DESCRIBE `$table`");
        $cols = $stmt->fetchAll(PDO::FETCH_COLUMN);
        echo "  Method 3 (Describe): " . (in_array($column, $cols) ? "FOUND" : "NOT FOUND") . "\n";
    } catch (Throwable $e) {
        echo "  Method 3 Error: " . $e->getMessage() . "\n";
    }
    echo "\n";
}

try {
    $pdo = db_connect();
    testColumnExists($pdo, 'appointments', 'customer_ref_id');
    testColumnExists($pdo, 'customer_tags', 'customer_id');
} catch (Throwable $e) {
    echo "Global Error: " . $e->getMessage() . "\n";
}
