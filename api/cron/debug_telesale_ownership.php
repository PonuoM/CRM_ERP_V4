<?php
/**
 * Debug: ตรวจสอบการถือครองลูกค้าของ Telesale (Role 6, 7)
 * ย้อนหลัง 90 วัน — ลูกค้าที่ Telesale ขายได้ อยู่กับเขาหรือไม่?
 */
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once __DIR__ . '/../config.php';
$pdo = db_connect();
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

header('Content-Type: text/html; charset=utf-8');
echo "<html><head><meta charset='utf-8'><title>Telesale Ownership Check - 90 Days</title>";
echo "<style>
body { font-family: 'Segoe UI', sans-serif; background: #1a1a2e; color: #e0e0e0; padding: 20px; }
h1 { color: #00d4ff; border-bottom: 2px solid #00d4ff; padding-bottom: 10px; }
h2 { color: #ffd700; margin-top: 30px; }
h3 { color: #ff6b6b; }
table { border-collapse: collapse; width: 100%; margin: 10px 0 20px 0; font-size: 13px; }
th { background: #16213e; color: #00d4ff; padding: 6px 10px; text-align: left; border: 1px solid #333; position: sticky; top: 0; }
td { background: #0f3460; padding: 6px 10px; border: 1px solid #333; }
.highlight { background: #ff6b6b !important; color: #fff; font-weight: bold; }
.success { background: #2ecc71 !important; color: #000; font-weight: bold; }
.warning { background: #f39c12 !important; color: #000; }
.mismatch { background: #e74c3c !important; color: #fff; }
.unassigned { background: #9b59b6 !important; color: #fff; }
.info-box { background: #16213e; border-left: 4px solid #00d4ff; padding: 15px; margin: 10px 0; }
.error-box { background: #3d0000; border-left: 4px solid #ff6b6b; padding: 15px; margin: 10px 0; }
.summary-card { display: inline-block; background: #16213e; border: 2px solid #333; border-radius: 10px; padding: 20px; margin: 10px; min-width: 200px; text-align: center; }
.summary-card .number { font-size: 36px; font-weight: bold; }
.summary-card .label { color: #888; font-size: 14px; margin-top: 5px; }
</style></head><body>";

$DAYS = 90;
$dateFrom = date('Y-m-d', strtotime("-{$DAYS} days"));
echo "<h1>🔍 Telesale Ownership Check — ย้อนหลัง {$DAYS} วัน (ตั้งแต่ {$dateFrom})</h1>";
echo "<p>Generated: " . date('Y-m-d H:i:s') . "</p>";

// ============================================================
// SECTION 1: สรุปภาพรวม
// ============================================================
echo "<h2>1. 📊 สรุปภาพรวม</h2>";

$stmt = $pdo->prepare("
    SELECT 
        o.creator_id,
        u_creator.first_name as creator_name,
        u_creator.last_name as creator_lastname,
        u_creator.role_id,
        c.customer_id,
        c.first_name as cust_first,
        c.last_name as cust_last,
        c.phone as cust_phone,
        c.assigned_to,
        c.current_basket_key,
        c.basket_entered_date,
        u_owner.first_name as owner_name,
        u_owner.last_name as owner_lastname,
        u_owner.role_id as owner_role_id,
        o.id as order_id,
        o.order_status,
        o.order_date,
        o.payment_method,
        CASE 
            WHEN c.assigned_to IS NULL OR c.assigned_to = 0 THEN 'NO_OWNER'
            WHEN c.assigned_to = o.creator_id THEN 'CORRECT'
            ELSE 'MISMATCH'
        END as ownership_status
    FROM orders o
    JOIN users u_creator ON o.creator_id = u_creator.id
    JOIN customers c ON o.customer_id = c.customer_id
    LEFT JOIN users u_owner ON c.assigned_to = u_owner.id
    WHERE u_creator.role_id IN (6, 7)
      AND o.order_date >= ?
      AND o.order_status IN ('Picking', 'Shipping', 'Closed', 'Delivered')
      AND o.company_id = 1
    ORDER BY o.creator_id, o.order_date DESC
");
$stmt->execute([$dateFrom]);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Count unique customers per status
$correctCount = 0;
$mismatchCount = 0;
$noOwnerCount = 0;
$uniqueCustomers = [];
$mismatchList = [];
$noOwnerList = [];

foreach ($rows as $r) {
    $key = $r['customer_id'];
    if (isset($uniqueCustomers[$key])) continue; // นับแค่ครั้งแรก (order ล่าสุด)
    $uniqueCustomers[$key] = $r;
    
    switch ($r['ownership_status']) {
        case 'CORRECT': $correctCount++; break;
        case 'MISMATCH': $mismatchCount++; $mismatchList[] = $r; break;
        case 'NO_OWNER': $noOwnerCount++; $noOwnerList[] = $r; break;
    }
}

$totalCustomers = count($uniqueCustomers);

echo "<div style='text-align: center;'>";
echo "<div class='summary-card'><div class='number' style='color: #00d4ff;'>$totalCustomers</div><div class='label'>ลูกค้าที่ Telesale ขายได้ (90 วัน)</div></div>";
echo "<div class='summary-card'><div class='number' style='color: #2ecc71;'>$correctCount</div><div class='label'>✅ อยู่กับผู้ขาย (ถูกต้อง)</div></div>";
echo "<div class='summary-card'><div class='number' style='color: #e74c3c;'>$mismatchCount</div><div class='label'>❌ อยู่กับคนอื่น</div></div>";
echo "<div class='summary-card'><div class='number' style='color: #9b59b6;'>$noOwnerCount</div><div class='label'>⚠️ ไม่มีเจ้าของ</div></div>";
echo "</div>";

$correctPct = $totalCustomers > 0 ? round(($correctCount / $totalCustomers) * 100, 1) : 0;
echo "<div class='info-box'>Ownership Accuracy: <strong>{$correctPct}%</strong> ({$correctCount}/{$totalCustomers})</div>";

// ============================================================
// SECTION 2: ลูกค้าที่อยู่กับคนอื่น (MISMATCH)
// ============================================================
echo "<h2>2. ❌ ลูกค้าที่ Telesale ขายได้ แต่อยู่กับคนอื่น ({$mismatchCount} คน)</h2>";

if (!empty($mismatchList)) {
    echo "<table>";
    echo "<tr>
        <th>#</th><th>Customer ID</th><th>ชื่อลูกค้า</th><th>โทร</th>
        <th>ผู้ขาย (Telesale)</th><th>Role</th>
        <th>เจ้าของปัจจุบัน</th><th>Owner Role</th>
        <th>Order ID</th><th>Order Status</th><th>วันที่ขาย</th>
        <th>Basket</th>
    </tr>";
    foreach ($mismatchList as $i => $r) {
        echo "<tr>";
        echo "<td>" . ($i+1) . "</td>";
        echo "<td>{$r['customer_id']}</td>";
        echo "<td>{$r['cust_first']} {$r['cust_last']}</td>";
        echo "<td>{$r['cust_phone']}</td>";
        echo "<td class='warning'>{$r['creator_name']} {$r['creator_lastname']}</td>";
        echo "<td>{$r['role_id']}</td>";
        echo "<td class='mismatch'>{$r['owner_name']} {$r['owner_lastname']}</td>";
        echo "<td>{$r['owner_role_id']}</td>";
        echo "<td>{$r['order_id']}</td>";
        echo "<td>{$r['order_status']}</td>";
        echo "<td>{$r['order_date']}</td>";
        echo "<td>{$r['current_basket_key']}</td>";
        echo "</tr>";
    }
    echo "</table>";
} else {
    echo "<div class='success' style='padding: 15px;'>✅ ไม่พบลูกค้าที่อยู่กับคนอื่น</div>";
}

// ============================================================
// SECTION 3: ลูกค้าที่ไม่มีเจ้าของ (NO_OWNER)
// ============================================================
echo "<h2>3. ⚠️ ลูกค้าที่ Telesale ขายได้ แต่ไม่มีเจ้าของ ({$noOwnerCount} คน)</h2>";

if (!empty($noOwnerList)) {
    echo "<table>";
    echo "<tr>
        <th>#</th><th>Customer ID</th><th>ชื่อลูกค้า</th><th>โทร</th>
        <th>ผู้ขาย (Telesale)</th><th>Role</th>
        <th>Order ID</th><th>Order Status</th><th>วันที่ขาย</th>
        <th>Basket</th>
    </tr>";
    foreach ($noOwnerList as $i => $r) {
        echo "<tr>";
        echo "<td>" . ($i+1) . "</td>";
        echo "<td>{$r['customer_id']}</td>";
        echo "<td>{$r['cust_first']} {$r['cust_last']}</td>";
        echo "<td>{$r['cust_phone']}</td>";
        echo "<td class='warning'>{$r['creator_name']} {$r['creator_lastname']}</td>";
        echo "<td>{$r['role_id']}</td>";
        echo "<td>{$r['order_id']}</td>";
        echo "<td>{$r['order_status']}</td>";
        echo "<td>{$r['order_date']}</td>";
        echo "<td>{$r['current_basket_key']}</td>";
        echo "</tr>";
    }
    echo "</table>";
} else {
    echo "<div class='success' style='padding: 15px;'>✅ ไม่พบลูกค้าที่ไม่มีเจ้าของ</div>";
}

// ============================================================
// SECTION 4: แยกตาม Telesale แต่ละคน
// ============================================================
echo "<h2>4. 👤 สรุปแยกตาม Telesale แต่ละคน</h2>";

$byTelesale = [];
foreach ($uniqueCustomers as $r) {
    $key = $r['creator_id'];
    if (!isset($byTelesale[$key])) {
        $byTelesale[$key] = [
            'name' => $r['creator_name'] . ' ' . $r['creator_lastname'],
            'role_id' => $r['role_id'],
            'correct' => 0,
            'mismatch' => 0,
            'no_owner' => 0,
            'total' => 0,
            'mismatch_details' => []
        ];
    }
    $byTelesale[$key]['total']++;
    switch ($r['ownership_status']) {
        case 'CORRECT': $byTelesale[$key]['correct']++; break;
        case 'MISMATCH': 
            $byTelesale[$key]['mismatch']++;
            $byTelesale[$key]['mismatch_details'][] = $r;
            break;
        case 'NO_OWNER': $byTelesale[$key]['no_owner']++; break;
    }
}

// Sort by mismatch count (most problems first)
uasort($byTelesale, function($a, $b) {
    return ($b['mismatch'] + $b['no_owner']) - ($a['mismatch'] + $a['no_owner']);
});

echo "<table>";
echo "<tr><th>Telesale</th><th>Role</th><th>ลูกค้าขายได้</th><th>✅ อยู่กับเขา</th><th>❌ อยู่คนอื่น</th><th>⚠️ ไม่มีเจ้าของ</th><th>Accuracy</th></tr>";
foreach ($byTelesale as $tid => $t) {
    $pct = $t['total'] > 0 ? round(($t['correct'] / $t['total']) * 100, 1) : 0;
    $pctClass = $pct >= 90 ? 'success' : ($pct >= 70 ? 'warning' : 'highlight');
    echo "<tr>";
    echo "<td>{$t['name']}</td>";
    echo "<td>{$t['role_id']}</td>";
    echo "<td>{$t['total']}</td>";
    echo "<td class='success'>{$t['correct']}</td>";
    echo "<td" . ($t['mismatch'] > 0 ? " class='mismatch'" : "") . ">{$t['mismatch']}</td>";
    echo "<td" . ($t['no_owner'] > 0 ? " class='unassigned'" : "") . ">{$t['no_owner']}</td>";
    echo "<td class='$pctClass'>{$pct}%</td>";
    echo "</tr>";
}
echo "</table>";

// ============================================================
// SECTION 5: รายละเอียด MISMATCH — ใครอยู่กับใคร
// ============================================================
echo "<h2>5. 🔍 รายละเอียด: ลูกค้า MISMATCH — Telesale ขาย แต่อยู่กับคนอื่น</h2>";

foreach ($byTelesale as $tid => $t) {
    if (empty($t['mismatch_details'])) continue;
    
    echo "<h3>👤 {$t['name']} (ID: $tid) — {$t['mismatch']} ลูกค้าอยู่กับคนอื่น</h3>";
    echo "<table>";
    echo "<tr><th>Customer</th><th>ชื่อ</th><th>ผู้ขาย</th><th>เจ้าของปัจจุบัน</th><th>Order</th><th>วันที่ขาย</th><th>สถานะ</th><th>Basket</th></tr>";
    foreach ($t['mismatch_details'] as $d) {
        echo "<tr>";
        echo "<td>{$d['customer_id']}</td>";
        echo "<td>{$d['cust_first']} {$d['cust_last']}</td>";
        echo "<td class='warning'>{$d['creator_name']}</td>";
        echo "<td class='mismatch'>{$d['owner_name']} {$d['owner_lastname']}</td>";
        echo "<td>{$d['order_id']}</td>";
        echo "<td>{$d['order_date']}</td>";
        echo "<td>{$d['order_status']}</td>";
        echo "<td>{$d['current_basket_key']}</td>";
        echo "</tr>";
    }
    echo "</table>";
}

echo "<hr>";
echo "<p style='color: #888;'>End of Ownership Check</p>";
echo "</body></html>";
