<?php
require_once __DIR__ . '/config.php';

try {
    $sql = file_get_contents(__DIR__ . '/Database/setup_waiting_basket_events.sql');
    
    // The file contains multiple statements and DELIMITER commands.
    // PDO::exec or PDO::query don't support DELIMITER or multiple statements easily.
    // However, for this specific script, we can split by ; if we handle the DELIMITER blocks.
    
    // A simpler way for this task is to just execute the specific UPDATE change in the event directly 
    // or recreate the events using a more robust method.
    
    // Let's recreate the events directly in PHP to avoid DELIMITER issues.
    
    $pdo->exec("DROP EVENT IF EXISTS `evt_move_expired_to_waiting_basket` ");
    $pdo->exec("
        CREATE EVENT `evt_move_expired_to_waiting_basket`
        ON SCHEDULE EVERY 1 HOUR
        STARTS CURRENT_TIMESTAMP
        ON COMPLETION PRESERVE
        ENABLE
        COMMENT 'Automatically move expired customers to waiting basket'
        DO
        BEGIN
            UPDATE customers
            SET is_in_waiting_basket = 1,
                waiting_basket_start_date = NOW(),
                assigned_to = NULL,
                bucket_type = 'waiting'
            WHERE COALESCE(is_blocked, 0) = 0
              AND COALESCE(is_in_waiting_basket, 0) = 0
              AND ownership_expires IS NOT NULL
              AND ownership_expires <= NOW();
        END
    ");

    $pdo->exec("DROP EVENT IF EXISTS `evt_release_from_waiting_basket` ");
    $pdo->exec("
        CREATE EVENT `evt_release_from_waiting_basket`
        ON SCHEDULE EVERY 1 HOUR
        STARTS CURRENT_TIMESTAMP
        ON COMPLETION PRESERVE
        ENABLE
        COMMENT 'Release customers from waiting basket after 30 days'
        DO
        BEGIN
            UPDATE customers
            SET is_in_waiting_basket = 0,
                waiting_basket_start_date = NULL,
                ownership_expires = DATE_ADD(NOW(), INTERVAL 30 DAY),
                lifecycle_status = 'DailyDistribution',
                follow_up_count = 0,
                followup_bonus_remaining = 1,
                assigned_to = NULL,
                bucket_type = 'ready'
            WHERE COALESCE(is_in_waiting_basket, 0) = 1
              AND waiting_basket_start_date IS NOT NULL
              AND TIMESTAMPDIFF(DAY, waiting_basket_start_date, NOW()) >= 30
              AND COALESCE(is_blocked, 0) = 0;
        END
    ");

    echo "Events recreated successfully.\n";
    
    // Show status
    $stmt = $pdo->query("SHOW EVENTS LIKE 'evt_%'");
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
    print_r($results);

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
