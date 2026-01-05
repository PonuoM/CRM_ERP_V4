<?php
/**
 * Debug Appointments for Specific Customer
 * Access via: https://www.prima49.com/mini_erp/api/debug_customer_appointments.php?customer_id=62040
 */
require_once __DIR__ . '/config.php';

header('Content-Type: text/plain; charset=utf-8');

$customer_id = $_GET['customer_id'] ?? 62040;

try {
    $pdo = db_connect();
    
    echo "=== Appointments for Customer ID: $customer_id ===\n\n";
    
    // 1. Get all appointments for this customer
    $stmt = $pdo->prepare("SELECT id, customer_id, date, title, status, notes FROM appointments WHERE customer_id = ? ORDER BY date DESC");
    $stmt->execute([$customer_id]);
    $appointments = $stmt->fetchAll();
    
    echo "Total appointments: " . count($appointments) . "\n\n";
    
    if (empty($appointments)) {
        echo "No appointments found for this customer.\n";
    } else {
        echo str_repeat("-", 100) . "\n";
        echo sprintf("%-10s | %-20s | %-30s | %-15s | %-s\n", "ID", "Date", "Title", "Status", "Notes");
        echo str_repeat("-", 100) . "\n";
        
        foreach ($appointments as $a) {
            $title = mb_strimwidth($a['title'] ?? '-', 0, 28, "...");
            $notes = mb_strimwidth($a['notes'] ?? '-', 0, 30, "...");
            echo sprintf("%-10s | %-20s | %-30s | %-15s | %-s\n", 
                $a['id'],
                $a['date'],
                $title,
                $a['status'],
                $notes
            );
        }
    }
    
    // 2. Status summary
    echo "\n\nStatus Summary for this customer:\n";
    echo str_repeat("-", 40) . "\n";
    $stmt = $pdo->prepare("SELECT status, COUNT(*) as cnt FROM appointments WHERE customer_id = ? GROUP BY status");
    $stmt->execute([$customer_id]);
    while ($row = $stmt->fetch()) {
        echo "'{$row['status']}': {$row['cnt']}\n";
    }
    
    echo "\n=== End ===\n";

} catch (Throwable $e) {
    echo "Error: " . $e->getMessage();
}
