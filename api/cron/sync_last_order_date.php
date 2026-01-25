<?php
/**
 * Daily Cron: Sync last_order_date for customers
 * 
 * URL: /api/cron/sync_last_order_date.php?key=basket_transfer_2026_secret
 * Schedule: Run daily
 */

header('Content-Type: text/plain; charset=utf-8');

$SECRET_KEY = 'basket_transfer_2026_secret';
$inputKey = $_GET['key'] ?? '';

if ($inputKey !== $SECRET_KEY) {
    http_response_code(403);
    die("Access Denied.\n");
}

define('SKIP_AUTH', true);
require_once __DIR__ . '/../config.php';

echo "=== Sync last_order_date ===\n";
echo "Date: " . date('Y-m-d H:i:s') . "\n\n";

try {
    $pdo = db_connect();
    
    // 1. Fill NULL last_order_date
    $sql1 = "
        UPDATE customers c
        SET c.last_order_date = (
            SELECT MAX(o.order_date)
            FROM orders o
            WHERE o.customer_id = c.customer_id
            AND o.order_status != 'Cancelled'
        )
        WHERE c.last_order_date IS NULL
        AND EXISTS (
            SELECT 1 FROM orders o2 
            WHERE o2.customer_id = c.customer_id 
            AND o2.order_status != 'Cancelled'
        )
    ";
    $count1 = $pdo->exec($sql1);
    echo "Filled NULL: $count1 customers\n";
    
    // 2. Fix outdated last_order_date (if order cancelled)
    $sql2 = "
        UPDATE customers c
        SET c.last_order_date = (
            SELECT MAX(o.order_date)
            FROM orders o
            WHERE o.customer_id = c.customer_id
            AND o.order_status != 'Cancelled'
        )
        WHERE c.last_order_date IS NOT NULL
        AND c.last_order_date != (
            SELECT COALESCE(MAX(o.order_date), c.last_order_date)
            FROM orders o
            WHERE o.customer_id = c.customer_id
            AND o.order_status != 'Cancelled'
        )
    ";
    $count2 = $pdo->exec($sql2);
    echo "Fixed outdated: $count2 customers\n";
    
    echo "\nDone.\n";
    
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
