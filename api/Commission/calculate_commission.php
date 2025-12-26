<?php
/**
 * Calculate Commission for a specific period (Upsell Supported)
 * 
 * Logic:
 * 1. Select Eligible Orders (Confirmed Reconcile, Date < Period Start, Not Calculated)
 * 2. For each order, fetch items.
 * 3. Calculate Payment Ratio = Confirmed Amount / Sum(All Items net_total)
 * 4. Iterate items:
 *    - Skip if is_freebie=1 or parent_item_id is NOT NULL
 *    - Item Amount = net_total * Ratio
 *    - Beneficiary = item.creator_id ?? order.creator_id
 * 5. Group by Beneficiary and save.
 */

require_once __DIR__ . "/../config.php";

header('Content-Type: application/json; charset=utf-8');

try {
    $pdo = db_connect();
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    $company_id = (int)($input['company_id'] ?? 0);
    $period_month = (int)($input['period_month'] ?? 0);
    $period_year = (int)($input['period_year'] ?? 0);
    $commission_rate = (float)($input['commission_rate'] ?? 5.0);
    
    if (!$company_id || !$period_month || !$period_year) {
        echo json_encode(['ok' => false, 'error' => 'Missing required parameters']);
        exit;
    }
    
    if ($period_month < 1 || $period_month > 12) {
        echo json_encode(['ok' => false, 'error' => 'Invalid month']);
        exit;
    }
    
    $period_start_date = sprintf('%04d-%02d-01', $period_year, $period_month);
    
    // Display dates
    $order_month = $period_month - 1;
    $order_year = $period_year;
    if ($order_month < 1) {
        $order_month = 12;
        $order_year--;
    }
    
    $cutoff_date = sprintf('%04d-%02d-20', $period_year, $period_month);
    
    $pdo->beginTransaction();
    
    // Check existing period
    $checkStmt = $pdo->prepare("
        SELECT id, status FROM commission_periods 
        WHERE company_id = ? AND period_year = ? AND period_month = ?
    ");
    $checkStmt->execute([$company_id, $period_year, $period_month]);
    $existing = $checkStmt->fetch(PDO::FETCH_ASSOC);
    
    if ($existing && $existing['status'] !== 'Draft') {
        $pdo->rollBack();
        echo json_encode([
            'ok' => false, 
            'error' => 'Period already calculated with status: ' . $existing['status']
        ]);
        exit;
    }
    
    if ($existing) {
        // Delete existing draft (cascade will handle lines if set up, but let's be safe)
        // Note: commission_records and commission_order_lines should cascade delete if FK is correct. 
        // Assuming standard Laravel/Prisma behavior or manual cleanup.
        // Let's rely on Prisma schema 'onDelete: Cascade' visible in previous views -> Yes, FKs have onDelete: Cascade.
        $pdo->prepare("DELETE FROM commission_periods WHERE id = ?")->execute([$existing['id']]);
    }
    
    // 1. Get Eligible Orders
    // Using explicit table alias for clarity
    $ordersStmt = $pdo->prepare("
        SELECT 
            o.id,
            o.creator_id as order_creator_id,
            o.order_date,
            srl.confirmed_amount,
            srl.confirmed_at
        FROM orders o
        INNER JOIN statement_reconcile_logs srl ON srl.order_id = o.id
        LEFT JOIN commission_order_lines col ON col.order_id = o.id
        WHERE 
            srl.confirmed_action = 'Confirmed'
            AND o.order_date < :period_start
            AND col.id IS NULL
            AND o.company_id = :company_id
        ORDER BY o.order_date
    ");
    
    $ordersStmt->execute([
        'period_start' => $period_start_date,
        'company_id' => $company_id
    ]);
    
    $orders = $ordersStmt->fetchAll(PDO::FETCH_ASSOC);
    
    $salesData = []; // [user_id => ['total_sales' => 0, 'lines' => []]]
    
    // Prepared statement for items
    $itemsStmt = $pdo->prepare("
        SELECT 
            id, 
            creator_id, 
            net_total, 
            is_freebie, 
            parent_item_id 
        FROM order_items 
        WHERE parent_order_id = ?
    ");
    
    $totalOrdersProcessed = 0;
    
    foreach ($orders as $order) {
        $order_id = $order['id'];
        $confirmed_amount = (float)$order['confirmed_amount'];
        $order_creator_id = $order['order_creator_id'];
        
        // Fetch Items
        $itemsStmt->execute([$order_id]);
        $items = $itemsStmt->fetchAll(PDO::FETCH_ASSOC);
        
        if (empty($items)) continue; // Should not happen for valid orders
        
        // Calculate Total Value for Ratio
        $total_item_value = 0;
        foreach ($items as $item) {
             // Ratio is based on ALL items value to determine how much of the bill was paid
             // Usually confirmed_amount should match sum(net_total), but if diff, we prorate.
             $total_item_value += (float)$item['net_total'];
        }
        
        $ratio = 1.0;
        if ($total_item_value > 0) {
            $ratio = $confirmed_amount / $total_item_value;
        } else {
            // Edge case: items have 0 value but confirmed amount > 0? 
            // Or both 0. If value is 0, no commission anyway.
            $ratio = 0; 
        }
        
        $hasCommissionableItems = false;
        
        foreach ($items as $item) {
            // Exclusion Logic
            if ((int)$item['is_freebie'] === 1) continue;
            if (!empty($item['parent_item_id'])) continue;
            
            $item_net = (float)$item['net_total'];
            $commissionable_amount = $item_net * $ratio;
            
            if ($commissionable_amount <= 0) continue;
            
            // Beneficiary
            $beneficiary_id = !empty($item['creator_id']) ? $item['creator_id'] : $order_creator_id;
            
            if (!$beneficiary_id) continue; // Should not happen if data integrity is good
            
            // Add to sales data
            if (!isset($salesData[$beneficiary_id])) {
                $salesData[$beneficiary_id] = [
                    'total_sales' => 0,
                    'order_count' => 0, // We'll count unique orders later or just increment line count?
                                        // Requirement usually counts Distinct Orders. 
                                        // But here we are splitting. Let's count "transactions" or keep track of unique orders per user.
                    'orders_seen' => [] 
                ];
            }
            
            $salesData[$beneficiary_id]['total_sales'] += $commissionable_amount;
            
            // Track unique orders for this user
            if (!isset($salesData[$beneficiary_id]['orders_seen'][$order_id])) {
                $salesData[$beneficiary_id]['order_count']++;
                $salesData[$beneficiary_id]['orders_seen'][$order_id] = true;
            }
            
            // Prepare Line Data
            // We might have multiple items for same user in same order. 
            // We should aggregate them or insert multiple lines?
            // "commission_order_lines" links to "orders". If we insert multiple lines for same order_id, 
            // the Primary Key is 'id', so it supports multiple rows with same order_id.
            // Let's insert per item for maximum detail if needed, OR aggregate per order per user.
            // Aggregating per order per user is cleaner for the report (1 line per order for that user).
            
            if (!isset($salesData[$beneficiary_id]['lines'][$order_id])) {
                $salesData[$beneficiary_id]['lines'][$order_id] = [
                     'order_id' => $order_id,
                     'order_date' => $order['order_date'],
                     'confirmed_at' => $order['confirmed_at'] ?? $order['order_date'], // Fallback
                     'amount' => 0
                ];
            }
            $salesData[$beneficiary_id]['lines'][$order_id]['amount'] += $commissionable_amount;
            
            $hasCommissionableItems = true;
        }
        
        if ($hasCommissionableItems) {
            $totalOrdersProcessed++;
        }
    }
    
    // Calculate Global Totals
    $grandTotalSales = 0;
    $grandTotalOrders = $totalOrdersProcessed; // Unique orders processed in this run
    $grandTotalCommission = 0;
    
    foreach ($salesData as $uid => $data) {
        $grandTotalSales += $data['total_sales'];
        $userComm = $data['total_sales'] * ($commission_rate / 100);
        $grandTotalCommission += $userComm;
    }
    
    // Insert Period
    $periodStmt = $pdo->prepare("
        INSERT INTO commission_periods (
            company_id, period_month, period_year, order_month, order_year,
            cutoff_date, status, total_sales, total_commission, total_orders,
            calculated_at, calculated_by
        ) VALUES (?, ?, ?, ?, ?, ?, 'Calculated', ?, ?, ?, NOW(), NULL)
    ");
    
    $periodStmt->execute([
        $company_id, $period_month, $period_year, $order_month, $order_year,
        $cutoff_date, $grandTotalSales, $grandTotalCommission, $grandTotalOrders
    ]);
    
    $period_id = $pdo->lastInsertId();
    
    // Insert Records and Lines
    $recordStmt = $pdo->prepare("
        INSERT INTO commission_records (
            period_id, user_id, total_sales, commission_rate, commission_amount, order_count
        ) VALUES (?, ?, ?, ?, ?, ?)
    ");
    
    $lineStmt = $pdo->prepare("
        INSERT INTO commission_order_lines (
            record_id, order_id, order_date, confirmed_at, order_amount, commission_amount
        ) VALUES (?, ?, ?, ?, ?, ?)
    ");
    
    foreach ($salesData as $user_id => $data) {
        $userTotalSales = $data['total_sales'];
        $userCommission = $userTotalSales * ($commission_rate / 100);
        $userOrderCount = $data['order_count'];
        
        $recordStmt->execute([
            $period_id,
            $user_id,
            $userTotalSales,
            $commission_rate,
            $userCommission,
            $userOrderCount
        ]);
        
        $record_id = $pdo->lastInsertId();
        
        foreach ($data['lines'] as $line) {
            $lineAmount = $line['amount'];
            $lineCommission = $lineAmount * ($commission_rate / 100);
            
            $lineStmt->execute([
                $record_id,
                $line['order_id'],
                date('Y-m-d', strtotime($line['order_date'])),
                date('Y-m-d H:i:s', strtotime($line['confirmed_at'])),
                $lineAmount,
                $lineCommission
            ]);
        }
    }
    
    $pdo->commit();
    
    echo json_encode([
        'ok' => true,
        'data' => [
            'period_id' => $period_id,
            'total_sales' => $grandTotalSales,
            'total_commission' => $grandTotalCommission,
            'total_orders' => $grandTotalOrders,
            'salesperson_count' => count($salesData)
        ]
    ]);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
