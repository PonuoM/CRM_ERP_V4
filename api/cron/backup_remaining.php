<?php
set_time_limit(600);

$conn = new mysqli('202.183.192.218', 'primacom_bloguser', 'pJnL53Wkhju2LaGPytw8', 'primacom_mini_erp');
if ($conn->connect_error) {
    die("DB Error: " . $conn->connect_error);
}
$conn->set_charset("utf8mb4");

$suffix = '_bak_20260426';

// Only the 3 tables that didn't finish
$table = isset($_GET['t']) ? $_GET['t'] : '';
$allowed = ['customer_tags', 'basket_transition_log', 'basket_return_log'];

if (!in_array($table, $allowed)) {
    echo "Usage: ?t=customer_tags or ?t=basket_transition_log or ?t=basket_return_log\n";
    echo "Allowed: " . implode(', ', $allowed);
    exit;
}

$backupTable = $table . $suffix;
echo "Backing up: {$table} -> {$backupTable}\n";

$conn->query("DROP TABLE IF EXISTS `{$backupTable}`");
$result = $conn->query("CREATE TABLE `{$backupTable}` AS SELECT * FROM `{$table}`");

if ($result) {
    $countResult = $conn->query("SELECT COUNT(*) as cnt FROM `{$backupTable}`");
    $row = $countResult->fetch_assoc();
    echo "SUCCESS! Rows: " . number_format($row['cnt']) . "\n";
} else {
    echo "FAILED: " . $conn->error . "\n";
}

$conn->close();
?>
