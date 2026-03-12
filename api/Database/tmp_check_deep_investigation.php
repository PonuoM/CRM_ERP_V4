<?php
header('Content-Type: text/plain; charset=utf-8');

$conn = new mysqli('202.183.192.218', 'primacom_bloguser', 'pJnL53Wkhju2LaGPytw8', 'primacom_mini_erp');
$conn->set_charset("utf8mb4");
if ($conn->connect_error) die("Connection failed: " . $conn->connect_error);

function sq($conn, $sql) {
    $result = $conn->query($sql);
    if (!$result) { echo "  ERR: " . $conn->error . "\n"; return false; }
    return $result;
}

echo "=== Deep Investigation V3 ===\n\n";

// 0. Audit log age
echo "--- 0. audit_log info ---\n";
$r = sq($conn, "SELECT MIN(created_at) AS mn, MAX(created_at) AS mx, COUNT(*) AS c FROM customer_audit_log");
if ($r) { $row = $r->fetch_assoc(); echo "  Range: {$row['mn']} ~ {$row['mx']} ({$row['c']} records)\n"; }
echo "\n";

// 1. date_assigned for non-Telesale (avoid reserved word issues)
echo "--- 1. date_assigned of non-Telesale customers ---\n";
$r = sq($conn, "
SELECT 
  CASE 
    WHEN c.date_assigned IS NULL THEN 'NULL'
    WHEN c.date_assigned >= '2026-03-08' THEN DATE_FORMAT(c.date_assigned, '%Y-%m-%d')
    WHEN c.date_assigned >= '2026-03-01' THEN 'Mar 2026 before 08'
    WHEN c.date_assigned >= '2026-02-06' THEN 'Feb 2026 (post V2)'
    WHEN c.date_assigned >= '2026-01-01' THEN 'Jan 2026 (pre V2)'
    WHEN c.date_assigned >= '2025-01-01' THEN '2025'
    ELSE 'Before 2025'
  END AS period,
  COUNT(*) AS cnt
FROM customers c
INNER JOIN users u ON u.id = c.assigned_to
INNER JOIN roles rl ON rl.id = u.role_id
WHERE u.role_id NOT IN (6, 7) AND c.assigned_to > 0
GROUP BY period
ORDER BY cnt DESC
");
if ($r) { while ($row = $r->fetch_assoc()) echo "  {$row['period']}: {$row['cnt']}\n"; }
echo "\n";

// 2. Users that hold non-Telesale customers
echo "--- 2. Users holding non-Telesale customers ---\n";
$r = sq($conn, "
SELECT u.id, u.username, u.role_id, rl.name AS role_name,
       COUNT(c.customer_id) AS cust_count,
       MIN(c.date_assigned) AS earliest, MAX(c.date_assigned) AS latest
FROM customers c
INNER JOIN users u ON u.id = c.assigned_to
INNER JOIN roles rl ON rl.id = u.role_id
WHERE u.role_id NOT IN (6, 7) AND c.assigned_to > 0
GROUP BY u.id, u.username, u.role_id, rl.name
ORDER BY cust_count DESC
");
if ($r) { while ($row = $r->fetch_assoc()) {
    echo "  #{$row['id']} {$row['username']} (R{$row['role_id']}:{$row['role_name']}): {$row['cust_count']}  [{$row['earliest']} ~ {$row['latest']}]\n";
}}
echo "\n";

// 3. Classification: audit_log match
echo "--- 3. Classification by traceability ---\n";

// 3a. Has audit_log match for this assigned_to
$r = sq($conn, "
SELECT COUNT(*) AS cnt FROM customers c
INNER JOIN users u ON u.id = c.assigned_to
WHERE u.role_id NOT IN (6,7) AND c.assigned_to > 0
AND c.customer_id IN (
  SELECT cal.customer_id FROM customer_audit_log cal
  WHERE cal.field_name = 'assigned_to' AND CAST(cal.new_value AS UNSIGNED) = c.assigned_to
)
");
// This subquery approach won't work with correlated subquery in IN.
// Use a different approach: temp table or JOIN

// Let me try a simpler approach: just count from audit_log
echo "  (audit_log has data from 2026-03-05 only — anything before that has no audit trace)\n\n";

$r = sq($conn, "
SELECT cal.api_source, COUNT(DISTINCT cal.customer_id) AS affected_customers
FROM customer_audit_log cal
INNER JOIN users u_new ON u_new.id = CAST(cal.new_value AS UNSIGNED)
WHERE cal.field_name = 'assigned_to'
  AND u_new.role_id NOT IN (6,7)
  AND CAST(cal.new_value AS UNSIGNED) > 0
GROUP BY cal.api_source
ORDER BY affected_customers DESC
");
echo "  [A] audit_log: assigned_to changed to non-Telesale (by api_source):\n";
if ($r) { 
    $totalAudit = 0;
    while ($row = $r->fetch_assoc()) { 
        echo "    {$row['api_source']}: {$row['affected_customers']} unique customers\n"; 
        $totalAudit += $row['affected_customers'];
    }
    echo "    >> Total traceable via audit_log: $totalAudit\n";
}
echo "\n";

// 3b. basket_transition_log match (assigned_to_new is non-Telesale)
$r = sq($conn, "
SELECT btl.transition_type, COUNT(DISTINCT btl.customer_id) AS affected
FROM basket_transition_log btl
INNER JOIN users u ON u.id = btl.assigned_to_new
WHERE u.role_id NOT IN (6,7) AND btl.assigned_to_new > 0
GROUP BY btl.transition_type
ORDER BY affected DESC
");
echo "  [B] basket_transition_log: assigned_to_new is non-Telesale (by type):\n";
if ($r) {
    $totalTransition = 0;
    while ($row = $r->fetch_assoc()) {
        $t = $row['transition_type'] ?: '(empty)';
        echo "    {$t}: {$row['affected']} unique customers\n";
        $totalTransition += $row['affected'];
    }
    echo "    >> Total traceable via transition_log: $totalTransition\n";
}
echo "\n";

// 3c. Total unique customers in transition_log with non-Telesale assigned_to_new
$r = sq($conn, "
SELECT COUNT(DISTINCT btl.customer_id) AS cnt
FROM basket_transition_log btl
INNER JOIN users u ON u.id = btl.assigned_to_new
WHERE u.role_id NOT IN (6,7) AND btl.assigned_to_new > 0
");
if ($r) { $row = $r->fetch_assoc(); echo "  Total unique customers in transition_log non-Telesale: {$row['cnt']}\n"; }

// 3d. Overlap: customers in BOTH audit and transition
$r = sq($conn, "
SELECT COUNT(DISTINCT btl.customer_id) AS cnt
FROM basket_transition_log btl
INNER JOIN users u ON u.id = btl.assigned_to_new
WHERE u.role_id NOT IN (6,7) AND btl.assigned_to_new > 0
AND btl.customer_id IN (
  SELECT cal.customer_id FROM customer_audit_log cal
  INNER JOIN users u2 ON u2.id = CAST(cal.new_value AS UNSIGNED)
  WHERE cal.field_name = 'assigned_to' AND u2.role_id NOT IN (6,7) AND CAST(cal.new_value AS UNSIGNED) > 0
)
");
if ($r) { $row = $r->fetch_assoc(); echo "  Overlap (in both): {$row['cnt']}\n"; }
echo "\n";

// 4. basket_transition_log dates for non-Telesale assigned_to_new
echo "--- 4. basket_transition_log: assigned_to_new non-Telesale by date ---\n";
$r = sq($conn, "
SELECT DATE(btl.created_at) AS dt, btl.transition_type, COUNT(DISTINCT btl.customer_id) AS cnt
FROM basket_transition_log btl
INNER JOIN users u ON u.id = btl.assigned_to_new
WHERE u.role_id NOT IN (6,7) AND btl.assigned_to_new > 0
GROUP BY DATE(btl.created_at), btl.transition_type
ORDER BY dt DESC, cnt DESC
LIMIT 30
");
if ($r) { while ($row = $r->fetch_assoc()) {
    $t = $row['transition_type'] ?: '(empty)';
    echo "  {$row['dt']}  {$t}: {$row['cnt']}\n";
}}
echo "\n";

// 5. IMPORTANT: currently assigned non-Telesale that DON'T appear in EITHER log
echo "--- 5. Currently assigned non-Telesale NOT in any log ---\n";
$r = sq($conn, "
SELECT COUNT(*) AS cnt
FROM customers c
INNER JOIN users u ON u.id = c.assigned_to
WHERE u.role_id NOT IN (6,7) AND c.assigned_to > 0
AND c.customer_id NOT IN (
  SELECT DISTINCT btl.customer_id FROM basket_transition_log btl
  INNER JOIN users u2 ON u2.id = btl.assigned_to_new
  WHERE u2.role_id NOT IN (6,7) AND btl.assigned_to_new > 0
)
AND c.customer_id NOT IN (
  SELECT DISTINCT cal.customer_id FROM customer_audit_log cal
  INNER JOIN users u3 ON u3.id = CAST(cal.new_value AS UNSIGNED)
  WHERE cal.field_name = 'assigned_to' AND u3.role_id NOT IN (6,7) AND CAST(cal.new_value AS UNSIGNED) > 0
)
");
if ($r) { $row = $r->fetch_assoc(); echo "  No trace in any log: {$row['cnt']} customers\n"; }

// What user holds those?
$r = sq($conn, "
SELECT u.id, u.username, u.role_id, rl.name AS role_name, COUNT(*) AS cnt
FROM customers c
INNER JOIN users u ON u.id = c.assigned_to
INNER JOIN roles rl ON rl.id = u.role_id
WHERE u.role_id NOT IN (6,7) AND c.assigned_to > 0
AND c.customer_id NOT IN (
  SELECT DISTINCT btl.customer_id FROM basket_transition_log btl
  INNER JOIN users u2 ON u2.id = btl.assigned_to_new
  WHERE u2.role_id NOT IN (6,7) AND btl.assigned_to_new > 0
)
AND c.customer_id NOT IN (
  SELECT DISTINCT cal.customer_id FROM customer_audit_log cal
  INNER JOIN users u3 ON u3.id = CAST(cal.new_value AS UNSIGNED)
  WHERE cal.field_name = 'assigned_to' AND u3.role_id NOT IN (6,7) AND CAST(cal.new_value AS UNSIGNED) > 0
)
GROUP BY u.id, u.username, u.role_id, rl.name
ORDER BY cnt DESC
");
if ($r) { while ($row = $r->fetch_assoc()) {
    echo "  #{$row['id']} {$row['username']} (R{$row['role_id']}:{$row['role_name']}): {$row['cnt']}\n";
}}

$conn->close();
echo "\n=== Done ===\n";
