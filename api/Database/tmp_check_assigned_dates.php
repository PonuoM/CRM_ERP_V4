<?php
header('Content-Type: text/plain; charset=utf-8');

$conn = new mysqli('202.183.192.218', 'primacom_bloguser', 'pJnL53Wkhju2LaGPytw8', 'primacom_mini_erp');
$conn->set_charset("utf8mb4");

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

function safe_query($conn, $sql) {
    $result = $conn->query($sql);
    if (!$result) {
        echo "  SQL Error: " . $conn->error . "\n";
        echo "  Query: " . substr($sql, 0, 300) . "\n";
        return false;
    }
    return $result;
}

echo "=== วิเคราะห์ assigned_to ผิดปกติ แยกตามวัน & api_source ===\n\n";

// 1. แยกตามวัน - assigned_to เปลี่ยนไป non-role 6/7
echo "--- 1. จำนวนครั้งที่ assigned_to เปลี่ยนไป non-Telesale แยกตามวัน (ล่าสุด 30 วัน) ---\n";
$sql = "
SELECT DATE(cal.created_at) AS change_date,
       cal.api_source,
       COUNT(*) AS cnt
FROM customer_audit_log cal
INNER JOIN users u_new ON u_new.id = CAST(cal.new_value AS UNSIGNED)
WHERE cal.field_name = 'assigned_to'
  AND u_new.role_id NOT IN (6, 7)
  AND cal.new_value != '0'
  AND cal.new_value IS NOT NULL
  AND cal.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY DATE(cal.created_at), cal.api_source
ORDER BY change_date DESC, cnt DESC
";
$result = safe_query($conn, $sql);
if ($result) {
    $currentDate = null;
    $dayTotal = 0;
    while ($row = $result->fetch_assoc()) {
        if ($currentDate !== $row['change_date']) {
            if ($currentDate !== null) echo "    >> รวมวันนี้: $dayTotal ครั้ง\n\n";
            $currentDate = $row['change_date'];
            $dayTotal = 0;
            echo "  === {$row['change_date']} ===\n";
        }
        echo "    {$row['api_source']}: {$row['cnt']} ครั้ง\n";
        $dayTotal += $row['cnt'];
    }
    if ($currentDate !== null) echo "    >> รวมวันนี้: $dayTotal ครั้ง\n";
}
echo "\n";

// 2. สรุปรวมตาม api_source
echo "--- 2. สรุปรวมตาม api_source (ทั้งหมด) ---\n";
$sql = "
SELECT cal.api_source, COUNT(*) AS cnt,
       MIN(DATE(cal.created_at)) AS first_seen,
       MAX(DATE(cal.created_at)) AS last_seen
FROM customer_audit_log cal
INNER JOIN users u_new ON u_new.id = CAST(cal.new_value AS UNSIGNED)
WHERE cal.field_name = 'assigned_to'
  AND u_new.role_id NOT IN (6, 7)
  AND cal.new_value != '0'
  AND cal.new_value IS NOT NULL
GROUP BY cal.api_source
ORDER BY cnt DESC
";
$result = safe_query($conn, $sql);
if ($result) {
    while ($row = $result->fetch_assoc()) {
        echo "  {$row['api_source']}: {$row['cnt']} ครั้ง (แรก: {$row['first_seen']}, ล่าสุด: {$row['last_seen']})\n";
    }
}
echo "\n";

// 3. ตรวจสอบว่าหลัง 11/03/2026 (วันนี้) ยังมีปัญหาไหม (เฉพาะ source อื่นที่ไม่ใช่ batch_export)
echo "--- 3. เหตุการณ์ล่าสุดที่ไม่ใช่ batch_export (20 ล่าสุด) ---\n";
$sql = "
SELECT cal.customer_id, cal.created_at, cal.old_value, cal.new_value,
       cal.api_source, cal.changed_by,
       u_new.username AS new_owner_name, u_new.role_id AS new_role_id, 
       r_new.name AS new_role_name,
       u_old.username AS old_owner_name, u_old.role_id AS old_role_id
FROM customer_audit_log cal
INNER JOIN users u_new ON u_new.id = CAST(cal.new_value AS UNSIGNED)
INNER JOIN roles r_new ON r_new.id = u_new.role_id
LEFT JOIN users u_old ON u_old.id = CAST(cal.old_value AS UNSIGNED)
WHERE cal.field_name = 'assigned_to'
  AND u_new.role_id NOT IN (6, 7)
  AND cal.new_value != '0'
  AND cal.new_value IS NOT NULL
  AND cal.api_source != 'orders/batch_export'
ORDER BY cal.created_at DESC
LIMIT 20
";
$result = safe_query($conn, $sql);
if ($result && $result->num_rows > 0) {
    while ($row = $result->fetch_assoc()) {
        $oldInfo = $row['old_owner_name'] ? "{$row['old_owner_name']}(R{$row['old_role_id']})" : "NULL";
        echo "  [{$row['created_at']}] Customer #{$row['customer_id']}\n";
        echo "    {$oldInfo} -> {$row['new_owner_name']}(R{$row['new_role_id']}:{$row['new_role_name']})\n";
        echo "    Source: {$row['api_source']}, Changed by: {$row['changed_by']}\n";
    }
} else {
    echo "  (ไม่พบ — ไม่มี source อื่นที่ทำให้เกิดปัญหา!)\n";
}
echo "\n";

// 4. ตรวจสอบ api_source ทั้งหมดที่เคย update assigned_to (ทั้ง Telesale และ non-Telesale) เพื่อหา code paths ทั้งหมด
echo "--- 4. ทุก api_source ที่เคย update assigned_to (ดูครบทุก code path) ---\n";
$sql = "
SELECT cal.api_source, COUNT(*) AS cnt,
       MAX(DATE(cal.created_at)) AS last_seen
FROM customer_audit_log cal
WHERE cal.field_name = 'assigned_to'
  AND cal.api_source IS NOT NULL
GROUP BY cal.api_source
ORDER BY cnt DESC
";
$result = safe_query($conn, $sql);
if ($result) {
    while ($row = $result->fetch_assoc()) {
        echo "  {$row['api_source']}: {$row['cnt']} ครั้ง (ล่าสุด: {$row['last_seen']})\n";
    }
}
echo "\n";

// 5. ตรวจสอบ batch_export เฉพาะช่วงวันที่ 09/03 ที่ลืม logic
echo "--- 5. batch_export ช่วง 08-11/03/2026 แยกตามชั่วโมง ---\n";
$sql = "
SELECT DATE_FORMAT(cal.created_at, '%Y-%m-%d %H:00') AS hour_bucket,
       COUNT(*) AS cnt
FROM customer_audit_log cal
INNER JOIN users u_new ON u_new.id = CAST(cal.new_value AS UNSIGNED)
WHERE cal.field_name = 'assigned_to'
  AND u_new.role_id NOT IN (6, 7)
  AND cal.api_source = 'orders/batch_export'
  AND cal.created_at >= '2026-03-08 00:00:00'
  AND cal.created_at <= '2026-03-11 23:59:59'
GROUP BY hour_bucket
ORDER BY hour_bucket
";
$result = safe_query($conn, $sql);
if ($result) {
    while ($row = $result->fetch_assoc()) {
        $bar = str_repeat('█', min($row['cnt'], 80));
        echo "  {$row['hour_bucket']}  {$row['cnt']}  {$bar}\n";
    }
}
echo "\n";

// 6. ตรวจเฉพาะ 09/03/2026 ว่า batch_export เปลี่ยน assigned_to ไปกี่คน
echo "--- 6. วันที่ 09/03/2026 รายละเอียด batch_export ---\n";
$sql = "
SELECT u_new.username AS new_owner, u_new.role_id, COUNT(*) AS cnt
FROM customer_audit_log cal
INNER JOIN users u_new ON u_new.id = CAST(cal.new_value AS UNSIGNED)
WHERE cal.field_name = 'assigned_to'
  AND u_new.role_id NOT IN (6, 7)
  AND cal.api_source = 'orders/batch_export'
  AND DATE(cal.created_at) = '2026-03-09'
GROUP BY u_new.username, u_new.role_id
ORDER BY cnt DESC
";
$result = safe_query($conn, $sql);
if ($result) {
    while ($row = $result->fetch_assoc()) {
        echo "  {$row['new_owner']} (Role {$row['role_id']}): {$row['cnt']} ลูกค้า\n";
    }
}

$conn->close();
echo "\n=== Done ===\n";
