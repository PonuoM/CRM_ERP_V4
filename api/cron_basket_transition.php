<?php
/**
 * Cron Job: Basket Auto Transition & Redistribution
 * Frequency: Daily (Checks conditions) OR Monthly (as per user preference)
 * 
 * Logic:
 * 1. Find customers in baskets who have exceeded 'fail_after_days' since basket entry or last order
 * 2. If assigned, remove assignment (back to pool) and apply hold period
 * 3. If unassigned (pool) and in 'failed' state for too long -> move to next basket
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/services/BasketRoutingService.php';

header('Content-Type: text/plain');

$pdo = db_connect();
$service = new BasketRoutingService($pdo, 1); // Assuming company_id 1 for now, or loop through companies

echo "Starting Basket Transition Cron...\n";

// 1. Get all active basket configs with fail rules
$stmt = $pdo->query("SELECT * FROM basket_config WHERE fail_after_days IS NOT NULL AND on_fail_basket_key IS NOT NULL AND is_active = 1");
$configs = $stmt->fetchAll(PDO::FETCH_ASSOC);

foreach ($configs as $config) {
    echo "Processing Basket: {$config['basket_key']} (Limit: {$config['fail_after_days']} days) -> Move to: {$config['on_fail_basket_key']}\n";
    
    // Find violation candidates
    // Condition: In this basket AND (days since entered > limit OR days since last order > limit)
    // Using 'basket_entered_date' as primary reference for 'time in basket'
    
    // LIMITATION: If basket_entered_date is NULL (old data), we might need fallback.
    // Fallback: use last_order_date or updated_at? Let's use basket_entered_date.
    
    // 1.1 Handle Assigned Customers (Owned) -> Unassign (Release to Pool)
    // Only if logic dictates removal from owner on timeout. 
    // User Diagram: "ปิดการขายไม่ได้" -> "ออกจากมือ" (Pool)
    
    $limitDays = $config['fail_after_days'];
    
    // Query customers in this basket who are ASSIGNED (have owner) and time expired
    $sql = "
        SELECT id, assigned_to, basket_entered_date 
        FROM customers 
        WHERE current_basket_key = ? 
        AND assigned_to IS NOT NULL AND assigned_to != 0
        AND basket_entered_date < DATE_SUB(NOW(), INTERVAL ? DAY)
    ";
    
    $cStmt = $pdo->prepare($sql);
    $cStmt->execute([$config['basket_key'], $limitDays]);
    $expiredOwnerships = $cStmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "  - Found " . count($expiredOwnerships) . " assigned customers expired.\n";
    
    foreach ($expiredOwnerships as $cust) {
        // Release to pool (this triggers hold logic inside service)
        $success = $service->releaseToPool($cust['id'], 'cron_timeout');
        if ($success) {
            echo "    [Released] Customer ID: {$cust['id']} (Owner: {$cust['assigned_to']})\n";
        } else {
            echo "    [Error] Failed to release Customer ID: {$cust['id']}\n";
        }
    }
    
    // 1.2 Handle Unassigned Customers (Pool) -> Move to next basket if stuck?
    // User Diagram: "ขายไม่ได้ 30 วัน" -> "รอคนมาจีบให้ติด" -> "ถังกลาง"
    // If they are in pool and valid period expired, do we move them?
    // Usually pool items stay until picked, UNLESS there is a rule.
    // Dashboard V2 baskets are usually "assigned only".
    // Distribution baskets are "pool".
    
    // Check if this basket is a Pool basket (target_page = distribution) OR if we want to move expired pool items
    
    // Logic for 'Distribution' baskets (e.g., waiting_to_woo):
    // "อยู่ในส่วนหน้าแจก ถ้าขายไม่ได้จนถึง 30 วัน ... 4-5 ครั้ง จะหลุดไป"
    // This implies if nobody picks it, or if picked and returned 4-5 times?
    // "ขายไม่ได้จนถึง 30 วัน" likely means AFTER picking.
    
    // Logic for 'Dashboard V2' baskets (e.g., month_3):
    // "90+ วัน ไม่ขาย" -> "ออกจากมือ" (Done above in 1.1)
    
    // So for Unassigned (Pool) customers, we usually don't auto-move unless they are 'stale' in the pool.
    // BUT User said: "รอคนมาจีบให้ติด ... ถ้าขายไม่ได้จนถึง 30 วัน โดนดึงกลับเข้าตระกร้าเดิม"
    // This sounds like the 1.1 logic (release ownership).
    
    // What if they sit in the pool forever? 
    // "โดนดึงกลับเข้าตระกร้าเดิม แต่จะอยู่ในตระกร้านี้ ราวๆ 4-5 ครั้ง จะหลุดไป ตรักร้า อื่น"
    // The "4-5 times" is distribution_count. This increments when released.
    // So the move to next basket happens inside releaseToPool() when max count reached.
    
    // So 1.1 covers most cases IF they were picked.
    
    // What if they are never picked? 
    // User: "ย้ายถัง เดือนละ 1 ครั้ง รายชื่อไหนเข้าเงื่อนไขถึงย้าย"
    // Maybe we also scan for general age?
    // "ถังกลาง 6-12 เดือน" -> "ถังกลาง 1-3 ปี"
    // These are typically based on 'last_order_date' (Time Decay).
    
    // Let's look for Age-Based transitions (regardless of assignment?)
    // Specifically for 'mid_basket' series.
    
}

// 2. Specialized Age-Based Transition (For Mid Baskets)
// mid_basket_6_12 -> mid_basket_1_3_years -> ancient
echo "Processing Age-Based Transitions...\n";

// Example: Move 6-12 month -> 1-3 years
// Criteria: Last Order > 365 days
$sql = "
    UPDATE customers 
    SET current_basket_key = 'mid_basket_1_3_years', basket_entered_date = NOW()
    WHERE current_basket_key = 'mid_basket_6_12'
    AND last_order_date < DATE_SUB(NOW(), INTERVAL 365 DAY)
";
$cnt = $pdo->exec($sql);
if ($cnt > 0) echo "  - Moved $cnt customers from 6-12m to 1-3y\n";

// Example: Move 1-3 years -> Ancient
// Criteria: Last Order > 1095 days (3 years)
$sql = "
    UPDATE customers 
    SET current_basket_key = 'ancient', basket_entered_date = NOW()
    WHERE current_basket_key = 'mid_basket_1_3_years'
    AND last_order_date < DATE_SUB(NOW(), INTERVAL 1095 DAY)
";
$cnt = $pdo->exec($sql);
if ($cnt > 0) echo "  - Moved $cnt customers from 1-3y to Ancient\n";


echo "Done.\n";
