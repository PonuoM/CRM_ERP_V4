<?php
// Script to create the necessary tables for warehouse mapping
header('Content-Type: text/plain');
require_once __DIR__ . '/../config.php';
$pdo = db_connect();

try {
    $sql = "CREATE TABLE IF NOT EXISTS `inv2_warehouse_mappings` (
        `id` int(11) NOT NULL AUTO_INCREMENT,
        `company_id` int(11) DEFAULT 1,
        `dispatch_warehouse_name` varchar(255) NOT NULL,
        `main_warehouse_id` int(11) NOT NULL,
        `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
        `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
        PRIMARY KEY (`id`),
        UNIQUE KEY `unique_mapping` (`company_id`, `dispatch_warehouse_name`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";
    
    $pdo->exec($sql);
    echo "SUCCESS: inv2_warehouse_mappings table ensured.\n";
    
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
