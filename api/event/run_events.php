<?php
/**
 * Cron-friendly script to perform:
 * 1) Move expired customers to waiting basket
 * 2) Release waiting customers (>=30 days) back to ready (lifecycle Old)
 * 3) Refresh grade by total_purchases
 *
 * Usage (example cron):
 * 45 14 * * * php /path/to/api/event/run_events.php >> /var/log/run_events.log 2>&1
 */

require_once __DIR__ . '/../config.php';

function runCronTasks(): void
{
    $pdo = db_connect();
    $summary = [
        'moved_to_waiting' => 0,
        'released_to_ready' => 0,
        'grades_updated' => 0,
        'run_at' => (new DateTime())->format('Y-m-d H:i:s'),
    ];

    try {
        $pdo->beginTransaction();

        // 1) Move expired customers to waiting
        $stmt1 = $pdo->prepare("
            UPDATE customers
            SET assigned_to = NULL,
                lifecycle_status = 'Old',
                is_in_waiting_basket = 1,
                waiting_basket_start_date = NOW(),
                followup_bonus_remaining = 1
            WHERE ownership_expires IS NOT NULL
              AND ownership_expires <= NOW()
              AND COALESCE(is_in_waiting_basket,0) = 0
              AND COALESCE(is_blocked,0) = 0
        ");
        $stmt1->execute();
        $summary['moved_to_waiting'] = $stmt1->rowCount();

        // 2) Release waiting customers (>=30 days) back to ready
        $stmt2 = $pdo->prepare("
            UPDATE customers
            SET is_in_waiting_basket = 0,
                waiting_basket_start_date = NULL,
                assigned_to = NULL,
                ownership_expires = DATE_ADD(NOW(), INTERVAL 30 DAY),
                lifecycle_status = 'Old',
                follow_up_count = 0,
                followup_bonus_remaining = 1
            WHERE ownership_expires IS NOT NULL
              AND NOW() > DATE_ADD(ownership_expires, INTERVAL 30 DAY)
              AND COALESCE(is_in_waiting_basket,0) = 1
              AND COALESCE(is_blocked,0) = 0
        ");
        $stmt2->execute();
        $summary['released_to_ready'] = $stmt2->rowCount();

        // 3) Refresh grade by total_purchases
        $stmt3 = $pdo->prepare("
            UPDATE customers
            SET grade = CASE
                WHEN total_purchases >= 50000 THEN 'A+'
                WHEN total_purchases >= 20000 THEN 'A'
                WHEN total_purchases >= 5000  THEN 'B'
                WHEN total_purchases >= 2000  THEN 'C'
                ELSE 'D'
            END
        ");
        $stmt3->execute();
        $summary['grades_updated'] = $stmt3->rowCount();

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        $summary['error'] = $e->getMessage();
        // Print and exit with failure for cron visibility
        echo json_encode($summary, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
        exit(1);
    }

    echo json_encode($summary, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;
}

// Allow CLI and HTTP execution; ignore OPTIONS preflight.
if (php_sapi_name() === 'cli') {
    runCronTasks();
} else {
    if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit();
    }
    runCronTasks();
}
