<?php
require_once __DIR__ . '/config.php';
$pdo = db_connect();
$stmt = $pdo->query("SELECT lifecycle_status, COUNT(*) as count FROM customers GROUP BY lifecycle_status");
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo "Current Lifecycle Statuses in DB:\n";
foreach($rows as $row) {
    echo "Value: [" . $row['lifecycle_status'] . "] | Count: " . $row['count'] . "\n";
}
