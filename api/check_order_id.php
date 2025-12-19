<?php
require_once 'config.php';
$pdo = db_connect();

$targetId = '251218-00020adminvh';
echo "Checking for ID: [$targetId]\n";

$stmt = $pdo->prepare("SELECT id, order_status FROM orders WHERE id = ?");
$stmt->execute([$targetId]);
$order = $stmt->fetch(PDO::FETCH_ASSOC);

if ($order) {
    echo "Found exact match: " . print_r($order, true) . "\n";
} else {
    echo "No exact match found.\n";
    // Fuzzy search
    echo "Searching for similar IDs...\n";
    $stmt = $pdo->query("SELECT id FROM orders LIMIT 20");
    $all = $stmt->fetchAll(PDO::FETCH_COLUMN);
    print_r($all);
}
