<?php
/**
 * Debug Appointments API
 * Access via: https://www.prima49.com/mini_erp/api/debug_appointments.php?customerId=62500
 */
require_once __DIR__ . '/config.php';

header('Content-Type: text/plain; charset=utf-8');

function log_msg($msg) {
    echo $msg . "\n";
}

try {
    $pdo = db_connect();
    log_msg("--- Database Connection Successful ---");
    
    // Check appointments table structure
    log_msg("\n--- Appointments Table Schema ---");
    $stmt = $pdo->query("DESCRIBE appointments");
    while ($row = $stmt->fetch()) {
        log_msg("  {$row['Field']}: {$row['Type']}");
    }
    
    // Check customer 62500
    $cid = $_GET['customerId'] ?? '62500';
    log_msg("\n--- Checking Customer ID: $cid ---");
    
    // Direct query
    $stmt = $pdo->prepare("SELECT * FROM appointments WHERE customer_id = ? ORDER BY date DESC LIMIT 10");
    $stmt->execute([$cid]);
    $apps = $stmt->fetchAll();
    log_msg("Found " . count($apps) . " appointments for customer_id = $cid");
    
    foreach ($apps as $a) {
        log_msg("  ID: {$a['id']} | Date: {$a['date']} | Title: {$a['title']} | Status: {$a['status']}");
    }
    
    // Check total appointments
    log_msg("\n--- Global Stats ---");
    log_msg("Total appointments: " . $pdo->query("SELECT COUNT(*) FROM appointments")->fetchColumn());
    
    // Check sample appointment customer_ids
    log_msg("\n--- Sample customer_id values in appointments ---");
    $stmt = $pdo->query("SELECT DISTINCT customer_id FROM appointments LIMIT 10");
    while ($row = $stmt->fetch()) {
        log_msg("  customer_id: {$row['customer_id']}");
    }

} catch (Throwable $e) {
    log_msg("\nCRITICAL ERROR: " . $e->getMessage());
}
