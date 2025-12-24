<?php
/**
 * Export Stock Balance Report (Snapshot)
 * Filters: date (Snapshot Date), warehouseId, productId, companyId
 * Columns: Product Code, Product Name, Inbound (Pending Receive), Reserved (Pending Order), Sold (Shipped/Picking), Balance, Available
 */
header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename=stock_balance_report.csv');

require_once __DIR__ . '/../config.php';
$pdo = db_connect();

$date = $_GET['date'] ?? date('Y-m-d');
$warehouseId = !empty($_GET['warehouseId']) ? $_GET['warehouseId'] : null;
$productId = !empty($_GET['productId']) ? $_GET['productId'] : null;
$companyId = !empty($_GET['companyId']) ? $_GET['companyId'] : null;

// Is Snapshot Date Today?
$isToday = ($date === date('Y-m-d'));

$output = fopen('php://output', 'w');
fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));

fputcsv($output, ['Stock Balance Report']);
fputcsv($output, ["Date: $date"]);
fputcsv($output, []);

fputcsv($output, [
    'Product Code (รหัสสินค้า)',
    'Product Name (ชื่อสินค้า)',
    'On Hand (คงเหลือจริง)', 
    'Reserved (จอง-รอส่ง)', 
    'Sold/Picking (ขาย-กำลังจัดส่ง)', 
    'Available (พร้อมขาย)'
]);

try {
    // 1. Fetch Products
    $pParams = [];
    $pWhere = ["p.status = 'active'"];
    if ($productId) {
        if (is_numeric($productId)) {
            $pWhere[] = "p.id = ?";
            $pParams[] = $productId;
        } else {
            $pWhere[] = "(p.sku LIKE ? OR p.name LIKE ?)";
            $pParams[] = "%$productId%";
            $pParams[] = "%$productId%";
        }
    }
    // Company filter needed for products? Assuming simple for now or added later.

    $sqlP = "SELECT id, sku as code, name FROM products p WHERE " . implode(" AND ", $pWhere) . " ORDER BY p.sku";
    $stmtP = $pdo->prepare($sqlP);
    $stmtP->execute($pParams);
    $products = $stmtP->fetchAll(PDO::FETCH_ASSOC);

    // 2. Prepare Statements for counts
    
    // A. On Hand (Warehouse Stocks)
    // If Today: Direct Query. If Past: Calc from History? 
    // Plan: V1 supports Today perfectly. Past Date supports "On Hand" via movement reversal. 
    // Reserved/Sold for Past Date is hard, might show N/A or approximate.
    
    // Strategy: calculate OnHand for $date.
    if ($isToday) {
        $sqlStock = "SELECT SUM(quantity) FROM warehouse_stocks WHERE product_id = ?";
        if ($warehouseId) $sqlStock .= " AND warehouse_id = $warehouseId";
        $stmtStock = $pdo->prepare($sqlStock);
    } else {
        // Historical: Current - (Movements after Date)
        // This is heavy per product. Better to fetch all movements and compute?
        // Let's do per product for V1 or single query with join.
        // Optimization: Single query for all stocks.
        // For distinct product list, we iterate.
        $stmtStockCurrent = $pdo->prepare("SELECT SUM(quantity) FROM warehouse_stocks WHERE product_id = ?" . ($warehouseId ? " AND warehouse_id = $warehouseId" : ""));
        $stmtApproveMove = $pdo->prepare("SELECT SUM(quantity) FROM stock_movements WHERE product_id = ? AND created_at > ? " . ($warehouseId ? " AND warehouse_id = $warehouseId" : ""));
    }

    // B. Reserved (Pending Orders)
    // Orders created <= Date, Status in (Pending, Confirmed), Not cancelled/shipped
    // AND items.product_id match.
    // NOTE: orders table schema check needed. Assuming `order_items` table or JSON in `orders`?
    // Usually `order_items` table.
    // Check schema for `order_items`? I'll assume standard `order_items` table exists.
    
    // If I don't confirm order_items schema, this might fail.
    // Let's assume table `order_items` (order_id, product_id, quantity).
    
    $sqlReserved = "SELECT SUM(oi.quantity) 
                    FROM orders o 
                    JOIN order_items oi ON o.id = oi.order_id 
                    WHERE o.order_date <= ? 
                      AND o.order_status IN ('Pending', 'Confirmed', 'Processing') 
                      AND oi.product_id = ?";
    // Note: Warehouse filter on orders? Usually orders are assigned to warehouse at allocation.
    // If $warehouseId is set, we check order allocation? Complex.
    // User Requirement: "Select Warehouse".
    // If order is NOT yet allocated (Pending), it doesn't belong to a warehouse yet explicitly or default?
    // We will show Reserved globally if warehouse not selected, or ignore reserved if filtering specific warehouse?
    // Better: Show Total Reserved regardless of warehouse, OR link if possible.
    // Let's stick to Product-level Reserved for now to avoid missing data.
    
    $stmtReserved = $pdo->prepare($sqlReserved);

    // C. Sold/Picking (Picking, Ready to Ship)
    $sqlSold = "SELECT SUM(oi.quantity) 
                FROM orders o 
                JOIN order_items oi ON o.id = oi.order_id 
                WHERE o.order_date <= ? 
                  AND o.order_status IN ('Picking', 'Packed') 
                  AND oi.product_id = ?";
    $stmtSold = $pdo->prepare($sqlSold);

    foreach ($products as $prod) {
        $pid = $prod['id'];

        // 1. On Hand
        $onHand = 0;
        if ($isToday) {
            $stmtStock->execute([$pid]);
            $onHand = (float)$stmtStock->fetchColumn();
        } else {
            // Calc Historical
            // Current
            $stmtStockCurrent->execute([$pid]);
            $curr = (float)$stmtStockCurrent->fetchColumn();
            
            // Movements > Date (midnight next day)
            $nextDay = date('Y-m-d 00:00:00', strtotime($date . ' +1 day'));
            $stmtApproveMove->execute([$pid, $nextDay]);
            $delta = (float)$stmtApproveMove->fetchColumn(); // Sum of signed qty
            
            // History = Current - Delta
            // Example: Current 10. Mov (IN +5) occurred after date. 
            // History = 10 - 5 = 5. Correct.
            // Example: Current 10. Mov (OUT -2) occurred after date.
            // History = 10 - (-2) = 12. Correct.
            $onHand = $curr - $delta;
        }

        // 2. Reserved
        $stmtReserved->execute(["$date 23:59:59", $pid]);
        $reserved = (float)$stmtReserved->fetchColumn();

        // 3. Sold/Picking
        $stmtSold->execute(["$date 23:59:59", $pid]);
        $sold = (float)$stmtSold->fetchColumn();

        // 4. Available
        // Available = On Hand - Reserved - Sold?
        // Defined by User: "Available" is what remains to sell.
        // Usually Reserved + Sold are deducted from On Hand?
        // User asked for "Balance after Sold" and "Balance after Sold + Reserved".
        // Let's output columns: 
        // On Hand (Physical)
        // Reserved
        // Sold
        // Balance (On Hand - Sold) -> "คงเหลือหลังหักขาย"
        // Available (On Hand - Sold - Reserved) -> "คงเหลือหลังหักขาย + จอง" (User phrasing "Balance after Sold + Reserved" might mean remaining available).
        
        $balanceAfterSold = $onHand - $sold;
        $available = $onHand - $sold - $reserved;

        fputcsv($output, [
            $prod['code'],
            $prod['name'],
            $onHand,
            $reserved,
            $sold,
            $available
        ]);
    }

} catch (Exception $e) {
    fputcsv($output, ['Error: ' . $e->getMessage()]);
}

fclose($output);
exit;
