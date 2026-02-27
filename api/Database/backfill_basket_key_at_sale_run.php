<?php
/**
 * Backfill basket_key_at_sale - Auto batch script
 * รันครั้งเดียว ระบบจะ loop ทีละ 5000 rows จนเสร็จ
 * 
 * วิธีใช้: เปิด browser แล้วไปที่
 * https://www.prima49.com/beta_test/api/Database/backfill_basket_key_at_sale_run.php
 */

// Increase timeout for this script
set_time_limit(600); // 10 minutes max
ini_set('display_errors', 1);
error_reporting(E_ALL);

// Connect to DB using db_connect() from config
require_once __DIR__ . '/../config.php';
$pdo = db_connect();

header('Content-Type: text/html; charset=utf-8');
echo "<html><head><title>Backfill basket_key_at_sale</title></head><body>";
echo "<h1>🔧 Backfill basket_key_at_sale</h1>";
echo "<pre>";

$batchSize = 5000;
$totalUpdated = 0;

// ========================================
// PART 1: Fix distribution baskets (41-45)
// ========================================
echo "=== PART 1: Fix distribution baskets (41-45) ===\n";

$stmt = $pdo->prepare("
    UPDATE order_items oi
    JOIN orders o ON o.id = oi.parent_order_id
    SET oi.basket_key_at_sale = CASE 
        WHEN o.customer_type = 'New Customer' THEN 38
        WHEN o.customer_type = 'Reorder Customer' THEN 39
        WHEN o.customer_type = 'Mined Lead' THEN 49
        WHEN o.customer_type = 'Upsell' THEN 51
        ELSE 38
    END
    WHERE oi.basket_key_at_sale IN (41, 42, 43, 44, 45)
");
$stmt->execute();
$affected = $stmt->rowCount();
$totalUpdated += $affected;
echo "✅ order_items (41-45): Updated $affected rows\n";

$stmt2 = $pdo->prepare("
    UPDATE orders
    SET basket_key_at_sale = CASE 
        WHEN customer_type = 'New Customer' THEN 38
        WHEN customer_type = 'Reorder Customer' THEN 39
        WHEN customer_type = 'Mined Lead' THEN 49
        WHEN customer_type = 'Upsell' THEN 51
        ELSE 38
    END
    WHERE basket_key_at_sale IN (41, 42, 43, 44, 45)
");
$stmt2->execute();
$affected2 = $stmt2->rowCount();
$totalUpdated += $affected2;
echo "✅ orders (41-45): Updated $affected2 rows\n\n";

// ========================================
// PART 2: Fix NULL basket_key_at_sale (batch)
// ========================================
echo "=== PART 2: Fix NULL basket_key_at_sale (batch $batchSize) ===\n";

$batchNum = 0;
$nullUpdated = 0;

$batchStmt = $pdo->prepare("
    UPDATE order_items oi
    JOIN orders o ON o.id = oi.parent_order_id
    SET oi.basket_key_at_sale = CASE 
        WHEN o.customer_type = 'New Customer' THEN 38
        WHEN o.customer_type = 'Reorder Customer' THEN 39
        WHEN o.customer_type = 'Mined Lead' THEN 49
        WHEN o.customer_type = 'Upsell' THEN 51
        ELSE 38
    END
    WHERE oi.basket_key_at_sale IS NULL
    LIMIT $batchSize
");

do {
    $batchNum++;
    $batchStmt->execute();
    $affected = $batchStmt->rowCount();
    $nullUpdated += $affected;
    echo "  Batch $batchNum: Updated $affected rows (total: $nullUpdated)\n";
    
    // Flush output so user can see progress
    if (ob_get_level() > 0) ob_flush();
    flush();
    
} while ($affected > 0);

$totalUpdated += $nullUpdated;

echo "\n✅ order_items (NULL): Updated $nullUpdated rows in $batchNum batches\n\n";

// Fix orders table NULL too
$stmt3 = $pdo->prepare("
    UPDATE orders
    SET basket_key_at_sale = CASE 
        WHEN customer_type = 'New Customer' THEN 38
        WHEN customer_type = 'Reorder Customer' THEN 39
        WHEN customer_type = 'Mined Lead' THEN 49
        WHEN customer_type = 'Upsell' THEN 51
        ELSE 38
    END
    WHERE basket_key_at_sale IS NULL
");
$stmt3->execute();
$affected3 = $stmt3->rowCount();
$totalUpdated += $affected3;
echo "✅ orders (NULL): Updated $affected3 rows\n\n";

// ========================================
// SUMMARY
// ========================================
echo "========================================\n";
echo "🎉 DONE! Total updated: $totalUpdated rows\n";
echo "========================================\n";
echo "</pre></body></html>";
