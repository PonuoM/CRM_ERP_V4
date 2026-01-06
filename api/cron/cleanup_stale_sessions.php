<?php
/**
 * Cron Job: Cleanup Stale Login Sessions
 * Purpose: Auto-logout sessions that haven't pinged in 3 minutes
 * 
 * Setup: Add this to cron to run every minute:
 * * * * * * php /path/to/api/cron/cleanup_stale_sessions.php
 */

// Load database config
$configPath = __DIR__ . '/../config.php';
if (!file_exists($configPath)) {
    die("Config file not found\n");
}
require_once $configPath;

try {
    $pdo = new PDO(
        "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4",
        DB_USER,
        DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    
    // Close sessions that haven't pinged in 3 minutes
    $stmt = $pdo->prepare("
        UPDATE user_login_history
        SET logout_time = COALESCE(last_activity, login_time),
            session_duration = TIMESTAMPDIFF(SECOND, login_time, COALESCE(last_activity, login_time))
        WHERE logout_time IS NULL 
          AND last_activity IS NOT NULL
          AND last_activity < DATE_SUB(NOW(), INTERVAL 3 MINUTE)
    ");
    $stmt->execute();
    $closedWithActivity = $stmt->rowCount();
    
    // Close sessions that never pinged and are older than 3 minutes
    $stmt2 = $pdo->prepare("
        UPDATE user_login_history
        SET logout_time = login_time,
            session_duration = 0
        WHERE logout_time IS NULL 
          AND last_activity IS NULL
          AND login_time < DATE_SUB(NOW(), INTERVAL 3 MINUTE)
    ");
    $stmt2->execute();
    $closedWithoutActivity = $stmt2->rowCount();
    
    // Recompute attendance for affected users
    if ($closedWithActivity > 0 || $closedWithoutActivity > 0) {
        $today = date('Y-m-d');
        $affectedUsers = $pdo->query("
            SELECT DISTINCT user_id FROM user_login_history 
            WHERE DATE(login_time) = CURDATE()
        ")->fetchAll(PDO::FETCH_COLUMN);
        
        foreach ($affectedUsers as $userId) {
            try {
                $pdo->prepare("CALL sp_upsert_user_daily_attendance(?, ?)")
                    ->execute([$userId, $today]);
            } catch (Throwable $e) {
                // Ignore if procedure doesn't exist
            }
        }
    }
    
    $total = $closedWithActivity + $closedWithoutActivity;
    if ($total > 0) {
        echo date('Y-m-d H:i:s') . " - Closed $total stale sessions\n";
    }
    
} catch (PDOException $e) {
    echo "Database error: " . $e->getMessage() . "\n";
    exit(1);
}
