<?php
/**
 * Disable/Drop Waiting Basket Events
 * 
 * ลบ MySQL Events ที่ทำให้ assigned_to = NULL:
 * - evt_move_expired_to_waiting_basket
 * - evt_release_from_waiting_basket
 * 
 * เหตุผล: Events เหล่านี้ clear owner โดยอัตโนมัติเมื่อ ownership_expires หมดอายุ
 * ซึ่งทำให้ลูกค้าสูญเสีย Telesale ที่ดูแลอยู่
 */

header('Content-Type: text/plain; charset=utf-8');

require_once __DIR__ . '/../config.php';

$secretKey = $_GET['key'] ?? '';
if ($secretKey !== 'drop_events_2026') {
    echo "Access denied. Usage: ?key=drop_events_2026&action=show|drop\n";
    exit;
}

$action = $_GET['action'] ?? 'show';

$pdo = db_connect();

echo "=====================================================\n";
echo "MySQL Events Manager\n";
echo "Date: " . date('Y-m-d H:i:s') . "\n";
echo "=====================================================\n\n";

// Show current events
echo "=== CURRENT EVENTS ===\n";
try {
    $stmt = $pdo->query("SHOW EVENTS");
    $events = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($events)) {
        echo "No events found.\n";
    } else {
        foreach ($events as $event) {
            echo "- {$event['Name']} ({$event['Status']})\n";
            echo "  Schedule: {$event['Interval_value']} {$event['Interval_field']}\n";
            echo "  Last executed: {$event['Last_executed']}\n\n";
        }
    }
} catch (Exception $e) {
    echo "Error listing events: " . $e->getMessage() . "\n";
}

if ($action === 'drop') {
    echo "\n=== DROPPING EVENTS ===\n";
    
    $eventsToDrop = [
        'evt_move_expired_to_waiting_basket',
        'evt_release_from_waiting_basket'
    ];
    
    foreach ($eventsToDrop as $eventName) {
        try {
            $pdo->exec("DROP EVENT IF EXISTS `$eventName`");
            echo "✅ Dropped: $eventName\n";
        } catch (Exception $e) {
            echo "❌ Failed to drop $eventName: " . $e->getMessage() . "\n";
        }
    }
    
    echo "\n=== EVENTS AFTER DROP ===\n";
    try {
        $stmt = $pdo->query("SHOW EVENTS");
        $events = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        if (empty($events)) {
            echo "No events remaining. ✅\n";
        } else {
            foreach ($events as $event) {
                echo "- {$event['Name']} ({$event['Status']})\n";
            }
        }
    } catch (Exception $e) {
        echo "Error: " . $e->getMessage() . "\n";
    }
    
} else {
    echo "\n=== ACTION REQUIRED ===\n";
    echo "To DROP these events, use: ?key=drop_events_2026&action=drop\n";
}

echo "\n=====================================================\n";
echo "Complete\n";
echo "=====================================================\n";
