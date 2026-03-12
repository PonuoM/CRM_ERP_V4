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
        echo "  Query: " . substr($sql, 0, 200) . "\n";
        return false;
    }
    return $result;
}

echo "=== ตรวจสอบ: ลูกค้าที่ assigned_to ไม่ใช่ role 6/7 ===\n\n";

// 1. สรุป roles ทั้งหมด
echo "--- 1. Roles ทั้งหมดในระบบ ---\n";
$result = safe_query($conn, "SELECT id, name FROM roles ORDER BY id");
if ($result) {
    while ($row = $result->fetch_assoc()) {
        echo "  Role {$row['id']}: {$row['name']}\n";
    }
}
echo "\n";

// 2. จำนวนลูกค้า assigned_to แยกตาม role
echo "--- 2. จำนวนลูกค้าที่มี assigned_to แยกตาม role ---\n";
$sql = "
SELECT u.role_id, r.name AS role_name, COUNT(*) AS customer_count
FROM customers c
INNER JOIN users u ON u.id = c.assigned_to
INNER JOIN roles r ON r.id = u.role_id
WHERE c.assigned_to IS NOT NULL AND c.assigned_to > 0
GROUP BY u.role_id, r.name
ORDER BY customer_count DESC
";
$result = safe_query($conn, $sql);
if ($result) {
    while ($row = $result->fetch_assoc()) {
        $marker = (in_array($row['role_id'], ['6', '7'])) ? '' : ' *** ไม่ใช่ Telesale ***';
        echo "  Role {$row['role_id']} ({$row['role_name']}): {$row['customer_count']} ลูกค้า{$marker}\n";
    }
}
echo "\n";

// 3. รายละเอียดลูกค้าที่ assigned_to user ไม่ใช่ role 6/7
echo "--- 3. Users ที่ไม่ใช่ role 6/7 แต่มีลูกค้า assigned ---\n";
$sql = "
SELECT u.role_id, r.name AS role_name, u.id AS user_id, u.username, u.full_name,
       u.status AS user_status,
       COUNT(*) AS customer_count
FROM customers c
INNER JOIN users u ON u.id = c.assigned_to
INNER JOIN roles r ON r.id = u.role_id
WHERE u.role_id NOT IN (6, 7)
  AND c.assigned_to IS NOT NULL AND c.assigned_to > 0
GROUP BY u.role_id, r.name, u.id, u.username, u.full_name, u.status
ORDER BY u.role_id, customer_count DESC
";
$result = safe_query($conn, $sql);
$total = 0;
$currentRole = null;
if ($result) {
    while ($row = $result->fetch_assoc()) {
        if ($currentRole !== $row['role_id']) {
            if ($currentRole !== null) echo "\n";
            echo "  === Role {$row['role_id']}: {$row['role_name']} ===\n";
            $currentRole = $row['role_id'];
        }
        echo "    User #{$row['user_id']} ({$row['username']} / {$row['full_name']}) [Status: {$row['user_status']}]: {$row['customer_count']} ลูกค้า\n";
        $total += $row['customer_count'];
    }
}
echo "\n  >>> รวมลูกค้าที่ assigned ไปที่ non-Telesale roles: {$total} ลูกค้า <<<\n\n";

// 4. จำนวนลูกค้าที่ assigned_to = 0 หรือ NULL
echo "--- 4. ลูกค้าที่ assigned_to = 0 หรือ NULL ---\n";
$sql = "
SELECT 
  SUM(CASE WHEN assigned_to IS NULL THEN 1 ELSE 0 END) AS null_count,
  SUM(CASE WHEN assigned_to = 0 THEN 1 ELSE 0 END) AS zero_count,
  COUNT(*) AS total_customers
FROM customers
";
$result = safe_query($conn, $sql);
if ($result) {
    $row = $result->fetch_assoc();
    echo "  Total customers: {$row['total_customers']}\n";
    echo "  assigned_to = NULL: {$row['null_count']}\n";
    echo "  assigned_to = 0: {$row['zero_count']}\n";
}
echo "\n";

// 5. ตัวอย่าง audit log: assigned_to เปลี่ยนไป non-Telesale role
echo "--- 5. ตัวอย่าง audit log ที่ assigned_to เปลี่ยนไป non-role6/7 (ล่าสุด 20 รายการ) ---\n";
$sql = "
SELECT cal.customer_id, cal.created_at, cal.old_value, cal.new_value,
       cal.api_source,
       u_new.username AS new_owner_name, u_new.role_id AS new_role_id, r_new.name AS new_role_name
FROM customer_audit_log cal
INNER JOIN users u_new ON u_new.id = CAST(cal.new_value AS UNSIGNED)
INNER JOIN roles r_new ON r_new.id = u_new.role_id
WHERE cal.field_name = 'assigned_to'
  AND u_new.role_id NOT IN (6, 7)
  AND cal.new_value != '0'
  AND cal.new_value IS NOT NULL
ORDER BY cal.created_at DESC
LIMIT 20
";
$result = safe_query($conn, $sql);
if ($result && $result->num_rows > 0) {
    while ($row = $result->fetch_assoc()) {
        echo "  [{$row['created_at']}] Customer #{$row['customer_id']}\n";
        echo "    -> New owner: {$row['new_owner_name']} (Role {$row['new_role_id']}: {$row['new_role_name']})\n";
        echo "    Source: {$row['api_source']}\n";
    }
} else {
    echo "  (ไม่พบข้อมูล)\n";
}
echo "\n";

// 6. Basket transition log ที่ assign ไป non-Telesale
echo "--- 6. ตัวอย่าง basket_transition_log ที่ assign ไป non-role6/7 (ล่าสุด 20 รายการ) ---\n";
$sql = "
SELECT btl.created_at, btl.customer_id, btl.transition_type, btl.notes,
       btl.assigned_to_old, btl.assigned_to_new,
       u_new.username AS new_owner_name, u_new.role_id AS new_role_id, r_new.name AS new_role_name,
       u_trig.username AS triggered_by_name
FROM basket_transition_log btl
INNER JOIN users u_new ON u_new.id = btl.assigned_to_new
INNER JOIN roles r_new ON r_new.id = u_new.role_id
LEFT JOIN users u_trig ON u_trig.id = btl.triggered_by
WHERE u_new.role_id NOT IN (6, 7)
  AND btl.assigned_to_new IS NOT NULL AND btl.assigned_to_new > 0
ORDER BY btl.created_at DESC
LIMIT 20
";
$result = safe_query($conn, $sql);
if ($result && $result->num_rows > 0) {
    while ($row = $result->fetch_assoc()) {
        echo "  [{$row['created_at']}] Customer #{$row['customer_id']}\n";
        echo "    Type: {$row['transition_type']}\n";
        echo "    Assigned to: {$row['new_owner_name']} (Role {$row['new_role_id']}: {$row['new_role_name']})\n";
        echo "    Triggered by: {$row['triggered_by_name']}\n";
        echo "    Notes: {$row['notes']}\n";
    }
} else {
    echo "  (ไม่พบข้อมูล)\n";
}

$conn->close();
echo "\n=== Done ===\n";
