<?php
/**
 * Monthly Basket Transfer Cronjob (Config-Driven, No Hardcode)
 * 
 * ทำงานทุกต้นเดือน เพื่อย้ายลูกค้าที่หมดเวลาถือครอง
 * 
 * Logic การทำงาน:
 * 1. ดึง basket_config ที่มี fail_after_days > 0
 * 2. หาลูกค้าที่ current_basket_key = basket_config.id (เก็บเป็น string)
 * 3. เช็คว่า days_in_basket >= fail_after_days หรือไม่
 * 4. ถ้าใช่ และ on_fail_reevaluate = true → ใช้ days_since_order หาถังจาก config
 * 5. ถ้าใช่ และ on_fail_reevaluate = false → ย้ายไป on_fail_basket_key
 * 
 * Usage: php monthly_basket_transfer.php [--dry-run] [--company=1]
 */

require_once __DIR__ . '/../config.php';

// Parse command line arguments
$dryRun = in_array('--dry-run', $argv ?? []);
$companyId = null;
foreach ($argv ?? [] as $arg) {
    if (strpos($arg, '--company=') === 0) {
        $companyId = (int)substr($arg, 10);
    }
}

echo "===========================================\n";
echo "Monthly Basket Transfer (Config-Driven)\n";
echo "Date: " . date('Y-m-d H:i:s') . "\n";
echo "Mode: " . ($dryRun ? "DRY RUN" : "LIVE") . "\n";
echo "===========================================\n\n";

try {
    $pdo = db_connect();
    
    // Get companies to process
    if ($companyId) {
        $companies = [['id' => $companyId]];
    } else {
        $stmt = $pdo->query("SELECT DISTINCT id FROM companies WHERE is_active = 1");
        $companies = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    $totalTransferred = 0;
    $totalErrors = 0;
    
    foreach ($companies as $company) {
        $cid = $company['id'];
        echo "\n[Company $cid] Processing...\n";
        
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
        $idToTargetPage = []; // NEW: เก็บ target_page ของแต่ละถัง
        $distributionBaskets = []; // สำหรับ re-evaluate
        
        foreach ($allBaskets as $b) {
            $basketKeyToId[$b['basket_key']] = (string)$b['id'];
            $idToBasketKey[(string)$b['id']] = $b['basket_key'];
            $idToBasketName[(string)$b['id']] = $b['basket_name'];
            $idToTargetPage[(string)$b['id']] = $b['target_page']; // NEW
            
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
        
        // เรียงลำดับ distribution baskets ตาม min_days (น้อยไปมาก)
        usort($distributionBaskets, function($a, $b) {
            return $a['min_days'] - $b['min_days'];
        });
        
        echo "  Loaded " . count($allBaskets) . " basket configs\n";
        echo "  Distribution baskets for re-evaluate: " . count($distributionBaskets) . "\n";
        foreach ($distributionBaskets as $db) {
            echo "    - {$db['basket_name']}: {$db['min_days']}-{$db['max_days']} days\n";
        }
        
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
        
        echo "\n  Found " . count($configs) . " dashboard baskets with fail_after_days\n";
        
        foreach ($configs as $config) {
            $basketId = (string)$config['id'];
            $basketKey = $config['basket_key'];
            $basketName = $config['basket_name'];
            $failDays = (int)$config['fail_after_days'];
            $onFailBasketKey = $config['on_fail_basket_key'];
            $reevaluate = (bool)$config['on_fail_reevaluate'];
            $holdDays = (int)($config['hold_days_before_redistribute'] ?? 0);
            $maxDist = (int)($config['max_distribution_count'] ?? 0);
            
            echo "\n  [$basketName] ID:$basketId - fail after $failDays days";
            if ($reevaluate) {
                echo " [RE-EVALUATE from config]";
            } else if ($onFailBasketKey) {
                echo " → $onFailBasketKey";
            }
            echo "\n";
            
            // ============================================================
            // Step 3: หาลูกค้าที่หมดเวลา
            // ============================================================
            $customersStmt = $pdo->prepare("
                SELECT c.customer_id, c.first_name, c.last_name, c.assigned_to,
                       c.current_basket_key, c.basket_entered_date, c.distribution_count,
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
            ");
            $customersStmt->execute([$cid, $basketId, $failDays]);
            $customers = $customersStmt->fetchAll(PDO::FETCH_ASSOC);
            
            $count = count($customers);
            echo "    Found $count customers exceeding $failDays days\n";
            
            if ($count === 0) continue;
            
            foreach ($customers as $customer) {
                $customerId = $customer['customer_id'];
                $name = trim($customer['first_name'] . ' ' . $customer['last_name']);
                $daysInBasket = $customer['days_in_basket'];
                $daysSinceOrder = $customer['days_since_order'] ?? 9999;
                $distCount = (int)$customer['distribution_count'];
                
                // ============================================================
                // Step 4: กำหนดถังปลายทาง
                // ============================================================
                $targetBasketKey = $onFailBasketKey;
                $matchedBy = 'on_fail_basket_key';
                
                if ($reevaluate) {
                    // ใช้ days_since_order หาถังจาก distribution baskets
                    $targetBasketKey = null;
                    foreach ($distributionBaskets as $db) {
                        if ($daysSinceOrder >= $db['min_days'] && $daysSinceOrder <= $db['max_days']) {
                            $targetBasketKey = $db['basket_key'];
                            $matchedBy = "re-evaluate ({$db['min_days']}-{$db['max_days']}d)";
                            break;
                        }
                    }
                    
                    // ถ้าไม่เจอถังที่ตรง ใช้ถังสุดท้าย (ancient)
                    if (!$targetBasketKey && count($distributionBaskets) > 0) {
                        $lastBasket = end($distributionBaskets);
                        $targetBasketKey = $lastBasket['basket_key'];
                        $matchedBy = "re-evaluate (fallback to last)";
                    }
                }
                
                // Check max distribution count
                if ($maxDist > 0 && $distCount >= $maxDist) {
                    $onMaxDistKey = $config['on_max_dist_basket_key'] ?? $targetBasketKey;
                    if ($onMaxDistKey) {
                        $targetBasketKey = $onMaxDistKey;
                        $matchedBy = "max_distribution ($distCount/$maxDist)";
                    }
                }
                
                if (!$targetBasketKey) {
                    echo "      - $name: ERROR - No target basket found!\n";
                    $totalErrors++;
                    continue;
                }
                
                // แปลง basket_key → id
                $targetBasketId = $basketKeyToId[$targetBasketKey] ?? null;
                
                if (!$targetBasketId) {
                    echo "      - $name: ERROR - Target '$targetBasketKey' not in config!\n";
                    $totalErrors++;
                    continue;
                }
                
                $targetBasketName = $idToBasketName[$targetBasketId] ?? $targetBasketKey;
                
                echo "      - $name: {$daysInBasket}d in, {$daysSinceOrder}d since order";
                echo " → $targetBasketName [$matchedBy]";
                
                if ($dryRun) {
                    echo " [DRY]\n";
                } else {
                    try {
                        $holdUntil = $holdDays > 0 ? date('Y-m-d H:i:s', strtotime("+$holdDays days")) : null;
                        
                        // NEW: เช็ค target_page ของถังปลายทาง
                        $targetPage = $idToTargetPage[$targetBasketId] ?? 'distribution';
                        $keepAssignedTo = ($targetPage === 'dashboard_v2');
                        
                        if ($keepAssignedTo) {
                            // ถังปลายทางเป็น Dashboard → เก็บ assigned_to ไว้ (ยังอยู่กับ Telesale คนเดิม)
                            $updateStmt = $pdo->prepare("
                                UPDATE customers SET 
                                    current_basket_key = ?,
                                    basket_entered_date = NOW(),
                                    hold_until_date = ?,
                                    distribution_count = distribution_count + 1
                                WHERE customer_id = ?
                            ");
                            $updateStmt->execute([$targetBasketId, $holdUntil, $customerId]);
                            echo " [KEEP assigned_to]";
                        } else {
                            // ถังปลายทางเป็น Distribution → ปล่อยกลับถังกลาง (NULL)
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
                            echo " [NULL assigned_to]";
                        }
                        
                        // 1. Log transition (triggered_by = previous assigned agent)
                        $assignedTo = $customer['assigned_to'] ?? null;
                        $logStmt = $pdo->prepare("
                            INSERT INTO basket_transition_log 
                            (customer_id, from_basket_key, to_basket_key, transition_type, triggered_by, notes, created_at)
                            VALUES (?, ?, ?, 'monthly_cron', ?, ?, NOW())
                        ");
                        $logStmt->execute([
                            $customerId, 
                            $basketId, 
                            $targetBasketId,
                            $assignedTo,
                            "Exceeded $failDays days. Days since order: $daysSinceOrder. Method: $matchedBy"
                        ]);

                        // 2. Log return/fail
                        $logReturn = $pdo->prepare("
                            INSERT INTO basket_return_log (customer_id, previous_assigned_to, reason, days_since_last_order, batch_date, created_at)
                            VALUES (?, ?, ?, ?, CURDATE(), NOW())
                        ");
                        $logReturn->execute([$customerId, $assignedTo, "Monthly Cron Fail ($name)", $daysSinceOrder]);
                        
                        echo " [OK]\n";
                        $totalTransferred++;
                        
                    } catch (Exception $e) {
                        echo " [ERROR: " . $e->getMessage() . "]\n";
                        $totalErrors++;
                    }
                }
            }
        }
    }
    
    echo "\n===========================================\n";
    echo "Summary:\n";
    echo "  Total Transferred: $totalTransferred\n";
    echo "  Total Errors: $totalErrors\n";
    echo "===========================================\n";
    
} catch (Exception $e) {
    echo "FATAL ERROR: " . $e->getMessage() . "\n";
    exit(1);
}

