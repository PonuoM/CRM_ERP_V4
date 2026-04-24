<?php
/**
 * Simulate Retroactive Commission
 * Compares exact historically stamped orders inside a month against the dynamic commission engine calculation.
 * OPTIMIZED: Fetches all order_items in ONE batch query instead of per-order loop.
 */
require_once __DIR__ . "/../config.php";

header('Content-Type: application/json; charset=utf-8');

try {
    $pdo = db_connect();
    
    $company_id = (int)($_GET['company_id'] ?? 0);
    $for_month = (int)($_GET['month'] ?? date('n'));
    $for_year = (int)($_GET['year'] ?? date('Y'));
    
    if (!$company_id) {
        echo json_encode(['ok' => false, 'error' => 'Missing company_id']);
        exit;
    }
    
    // 1. Find batches for this month/year
    $batchStmt = $pdo->prepare("
        SELECT id 
        FROM commission_stamp_batches 
        WHERE company_id = ? 
        AND (for_month = ? OR (for_month IS NULL AND MONTH(created_at) = ?)) 
        AND (for_year = ? OR (for_year IS NULL AND YEAR(created_at) = ?))
    ");
    $batchStmt->execute([$company_id, $for_month, $for_month, $for_year, $for_year]);
    $batch_ids = $batchStmt->fetchAll(PDO::FETCH_COLUMN);
    
    if (empty($batch_ids)) {
        echo json_encode(['ok' => true, 'data' => []]);
        exit;
    }
    
    // 2. Load configurations
    $settingsStmt = $pdo->prepare("SELECT role_id, config_data FROM commission_settings WHERE company_id = ?");
    $settingsStmt->execute([$company_id]);
    $configs = [];
    while ($row = $settingsStmt->fetch(PDO::FETCH_ASSOC)) {
        $configs[$row['role_id']] = json_decode($row['config_data'], true);
    }
    
    // 3. Load users and their roles
    $usersStmt = $pdo->prepare("SELECT id, role_id, first_name, last_name FROM users WHERE company_id = ?");
    $usersStmt->execute([$company_id]);
    $usersData = [];
    while ($row = $usersStmt->fetch(PDO::FETCH_ASSOC)) {
        $usersData[$row['id']] = $row;
    }
    
    // 4. Load stamped orders
    $inQuery = implode(',', array_fill(0, count($batch_ids), '?'));
    $ordersStmt = $pdo->prepare("
        SELECT cso.order_id, cso.user_id as stamped_user_id, cso.commission_amount as old_commission, 
               o.id, o.creator_id as order_creator_id
        FROM commission_stamp_orders cso
        JOIN orders o ON o.id = cso.order_id
        WHERE cso.batch_id IN ($inQuery)
    ");
    $ordersStmt->execute($batch_ids);
    $orders = $ordersStmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($orders)) {
        echo json_encode(['ok' => true, 'data' => []]);
        exit;
    }

    // 5. *** KEY FIX: Fetch ALL items in ONE batch query ***
    //    Old code did: foreach($orders) { $itemsStmt->execute([$order_id]); }
    //    That caused N+1 queries (hundreds of round-trips) => timeout => Apache hang
    $allOrderIds = [];
    foreach ($orders as $order) {
        $allOrderIds[$order['id']] = true;
    }
    $allOrderIds = array_keys($allOrderIds);
    
    $itemsInQuery = implode(',', array_fill(0, count($allOrderIds), '?'));
    $itemsStmt = $pdo->prepare("
        SELECT 
            oi.id, oi.creator_id, oi.net_total, oi.is_freebie, oi.parent_item_id, oi.quantity,
            oi.parent_order_id,
            o.basket_key_at_sale as order_basket_key,
            p.report_category
        FROM order_items oi
        LEFT JOIN products p ON p.id = oi.product_id
        LEFT JOIN orders o ON o.id = oi.parent_order_id
        WHERE oi.parent_order_id IN ($itemsInQuery)
    ");
    $itemsStmt->execute($allOrderIds);
    $allItems = $itemsStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Group items by parent_order_id for O(1) lookup
    $itemsByOrder = [];
    foreach ($allItems as $item) {
        $itemsByOrder[$item['parent_order_id']][] = $item;
    }
    unset($allItems);
    
    // 6. Process orders using pre-fetched items
    $salesData = []; 

    foreach ($orders as $order) {
        $order_id = $order['id'];
        $old_commission = (float)$order['old_commission'];
        $order_creator_id = $order['order_creator_id'];
        
        $assigned_user_id = $order['stamped_user_id'] ?: $order_creator_id;
        if (!$assigned_user_id) continue;
        
        if (!isset($salesData[$assigned_user_id])) {
            $salesData[$assigned_user_id] = [
                'user_id' => $assigned_user_id,
                'first_name' => $usersData[$assigned_user_id]['first_name'] ?? 'Unknown',
                'last_name' => $usersData[$assigned_user_id]['last_name'] ?? '',
                'role_id' => $usersData[$assigned_user_id]['role_id'] ?? null,
                'old_commission' => 0,
                'total_sales' => 0,
                'items_data' => []
            ];
        }
        $salesData[$assigned_user_id]['old_commission'] += $old_commission;
        
        // Lookup from pre-fetched map (no DB call!)
        $items = $itemsByOrder[$order_id] ?? [];
        if (empty($items)) continue; 
        
        $ratio = 1.0; 
        
        foreach ($items as $item) {
            if ((int)$item['is_freebie'] === 1) continue;
            
            $item_creator_id = !empty($item['creator_id']) ? $item['creator_id'] : null;
            if (!empty($item['parent_item_id'])) {
                if ($item_creator_id && $item_creator_id != $order_creator_id) {
                    // Upsell - include
                } else {
                    continue; // Promo child - skip
                }
            }
            
            $beneficiary_id = $item_creator_id ?? $order_creator_id;
            if ($beneficiary_id != $assigned_user_id) continue;

            $item_net = (float)$item['net_total'];
            $commissionable_amount = $item_net * $ratio;
            $ratio_qty = (float)($item['quantity'] ?? 0) * $ratio;
            
            if ($commissionable_amount <= 0 && $ratio_qty <= 0) continue;
            
            $basket_key = $item['order_basket_key'] ?? '';
            $report_category = $item['report_category'] ?? 'อื่นๆ';
            
            $salesData[$assigned_user_id]['total_sales'] += $commissionable_amount;
            $salesData[$assigned_user_id]['items_data'][] = [
                'amount' => $commissionable_amount,
                'qty' => $ratio_qty,
                'basket_key' => $basket_key,
                'category' => $report_category
            ];
        }
    }
    
    // 7. Commission calculation engine
    $results = [];
    foreach ($salesData as $user_id => $data) {
        $role_id = $data['role_id'];
        $config = $configs[$role_id] ?? null;
        
        $new_commission = 0;
        
        $metrics = [
            'total_sales' => $data['total_sales'],
            'large_bag_qty' => 0,
            'large_bag_sales' => 0,
            'small_bag_qty' => 0,
            'small_bag_sales' => 0,
            'bio_qty' => 0,
            'bio_sales' => 0,
            'digging_qty' => 0,
            'digging_sales' => 0
        ];
        
        $digging_keys = isset($config['general']['digging_basket_keys']) ? $config['general']['digging_basket_keys'] : ["49", "50"];
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
            
            if ($type === 'digging') {
                $metrics['digging_qty'] += $it['qty'];
                $metrics['digging_sales'] += $it['amount'];
            } else if ($cat === 'กระสอบใหญ่') {
                $metrics['large_bag_qty'] += $it['qty'];
                $metrics['large_bag_sales'] += $it['amount'];
            } else if ($cat === 'กระสอบเล็ก') {
                $metrics['small_bag_qty'] += $it['qty'];
                $metrics['small_bag_sales'] += $it['amount'];
            } else if ($cat === 'ชีวภัณฑ์') {
                $metrics['bio_qty'] += $it['qty'];
                $metrics['bio_sales'] += $it['amount'];
            }
        }
        
        if ($config) {
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
                                    $max = isset($tier['max']) && $tier['max'] !== '' ? (float)$tier['max'] : PHP_FLOAT_MAX;
                                    if ($baseVal >= $min && $baseVal <= $max) {
                                        $matchedPercent = (float)$tier['percent'];
                                    }
                                }
                            }
                            $catCommission = $catAmount * ($matchedPercent / 100);
                        }
                    }
                    $new_commission += $catCommission;
                }
            }
        }
        
        $results[] = [
            'user_id' => $user_id,
            'name' => trim($data['first_name'] . ' ' . $data['last_name']),
            'role_id' => $role_id,
            'old_commission' => $data['old_commission'],
            'new_commission' => $new_commission,
            'metrics' => $metrics
        ];
    }
    
    echo json_encode([
        'ok' => true,
        'data' => $results
    ]);

} catch (Exception $e) {
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
