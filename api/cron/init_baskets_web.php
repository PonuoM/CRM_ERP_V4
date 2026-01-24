<?php
/**
 * Initialize customer basket keys via web
 * URL: /api/cron/init_baskets_web.php?key=YOUR_SECRET_KEY&company=1&dryrun=1
 */

// ===== SECURITY: Change this key! =====
$SECRET_KEY = 'basket_init_2026_secret';

// Parse params
$providedKey = $_GET['key'] ?? '';
$companyId = (int)($_GET['company'] ?? 1);
$dryRun = isset($_GET['dryrun']) && $_GET['dryrun'] == '1';

header('Content-Type: text/plain; charset=utf-8');

if ($providedKey !== $SECRET_KEY) {
    http_response_code(403);
    die("ERROR: Invalid key\n");
}

require_once __DIR__ . '/../config.php';

echo "===========================================\n";
echo "Initialize Customer Basket Keys (Web)\n";
echo "Date: " . date('Y-m-d H:i:s') . "\n";
echo "Company: $companyId\n";
echo "Mode: " . ($dryRun ? "DRY RUN" : "LIVE") . "\n";
echo "===========================================\n\n";

$pdo = db_connect();

// Get basket configurations for this company (for dashboard)
$basketStmt = $pdo->prepare("
    SELECT id, basket_key, basket_name, min_days_since_order, max_days_since_order
    FROM basket_config 
    WHERE company_id = ? AND is_active = 1 AND target_page = 'dashboard_v2'
    ORDER BY display_order ASC
");
$basketStmt->execute([$companyId]);
$baskets = $basketStmt->fetchAll(PDO::FETCH_ASSOC);

if (empty($baskets)) {
    die("No dashboard baskets configured for company $companyId\n");
}

// Build a map of basket_key to ID
$basketKeyToId = [];
foreach ($baskets as $b) {
    $basketKeyToId[$b['basket_key']] = $b['id'];
    echo "Basket: {$b['basket_key']} = ID:{$b['id']}\n";
}
echo "\n";

// Get customers who need updating
$limit = (int)($_GET['limit'] ?? 0);
$limitSql = $limit > 0 ? "LIMIT $limit" : "";

$customerStmt = $pdo->prepare("
    SELECT customer_id, first_name, last_name, 
           DATEDIFF(NOW(), last_order_date) as days_since_order,
           order_count, current_basket_key
    FROM customers 
    WHERE company_id = ? 
      AND (current_basket_key IS NULL OR current_basket_key NOT REGEXP '^[0-9]+$')
    $limitSql
");
$customerStmt->execute([$companyId]);
$customers = $customerStmt->fetchAll(PDO::FETCH_ASSOC);

echo "Found " . count($customers) . " customers to update\n\n";

$totalUpdated = 0;

foreach ($customers as $customer) {
    $customerId = $customer['customer_id'];
    $daysSince = $customer['days_since_order'] ?? 9999;

    // Find matching basket based on days_since_order
    $targetBasketId = null;
    foreach ($baskets as $basket) {
        $bkey = $basket['basket_key'];
        $minDays = $basket['min_days_since_order'];
        $maxDays = $basket['max_days_since_order'];

        // Skip special baskets that have no day range criteria
        if ($bkey === 'upsell' || ($minDays === null && $maxDays === null)) {
            continue;
        }

        $matchesMin = ($minDays === null || $daysSince >= $minDays);
        $matchesMax = ($maxDays === null || $daysSince <= $maxDays);

        if ($matchesMin && $matchesMax) {
            $targetBasketId = $basket['id'];
            break;
        }
    }

    if (!$targetBasketId) {
        // Default based on days since order
        if ($daysSince < 60) {
            $targetBasketId = $basketKeyToId['new_customer'] ?? null;
        } elseif ($daysSince < 90) {
            $targetBasketId = $basketKeyToId['personal_1_2m'] ?? null;
        } elseif ($daysSince < 180) {
            $targetBasketId = $basketKeyToId['personal_last_chance'] ?? null;
        } elseif ($daysSince < 365) {
            $targetBasketId = $basketKeyToId['mid_6_12m_dash'] ?? null;
        } elseif ($daysSince < 1095) {
            $targetBasketId = $basketKeyToId['mid_1_3y_dash'] ?? null;
        } else {
            $targetBasketId = $basketKeyToId['ancient_dash'] ?? null;
        }
    }

    if (!$targetBasketId) {
        $targetBasketId = $baskets[0]['id'] ?? null;
    }

    if ($dryRun) {
        // Only show first 20 in dry run
        if ($totalUpdated < 20) {
            echo "{$customer['first_name']} ({$daysSince}d) -> ID:$targetBasketId\n";
        }
        $totalUpdated++;
    } else {
        $updateStmt = $pdo->prepare("
            UPDATE customers SET 
                current_basket_key = ?,
                basket_entered_date = COALESCE(basket_entered_date, NOW())
            WHERE customer_id = ?
        ");
        $updateStmt->execute([(string)$targetBasketId, $customerId]);
        $totalUpdated++;
    }
}

echo "\n===========================================\n";
echo "Total: $totalUpdated\n";
echo "===========================================\n";
