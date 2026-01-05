<?php
/**
 * Fix Appointment Status Based on Date
 * - Past appointments = เสร็จสิ้น (Completed)
 * - Today or Future appointments = รอดำเนินการ (Pending)
 * 
 * Access via: https://www.prima49.com/mini_erp/api/fix_appointment_status.php
 */
require_once __DIR__ . '/config.php';

set_time_limit(0);
header('Content-Type: text/plain; charset=utf-8');

try {
    $pdo = db_connect();
    
    echo "=== Fixing Appointment Statuses Based on Date ===\n\n";
    
    $today = date('Y-m-d');
    echo "Today's Date: $today\n\n";
    
    // 1. Count before update
    echo "Before Update:\n";
    echo str_repeat("-", 40) . "\n";
    $stmt = $pdo->query("SELECT status, COUNT(*) as cnt FROM appointments GROUP BY status");
    while ($row = $stmt->fetch()) {
        echo "'{$row['status']}': " . number_format($row['cnt']) . "\n";
    }
    
    // 2. Update past appointments to "เสร็จสิ้น"
    echo "\n\nUpdating past appointments to 'เสร็จสิ้น'...\n";
    $stmt = $pdo->prepare("UPDATE appointments SET status = 'เสร็จสิ้น' WHERE DATE(date) < ? AND status != 'เสร็จสิ้น'");
    $stmt->execute([$today]);
    $past_updated = $stmt->rowCount();
    echo "Updated: " . number_format($past_updated) . " records\n";
    
    // 3. Update today/future appointments to "รอดำเนินการ"
    echo "\nUpdating today/future appointments to 'รอดำเนินการ'...\n";
    $stmt = $pdo->prepare("UPDATE appointments SET status = 'รอดำเนินการ' WHERE DATE(date) >= ? AND status != 'รอดำเนินการ' AND status != 'ยกเลิก'");
    $stmt->execute([$today]);
    $future_updated = $stmt->rowCount();
    echo "Updated: " . number_format($future_updated) . " records\n";
    
    // 4. Count after update
    echo "\n\nAfter Update:\n";
    echo str_repeat("-", 40) . "\n";
    $stmt = $pdo->query("SELECT status, COUNT(*) as cnt FROM appointments GROUP BY status");
    while ($row = $stmt->fetch()) {
        echo "'{$row['status']}': " . number_format($row['cnt']) . "\n";
    }
    
    echo "\n✅ Update completed!\n";
    echo "Total changes: " . number_format($past_updated + $future_updated) . " records\n";

} catch (Throwable $e) {
    echo "Error: " . $e->getMessage();
}
