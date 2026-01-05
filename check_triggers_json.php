<?php
require_once __DIR__ . '/api/config.php';

try {
    $pdo = db_connect();
    
    $stmt = $pdo->query("SHOW TRIGGERS WHERE `Table` = 'customers'");
    $triggers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($triggers, JSON_PRETTY_PRINT);

} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
