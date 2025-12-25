<?php
// cleanup_prefixes.php
// Standalone script to remove "แขวง" and "เขต" prefixes from address database

// Database credentials
$DB_HOST = 'localhost';
$DB_NAME = 'mini_erp'; // Confirmed from manual_cleanup.php
$DB_USER = 'root';
$DB_PASS = '12345678';

try {
    $pdo = new PDO("mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8", $DB_USER, $DB_PASS);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo "Connected to database: $DB_NAME\n";
    
    // 1. Clean Districts (Remove 'เขต' prefix)
    echo "Cleaning address_districts 'เขต' prefixes...\n";
    $stmtDistrict = $pdo->prepare("UPDATE address_districts SET name_th = REPLACE(name_th, 'เขต', '') WHERE name_th LIKE 'เขต%'");
    $stmtDistrict->execute();
    $districtsAffected = $stmtDistrict->rowCount();
    echo "Updated $districtsAffected districts.\n";
    
    // 2. Clean Sub-districts (Remove 'แขวง' prefix)
    echo "Cleaning address_sub_districts 'แขวง' prefixes...\n";
    $stmtSub = $pdo->prepare("UPDATE address_sub_districts SET name_th = REPLACE(name_th, 'แขวง', '') WHERE name_th LIKE 'แขวง%'");
    $stmtSub->execute();
    $subDistrictsAffected = $stmtSub->rowCount();
    echo "Updated $subDistrictsAffected sub-districts.\n";
    
    echo "Cleanup completed successfully.\n";

} catch (PDOException $e) {
    echo "Database Error: " . $e->getMessage() . "\n";
    exit(1);
}
?>
