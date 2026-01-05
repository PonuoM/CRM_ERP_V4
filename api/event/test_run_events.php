<?php
/**
 * Test/Debug run_events.php
 * Access via: https://www.prima49.com/mini_erp/api/event/test_run_events.php
 */
require_once __DIR__ . '/../config.php';

header('Content-Type: text/plain; charset=utf-8');

echo "=== Testing run_events.php ===\n\n";
echo "Current Time: " . date('Y-m-d H:i:s') . "\n\n";

// 1. Check what WOULD be updated (dry run)
try {
    $pdo = db_connect();
    echo "✅ Database connection OK\n\n";
    
    echo "--- DRY RUN Analysis ---\n\n";
    
    // Check expired customers (would be moved to waiting)
    echo "1. Customers who SHOULD be moved to waiting basket:\n";
    echo "   (ownership_expires <= NOW() AND not already in waiting AND not blocked)\n";
    $stmt = $pdo->query("
        SELECT COUNT(*) as cnt FROM customers
        WHERE ownership_expires IS NOT NULL
          AND ownership_expires <= NOW()
          AND COALESCE(is_in_waiting_basket,0) = 0
          AND COALESCE(is_blocked,0) = 0
    ");
    $count1 = $stmt->fetchColumn();
    echo "   → Found: " . number_format($count1) . " customers\n\n";
    
    // Sample of expired customers
    if ($count1 > 0) {
        echo "   Sample (first 5):\n";
        $stmt = $pdo->query("
            SELECT customer_id, first_name, ownership_expires, assigned_to
            FROM customers
            WHERE ownership_expires IS NOT NULL
              AND ownership_expires <= NOW()
              AND COALESCE(is_in_waiting_basket,0) = 0
              AND COALESCE(is_blocked,0) = 0
            LIMIT 5
        ");
        while ($row = $stmt->fetch()) {
            echo "   - ID: {$row['customer_id']} | {$row['first_name']} | Expired: {$row['ownership_expires']} | Assigned: {$row['assigned_to']}\n";
        }
        echo "\n";
    }
    
    // Check waiting customers >= 30 days (would be released)
    echo "2. Customers who SHOULD be released from waiting:\n";
    echo "   (in waiting basket AND ownership_expires + 30 days <= NOW())\n";
    $stmt = $pdo->query("
        SELECT COUNT(*) as cnt FROM customers
        WHERE ownership_expires IS NOT NULL
          AND NOW() > DATE_ADD(ownership_expires, INTERVAL 30 DAY)
          AND COALESCE(is_in_waiting_basket,0) = 1
          AND COALESCE(is_blocked,0) = 0
    ");
    $count2 = $stmt->fetchColumn();
    echo "   → Found: " . number_format($count2) . " customers\n\n";
    
    // Check grades that would change
    echo "3. Grade distribution (current vs expected):\n";
    $stmt = $pdo->query("
        SELECT grade, COUNT(*) as cnt FROM customers GROUP BY grade ORDER BY grade
    ");
    echo "   Current grades:\n";
    while ($row = $stmt->fetch()) {
        echo "   - {$row['grade']}: " . number_format($row['cnt']) . "\n";
    }
    echo "\n";
    
    // Expected grades based on total_purchases
    echo "   Expected grades (based on total_purchases):\n";
    $stmt = $pdo->query("
        SELECT 
            CASE
                WHEN total_purchases >= 50000 THEN 'A+'
                WHEN total_purchases >= 20000 THEN 'A'
                WHEN total_purchases >= 5000  THEN 'B'
                WHEN total_purchases >= 2000  THEN 'C'
                ELSE 'D'
            END as expected_grade,
            COUNT(*) as cnt
        FROM customers
        GROUP BY expected_grade
        ORDER BY expected_grade
    ");
    while ($row = $stmt->fetch()) {
        echo "   - {$row['expected_grade']}: " . number_format($row['cnt']) . "\n";
    }
    
    echo "\n--- Summary ---\n";
    echo "If cron runs successfully:\n";
    echo "  - {$count1} customers will be moved to waiting basket\n";
    echo "  - {$count2} customers will be released from waiting\n";
    echo "  - All customer grades will be recalculated\n";
    
    echo "\n--- Check Log File ---\n";
    $logFile = __DIR__ . '/run_events.log';
    if (file_exists($logFile)) {
        $logContent = file_get_contents($logFile);
        $lines = explode("\n", trim($logContent));
        $lastLines = array_slice($lines, -10);
        echo "Last 10 lines of run_events.log:\n";
        foreach ($lastLines as $line) {
            echo "  $line\n";
        }
    } else {
        echo "Log file not found at: $logFile\n";
    }

} catch (Throwable $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}

echo "\n=== End of Test ===\n";
