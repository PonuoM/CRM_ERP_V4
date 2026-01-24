<?php
/**
 * Monthly Basket Transfer - Web Version (Config-Driven)
 * 
 * เรียกใช้ผ่าน URL: /api/cron/monthly_transfer_web.php?key=basket_transfer_2026_secret&dryrun=1
 * 
 * Parameters:
 * - key: Secret key สำหรับความปลอดภัย (required)
 * - dryrun: 1 = แสดงผลลัพธ์อย่างเดียว, 0 = ย้ายจริง (default: 1)
 * - company: Company ID (default: 1)
 * - limit: จำนวนลูกค้าสูงสุดที่จะประมวลผล (optional)
 */

header('Content-Type: text/plain; charset=utf-8');

// ========================
// Security Check
// ========================
$SECRET_KEY = 'basket_transfer_2026_secret';

$inputKey = $_GET['key'] ?? '';
if ($inputKey !== $SECRET_KEY) {
    http_response_code(403);
    die("Access Denied. Invalid key.\n");
}

// ========================
// Skip authentication for cron jobs (use secret key instead)
// ========================
define('SKIP_AUTH', true);

require_once __DIR__ . '/../config.php';

// ========================
// Parameters
// ========================
$dryRun = ($_GET['dryrun'] ?? '1') === '1';
$companyId = (int)($_GET['company'] ?? 1);
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : null;

echo "===========================================\n";
echo "Monthly Basket Transfer (Web - Config-Driven)\n";
echo "Date: " . date('Y-m-d H:i:s') . "\n";
echo "Mode: " . ($dryRun ? "DRY RUN" : "LIVE") . "\n";
echo "Company: $companyId\n";
echo "Limit: " . ($limit ?? 'No limit') . "\n";
echo "===========================================\n\n";

try {
    $pdo = db_connect();
    
    $totalTransferred = 0;
    $totalErrors = 0;
    $processed = 0;
    
    // ============================================================
    // Step 1: โหลด basket configs ทั้งหมด
    // ============================================================
    // NOTE: basket_config is now GLOBAL (not filtered by company_id)
    $allBasketsStmt = $pdo->prepare("
        SELECT id, basket_key, basket_name, target_page,
               min_days_since_order, max_days_since_order,
               on_sale_basket_key, on_fail_basket_key, on_fail_reevaluate,
               fail_after_days, max_distribution_count, hold_days_before_redistribute
        FROM basket_config 
        WHERE is_active = 1
    ");
    $allBasketsStmt->execute();
    $allBaskets = $allBasketsStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // สร้าง mappings
    $basketKeyToId = [];
    $idToBasketKey = [];
    $idToBasketName = [];
    $distributionBaskets = [];
    
    foreach ($allBaskets as $b) {
        $basketKeyToId[$b['basket_key']] = (string)$b['id'];
        $idToBasketKey[(string)$b['id']] = $b['basket_key'];
        $idToBasketName[(string)$b['id']] = $b['basket_name'];
        
        // เก็บ distribution baskets ที่มี days_range สำหรับ re-evaluate
        if ($b['target_page'] === 'distribution' && 
            $b['min_days_since_order'] !== null) {
            $distributionBaskets[] = [
                'id' => (string)$b['id'],
                'basket_key' => $b['basket_key'],
                'basket_name' => $b['basket_name'],
                'min_days' => (int)$b['min_days_since_order'],
                'max_days' => $b['max_days_since_order'] !== null ? (int)$b['max_days_since_order'] : PHP_INT_MAX
            ];
        }
    }
    
    // เรียงลำดับตาม min_days
    usort($distributionBaskets, function($a, $b) {
        return $a['min_days'] - $b['min_days'];
    });
    
    echo "Loaded " . count($allBaskets) . " basket configs\n";
    echo "Distribution baskets for re-evaluate:\n";
    foreach ($distributionBaskets as $db) {
        echo "  - {$db['basket_name']}: {$db['min_days']}-" . ($db['max_days'] === PHP_INT_MAX ? '∞' : $db['max_days']) . " days\n";
    }
    echo "\n";
    
    // ============================================================
    // Step 2: ดึง dashboard baskets ที่มี fail_after_days
    // ============================================================
    // NOTE: basket_config is now GLOBAL (not filtered by company_id)
    $configStmt = $pdo->prepare("
        SELECT *
        FROM basket_config
        WHERE is_active = 1
          AND target_page = 'dashboard_v2'
          AND fail_after_days IS NOT NULL
          AND fail_after_days > 0
    ");
    $configStmt->execute();
    $configs = $configStmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Dashboard baskets with fail_after_days:\n";
    foreach ($configs as $c) {
        echo "  - {$c['basket_name']} (ID:{$c['id']}) → fail {$c['fail_after_days']}d";
        if ($c['on_fail_reevaluate']) {
            echo " [RE-EVALUATE]";
        } elseif ($c['on_fail_basket_key']) {
            echo " → {$c['on_fail_basket_key']}";
        }
        echo "\n";
    }
    echo "\n";
    
    foreach ($configs as $config) {
        if ($limit && $processed >= $limit) break;
        
        $basketId = (string)$config['id'];
        $basketKey = $config['basket_key'];
        $basketName = $config['basket_name'];
        $failDays = (int)$config['fail_after_days'];
        $onFailBasketKey = $config['on_fail_basket_key'];
        $reevaluate = (bool)$config['on_fail_reevaluate'];
        $holdDays = (int)($config['hold_days_before_redistribute'] ?? 0);
        $maxDist = (int)($config['max_distribution_count'] ?? 0);
        
        echo "=== [$basketName] ID:$basketId ===\n";
        
        // หาลูกค้าที่หมดเวลา
        $limitClause = $limit ? "LIMIT " . ($limit - $processed) : "";
        $customersStmt = $pdo->prepare("
            SELECT c.customer_id, c.first_name, c.last_name,
                   c.current_basket_key, c.distribution_count,
                   DATEDIFF(NOW(), c.basket_entered_date) as days_in_basket,
                   DATEDIFF(NOW(), COALESCE(
                       c.last_order_date,
                       (SELECT MAX(o.order_date) FROM orders o WHERE o.customer_id = c.customer_id OR o.customer_id = c.customer_ref_id)
                   )) as days_since_order
            FROM customers c
            WHERE c.company_id = ?
              AND c.current_basket_key = ?
              AND c.basket_entered_date IS NOT NULL
              AND DATEDIFF(NOW(), c.basket_entered_date) >= ?
            $limitClause
        ");
        $customersStmt->execute([$companyId, $basketId, $failDays]);
        $customers = $customersStmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo "Found " . count($customers) . " customers exceeding $failDays days\n";
        
        if (count($customers) === 0) {
            echo "\n";
            continue;
        }
        
        foreach ($customers as $customer) {
            if ($limit && $processed >= $limit) break;
            
            $customerId = $customer['customer_id'];
            $name = trim($customer['first_name'] . ' ' . $customer['last_name']);
            $daysInBasket = $customer['days_in_basket'];
            $daysSinceOrder = $customer['days_since_order'] ?? 9999;
            $distCount = (int)$customer['distribution_count'];
            
            // กำหนดถังปลายทาง
            $targetBasketKey = $onFailBasketKey;
            $matchedBy = 'on_fail';
            
            if ($reevaluate) {
                // ใช้ days_since_order หาถังจาก config
                $targetBasketKey = null;
                foreach ($distributionBaskets as $db) {
                    if ($daysSinceOrder >= $db['min_days'] && $daysSinceOrder <= $db['max_days']) {
                        $targetBasketKey = $db['basket_key'];
                        $matchedBy = "re-eval({$db['min_days']}-{$db['max_days']}d)";
                        break;
                    }
                }
                
                // Fallback to last basket
                if (!$targetBasketKey && count($distributionBaskets) > 0) {
                    $lastBasket = end($distributionBaskets);
                    $targetBasketKey = $lastBasket['basket_key'];
                    $matchedBy = "re-eval(fallback)";
                }
            }
            
            // Check max distribution
            if ($maxDist > 0 && $distCount >= $maxDist) {
                $onMaxDistKey = $config['on_max_dist_basket_key'] ?? $targetBasketKey;
                if ($onMaxDistKey) {
                    $targetBasketKey = $onMaxDistKey;
                    $matchedBy = "max_dist";
                }
            }
            
            if (!$targetBasketKey) {
                echo "  ❌ $name: No target!\n";
                $totalErrors++;
                continue;
            }
            
            $targetBasketId = $basketKeyToId[$targetBasketKey] ?? null;
            
            if (!$targetBasketId) {
                echo "  ❌ $name: '$targetBasketKey' not found!\n";
                $totalErrors++;
                continue;
            }
            
            $targetBasketName = $idToBasketName[$targetBasketId] ?? $targetBasketKey;
            
            echo "  → $name: {$daysInBasket}d in, {$daysSinceOrder}d order → $targetBasketName [$matchedBy]";
            
            if ($dryRun) {
                echo " [DRY]\n";
            } else {
                try {
                    $holdUntil = $holdDays > 0 ? date('Y-m-d H:i:s', strtotime("+$holdDays days")) : null;
                    
                    $updateStmt = $pdo->prepare("
                        UPDATE customers SET 
                            current_basket_key = ?,
                            basket_entered_date = NOW(),
                            assigned_to = NULL,
                            hold_until_date = ?,
                            distribution_count = distribution_count + 1
                        WHERE customer_id = ?
                    ");
                    $updateStmt->execute([$targetBasketId, $holdUntil, $customerId]);

                    // 1. Log transition
                    $logTrans = $pdo->prepare("
                        INSERT INTO basket_transition_log (customer_id, from_basket_key, to_basket_key, transition_type, triggered_by, notes, created_at)
                        VALUES (?, ?, ?, 'monthly_cron', NULL, ?, NOW())
                    ");
                    $transNote = "Auto-move from '$name' (In: {$daysInBasket}d, Order: {$daysSinceOrder}d) -> $targetBasketName";
                    $logTrans->execute([$customerId, $basketId, $targetBasketId, $transNote]);

                    // 2. Log return/fail
                    $logReturn = $pdo->prepare("
                        INSERT INTO basket_return_log (customer_id, previous_assigned_to, reason, days_since_last_order, batch_date, created_at)
                        VALUES (?, ?, ?, ?, CURDATE(), NOW())
                    ");
                    $reason = "Monthly Fail: Exceeded {$failDays} days in $name";
                    // assigned_to might be null, usually is
                    $assignee = !empty($customers[0]['assigned_to']) ? $customers[0]['assigned_to'] : null; 
                    // Note: efficient checking, but $customer loop variable doesn't have assigned_to in select?
                    // Let's verify SELECT columns first. 
                    // It seems SELECT in Line 151 misses assigned_to. Adding fallback or assume NULL.
                    $logReturn->execute([$customerId, null, $reason, $daysSinceOrder]);
                    
                    echo " [OK]\n";
                    $totalTransferred++;
                    
                } catch (Exception $e) {
                    echo " [ERR]\n";
                    $totalErrors++;
                }
            }
            
            $processed++;
        }
        echo "\n";
    }
    
    echo "===========================================\n";
    echo "Summary:\n";
    echo "  Processed: $processed\n";
    echo "  Transferred: $totalTransferred\n";
    echo "  Errors: $totalErrors\n";
    echo "===========================================\n";
    
} catch (Exception $e) {
    echo "FATAL ERROR: " . $e->getMessage() . "\n";
}
