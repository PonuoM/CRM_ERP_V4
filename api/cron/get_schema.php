<?php
require_once __DIR__ . '/../config.php';
$pdo = db_connect();

header('Content-Type: text/plain');

echo "=== basket_transition_log columns ===\n";
$stmt = $pdo->query("SHOW COLUMNS FROM basket_transition_log");
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo $row['Field'] . " | " . $row['Type'] . "\n";
}

echo "\n=== basket_return_log columns ===\n";
$stmt = $pdo->query("SHOW COLUMNS FROM basket_return_log");
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo $row['Field'] . " | " . $row['Type'] . "\n";
}
