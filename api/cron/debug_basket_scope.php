<?php
/**
 * Debug: ค้นหาลูกค้าทุกคนที่อาจได้รับผลกระทบจากปัญหาเดียวกับ 307448
 * Filter: ตั้งแต่ 2026-01-29 เป็นต้นไป
 * 
 * คำถามที่ต้องตอบ:
 * 1. Order 260130-05403nut47 ผ่าน Picking status หรือข้ามไปเป็น Shipping ตรงๆ?
 * 2. Hook ปกติ (PUT/PATCH) trigger ตอนเปลี่ยน status หรือไม่?
 * 3. มีลูกค้ารายอื่นที่พบปัญหาเดียวกันหรือไม่?
 */
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once __DIR__ . '/../config.php';
$pdo = db_connect();
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

header('Content-Type: text/html; charset=utf-8');
echo "<html><head><meta charset='utf-8'><title>Basket Routing Scope Analysis</title>";
echo "<style>
body { font-family: 'Segoe UI', monospace; background: #1a1a2e; color: #e0e0e0; padding: 20px; }
h1 { color: #00d4ff; border-bottom: 2px solid #00d4ff; padding-bottom: 10px; }
h2 { color: #ffd700; margin-top: 30px; }
h3 { color: #ff6b6b; }
table { border-collapse: collapse; width: 100%; margin: 10px 0 20px 0; }
th { background: #16213e; color: #00d4ff; padding: 8px 12px; text-align: left; border: 1px solid #333; }
td { background: #0f3460; padding: 8px 12px; border: 1px solid #333; }
.highlight { background: #ff6b6b !important; color: #fff; font-weight: bold; }
.success { background: #2ecc71 !important; color: #000; font-weight: bold; }
.warning { background: #f39c12 !important; color: #000; }
.info-box { background: #16213e; border-left: 4px solid #00d4ff; padding: 15px; margin: 10px 0; }
.error-box { background: #3d0000; border-left: 4px solid #ff6b6b; padding: 15px; margin: 10px 0; }
pre { background: #0d1117; color: #c9d1d9; padding: 15px; border-radius: 6px; overflow-x: auto; }
</style></head><body>";

$DATE_FILTER = '2026-01-29';
echo "<h1>🔍 Basket Routing: Scope Analysis — ตั้งแต่ $DATE_FILTER</h1>";
echo "<p>Generated: " . date('Y-m-d H:i:s') . "</p>";

// ============================================================
// SECTION 1: ตรวจ Order 260130-05403nut47 — มี Picking status ผ่านมาหรือไม่?
// ============================================================
echo "<h2>1. 📋 Order 260130-05403nut47 — ตรวจ lifecycle ที่แท้จริง</h2>";

// Check if order_status_history or audit table exists
$auditTables = ['order_status_history', 'order_audit_log', 'order_history', 'audit_log', 'order_status_log'];
echo "<h3>1A. ตรวจว่ามี audit/history table หรือไม่?</h3>";
$dbName = $pdo->query("SELECT DATABASE()")->fetchColumn();
foreach ($auditTables as $tbl) {
    $check = $pdo->query("SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = '$dbName' AND TABLE_NAME = '$tbl'")->fetchColumn();
    $class = $check > 0 ? 'success' : '';
    echo "<div class='info-box'>Table <code>$tbl</code>: <span class='$class'>" . ($check ? "✅ มี" : "❌ ไม่มี") . "</span></div>";
    
    if ($check > 0) {
        // Query it for this order
        try {
            $stmt = $pdo->prepare("SELECT * FROM $tbl WHERE order_id = ? OR id LIKE ? ORDER BY id DESC LIMIT 20");
            $stmt->execute(['260130-05403nut47', '260130-05403nut47%']);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            if (!empty($rows)) {
                echo "<pre>" . print_r($rows, true) . "</pre>";
            }
        } catch (Throwable $e) {
            // Try without order_id
            try {
                $cols = $pdo->query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = '$dbName' AND TABLE_NAME = '$tbl' LIMIT 5")->fetchAll(PDO::FETCH_COLUMN);
                echo "<div class='info-box'>Columns: " . implode(', ', $cols) . "</div>";
            } catch (Throwable $e2) {}
        }
    }
}

// Check for order_tracking_numbers (when was tracking added?)
echo "<h3>1B. Tracking Numbers — เมื่อไหร่ใส่ tracking?</h3>";
try {
    $stmt = $pdo->prepare("SELECT * FROM order_tracking_numbers WHERE parent_order_id = ?");
    $stmt->execute(['260130-05403nut47']);
    $tracks = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if (!empty($tracks)) {
        echo "<table>";
        $headers = array_keys($tracks[0]);
        echo "<tr>";
        foreach ($headers as $h) { echo "<th>$h</th>"; }
        echo "</tr>";
        foreach ($tracks as $t) {
            echo "<tr>";
            foreach ($t as $v) { echo "<td>" . htmlspecialchars($v ?? 'NULL') . "</td>"; }
            echo "</tr>";
        }
        echo "</table>";
    } else {
        echo "<div class='error-box'>❌ ไม่มี tracking number → order ไม่ได้ผ่าน sync_tracking</div>";
    }
} catch (Throwable $e) {
    echo "<div class='error-box'>Error: " . $e->getMessage() . "</div>";
}

// Check order_boxes
echo "<h3>1C. Order Boxes — มีกล่องหรือไม่?</h3>";
try {
    $stmt = $pdo->prepare("SELECT * FROM order_boxes WHERE order_id = ?");
    $stmt->execute(['260130-05403nut47']);
    $boxes = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if (!empty($boxes)) {
        echo "<table>";
        $headers = array_keys($boxes[0]);
        echo "<tr>" . implode('', array_map(fn($h) => "<th>$h</th>", $headers)) . "</tr>";
        foreach ($boxes as $b) {
            echo "<tr>" . implode('', array_map(fn($v) => "<td>" . htmlspecialchars($v ?? 'NULL') . "</td>", $b)) . "</tr>";
        }
        echo "</table>";
    } else {
        echo "<div class='info-box'>ไม่มี boxes</div>";
    }
} catch (Throwable $e) {
    echo "<div class='info-box'>Table order_boxes might not exist: " . $e->getMessage() . "</div>";
}

// ============================================================
// SECTION 2: ค้นหาลูกค้าที่ควรอยู่ 39 แต่อยู่ 38
// — Telesale สร้าง order, order เป็น Picking/Shipping/Delivered, แต่ลูกค้าอยู่ 38
// ============================================================
echo "<h2>2. 🔍 ลูกค้าทั้งหมดที่อาจมีปัญหาเดียวกัน</h2>";
echo "<p><em>เงื่อนไข: ลูกค้าอยู่ basket 38 + มี order ที่ Telesale สร้าง + order เป็น Picking/Shipping/Closed/Delivered</em></p>";

$stmt = $pdo->prepare("
    SELECT c.customer_id, c.first_name, c.last_name, c.phone,
           c.current_basket_key, c.assigned_to, c.basket_entered_date,
           o.id as order_id, o.order_status, o.order_date, o.payment_method,
           o.creator_id, u.first_name as creator_first, u.last_name as creator_last, u.role_id,
           ua.first_name as agent_first, ua.role as agent_role
    FROM customers c
    JOIN orders o ON o.customer_id = c.customer_id
    JOIN users u ON o.creator_id = u.id
    LEFT JOIN users ua ON c.assigned_to = ua.id
    WHERE c.current_basket_key = 38
      AND o.order_date >= '$DATE_FILTER'
      AND u.role_id IN (6, 7)
      AND o.order_status IN ('Picking', 'Shipping', 'Closed', 'Delivered')
    ORDER BY o.order_date DESC
");
$stmt->execute();
$affected = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "<div class='info-box'>พบ <strong>" . count($affected) . "</strong> records (order+customer combinations)</div>";

if (!empty($affected)) {
    echo "<table>";
    echo "<tr>
        <th>#</th><th>Customer ID</th><th>ชื่อ</th><th>Basket</th><th>Agent</th>
        <th>Order ID</th><th>Order Status</th><th>Order Date</th><th>Payment</th>
        <th>Creator</th><th>Role ID</th><th>Basket Entered</th>
    </tr>";
    foreach ($affected as $i => $a) {
        echo "<tr>";
        echo "<td>" . ($i+1) . "</td>";
        echo "<td>{$a['customer_id']}</td>";
        echo "<td>{$a['first_name']} {$a['last_name']}</td>";
        echo "<td class='highlight'>{$a['current_basket_key']}</td>";
        echo "<td>{$a['agent_first']} ({$a['agent_role']})</td>";
        echo "<td>{$a['order_id']}</td>";
        echo "<td>{$a['order_status']}</td>";
        echo "<td>{$a['order_date']}</td>";
        echo "<td>{$a['payment_method']}</td>";
        echo "<td>{$a['creator_first']} {$a['creator_last']}</td>";
        echo "<td class='success'>{$a['role_id']}</td>";
        echo "<td>{$a['basket_entered_date']}</td>";
        echo "</tr>";
    }
    echo "</table>";
    
    // Count unique customers
    $uniqueCustomers = array_unique(array_column($affected, 'customer_id'));
    echo "<div class='error-box'>⚠️ จำนวนลูกค้าที่อาจได้รับผลกระทบ: <strong>" . count($uniqueCustomers) . "</strong> คน</div>";
} else {
    echo "<div class='success'>✅ ไม่พบลูกค้าที่มีปัญหาเดียวกัน — อาจเป็น case เฉพาะ</div>";
}

// ============================================================
// SECTION 3: ตรวจ transition_log — มี transition ที่ไปถูก 39 หรือไม่?
// เปรียบเทียบ: ลูกค้าที่ transition ถูกต้อง vs ผิดพลาด
// ============================================================
echo "<h2>3. 📊 เปรียบเทียบ: Transitions ที่ถูกต้อง (→39) vs ที่หายไป</h2>";

// Count transitions to 39 (correct)
$correct = $pdo->query("
    SELECT COUNT(DISTINCT customer_id) 
    FROM basket_transition_log 
    WHERE to_basket_key = 39 AND created_at >= '$DATE_FILTER'
")->fetchColumn();

echo "<div class='info-box'>ลูกค้าที่ถูก route ไปถัง 39 ถูกต้อง (ตั้งแต่ $DATE_FILTER): <strong>$correct</strong> คน</div>";

// Recent transitions to 39
$stmt = $pdo->query("
    SELECT btl.customer_id, btl.from_basket_key, btl.to_basket_key, 
           btl.transition_type, btl.order_id, btl.notes, btl.created_at,
           bc_from.basket_key as from_name, bc_to.basket_key as to_name
    FROM basket_transition_log btl
    LEFT JOIN basket_config bc_from ON btl.from_basket_key = bc_from.id
    LEFT JOIN basket_config bc_to ON btl.to_basket_key = bc_to.id
    WHERE btl.to_basket_key = 39 AND btl.created_at >= '$DATE_FILTER'
    ORDER BY btl.id DESC
    LIMIT 20
");
$recentCorrect = $stmt->fetchAll(PDO::FETCH_ASSOC);

if (!empty($recentCorrect)) {
    echo "<h3>3A. ตัวอย่าง transitions ไป basket 39 ล่าสุด (ที่ทำงานถูกต้อง)</h3>";
    echo "<table>";
    echo "<tr><th>Customer</th><th>From</th><th>To</th><th>Type</th><th>Order ID</th><th>Notes</th><th>Created</th></tr>";
    foreach ($recentCorrect as $rc) {
        echo "<tr>";
        echo "<td>{$rc['customer_id']}</td>";
        echo "<td>{$rc['from_basket_key']} ({$rc['from_name']})</td>";
        echo "<td class='success'>{$rc['to_basket_key']} ({$rc['to_name']})</td>";
        echo "<td>{$rc['transition_type']}</td>";
        echo "<td>{$rc['order_id']}</td>";
        echo "<td>" . htmlspecialchars(substr($rc['notes'] ?? '', 0, 80)) . "</td>";
        echo "<td>{$rc['created_at']}</td>";
        echo "</tr>";
    }
    echo "</table>";
} else {
    echo "<div class='error-box'>❌ ไม่เคยมี transition ไป basket 39 เลย! → อาจเป็นปัญหาใหญ่กว่า</div>";
}

// ============================================================
// SECTION 4: ตรวจ handlePickingOrder logic flow สำหรับ Customer 307448
// จำลองเงื่อนไขทุกขั้นตอน
// ============================================================
echo "<h2>4. 🔬 จำลอง handlePickingOrder() step-by-step สำหรับ order 260130-05403nut47</h2>";
echo "<p><em>เช็คทุกเงื่อนไขที่ BasketRoutingServiceV2 ใช้ตัดสินใจ</em></p>";

$orderStmt = $pdo->prepare("SELECT * FROM orders WHERE id = ?");
$orderStmt->execute(['260130-05403nut47']);
$order = $orderStmt->fetch(PDO::FETCH_ASSOC);

$custStmt = $pdo->prepare("SELECT * FROM customers WHERE customer_id = ?");
$custStmt->execute([307448]);
$cust = $custStmt->fetch(PDO::FETCH_ASSOC);

if ($order && $cust) {
    $currentBasket = (int)($cust['current_basket_key'] ?? 0);
    $hasOwner = !empty($cust['assigned_to']) && $cust['assigned_to'] > 0;
    $assignedTo = $cust['assigned_to'];
    
    $creatorRoleStmt = $pdo->prepare("SELECT role_id FROM users WHERE id = ?");
    $creatorRoleStmt->execute([$order['creator_id']]);
    $creatorRole = (int)$creatorRoleStmt->fetchColumn();
    $isTelesale = in_array($creatorRole, [6, 7]);
    
    echo "<table>";
    echo "<tr><th>Variable</th><th>Value</th><th>จาก</th></tr>";
    echo "<tr><td>\$currentBasket</td><td><strong>$currentBasket</strong></td><td>customers.current_basket_key (ณ ปัจจุบัน)</td></tr>";
    echo "<tr><td>\$hasOwner</td><td>" . ($hasOwner ? '✅ TRUE' : '❌ FALSE') . "</td><td>assigned_to = $assignedTo</td></tr>";
    echo "<tr><td>\$creatorRole</td><td>$creatorRole</td><td>users.role_id ของ creator_id={$order['creator_id']}</td></tr>";
    echo "<tr><td>\$isTelesale</td><td class='" . ($isTelesale ? 'success' : 'highlight') . "'>" . ($isTelesale ? '✅ TRUE' : '❌ FALSE') . "</td><td>in_array(\$creatorRole, [6,7])</td></tr>";
    echo "</table>";
    
    echo "<h3>Logic Flow:</h3>";
    echo "<div class='info-box'>";
    
    // Step 1: Race condition check (skip for now)
    echo "1️⃣ Race Condition Check → <em>ข้ามไป (ไม่มี newer order)</em><br>";
    
    // Step 2: checkTelesaleInvolvement
    echo "2️⃣ \$hasTelesaleInvolvement = checkTelesaleInvolvement() → <em>ดูผลจาก Section 12 ของ debug script</em><br>";
    
    // Step 3: Basket 51 check
    $is51 = ($currentBasket === 51);
    echo "3️⃣ \$currentBasket === 51? → " . ($is51 ? "YES → P1/P2" : "<strong>NO (=$currentBasket) → SKIP P1/P2</strong>") . "<br>";
    
    // Step 4: Basket 53 check
    $is53 = ($currentBasket === 53);
    echo "4️⃣ \$currentBasket === 53? → " . ($is53 ? "YES → P3" : "<strong>NO → SKIP P3</strong>") . "<br>";
    
    // Step 5: Has Owner check
    echo "5️⃣ \$hasOwner? → " . ($hasOwner ? "<strong>YES → เข้า P4/P5</strong>" : "NO → เข้า P6/P7") . "<br>";
    
    if ($hasOwner) {
        echo "6️⃣ \$isTelesale? → " . ($isTelesale ? "<strong>YES → P4: ควร transitionTo(39, 'picking_telesale_own')</strong>" : "NO → P5") . "<br>";
        
        if ($isTelesale) {
            $is39 = ($currentBasket === 39);
            echo "7️⃣ \$currentBasket === 39? → " . ($is39 ? "YES → refreshBasketDate() แล้วจบ (return null)" : "<strong>NO → ควร transition ไป 39!</strong>") . "<br>";
            
            if (!$is39) {
                echo "<br><strong class='highlight' style='font-size: 16px; padding: 10px;'>";
                echo "🎯 สรุป: ถ้า handlePickingOrder() ถูกเรียก → ต้อง transition จาก $currentBasket → 39!";
                echo "<br>แต่ transition log ไม่มี → แปลว่า handlePickingOrder() ไม่เคยถูกเรียก!</strong>";
            }
        }
    }
    echo "</div>";
    
    // KEY QUESTION: Was the basket 38 at the time of the order, or was it different?
    echo "<h3>4B. ⚠️ คำถามสำคัญ: basket เป็นอะไร ณ เวลาที่ order เปลี่ยนเป็น Picking/Shipping?</h3>";
    echo "<div class='info-box'>";
    echo "ปัจจุบัน basket = $currentBasket<br>";
    echo "basket_entered_date = {$cust['basket_entered_date']}<br>";
    echo "order_date = {$order['order_date']}<br>";
    echo "<br>";
    
    // Check transition log around the order date
    $logStmt = $pdo->prepare("
        SELECT btl.*, bc_from.basket_key as from_name, bc_to.basket_key as to_name
        FROM basket_transition_log btl
        LEFT JOIN basket_config bc_from ON btl.from_basket_key = bc_from.id 
        LEFT JOIN basket_config bc_to ON btl.to_basket_key = bc_to.id
        WHERE btl.customer_id = 307448
        ORDER BY btl.created_at ASC
    ");
    $logStmt->execute();
    $allLogs = $logStmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "<strong>Timeline ของ basket changes:</strong><br>";
    foreach ($allLogs as $l) {
        $highlight = (strtotime($l['created_at']) >= strtotime('2026-01-30') && strtotime($l['created_at']) <= strtotime('2026-02-06')) ? 'warning' : '';
        echo "<span class='$highlight'>[{$l['created_at']}] {$l['from_basket_key']} ({$l['from_name']}) → {$l['to_basket_key']} ({$l['to_name']}) — Type: {$l['transition_type']} — Order: {$l['order_id']} — {$l['notes']}</span><br>";
    }
    
    echo "<br><strong>Order 260130-05403nut47 ถูกสร้าง: {$order['order_date']}</strong><br>";
    echo "Transition ล่าสุดก่อน order: ";
    $lastBefore = null;
    foreach ($allLogs as $l) {
        if (strtotime($l['created_at']) <= strtotime($order['order_date'])) {
            $lastBefore = $l;
        }
    }
    if ($lastBefore) {
        echo "[{$lastBefore['created_at']}] → basket {$lastBefore['to_basket_key']} ({$lastBefore['to_name']})<br>";
        echo "→ <strong>ณ เวลาสร้าง order ลูกค้าอยู่ basket {$lastBefore['to_basket_key']}</strong>";
    } else {
        echo "ไม่มี (basket=38 จาก manual)";
    }
    echo "</div>";
}

// ============================================================  
// SECTION 5: ตรวจว่า routing hook ปกติ (POST/PUT/PATCH) ถูกเรียกจริงหรือไม่
// โดยดูจากว่ามี transition log สำหรับ order ที่ถูกสร้างหลังจาก hook ถูกเพิ่มหรือไม่
// ============================================================
echo "<h2>5. 🧪 ตรวจว่า routing hooks ทำงานจริงหรือไม่?</h2>";
echo "<p><em>เปรียบเทียบ: จำนวน orders (Picking/Shipping) ที่ Telesale สร้าง vs จำนวน transition ไป basket 39</em></p>";

// Count all telesale orders that are Picking/Shipping/Closed/Delivered
$telesaleOrderCount = $pdo->query("
    SELECT COUNT(DISTINCT o.id) 
    FROM orders o 
    JOIN users u ON o.creator_id = u.id 
    WHERE u.role_id IN (6,7) 
    AND o.order_status IN ('Picking', 'Shipping', 'Closed', 'Delivered')
    AND o.order_date >= '$DATE_FILTER'
")->fetchColumn();

// Count transitions to 39 from routing (not distribute/transfer)
$routingTo39 = $pdo->query("
    SELECT COUNT(*) 
    FROM basket_transition_log 
    WHERE to_basket_key = 39 
    AND transition_type LIKE 'picking%'
    AND created_at >= '$DATE_FILTER'
")->fetchColumn();

// Count transitions to 39 from ANY source
$anyTo39 = $pdo->query("
    SELECT COUNT(*) 
    FROM basket_transition_log 
    WHERE to_basket_key = 39
    AND created_at >= '$DATE_FILTER'
")->fetchColumn();

echo "<table>";
echo "<tr><th>Metric</th><th>Count</th><th>Analysis</th></tr>";
echo "<tr><td>Telesale orders ที่ Picking/Shipping/Closed/Delivered</td><td><strong>$telesaleOrderCount</strong></td><td>จำนวน orders ทั้งหมดที่ควร trigger routing</td></tr>";
echo "<tr><td>Transitions ไป 39 (จาก routing: picking%)</td><td><strong>$routingTo39</strong></td><td>จำนวนที่ BasketRoutingV2 ทำจริง</td></tr>";
echo "<tr><td>Transitions ไป 39 (ทุกแบบ)</td><td><strong>$anyTo39</strong></td><td>รวม distribute, manual ฯลฯ</td></tr>";
echo "</table>";

$ratio = $telesaleOrderCount > 0 ? round(($routingTo39 / $telesaleOrderCount) * 100, 1) : 0;
$ratioClass = $ratio > 80 ? 'success' : ($ratio > 50 ? 'warning' : 'highlight');
echo "<div class='$ratioClass' style='font-size: 16px; padding: 15px;'>";
echo "Routing Success Rate: <strong>$routingTo39 / $telesaleOrderCount = {$ratio}%</strong>";
if ($ratio < 50) {
    echo "<br>⚠️ อัตราต่ำมาก — อาจเป็นปัญหาเชิงระบบ ไม่ใช่แค่ case เดียว!";
} elseif ($ratio < 80) {
    echo "<br>⚠️ อัตราปานกลาง — มี orders หลาย case ที่หลุด";
}
echo "</div>";

// ============================================================
// SECTION 6: ตรวจว่า BasketRoutingServiceV2 ถูก deploy จริงหรือไม่?
// ============================================================
echo "<h2>6. 🚀 BasketRoutingServiceV2 ถูก deploy หรือไม่?</h2>";

$serviceFile = __DIR__ . '/../Services/BasketRoutingServiceV2.php';
if (file_exists($serviceFile)) {
    echo "<div class='success'>✅ ไฟล์มีอยู่: " . realpath($serviceFile) . "</div>";
    echo "<div class='info-box'>File size: " . filesize($serviceFile) . " bytes, Last modified: " . date('Y-m-d H:i:s', filemtime($serviceFile)) . "</div>";
    
    // Check if the class can be loaded
    try {
        require_once $serviceFile;
        if (class_exists('BasketRoutingServiceV2')) {
            echo "<div class='success'>✅ Class BasketRoutingServiceV2 loadable</div>";
        } else {
            echo "<div class='highlight'>❌ Class ไม่ถูก define แม้ไฟล์จะมี</div>";
        }
    } catch (Throwable $e) {
        echo "<div class='highlight'>❌ Error loading: " . $e->getMessage() . "</div>";
    }
} else {
    echo "<div class='highlight'>❌ ไฟล์ไม่มี! → Hook ทุกตัวจะ fail (require_once จะ error)</div>";
}

// Check the hook in index.php — does it use require_once correctly?
echo "<h3>6B. ตรวจ Hook Code ใน index.php</h3>";
$indexContent = file_get_contents(__DIR__ . '/../index.php');
$hookCount = substr_count($indexContent, "require_once __DIR__ . '/Services/BasketRoutingServiceV2.php'");
echo "<div class='info-box'>จำนวน require_once BasketRoutingServiceV2 ใน index.php: <strong>$hookCount</strong></div>";

// ============================================================
// SECTION 7: ตรวจ transition_type distribution — ดูว่า routing type ไหนทำงาน
// ============================================================
echo "<h2>7. 📈 Transition Type Distribution — สรุปว่า type ไหนทำงาน</h2>";

$stmt = $pdo->query("
    SELECT transition_type, COUNT(*) as cnt, 
           MIN(created_at) as first_seen, MAX(created_at) as last_seen
    FROM basket_transition_log 
    WHERE created_at >= '$DATE_FILTER'
    GROUP BY transition_type 
    ORDER BY cnt DESC
");
$types = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "<table>";
echo "<tr><th>Transition Type</th><th>Count</th><th>First Seen</th><th>Last Seen</th><th>Source</th></tr>";
foreach ($types as $t) {
    $source = 'unknown';
    if (strpos($t['transition_type'], 'picking') === 0) $source = '🔥 BasketRoutingV2';
    elseif (strpos($t['transition_type'], 'pending') === 0) $source = '🔥 BasketRoutingV2';
    elseif ($t['transition_type'] === 'distribute') $source = 'Distribution/basket_config';
    elseif ($t['transition_type'] === 'reclaim') $source = 'basket_config';
    elseif ($t['transition_type'] === 'transfer') $source = 'basket_config';
    elseif ($t['transition_type'] === 'aging_timeout') $source = 'Cron/Aging';
    elseif ($t['transition_type'] === 'manual') $source = 'API manual';
    elseif ($t['transition_type'] === 'redistribute') $source = 'Distribution V2';
    
    $isRouting = (strpos($t['transition_type'], 'picking') === 0 || strpos($t['transition_type'], 'pending') === 0);
    $class = $isRouting ? 'success' : '';
    echo "<tr><td class='$class'>{$t['transition_type']}</td><td>{$t['cnt']}</td><td>{$t['first_seen']}</td><td>{$t['last_seen']}</td><td>$source</td></tr>";
}
echo "</table>";

echo "<hr>";
echo "<p style='color: #888;'>End of Scope Analysis</p>";
echo "</body></html>";
