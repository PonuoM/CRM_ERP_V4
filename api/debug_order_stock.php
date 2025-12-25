<?php
require_once 'config.php';
header('Content-Type: text/plain');

$orderId = $_GET['id'] ?? '251223-00023adminwa';
$pdo = db_connect();

echo "=== Debug Report for Order: $orderId ===\n\n";

// 1. Check Order
$stmt = $pdo->prepare("SELECT id, order_status, warehouse_id, company_id FROM orders WHERE id = ?");
$stmt->execute([$orderId]);
$order = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$order) {
    echo "Order NOT FOUND.\n";
    exit;
}

echo "Order Status: " . $order['order_status'] . "\n";
echo "Warehouse ID: " . ($order['warehouse_id'] ?? 'NULL') . "\n";
echo "Company ID: " . ($order['company_id'] ?? 'NULL') . "\n";
echo "\n";

// 2. Check Order Items
echo "--- Order Items ---\n";
// Check by order_id OR parent_order_id
$stmtItems = $pdo->prepare("SELECT id, order_id, parent_order_id, product_id, product_name, quantity, box_number FROM order_items WHERE order_id = ? OR parent_order_id = ?");
$stmtItems->execute([$orderId, $orderId]);
$items = $stmtItems->fetchAll(PDO::FETCH_ASSOC);

if (!$items) {
    echo "NO ITEMS FOUND matching order_id or parent_order_id = $orderId\n";
}

foreach ($items as $item) {
    echo "Item ID: {$item['id']} | OrderID: {$item['order_id']} | ParentID: {$item['parent_order_id']} | Product ID: {$item['product_id']} ({$item['product_name']}) | Qty: {$item['quantity']}\n";
    
    // Check Allocations for this item
    $stmtAlloc = $pdo->prepare("SELECT * FROM order_item_allocations WHERE order_item_id = ?");
    $stmtAlloc->execute([$item['id']]);
    $allocs = $stmtAlloc->fetchAll(PDO::FETCH_ASSOC);
    
    if ($allocs) {
        foreach ($allocs as $a) {
            echo "  > Allocation ID: {$a['id']} | Status: {$a['status']} | Required: {$a['required_quantity']} | Allocated: {$a['allocated_quantity']} | Lot: {$a['lot_number']} | Warehouse: {$a['warehouse_id']}\n";
        }
    } else {
        echo "  > NO ALLOCATIONS FOUND\n";
    }

    // Check Warehouse Stock for this product (if warehouse known)
    if ($order['warehouse_id']) {
        $stmtStock = $pdo->prepare("SELECT ws.*, w.name as warehouse_name FROM warehouse_stocks ws JOIN warehouses w ON ws.warehouse_id = w.id WHERE product_id = ? AND warehouse_id = ?");
        $stmtStock->execute([$item['product_id'], $order['warehouse_id']]);
        $stocks = $stmtStock->fetchAll(PDO::FETCH_ASSOC);
        echo "  > Warehouse Stock Status (Target Warehouse {$order['warehouse_id']}):\n";
        if ($stocks) {
            foreach ($stocks as $s) {
                echo "    - Lot: {$s['lot_number']} | Qty: {$s['quantity']} | Reserved: {$s['reserved_quantity']} | Avail: {$s['available_quantity']}\n";
            }
        } else {
            echo "    - NO STOCK FOUND IN WAREHOUSE {$order['warehouse_id']}\n";
        }
    }
    
    // Check ANY warehouse stock
    $stmtAllStock = $pdo->prepare("SELECT ws.*, w.name as warehouse_name FROM warehouse_stocks ws JOIN warehouses w ON ws.warehouse_id = w.id WHERE product_id = ?");
    $stmtAllStock->execute([$item['product_id']]);
    $allStocks = $stmtAllStock->fetchAll(PDO::FETCH_ASSOC);
    if ($allStocks) {
        echo "  > ALL WAREHOUSES Stock Status:\n";
        foreach ($allStocks as $s) {
            echo "    - Warehouse: {$s['warehouse_name']} ({$s['warehouse_id']}) | Lot: {$s['lot_number']} | Qty: {$s['quantity']} | Reserved: {$s['reserved_quantity']}\n";
        }
    } else {
        echo "  > PRODUCT HAS NO STOCK IN ANY WAREHOUSE.\n";
    }
}
echo "\n";

// 3. Check Stock Movements
echo "--- Stock Movements ---\n";
$stmtMove = $pdo->prepare("SELECT * FROM stock_movements WHERE document_number = ? OR (reference_type = 'order_item_allocations' AND reference_id IN (SELECT id FROM order_item_allocations WHERE order_id = ?))");
$stmtMove->execute([$orderId, $orderId]);
$moves = $stmtMove->fetchAll(PDO::FETCH_ASSOC);

if ($moves) {
    foreach ($moves as $m) {
        echo "Movement ID: {$m['id']} | Type: {$m['movement_type']} | Qty: {$m['quantity']} | Lot: {$m['lot_number']} | Reason: {$m['reason']}\n";
    }
} else {
    echo "NO STOCK MOVEMENTS FOUND for this order.\n";
}
echo "\n==============================\n";
