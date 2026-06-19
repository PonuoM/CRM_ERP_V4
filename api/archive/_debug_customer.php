<?php
require_once __DIR__ . '/config.php';
header('Content-Type: application/json; charset=utf-8');

try {
    $pdo = db_connect();
    $cid = $_GET['cid'] ?? '323209';

    // 1. Customer record - search both columns
    $customers = [];
    
    // Try customer_id column (removed 'id' from select)
    try {
        $stmt = $pdo->prepare("SELECT customer_id, first_name, last_name, total_purchases, order_count, first_order_date, last_order_date, grade, company_id FROM customers WHERE customer_id = ? LIMIT 3");
        $stmt->execute([$cid]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($rows as $r) { $r['_matched_by'] = 'customer_id'; $customers[] = $r; }
    } catch (Exception $e) {
        $customers[] = ['_error' => 'customer_id column: ' . $e->getMessage()];
    }

    // 2. Orders
    $orders = [];
    try {
        $stmt = $pdo->prepare("SELECT id, customer_id, order_status, total_amount, order_date FROM orders WHERE customer_id = ? ORDER BY order_date DESC LIMIT 10");
        $stmt->execute([(string)$cid]);
        $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        $orders = ['_error' => $e->getMessage()];
    }

    // 3. Column types
    $types = [];
    try {
        $typeStmt = $pdo->query("
            SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_TYPE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND COLUMN_NAME IN ('customer_id', 'id') 
              AND TABLE_NAME IN ('customers', 'orders')
            ORDER BY TABLE_NAME, COLUMN_NAME
        ");
        $types = $typeStmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        $types = ['_error' => $e->getMessage()];
    }

    // 4. Aggregate check (same as audit query)
    $agg = [];
    try {
        $stmt = $pdo->prepare("
            SELECT COUNT(*) AS cnt, SUM(total_amount) AS total, MIN(order_date) AS first_dt, MAX(order_date) AS last_dt
            FROM orders WHERE customer_id = ? AND order_status != 'Cancelled'
        ");
        $stmt->execute([(string)$cid]);
        $agg = $stmt->fetch(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        $agg = ['_error' => $e->getMessage()];
    }

    echo json_encode([
        'search_cid' => $cid,
        'customers' => $customers,
        'orders' => $orders,
        'aggregate_for_cid' => $agg,
        'column_types' => $types,
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

} catch (Exception $e) {
    echo json_encode(['fatal' => $e->getMessage()]);
}
