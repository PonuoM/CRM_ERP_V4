<?php
/**
 * Export Stock Balance Report (Hybrid Stock-Lot Source)
 * Fixes issue where product_lots data might be out of sync with warehouse_stocks.
 * Uses warehouse_stocks as Truth for Total Quantity, and fits Lots into it.
 */
header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename=stock_balance_report.csv');

require_once __DIR__ . '/../config.php';
$pdo = db_connect();

$date = $_GET['date'] ?? date('Y-m-d');
$warehouseId = !empty($_GET['warehouseId']) ? $_GET['warehouseId'] : null;
$productId = !empty($_GET['productId']) ? $_GET['productId'] : null;
$companyId = !empty($_GET['companyId']) ? $_GET['companyId'] : null;

$isToday = ($date === date('Y-m-d'));

$output = fopen('php://output', 'w');
fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));

fputcsv($output, ['Stock Balance Report']);
fputcsv($output, ["Date: $date"]);
fputcsv($output, []);

fputcsv($output, [
    'Warehouse (คลังสินค้า)',
    'Product Code (รหัสสินค้า)',
    'Product Name (ชื่อสินค้า)',
    'Lot Number (Lot)',
    'Total (รับเข้า)',         // From Warehouse Stock (distributed)
    'Sold (ขาย)',              // Active Allocations
    'Remaining (คงเหลือ)'     // Total - Sold
]);

try {
    // 1. Fetch Stocks (Source of Truth for Totals)
    $params = [];
    $whereClause = "";
    if ($warehouseId) {
        $whereClause .= " AND ws.warehouse_id = ?";
        $params[] = $warehouseId;
    }
    if ($productId) {
        if (is_numeric($productId)) {
            $whereClause .= " AND ws.product_id = ?";
            $params[] = $productId;
        } else {
             $whereClause .= " AND (p.sku LIKE ? OR p.name LIKE ?)";
             $params[] = "%$productId%";
             $params[] = "%$productId%";
        }
    }

    $sqlStock = "SELECT 
                ws.warehouse_id, 
                w.name as warehouse_name, 
                ws.product_id, 
                p.sku, 
                p.name as product_name, 
                ws.quantity as on_hand
            FROM warehouse_stocks ws
            JOIN products p ON ws.product_id = p.id
            JOIN warehouses w ON ws.warehouse_id = w.id
            WHERE p.status = 'active' $whereClause
            ORDER BY w.name, p.sku";
    $stmt = $pdo->prepare($sqlStock);
    $stmt->execute($params);
    $stocks = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 2. Fetch Lots (To map to stocks)
    // We fetch all active lots for these products/warehouses
    $lotMap = []; // [warehouse_id][product_id] => array of lots
    $sqlLots = "SELECT warehouse_id, product_id, lot_number, quantity_remaining 
                FROM product_lots 
                WHERE status = 'Active' 
                ORDER BY purchase_date ASC, id ASC"; // FIFO like distribution
    // Optimization: Filter by product_ids in PHP if list is huge? For now select all active or filter by join if needed.
    // If we have filters, apply to lots too safely.
    $lotWhere = "";
    $lotParams = [];
    if ($warehouseId) { $lotWhere .= " AND warehouse_id = ?"; $lotParams[] = $warehouseId; }
    if ($productId && is_numeric($productId)) { $lotWhere .= " AND product_id = ?"; $lotParams[] = $productId; }
    
    $stmtLots = $pdo->prepare($sqlLots . $lotWhere);
    $stmtLots->execute($lotParams);
    while ($row = $stmtLots->fetch(PDO::FETCH_ASSOC)) {
        $lotMap[$row['warehouse_id']][$row['product_id']][] = $row;
    }

    // 3. Fetch Sold (Allocations)
    $soldMap = []; // [warehouse_id][product_id][lot_number] => qty
    // Note: Allocations might have NULL lot_number (if pending auto-allocate).
    // We map NULL key too.
    $allocWhere = "";
    $allocParams = [];
    if ($warehouseId) { $allocWhere .= " AND a.warehouse_id = ?"; $allocParams[] = $warehouseId; }
    if ($productId && is_numeric($productId)) { $allocWhere .= " AND a.product_id = ?"; $allocParams[] = $productId; }
    
    $sqlSold = "SELECT 
                  a.warehouse_id, 
                  a.product_id, 
                  a.lot_number,
                  SUM(a.allocated_quantity) as sold_qty
                FROM order_item_allocations a
                JOIN orders o ON a.order_id = o.id
                WHERE o.order_status NOT IN ('Pending', 'Shipped', 'Completed', 'Cancelled', 'Return')
                $allocWhere
                GROUP BY a.warehouse_id, a.product_id, a.lot_number";

    $stmtSold = $pdo->prepare($sqlSold);
    $stmtSold->execute($allocParams);
    while ($row = $stmtSold->fetch(PDO::FETCH_ASSOC)) {
        $l = $row['lot_number'] !== null ? (string)$row['lot_number'] : 'NA';
        $soldMap[$row['warehouse_id']][$row['product_id']][$l] = (float)$row['sold_qty'];
    }

    // 4. Process and Output
    foreach ($stocks as $stock) {
        $whId = $stock['warehouse_id'];
        $pId = $stock['product_id'];
        $totalStock = (float)$stock['on_hand']; // This is the Physical Total we must respect
        
        // Historical Adjustment for Total
        if (!$isToday) {
             $nextDay = date('Y-m-d 00:00:00', strtotime($date . ' +1 day'));
             $stmtMov = $pdo->prepare("SELECT SUM(quantity) FROM stock_movements WHERE warehouse_id=? AND product_id=? AND created_at >= ?");
             $stmtMov->execute([$whId, $pId, $nextDay]);
             $delta = (float)$stmtMov->fetchColumn();
             $totalStock = $totalStock - $delta;
        }

        $lots = $lotMap[$whId][$pId] ?? [];
        
        if (empty($lots)) {
            // Case A: No Lots found for this Stock
            // Show 1 row with 'N/A' lot, full stock qty
            $sold = $soldMap[$whId][$pId]['NA'] ?? 0;
            // Also add Sold from specific lots if any (ghost allocations?)
            // Just sum all sold for this Wh/Prod?
            // If lots are empty, likely soldmap keys are 'NA' or ghost keys.
            // Let's sum all sold keys for this wh/pId to be safe?
            // Actually, if we have active allocations with lot numbers but no lot in product_lots... distinct row? 
            // For simplicity, if no lots, aggregate all sold.
            $allSold = 0;
            if (isset($soldMap[$whId][$pId])) {
                foreach ($soldMap[$whId][$pId] as $q) $allSold += $q;
            }
            
            fputcsv($output, [
                $stock['warehouse_name'],
                $stock['sku'],
                $stock['product_name'],
                '-', // Lot
                $totalStock,
                $allSold,
                $totalStock - $allSold
            ]);
        } else {
            // Case B: Lots exist. Distribute Stock across them.
            // Logic: Iterate lots. Display them. 
            // If Stock < Sum(Lots), we cap the display?
            // If Stock > Sum(Lots), we add an "Unknown" lot row at end.
            
            $remainingStockConfig = $totalStock;
            
            foreach ($lots as $lot) {
                // Determine how much of the Total Stock belongs to this Lot.
                // We use lot['quantity_remaining'] (Available) + lot['sold'] ?? No.
                // product_lots.quantity = logical available.
                // We assume product_lots structure roughly mirrors reality, just might be scaled wrong.
                // Or we just show the lot as is?
                // User problem: "10000 combined". 
                // Using warehouse_stocks, we process Wh A (5000 units).
                // Wh A has Lot 1 (10000 units logic).
                // We should display Lot 1, but cap it at 5000?
                // Visual fix: Yes, cap at 5000.
                
                $lotNum = (string)$lot['lot_number'];
                $lotSold = $soldMap[$whId][$pId][$lotNum] ?? 0;
                
                // Logical Total for this Lot according to DB = Available + Sold(Active)
                // Note: quantity_remaining ALREADY excludes Sold(Active).
                // So Lot Total = quantity_remaining + sold.
                $lotLogicalTotal = (float)$lot['quantity_remaining'] + $lotSold;
                
                // Cap by remaining warehouse stock
                $displayTotal = min($lotLogicalTotal, $remainingStockConfig);
                
                if ($displayTotal > 0 || $lotSold > 0) {
                     $displayRemaining = $displayTotal - $lotSold;
                     
                     fputcsv($output, [
                        $stock['warehouse_name'],
                        $stock['sku'],
                        $stock['product_name'],
                        $lotNum,
                        $displayTotal,
                        $lotSold,
                        $displayRemaining
                    ]);
                    
                    $remainingStockConfig -= $displayTotal;
                }
                
                if ($remainingStockConfig <= 0) break; // Filled the warehouse stock quota
            }
            
            // If still stock remaining (Stock > Lots), add "Unassigned" row
            if ($remainingStockConfig > 0.001) {
                 $naSold = $soldMap[$whId][$pId]['NA'] ?? 0;
                 fputcsv($output, [
                    $stock['warehouse_name'],
                    $stock['sku'],
                    $stock['product_name'],
                    'Unassigned',
                    $remainingStockConfig,
                    $naSold,
                    $remainingStockConfig - $naSold
                ]);
            }
        }
    }

} catch (Exception $e) {
    fputcsv($output, ['Error: ' . $e->getMessage()]);
}

fclose($output);
exit;
