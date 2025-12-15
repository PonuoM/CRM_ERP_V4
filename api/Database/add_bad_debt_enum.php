<?php
require_once __DIR__ . '/../config.php';

try {
    $pdo = db_connect();
    
    echo "Updating order_status ENUM...\n";
    
    // Get current enum definition to be safe/aware, but usually we just redefine it to include new values
    // Current: 'Pending','AwaitingVerification','Confirmed','Preparing','Picking','Shipping','PreApproved','Delivered','Returned','Cancelled'
    // New: + 'Claiming','BadDebt'
    
    $sql = "ALTER TABLE orders MODIFY COLUMN order_status ENUM(
        'Pending',
        'AwaitingVerification',
        'Confirmed',
        'Preparing',
        'Picking',
        'Shipping',
        'PreApproved',
        'Delivered',
        'Returned',
        'Cancelled',
        'Claiming',
        'BadDebt'
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Pending'";

    $pdo->exec($sql);
    
    echo "Successfully updated order_status ENUM.\n";

} catch (PDOException $e) {
    echo "Error updating database: " . $e->getMessage() . "\n";
    exit(1);
}
?>
