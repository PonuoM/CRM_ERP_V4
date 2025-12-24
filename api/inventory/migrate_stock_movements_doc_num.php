<?php
header("Access-Control-Allow-Origin: *");
header('Content-Type: application/json');

require_once __DIR__ . '/../config.php';
$pdo = db_connect();

$logs = [];

try {
    // 1. Check if column exists
    $stmt = $pdo->query("SHOW COLUMNS FROM stock_movements LIKE 'document_number'");
    $exists = $stmt->fetch();

    if (!$exists) {
        $pdo->exec("ALTER TABLE stock_movements ADD COLUMN document_number VARCHAR(50) DEFAULT NULL AFTER product_id");
        $logs[] = "Added column 'document_number' to 'stock_movements'.";
    } else {
        $logs[] = "Column 'document_number' already exists.";
    }

    // 2. Backfill for Stock Transactions
    $pdo->beginTransaction();
    
    // Update movement logs referenced by stock_transactions
    // This query joins stock_movements with stock_transactions on id and updates doc number
    $sql = "UPDATE stock_movements sm
            JOIN stock_transactions st ON sm.reference_id = st.id AND sm.reference_type = 'stock_transactions'
            SET sm.document_number = st.document_number
            WHERE sm.document_number IS NULL";
    
    $items = $pdo->prepare($sql);
    $items->execute();
    $count = $items->rowCount();
    $logs[] = "Backfilled $count rows for stock_transactions.";

    // Optional: Backfill for Orders if `orders` table has document_number/order_number
    // Assuming 'orders' reference_type exists log.
    // Check if 'orders' table exists and has order_number
    try {
        $sqlOrder = "UPDATE stock_movements sm
                     JOIN orders o ON sm.reference_id = o.id AND sm.reference_type = 'order'
                     SET sm.document_number = o.order_number
                     WHERE sm.document_number IS NULL";
        $pdo->exec($sqlOrder);
         // If no error, good.
    } catch (Exception $e) {
        // Ignore if orders matching fails (maybe different schema)
        $logs[] = "Order backfill skipped or failed: " . $e->getMessage();
    }

    $pdo->commit();
    echo json_encode(['success' => true, 'logs' => $logs]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    echo json_encode(['success' => false, 'error' => $e->getMessage(), 'logs' => $logs]);
}
