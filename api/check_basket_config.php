<?php
/**
 * ดึงข้อมูล basket_config จากฐานข้อมูลโดยตรง
 */
header('Content-Type: text/plain; charset=utf-8');
require_once __DIR__ . '/config.php';

try {
    $pdo = db_connect();
    
    $stmt = $pdo->query("
        SELECT 
            id,
            basket_key,
            basket_name,
            target_page,
            min_days_since_order,
            max_days_since_order,
            fail_after_days,
            on_sale_basket_key,
            on_fail_basket_key,
            on_fail_reevaluate,
            max_distribution_count,
            hold_days_before_redistribute,
            linked_basket_key,
            has_loop
        FROM basket_config 
        WHERE company_id = 1 AND is_active = 1
        ORDER BY target_page, display_order
    ");
    
    $configs = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "=== BASKET CONFIG FROM DATABASE ===\n";
    echo "Generated: " . date('Y-m-d H:i:s') . "\n\n";
    
    $currentPage = '';
    foreach ($configs as $c) {
        if ($c['target_page'] !== $currentPage) {
            $currentPage = $c['target_page'];
            echo "\n=== " . strtoupper($currentPage) . " ===\n\n";
        }
        
        echo "ID: {$c['id']} | {$c['basket_key']} ({$c['basket_name']})\n";
        echo "  days_range: {$c['min_days_since_order']} - {$c['max_days_since_order']}\n";
        echo "  fail_after_days: {$c['fail_after_days']}\n";
        echo "  on_sale: {$c['on_sale_basket_key']}\n";
        echo "  on_fail: {$c['on_fail_basket_key']} | reevaluate: " . ($c['on_fail_reevaluate'] ? 'YES' : 'NO') . "\n";
        echo "  linked: {$c['linked_basket_key']} | has_loop: " . ($c['has_loop'] ? 'YES' : 'NO') . "\n";
        echo "  max_dist: {$c['max_distribution_count']} | hold_days: {$c['hold_days_before_redistribute']}\n";
        echo "\n";
    }
    
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
