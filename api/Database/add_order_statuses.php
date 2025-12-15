<?php
// Script to add 'Claiming' and 'BadDebt' to orders.order_status ENUM if missing.

require_once __DIR__ . '/../config.php';

// Force error display for debugging
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

header('Content-Type: text/plain');

try {
    echo "Connecting to database...\n";
    $pdo = db_connect();
    echo "Connected.\n";

    // 1. Get current column definition
    $stmt = $pdo->query("SHOW COLUMNS FROM orders LIKE 'order_status'");
    $col = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$col) {
        die("Error: Column 'order_status' not found in table 'orders'.\n");
    }

    $type = $col['Type']; // e.g., "enum('Pending','Confirmed','Cancelled',...)"
    echo "Current Type: $type\n";

    // 2. Parse existing values
    // Remove "enum(" and ")"
    $content = substr($type, 5, -1); 
    // Split by comma
    // Note: This simple split works if values don't contain commas or escaped quotes, which is true for our statuses.
    $parts = explode(',', $content);
    
    // Clean quotes
    $existing = [];
    foreach ($parts as $p) {
        $existing[] = trim($p, "'");
    }

    // 3. Check for missing statuses
    $newStatuses = ['Claiming', 'BadDebt'];
    $toAdd = [];
    foreach ($newStatuses as $ns) {
        if (!in_array($ns, $existing)) {
            $toAdd[] = $ns;
        }
    }

    if (empty($toAdd)) {
        echo "All new statuses already exist. No changes needed.\n";
        exit;
    }

    echo "Adding statuses: " . implode(', ', $toAdd) . "\n";

    // 4. Construct new ENUM definition
    // Reconstruct the full list
    $finalList = array_merge($existing, $toAdd);
    // Quote them
    $quotedList = array_map(function($s) { return "'$s'"; }, $finalList);
    $newEnumType = "enum(" . implode(',', $quotedList) . ")";

    echo "New Type Definition: $newEnumType\n";

    // 5. Execute ALTER TABLE
    $sql = "ALTER TABLE orders MODIFY COLUMN order_status $newEnumType DEFAULT 'Pending'";
    echo "Executing SQL: $sql\n";
    
    $pdo->exec($sql);
    echo "Migration Successful!\n";

} catch (Throwable $e) {
    echo "Error: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString();
    http_response_code(500);
}
