<?php
/**
 * Debug Appointments Notes
 * Access via: https://www.prima49.com/mini_erp/api/debug_appointments_notes.php?customer_id=62914
 */
require_once __DIR__ . '/config.php';

header('Content-Type: text/plain; charset=utf-8');

$customer_id = $_GET['customer_id'] ?? 62914;

try {
    $pdo = db_connect();
    
    echo "=== Appointments for Customer ID: $customer_id ===\n\n";
    
    // Show table columns first
    echo "1. Appointments table columns:\n";
    $stmt = $pdo->query("DESCRIBE appointments");
    $columns = $stmt->fetchAll(PDO::FETCH_COLUMN);
    echo "   " . implode(", ", $columns) . "\n\n";
    
    // Get appointments with all columns
    echo "2. Appointments data:\n";
    echo str_repeat("-", 120) . "\n";
    
    $stmt = $pdo->prepare("SELECT * FROM appointments WHERE customer_id = ? ORDER BY date DESC LIMIT 10");
    $stmt->execute([$customer_id]);
    $appointments = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($appointments as $a) {
        echo "ID: {$a['id']}\n";
        echo "  date: {$a['date']}\n";
        echo "  title: " . ($a['title'] ?? 'NULL') . "\n";
        echo "  status: " . ($a['status'] ?? 'NULL') . "\n";
        echo "  notes: " . (isset($a['notes']) && $a['notes'] !== null ? "'{$a['notes']}'" : 'NULL') . "\n";
        // Show all other columns
        foreach ($a as $key => $val) {
            if (!in_array($key, ['id', 'date', 'title', 'status', 'notes', 'customer_id'])) {
                echo "  $key: " . ($val ?? 'NULL') . "\n";
            }
        }
        echo str_repeat("-", 60) . "\n";
    }
    
    echo "\n=== End ===\n";

} catch (Throwable $e) {
    echo "Error: " . $e->getMessage();
}
