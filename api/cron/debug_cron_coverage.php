<?php
/**
 * Debug Script: Verify Cron Coverage for Basket Routing
 * 
 * ตรวจสอบว่าทุก scenario มี cron รับผิดชอบครบถ้วน
 * 
 * URL: /api/cron/debug_cron_coverage.php?key=debug_coverage_2026
 */

header('Content-Type: text/plain; charset=utf-8');

$SECRET_KEY = 'debug_coverage_2026';
$inputKey = $_GET['key'] ?? '';

if ($inputKey !== $SECRET_KEY) {
    http_response_code(403);
    die("Access Denied.\n");
}

require_once __DIR__ . '/../config.php';

echo "=====================================================\n";
echo "Debug: Cron Coverage Analysis\n";
echo "Date: " . date('Y-m-d H:i:s') . "\n";
echo "=====================================================\n\n";

try {
    $pdo = db_connect();
    
    // ===========================================
    // SECTION 1: PENDING ORDERS COVERAGE
    // ===========================================
    echo "=== SECTION 1: PENDING ORDERS ===\n\n";
    
    // Case 1A: No owner + Pending → should go to 53 (process_upsell_distribution)
    $sql1a = "
        SELECT c.customer_id, c.first_name, c.last_name, c.current_basket_key, c.assigned_to,
               o.id as order_id, o.order_status, o.order_date
        FROM customers c
        INNER JOIN orders o ON c.customer_id = o.customer_id
        WHERE o.order_status = 'Pending'
          AND o.order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          AND (c.assigned_to IS NULL OR c.assigned_to = 0)
        LIMIT 20
    ";
    $stmt = $pdo->query($sql1a);
    $results1a = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "1A. No Owner + Pending → Should go to 53 (process_upsell_distribution)\n";
    echo "    Found: " . count($results1a) . " customers\n";
    foreach ($results1a as $r) {
        $status = ($r['current_basket_key'] == 53) ? '✅ CORRECT' : '❌ WRONG (basket ' . $r['current_basket_key'] . ')';
        echo "    - [{$r['customer_id']}] {$r['first_name']} {$r['last_name']} → basket {$r['current_basket_key']} $status\n";
    }
    echo "\n";
    
    // Case 1B: Has owner + Pending + Non-owner creator → should go to 51 (process_upsell_by_others)
    $sql1b = "
        SELECT c.customer_id, c.first_name, c.last_name, c.current_basket_key, c.assigned_to,
               o.id as order_id, o.order_status, o.creator_id
        FROM customers c
        INNER JOIN orders o ON c.customer_id = o.customer_id
        INNER JOIN users u ON o.creator_id = u.id
        WHERE o.order_status = 'Pending'
          AND o.order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          AND c.assigned_to IS NOT NULL AND c.assigned_to > 0
          AND u.role_id NOT IN (6, 7)
          AND o.creator_id != c.assigned_to
        LIMIT 20
    ";
    $stmt = $pdo->query($sql1b);
    $results1b = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "1B. Has Owner + Pending + Non-owner creator → Should go to 51 (process_upsell_by_others)\n";
    echo "    Found: " . count($results1b) . " customers\n";
    foreach ($results1b as $r) {
        $status = ($r['current_basket_key'] == 51) ? '✅ CORRECT' : '❌ WRONG (basket ' . $r['current_basket_key'] . ')';
        echo "    - [{$r['customer_id']}] {$r['first_name']} {$r['last_name']} → basket {$r['current_basket_key']} $status\n";
    }
    echo "\n";
    
    // ===========================================
    // SECTION 2: PICKING ORDERS COVERAGE
    // ===========================================
    echo "=== SECTION 2: PICKING ORDERS ===\n\n";
    
    // Case 2A: No owner + Picking → should go to 52 (upsell_exit_handler)
    $sql2a = "
        SELECT c.customer_id, c.first_name, c.last_name, c.current_basket_key, c.assigned_to,
               o.id as order_id, o.order_status
        FROM customers c
        INNER JOIN orders o ON c.customer_id = o.customer_id
        WHERE o.order_status IN ('Picking', 'Shipping')
          AND o.order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          AND (c.assigned_to IS NULL OR c.assigned_to = 0)
        LIMIT 20
    ";
    $stmt = $pdo->query($sql2a);
    $results2a = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "2A. No Owner + Picking → Should go to 52 (upsell_exit_handler)\n";
    echo "    Found: " . count($results2a) . " customers\n";
    foreach ($results2a as $r) {
        $status = ($r['current_basket_key'] == 52) ? '✅ CORRECT' : '❌ WRONG (basket ' . $r['current_basket_key'] . ')';
        echo "    - [{$r['customer_id']}] {$r['first_name']} {$r['last_name']} → basket {$r['current_basket_key']} $status\n";
    }
    echo "\n";
    
    // Case 2B: Basket 51 + Picking → should go to 39/38 (process_upsell_51_exit)
    $sql2b = "
        SELECT c.customer_id, c.first_name, c.last_name, c.current_basket_key, c.assigned_to,
               o.id as order_id, o.order_status
        FROM customers c
        INNER JOIN orders o ON c.customer_id = o.customer_id
        WHERE o.order_status IN ('Picking', 'Shipping')
          AND o.order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          AND c.current_basket_key = 51
        LIMIT 20
    ";
    $stmt = $pdo->query($sql2b);
    $results2b = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "2B. Basket 51 + Picking → Should go to 39 or 38 (process_upsell_51_exit)\n";
    echo "    Found: " . count($results2b) . " customers still in basket 51 with Picking orders\n";
    foreach ($results2b as $r) {
        echo "    - [{$r['customer_id']}] {$r['first_name']} {$r['last_name']} → basket 51 ⏳ (waiting for cron)\n";
    }
    echo "\n";
    
    // Case 2C: Has owner + NOT basket 51 + Picking → should go to 39/38 (process_picking_baskets)
    $sql2c = "
        SELECT c.customer_id, c.first_name, c.last_name, c.current_basket_key, c.assigned_to,
               o.id as order_id, o.order_status, o.creator_id
        FROM customers c
        INNER JOIN orders o ON c.customer_id = o.customer_id
        WHERE o.order_status IN ('Picking', 'Shipping')
          AND o.order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          AND c.assigned_to IS NOT NULL AND c.assigned_to > 0
          AND c.current_basket_key != 51
          AND c.current_basket_key NOT IN (38, 39)
        LIMIT 20
    ";
    $stmt = $pdo->query($sql2c);
    $results2c = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "2C. Has Owner + NOT basket 51 + Picking → Should go to 39 or 38 (process_picking_baskets)\n";
    echo "    Found: " . count($results2c) . " customers NOT in correct basket yet\n";
    foreach ($results2c as $r) {
        echo "    - [{$r['customer_id']}] {$r['first_name']} {$r['last_name']} → basket {$r['current_basket_key']} ⏳ (waiting for cron)\n";
    }
    echo "\n";
    
    // ===========================================
    // SECTION 3: CORRECTLY ROUTED CUSTOMERS
    // ===========================================
    echo "=== SECTION 3: CORRECTLY ROUTED (Last 7 days) ===\n\n";
    
    $sqlCorrect = "
        SELECT c.customer_id, c.first_name, c.last_name, c.current_basket_key, c.assigned_to,
               o.id as order_id, o.order_status
        FROM customers c
        INNER JOIN orders o ON c.customer_id = o.customer_id
        WHERE o.order_status IN ('Picking', 'Shipping')
          AND o.order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          AND c.current_basket_key IN (38, 39)
        LIMIT 30
    ";
    $stmt = $pdo->query($sqlCorrect);
    $resultsCorrect = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $count38 = 0;
    $count39 = 0;
    foreach ($resultsCorrect as $r) {
        if ($r['current_basket_key'] == 38) $count38++;
        if ($r['current_basket_key'] == 39) $count39++;
    }
    
    echo "Customers correctly in basket 38 (ขายไม่ได้): $count38\n";
    echo "Customers correctly in basket 39 (ขายได้): $count39\n";
    echo "\n";
    
    // ===========================================
    // SECTION 4: RECENT TRANSITIONS
    // ===========================================
    echo "=== SECTION 4: RECENT BASKET TRANSITIONS (Today) ===\n\n";
    
    $sqlTransitions = "
        SELECT 
            btl.customer_id,
            btl.from_basket_key,
            btl.to_basket_key,
            btl.transition_type,
            btl.notes,
            DATE_FORMAT(btl.created_at, '%H:%i:%s') as time
        FROM basket_transition_log btl
        WHERE DATE(btl.created_at) = CURDATE()
        ORDER BY btl.created_at DESC
        LIMIT 30
    ";
    $stmt = $pdo->query($sqlTransitions);
    $transitions = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Last 30 transitions today:\n";
    foreach ($transitions as $t) {
        echo "    [{$t['time']}] Customer {$t['customer_id']}: {$t['from_basket_key']} → {$t['to_basket_key']} ({$t['transition_type']})\n";
    }
    echo "\n";
    
    // ===========================================
    // SECTION 5: SUMMARY
    // ===========================================
    echo "=== SECTION 5: SUMMARY ===\n\n";
    
    $issues = 0;
    if (count($results1a) > 0) {
        foreach ($results1a as $r) {
            if ($r['current_basket_key'] != 53) $issues++;
        }
    }
    if (count($results2a) > 0) {
        foreach ($results2a as $r) {
            if ($r['current_basket_key'] != 52) $issues++;
        }
    }
    $issues += count($results2b); // Basket 51 waiting
    $issues += count($results2c); // Personal basket waiting
    
    if ($issues == 0) {
        echo "✅ ALL CRONS WORKING CORRECTLY!\n";
    } else {
        echo "⚠️ Found $issues customers pending cron processing.\n";
        echo "   This is normal if crons haven't run yet after Export.\n";
    }
    
    echo "\n=====================================================\n";
    echo "Debug Complete\n";
    echo "=====================================================\n";
    
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
