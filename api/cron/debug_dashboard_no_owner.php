<?php
/**
 * Debug: Check customers in dashboard_v2 baskets with no owner
 */

header('Content-Type: text/plain; charset=utf-8');

require_once __DIR__ . '/../config.php';

$pdo = db_connect();

echo "=====================================================\n";
echo "Customers in Dashboard V2 baskets with NO OWNER\n";
echo "Date: " . date('Y-m-d H:i:s') . "\n";
echo "=====================================================\n\n";

// Get dashboard_v2 basket IDs
$basketStmt = $pdo->query("
    SELECT id, basket_key, basket_name
    FROM basket_config
    WHERE target_page = 'dashboard_v2'
    AND is_active = 1
    ORDER BY id
");
$dashboardBaskets = $basketStmt->fetchAll(PDO::FETCH_ASSOC);

echo "Dashboard V2 Baskets:\n";
foreach ($dashboardBaskets as $b) {
    echo "  - {$b['id']}: {$b['basket_name']} ({$b['basket_key']})\n";
}
echo "\n";

$basketIds = array_column($dashboardBaskets, 'id');
$basketList = implode(',', $basketIds);

// Count customers per basket with no owner
echo "Customers with assigned_to = NULL per basket:\n";
echo "-----------------------------------------------------\n";

$totalNoOwner = 0;

foreach ($dashboardBaskets as $b) {
    $countStmt = $pdo->prepare("
        SELECT COUNT(*) as cnt
        FROM customers
        WHERE current_basket_key = ?
          AND (assigned_to IS NULL OR assigned_to = 0)
    ");
    $countStmt->execute([$b['id']]);
    $count = $countStmt->fetch(PDO::FETCH_ASSOC)['cnt'];
    $totalNoOwner += $count;
    
    if ($count > 0) {
        echo "  Basket {$b['id']} ({$b['basket_name']}): $count customers\n";
    }
}

echo "-----------------------------------------------------\n";
echo "TOTAL NO-OWNER in Dashboard V2: $totalNoOwner\n\n";

// Show sample customers
echo "Sample customers (first 30):\n";
echo "-----------------------------------------------------\n";

$sampleStmt = $pdo->prepare("
    SELECT c.customer_id, c.first_name, c.last_name, c.current_basket_key, 
           bc.basket_name, c.basket_entered_date
    FROM customers c
    LEFT JOIN basket_config bc ON c.current_basket_key = bc.id
    WHERE c.current_basket_key IN ($basketList)
      AND (c.assigned_to IS NULL OR c.assigned_to = 0)
    ORDER BY c.basket_entered_date DESC
    LIMIT 30
");
$sampleStmt->execute();
$samples = $sampleStmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($samples as $s) {
    echo "[{$s['customer_id']}] {$s['first_name']} {$s['last_name']} → basket {$s['current_basket_key']} ({$s['basket_name']}) - entered: {$s['basket_entered_date']}\n";
}

echo "\n=====================================================\n";
echo "Complete\n";
echo "=====================================================\n";
