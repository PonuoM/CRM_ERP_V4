<?php
/**
 * Cron-friendly script to perform:
 * 1) Refresh grade by total_purchases
 *
 * Usage (example cron):
 * 45 14 * * * php /path/to/api/event/run_events.php >> /var/log/run_events.log 2>&1
 */

require_once __DIR__ . '/../config.php';

function runCronTasks(): void
{
    $pdo = db_connect();
    $summary = [
        'grades_updated' => 0,
        'run_at' => (new DateTime())->format('Y-m-d H:i:s'),
    ];

    try {
        $pdo->beginTransaction();

        // 1) Refresh grade by total_purchases
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
