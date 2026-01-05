<?php
/**
 * Debug Appointments Status
 * Access via: https://www.prima49.com/mini_erp/api/debug_appointments_status.php?customerId=62500
 */
require_once __DIR__ . '/config.php';

header('Content-Type: text/plain; charset=utf-8');

function log_msg($msg) {
    echo $msg . "\n";
}

try {
    $pdo = db_connect();
    log_msg("--- Database Connection Successful ---");
    
    // Get sample appointments to check status values
    log_msg("\n--- Distinct Status Values in appointments table ---");
    $stmt = $pdo->query("SELECT DISTINCT status, HEX(status) as hex_status, LENGTH(status) as len FROM appointments LIMIT 20");
    while ($row = $stmt->fetch()) {
        log_msg("  Status: '{$row['status']}' | Hex: {$row['hex_status']} | Length: {$row['len']}");
    }
    
    // Check specific customer appointments
    $cid = $_GET['customerId'] ?? '62500';
    log_msg("\n--- Appointments for Customer ID: $cid ---");
    
    $stmt = $pdo->prepare("SELECT id, date, title, status, HEX(status) as hex_status, LENGTH(status) as len FROM appointments WHERE customer_id = ? ORDER BY date DESC LIMIT 10");
    $stmt->execute([$cid]);
    $apps = $stmt->fetchAll();
    log_msg("Found " . count($apps) . " appointments");
    
    foreach ($apps as $a) {
        log_msg("  ID: {$a['id']} | Status: '{$a['status']}' | Hex: {$a['hex_status']} | Len: {$a['len']} | Date: {$a['date']}");
    }
    
    // Count by status
    log_msg("\n--- Status Counts ---");
    $stmt = $pdo->query("SELECT status, COUNT(*) as cnt FROM appointments GROUP BY status");
    while ($row = $stmt->fetch()) {
        log_msg("  Status '{$row['status']}': {$row['cnt']} appointments");
    }
    
    // Expected value comparison
    log_msg("\n--- Expected Value Comparison ---");
    $expected = "เสร็จสิ้น";
    log_msg("Expected: '{$expected}' | Hex: " . bin2hex($expected) . " | Length: " . strlen($expected));
    
    $expected2 = "รอดำเนินการ";
    log_msg("Expected2: '{$expected2}' | Hex: " . bin2hex($expected2) . " | Length: " . strlen($expected2));

} catch (Throwable $e) {
    log_msg("\nCRITICAL ERROR: " . $e->getMessage());
}
