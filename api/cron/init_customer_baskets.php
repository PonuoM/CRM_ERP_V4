<?php
/**
 * Initialize current_basket_key for all customers
 * 
 * Sets the current_basket_key to basket_config.id based on days_since_last_order
 * to be used by Dashboard V2 for tab placement
 * 
 * Usage: php init_customer_baskets.php [--dry-run] [--company=1]
 */

require_once __DIR__ . '/../config.php';

// Parse args
$dryRun = in_array('--dry-run', $argv);
$companyId = null;
foreach ($argv as $arg) {
    if (strpos($arg, '--company=') === 0) {
        $companyId = (int)substr($arg, 10);
    }
}

echo "===========================================\n";
echo "Initialize Customer Basket Keys (using IDs)\n";
echo "Date: " . date('Y-m-d H:i:s') . "\n";
echo "Mode: " . ($dryRun ? "DRY RUN" : "LIVE") . "\n";
echo "===========================================\n\n";

$pdo = db_connect();

// Get companies
if ($companyId) {
    $companies = [['id' => $companyId]];
} else {
    $stmt = $pdo->query("SELECT DISTINCT id FROM companies WHERE is_active = 1");
    $companies = $stmt->fetchAll(PDO::FETCH_ASSOC);
}

$totalUpdated = 0;

foreach ($companies as $company) {
    $cid = $company['id'];
    echo "[Company $cid] Processing...\n";

    // Get basket configurations for this company (for dashboard) - include ID
    $basketStmt = $pdo->prepare("
        SELECT id, basket_key, basket_name, min_days_since_order, max_days_since_order, target_page, display_order
        FROM basket_config 
        WHERE company_id = ? AND is_active = 1 AND target_page = 'dashboard_v2'
        ORDER BY display_order ASC
    ");
    $basketStmt->execute([$cid]);
    $baskets = $basketStmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($baskets)) {
        echo "  No dashboard baskets configured. Skipping.\n";
        continue;
    }

    // Build a map of basket_key to default ID (for fallback)
    $basketKeyToId = [];
    foreach ($baskets as $b) {
        $basketKeyToId[$b['basket_key']] = $b['id'];
    }

    // Get customers who have NULL current_basket_key OR have string basket_key (not numeric)
    $customerStmt = $pdo->prepare("
        SELECT customer_id, first_name, last_name, 
               DATEDIFF(NOW(), last_order_date) as days_since_order,
               order_count, current_basket_key
        FROM customers 
        WHERE company_id = ? 
          AND (current_basket_key IS NULL OR current_basket_key NOT REGEXP '^[0-9]+$')
    ");
    $customerStmt->execute([$cid]);
    $customers = $customerStmt->fetchAll(PDO::FETCH_ASSOC);

    echo "  Found " . count($customers) . " customers to update\n";

    foreach ($customers as $customer) {
        $customerId = $customer['customer_id'];
        $daysSince = $customer['days_since_order'] ?? 9999;
        $orderCount = (int)($customer['order_count'] ?? 0);

        // Find matching basket based on days_since_order
        $targetBasketId = null;
        $targetBasketName = null;
        foreach ($baskets as $basket) {
            $bkey = $basket['basket_key'];
            $minDays = $basket['min_days_since_order'];
            $maxDays = $basket['max_days_since_order'];

            // Skip special baskets (upsell, etc.) that have no day range criteria
            if ($bkey === 'upsell' || ($minDays === null && $maxDays === null)) {
                continue;
            }

            // Check if customer matches this basket's criteria
            $matchesMin = ($minDays === null || $daysSince >= $minDays);
            $matchesMax = ($maxDays === null || $daysSince <= $maxDays);

            if ($matchesMin && $matchesMax) {
                $targetBasketId = $basket['id'];
                $targetBasketName = $basket['basket_name'];
                break;
            }
        }

        if (!$targetBasketId) {
            // Default based on days since order - find matching basket by key
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
            // Fallback to first basket
            $targetBasketId = $baskets[0]['id'] ?? null;
        }

        if ($dryRun) {
            echo "    {$customer['first_name']} {$customer['last_name']} ({$daysSince} days) -> ID:$targetBasketId [DRY RUN]\n";
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
}

echo "\n===========================================\n";
echo "Total Updated: $totalUpdated\n";
echo "===========================================\n";
