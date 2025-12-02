<?php
/**
 * Verification Script: Check if all collations are utf8mb4_unicode_ci
 */

require_once __DIR__ . '/../api/config.php';

try {
    echo "========================================\n";
    echo "Collation Verification Report\n";
    echo "========================================\n\n";
    
    $pdo = db_connect();
    $dbName = $pdo->query("SELECT DATABASE()")->fetchColumn();
    
    // Check tables
    echo "1. Table Collations:\n";
    echo "   " . str_repeat("-", 50) . "\n";
    
    $tables = $pdo->query("
        SELECT TABLE_NAME, TABLE_COLLATION
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = '{$dbName}'
            AND TABLE_TYPE = 'BASE TABLE'
        ORDER BY TABLE_COLLATION, TABLE_NAME
    ")->fetchAll(PDO::FETCH_ASSOC);
    
    $collationCounts = [];
    foreach ($tables as $table) {
        $coll = $table['TABLE_COLLATION'] ?? 'NULL';
        $collationCounts[$coll] = ($collationCounts[$coll] ?? 0) + 1;
    }
    
    foreach ($collationCounts as $collation => $count) {
        $status = $collation === 'utf8mb4_unicode_ci' ? '✅' : '❌';
        echo "   {$status} {$collation}: {$count} tables\n";
    }
    echo "\n";
    
    // Check columns
    echo "2. Column Collations:\n";
    echo "   " . str_repeat("-", 50) . "\n";
    
    $columns = $pdo->query("
        SELECT COLLATION_NAME, COUNT(*) as cnt
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = '{$dbName}'
            AND COLLATION_NAME IS NOT NULL
        GROUP BY COLLATION_NAME
        ORDER BY COLLATION_NAME
    ")->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($columns as $col) {
        $status = $col['COLLATION_NAME'] === 'utf8mb4_unicode_ci' ? '✅' : '❌';
        echo "   {$status} {$col['COLLATION_NAME']}: {$col['cnt']} columns\n";
    }
    echo "\n";
    
    // Show problematic tables
    $problemTables = $pdo->query("
        SELECT TABLE_NAME, TABLE_COLLATION
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = '{$dbName}'
            AND TABLE_TYPE = 'BASE TABLE'
            AND TABLE_COLLATION != 'utf8mb4_unicode_ci'
        ORDER BY TABLE_NAME
    ")->fetchAll(PDO::FETCH_ASSOC);
    
    if (count($problemTables) > 0) {
        echo "3. Tables NOT using utf8mb4_unicode_ci:\n";
        echo "   " . str_repeat("-", 50) . "\n";
        foreach ($problemTables as $table) {
            echo "   ❌ {$table['TABLE_NAME']}: {$table['TABLE_COLLATION']}\n";
        }
        echo "\n";
    }
    
    // Show problematic columns
    $problemColumns = $pdo->query("
        SELECT TABLE_NAME, COLUMN_NAME, COLLATION_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = '{$dbName}'
            AND COLLATION_NAME IS NOT NULL
            AND COLLATION_NAME != 'utf8mb4_unicode_ci'
        ORDER BY TABLE_NAME, COLUMN_NAME
        LIMIT 20
    ")->fetchAll(PDO::FETCH_ASSOC);
    
    if (count($problemColumns) > 0) {
        echo "4. First 20 Columns NOT using utf8mb4_unicode_ci:\n";
        echo "   " . str_repeat("-", 50) . "\n";
        foreach ($problemColumns as $col) {
            echo "   ❌ {$col['TABLE_NAME']}.{$col['COLUMN_NAME']}: {$col['COLLATION_NAME']}\n";
        }
        echo "\n";
    }
    
    // Summary
    $allGood = count($problemTables) === 0 && count($problemColumns) === 0;
    
    echo "========================================\n";
    if ($allGood) {
        echo "✅ ALL COLLATIONS ARE utf8mb4_unicode_ci!\n";
    } else {
        echo "❌ Some collations need to be fixed\n";
        echo "   Run migration script to fix them.\n";
    }
    echo "========================================\n";
    
} catch (Throwable $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}

