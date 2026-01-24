<?php
require_once 'api/config.php';

try {
    $pdo = db_connect();

    echo "=== Checking what basket keys 38,39,46,50 represent ===\n";
    $basketKeys = [38, 39, 46, 50];

    foreach ($basketKeys as $key) {
        // Check if it's a basket_config id
        $stmt = $pdo->prepare('SELECT basket_key, basket_name FROM basket_config WHERE id = ?');
        $stmt->execute([$key]);
        $config = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($config) {
            echo "Key $key = basket_config: " . $config['basket_key'] . ' (' . $config['basket_name'] . ')' . "\n";
        } else {
            echo "Key $key = NOT FOUND in basket_config\n";
        }
    }

    echo "\n=== All basket_config records ===\n";
    $stmt = $pdo->prepare('SELECT id, basket_key, basket_name FROM basket_config WHERE company_id = 1 ORDER BY id');
    $stmt->execute();
    $allConfigs = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($allConfigs as $config) {
        echo "ID: {$config['id']} -> {$config['basket_key']} ({$config['basket_name']})\n";
    }

    echo "\n=== Checking basket tables ===\n";
    $stmt = $pdo->prepare('SHOW TABLES LIKE "%basket%"');
    $stmt->execute();
    $tables = $stmt->fetchAll(PDO::FETCH_COLUMN);
    print_r($tables);

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>

