<?php
/**
 * Calculate Commission for a specific period
 * Uses orders table with payment_status='Approved' and order_status='Delivered'
 * REQUIRES statement_reconcile_logs.confirmed_amount (orders without reconcile log are excluded)
 * 
 * POST /api/Commission/calculate_commission.php
 * 
 * Request body:
 * {
 *   "company_id": 1,
 *   "period_month": 12,  // เดือนที่คำนวณ (ธันวาคม)
 *   "period_year": 2024,
 *   "commission_rate": 5.0  // % ค่าคอมเริ่มต้น (optional)
 * }
 * 
 * Logic: Selects orders with order_date BEFORE the selected month
 * Example: period_month=12 (Dec) => selects orders with order_date < 2024-12-01
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
    
    // Calculate period_start_date for filtering
    // Period Dec 2024 => orders before Dec 1, 2024 (Nov 30 and earlier)
    $period_start_date = sprintf('%04d-%02d-01', $period_year, $period_month);
    
    // Keep order_month/order_year for display purposes
    $order_month = $period_month - 1;
    $order_year = $period_year;
    if ($order_month < 1) {
        $order_month = 12;
        $order_year--;
    }
    
    // Cutoff date: 20th of period_month
    $cutoff_date = sprintf('%04d-%02d-20', $period_year, $period_month);
    
    $pdo->beginTransaction();
    
    // Check if period already exists
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
    
    // Delete existing draft if any
    if ($existing) {
        $pdo->prepare("DELETE FROM commission_periods WHERE id = ?")->execute([$existing['id']]);
    }
    
    // Get eligible orders from ORDERS table with reconcile amount
    // Orders with payment_status='Approved', order_status='Delivered', and order_date before period_start
    // MUST have reconcile log with confirmed_amount
    // EXCLUDE orders already used in commission_order_lines
    $ordersStmt = $pdo->prepare("
        SELECT 
            o.id,
            o.creator_id,
            o.order_date,
            srl.confirmed_amount as order_amount
        FROM orders o
        INNER JOIN statement_reconcile_logs srl 
            ON srl.order_id = o.id
        LEFT JOIN commission_order_lines col
            ON col.order_id = o.id
        WHERE 
            -- Payment status = Approved
            o.payment_status = 'Approved'
            
            -- Order status = Delivered
            AND o.order_status = 'Delivered'
            
            -- Order date BEFORE selected month
            AND o.order_date < :period_start
            
            -- Must have confirmed amount
            AND srl.confirmed_amount IS NOT NULL
            
            -- NOT already used in commission calculation
            AND col.id IS NULL
            
            -- Company filter
            AND o.company_id = :company_id
            
        ORDER BY o.creator_id, o.order_date
    ");
    
    $ordersStmt->execute([
        'period_start' => $period_start_date,
        'company_id' => $company_id
    ]);
    
    $orders = $ordersStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Group by creator_id
    $salesData = [];
    foreach ($orders as $order) {
        $creator_id = $order['creator_id'];
        if (!isset($salesData[$creator_id])) {
            $salesData[$creator_id] = [
                'total_sales' => 0,
                'order_count' => 0,
                'orders' => []
            ];
        }
        $salesData[$creator_id]['total_sales'] += (float)$order['order_amount'];
        $salesData[$creator_id]['order_count']++;
        $salesData[$creator_id]['orders'][] = $order;
    }
    
    // Calculate totals
    $totalSales = array_sum(array_column($salesData, 'total_sales'));
    $totalOrders = array_sum(array_column($salesData, 'order_count'));
    $totalCommission = $totalSales * ($commission_rate / 100);
    
    // Create period
    $periodStmt = $pdo->prepare("
        INSERT INTO commission_periods (
            company_id, period_month, period_year, order_month, order_year,
            cutoff_date, status, total_sales, total_commission, total_orders,
            calculated_at, calculated_by
        ) VALUES (?, ?, ?, ?, ?, ?, 'Calculated', ?, ?, ?, NOW(), NULL)
    ");
    
    $periodStmt->execute([
        $company_id, $period_month, $period_year, $order_month, $order_year,
        $cutoff_date, $totalSales, $totalCommission, $totalOrders
    ]);
    
    $period_id = $pdo->lastInsertId();
    
    // Create records for each salesperson
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
        $userCommission = $data['total_sales'] * ($commission_rate / 100);
        
        $recordStmt->execute([
            $period_id,
            $user_id,
            $data['total_sales'],
            $commission_rate,
            $userCommission,
            $data['order_count']
        ]);
        
        $record_id = $pdo->lastInsertId();
        
        // Insert order lines
        foreach ($data['orders'] as $order) {
            $orderCommission = (float)$order['order_amount'] * ($commission_rate / 100);
            $lineStmt->execute([
                $record_id,
                $order['id'],
                date('Y-m-d', strtotime($order['order_date'])),
                date('Y-m-d H:i:s', strtotime($order['order_date'])), // Use order_date as confirmed_at
                $order['order_amount'],
                $orderCommission
            ]);
        }
    }
    
    $pdo->commit();
    
    echo json_encode([
        'ok' => true,
        'data' => [
            'period_id' => $period_id,
            'total_sales' => $totalSales,
            'total_commission' => $totalCommission,
            'total_orders' => $totalOrders,
            'salesperson_count' => count($salesData)
        ]
    ]);
    
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
