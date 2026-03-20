<?php
require __DIR__ . '/../config.php';
$conn = db_connect();

$cols = $conn->query("SHOW COLUMNS FROM quota_allocations")->fetchAll(PDO::FETCH_COLUMN);
if (!in_array('valid_from', $cols)) {
    $conn->exec("ALTER TABLE quota_allocations ADD COLUMN valid_from DATE DEFAULT NULL AFTER period_end");
    echo "Added valid_from\n";
} else {
    echo "valid_from already exists\n";
}
if (!in_array('valid_until', $cols)) {
    $conn->exec("ALTER TABLE quota_allocations ADD COLUMN valid_until DATE DEFAULT NULL AFTER valid_from");
    echo "Added valid_until\n";
} else {
    echo "valid_until already exists\n";
}
echo "Done\n";
