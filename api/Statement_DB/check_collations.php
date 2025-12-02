<?php
header("Content-Type: text/plain; charset=utf-8");
require_once "../config.php";

echo "=== Checking Database Collations ===\n\n";
$validCollations = ["utf8mb4_unicode_ci", "utf8mb4_0900_ai_ci"];

try {
    $pdo = db_connect();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Check database default collation
    $dbName = $pdo->query("SELECT DATABASE()")->fetchColumn();
    echo "Database: $dbName\n";
    
    $dbCollation = $pdo->query("
        SELECT DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME 
        FROM information_schema.SCHEMATA 
        WHERE SCHEMA_NAME = DATABASE()
    ")->fetch(PDO::FETCH_ASSOC);
    
    echo "Database Default Charset: " . $dbCollation['DEFAULT_CHARACTER_SET_NAME'] . "\n";
    echo "Database Default Collation: " . $dbCollation['DEFAULT_COLLATION_NAME'] . "\n\n";
    
    // Check all relevant tables
    echo "=== Table-Level Collations ===\n\n";
    
    $tables = [
        'orders',
        'bank_account',
        'statement_logs',
        'statement_batchs',
        'statement_reconcile_batches',
        'statement_reconcile_logs'
    ];
    
    foreach ($tables as $table) {
        $result = $pdo->query("
            SELECT TABLE_NAME, TABLE_COLLATION
            FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = '$table'
        ")->fetch(PDO::FETCH_ASSOC);
        
        if ($result) {
            $status = in_array($result['TABLE_COLLATION'], $validCollations, true) ? '✓' : '✗';
            echo "$status $table: " . $result['TABLE_COLLATION'] . "\n";
        } else {
            echo "✗ $table: TABLE NOT FOUND\n";
        }
    }
    
    echo "\n=== Column-Level Collations ===\n\n";
    
    // Check specific columns that are compared in queries
    $columnsToCheck = [
        'orders' => ['id'],
        'statement_reconcile_logs' => ['order_id'],
        'statement_reconcile_batches' => ['document_no', 'bank_display_name'],
        'bank_account' => ['bank', 'bank_number'],
    ];
    
    foreach ($columnsToCheck as $table => $columns) {
        echo "Table: $table\n";
        
        foreach ($columns as $column) {
            $result = $pdo->query("
                SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_SET_NAME, COLLATION_NAME
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = '$table'
                  AND COLUMN_NAME = '$column'
            ")->fetch(PDO::FETCH_ASSOC);
            
            if ($result) {
                $collation = $result['COLLATION_NAME'] ?? 'NULL';
                $status =
                    $collation !== null &&
                    in_array($collation, $validCollations, true)
                        ? '✓'
                        : '✗';
                echo "  $status $column: " . $result['DATA_TYPE'] . " | " . ($result['CHARACTER_SET_NAME'] ?? 'NULL') . " | $collation\n";
            } else {
                echo "  ✗ $column: COLUMN NOT FOUND\n";
            }
        }
        echo "\n";
    }
    
    // Check connection collation
    echo "=== Current Connection Settings ===\n\n";
    $conn = $pdo->query("
        SELECT 
            @@character_set_client as charset_client,
            @@character_set_connection as charset_connection,
            @@character_set_results as charset_results,
            @@collation_connection as collation_connection,
            @@collation_database as collation_database
    ")->fetch(PDO::FETCH_ASSOC);
    
    foreach ($conn as $key => $value) {
        echo "$key: $value\n";
    }
    
    echo "\n=== MySQL Version Info ===\n\n";
    echo "MySQL Version: " . $pdo->query("SELECT VERSION()")->fetchColumn() . "\n";
    
} catch (Exception $e) {
    echo "\n✗✗✗ ERROR ✗✗✗\n";
    echo $e->getMessage() . "\n";
}
