<?php
require_once __DIR__ . '/api/config.php';
$conn = db_connect();

// Drop UNIQUE constraint that conflicts with soft delete
try {
    $conn->exec('ALTER TABLE quota_rate_schedules DROP INDEX uq_product_effective');
    echo "UNIQUE constraint dropped\n";
} catch (PDOException $e) {
    if (strpos($e->getMessage(), "check that it exists") !== false || strpos($e->getMessage(), "Can't DROP") !== false) {
        echo "Already dropped or not found\n";
    } else {
        echo "Error: " . $e->getMessage() . "\n";
    }
}
