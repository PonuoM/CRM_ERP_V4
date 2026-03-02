<?php
/**
 * Basket Re-evaluate Safety Script
 * 
 * ตรวจสอบและแก้ไขลูกค้าที่อยู่ผิดถัง (Dashboard baskets)
 * 
 * เรียกใช้ผ่าน URL: /api/cron/basket_reevaluate_safety.php?key=basket_transfer_2026_secret&dryrun=1
 * 
 * Parameters:
 * - key: Secret key สำหรับความปลอดภัย (required)
 * - dryrun: 1 = แสดงผลลัพธ์อย่างเดียว, 0 = แก้จริง (default: 1)
 * - basket: Basket ID เฉพาะ หรือ "all" (default: all)
 * - limit: จำนวนสูงสุดที่จะประมวลผล (optional)
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
require_once __DIR__ . '/../config.php';

// ========================
// Parameters
// ========================
$dryRun = ($_GET['dryrun'] ?? '1') === '1';
$basketFilter = $_GET['basket'] ?? 'all';
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : null;

echo "===========================================\n";
echo "Basket Re-evaluate Safety Script\n";
echo "Date: " . date('Y-m-d H:i:s') . "\n";
echo "Mode: " . ($dryRun ? "DRY RUN" : "LIVE") . "\n";
echo "Basket: $basketFilter\n";
echo "Limit: " . ($limit ?? 'No limit') . "\n";
echo "===========================================\n\n";

try {
    $pdo = db_connect();
    
    // ============================================================
    // Basket rules (Dashboard baskets)
    // days_since_order → correct basket
    // ============================================================
    // Rules:
    // - 0-60d + creator=owner → 39 (ส่วนตัว 1-2m)
    // - 0-60d + creator≠owner → 38 (ลูกค้าใหม่) or 47 (รอจีบ)
    // - 61-90d + creator=owner → 40 (โอกาสสุดท้าย)
    // - 61-90d + creator≠owner → 47 (รอจีบ)
    // - 91-180d → 46 (หาคนดูแลใหม่)
    // - 181-365d → 48 (กลาง 6-12m)
    // - 366-1095d → 49 (กลาง 1-3y)
    // - 1096d+ → 50 (โบราณ)
    
    $dashboardBaskets = [38, 39, 40, 46, 47, 48, 49, 50]; // exclude 51 (Upsell - special logic)
    
    if ($basketFilter !== 'all') {
        $dashboardBaskets = [(int)$basketFilter];
    }
    
    $basketIds = implode(',', $dashboardBaskets);
    
    // ============================================================
    // Step 1: Find customers in wrong baskets
    // ============================================================
    $limitClause = $limit ? "LIMIT $limit" : "";
    
    $sql = "
        SELECT 
            c.customer_id,
            c.first_name,
            c.last_name,
            c.assigned_to,
            c.current_basket_key,
            c.company_id,
            d.days_since_order,
            lo.creator_id AS latest_creator_id,
            CASE
                WHEN d.days_since_order BETWEEN 0 AND 60 
                     AND lo.creator_id = c.assigned_to THEN 39
                WHEN d.days_since_order BETWEEN 0 AND 60 
                     AND (lo.creator_id != c.assigned_to OR c.assigned_to IS NULL) THEN 47
                WHEN d.days_since_order BETWEEN 61 AND 90 
                     AND lo.creator_id = c.assigned_to THEN 40
                WHEN d.days_since_order BETWEEN 61 AND 90 
                     AND (lo.creator_id != c.assigned_to OR c.assigned_to IS NULL) THEN 47
                WHEN d.days_since_order BETWEEN 91 AND 180 THEN 46
                WHEN d.days_since_order BETWEEN 181 AND 365 THEN 48
                WHEN d.days_since_order BETWEEN 366 AND 1095 THEN 49
                WHEN d.days_since_order >= 1096 THEN 50
                ELSE NULL
            END AS correct_basket
        FROM customers c
        JOIN (
            SELECT customer_id, DATEDIFF(CURDATE(), MAX(order_date)) AS days_since_order
            FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
            GROUP BY customer_id
        ) d ON d.customer_id = c.customer_id
        LEFT JOIN (
            SELECT o1.customer_id, o1.creator_id
            FROM orders o1
            INNER JOIN (
                SELECT customer_id, MAX(order_date) AS max_date
                FROM orders WHERE order_status NOT IN ('CANCELLED', 'RETURNED')
                GROUP BY customer_id
            ) o2 ON o1.customer_id = o2.customer_id AND o1.order_date = o2.max_date
        ) lo ON lo.customer_id = c.customer_id
        WHERE c.assigned_to IS NOT NULL
          AND c.current_basket_key IN ($basketIds)
        HAVING correct_basket IS NOT NULL 
           AND correct_basket != c.current_basket_key
        $limitClause
    ";
    
    $stmt = $pdo->query($sql);
    $wrongCustomers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Found " . count($wrongCustomers) . " customers in wrong baskets\n\n";
    
    if (count($wrongCustomers) === 0) {
        echo "✅ All customers are in correct baskets!\n";
        echo "===========================================\n";
        exit;
    }
    
    // ============================================================
    // Step 2: Group by transition for summary
    // ============================================================
    $summary = [];
    foreach ($wrongCustomers as $cust) {
        $key = $cust['current_basket_key'] . '→' . $cust['correct_basket'];
        if (!isset($summary[$key])) {
            $summary[$key] = 0;
        }
        $summary[$key]++;
    }
    
    echo "=== Summary ===\n";
    foreach ($summary as $transition => $count) {
        echo "  $transition: $count customers\n";
    }
    echo "\n";
    
    // ============================================================
    // Step 3: Load basket names
    // ============================================================
    $nameStmt = $pdo->query("SELECT id, basket_name FROM basket_config");
    $basketNames = [];
    while ($row = $nameStmt->fetch(PDO::FETCH_ASSOC)) {
        $basketNames[$row['id']] = $row['basket_name'];
    }
    
    // ============================================================
    // Step 4: Process (move or dry-run)
    // ============================================================
    $totalFixed = 0;
    $totalErrors = 0;
    
    foreach ($wrongCustomers as $cust) {
        $customerId = $cust['customer_id'];
        $name = trim($cust['first_name'] . ' ' . $cust['last_name']);
        $fromBasket = $cust['current_basket_key'];
        $toBasket = $cust['correct_basket'];
        $daysOrder = $cust['days_since_order'];
        $fromName = $basketNames[$fromBasket] ?? $fromBasket;
        $toName = $basketNames[$toBasket] ?? $toBasket;
        
        echo "  $name: $fromName → $toName (order: {$daysOrder}d)";
        
        if ($dryRun) {
            echo " [DRY]\n";
        } else {
            try {
                // Update customer basket
                $updateStmt = $pdo->prepare("
                    UPDATE customers SET 
                        current_basket_key = ?,
                        basket_entered_date = NOW()
                    WHERE customer_id = ?
                ");
                $updateStmt->execute([$toBasket, $customerId]);
                
                // Log transition
                $logStmt = $pdo->prepare("
                    INSERT INTO basket_transition_log 
                        (customer_id, from_basket_key, to_basket_key, transition_type, triggered_by, notes, created_at)
                    VALUES (?, ?, ?, 'safety_reevaluate', ?, ?, NOW())
                ");
                $note = "Safety re-evaluate: '$name' (Order: {$daysOrder}d) $fromName → $toName";
                $logStmt->execute([$customerId, $fromBasket, $toBasket, $cust['assigned_to'], $note]);
                
                echo " [OK]\n";
                $totalFixed++;
            } catch (Exception $e) {
                echo " [ERR: " . $e->getMessage() . "]\n";
                $totalErrors++;
            }
        }
    }
    
    echo "\n===========================================\n";
    echo "SUMMARY:\n";
    echo "  Total wrong: " . count($wrongCustomers) . "\n";
    if (!$dryRun) {
        echo "  Fixed: $totalFixed\n";
        echo "  Errors: $totalErrors\n";
    }
    echo "===========================================\n";
    
} catch (Exception $e) {
    echo "FATAL ERROR: " . $e->getMessage() . "\n";
}
