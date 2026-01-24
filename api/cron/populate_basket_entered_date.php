<?php
/**
 * Populate basket_entered_date for all customers
 * 
 * URL: /api/cron/populate_basket_entered_date.php?key=basket_migrate_2026
 * 
 * Logic:
 * 1. ถ้ามี date_assigned → ใช้ date_assigned
 * 2. ถ้าไม่มี → ใช้ NOW()
 */

header('Content-Type: text/plain; charset=utf-8');

$SECRET_KEY = 'basket_migrate_2026';
$inputKey = $_GET['key'] ?? '';

if ($inputKey !== $SECRET_KEY) {
    http_response_code(403);
    die("Access Denied.\n");
}

require_once __DIR__ . '/../config.php';

$dryRun = ($_GET['dryrun'] ?? '1') === '1';
$companyId = isset($_GET['company']) ? (int)$_GET['company'] : null;

echo "===========================================\n";
echo "Populate basket_entered_date\n";
echo "Date: " . date('Y-m-d H:i:s') . "\n";
echo "Mode: " . ($dryRun ? "DRY RUN" : "LIVE") . "\n";
echo "Company: " . ($companyId ?? 'ALL') . "\n";
echo "===========================================\n\n";

try {
    $pdo = db_connect();
    
    // Check if column exists
    $checkStmt = $pdo->query("SHOW COLUMNS FROM customers LIKE 'basket_entered_date'");
    $columnExists = $checkStmt->fetch();
    
    if (!$columnExists) {
        echo "Adding basket_entered_date column...\n";
        if (!$dryRun) {
            $pdo->exec("ALTER TABLE customers ADD COLUMN basket_entered_date DATETIME NULL DEFAULT NULL");
            echo "Column added!\n\n";
        } else {
            echo "[DRY] Would add column\n\n";
        }
    } else {
        echo "Column basket_entered_date already exists.\n\n";
    }
    
    // Count customers with NULL basket_entered_date
    $whereCompany = $companyId ? "AND company_id = $companyId" : "";
    
    $countStmt = $pdo->query("
        SELECT COUNT(*) as cnt 
        FROM customers 
        WHERE basket_entered_date IS NULL $whereCompany
    ");
    $nullCount = $countStmt->fetch()['cnt'];
    
    echo "Customers with NULL basket_entered_date: $nullCount\n\n";
    
    if ($nullCount == 0) {
        echo "Nothing to update!\n";
        exit;
    }
    
    // Strategy 1: Use date_assigned if available
    $strategy1Stmt = $pdo->query("
        SELECT COUNT(*) as cnt 
        FROM customers 
        WHERE basket_entered_date IS NULL 
          AND date_assigned IS NOT NULL
          $whereCompany
    ");
    $withDateAssigned = $strategy1Stmt->fetch()['cnt'];
    
    echo "Strategy 1: Use date_assigned (found $withDateAssigned customers)\n";
    
    if ($withDateAssigned > 0) {
        if ($dryRun) {
            echo "[DRY] Would update $withDateAssigned customers\n";
        } else {
            $updateStmt = $pdo->exec("
                UPDATE customers 
                SET basket_entered_date = date_assigned 
                WHERE basket_entered_date IS NULL 
                  AND date_assigned IS NOT NULL
                  $whereCompany
            ");
            echo "Updated $withDateAssigned customers using date_assigned\n";
        }
    }
    
    // Strategy 2: Use NOW() for remaining
    $strategy2Stmt = $pdo->query("
        SELECT COUNT(*) as cnt 
        FROM customers 
        WHERE basket_entered_date IS NULL
          $whereCompany
    ");
    $remaining = $strategy2Stmt->fetch()['cnt'];
    
    echo "\nStrategy 2: Use NOW() (found $remaining customers)\n";
    
    if ($remaining > 0) {
        if ($dryRun) {
            echo "[DRY] Would update $remaining customers\n";
        } else {
            $updateStmt = $pdo->exec("
                UPDATE customers 
                SET basket_entered_date = NOW() 
                WHERE basket_entered_date IS NULL
                  $whereCompany
            ");
            echo "Updated $remaining customers using NOW()\n";
        }
    }
    
    // Final count
    $finalStmt = $pdo->query("
        SELECT COUNT(*) as cnt 
        FROM customers 
        WHERE basket_entered_date IS NULL
          $whereCompany
    ");
    $finalNull = $finalStmt->fetch()['cnt'];
    
    echo "\n===========================================\n";
    echo "Summary:\n";
    echo "  Before: $nullCount NULL\n";
    echo "  After:  $finalNull NULL\n";
    echo "  Updated: " . ($nullCount - $finalNull) . " customers\n";
    echo "===========================================\n";
    
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
}
