<?php
/**
 * Debug Appointment Status Values
 * Access via: https://www.prima49.com/mini_erp/api/debug_appointment_status.php
 */
require_once __DIR__ . '/config.php';

header('Content-Type: text/plain; charset=utf-8');

try {
    $pdo = db_connect();
    
    echo "=== Appointment Status Analysis ===\n\n";
    
    // 1. Get distinct status values with counts
    echo "1. All Distinct Status Values:\n";
    echo str_repeat("-", 60) . "\n";
    $stmt = $pdo->query("SELECT status, COUNT(*) as cnt, HEX(status) as hex_value, LENGTH(status) as len FROM appointments GROUP BY status ORDER BY cnt DESC LIMIT 20");
    while ($row = $stmt->fetch()) {
        $status = $row['status'];
        $display = str_replace(["\n", "\r", "\t"], ["\\n", "\\r", "\\t"], $status);
        echo sprintf("Status: '%s' | Count: %s | Length: %s | Hex: %s\n", 
            $display, 
            number_format($row['cnt']), 
            $row['len'],
            $row['hex_value']
        );
    }
    
    // 2. Check for problematic statuses
    echo "\n\n2. Checking for Problematic Statuses:\n";
    echo str_repeat("-", 60) . "\n";
    
    $expected_statuses = ['รอดำเนินการ', 'เสร็จสิ้น', 'ยกเลิก'];
    foreach ($expected_statuses as $exp) {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM appointments WHERE status = ?");
        $stmt->execute([$exp]);
        $exact_count = $stmt->fetchColumn();
        
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM appointments WHERE TRIM(status) = ?");
        $stmt->execute([$exp]);
        $trimmed_count = $stmt->fetchColumn();
        
        echo "Status: '$exp'\n";
        echo "  - Exact match: " . number_format($exact_count) . "\n";
        echo "  - After TRIM: " . number_format($trimmed_count) . "\n";
        if ($exact_count != $trimmed_count) {
            echo "  ⚠️ MISMATCH! There are " . ($trimmed_count - $exact_count) . " records with whitespace issues.\n";
        }
        echo "\n";
    }
    
    // 3. Sample of problematic records
    echo "\n3. Sample Records Where Status != TRIM(Status):\n";
    echo str_repeat("-", 60) . "\n";
    $stmt = $pdo->query("SELECT id, customer_id, status, HEX(status) as hex_val FROM appointments WHERE status != TRIM(status) LIMIT 10");
    $problems = $stmt->fetchAll();
    if (empty($problems)) {
        echo "✅ No problematic records found.\n";
    } else {
        foreach ($problems as $p) {
            $display = str_replace(["\n", "\r", "\t"], ["\\n", "\\r", "\\t"], $p['status']);
            echo "ID: {$p['id']} | Customer: {$p['customer_id']} | Status: '{$display}' | Hex: {$p['hex_val']}\n";
        }
    }
    
    echo "\n=== End of Analysis ===\n";

} catch (Throwable $e) {
    echo "Error: " . $e->getMessage();
}
