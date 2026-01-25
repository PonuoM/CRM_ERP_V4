<?php
require_once __DIR__ . '/../config.php';
$pdo = db_connect();

header('Content-Type: text/plain');

echo "=== customers columns (looking for previous_assigned_to) ===\n";
$stmt = $pdo->query("SHOW COLUMNS FROM customers LIKE '%assign%'");
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo $row['Field'] . " | " . $row['Type'] . "\n";
}

echo "\n=== All assign-related columns in customers ===\n";
$stmt = $pdo->query("SHOW COLUMNS FROM customers");
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    if (strpos($row['Field'], 'assign') !== false || strpos($row['Field'], 'previous') !== false) {
        echo $row['Field'] . " | " . $row['Type'] . "\n";
    }
}
