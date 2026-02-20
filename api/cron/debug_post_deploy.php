<?php
/**
 * Debug: เช็คว่าหลัง deploy routing (6 ก.พ. 2026) มีเคสที่มีปัญหาหรือไม่
 */
error_reporting(E_ALL);
ini_set('display_errors', 1);

require_once __DIR__ . '/../config.php';
$pdo = db_connect();
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

header('Content-Type: text/html; charset=utf-8');
echo "<html><head><meta charset='utf-8'><title>Post-Deploy Check</title>";
echo "<style>
body { font-family: 'Segoe UI', monospace; background: #1a1a2e; color: #e0e0e0; padding: 20px; }
h1 { color: #00d4ff; } h2 { color: #ffd700; margin-top: 30px; } h3 { color: #ff6b6b; }
table { border-collapse: collapse; width: 100%; margin: 10px 0 20px 0; }
th { background: #16213e; color: #00d4ff; padding: 8px 12px; text-align: left; border: 1px solid #333; }
td { background: #0f3460; padding: 8px 12px; border: 1px solid #333; }
.highlight { background: #ff6b6b !important; color: #fff; font-weight: bold; }
.success { background: #2ecc71 !important; color: #000; font-weight: bold; }
.warning { background: #f39c12 !important; color: #000; }
.info-box { background: #16213e; border-left: 4px solid #00d4ff; padding: 15px; margin: 10px 0; }
.error-box { background: #3d0000; border-left: 4px solid #ff6b6b; padding: 15px; margin: 10px 0; }
</style></head><body>";

$DEPLOY_DATE = '2026-02-06';
echo "<h1>🔍 Post-Deploy Check: หลัง $DEPLOY_DATE มีเคสที่มีปัญหาหรือไม่?</h1>";
echo "<p>Generated: " . date('Y-m-d H:i:s') . "</p>";

// ============================================================
// SECTION 1: ลูกค้าอยู่ basket 38 + Telesale order หลัง deploy
// ============================================================
echo "<h2>1. ลูกค้าอยู่ basket 38 + Telesale order สร้างหลัง $DEPLOY_DATE</h2>";
echo "<p><em>เงื่อนไข: basket=38, Telesale สร้าง order (role 6,7), status Picking/Shipping/Closed/Delivered, order_date >= $DEPLOY_DATE</em></p>";

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
      AND o.order_date >= ?
      AND u.role_id IN (6, 7)
      AND o.order_status IN ('Picking', 'Shipping', 'Closed', 'Delivered')
    ORDER BY o.order_date DESC
");
$stmt->execute([$DEPLOY_DATE]);
$postDeploy = $stmt->fetchAll(PDO::FETCH_ASSOC);

if (!empty($postDeploy)) {
    echo "<div class='error-box'>⚠️ พบ <strong>" . count($postDeploy) . "</strong> records หลัง deploy!</div>";
    echo "<table>";
    echo "<tr>
        <th>#</th><th>Customer ID</th><th>ชื่อ</th><th>Basket</th><th>Agent</th>
        <th>Order ID</th><th>Order Status</th><th>Order Date</th><th>Payment</th>
        <th>Creator</th><th>Role ID</th><th>Basket Entered</th>
    </tr>";
    foreach ($postDeploy as $i => $a) {
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

    // สำหรับแต่ละ case: เช็คว่ามี transition log ไป 39 แล้วกลับมา 38 หรือไม่
    echo "<h3>1B. ตรวจ transition log ของแต่ละ case</h3>";
    $uniqueCustomers = array_unique(array_column($postDeploy, 'customer_id'));
    foreach ($uniqueCustomers as $cid) {
        $logStmt = $pdo->prepare("
            SELECT btl.id, btl.from_basket_key, btl.to_basket_key, btl.transition_type, 
                   btl.order_id, btl.notes, btl.created_at,
                   bc_from.basket_key as from_name, bc_to.basket_key as to_name
            FROM basket_transition_log btl
            LEFT JOIN basket_config bc_from ON btl.from_basket_key = bc_from.id
            LEFT JOIN basket_config bc_to ON btl.to_basket_key = bc_to.id
            WHERE btl.customer_id = ?
            ORDER BY btl.created_at DESC
            LIMIT 10
        ");
        $logStmt->execute([$cid]);
        $logs = $logStmt->fetchAll(PDO::FETCH_ASSOC);

        $hasRoutingTo39 = false;
        foreach ($logs as $l) {
            if ((int)$l['to_basket_key'] === 39 && strpos($l['transition_type'], 'picking') === 0) {
                $hasRoutingTo39 = true;
                break;
            }
        }

        echo "<div class='info-box'>";
        echo "<strong>Customer $cid</strong> — เคย routing ไป 39? " . ($hasRoutingTo39 ? "<span class='success'>✅ YES (แล้วกลับมา 38)</span>" : "<span class='highlight'>❌ NO — ไม่เคยถูก route เลย</span>");
        echo "<br>";
        foreach ($logs as $l) {
            $cls = ((int)$l['to_basket_key'] === 39) ? 'success' : '';
            echo "<span class='$cls'>[{$l['created_at']}] {$l['from_basket_key']}({$l['from_name']}) → {$l['to_basket_key']}({$l['to_name']}) — {$l['transition_type']} — {$l['order_id']}</span><br>";
        }
        echo "</div>";
    }
} else {
    echo "<div class='success' style='font-size: 18px; padding: 20px;'>✅ ไม่พบเคสที่มีปัญหาหลัง $DEPLOY_DATE — Routing ทำงานถูกต้อง!</div>";
}

// ============================================================
// SECTION 2: เปรียบเทียบก่อน/หลัง deploy
// ============================================================
echo "<h2>2. เปรียบเทียบ: ก่อน vs หลัง deploy</h2>";

$preCount = $pdo->query("
    SELECT COUNT(DISTINCT c.customer_id) 
    FROM customers c
    JOIN orders o ON o.customer_id = c.customer_id
    JOIN users u ON o.creator_id = u.id
    WHERE c.current_basket_key = 38
      AND o.order_date < '$DEPLOY_DATE'
      AND o.order_date >= '2026-01-29'
      AND u.role_id IN (6, 7)
      AND o.order_status IN ('Picking', 'Shipping', 'Closed', 'Delivered')
")->fetchColumn();

$postCount = $pdo->query("
    SELECT COUNT(DISTINCT c.customer_id) 
    FROM customers c
    JOIN orders o ON o.customer_id = c.customer_id
    JOIN users u ON o.creator_id = u.id
    WHERE c.current_basket_key = 38
      AND o.order_date >= '$DEPLOY_DATE'
      AND u.role_id IN (6, 7)
      AND o.order_status IN ('Picking', 'Shipping', 'Closed', 'Delivered')
")->fetchColumn();

echo "<table>";
echo "<tr><th>ช่วงเวลา</th><th>ลูกค้าที่มีปัญหา</th><th>สถานะ</th></tr>";
echo "<tr><td>ก่อน deploy (29 ม.ค. - 5 ก.พ.)</td><td class='highlight'>$preCount คน</td><td>❌ ไม่มี routing hooks</td></tr>";
echo "<tr><td>หลัง deploy (6 ก.พ. เป็นต้นไป)</td><td class='" . ($postCount == 0 ? 'success' : 'warning') . "'>$postCount คน</td><td>" . ($postCount == 0 ? '✅ Routing ทำงานปกติ' : '⚠️ ยังมีปัญหา') . "</td></tr>";
echo "</table>";

if ($postCount == 0) {
    echo "<div class='success' style='font-size: 16px; padding: 15px;'>";
    echo "🎯 <strong>ยืนยัน:</strong> ปัญหาเกิดเฉพาะช่วงก่อน deploy เท่านั้น<br>";
    echo "→ แก้ไขโดยย้ายข้อมูล $preCount ลูกค้าไป basket 39 ได้เลย ไม่ต้องแก้ code";
    echo "</div>";
}

echo "</body></html>";
