<?php
/**
 * Process Upsell By Others Cron Job
 * 
 * สำหรับลูกค้าที่อยู่ในถัง PERSONAL (มี assigned_to) แต่มี Order ใหม่ที่สร้างโดยคนอื่น
 * → ย้ายไปถัง 51 (Upsell Dashboard) เพื่อให้ Telesale ที่ดูแลอยู่ได้ขายเพิ่ม
 * 
 * Logic:
 * 1. หาลูกค้าที่อยู่ใน PERSONAL baskets (ไม่ใช่ distribution, ไม่ใช่ upsell)
 * 2. มี assigned_to (มีคนดูแลอยู่)
 * 3. มี Pending order ที่สร้างโดยคนอื่นที่ไม่ใช่ Telesale (role != 6, 7)
 * 4. ย้ายไปถัง 51 (Upsell Dashboard)
 * 
 * Run: Every 5 minutes
 * URL: /api/cron/process_upsell_by_others.php?key=upsell_others_2026_secret
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: text/plain; charset=utf-8');

// Security check
$expectedKey = 'upsell_others_2026_secret';
$providedKey = $_GET['key'] ?? '';

if ($providedKey !== $expectedKey) {
    http_response_code(403);
    die("Access denied. Invalid key.");
}

$dryRun = isset($_GET['dryrun']) && $_GET['dryrun'] == '1';

require_once __DIR__ . '/../config.php';

echo "=====================================================\n";
echo "Process Upsell By Others (Personal Basket → 51)\n";
echo "Date: " . date('Y-m-d H:i:s') . "\n";
echo "Mode: " . ($dryRun ? "DRY RUN (Preview Only)" : "LIVE EXECUTION") . "\n";
echo "=====================================================\n\n";

try {
    $pdo = db_connect();
    
    // Target basket: Upsell Dashboard (51)
    $targetBasket = 51;
    
    // Get personal baskets (dashboard_v2 = Telesale's working baskets)
    // Use 'id' column because customers.current_basket_key stores the numeric id
    // Exclude upsell baskets 51, 53
    $basketStmt = $pdo->query("
        SELECT id 
        FROM basket_config 
        WHERE company_id = 1 
          AND target_page = 'dashboard_v2'
          AND id NOT IN (51, 53)
          AND is_active = 1
    ");
    $personalBaskets = $basketStmt->fetchAll(PDO::FETCH_COLUMN, 0);
    
    if (empty($personalBaskets)) {
        echo "No personal baskets found.\n";
        exit;
    }
    
    $basketList = implode(',', $personalBaskets);
    echo "Personal baskets: " . $basketList . "\n\n";
    
    // Find customers in personal baskets with pending orders created by non-Telesale
    $sql = "
        SELECT DISTINCT
            c.customer_id,
            c.first_name,
            c.last_name,
            c.phone,
            c.current_basket_key,
            c.assigned_to,
            o.id as order_id,
            o.order_status,
            o.order_date,
            o.creator_id as order_creator,
            u.role_id as creator_role
        FROM customers c
        INNER JOIN orders o ON c.customer_id = o.customer_id
        INNER JOIN users u ON o.creator_id = u.id
        WHERE c.current_basket_key IN ({$basketList})
          AND c.assigned_to IS NOT NULL AND c.assigned_to > 0
          AND o.order_status = 'Pending'
          AND o.order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          AND u.role_id NOT IN (6, 7)  -- Order NOT created by Telesale
          AND o.creator_id != c.assigned_to  -- Order NOT created by their assigned owner
        ORDER BY c.customer_id
    ";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $count = count($customers);
    echo "Found {$count} customers in personal baskets with orders by others\n\n";
    
    if ($count === 0) {
        echo "No customers to process.\n";
        exit;
    }
    
    $moved = 0;
    $errors = 0;
    
    foreach ($customers as $index => $customer) {
        $num = $index + 1;
        $name = trim($customer['first_name'] . ' ' . $customer['last_name']);
        
        echo "[{$num}] Customer: {$customer['customer_id']} ({$name})\n";
        echo "    Phone: {$customer['phone']}\n";
        echo "    Current Basket: {$customer['current_basket_key']}\n";
        echo "    Assigned to: {$customer['assigned_to']}\n";
        echo "    Order: {$customer['order_id']} ({$customer['order_status']}) - {$customer['order_date']}\n";
        echo "    Order Creator: {$customer['order_creator']} (Role: {$customer['creator_role']})\n";
        
        if ($dryRun) {
            echo "    → WOULD MOVE to basket {$targetBasket} (Dry Run)\n\n";
            $moved++;
        } else {
            try {
                // Update customer basket
                $updateStmt = $pdo->prepare("
                    UPDATE customers 
                    SET current_basket_key = ?,
                        basket_entered_date = NOW()
                    WHERE customer_id = ?
                ");
                $updateStmt->execute([$targetBasket, $customer['customer_id']]);
                
                // Log transition
                $logStmt = $pdo->prepare("
                    INSERT INTO basket_transition_log 
                    (customer_id, from_basket, to_basket, reason, created_at)
                    VALUES (?, ?, ?, 'upsell_by_others', NOW())
                ");
                $logStmt->execute([
                    $customer['customer_id'],
                    $customer['current_basket_key'],
                    $targetBasket
                ]);
                
                echo "    → MOVED to basket {$targetBasket}\n\n";
                $moved++;
            } catch (Exception $e) {
                echo "    → ERROR: " . $e->getMessage() . "\n\n";
                $errors++;
            }
        }
    }
    
    echo "=====================================================\n";
    echo "SUMMARY\n";
    echo "=====================================================\n";
    echo "Total Found: {$count}\n";
    echo "Moved:       {$moved}\n";
    echo "Errors:      {$errors}\n";
    echo "=====================================================\n";
    
    if ($dryRun) {
        echo "\nDRY RUN COMPLETE - No changes made\n";
        echo "To execute: add &dryrun=0 to URL\n";
    }
    
} catch (PDOException $e) {
    echo "Database error: " . $e->getMessage() . "\n";
    exit(1);
}
