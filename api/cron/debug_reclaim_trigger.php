<?php
/**
 * Debug Script: Find what caused 39/51 → 38 transitions
 * 
 * 1. ดู basket configuration ว่า linked_basket_key ตั้งค่าอย่างไร
 * 2. ดู transitions ที่ 11:21 ว่ามาจาก basket ไหนบ้าง
 * 3. หา pattern ว่าอะไรเป็น trigger
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: text/plain; charset=utf-8');

// Security check
$expectedKey = 'debug_trigger_2026_secret';
$providedKey = $_GET['key'] ?? '';

if ($providedKey !== $expectedKey) {
    http_response_code(403);
    die("Access denied. Invalid key.");
}

require_once __DIR__ . '/../config.php';

$today = date('Y-m-d');

echo "=====================================================\n";
echo "Debug: Reclaim Trigger Source Analysis\n";
echo "Date: {$today} " . date('H:i:s') . "\n";
echo "=====================================================\n\n";

try {
    $pdo = db_connect();
    
    // === SECTION 1: Basket Configuration ===
    echo "=== SECTION 1: BASKET CONFIGURATION ===\n\n";
    
    $basketConfigStmt = $pdo->query("
        SELECT 
            id,
            basket_key,
            basket_name,
            target_page,
            linked_basket_key
        FROM basket_config
        WHERE company_id = 1
        ORDER BY target_page, id
    ");
    $baskets = $basketConfigStmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo str_pad("ID", 5) . str_pad("Key", 25) . str_pad("Name", 30) . str_pad("Target Page", 15) . "Linked To\n";
    echo str_repeat("-", 90) . "\n";
    
    foreach ($baskets as $basket) {
        echo str_pad($basket['id'], 5);
        echo str_pad($basket['basket_key'] ?? '', 25);
        echo str_pad(mb_strimwidth($basket['basket_name'] ?? '', 0, 28, '..'), 30);
        echo str_pad($basket['target_page'] ?? '', 15);
        echo ($basket['linked_basket_key'] ?? '-') . "\n";
    }
    
    // === SECTION 2: Analyze 39 → 38 Transitions ===
    echo "\n\n=== SECTION 2: TRANSITIONS FROM 39/51 → 38 TODAY ===\n\n";
    
    $transStmt = $pdo->prepare("
        SELECT 
            btl.*,
            c.first_name,
            c.last_name,
            c.assigned_to,
            u.username as triggered_by_username
        FROM basket_transition_log btl
        LEFT JOIN customers c ON btl.customer_id = c.customer_id
        LEFT JOIN users u ON btl.triggered_by = u.id
        WHERE DATE(btl.created_at) = ?
          AND btl.from_basket_key IN (39, 51) 
          AND btl.to_basket_key = 38
        ORDER BY btl.created_at
        LIMIT 50
    ");
    $transStmt->execute([$today]);
    $transitions = $transStmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Found " . count($transitions) . " transitions from 39/51 → 38 today:\n\n";
    
    // Group by triggered_by
    $triggerGroups = [];
    foreach ($transitions as $trans) {
        $triggeredBy = $trans['triggered_by'] ?? 'Unknown';
        $username = $trans['triggered_by_username'] ?? 'Unknown';
        if (!isset($triggerGroups[$triggeredBy])) {
            $triggerGroups[$triggeredBy] = [
                'username' => $username,
                'count' => 0,
                'times' => []
            ];
        }
        $triggerGroups[$triggeredBy]['count']++;
        $time = substr($trans['created_at'], 11, 8);
        if (!in_array($time, $triggerGroups[$triggeredBy]['times'])) {
            $triggerGroups[$triggeredBy]['times'][] = $time;
        }
    }
    
    echo "Grouped by triggered_by:\n";
    foreach ($triggerGroups as $id => $data) {
        echo "  User ID: {$id} (Username: {$data['username']})\n";
        echo "    Count: {$data['count']}\n";
        echo "    Times: " . implode(', ', $data['times']) . "\n\n";
    }
    
    // === SECTION 3: Sample Details ===
    echo "\n=== SECTION 3: SAMPLE TRANSITION DETAILS (First 10) ===\n\n";
    
    foreach (array_slice($transitions, 0, 10) as $trans) {
        $fromBasket = $trans['from_basket_key'] ?? $trans['from_basket'] ?? 'N/A';
        $toBasket = $trans['to_basket_key'] ?? $trans['to_basket'] ?? 'N/A';
        $triggeredBy = $trans['triggered_by'] ?? 'N/A';
        $notes = $trans['notes'] ?? 'N/A';
        $reason = $trans['transition_type'] ?? $trans['reason'] ?? 'N/A';
        
        echo "Customer: {$trans['customer_id']} ({$trans['first_name']} {$trans['last_name']})\n";
        echo "  Time: {$trans['created_at']}\n";
        echo "  From: {$fromBasket} → To: {$toBasket}\n";
        echo "  Reason: {$reason}\n";
        echo "  Triggered By: {$triggeredBy} ({$trans['triggered_by_username']})\n";
        echo "  Notes: {$notes}\n\n";
    }
    
    // === SECTION 4: Check what happened at 11:21 ===
    echo "\n=== SECTION 4: ALL 'manual' TRANSITIONS AT 11:21 ===\n\n";
    
    $elevenTwentyStmt = $pdo->prepare("
        SELECT 
            btl.from_basket_key,
            btl.to_basket_key,
            btl.transition_type,
            btl.triggered_by,
            u.username,
            COUNT(*) as count
        FROM basket_transition_log btl
        LEFT JOIN users u ON btl.triggered_by = u.id
        WHERE DATE(btl.created_at) = ?
          AND TIME(btl.created_at) BETWEEN '11:20:00' AND '11:25:00'
          AND (btl.transition_type = 'manual' OR btl.reason = 'manual')
        GROUP BY btl.from_basket_key, btl.to_basket_key, btl.transition_type, btl.triggered_by, u.username
        ORDER BY count DESC
    ");
    $elevenTwentyStmt->execute([$today]);
    $elevenTwenty = $elevenTwentyStmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Summary of 'manual' transitions at 11:21:\n\n";
    echo str_pad("From", 8) . str_pad("To", 8) . str_pad("Type", 12) . str_pad("By User ID", 12) . str_pad("Username", 15) . "Count\n";
    echo str_repeat("-", 65) . "\n";
    
    foreach ($elevenTwenty as $row) {
        echo str_pad($row['from_basket_key'] ?? '-', 8);
        echo str_pad($row['to_basket_key'] ?? '-', 8);
        echo str_pad($row['transition_type'] ?? '-', 12);
        echo str_pad($row['triggered_by'] ?? '-', 12);
        echo str_pad($row['username'] ?? '-', 15);
        echo $row['count'] . "\n";
    }
    
    // === SECTION 5: Check if there's a cron or API that might cause this ===
    echo "\n\n=== SECTION 5: POSSIBLE SOURCES ===\n\n";
    echo "Based on 'manual' transition_type, this comes from:\n";
    echo "  → api/basket_config.php → handleReclaimCustomers()\n\n";
    echo "This function is called when:\n";
    echo "  1. Someone uses Distribution V2 page to RECLAIM customers from an agent\n";
    echo "  2. POST /basket_config?action=reclaim_customers\n";
    echo "  3. Parameters: { agent_id: X, baskets: { 'basket_key': count } }\n\n";
    
    echo "The transition 39 → 38 would happen IF:\n";
    echo "  - Basket 39 has linked_basket_key pointing to basket 38 (or its key)\n";
    echo "  - OR there's an error in the basket configuration\n";
    
} catch (PDOException $e) {
    echo "Database error: " . $e->getMessage() . "\n";
    exit(1);
}
