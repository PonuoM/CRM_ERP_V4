<?php
/**
 * Basket Return to Original Owner Script
 * คืนลูกค้าจากถังโบราณ (45) และถังพักรอแจก (54) กลับให้เจ้าของเดิม
 * 
 * เรียกใช้ผ่าน URL:
 *   Preview:  /api/cron/basket_return_to_owner.php?key=basket_transfer_2026_secret&dryrun=1
 *   Execute:  /api/cron/basket_return_to_owner.php?key=basket_transfer_2026_secret&dryrun=0
 *   Company:  &company=6 (default: 6)
 *   Basket:   &basket=45 หรือ &basket=54 หรือ &basket=all (default: all)
 * 
 * Logic:
 *   1. หาลูกค้าใน basket 45/54 ที่ assigned_to IS NULL
 *   2. ค้นหาเจ้าของเดิมจาก basket_transition_log (assigned_to_old จาก transition ล่าสุดที่มีค่า)
 *   3. ตรวจสอบว่าเจ้าของเดิมเป็น Telesale (role 6-7)
 *   4. ย้ายลูกค้ากลับไปถัง dashboard ที่ถูกต้องตามอายุ order + คืน assigned_to
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

define('SKIP_AUTH', true);

// Direct production DB connection
function db_connect(): PDO {
    $dsn = "mysql:host=202.183.192.218;port=3306;dbname=primacom_mini_erp;charset=utf8mb4";
    return new PDO($dsn, 'primacom_bloguser', 'pJnL53Wkhju2LaGPytw8', [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci, time_zone = '+07:00'"
    ]);
}

date_default_timezone_set("Asia/Bangkok");

// ========================
// Parameters
// ========================
$dryRun = ($_GET['dryrun'] ?? '1') === '1';
$companyId = (int)($_GET['company'] ?? 6);
$basketFilter = $_GET['basket'] ?? 'all';

echo "=====================================================\n";
echo "  BASKET RETURN TO ORIGINAL OWNER\n";
echo "  Date: " . date('Y-m-d H:i:s') . "\n";
echo "  Mode: " . ($dryRun ? "🔍 PREVIEW (DRY RUN)" : "⚡ EXECUTE (LIVE)") . "\n";
echo "  Company: $companyId\n";
echo "  Basket: $basketFilter\n";
echo "=====================================================\n\n";

try {
    $pdo = db_connect();
    
    // ============================================================
    // Step 1: Find customers without owner in target baskets
    // ============================================================
    $basketCondition = "IN ('45','54')";
    if ($basketFilter === '45') $basketCondition = "= '45'";
    elseif ($basketFilter === '54') $basketCondition = "= '54'";
    
    $sql = "
    SELECT c.customer_id, c.first_name, c.last_name, c.current_basket_key, c.last_order_date,
           DATEDIFF(CURDATE(), c.last_order_date) AS days_since_order
    FROM customers c
    WHERE c.company_id = ? AND c.current_basket_key $basketCondition AND c.assigned_to IS NULL
    ORDER BY c.current_basket_key, c.customer_id
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$companyId]);
    $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Found " . count($customers) . " customers without owner\n\n";
    
    if (count($customers) === 0) {
        echo "✅ No customers to process!\n";
        exit;
    }
    
    // ============================================================
    // Step 2: Find original owner from transition log
    // ============================================================
    $returnData = []; // customer_id => [owner_id, correct_basket, ...]
    $noOwnerFound = [];
    
    foreach ($customers as $c) {
        $cid = $c['customer_id'];
        
        // Find last transition where assigned_to_old was set
        $tStmt = $pdo->prepare("
            SELECT assigned_to_old FROM basket_transition_log 
            WHERE customer_id = ? AND assigned_to_old IS NOT NULL
            ORDER BY created_at DESC LIMIT 1
        ");
        $tStmt->execute([$cid]);
        $tRow = $tStmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$tRow || !$tRow['assigned_to_old']) {
            $noOwnerFound[] = $cid;
            continue;
        }
        
        $ownerId = $tRow['assigned_to_old'];
        $daysOrder = $c['days_since_order'];
        
        // Determine correct dashboard basket based on days_since_order
        // Need to check if owner is the creator of latest order
        $creatorStmt = $pdo->prepare("
            SELECT o.creator_id FROM orders o
            WHERE o.customer_id = ? AND o.order_status NOT IN ('CANCELLED','RETURNED')
            ORDER BY o.order_date DESC LIMIT 1
        ");
        $creatorStmt->execute([$cid]);
        $creatorRow = $creatorStmt->fetch(PDO::FETCH_ASSOC);
        $creatorId = $creatorRow ? $creatorRow['creator_id'] : null;
        $isOwnerCreator = ($creatorId == $ownerId);
        
        // Basket routing rules
        if ($daysOrder <= 60 && $isOwnerCreator) {
            $correctBasket = 39; // ส่วนตัว 1-2 เดือน
        } elseif ($daysOrder <= 60) {
            $correctBasket = 46; // หาคนดูแลใหม่ (dashboard)
        } elseif ($daysOrder <= 90 && $isOwnerCreator) {
            $correctBasket = 40; // ส่วนตัวโอกาสสุดท้าย
        } elseif ($daysOrder <= 90) {
            $correctBasket = 47; // รอคนมาจีบให้ติด (dashboard)
        } elseif ($daysOrder <= 180) {
            $correctBasket = 46; // หาคนดูแลใหม่
        } elseif ($daysOrder <= 365) {
            $correctBasket = 48; // กลาง 6-12 เดือน
        } elseif ($daysOrder <= 1095) {
            $correctBasket = 49; // กลาง 1-3 ปี
        } else {
            $correctBasket = 50; // โบราณ
        }
        
        $returnData[$cid] = [
            'customer' => $c,
            'owner_id' => $ownerId,
            'correct_basket' => $correctBasket,
            'days_order' => $daysOrder,
            'is_owner_creator' => $isOwnerCreator
        ];
    }
    
    if (!empty($noOwnerFound)) {
        echo "⚠️  Could not find owner for " . count($noOwnerFound) . " customers\n\n";
    }
    
    // ============================================================
    // Step 3: Get owner details
    // ============================================================
    $ownerIds = array_unique(array_column($returnData, 'owner_id'));
    $ownerNames = [];
    if (!empty($ownerIds)) {
        $inClause = implode(',', $ownerIds);
        $uStmt = $pdo->query("SELECT id, username, first_name, last_name, role_id FROM users WHERE id IN ($inClause)");
        while ($u = $uStmt->fetch(PDO::FETCH_ASSOC)) {
            $ownerNames[$u['id']] = $u;
        }
    }
    
    // Basket names
    $bStmt = $pdo->query("SELECT id, basket_name FROM basket_config");
    $basketNames = [];
    while ($b = $bStmt->fetch(PDO::FETCH_ASSOC)) {
        $basketNames[$b['id']] = $b['basket_name'];
    }
    
    // ============================================================
    // Step 4: PREVIEW - Summary tables
    // ============================================================
    
    // --- Summary per owner ---
    $perOwner = [];
    $perTargetBasket = [];
    $perSourceBasket = ['45' => 0, '54' => 0];
    
    foreach ($returnData as $cid => $rd) {
        $oid = $rd['owner_id'];
        if (!isset($perOwner[$oid])) $perOwner[$oid] = 0;
        $perOwner[$oid]++;
        
        $tb = $rd['correct_basket'];
        if (!isset($perTargetBasket[$tb])) $perTargetBasket[$tb] = 0;
        $perTargetBasket[$tb]++;
        
        $sb = $rd['customer']['current_basket_key'];
        $perSourceBasket[$sb] = ($perSourceBasket[$sb] ?? 0) + 1;
    }
    
    // --- Current customer count per telesale (before) ---
    echo "=====================================================\n";
    echo "  📊 PREVIEW: ก่อนย้าย vs หลังย้าย\n";
    echo "=====================================================\n\n";
    
    echo "--- จำนวนลูกค้าต้นทาง ---\n";
    echo "  ถังโบราณ (45):    {$perSourceBasket['45']} คน\n";
    echo "  ถังพักรอแจก (54): {$perSourceBasket['54']} คน\n";
    echo "  รวม:              " . count($returnData) . " คน\n\n";
    
    echo "--- ถังปลายทาง (หลังย้าย) ---\n";
    ksort($perTargetBasket);
    foreach ($perTargetBasket as $tb => $cnt) {
        $bn = $basketNames[$tb] ?? "Basket $tb";
        echo "  [$tb] $bn: $cnt คน\n";
    }
    echo "\n";
    
    echo "--- แต่ละ Telesale จะได้รับคืน ---\n";
    echo str_pad("Telesale", 45) . str_pad("ก่อนย้าย", 12) . str_pad("ได้คืน", 10) . "หลังย้าย\n";
    echo str_repeat("-", 80) . "\n";
    
    foreach ($ownerNames as $uid => $u) {
        $returnCount = $perOwner[$uid] ?? 0;
        
        // Get current customer count for this telesale
        $cntStmt = $pdo->prepare("
            SELECT COUNT(*) as cnt FROM customers 
            WHERE company_id = ? AND assigned_to = ? AND current_basket_key NOT IN ('41','42','43','44','45','52','53','54')
        ");
        $cntStmt->execute([$companyId, $uid]);
        $currentCount = $cntStmt->fetch(PDO::FETCH_ASSOC)['cnt'];
        
        $afterCount = $currentCount + $returnCount;
        $name = "{$u['username']} ({$u['first_name']} {$u['last_name']})";
        echo str_pad($name, 45) . str_pad($currentCount, 12) . str_pad("+$returnCount", 10) . "$afterCount\n";
    }
    echo str_repeat("-", 80) . "\n";
    
    // ============================================================
    // Step 5: Execute (if not dry run)
    // ============================================================
    if ($dryRun) {
        echo "\n🔍 DRY RUN - ไม่มีการย้ายจริง\n";
        echo "   เพื่อย้ายจริง ใช้: dryrun=0\n";
    } else {
        echo "\n⚡ EXECUTING TRANSFERS...\n\n";
        
        $success = 0;
        $errors = 0;
        
        foreach ($returnData as $cid => $rd) {
            $c = $rd['customer'];
            $ownerId = $rd['owner_id'];
            $targetBasket = $rd['correct_basket'];
            $fromBasket = $c['current_basket_key'];
            $name = trim($c['first_name'] . ' ' . $c['last_name']);
            $ownerName = $ownerNames[$ownerId]['username'] ?? $ownerId;
            $targetName = $basketNames[$targetBasket] ?? $targetBasket;
            
            try {
                $pdo->beginTransaction();
                
                // Update customer: set owner + correct basket
                $updateStmt = $pdo->prepare("
                    UPDATE customers SET 
                        assigned_to = ?,
                        current_basket_key = ?,
                        basket_entered_date = NOW(),
                        date_assigned = NOW()
                    WHERE customer_id = ?
                ");
                $updateStmt->execute([$ownerId, $targetBasket, $cid]);
                
                // Clear hold_until_date if coming from basket 54
                if ($fromBasket == '54') {
                    $clearStmt = $pdo->prepare("UPDATE customers SET hold_until_date = NULL WHERE customer_id = ?");
                    $clearStmt->execute([$cid]);
                }
                
                // Log transition
                $logStmt = $pdo->prepare("
                    INSERT INTO basket_transition_log 
                        (customer_id, from_basket_key, to_basket_key, transition_type, 
                         assigned_to_old, assigned_to_new, triggered_by, notes, created_at)
                    VALUES (?, ?, ?, 'reclaim', NULL, ?, ?, ?, NOW())
                ");
                $note = "คืนเจ้าของเดิม: '$name' → $ownerName | $targetName (Order: {$rd['days_order']}d)";
                $logStmt->execute([$cid, $fromBasket, $targetBasket, $ownerId, $ownerId, $note]);
                
                $pdo->commit();
                echo "  ✅ $name → $ownerName [$targetName]\n";
                $success++;
                
            } catch (Exception $e) {
                $pdo->rollBack();
                echo "  ❌ $name: " . $e->getMessage() . "\n";
                $errors++;
            }
        }
        
        echo "\n=====================================================\n";
        echo "  DONE!\n";
        echo "  ✅ Success: $success\n";
        echo "  ❌ Errors: $errors\n";
        echo "=====================================================\n";
    }
    
} catch (Exception $e) {
    echo "FATAL ERROR: " . $e->getMessage() . "\n";
}
