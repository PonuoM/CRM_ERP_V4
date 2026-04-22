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
    
    // 0. Load Commission Settings & User Roles
    $settingsStmt = $pdo->prepare("SELECT role_id, config_data FROM commission_settings WHERE company_id = ?");
    $settingsStmt->execute([$company_id]);
    $configs = [];
    foreach ($settingsStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        if ($row['config_data']) {
            $configs[$row['role_id']] = json_decode($row['config_data'], true);
        }
    }
    
    $usersStmt = $pdo->prepare("SELECT id, role FROM users WHERE company_id = ?");
    $usersStmt->execute([$company_id]);
    $userRoles = [];
    foreach ($usersStmt->fetchAll(PDO::FETCH_ASSOC) as $u) {
        $userRoles[$u['id']] = (int)$u['role'];
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
    
    $itemsStmt = $pdo->prepare("
        SELECT 
            oi.id, 
            oi.creator_id, 
            oi.net_total, 
            oi.is_freebie, 
            oi.parent_item_id,
            oi.quantity,
            o.basket_key_at_sale as order_basket_key,
            p.report_category
        FROM order_items oi
        LEFT JOIN products p ON p.id = oi.product_id
        LEFT JOIN orders o ON o.id = oi.parent_order_id
        WHERE oi.parent_order_id = ?
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
        // IMPORTANT: Only count commissionable items (exclude freebies and promotion children from same creator)
        $total_item_value = 0;
        foreach ($items as $item) {
            // Skip freebies
            if ((int)$item['is_freebie'] === 1) continue;
            
            // Skip promotion children from the same creator
            if (!empty($item['parent_item_id'])) {
                $item_creator_id = !empty($item['creator_id']) ? $item['creator_id'] : null;
                // If same creator as order, it's a promotion child - skip
                if (!$item_creator_id || $item_creator_id == $order_creator_id) {
                    continue;
                }
                // If different creator, it's an upsell item - include it
            }
            
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
            
            // Determine beneficiary first to check if this is an upsell item
            $item_creator_id = !empty($item['creator_id']) ? $item['creator_id'] : null;
            $beneficiary_id = $item_creator_id ?? $order_creator_id;
            
            // Skip promotion children ONLY if they belong to the same creator as the order
            if (!empty($item['parent_item_id'])) {
                if ($item_creator_id && $item_creator_id != $order_creator_id) {
                    // This is an upsell item, don't skip it
                } else {
                    // This is a promotion child from the same creator, skip it
                    continue;
                }
            }
            
            $item_net = (float)$item['net_total'];
            $ratio_qty = (float)($item['quantity'] ?? 0) * $ratio;
            $commissionable_amount = $item_net * $ratio;
            
            if ($commissionable_amount <= 0 && $ratio_qty <= 0) continue;
            
            if (!$beneficiary_id) continue; // Should not happen if data integrity is good
            
            $basket_key = $item['order_basket_key'] ?? '';
            $report_category = $item['report_category'] ?? 'อื่นๆ';
            
            // Add to sales data
            if (!isset($salesData[$beneficiary_id])) {
                $salesData[$beneficiary_id] = [
                    'total_sales' => 0,
                    'order_count' => 0,
                    'orders_seen' => [],
                    'lines' => [],
                    'items_data' => []
                ];
            }
            
            $salesData[$beneficiary_id]['total_sales'] += $commissionable_amount;
            
            // Track unique orders for this user
            if (!isset($salesData[$beneficiary_id]['orders_seen'][$order_id])) {
                $salesData[$beneficiary_id]['order_count']++;
                $salesData[$beneficiary_id]['orders_seen'][$order_id] = true;
            }
            
            if (!isset($salesData[$beneficiary_id]['lines'][$order_id])) {
                $salesData[$beneficiary_id]['lines'][$order_id] = [
                     'order_id' => $order_id,
                     'order_date' => $order['order_date'],
                     'confirmed_at' => $order['confirmed_at'] ?? $order['order_date'], // Fallback
                     'amount' => 0,
                     'commission_amount' => 0
                ];
            }
            $salesData[$beneficiary_id]['lines'][$order_id]['amount'] += $commissionable_amount;
            
            $salesData[$beneficiary_id]['items_data'][] = [
                'order_id' => $order_id,
                'amount' => $commissionable_amount,
                'qty' => $ratio_qty,
                'basket_key' => $basket_key,
                'category' => $report_category
            ];
            
            $hasCommissionableItems = true;
        }
        
        if ($hasCommissionableItems) {
            $totalOrdersProcessed++;
        }
    }
    
    // Calculate Commission Dynamically based on Settings
    $grandTotalSales = 0;
    $grandTotalOrders = $totalOrdersProcessed; 
    $grandTotalCommission = 0;
    
    foreach ($salesData as $user_id => &$data) {
        $grandTotalSales += $data['total_sales'];
        
        $role_id = $userRoles[$user_id] ?? null;
        $config = $configs[$role_id] ?? null;
        $fallback_rate = $commission_rate;
        
        $userCommission = 0;
        
        if ($config) {
            $digging_keys = $config['general']['digging_basket_keys'] ?? ["49", "50"];
            
            $categoriesSales = ['self' => [], 'digging' => []];
            $categoriesQty = ['self' => [], 'digging' => []];
            
            foreach ($data['items_data'] as $it) {
                $type = in_array((string)$it['basket_key'], $digging_keys) ? 'digging' : 'self';
                $cat = $it['category'];
                
                if (!isset($categoriesSales[$type][$cat])) {
                    $categoriesSales[$type][$cat] = 0;
                    $categoriesQty[$type][$cat] = 0;
                }
                $categoriesSales[$type][$cat] += $it['amount'];
                $categoriesQty[$type][$cat] += $it['qty'];
            }
            
            foreach (['self', 'digging'] as $type) {
                $rules = $config['rules'][$type] ?? [];
                foreach ($categoriesSales[$type] as $cat => $catAmount) {
                    $catQty = $categoriesQty[$type][$cat];
                    $rule = $rules[$cat] ?? null;
                    $catCommission = 0;
                    
                    if ($rule) {
                        if ($rule['type'] === 'fixed_per_qty') {
                            $catCommission = $catQty * (float)$rule['value'];
                        } else if ($rule['type'] === 'percent_of_item') {
                            $catCommission = $catAmount * ((float)$rule['value'] / 100);
                        } else if ($rule['type'] === 'tiered_percent') {
                            $baseVal = (($rule['tier_base'] ?? '') === 'total_sales_all_products') ? $data['total_sales'] : $catAmount;
                            $matchedPercent = 0;
                            if (!empty($rule['tiers'])) {
                                foreach ($rule['tiers'] as $tier) {
                                    $min = (float)$tier['min'];
                                    $max = isset($tier['max']) && $tier['max'] !== null ? (float)$tier['max'] : PHP_FLOAT_MAX;
                                    if ($baseVal >= $min && $baseVal <= $max) {
                                        $matchedPercent = (float)$tier['percent'];
                                    }
                                }
                            }
                            $catCommission = $catAmount * ($matchedPercent / 100);
                        }
                    }
                    
                    $userCommission += $catCommission;
                    
                    // Distribute back to lines
                    if ($catAmount > 0) {
                        $catCommRatio = $catCommission / $catAmount;
                        foreach ($data['items_data'] as $it) {
                            $itType = in_array((string)$it['basket_key'], $digging_keys) ? 'digging' : 'self';
                            if ($itType === $type && $it['category'] === $cat) {
                                $data['lines'][$it['order_id']]['commission_amount'] += ($it['amount'] * $catCommRatio);
                            }
                        }
                    } elseif ($catCommission > 0 && $catQty > 0) {
                        $catCommRatio = $catCommission / $catQty;
                        foreach ($data['items_data'] as $it) {
                            $itType = in_array((string)$it['basket_key'], $digging_keys) ? 'digging' : 'self';
                            if ($itType === $type && $it['category'] === $cat) {
                                $data['lines'][$it['order_id']]['commission_amount'] += ($it['qty'] * $catCommRatio);
                            }
                        }
                    }
                }
            }
        } else {
            // Fallback if no specific config
            $userCommission = $data['total_sales'] * ($fallback_rate / 100);
            foreach ($data['lines'] as $oid => &$ln) {
                $ln['commission_amount'] = $ln['amount'] * ($fallback_rate / 100);
            }
        }
        
        $data['total_commission'] = $userCommission;
        $grandTotalCommission += $userCommission;
    }
    unset($data);
    
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
        $userCommission = $data['total_commission'];
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
            $lineCommission = $line['commission_amount'];
            
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
