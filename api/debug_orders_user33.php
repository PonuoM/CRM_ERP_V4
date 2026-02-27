<?php
/**
 * Debug Script: ตรวจสอบ orders ของ user_id=33 ในเดือนมกราคม
 * ดึงข้อมูลจาก DB โดยตรง เพื่อหาสาเหตุว่าทำไมวันที่ 1-5 ม.ค. หายไป
 * 
 * Usage: php debug_orders_user33.php
 *   หรือ เปิดผ่าน browser: http://localhost/CRM_ERP_V4/api/debug_orders_user33.php
 */

require_once __DIR__ . '/config.php';

header('Content-Type: text/html; charset=utf-8');

$pdo = db_connect();

// ออเดอร์ที่หายไปจาก report ที่ผิด
$missingOrderIds = [
    '20260102-000161EXTERNAL',
    '20260102-000164EXTERNAL',
    '260105-00434noiyb',
    '260105-00437noig9',
    '260105-00446noinf',
    '260105-00455noiiq',
    '260105-00456noi4e',
    '260105-00459noifv',
    '260105-00483noigc',
    '260105-00499noiwn',
    '260105-00527noivv',
];

echo "<html><head><meta charset='utf-8'><title>Debug Orders User 33</title>";
echo "<style>
body { font-family: 'Segoe UI', sans-serif; padding: 20px; background: #1a1a2e; color: #eee; }
h1 { color: #e94560; }
h2 { color: #0f3460; background: #e94560; padding: 10px; border-radius: 5px; }
h3 { color: #16c79a; }
table { border-collapse: collapse; width: 100%; margin: 10px 0 20px; }
th { background: #0f3460; color: #fff; padding: 8px; text-align: left; font-size: 13px; }
td { border: 1px solid #333; padding: 6px 8px; font-size: 13px; }
tr:nth-child(even) { background: #16213e; }
tr:nth-child(odd) { background: #1a1a2e; }
.highlight { background: #e94560 !important; color: #fff; font-weight: bold; }
.warn { color: #f5a623; font-weight: bold; }
.ok { color: #16c79a; }
.bad { color: #e94560; font-weight: bold; }
.box { background: #16213e; border: 1px solid #0f3460; border-radius: 8px; padding: 15px; margin: 15px 0; }
code { background: #0f3460; padding: 2px 6px; border-radius: 3px; }
</style></head><body>";

echo "<h1>🔍 Debug: Orders User ID 33 (หน่อย) — มกราคม 2026</h1>";
echo "<p>Script run at: " . date('Y-m-d H:i:s') . " (Server TZ: " . date_default_timezone_get() . ")</p>";

// ====================================================================
// SECTION 1: MySQL timezone check
// ====================================================================
echo "<h2>1. MySQL Timezone & NOW()</h2>";
$tzResult = $pdo->query("SELECT @@global.time_zone AS global_tz, @@session.time_zone AS session_tz, NOW() AS mysql_now, UTC_TIMESTAMP() AS utc_now")->fetch();
echo "<div class='box'>";
echo "<p>Global Timezone: <code>{$tzResult['global_tz']}</code></p>";
echo "<p>Session Timezone: <code>{$tzResult['session_tz']}</code></p>";
echo "<p>NOW(): <code>{$tzResult['mysql_now']}</code></p>";
echo "<p>UTC_TIMESTAMP(): <code>{$tzResult['utc_now']}</code></p>";
echo "</div>";

// ====================================================================
// SECTION 2: ดึงออเดอร์ทั้งหมดของ user 33 ในช่วง order_date ม.ค.
// ====================================================================
echo "<h2>2. ออเดอร์ทั้งหมดของ creator_id=33 (ม.ค. 2026)</h2>";

// Query wide range to catch any mismatch
$sql = "SELECT o.id, o.order_date, o.delivery_date, o.order_status, o.payment_method, 
               o.total_amount, o.creator_id,
               c.first_name, c.last_name
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.customer_id
        WHERE o.creator_id = 33
          AND o.order_date >= '2025-12-28'
          AND o.order_date <= '2026-02-05'
          AND o.id NOT LIKE '%-1' AND o.id NOT LIKE '%-2' AND o.id NOT LIKE '%-3'
          AND o.id NOT LIKE '%-4' AND o.id NOT LIKE '%-5' AND o.id NOT LIKE '%-6'
          AND o.id NOT LIKE '%-7' AND o.id NOT LIKE '%-8' AND o.id NOT LIKE '%-9'
          AND o.id NOT LIKE '%-10'
        ORDER BY o.order_date ASC, o.id ASC";
$allOrders = $pdo->query($sql)->fetchAll();
echo "<p>พบ <strong>" . count($allOrders) . "</strong> ออเดอร์ (ช่วง 28 ธ.ค. 2025 — 5 ก.พ. 2026)</p>";

echo "<table><tr><th>#</th><th>Order ID</th><th>order_date (RAW)</th><th>YEAR()</th><th>MONTH()</th><th>DAY()</th><th>ลูกค้า</th><th>สถานะ</th><th>ยอด</th><th>หมายเหตุ</th></tr>";

$orderCount = 0;
foreach ($allOrders as $row) {
    $orderCount++;
    $orderId = $row['id'];
    $orderDate = $row['order_date'];
    
    // Parse year from order_date
    $year = date('Y', strtotime($orderDate));
    $month = date('m', strtotime($orderDate));
    $day = date('d', strtotime($orderDate));
    
    // Check anomalies
    $notes = [];
    $rowClass = '';
    
    // Check if this is a missing order
    if (in_array($orderId, $missingOrderIds)) {
        $notes[] = "<span class='bad'>❌ ออเดอร์ที่หายจาก report</span>";
        $rowClass = 'highlight';
    }
    
    // Check year anomaly (Buddhist Era = 2569, should be 2026)
    if ($year != '2026' && $year != '2025') {
        $notes[] = "<span class='warn'>⚠️ ปีผิดปกติ: $year (อาจเป็น พ.ศ.?)</span>";
        $rowClass = 'highlight';
    }
    
    // Check if order_date is outside January 2026
    if ($month != '01' && $year == '2026') {
        // Not January, could be Dec 2025 or Feb 2026
    }
    
    // (no created_at column in orders table)
    
    $customer = trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? ''));
    $noteStr = implode('<br>', $notes) ?: '<span class="ok">✓</span>';
    
    echo "<tr class='$rowClass'>";
    echo "<td>$orderCount</td>";
    echo "<td><code>$orderId</code></td>";
    echo "<td><code>$orderDate</code></td>";
    echo "<td>$year</td><td>$month</td><td>$day</td>";

    echo "<td>$customer</td>";
    echo "<td>{$row['order_status']}</td>";
    echo "<td>" . number_format((float)$row['total_amount']) . "</td>";
    echo "<td>$noteStr</td>";
    echo "</tr>";
}
echo "</table>";

// ====================================================================
// SECTION 3: ตรวจสอบออเดอร์ที่หายไปโดยตรง
// ====================================================================
echo "<h2>3. ตรวจสอบ 11 ออเดอร์ที่หาย — ค้นหาจาก DB โดยตรง</h2>";

$placeholders = implode(',', array_fill(0, count($missingOrderIds), '?'));
$stmt = $pdo->prepare("SELECT o.id, o.order_date, o.order_status, o.creator_id,
                               o.total_amount, o.payment_method,
                               c.first_name, c.last_name
                        FROM orders o
                        LEFT JOIN customers c ON o.customer_id = c.customer_id
                        WHERE o.id IN ($placeholders)
                        ORDER BY o.order_date ASC");
$stmt->execute($missingOrderIds);
$missingResults = $stmt->fetchAll();

echo "<div class='box'>";
if (empty($missingResults)) {
    echo "<p class='bad'>❌ ไม่พบออเดอร์เหล่านี้ในตาราง orders เลย!</p>";
    echo "<p>ลอง search แบบ LIKE:</p>";
    
    // Try searching by LIKE for partial matches
    foreach ($missingOrderIds as $mid) {
        $likeStmt = $pdo->prepare("SELECT id, order_date, creator_id, order_status FROM orders WHERE id LIKE ? LIMIT 5");
        $shortId = substr($mid, 0, 10);
        $likeStmt->execute(["%{$shortId}%"]);
        $likeResults = $likeStmt->fetchAll();
        echo "<p><code>$mid</code> (LIKE %{$shortId}%): ";
        if (empty($likeResults)) {
            echo "<span class='bad'>ไม่พบ</span>";
        } else {
            foreach ($likeResults as $lr) {
                echo "<br>&nbsp;&nbsp;→ <code>{$lr['id']}</code> order_date=<code>{$lr['order_date']}</code> creator_id={$lr['creator_id']} status={$lr['order_status']}";
            }
        }
        echo "</p>";
    }
} else {
    echo "<p class='ok'>✓ พบ " . count($missingResults) . " / " . count($missingOrderIds) . " ออเดอร์</p>";
    echo "<table><tr><th>Order ID</th><th>order_date</th><th>creator_id</th><th>สถานะ</th><th>ลูกค้า</th><th>ยอด</th></tr>";
    foreach ($missingResults as $mr) {
        $customer = trim(($mr['first_name'] ?? '') . ' ' . ($mr['last_name'] ?? ''));
        echo "<tr>";
        echo "<td><code>{$mr['id']}</code></td>";
        echo "<td><code>{$mr['order_date']}</code></td>";
        echo "<td>{$mr['creator_id']}</td>";
        echo "<td>{$mr['order_status']}</td>";
        echo "<td>$customer</td>";
        echo "<td>" . number_format((float)$mr['total_amount']) . "</td>";
        echo "</tr>";
    }
    echo "</table>";
}
echo "</div>";

// ====================================================================
// SECTION 4: สรุปจำนวนออเดอร์ตามวัน (วิเคราะห์ว่า วันไหนหายจริง)
// ====================================================================
echo "<h2>4. สรุปจำนวนออเดอร์ ม.ค. 2026 — แบ่งตามวัน</h2>";

$dailySql = "SELECT DATE(o.order_date) as order_day, 
                    COUNT(*) as total_orders,
                    SUM(CASE WHEN o.order_status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
                    SUM(CASE WHEN o.order_status != 'cancelled' THEN 1 ELSE 0 END) as active
             FROM orders o
             WHERE o.creator_id = 33
               AND o.order_date >= '2026-01-01'
               AND o.order_date <= '2026-01-31 23:59:59'
               AND o.id NOT LIKE '%-1' AND o.id NOT LIKE '%-2' AND o.id NOT LIKE '%-3'
               AND o.id NOT LIKE '%-4' AND o.id NOT LIKE '%-5' AND o.id NOT LIKE '%-6'
               AND o.id NOT LIKE '%-7' AND o.id NOT LIKE '%-8' AND o.id NOT LIKE '%-9'
               AND o.id NOT LIKE '%-10'
             GROUP BY DATE(o.order_date)
             ORDER BY order_day ASC";
$dailyResults = $pdo->query($dailySql)->fetchAll();

echo "<table><tr><th>วันที่</th><th>จำนวนออเดอร์</th><th>Active</th><th>Cancelled</th></tr>";
$totalAll = 0;
foreach ($dailyResults as $dr) {
    $totalAll += (int)$dr['total_orders'];
    $dayClass = '';
    $dayNum = (int)date('d', strtotime($dr['order_day']));
    if ($dayNum >= 1 && $dayNum <= 5) {
        $dayClass = 'highlight';
    }
    echo "<tr class='$dayClass'>";
    echo "<td>{$dr['order_day']}</td>";
    echo "<td>{$dr['total_orders']}</td>";
    echo "<td>{$dr['active']}</td>";
    echo "<td>{$dr['cancelled']}</td>";
    echo "</tr>";
}
echo "<tr><td><strong>รวม</strong></td><td><strong>$totalAll</strong></td><td></td><td></td></tr>";
echo "</table>";

// ====================================================================
// SECTION 5: ตรวจสอบว่ามี order_date ที่เป็น พ.ศ. หรือไม่
// ====================================================================
echo "<h2>5. ตรวจสอบ order_date ที่ปีผิดปกติ (พ.ศ. 2569 etc.)</h2>";

$weirdYearSql = "SELECT o.id, o.order_date, o.creator_id, YEAR(o.order_date) as yr
                 FROM orders o
                 WHERE o.creator_id = 33
                   AND (YEAR(o.order_date) NOT IN (2025, 2026))
                 ORDER BY o.order_date ASC
                 LIMIT 20";
$weirdResults = $pdo->query($weirdYearSql)->fetchAll();

echo "<div class='box'>";
if (empty($weirdResults)) {
    echo "<p class='ok'>✓ ไม่พบ order_date ที่มีปีผิดปกติ (ทุก order เป็นปี 2025-2026)</p>";
} else {
    echo "<p class='bad'>❌ พบ " . count($weirdResults) . " ออเดอร์ที่มีปีผิดปกติ!</p>";
    echo "<table><tr><th>Order ID</th><th>order_date</th><th>YEAR()</th></tr>";
    foreach ($weirdResults as $wr) {
        echo "<tr class='highlight'><td><code>{$wr['id']}</code></td><td><code>{$wr['order_date']}</code></td><td>{$wr['yr']}</td></tr>";
    }
    echo "</table>";
}
echo "</div>";

// ====================================================================
// SECTION 6: Simulate toISOString bug — แสดงว่า Date range เปลี่ยนไปยังไง
// ====================================================================
echo "<h2>6. จำลอง toISOString() Bug</h2>";
echo "<div class='box'>";
echo "<p>เมื่อ user เลือก range <strong>1 ม.ค.</strong> ถึง <strong>31 ม.ค.</strong> ในเบราว์เซอร์ (ICT, UTC+7):</p>";

// Simulate what JS toISOString does
$startLocal = new DateTime('2026-01-01 00:00:00', new DateTimeZone('Asia/Bangkok'));
$endLocal = new DateTime('2026-01-31 23:59:59', new DateTimeZone('Asia/Bangkok'));

$startUTC = clone $startLocal;
$startUTC->setTimezone(new DateTimeZone('UTC'));
$endUTC = clone $endLocal;
$endUTC->setTimezone(new DateTimeZone('UTC'));

echo "<table>";
echo "<tr><th></th><th>Local (ICT)</th><th>toISOString() → UTC</th><th>.split('T')[0]</th></tr>";
echo "<tr><td><strong>Start</strong></td>";
echo "<td>{$startLocal->format('Y-m-d H:i:s')}</td>";
echo "<td>{$startUTC->format('Y-m-d\TH:i:s')}Z</td>";
echo "<td class='bad'>{$startUTC->format('Y-m-d')}</td></tr>";
echo "<tr><td><strong>End</strong></td>";
echo "<td>{$endLocal->format('Y-m-d H:i:s')}</td>";
echo "<td>{$endUTC->format('Y-m-d\TH:i:s')}Z</td>";
echo "<td class='bad'>{$endUTC->format('Y-m-d')}</td></tr>";
echo "</table>";

echo "<p>➡️ API ได้รับ: <code>orderDateStart=<span class='bad'>{$startUTC->format('Y-m-d')}</span></code> &amp; <code>orderDateEnd=<span class='bad'>{$endUTC->format('Y-m-d')}</span></code></p>";
echo "<p>➡️ SQL query: <code>WHERE order_date >= '{$startUTC->format('Y-m-d')} 00:00:00' AND order_date <= '{$endUTC->format('Y-m-d')} 23:59:59'</code></p>";
echo "<p>➡️ ออเดอร์ <strong>31 ม.ค.</strong> จะหายไป, ออเดอร์ <strong>31 ธ.ค. 2025</strong> จะถูกรวมเข้ามาแทน</p>";

// Count orders that would be missed
$actualMissed = $pdo->prepare("SELECT COUNT(*) as cnt FROM orders 
    WHERE creator_id = 33 
    AND DATE(order_date) = '2026-01-31'
    AND id NOT LIKE '%-1' AND id NOT LIKE '%-2' AND id NOT LIKE '%-3'
    AND id NOT LIKE '%-4' AND id NOT LIKE '%-5' AND id NOT LIKE '%-6'
    AND id NOT LIKE '%-7' AND id NOT LIKE '%-8' AND id NOT LIKE '%-9'
    AND id NOT LIKE '%-10'");
$actualMissed->execute();
$missedCount = $actualMissed->fetch()['cnt'];
echo "<p>ออเดอร์วันที่ 31 ม.ค. ที่จะหายไป (จาก toISOString bug): <strong>{$missedCount}</strong> ออเดอร์</p>";

echo "</div>";

// ====================================================================
// SECTION 7: เปรียบเทียบ: สิ่งที่ API ส่งกลับ vs ข้อมูลจริง
// ====================================================================
echo "<h2>7. จำลอง API Query — ก่อนแก้ vs หลังแก้</h2>";

// Before fix (toISOString bug)
$beforeSql = "SELECT COUNT(*) as cnt FROM orders o
              WHERE o.creator_id = 33
              AND o.order_date >= '2025-12-31 00:00:00'
              AND o.order_date <= '2026-01-30 23:59:59'
              AND o.id NOT LIKE '%-1' AND o.id NOT LIKE '%-2' AND o.id NOT LIKE '%-3'
              AND o.id NOT LIKE '%-4' AND o.id NOT LIKE '%-5' AND o.id NOT LIKE '%-6'
              AND o.id NOT LIKE '%-7' AND o.id NOT LIKE '%-8' AND o.id NOT LIKE '%-9'
              AND o.id NOT LIKE '%-10'";
$beforeCount = $pdo->query($beforeSql)->fetch()['cnt'];

// After fix (correct local dates)
$afterSql = "SELECT COUNT(*) as cnt FROM orders o
             WHERE o.creator_id = 33
             AND o.order_date >= '2026-01-01 00:00:00'
             AND o.order_date <= '2026-01-31 23:59:59'
             AND o.id NOT LIKE '%-1' AND o.id NOT LIKE '%-2' AND o.id NOT LIKE '%-3'
             AND o.id NOT LIKE '%-4' AND o.id NOT LIKE '%-5' AND o.id NOT LIKE '%-6'
             AND o.id NOT LIKE '%-7' AND o.id NOT LIKE '%-8' AND o.id NOT LIKE '%-9'
             AND o.id NOT LIKE '%-10'";
$afterCount = $pdo->query($afterSql)->fetch()['cnt'];

echo "<div class='box'>";
echo "<table><tr><th>Scenario</th><th>Date Range (API)</th><th>จำนวนออเดอร์</th></tr>";
echo "<tr><td class='bad'>❌ ก่อนแก้ (toISOString bug)</td><td><code>2025-12-31</code> ถึง <code>2026-01-30</code></td><td>$beforeCount</td></tr>";
echo "<tr><td class='ok'>✅ หลังแก้ (formatLocalDate)</td><td><code>2026-01-01</code> ถึง <code>2026-01-31</code></td><td>$afterCount</td></tr>";
echo "<tr><td><strong>ส่วนต่าง</strong></td><td></td><td><strong>" . ($afterCount - $beforeCount) . "</strong></td></tr>";
echo "</table>";

// Show which orders are gained/lost
$gainedSql = "SELECT id, order_date, order_status FROM orders 
              WHERE creator_id = 33
              AND DATE(order_date) = '2026-01-31'
              AND id NOT LIKE '%-1' AND id NOT LIKE '%-2' AND id NOT LIKE '%-3'
              AND id NOT LIKE '%-4' AND id NOT LIKE '%-5' AND id NOT LIKE '%-6'
              AND id NOT LIKE '%-7' AND id NOT LIKE '%-8' AND id NOT LIKE '%-9'
              AND id NOT LIKE '%-10'
              ORDER BY id";
$gained = $pdo->query($gainedSql)->fetchAll();
if (!empty($gained)) {
    echo "<p class='ok'>✅ ออเดอร์ที่จะได้เพิ่มกลับมา (31 ม.ค.):</p>";
    foreach ($gained as $g) {
        echo "&nbsp;&nbsp;→ <code>{$g['id']}</code> ({$g['order_date']}) - {$g['order_status']}<br>";
    }
}

$lostSql = "SELECT id, order_date, order_status FROM orders 
            WHERE creator_id = 33
            AND DATE(order_date) = '2025-12-31'
            AND id NOT LIKE '%-1' AND id NOT LIKE '%-2' AND id NOT LIKE '%-3'
            AND id NOT LIKE '%-4' AND id NOT LIKE '%-5' AND id NOT LIKE '%-6'
            AND id NOT LIKE '%-7' AND id NOT LIKE '%-8' AND id NOT LIKE '%-9'
            AND id NOT LIKE '%-10'
            ORDER BY id";
$lost = $pdo->query($lostSql)->fetchAll();
if (!empty($lost)) {
    echo "<p class='warn'>⚠️ ออเดอร์ที่จะหายไป (31 ธ.ค. — ไม่ควรอยู่ในเดือน ม.ค.):</p>";
    foreach ($lost as $l) {
        echo "&nbsp;&nbsp;→ <code>{$l['id']}</code> ({$l['order_date']}) - {$l['order_status']}<br>";
    }
} else {
    echo "<p class='ok'>✓ ไม่มีออเดอร์ 31 ธ.ค. ที่จะหลุดออก</p>";
}
echo "</div>";

// ====================================================================
// SECTION 8: ตรวจสอบ EXTERNAL orders ที่ imported เข้ามา
// ====================================================================
echo "<h2>8. ออเดอร์ EXTERNAL (Import) ของ user 33</h2>";

$extSql = "SELECT o.id, o.order_date, o.order_status, o.total_amount,
                  c.first_name, c.last_name
           FROM orders o
           LEFT JOIN customers c ON o.customer_id = c.customer_id
           WHERE o.creator_id = 33
             AND o.id LIKE '%EXTERNAL%'
           ORDER BY o.order_date ASC";
$extResults = $pdo->query($extSql)->fetchAll();

echo "<div class='box'>";
if (empty($extResults)) {
    echo "<p class='warn'>⚠️ ไม่พบออเดอร์ EXTERNAL ใน DB</p>";
} else {
    echo "<p>พบ " . count($extResults) . " ออเดอร์ EXTERNAL:</p>";
    echo "<table><tr><th>Order ID</th><th>order_date</th><th>สถานะ</th><th>ลูกค้า</th><th>ยอด</th></tr>";
    foreach ($extResults as $er) {
        $customer = trim(($er['first_name'] ?? '') . ' ' . ($er['last_name'] ?? ''));
        echo "<tr>";
        echo "<td><code>{$er['id']}</code></td>";
        echo "<td><code>{$er['order_date']}</code></td>";
        echo "<td>{$er['order_status']}</td>";
        echo "<td>$customer</td>";
        echo "<td>" . number_format((float)$er['total_amount']) . "</td>";
        echo "</tr>";
    }
    echo "</table>";
}
echo "</div>";

echo "<h2>9. สรุป</h2>";
echo "<div class='box'>";
echo "<p>🔎 <strong>Root Cause Analysis:</strong></p>";
echo "<ol>";
echo "<li><strong>toISOString() Timezone Bug:</strong> Frontend ใช้ <code>toISOString().split('T')[0]</code> แปลงวันที่ ทำให้วันที่ถอยหลัง 1 วัน (UTC+7 → UTC) 
     <br>→ range <code>1-31 ม.ค.</code> กลายเป็น <code>31 ธ.ค. - 30 ม.ค.</code> → <strong>แก้ไขแล้ว</strong> ✅</li>";
echo "<li><strong>Client-side Re-filtering:</strong> หลังดึง API แล้ว <code>reportData useMemo</code> ยังกรอง order_date อีกครั้ง ซึ่งอาจใช้ date range ที่ถูกต้อง (local) ทำให้ออเดอร์บางวันถูกกรองออก</li>";
echo "<li><strong>ออเดอร์ EXTERNAL (Import):</strong> ออเดอร์วันที่ 2 ม.ค. เป็นออเดอร์ที่ import เข้ามา (ID มี EXTERNAL suffix) — ควรตรวจสอบว่า order_date ถูกเก็บถูกต้องหรือไม่</li>";
echo "</ol>";
echo "</div>";

echo "</body></html>";
