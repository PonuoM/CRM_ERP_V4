<?php
/**
 * Initial Basket Assignment Script
 * 
 * URL: /api/cron/init_basket_assignment.php?key=basket_transfer_2026_secret&dryrun=1
 * 
 * Parameters:
 * - key: Secret key (required)
 * - dryrun: 1 = preview only, 0 = execute (default: 1)
 */

header('Content-Type: text/plain; charset=utf-8');

$SECRET_KEY = 'basket_transfer_2026_secret';
$inputKey = $_GET['key'] ?? '';

if ($inputKey !== $SECRET_KEY) {
    http_response_code(403);
    die("Access Denied.\n");
}

define('SKIP_AUTH', true);
require_once __DIR__ . '/../config.php';

$dryRun = ($_GET['dryrun'] ?? '1') === '1';

echo "=====================================================\n";
echo "Initial Basket Assignment Script\n";
echo "Date: " . date('Y-m-d H:i:s') . "\n";
echo "Mode: " . ($dryRun ? "DRY RUN (Preview Only)" : "⚠️ LIVE EXECUTION") . "\n";
echo "=====================================================\n\n";

try {
    $pdo = db_connect();
    
    // =====================================================
    // STEP 0: Check Upsell candidates (assigned_to IS NULL + Pending order)
    // =====================================================
    echo "=== STEP 0: Upsell Check (DON'T TOUCH!) ===\n";
    
    // Upsell = assigned_to IS NULL AND has Pending order
    $upsellCheck = $pdo->query("
        SELECT COUNT(*) as cnt FROM customers c
        WHERE c.assigned_to IS NULL 
        AND EXISTS (
            SELECT 1 FROM orders o 
            WHERE o.customer_id = c.customer_id 
            AND o.order_status = 'Pending'
        )
    ")->fetch(PDO::FETCH_ASSOC);
    echo "⛔ Upsell candidates (NULL + Pending order): {$upsellCheck['cnt']}\n";
    
    // Also show NULL basket count
    $nullBasket = $pdo->query("
        SELECT COUNT(*) as cnt FROM customers 
        WHERE assigned_to IS NULL 
        AND current_basket_key IS NULL
    ")->fetch(PDO::FETCH_ASSOC);
    echo "⛔ Customers with NULL basket: {$nullBasket['cnt']}\n";
    echo "   → These will NOT be modified\n\n";
    
    // =====================================================
    // STEP 1: Assigned Customers (assigned_to IS NOT NULL)
    // =====================================================
    echo "=== STEP 1: ASSIGNED CUSTOMERS ===\n\n";
    
    $assignedRules = [
        // Priority order matters!
        [
            'id' => 51,
            'name' => 'Upsell (Dashboard)',
            'sql' => "
                UPDATE customers c
                SET c.current_basket_key = '51', c.basket_entered_date = NOW()
                WHERE c.assigned_to IS NOT NULL
                AND EXISTS (
                    SELECT 1 FROM orders o
                    JOIN users u ON o.creator_id = u.id
                    WHERE o.customer_id = c.customer_id
                    AND u.role_id = 3
                    AND o.order_status = 'Pending'
                    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id)
                )
            ",
            'count_sql' => "
                SELECT COUNT(*) as cnt FROM customers c
                WHERE c.assigned_to IS NOT NULL
                AND EXISTS (
                    SELECT 1 FROM orders o
                    JOIN users u ON o.creator_id = u.id
                    WHERE o.customer_id = c.customer_id
                    AND u.role_id = 3
                    AND o.order_status = 'Pending'
                    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id)
                )
            "
        ],
        [
            'id' => 38,
            'name' => 'ลูกค้าใหม่',
            'sql' => "
                UPDATE customers c
                SET c.current_basket_key = '38', c.basket_entered_date = NOW()
                WHERE c.assigned_to IS NOT NULL
                AND c.current_basket_key NOT IN ('51')
                AND EXISTS (
                    SELECT 1 FROM orders o
                    JOIN users u ON o.creator_id = u.id
                    WHERE o.customer_id = c.customer_id
                    AND u.role_id = 3
                    AND o.order_status != 'Cancelled'
                    AND DATEDIFF(CURDATE(), o.order_date) BETWEEN 1 AND 60
                    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
                )
            ",
            'count_sql' => "
                SELECT COUNT(*) as cnt FROM customers c
                WHERE c.assigned_to IS NOT NULL
                AND (c.current_basket_key IS NULL OR c.current_basket_key NOT IN ('51'))
                AND EXISTS (
                    SELECT 1 FROM orders o
                    JOIN users u ON o.creator_id = u.id
                    WHERE o.customer_id = c.customer_id
                    AND u.role_id = 3
                    AND o.order_status != 'Cancelled'
                    AND DATEDIFF(CURDATE(), o.order_date) BETWEEN 1 AND 60
                    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
                )
            "
        ],
        [
            'id' => 39,
            'name' => 'ส่วนตัว 1-2 เดือน',
            'sql' => "
                UPDATE customers c
                SET c.current_basket_key = '39', c.basket_entered_date = NOW()
                WHERE c.assigned_to IS NOT NULL
                AND c.current_basket_key NOT IN ('51', '38')
                AND EXISTS (
                    SELECT 1 FROM orders o
                    WHERE o.customer_id = c.customer_id
                    AND o.creator_id = c.assigned_to
                    AND o.order_status != 'Cancelled'
                    AND DATEDIFF(CURDATE(), o.order_date) BETWEEN 1 AND 60
                    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
                )
            ",
            'count_sql' => "
                SELECT COUNT(*) as cnt FROM customers c
                WHERE c.assigned_to IS NOT NULL
                AND (c.current_basket_key IS NULL OR c.current_basket_key NOT IN ('51', '38'))
                AND EXISTS (
                    SELECT 1 FROM orders o
                    WHERE o.customer_id = c.customer_id
                    AND o.creator_id = c.assigned_to
                    AND o.order_status != 'Cancelled'
                    AND DATEDIFF(CURDATE(), o.order_date) BETWEEN 1 AND 60
                    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
                )
            "
        ],
        [
            'id' => 40,
            'name' => 'โอกาสสุดท้าย',
            'sql' => "
                UPDATE customers c
                SET c.current_basket_key = '40', c.basket_entered_date = NOW()
                WHERE c.assigned_to IS NOT NULL
                AND c.current_basket_key NOT IN ('51', '38', '39')
                AND EXISTS (
                    SELECT 1 FROM orders o
                    WHERE o.customer_id = c.customer_id
                    AND o.creator_id = c.assigned_to
                    AND o.order_status != 'Cancelled'
                    AND DATEDIFF(CURDATE(), o.order_date) BETWEEN 61 AND 90
                    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
                )
            ",
            'count_sql' => "
                SELECT COUNT(*) as cnt FROM customers c
                WHERE c.assigned_to IS NOT NULL
                AND (c.current_basket_key IS NULL OR c.current_basket_key NOT IN ('51', '38', '39'))
                AND EXISTS (
                    SELECT 1 FROM orders o
                    WHERE o.customer_id = c.customer_id
                    AND o.creator_id = c.assigned_to
                    AND o.order_status != 'Cancelled'
                    AND DATEDIFF(CURDATE(), o.order_date) BETWEEN 61 AND 90
                    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
                )
            "
        ],
        [
            'id' => 46,
            'name' => 'หาคนดูแลใหม่ (Dashboard)',
            'sql' => "
                UPDATE customers c
                SET c.current_basket_key = '46', c.basket_entered_date = NOW()
                WHERE c.assigned_to IS NOT NULL
                AND c.current_basket_key NOT IN ('51', '38', '39', '40')
                AND EXISTS (
                    SELECT 1 FROM orders o
                    JOIN users u ON o.creator_id = u.id
                    WHERE o.customer_id = c.customer_id
                    AND u.role_id IN (6, 7)
                    AND o.creator_id != c.assigned_to
                    AND o.order_status != 'Cancelled'
                    AND DATEDIFF(CURDATE(), o.order_date) BETWEEN 91 AND 180
                    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
                )
            ",
            'count_sql' => "
                SELECT COUNT(*) as cnt FROM customers c
                WHERE c.assigned_to IS NOT NULL
                AND (c.current_basket_key IS NULL OR c.current_basket_key NOT IN ('51', '38', '39', '40'))
                AND EXISTS (
                    SELECT 1 FROM orders o
                    JOIN users u ON o.creator_id = u.id
                    WHERE o.customer_id = c.customer_id
                    AND u.role_id IN (6, 7)
                    AND o.creator_id != c.assigned_to
                    AND o.order_status != 'Cancelled'
                    AND DATEDIFF(CURDATE(), o.order_date) BETWEEN 91 AND 180
                    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
                )
            "
        ],
        [
            'id' => 47,
            'name' => 'รอคนมาจีบ (Dashboard)',
            'sql' => "
                UPDATE customers c
                SET c.current_basket_key = '47', c.basket_entered_date = NOW()
                WHERE c.assigned_to IS NOT NULL
                AND c.current_basket_key NOT IN ('51', '38', '39', '40', '46')
                AND EXISTS (
                    SELECT 1 FROM orders o
                    JOIN users u ON o.creator_id = u.id
                    WHERE o.customer_id = c.customer_id
                    AND u.role_id = 3
                    AND o.order_status != 'Cancelled'
                    AND DATEDIFF(CURDATE(), o.order_date) BETWEEN 1 AND 180
                    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
                )
            ",
            'count_sql' => "
                SELECT COUNT(*) as cnt FROM customers c
                WHERE c.assigned_to IS NOT NULL
                AND (c.current_basket_key IS NULL OR c.current_basket_key NOT IN ('51', '38', '39', '40', '46'))
                AND EXISTS (
                    SELECT 1 FROM orders o
                    JOIN users u ON o.creator_id = u.id
                    WHERE o.customer_id = c.customer_id
                    AND u.role_id = 3
                    AND o.order_status != 'Cancelled'
                    AND DATEDIFF(CURDATE(), o.order_date) BETWEEN 1 AND 180
                    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
                )
            "
        ],
        [
            'id' => 48,
            'name' => 'ถังกลาง 6-12 เดือน (Dashboard)',
            'sql' => "
                UPDATE customers c
                SET c.current_basket_key = '48', c.basket_entered_date = NOW()
                WHERE c.assigned_to IS NOT NULL
                AND c.current_basket_key NOT IN ('51', '38', '39', '40', '46', '47')
                AND EXISTS (
                    SELECT 1 FROM orders o
                    WHERE o.customer_id = c.customer_id
                    AND o.creator_id = c.assigned_to
                    AND o.order_status != 'Cancelled'
                    AND DATEDIFF(CURDATE(), o.order_date) BETWEEN 181 AND 365
                    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
                )
            ",
            'count_sql' => "
                SELECT COUNT(*) as cnt FROM customers c
                WHERE c.assigned_to IS NOT NULL
                AND (c.current_basket_key IS NULL OR c.current_basket_key NOT IN ('51', '38', '39', '40', '46', '47'))
                AND EXISTS (
                    SELECT 1 FROM orders o
                    WHERE o.customer_id = c.customer_id
                    AND o.creator_id = c.assigned_to
                    AND o.order_status != 'Cancelled'
                    AND DATEDIFF(CURDATE(), o.order_date) BETWEEN 181 AND 365
                    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
                )
            "
        ],
        [
            'id' => 49,
            'name' => 'ถังกลาง 1-3 ปี (Dashboard)',
            'sql' => "
                UPDATE customers c
                SET c.current_basket_key = '49', c.basket_entered_date = NOW()
                WHERE c.assigned_to IS NOT NULL
                AND c.current_basket_key NOT IN ('51', '38', '39', '40', '46', '47', '48')
                AND EXISTS (
                    SELECT 1 FROM orders o
                    WHERE o.customer_id = c.customer_id
                    AND o.creator_id = c.assigned_to
                    AND o.order_status != 'Cancelled'
                    AND DATEDIFF(CURDATE(), o.order_date) BETWEEN 366 AND 1095
                    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
                )
            ",
            'count_sql' => "
                SELECT COUNT(*) as cnt FROM customers c
                WHERE c.assigned_to IS NOT NULL
                AND (c.current_basket_key IS NULL OR c.current_basket_key NOT IN ('51', '38', '39', '40', '46', '47', '48'))
                AND EXISTS (
                    SELECT 1 FROM orders o
                    WHERE o.customer_id = c.customer_id
                    AND o.creator_id = c.assigned_to
                    AND o.order_status != 'Cancelled'
                    AND DATEDIFF(CURDATE(), o.order_date) BETWEEN 366 AND 1095
                    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
                )
            "
        ],
        [
            'id' => 50,
            'name' => 'ถังโบราณ เก่าเก็บ (Dashboard)',
            'sql' => "
                UPDATE customers c
                SET c.current_basket_key = '50', c.basket_entered_date = NOW()
                WHERE c.assigned_to IS NOT NULL
                AND c.current_basket_key NOT IN ('51', '38', '39', '40', '46', '47', '48', '49')
                AND EXISTS (
                    SELECT 1 FROM orders o
                    WHERE o.customer_id = c.customer_id
                    AND o.creator_id = c.assigned_to
                    AND o.order_status != 'Cancelled'
                    AND DATEDIFF(CURDATE(), o.order_date) > 1095
                    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
                )
            ",
            'count_sql' => "
                SELECT COUNT(*) as cnt FROM customers c
                WHERE c.assigned_to IS NOT NULL
                AND (c.current_basket_key IS NULL OR c.current_basket_key NOT IN ('51', '38', '39', '40', '46', '47', '48', '49'))
                AND EXISTS (
                    SELECT 1 FROM orders o
                    WHERE o.customer_id = c.customer_id
                    AND o.creator_id = c.assigned_to
                    AND o.order_status != 'Cancelled'
                    AND DATEDIFF(CURDATE(), o.order_date) > 1095
                    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
                )
            "
        ]
    ];
    
    foreach ($assignedRules as $rule) {
        $count = $pdo->query($rule['count_sql'])->fetch(PDO::FETCH_ASSOC)['cnt'];
        echo "[{$rule['id']}] {$rule['name']}: $count customers";
        
        if (!$dryRun && $count > 0) {
            $affected = $pdo->exec($rule['sql']);
            echo " → Updated: $affected";
        }
        echo "\n";
    }
    
    // =====================================================
    // STEP 2: Unassigned Customers (assigned_to IS NULL)
    // =====================================================
    echo "\n=== STEP 2: UNASSIGNED CUSTOMERS ===\n\n";
    
    $unassignedRules = [
        [
            'id' => 42,
            'name' => 'รอคนมาจีบ (Distribution)',
            'sql' => "
                UPDATE customers c
                SET c.current_basket_key = '42', c.basket_entered_date = NOW()
                WHERE c.assigned_to IS NULL
                AND NOT EXISTS (SELECT 1 FROM orders op WHERE op.customer_id = c.customer_id AND op.order_status = 'Pending')
                AND EXISTS (
                    SELECT 1 FROM orders o
                    JOIN users u ON o.creator_id = u.id
                    WHERE o.customer_id = c.customer_id
                    AND u.role_id = 3
                    AND o.order_status != 'Cancelled'
                    AND DATEDIFF(CURDATE(), o.order_date) BETWEEN 1 AND 180
                    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
                )
            ",
            'count_sql' => "
                SELECT COUNT(*) as cnt FROM customers c
                WHERE c.assigned_to IS NULL
                AND NOT EXISTS (SELECT 1 FROM orders op WHERE op.customer_id = c.customer_id AND op.order_status = 'Pending')
                AND EXISTS (
                    SELECT 1 FROM orders o
                    JOIN users u ON o.creator_id = u.id
                    WHERE o.customer_id = c.customer_id
                    AND u.role_id = 3
                    AND o.order_status != 'Cancelled'
                    AND DATEDIFF(CURDATE(), o.order_date) BETWEEN 1 AND 180
                    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
                )
            "
        ],
        [
            'id' => 41,
            'name' => 'หาคนดูแลใหม่ (Distribution)',
            'sql' => "
                UPDATE customers c
                SET c.current_basket_key = '41', c.basket_entered_date = NOW()
                WHERE c.assigned_to IS NULL
                AND (c.current_basket_key IS NULL OR c.current_basket_key != '42')
                AND NOT EXISTS (SELECT 1 FROM orders op WHERE op.customer_id = c.customer_id AND op.order_status = 'Pending')
                AND EXISTS (
                    SELECT 1 FROM orders o
                    JOIN users u ON o.creator_id = u.id
                    WHERE o.customer_id = c.customer_id
                    AND u.role_id IN (6, 7)
                    AND o.order_status != 'Cancelled'
                    AND DATEDIFF(CURDATE(), o.order_date) BETWEEN 1 AND 180
                    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
                )
            ",
            'count_sql' => "
                SELECT COUNT(*) as cnt FROM customers c
                WHERE c.assigned_to IS NULL
                AND NOT EXISTS (SELECT 1 FROM orders op WHERE op.customer_id = c.customer_id AND op.order_status = 'Pending')
                AND EXISTS (
                    SELECT 1 FROM orders o
                    JOIN users u ON o.creator_id = u.id
                    WHERE o.customer_id = c.customer_id
                    AND u.role_id IN (6, 7)
                    AND o.order_status != 'Cancelled'
                    AND DATEDIFF(CURDATE(), o.order_date) BETWEEN 1 AND 180
                    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
                )
            "
        ],
        [
            'id' => 43,
            'name' => 'ถังกลาง 6-12 เดือน (Distribution)',
            'sql' => "
                UPDATE customers c
                SET c.current_basket_key = '43', c.basket_entered_date = NOW()
                WHERE c.assigned_to IS NULL
                AND (c.current_basket_key IS NULL OR c.current_basket_key NOT IN ('42', '41'))
                AND NOT EXISTS (SELECT 1 FROM orders op WHERE op.customer_id = c.customer_id AND op.order_status = 'Pending')
                AND EXISTS (
                    SELECT 1 FROM orders o
                    WHERE o.customer_id = c.customer_id
                    AND o.order_status != 'Cancelled'
                    AND DATEDIFF(CURDATE(), o.order_date) BETWEEN 181 AND 365
                    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
                )
            ",
            'count_sql' => "
                SELECT COUNT(*) as cnt FROM customers c
                WHERE c.assigned_to IS NULL
                AND NOT EXISTS (SELECT 1 FROM orders op WHERE op.customer_id = c.customer_id AND op.order_status = 'Pending')
                AND EXISTS (
                    SELECT 1 FROM orders o
                    WHERE o.customer_id = c.customer_id
                    AND o.order_status != 'Cancelled'
                    AND DATEDIFF(CURDATE(), o.order_date) BETWEEN 181 AND 365
                    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
                )
            "
        ],
        [
            'id' => 44,
            'name' => 'ถังกลาง 1-3 ปี (Distribution)',
            'sql' => "
                UPDATE customers c
                SET c.current_basket_key = '44', c.basket_entered_date = NOW()
                WHERE c.assigned_to IS NULL
                AND (c.current_basket_key IS NULL OR c.current_basket_key NOT IN ('42', '41', '43'))
                AND NOT EXISTS (SELECT 1 FROM orders op WHERE op.customer_id = c.customer_id AND op.order_status = 'Pending')
                AND EXISTS (
                    SELECT 1 FROM orders o
                    WHERE o.customer_id = c.customer_id
                    AND o.order_status != 'Cancelled'
                    AND DATEDIFF(CURDATE(), o.order_date) BETWEEN 366 AND 1095
                    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
                )
            ",
            'count_sql' => "
                SELECT COUNT(*) as cnt FROM customers c
                WHERE c.assigned_to IS NULL
                AND NOT EXISTS (SELECT 1 FROM orders op WHERE op.customer_id = c.customer_id AND op.order_status = 'Pending')
                AND EXISTS (
                    SELECT 1 FROM orders o
                    WHERE o.customer_id = c.customer_id
                    AND o.order_status != 'Cancelled'
                    AND DATEDIFF(CURDATE(), o.order_date) BETWEEN 366 AND 1095
                    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
                )
            "
        ],
        [
            'id' => 45,
            'name' => 'ถังโบราณ เก่าเก็บ (Distribution)',
            'sql' => "
                UPDATE customers c
                SET c.current_basket_key = '45', c.basket_entered_date = NOW()
                WHERE c.assigned_to IS NULL
                AND (c.current_basket_key IS NULL OR c.current_basket_key NOT IN ('42', '41', '43', '44'))
                AND NOT EXISTS (SELECT 1 FROM orders op WHERE op.customer_id = c.customer_id AND op.order_status = 'Pending')
                AND EXISTS (
                    SELECT 1 FROM orders o
                    WHERE o.customer_id = c.customer_id
                    AND o.order_status != 'Cancelled'
                    AND DATEDIFF(CURDATE(), o.order_date) > 1095
                    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
                )
            ",
            'count_sql' => "
                SELECT COUNT(*) as cnt FROM customers c
                WHERE c.assigned_to IS NULL
                AND NOT EXISTS (SELECT 1 FROM orders op WHERE op.customer_id = c.customer_id AND op.order_status = 'Pending')
                AND EXISTS (
                    SELECT 1 FROM orders o
                    WHERE o.customer_id = c.customer_id
                    AND o.order_status != 'Cancelled'
                    AND DATEDIFF(CURDATE(), o.order_date) > 1095
                    AND o.order_date = (SELECT MAX(o2.order_date) FROM orders o2 WHERE o2.customer_id = c.customer_id AND o2.order_status != 'Cancelled')
                )
            "
        ]
    ];
    
    foreach ($unassignedRules as $rule) {
        $count = $pdo->query($rule['count_sql'])->fetch(PDO::FETCH_ASSOC)['cnt'];
        echo "[{$rule['id']}] {$rule['name']}: $count customers";
        
        if (!$dryRun && $count > 0) {
            $affected = $pdo->exec($rule['sql']);
            echo " → Updated: $affected";
        }
        echo "\n";
    }
    
    // =====================================================
    // STEP 3: FALLBACK - ใช้ date_registered สำหรับคนที่ไม่มี order
    // =====================================================
    echo "\n=== STEP 3: FALLBACK (ใช้ date_registered) ===\n\n";
    
    // Fallback for ASSIGNED customers without matching orders
    $assignedFallback = [
        ['id' => 39, 'name' => 'ส่วนตัว 1-2 เดือน', 'min' => 1, 'max' => 60],
        ['id' => 40, 'name' => 'โอกาสสุดท้าย', 'min' => 61, 'max' => 90],
        ['id' => 47, 'name' => 'รอคนมาจีบ (Dashboard)', 'min' => 91, 'max' => 180],
        ['id' => 48, 'name' => 'ถังกลาง 6-12 เดือน', 'min' => 181, 'max' => 365],
        ['id' => 49, 'name' => 'ถังกลาง 1-3 ปี', 'min' => 366, 'max' => 1095],
        ['id' => 50, 'name' => 'ถังโบราณ เก่าเก็บ', 'min' => 1096, 'max' => 999999],
    ];
    
    echo "--- Assigned (Fallback by date_registered) ---\n";
    foreach ($assignedFallback as $fb) {
        $countSql = "
            SELECT COUNT(*) as cnt FROM customers c
            WHERE c.assigned_to IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id AND o.order_status != 'Cancelled')
            AND c.date_registered IS NOT NULL
            AND DATEDIFF(CURDATE(), c.date_registered) BETWEEN {$fb['min']} AND {$fb['max']}
        ";
        $updateSql = "
            UPDATE customers c
            SET c.current_basket_key = '{$fb['id']}', c.basket_entered_date = NOW()
            WHERE c.assigned_to IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id AND o.order_status != 'Cancelled')
            AND c.date_registered IS NOT NULL
            AND DATEDIFF(CURDATE(), c.date_registered) BETWEEN {$fb['min']} AND {$fb['max']}
        ";
        
        $count = $pdo->query($countSql)->fetch(PDO::FETCH_ASSOC)['cnt'];
        echo "[{$fb['id']}] {$fb['name']} ({$fb['min']}-{$fb['max']}d): $count customers";
        
        if (!$dryRun && $count > 0) {
            $affected = $pdo->exec($updateSql);
            echo " → Updated: $affected";
        }
        echo "\n";
    }
    
    // Fallback for UNASSIGNED customers without orders
    $unassignedFallback = [
        ['id' => 42, 'name' => 'รอคนมาจีบ (Distribution)', 'min' => 1, 'max' => 180],
        ['id' => 43, 'name' => 'ถังกลาง 6-12 เดือน', 'min' => 181, 'max' => 365],
        ['id' => 44, 'name' => 'ถังกลาง 1-3 ปี', 'min' => 366, 'max' => 1095],
        ['id' => 45, 'name' => 'ถังโบราณ เก่าเก็บ', 'min' => 1096, 'max' => 999999],
    ];
    
    echo "\n--- Unassigned (Fallback by date_registered) ---\n";
    foreach ($unassignedFallback as $fb) {
        $countSql = "
            SELECT COUNT(*) as cnt FROM customers c
            WHERE c.assigned_to IS NULL
            AND NOT EXISTS (SELECT 1 FROM orders op WHERE op.customer_id = c.customer_id AND op.order_status = 'Pending')
            AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id AND o.order_status != 'Cancelled')
            AND c.date_registered IS NOT NULL
            AND DATEDIFF(CURDATE(), c.date_registered) BETWEEN {$fb['min']} AND {$fb['max']}
        ";
        $updateSql = "
            UPDATE customers c
            SET c.current_basket_key = '{$fb['id']}', c.basket_entered_date = NOW()
            WHERE c.assigned_to IS NULL
            AND NOT EXISTS (SELECT 1 FROM orders op WHERE op.customer_id = c.customer_id AND op.order_status = 'Pending')
            AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id AND o.order_status != 'Cancelled')
            AND c.date_registered IS NOT NULL
            AND DATEDIFF(CURDATE(), c.date_registered) BETWEEN {$fb['min']} AND {$fb['max']}
        ";
        
        $count = $pdo->query($countSql)->fetch(PDO::FETCH_ASSOC)['cnt'];
        echo "[{$fb['id']}] {$fb['name']} ({$fb['min']}-{$fb['max']}d): $count customers";
        
        if (!$dryRun && $count > 0) {
            $affected = $pdo->exec($updateSql);
            echo " → Updated: $affected";
        }
        echo "\n";
    }
    
    echo "\n=====================================================\n";
    if ($dryRun) {
        echo "DRY RUN COMPLETE - No changes made\n";
        echo "To execute: add &dryrun=0 to URL\n";
    } else {
        echo "EXECUTION COMPLETE\n";
    }
    echo "=====================================================\n";
    
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo "Line: " . $e->getLine() . "\n";
}
