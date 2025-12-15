<?php
require_once "api/config.php";
$pdo = db_connect();

function desc($pdo, $table) {
    echo "\n--- $table ---\n";
    try {
        $stmt = $pdo->query("DESCRIBE $table");
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
            echo "{$r['Field']} \n";
        }
    } catch (Exception $e) { echo $table . " not found or error"; }
}

desc($pdo, 'orders');
desc($pdo, 'order_tracking_numbers');
?>
