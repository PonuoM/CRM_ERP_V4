<?php
/**
 * Advanced Debug Script for Call History (Web Accessible)
 * Access via: https://www.prima49.com/mini_erp/api/debug_user_58.php?userId=58&customerId=62894
 */
require_once __DIR__ . '/config.php';

header('Content-Type: text/plain; charset=utf-8');

function log_msg($msg) {
    echo $msg . "\n";
}

try {
    $pdo = db_connect();
    log_msg("--- Database Connection Successful ---");
    log_msg("Database: " . (getenv("DB_NAME") ?: "primacom_mini_erp"));
    
    // Target User ID (Salesperson)
    $targetUserId = 58;
    if (isset($_GET['userId'])) $targetUserId = (int)$_GET['userId'];
    
    log_msg("\n--- Investigating User ID: $targetUserId ---");
    $stmt = $pdo->prepare("SELECT id, username, first_name, last_name, company_id, role, status FROM users WHERE id = ?");
    $stmt->execute([$targetUserId]);
    $user = $stmt->fetch();
    
    if (!$user) {
        log_msg("ERROR: User ID $targetUserId not found in 'users' table.");
    } else {
        log_msg("Found User: {$user['first_name']} {$user['last_name']} ({$user['username']})");
        log_msg("Role: {$user['role']}, Status: {$user['status']}, Company: {$user['company_id']}");
        
        $fullName = trim($user['first_name'] . ' ' . $user['last_name']);
        
        // Count calls by this user
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM call_history WHERE caller = ?");
        $stmt->execute([$fullName]);
        $callCount = $stmt->fetchColumn();
        log_msg("Total calls in 'call_history' with caller = '$fullName': $callCount");
        
        if ($callCount > 0) {
            log_msg("Latest 5 calls by this user:");
            $stmt = $pdo->prepare("SELECT id, customer_id, date, status, result FROM call_history WHERE caller = ? ORDER BY date DESC LIMIT 5");
            $stmt->execute([$fullName]);
            while ($c = $stmt->fetch()) {
                log_msg("  ID: {$c['id']} | Customer: {$c['customer_id']} | Date: {$c['date']} | Result: {$c['result']}");
            }
        }
    }

    // Specific Customer Investigation
    $targetCustomerId = 62894;
    if (isset($_GET['customerId'])) $targetCustomerId = $_GET['customerId'];
    
    log_msg("\n--- Investigating Customer ID: $targetCustomerId ---");
    // Search by customer_id (PK) or customer_ref_id
    $stmt = $pdo->prepare("SELECT customer_id, first_name, last_name, phone, company_id, assigned_to, total_calls FROM customers WHERE customer_id = ? OR customer_ref_id = ?");
    $stmt->execute([$targetCustomerId, $targetCustomerId]);
    $customer = $stmt->fetch();
    
    if (!$customer) {
        log_msg("ERROR: Customer ID $targetCustomerId not found in 'customers' table.");
        
        // Search by phone suffix as fallback
        $stmt = $pdo->prepare("SELECT customer_id, first_name, last_name FROM customers WHERE phone LIKE ? LIMIT 3");
        $stmt->execute(['%' . substr($targetCustomerId, -4)]);
        $similar = $stmt->fetchAll();
        if ($similar) {
            log_msg("Found similar customers by phone suffix:");
            foreach ($similar as $s) log_msg("  ID: {$s['customer_id']} | Name: {$s['first_name']} {$s['last_name']}");
        }
    } else {
        log_msg("Found Customer: {$customer['first_name']} {$customer['last_name']}");
        log_msg("Real Primary Key (customer_id): {$customer['customer_id']}");
        log_msg("Assigned To: {$customer['assigned_to']}");
        log_msg("Total Calls (from customers table field): {$customer['total_calls']}");
        
        // Check calls in call_history
        $realPk = $customer['customer_id'];
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM call_history WHERE customer_id = ?");
        $stmt->execute([$realPk]);
        $historyCount = $stmt->fetchColumn();
        log_msg("Total calls found in 'call_history' for PK $realPk: $historyCount");
        
        if ($historyCount > 0) {
            log_msg("Listing calls:");
            $stmt = $pdo->prepare("SELECT id, date, caller, status, result, notes FROM call_history WHERE customer_id = ? ORDER BY date DESC");
            $stmt->execute([$realPk]);
            while ($h = $stmt->fetch()) {
                log_msg("  ID: {$h['id']} | Date: {$h['date']} | Caller: {$h['caller']} | Result: {$h['result']}");
                if ($h['notes']) log_msg("    Note: " . substr($h['notes'], 0, 50) . "...");
            }
        } else {
            log_msg("WARNING: No records found in 'call_history' for PK $realPk.");
        }
    }
    
    log_msg("\n--- Global Statistics ---");
    log_msg("Total Call History records: " . $pdo->query("SELECT COUNT(*) FROM call_history")->fetchColumn());
    log_msg("Total Customers: " . $pdo->query("SELECT COUNT(*) FROM customers")->fetchColumn());

} catch (Throwable $e) {
    log_msg("\nCRITICAL ERROR: " . $e->getMessage());
}
