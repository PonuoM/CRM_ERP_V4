<?php
// HARDCODED CONFIG FROM api/config.php
$DB_HOST = "127.0.0.1";
$DB_PORT = "3306";
$DB_NAME = "mini_erp";
$DB_USER = "root";
$DB_PASS = "12345678";

try {
    $dsn = "mysql:host={$DB_HOST};port={$DB_PORT};dbname={$DB_NAME};charset=utf8mb4";
    $pdo = new PDO($dsn, $DB_USER, $DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

    echo "Connected.\n";
    
    // Bulk Update
    echo "Running Bulk Update for user 1655...\n";
    // Using customer_id to ensure uniqueness
    $sql = "UPDATE customers 
            SET customer_ref_id = CONCAT('CUS-MOCK-1655-', LPAD(customer_id, 6, '0')) 
            WHERE assigned_to = 1655 
              AND customer_ref_id NOT LIKE 'CUS-MOCK%'";
              
    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    
    echo "Updated " . $stmt->rowCount() . " records.\n";
    
    // Verify
    $count = $pdo->query("SELECT COUNT(*) FROM customers WHERE customer_ref_id LIKE 'CUS-MOCK%'")->fetchColumn();
    echo "Total CUS-MOCK records: $count\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
