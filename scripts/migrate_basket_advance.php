<?php
require 'api/config.php';
try {
    $pdo = db_connect();
    $sql = "ALTER TABLE basket_config ADD COLUMN advance_transfer_days INT DEFAULT 0 AFTER on_fail_reevaluate";
    $pdo->exec($sql);
    echo "SUCCESS: Column advance_transfer_days added to basket_config.";
} catch (PDOException $e) {
    if (strpos($e->getMessage(), 'Duplicate column name') !== false) {
        echo "SUCCESS: Column already exists.";
    } else {
        echo "ERROR: " . $e->getMessage();
    }
}
