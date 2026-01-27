<?php
/**
 * Debug: Show all Upsell candidates and their current baskets
 * 
 * URL: /api/cron/debug_upsell_candidates.php?key=upsell_dist_2026_secret
 */

header('Content-Type: text/plain; charset=utf-8');

$SECRET_KEY = 'upsell_dist_2026_secret';
$inputKey = $_GET['key'] ?? '';

if ($inputKey !== $SECRET_KEY) {
    http_response_code(403);
    die("Access Denied.\n");
}

define('SKIP_AUTH', true);
require_once __DIR__ . '/../config.php';

echo "=====================================================\n";
echo "Debug: All Upsell Candidates (Virtual Query)\n";
echo "Date: " . date('Y-m-d H:i:s') . "\n";
echo "=====================================================\n\n";

try {
    $pdo = db_connect();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Query: Find ALL customers with Pending orders from Admin (no basket filter)
    $sql = "
        SELECT 
            c.customer_id,
            c.first_name,
            c.last_name,
            c.current_basket_key,
            c.assigned_to,
            o.id AS order_id,
            o.order_date,
            o.creator_id,
            u.first_name AS creator_first_name,
            u.role_id AS creator_role
        FROM customers c
        INNER JOIN orders o ON c.customer_id = o.customer_id
        INNER JOIN users u ON o.creator_id = u.id
        WHERE c.company_id = 1
          -- ลูกค้าไม่มีเจ้าของ
          AND (c.assigned_to IS NULL OR c.assigned_to = 0)
          -- มี Order สถานะ Pending
          AND o.order_status = 'Pending'
          -- Order สร้างโดย Non-Telesale (ไม่ใช่ role 6, 7)
          AND u.role_id NOT IN (6, 7)
        ORDER BY c.current_basket_key, o.order_date DESC
    ";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $candidates = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Found " . count($candidates) . " total candidates\n\n";
    
    // Group by basket_key
    $byBasket = [];
    foreach ($candidates as $row) {
        $basket = $row['current_basket_key'] ?? 'NULL';
        if (!isset($byBasket[$basket])) {
            $byBasket[$basket] = [];
        }
        $byBasket[$basket][] = $row;
    }
    
    // Distribution baskets (will be moved by cron)
    $DISTRIBUTION_BASKETS = [41, 42, 43, 44, 45, 52];
    
    echo "=====================================================\n";
    echo "BREAKDOWN BY BASKET\n";
    echo "=====================================================\n\n";
    
    $totalInDistribution = 0;
    $totalOther = 0;
    
    foreach ($byBasket as $basketKey => $customers) {
        $count = count($customers);
        $isDistribution = in_array($basketKey, $DISTRIBUTION_BASKETS);
        $marker = $isDistribution ? "✅ WILL MOVE" : "❌ NOT in distribution";
        
        if ($isDistribution) {
            $totalInDistribution += $count;
        } else {
            $totalOther += $count;
        }
        
        echo "Basket {$basketKey}: {$count} รายการ ({$marker})\n";
        foreach ($customers as $row) {
            echo "  - [{$row['customer_id']}] {$row['first_name']} {$row['last_name']}\n";
            echo "    Order: {$row['order_id']} ({$row['order_date']}) by {$row['creator_first_name']}\n";
        }
        echo "\n";
    }
    
    echo "=====================================================\n";
    echo "SUMMARY\n";
    echo "=====================================================\n";
    echo "Total Candidates:       " . count($candidates) . "\n";
    echo "In Distribution Basket: {$totalInDistribution} (will be moved to 53)\n";
    echo "In Other Baskets:       {$totalOther} (will NOT be moved)\n";
    echo "=====================================================\n";
    
} catch (Exception $e) {
    echo "FATAL ERROR: " . $e->getMessage() . "\n";
    echo "Line: " . $e->getLine() . "\n";
}
