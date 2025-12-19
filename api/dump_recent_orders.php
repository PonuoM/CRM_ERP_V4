<?php
require_once 'config.php';
$pdo = db_connect();

echo "Listing last 10 order IDs:\n";
$stmt = $pdo->query("SELECT id, order_status FROM orders ORDER BY created_at DESC LIMIT 10");
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($rows as $r) {
    echo "ID: [" . $r['id'] . "] Status: " . $r['order_status'] . "\n";
}
