<?php
/**
 * Debug Script: Customer 307448 Basket Routing Investigation
 * 
 * ปัญหา: ลูกค้า 307448 ควรอยู่ basket 39 (Telesale ขายได้) แต่อยู่ basket 38 (ขายไม่ได้)
 * ช่วงเวลา: สั่งซื้อ 31/01/2026, ส่ง 05/02/2026
 * 
 * สคริปต์นี้ตรวจสอบทุกตารางที่เกี่ยวข้องเพื่อหาสาเหตุ
 */
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once __DIR__ . '/../config.php';
$pdo = db_connect();
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$CUSTOMER_ID = 307448;

header('Content-Type: text/html; charset=utf-8');
echo "<html><head><meta charset='utf-8'><title>Debug Customer $CUSTOMER_ID</title>";
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
.warning { background: #f39c12 !important; color: #000; font-weight: bold; }
.info-box { background: #16213e; border-left: 4px solid #00d4ff; padding: 15px; margin: 10px 0; }
.error-box { background: #3d0000; border-left: 4px solid #ff6b6b; padding: 15px; margin: 10px 0; }
.verdict-box { background: #0a3d1a; border-left: 4px solid #2ecc71; padding: 20px; margin: 20px 0; font-size: 16px; }
pre { background: #0d1117; color: #c9d1d9; padding: 15px; border-radius: 6px; overflow-x: auto; }
</style></head><body>";

echo "<h1>🔍 Debug: Customer $CUSTOMER_ID — ทำไมอยู่ 38 แทน 39?</h1>";
echo "<p>Generated: " . date('Y-m-d H:i:s') . "</p>";

// ============================================================
// SECTION 1: Customer Current State
// ============================================================
echo "<h2>1. 📋 สถานะปัจจุบันของลูกค้า</h2>";

$stmt = $pdo->prepare("
    SELECT c.*, 
           bc.basket_key, bc.basket_name, bc.target_page,
           u.first_name as agent_first_name, u.last_name as agent_last_name, u.role as agent_role
    FROM customers c
    LEFT JOIN basket_config bc ON c.current_basket_key = bc.id
    LEFT JOIN users u ON c.assigned_to = u.id
    WHERE c.customer_id = ?
");
$stmt->execute([$CUSTOMER_ID]);
$customer = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$customer) {
    echo "<div class='error-box'>❌ ไม่พบลูกค้า ID: $CUSTOMER_ID</div>";
    exit;
}

echo "<table>";
echo "<tr><th>Field</th><th>Value</th><th>Analysis</th></tr>";

$fields = [
    'customer_id' => ['label' => 'Customer ID', 'analysis' => ''],
    'first_name' => ['label' => 'ชื่อ', 'analysis' => ''],
    'last_name' => ['label' => 'นามสกุล', 'analysis' => ''],
    'phone' => ['label' => 'เบอร์โทร', 'analysis' => ''],
    'current_basket_key' => ['label' => 'Current Basket Key (ID)', 'analysis' => ''],
    'basket_key' => ['label' => 'Basket Key Name', 'analysis' => ''],
    'basket_name' => ['label' => 'Basket Name', 'analysis' => ''],
    'assigned_to' => ['label' => 'Assigned To (User ID)', 'analysis' => ''],
    'agent_first_name' => ['label' => 'Agent Name', 'analysis' => ''],
    'agent_role' => ['label' => 'Agent Role', 'analysis' => ''],
    'date_assigned' => ['label' => 'Date Assigned', 'analysis' => ''],
    'basket_entered_date' => ['label' => 'Basket Entered Date', 'analysis' => ''],
    'date_registered' => ['label' => 'Date Registered', 'analysis' => ''],
    'last_order_date' => ['label' => 'Last Order Date', 'analysis' => ''],
    'total_purchases' => ['label' => 'Total Purchases', 'analysis' => ''],
    'lifecycle_status' => ['label' => 'Lifecycle Status', 'analysis' => ''],
    'previous_assigned_to' => ['label' => 'Previous Assigned To (JSON)', 'analysis' => ''],
];

foreach ($fields as $key => $meta) {
    $val = $customer[$key] ?? 'NULL';
    $class = '';
    $analysis = '';
    
    if ($key === 'current_basket_key') {
        $class = ((int)$val === 38) ? 'highlight' : (((int)$val === 39) ? 'success' : '');
        $analysis = ((int)$val === 38) ? '⚠️ อยู่ 38 (new_customer/ขายไม่ได้) — ควรอยู่ 39!' : '';
    }
    if ($key === 'basket_name' && $val) {
        $analysis = "ปัจจุบันอยู่ถัง: $val";
    }
    if ($key === 'assigned_to') {
        $analysis = (!empty($val) && $val > 0) ? '✅ มี owner' : '❌ ไม่มี owner';
    }
    if ($key === 'agent_role') {
        $isTelesale = (stripos($val ?? '', 'telesale') !== false || stripos($val ?? '', 'tele') !== false);
        $analysis = $isTelesale ? '✅ Owner เป็น Telesale' : '⚠️ Owner ไม่ใช่ Telesale: ' . $val;
    }
    
    echo "<tr><td>{$meta['label']}</td><td class='$class'>$val</td><td>$analysis</td></tr>";
}
echo "</table>";

// ============================================================
// SECTION 2: All Orders for this customer
// ============================================================
echo "<h2>2. 📦 Orders ทั้งหมดของลูกค้า</h2>";

// Detect available columns to avoid SQL errors
$orderCols = 'o.id, o.order_status, o.order_date, o.delivery_date, o.creator_id, o.payment_method, o.total_amount, o.cod_amount, o.payment_status';
try {
    $dbName = $pdo->query("SELECT DATABASE()")->fetchColumn();
    $hasBasketKeyCol = (int)$pdo->query("SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = '$dbName' AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'basket_key_at_sale'")->fetchColumn();
    if ($hasBasketKeyCol) $orderCols .= ', o.basket_key_at_sale';
} catch (Throwable $e) { $hasBasketKeyCol = false; }

$orders = [];
try {
    $stmt = $pdo->prepare("
        SELECT $orderCols,
               u.first_name as creator_first_name, u.last_name as creator_last_name, 
               u.role as creator_role, u.role_id as creator_role_id
        FROM orders o
        LEFT JOIN users u ON o.creator_id = u.id
        WHERE o.customer_id = ?
        ORDER BY o.order_date DESC
    ");
    $stmt->execute([$CUSTOMER_ID]);
    $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (Throwable $e) {
    echo "<div class='error-box'>❌ SQL Error in Section 2: " . htmlspecialchars($e->getMessage()) . "</div>";
}

echo "<div class='info-box'>📊 จำนวน Orders ทั้งหมด: <strong>" . count($orders) . "</strong></div>";

if (!empty($orders)) {
    echo "<table>";
    echo "<tr>
        <th>#</th><th>Order ID</th><th>Status</th><th>Order Date</th><th>Delivery Date</th>
        <th>Creator ID</th><th>Creator Name</th><th>Creator Role</th><th>Role ID</th>
        <th>Payment</th><th>Total</th><th>basket_key_at_sale</th>
    </tr>";
    
    foreach ($orders as $i => $o) {
        $isTelesaleRole = in_array((int)($o['creator_role_id'] ?? 0), [6, 7]);
        $roleClass = $isTelesaleRole ? 'success' : 'warning';
        $statusClass = '';
        if ($o['order_status'] === 'Cancelled') $statusClass = 'highlight';
        elseif (in_array($o['order_status'], ['Picking', 'Shipping', 'Closed', 'Delivered'])) $statusClass = 'success';
        
        echo "<tr>";
        echo "<td>" . ($i+1) . "</td>";
        echo "<td>{$o['id']}</td>";
        echo "<td class='$statusClass'>{$o['order_status']}</td>";
        echo "<td>{$o['order_date']}</td>";
        echo "<td>{$o['delivery_date']}</td>";
        echo "<td>{$o['creator_id']}</td>";
        echo "<td>{$o['creator_first_name']} {$o['creator_last_name']}</td>";
        echo "<td class='$roleClass'>{$o['creator_role']} " . ($isTelesaleRole ? '✅ Telesale' : '❌ Non-Telesale') . "</td>";
        echo "<td class='$roleClass'>{$o['creator_role_id']}</td>";
        echo "<td>{$o['payment_method']}</td>";
        echo "<td>{$o['total_amount']}</td>";
        echo "<td>" . ($o['basket_key_at_sale'] ?? 'N/A') . "</td>";
        echo "</tr>";
    }
    echo "</table>";
}

// ============================================================
// SECTION 3: Order Items — check creator_id per item
// ============================================================
echo "<h2>3. 🛒 Order Items — ตรวจ creator_id ของแต่ละ item</h2>";
echo "<p><em>ระบบเช็ค Telesale involvement จาก creator_id ของทั้ง order และ order_items</em></p>";

foreach ($orders as $o) {
    $items = [];
    try {
        $stmt = $pdo->prepare("
            SELECT oi.id, oi.order_id, oi.parent_order_id, oi.product_name, oi.quantity, 
                   oi.price_per_unit, oi.net_total, oi.creator_id as item_creator_id,
                   u.first_name as item_creator_first, u.last_name as item_creator_last, 
                   u.role as item_creator_role, u.role_id as item_creator_role_id
            FROM order_items oi
            LEFT JOIN users u ON oi.creator_id = u.id
            WHERE oi.parent_order_id = ? OR oi.order_id LIKE ?
            ORDER BY oi.id ASC
        ");
        $stmt->execute([$o['id'], $o['id'] . '%']);
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Throwable $e) {
        echo "<div class='error-box'>❌ SQL Error loading items for {$o['id']}: " . htmlspecialchars($e->getMessage()) . "</div>";
    }
    
    echo "<h3>Order: {$o['id']} (Status: {$o['order_status']}, Date: {$o['order_date']})</h3>";
    
    if (empty($items)) {
        echo "<div class='info-box'>ไม่มี items</div>";
        continue;
    }
    
    echo "<table>";
    echo "<tr><th>Item ID</th><th>Product</th><th>Qty</th><th>Price</th><th>Net</th>
          <th>Item Creator ID</th><th>Creator Name</th><th>Creator Role</th><th>Role ID</th><th>Analysis</th></tr>";
    
    foreach ($items as $item) {
        $isTelesaleItem = in_array((int)($item['item_creator_role_id'] ?? 0), [6, 7]);
        $roleClass = $isTelesaleItem ? 'success' : 'warning';
        $analysis = $isTelesaleItem ? '✅ Telesale created this item' : '❌ Non-Telesale item';
        
        echo "<tr>";
        echo "<td>{$item['id']}</td>";
        echo "<td>{$item['product_name']}</td>";
        echo "<td>{$item['quantity']}</td>";
        echo "<td>{$item['price_per_unit']}</td>";
        echo "<td>{$item['net_total']}</td>";
        echo "<td>{$item['item_creator_id']}</td>";
        echo "<td>{$item['item_creator_first']} {$item['item_creator_last']}</td>";
        echo "<td class='$roleClass'>{$item['item_creator_role']}</td>";
        echo "<td class='$roleClass'>{$item['item_creator_role_id']}</td>";
        echo "<td>$analysis</td>";
        echo "</tr>";
    }
    echo "</table>";
}

// ============================================================
// SECTION 4: Simulate checkTelesaleInvolvement()
// ============================================================
echo "<h2>4. 🔥 Simulation: checkTelesaleInvolvement() — จำลองการตรวจสอบของระบบ</h2>";
echo "<p><em>จำลอง logic จาก BasketRoutingServiceV2.php ที่ตรวจสอบ ณ วันที่สั่งซื้อ</em></p>";

// กรณี A: Telesale สร้าง Order (check within 7 days from order date range)
$stmt = $pdo->prepare("
    SELECT o.id, o.order_status, o.order_date, o.creator_id, u.role, u.role_id,
           u.first_name, u.last_name
    FROM orders o
    JOIN users u ON o.creator_id = u.id
    WHERE o.customer_id = ?
      AND o.order_status IN ('Pending', 'Picking', 'Shipping')
      AND o.order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      AND u.role_id IN (6, 7)
");
$stmt->execute([$CUSTOMER_ID]);
$telesaleOrders = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "<h3>4A. Telesale Orders (NOW - 7 days, status Pending/Picking/Shipping)</h3>";
echo "<div class='info-box'>Query: <code>order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND order_status IN ('Pending','Picking','Shipping') AND role_id IN (6,7)</code></div>";

if (empty($telesaleOrders)) {
    echo "<div class='error-box'>❌ ไม่พบ Telesale orders <strong>ณ ปัจจุบัน</strong> (อาจเพราะ order เก่ากว่า 7 วันแล้ว หรือ status เปลี่ยนเป็น Closed/Delivered)</div>";
} else {
    echo "<div class='success'>✅ พบ " . count($telesaleOrders) . " Telesale orders</div>";
    echo "<pre>" . print_r($telesaleOrders, true) . "</pre>";
}

// กรณี A (Extended): Check ALL orders regardless of date
echo "<h3>4A-Extended: ALL Telesale Orders (ไม่จำกัดเวลา)</h3>";
$stmt = $pdo->prepare("
    SELECT o.id, o.order_status, o.order_date, o.creator_id, u.role, u.role_id,
           u.first_name, u.last_name
    FROM orders o
    JOIN users u ON o.creator_id = u.id
    WHERE o.customer_id = ?
      AND u.role_id IN (6, 7)
    ORDER BY o.order_date DESC
");
$stmt->execute([$CUSTOMER_ID]);
$allTelesaleOrders = $stmt->fetchAll(PDO::FETCH_ASSOC);

if (empty($allTelesaleOrders)) {
    echo "<div class='error-box'>❌ ไม่เคยมี Telesale สร้าง order ให้ลูกค้าคนนี้เลย!</div>";
} else {
    echo "<div class='info-box'>พบ " . count($allTelesaleOrders) . " Telesale orders (ทุกช่วงเวลา)</div>";
    echo "<table>";
    echo "<tr><th>Order ID</th><th>Status</th><th>Order Date</th><th>Creator</th><th>Role</th><th>Role ID</th></tr>";
    foreach ($allTelesaleOrders as $to) {
        echo "<tr>";
        echo "<td>{$to['id']}</td><td>{$to['order_status']}</td><td>{$to['order_date']}</td>";
        echo "<td>{$to['first_name']} {$to['last_name']}</td><td>{$to['role']}</td><td>{$to['role_id']}</td>";
        echo "</tr>";
    }
    echo "</table>";
}

// กรณี B: Telesale สร้าง Items ใน Order ของ Admin
echo "<h3>4B. Telesale Items in ANY Order (ตรวจ item-level involvement)</h3>";
$stmt = $pdo->prepare("
    SELECT oi.id as item_id, oi.parent_order_id, oi.product_name, oi.creator_id as item_creator_id,
           o.order_status, o.order_date, o.creator_id as order_creator_id,
           u.first_name, u.last_name, u.role, u.role_id
    FROM order_items oi
    JOIN orders o ON oi.parent_order_id = o.id
    JOIN users u ON oi.creator_id = u.id
    WHERE o.customer_id = ?
      AND u.role_id IN (6, 7)
    ORDER BY o.order_date DESC
");
$stmt->execute([$CUSTOMER_ID]);
$telesaleItems = $stmt->fetchAll(PDO::FETCH_ASSOC);

if (empty($telesaleItems)) {
    echo "<div class='error-box'>❌ ไม่พบ items ที่ Telesale สร้าง</div>";
} else {
    echo "<div class='info-box'>พบ " . count($telesaleItems) . " items ที่ Telesale สร้าง</div>";
    echo "<table>";
    echo "<tr><th>Item ID</th><th>Order ID</th><th>Product</th><th>Order Status</th><th>Order Date</th>
          <th>Item Creator</th><th>Role</th><th>Role ID</th></tr>";
    foreach ($telesaleItems as $ti) {
        $isActive = in_array($ti['order_status'], ['Pending', 'Picking', 'Shipping']);
        $statusClass = $isActive ? 'success' : 'warning';
        echo "<tr>";
        echo "<td>{$ti['item_id']}</td><td>{$ti['parent_order_id']}</td><td>{$ti['product_name']}</td>";
        echo "<td class='$statusClass'>{$ti['order_status']}</td><td>{$ti['order_date']}</td>";
        echo "<td>{$ti['first_name']} {$ti['last_name']}</td><td>{$ti['role']}</td><td>{$ti['role_id']}</td>";
        echo "</tr>";
    }
    echo "</table>";
}

// ============================================================
// SECTION 5: Simulate AT THE TIME of the order (~Feb 5, 2026)
// ============================================================
echo "<h2>5. ⏰ Simulation ณ วันที่ 05/02/2026 (วันที่ order เป็น Picking)</h2>";
echo "<p><em>จำลองว่าระบบเห็นอะไร ณ วันที่ order เปลี่ยนเป็น Picking (05/02/2026)</em></p>";

$referenceDate = '2026-02-05';

$stmt = $pdo->prepare("
    SELECT o.id, o.order_status, o.order_date, o.creator_id, u.role, u.role_id,
           u.first_name, u.last_name
    FROM orders o
    JOIN users u ON o.creator_id = u.id
    WHERE o.customer_id = ?
      AND o.order_status IN ('Pending', 'Picking', 'Shipping')
      AND o.order_date >= DATE_SUB(?, INTERVAL 7 DAY)
      AND u.role_id IN (6, 7)
");
$stmt->execute([$CUSTOMER_ID, $referenceDate]);
$telesaleOrdersAtTime = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "<h3>5A. Telesale Orders visible at $referenceDate</h3>";
echo "<div class='info-box'>Query: <code>order_status IN ('Pending','Picking','Shipping') AND order_date >= '" . date('Y-m-d', strtotime("$referenceDate -7 days")) . "' AND role_id IN (6,7)</code></div>";

if (empty($telesaleOrdersAtTime)) {
    echo "<div class='error-box'>❌ ไม่พบ Telesale orders ที่ระบบจะเห็น ณ วันที่ $referenceDate</div>";
    echo "<div class='info-box'><strong>🔑 นี่คือสาเหตุที่เป็นไปได้!</strong> — ถ้า ณ วันที่ Picking ระบบไม่เห็น Telesale involvement → ระบบจะย้ายไป 38 แทน 39</div>";
} else {
    echo "<div class='success'>✅ พบ " . count($telesaleOrdersAtTime) . " Telesale orders visible at $referenceDate</div>";
    echo "<pre>" . print_r($telesaleOrdersAtTime, true) . "</pre>";
}

// Check items at that time too
$stmt = $pdo->prepare("
    SELECT oi.id as item_id, oi.parent_order_id, oi.product_name, oi.creator_id,
           o.order_status, o.order_date,
           u.role, u.role_id, u.first_name, u.last_name
    FROM order_items oi
    JOIN orders o ON oi.parent_order_id = o.id
    JOIN users u ON oi.creator_id = u.id
    WHERE o.customer_id = ?
      AND o.order_status IN ('Pending', 'Picking', 'Shipping')
      AND o.order_date >= DATE_SUB(?, INTERVAL 7 DAY)
      AND u.role_id IN (6, 7)
");
$stmt->execute([$CUSTOMER_ID, $referenceDate]);
$telesaleItemsAtTime = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "<h3>5B. Telesale Items visible at $referenceDate</h3>";
if (empty($telesaleItemsAtTime)) {
    echo "<div class='error-box'>❌ ไม่พบ items ที่ Telesale สร้าง ณ วันที่ $referenceDate</div>";
} else {
    echo "<div class='success'>✅ พบ " . count($telesaleItemsAtTime) . " Telesale items</div>";
    echo "<pre>" . print_r($telesaleItemsAtTime, true) . "</pre>";
}

// ============================================================
// SECTION 6: Basket Transition Log
// ============================================================
echo "<h2>6. 📜 Basket Transition Log — ประวัติการย้ายถัง</h2>";

$stmt = $pdo->prepare("
    SELECT btl.*, 
           bc_from.basket_key as from_basket_name,
           bc_to.basket_key as to_basket_name
    FROM basket_transition_log btl
    LEFT JOIN basket_config bc_from ON btl.from_basket_key = bc_from.id
    LEFT JOIN basket_config bc_to ON btl.to_basket_key = bc_to.id
    WHERE btl.customer_id = ?
    ORDER BY btl.id DESC
");
$stmt->execute([$CUSTOMER_ID]);
$logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "<div class='info-box'>📊 จำนวน transition logs: <strong>" . count($logs) . "</strong></div>";

if (!empty($logs)) {
    echo "<table>";
    echo "<tr>
        <th>Log ID</th><th>From</th><th>From Name</th><th>To</th><th>To Name</th>
        <th>Type</th><th>Order ID</th><th>Triggered By</th>
        <th>Old Owner</th><th>New Owner</th><th>Notes</th><th>Created At</th>
    </tr>";
    
    foreach ($logs as $log) {
        $toClass = '';
        if ((int)$log['to_basket_key'] === 38) $toClass = 'highlight';
        elseif ((int)$log['to_basket_key'] === 39) $toClass = 'success';
        
        echo "<tr>";
        echo "<td>{$log['id']}</td>";
        echo "<td>{$log['from_basket_key']}</td>";
        echo "<td>{$log['from_basket_name']}</td>";
        echo "<td class='$toClass'>{$log['to_basket_key']}</td>";
        echo "<td class='$toClass'>{$log['to_basket_name']}</td>";
        echo "<td>{$log['transition_type']}</td>";
        echo "<td>{$log['order_id']}</td>";
        echo "<td>{$log['triggered_by']}</td>";
        echo "<td>{$log['assigned_to_old']}</td>";
        echo "<td>{$log['assigned_to_new']}</td>";
        echo "<td>" . htmlspecialchars($log['notes'] ?? '') . "</td>";
        echo "<td>{$log['created_at']}</td>";
        echo "</tr>";
    }
    echo "</table>";
} else {
    echo "<div class='error-box'>❌ ไม่มี transition log สำหรับลูกค้าคนนี้เลย! 
    <br>→ อาจเกิดจาก: hook ไม่ถูก trigger, INSERT INTO basket_transition_log fail, หรือ order update ไม่ผ่าน BasketRoutingServiceV2</div>";
}

// ============================================================
// SECTION 7: Race Condition Check — Newer orders
// ============================================================
echo "<h2>7. 🏁 Race Condition Check — hasNewerOrderAlreadyProcessed</h2>";

// Find the specific order from Jan 31
$targetOrders = array_filter($orders, function($o) {
    return strpos($o['order_date'], '2026-01') !== false || strpos($o['order_date'], '2026-02') !== false;
});

foreach ($orders as $o) {
    if ($o['order_status'] === 'Cancelled') continue;
    
    $stmt = $pdo->prepare("
        SELECT COUNT(*) as cnt, GROUP_CONCAT(id SEPARATOR ', ') as order_ids
        FROM orders 
        WHERE customer_id = ?
          AND id != ?
          AND order_date > ?
          AND order_status IN ('Picking', 'Shipping', 'Closed', 'Delivered')
    ");
    $stmt->execute([$CUSTOMER_ID, $o['id'], $o['order_date']]);
    $raceCheck = $stmt->fetch(PDO::FETCH_ASSOC);
    
    $hasRace = (int)$raceCheck['cnt'] > 0;
    $class = $hasRace ? 'warning' : '';
    
    echo "<div class='info-box'>";
    echo "Order <strong>{$o['id']}</strong> (date: {$o['order_date']}, status: {$o['order_status']})";
    echo "<br>→ Newer orders ahead: <span class='$class'>" . ($hasRace ? "⚠️ YES ({$raceCheck['cnt']}: {$raceCheck['order_ids']})" : "✅ No") . "</span>";
    if ($hasRace) {
        echo "<br>→ <strong>ถ้า order นี้ trigger routing → จะถูก SKIP เพราะมี order ใหม่กว่าที่ Picking+ แล้ว</strong>";
    }
    echo "</div>";
}

// ============================================================
// SECTION 8: Order Status at time of the target order
// ============================================================
echo "<h2>8. 📋 สถานะ Orders ทั้งหมด ณ ช่วงเวลาสำคัญ</h2>";

echo "<h3>Orders ที่ status = 'Picking' หรือถูกเปลี่ยนเป็น 'Picking'</h3>";
$stmt = $pdo->prepare("
    SELECT o.id, o.order_status, o.order_date, o.delivery_date, o.creator_id,
           u.role, u.role_id, u.first_name, u.last_name
    FROM orders o
    LEFT JOIN users u ON o.creator_id = u.id
    WHERE o.customer_id = ?
    ORDER BY o.order_date DESC
");
$stmt->execute([$CUSTOMER_ID]);
$allOrders = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "<table>";
echo "<tr><th>Order ID</th><th>Status</th><th>Order Date</th><th>Delivery Date</th>
      <th>Creator</th><th>Role</th><th>Role ID</th><th>Is Telesale?</th></tr>";
foreach ($allOrders as $ao) {
    $isTs = in_array((int)($ao['role_id'] ?? 0), [6, 7]);
    echo "<tr>";
    echo "<td>{$ao['id']}</td><td>{$ao['order_status']}</td><td>{$ao['order_date']}</td>";
    echo "<td>{$ao['delivery_date']}</td>";
    echo "<td>{$ao['first_name']} {$ao['last_name']}</td><td>{$ao['role']}</td><td>{$ao['role_id']}</td>";
    echo "<td class='" . ($isTs ? 'success' : 'warning') . "'>" . ($isTs ? '✅ YES' : '❌ NO') . "</td>";
    echo "</tr>";
}
echo "</table>";

// ============================================================
// SECTION 9: Basket Config — Check IDs 38 and 39
// ============================================================
echo "<h2>9. ⚙️ Basket Config — ถัง 38 vs 39</h2>";

$stmt = $pdo->prepare("SELECT * FROM basket_config WHERE id IN (38, 39, 51, 52, 53)");
$stmt->execute();
$configs = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo "<table>";
echo "<tr><th>ID</th><th>basket_key</th><th>basket_name</th><th>target_page</th><th>fail_after_days</th><th>on_fail_basket_key</th><th>linked_basket_key</th></tr>";
foreach ($configs as $cfg) {
    $class = ((int)$cfg['id'] === 38) ? 'highlight' : (((int)$cfg['id'] === 39) ? 'success' : '');
    echo "<tr>";
    echo "<td class='$class'>{$cfg['id']}</td>";
    echo "<td>{$cfg['basket_key']}</td><td>{$cfg['basket_name']}</td>";
    echo "<td>{$cfg['target_page']}</td><td>{$cfg['fail_after_days']}</td>";
    echo "<td>{$cfg['on_fail_basket_key']}</td><td>{$cfg['linked_basket_key']}</td>";
    echo "</tr>";
}
echo "</table>";

// ============================================================
// SECTION 10: Customer assignment history
// ============================================================
echo "<h2>10. 👥 Customer Assignment Check History</h2>";

try {
    $stmt = $pdo->prepare("
        SELECT cac.*, u.first_name, u.last_name, u.role
        FROM customer_assign_check cac
        LEFT JOIN users u ON cac.user_id = u.id
        WHERE cac.customer_id = ?
        ORDER BY cac.id DESC
    ");
    $stmt->execute([$CUSTOMER_ID]);
    $checks = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (!empty($checks)) {
        echo "<table>";
        echo "<tr><th>ID</th><th>User ID</th><th>User Name</th><th>Role</th><th>Company</th></tr>";
        foreach ($checks as $chk) {
            echo "<tr><td>{$chk['id']}</td><td>{$chk['user_id']}</td><td>{$chk['first_name']} {$chk['last_name']}</td><td>{$chk['role']}</td><td>{$chk['company_id']}</td></tr>";
        }
        echo "</table>";
    } else {
        echo "<div class='info-box'>ไม่มี assignment check records</div>";
    }
} catch (Throwable $e) {
    echo "<div class='info-box'>⚠️ Table customer_assign_check ไม่มีหรือ error: " . htmlspecialchars($e->getMessage()) . "</div>";
}

// ============================================================
// SECTION 11: VERDICT — Most Likely Root Cause Analysis
// ============================================================
echo "<h2>11. 🎯 ROOT CAUSE ANALYSIS — สรุปสาเหตุที่เป็นไปได้</h2>";

$scenarios = [];

// Scenario 1: ไม่มี Telesale order creator
$hasTelesaleOrderCreator = false;
foreach ($orders as $o) {
    if (in_array((int)($o['creator_role_id'] ?? 0), [6, 7]) && $o['order_status'] !== 'Cancelled') {
        $hasTelesaleOrderCreator = true;
        break;
    }
}

if (!$hasTelesaleOrderCreator) {
    $scenarios[] = [
        'probability' => 'สูงมาก',
        'title' => 'Order ถูกสร้างโดย Admin/Non-Telesale',
        'detail' => 'ทุก order ของลูกค้าคนนี้ถูกสร้างโดย user ที่ role_id ไม่ใช่ 6 หรือ 7 → ระบบเห็นว่า "ไม่มี Telesale involvement" → ย้ายไป 38 (ขายไม่ได้)',
        'class' => 'error-box'
    ];
}

// Scenario 2: Telesale created but order status changed (Closed/Delivered)
$telesaleOrdersClosedBeforePicking = [];
foreach ($orders as $o) {
    if (in_array((int)($o['creator_role_id'] ?? 0), [6, 7]) && in_array($o['order_status'], ['Closed', 'Delivered', 'Cancelled'])) {
        $telesaleOrdersClosedBeforePicking[] = $o;
    }
}

if (!empty($telesaleOrdersClosedBeforePicking) && empty($telesaleOrdersAtTime)) {
    $scenarios[] = [
        'probability' => 'สูง',
        'title' => 'Telesale order ถูก Closed/Cancelled ก่อนที่ order หลักจะ Picking',
        'detail' => 'มี Telesale order แต่ status เปลี่ยนเป็น Closed/Cancelled ก่อนที่ routing จะ trigger → checkTelesaleInvolvement() ไม่เห็นเพราะ filter เฉพาะ Pending/Picking/Shipping',
        'class' => 'error-box'
    ];
}

// Scenario 3: 7-day window expired
$telesaleOrdersOutOfWindow = [];
foreach ($allTelesaleOrders as $to) {
    $orderDate = new DateTime($to['order_date']);
    $pickingDate = new DateTime($referenceDate);
    $diff = $pickingDate->diff($orderDate)->days;
    if ($diff > 7) {
        $telesaleOrdersOutOfWindow[] = array_merge($to, ['days_diff' => $diff]);
    }
}

if (!empty($telesaleOrdersOutOfWindow)) {
    $scenarios[] = [
        'probability' => 'ปานกลาง',
        'title' => 'Telesale order อยู่นอก 7-day window',
        'detail' => 'Telesale order มี order_date เก่ากว่า 7 วันก่อน Picking date → ระบบไม่นับ',
        'class' => 'warning'
    ];
}

// Scenario 4: Race condition
$scenarios[] = [
    'probability' => 'ปานกลาง',
    'title' => 'Race Condition — Admin order triggered routing ก่อน Telesale order',
    'detail' => 'ถ้า Admin order เป็น Picking ก่อน Telesale order → ระบบย้ายไป 38 ก่อน แล้ว Telesale order มาทีหลังอาจถูก skip เพราะ hasNewerOrderAlreadyProcessed',
    'class' => 'info-box'
];

// Scenario 5: Order creator role changed
$scenarios[] = [
    'probability' => 'ต่ำ',
    'title' => 'User role เปลี่ยนหลัง order creation',
    'detail' => 'ถ้า user ถูกเปลี่ยน role จาก Telesale เป็น Admin หลังจากสร้าง order → ระบบจะเช็ค role ปัจจุบันซึ่งอาจไม่ใช่ Telesale แล้ว',
    'class' => 'info-box'
];

// Scenario 6: triggered_by NULL
if (!empty($logs)) {
    $hasNullTriggeredBy = false;
    foreach ($logs as $log) {
        if ($log['triggered_by'] === null || $log['triggered_by'] === '') {
            $hasNullTriggeredBy = true;
            break;
        }
    }
    if ($hasNullTriggeredBy) {
        $scenarios[] = [
            'probability' => 'Noting',
            'title' => 'triggered_by เป็น NULL ใน transition log',
            'detail' => 'BasketRoutingServiceV2.transitionTo() hardcode triggered_by เป็น NULL (line 513) → ไม่สามารถ trace ได้ว่าใคร trigger แต่ไม่ใช่สาเหตุของปัญหา',
            'class' => 'info-box'
        ];
    }
}

// Scenario 7: Basket entered from 51 (Upsell) with no telesale → goes to 38
$wentFrom51 = false;
foreach ($logs as $log) {
    if ((int)$log['from_basket_key'] === 51 && (int)$log['to_basket_key'] === 38) {
        $wentFrom51 = true;
        $scenarios[] = [
            'probability' => 'สูงมาก',
            'title' => '⚠️ ย้ายจาก 51 (Upsell) → 38 — Rule P2: Basket 51 + No Telesale = 38',
            'detail' => "Log ID {$log['id']}: จาก basket 51 ไป 38 หมายความว่า ณ เวลา Picking → checkTelesaleInvolvement() return FALSE → ย้ายไป 38 (ขายไม่ได้) แทน 39",
            'class' => 'error-box'
        ];
        break;
    }
}

echo "<div class='verdict-box'>";
echo "<h3>🎯 สรุป Root Cause Scenarios</h3>";
foreach ($scenarios as $s) {
    echo "<div class='{$s['class']}' style='margin: 10px 0;'>";
    echo "<strong>[{$s['probability']}] {$s['title']}</strong><br>";
    echo $s['detail'];
    echo "</div>";
}
echo "</div>";

// ============================================================
// SECTION 12: EXACT REPLICA — checkTelesaleInvolvement() จาก BasketRoutingServiceV2
// ============================================================
echo "<h2>12. 🔬 EXACT REPLICA: checkTelesaleInvolvement() — จำลอง SQL จริงจากระบบ</h2>";
echo "<p><em>SQL ด้านล่างเป็น SQL เดียวกันกับใน BasketRoutingServiceV2.php บรรทัด 396-428</em></p>";

// Case A: Telesale สร้าง Order ใหม่ (exact same SQL as line 399-406)
echo "<h3>12A. กรณี A: Telesale สร้าง Order (NOW)</h3>";
$orderStmt = $pdo->prepare("
    SELECT COUNT(*) FROM orders o
    JOIN users u ON o.creator_id = u.id
    WHERE o.customer_id = ?
      AND o.order_status IN ('Pending', 'Picking', 'Shipping')
      AND o.order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      AND u.role_id IN (6, 7)
");
$orderStmt->execute([$CUSTOMER_ID]);
$telesaleOrderCount = (int)$orderStmt->fetchColumn();

$class = $telesaleOrderCount > 0 ? 'success' : 'highlight';
echo "<div class='$class'>Result: <strong>$telesaleOrderCount</strong> " . ($telesaleOrderCount > 0 ? '→ return TRUE ✅' : '→ return FALSE ❌ (ไปต่อ Case B)') . "</div>";

// Case B: Telesale Items
echo "<h3>12B. กรณี B: Telesale เพิ่ม Items เข้า Order ที่ Admin สร้าง (NOW)</h3>";
$itemStmt = $pdo->prepare("
    SELECT COUNT(*) FROM order_items oi
    JOIN orders o ON oi.parent_order_id = o.id
    JOIN users u ON oi.creator_id = u.id
    WHERE o.customer_id = ?
      AND o.order_status IN ('Pending', 'Picking', 'Shipping')
      AND o.order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      AND u.role_id IN (6, 7)
");
$itemStmt->execute([$CUSTOMER_ID]);
$telesaleItemCount = (int)$itemStmt->fetchColumn();

$class = $telesaleItemCount > 0 ? 'success' : 'highlight';
echo "<div class='$class'>Result: <strong>$telesaleItemCount</strong> " . ($telesaleItemCount > 0 ? '→ return TRUE ✅' : '→ return FALSE ❌') . "</div>";

$finalResult = ($telesaleOrderCount > 0 || $telesaleItemCount > 0);
$resultClass = $finalResult ? 'success' : 'highlight';
echo "<div class='$resultClass' style='font-size: 18px; padding: 15px; margin: 10px 0;'>
    <strong>checkTelesaleInvolvement() ณ ปัจจุบัน = " . ($finalResult ? 'TRUE ✅ → ควรไป 39' : 'FALSE ❌ → ไป 38') . "</strong>
</div>";

// Detailed: Show actual matching orders
echo "<h3>12C. Orders ที่ผ่านเงื่อนไข checkTelesaleInvolvement (ณ ปัจจุบัน)</h3>";
$detailStmt = $pdo->prepare("
    SELECT o.id, o.order_status, o.order_date, o.creator_id, u.role, u.role_id, u.first_name, u.last_name,
           DATE_SUB(NOW(), INTERVAL 7 DAY) as window_start,
           NOW() as window_end
    FROM orders o
    JOIN users u ON o.creator_id = u.id
    WHERE o.customer_id = ?
      AND o.order_status IN ('Pending', 'Picking', 'Shipping')
      AND o.order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      AND u.role_id IN (6, 7)
    ORDER BY o.order_date DESC
");
$detailStmt->execute([$CUSTOMER_ID]);
$detailRows = $detailStmt->fetchAll(PDO::FETCH_ASSOC);

if (empty($detailRows)) {
    echo "<div class='error-box'>❌ ไม่มี orders ที่ผ่านทุกเงื่อนไข — นี่อธิบายว่าทำไมอยู่ 38</div>";
    
    // Show WHY each order failed
    echo "<h3>12D. ⚠️ ทำไมแต่ละ order ไม่ผ่าน?</h3>";
    $allOrdersCheck = $pdo->prepare("
        SELECT o.id, o.order_status, o.order_date, o.creator_id, u.role, u.role_id,
               CASE 
                   WHEN o.order_status NOT IN ('Pending', 'Picking', 'Shipping') THEN '❌ Status ไม่ใช่ Pending/Picking/Shipping'
                   WHEN o.order_date < DATE_SUB(NOW(), INTERVAL 7 DAY) THEN '❌ order_date เก่ากว่า 7 วัน'
                   WHEN u.role_id NOT IN (6, 7) THEN '❌ Creator ไม่ใช่ Telesale (role_id ≠ 6,7)'
                   ELSE '✅ ผ่านเงื่อนไข'
               END as fail_reason,
               DATEDIFF(NOW(), o.order_date) as days_ago
        FROM orders o
        LEFT JOIN users u ON o.creator_id = u.id
        WHERE o.customer_id = ?
        ORDER BY o.order_date DESC
    ");
    $allOrdersCheck->execute([$CUSTOMER_ID]);
    $failedOrders = $allOrdersCheck->fetchAll(PDO::FETCH_ASSOC);
    
    echo "<table>";
    echo "<tr><th>Order ID</th><th>Status</th><th>Order Date</th><th>Days Ago</th><th>Creator Role ID</th><th>Why Failed?</th></tr>";
    foreach ($failedOrders as $fo) {
        $failClass = (strpos($fo['fail_reason'], '❌') !== false) ? 'highlight' : 'success';
        echo "<tr>";
        echo "<td>{$fo['id']}</td><td>{$fo['order_status']}</td><td>{$fo['order_date']}</td>";
        echo "<td>{$fo['days_ago']}</td><td>{$fo['role_id']}</td>";
        echo "<td class='$failClass'>{$fo['fail_reason']}</td>";
        echo "</tr>";
    }
    echo "</table>";
} else {
    echo "<table>";
    echo "<tr><th>Order ID</th><th>Status</th><th>Order Date</th><th>Creator</th><th>Role ID</th><th>Window</th></tr>";
    foreach ($detailRows as $dr) {
        echo "<tr><td>{$dr['id']}</td><td>{$dr['order_status']}</td><td>{$dr['order_date']}</td>";
        echo "<td>{$dr['first_name']} {$dr['last_name']}</td><td>{$dr['role_id']}</td>";
        echo "<td>{$dr['window_start']} ~ {$dr['window_end']}</td></tr>";
    }
    echo "</table>";
}

// ============================================================
// SECTION 13: TIME-SHIFTED Simulation — What did the system see on Feb 5?
// ============================================================
echo "<h2>13. ⏳ Time-Shifted Simulation: ระบบเห็นอะไร ณ 05/02/2026?</h2>";
echo "<p><em>จำลอง NOW() = '2026-02-05 12:00:00' เพื่อดูว่า checkTelesaleInvolvement จะ return อะไร</em></p>";

$simDate = '2026-02-05 12:00:00';
$simWindow = '2026-01-29 12:00:00'; // 7 days before

echo "<div class='info-box'>Simulated NOW() = <code>$simDate</code> → Window start = <code>$simWindow</code></div>";

// Case A simulated
$simOrderStmt = $pdo->prepare("
    SELECT o.id, o.order_status, o.order_date, o.creator_id, u.role, u.role_id, u.first_name, u.last_name
    FROM orders o
    JOIN users u ON o.creator_id = u.id
    WHERE o.customer_id = ?
      AND o.order_date >= ?
      AND u.role_id IN (6, 7)
    ORDER BY o.order_date DESC
");
$simOrderStmt->execute([$CUSTOMER_ID, $simWindow]);
$simOrders = $simOrderStmt->fetchAll(PDO::FETCH_ASSOC);

echo "<h3>13A. Orders ที่ Telesale สร้าง ในช่วง $simWindow ~ $simDate</h3>";
if (empty($simOrders)) {
    echo "<div class='error-box'>❌ ไม่พบ — Telesale ไม่ได้สร้าง order ในช่วง 7 วันก่อน 05/02/2026</div>";
} else {
    echo "<table>";
    echo "<tr><th>Order ID</th><th>Current Status</th><th>Order Date</th><th>Creator</th><th>Role ID</th><th>Was Active on Feb 5?</th></tr>";
    foreach ($simOrders as $so) {
        // But what was the status on Feb 5? We can't know for sure, but we can guess
        $isActiveNow = in_array($so['order_status'], ['Pending', 'Picking', 'Shipping']);
        $wasLikelyActive = in_array($so['order_status'], ['Pending', 'Picking', 'Shipping', 'Closed', 'Delivered']);
        $statusNote = $isActiveNow 
            ? '<span class="success">Still active now → likely active on Feb 5 too</span>' 
            : '<span class="warning">Now ' . $so['order_status'] . ' → status on Feb 5 unknown (could have been Pending/Picking then)</span>';
        
        echo "<tr>";
        echo "<td>{$so['id']}</td><td>{$so['order_status']}</td><td>{$so['order_date']}</td>";
        echo "<td>{$so['first_name']} {$so['last_name']}</td><td>{$so['role_id']}</td>";
        echo "<td>$statusNote</td>";
        echo "</tr>";
    }
    echo "</table>";
    
    echo "<div class='info-box'><strong>⚠️ สำคัญ:</strong> แม้จะมี Telesale orders ในช่วงเวลานี้ 
    แต่ checkTelesaleInvolvement() ยังต้องการ <code>order_status IN ('Pending', 'Picking', 'Shipping')</code>
    <br>→ ถ้า ณ วันที่ 05/02/2026 order เหล่านี้เป็น 'Cancelled' อยู่ → ก็จะไม่นับ!</div>";
}

// ============================================================
// SECTION 14: getUserRole() — Order creator's role check
// ============================================================
echo "<h2>14. 👤 getUserRole() — ตรวจ role ของ order creator ปัจจุบัน</h2>";
echo "<p><em>BasketRoutingServiceV2 เช็ค role_id จาก users table → ถ้า role เปลี่ยนหลังจากสร้าง order → ผลลัพธ์เปลี่ยน</em></p>";

foreach ($orders as $o) {
    if ($o['order_status'] === 'Cancelled') continue;
    
    $roleStmt = $pdo->prepare("SELECT id, role, role_id, first_name, last_name, status FROM users WHERE id = ?");
    $roleStmt->execute([$o['creator_id']]);
    $creator = $roleStmt->fetch(PDO::FETCH_ASSOC);
    
    $isTs = $creator && in_array((int)($creator['role_id'] ?? 0), [6, 7]);
    $class = $isTs ? 'success' : 'warning';
    
    echo "<div class='info-box'>";
    echo "Order <strong>{$o['id']}</strong> → creator_id = {$o['creator_id']}";
    echo "<br>Current role: <span class='$class'>{$creator['role']} (role_id: {$creator['role_id']})" . ($isTs ? ' ✅ Telesale' : ' ❌ NOT Telesale') . "</span>";
    echo "<br>User status: {$creator['status']}";
    echo "<br>Name: {$creator['first_name']} {$creator['last_name']}";
    echo "</div>";
}

echo "<hr>";
echo "<p style='color: #888;'>End of Debug Report — Customer $CUSTOMER_ID</p>";
echo "</body></html>";
?>
