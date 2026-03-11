<?php
/**
 * IMPROVED: Use customer_logs (has old_values/new_values with assigned_to) 
 * to reconstruct monthly snapshots properly
 * 
 * customer_logs starts Jan 9, 2026 - can reconstruct Jan and Feb 2026
 * customer_assignment_history starts Nov 23, 2025 - can supplement
 * basket_transition_log starts Jan 24, 2026 - additional source
 */

$conn = new mysqli('202.183.192.218', 'primacom_bloguser', 'pJnL53Wkhju2LaGPytw8', 'primacom_mini_erp');
$conn->set_charset("utf8mb4");
if ($conn->connect_error) die("Connection failed: " . $conn->connect_error);

$out = [];

// Get telesale users role 6, 7
$r = $conn->query("SELECT id, first_name, role_id, status FROM users WHERE role_id IN (6,7) ORDER BY role_id, first_name");
$telesale = [];
while ($row = $r->fetch_assoc()) $telesale[$row['id']] = $row;
$ids = array_keys($telesale);
$ids_str = implode(',', $ids);

// === APPROACH: Use customer_logs to count assignment changes per month ===
// customer_logs has: assigned_to (current value at log time), old_values (JSON), new_values (JSON)
// We need to extract assigned_to changes from old_values/new_values JSON

$out[] = "=========================================================";
$out[] = "  IMPROVED ANALYSIS: Using customer_logs (Jan 2026+)";
$out[] = "=========================================================\n";

// First: count how many assignment changes per month in customer_logs
$months = [
    ['label' => 'Jan 2026', 'start' => '2026-01-01', 'end' => '2026-01-31 23:59:59'],
    ['label' => 'Feb 2026', 'start' => '2026-02-01', 'end' => '2026-02-28 23:59:59'],
    ['label' => 'Mar 2026', 'start' => '2026-03-01', 'end' => '2026-03-11 23:59:59'],
];

// Count customer_logs entries that involve assigned_to changes
foreach ($months as $m) {
    $r = $conn->query("SELECT COUNT(*) as cnt FROM customer_logs 
        WHERE created_at BETWEEN '{$m['start']}' AND '{$m['end']}'
        AND changed_fields LIKE '%assigned_to%'");
    $row = $r->fetch_assoc();
    $out[] = "{$m['label']}: {$row['cnt']} assignment changes in customer_logs";
}

// === More reliable: use customer_assignment_history ===
// This table records WHEN each customer was assigned to each user
// We can count per-month assignments
$out[] = "\n=========================================================";
$out[] = "  MONTHLY ASSIGNMENTS (from customer_assignment_history)";
$out[] = "=========================================================\n";

$all_months = [
    ['label' => 'Oct 2025', 'start' => '2025-10-01', 'end' => '2025-10-31 23:59:59'],
    ['label' => 'Nov 2025', 'start' => '2025-11-01', 'end' => '2025-11-30 23:59:59'],
    ['label' => 'Dec 2025', 'start' => '2025-12-01', 'end' => '2025-12-31 23:59:59'],
    ['label' => 'Jan 2026', 'start' => '2026-01-01', 'end' => '2026-01-31 23:59:59'],
    ['label' => 'Feb 2026', 'start' => '2026-02-01', 'end' => '2026-02-28 23:59:59'],
    ['label' => 'Mar 2026', 'start' => '2026-03-01', 'end' => '2026-03-11 23:59:59'],
];

foreach ($all_months as $m) {
    $r = $conn->query("SELECT COUNT(*) as cnt, COUNT(DISTINCT customer_id) as unique_custs
        FROM customer_assignment_history 
        WHERE user_id IN ($ids_str)
        AND assigned_at BETWEEN '{$m['start']}' AND '{$m['end']}'");
    $row = $r->fetch_assoc();
    $out[] = "{$m['label']}: {$row['cnt']} assignments, {$row['unique_custs']} unique customers";
}

// === KEY ANALYSIS: Snapshot at end of each month ===
// customer_assignment_history only records when assigned TO, not removed
// So we need basket_transition_log for removals (starts Jan 24, 2026)
// For customer_logs: extract from changed_fields/old_values/new_values

$out[] = "\n=========================================================";
$out[] = "  SNAPSHOT RECONSTRUCTION (best effort)";
$out[] = "=========================================================\n";

// Current state
$r = $conn->query("SELECT assigned_to, COUNT(*) as cnt FROM customers WHERE assigned_to IN ($ids_str) GROUP BY assigned_to");
$current = [];
while ($row = $r->fetch_assoc()) $current[(int)$row['assigned_to']] = (int)$row['cnt'];
$current_total = array_sum($current);

// Reconstruct using basket_transition_log (most comprehensive for Jan 24+)
$running = $current;
$snapshots = [];
$snapshots['ปัจจุบัน มี.ค.2026'] = ['total' => $current_total, 'by_role' => []];

// Calculate role subtotals for current
foreach ([6, 7] as $role) {
    $role_total = 0;
    foreach ($ids as $uid) {
        if ($telesale[$uid]['role_id'] == $role) $role_total += $running[$uid] ?? 0;
    }
    $snapshots['ปัจจุบัน มี.ค.2026']['by_role'][$role] = $role_total;
}

// Reverse through months using BTL
$reverse_months = [
    ['label' => 'สิ้น ก.พ.2026', 'start' => '2026-03-01', 'end' => '2026-03-11 23:59:59'], // Remove Mar changes
    ['label' => 'สิ้น ม.ค.2026', 'start' => '2026-02-01', 'end' => '2026-02-28 23:59:59'], // Remove Feb changes
    ['label' => 'สิ้น ธ.ค.2025', 'start' => '2026-01-01', 'end' => '2026-01-31 23:59:59'], // Remove Jan changes
];

foreach ($reverse_months as $m) {
    foreach ($ids as $uid) {
        // BTL gained (assigned TO user in this period)
        $r = $conn->query("SELECT COUNT(DISTINCT customer_id) as cnt FROM basket_transition_log 
            WHERE created_at BETWEEN '{$m['start']}' AND '{$m['end']}'
            AND assigned_to_new = $uid AND (assigned_to_old IS NULL OR assigned_to_old != $uid)");
        $gained = $r ? (int)$r->fetch_assoc()['cnt'] : 0;
        
        // BTL lost (moved AWAY from user in this period)
        $r = $conn->query("SELECT COUNT(DISTINCT customer_id) as cnt FROM basket_transition_log 
            WHERE created_at BETWEEN '{$m['start']}' AND '{$m['end']}'
            AND assigned_to_old = $uid AND (assigned_to_new IS NULL OR assigned_to_new != $uid)");
        $lost = $r ? (int)$r->fetch_assoc()['cnt'] : 0;
        
        if (!isset($running[$uid])) $running[$uid] = 0;
        $running[$uid] = $running[$uid] - $gained + $lost;
        if ($running[$uid] < 0) $running[$uid] = 0;
    }
    
    $total = array_sum($running);
    $snapshots[$m['label']] = ['total' => $total, 'by_role' => []];
    foreach ([6, 7] as $role) {
        $role_total = 0;
        foreach ($ids as $uid) {
            if ($telesale[$uid]['role_id'] == $role) $role_total += $running[$uid] ?? 0;
        }
        $snapshots[$m['label']]['by_role'][$role] = $role_total;
    }
}

// Print summary table
$out[] = "  ช่วงเวลา                      Role 6      Role 7      รวม         เปลี่ยนแปลง";
$out[] = "  " . str_repeat("-", 85);

$snapshots_ordered = array_reverse($snapshots, true);
$prev_total = null;
foreach ($snapshots_ordered as $label => $data) {
    $change = '';
    if ($prev_total !== null) {
        $diff = $data['total'] - $prev_total;
        $sign = $diff >= 0 ? '+' : '';
        $pct = $prev_total > 0 ? round(($diff / $prev_total) * 100, 1) : 0;
        $change = "{$sign}" . number_format($diff) . " ({$sign}{$pct}%)";
    }
    $r6 = number_format($data['by_role'][6] ?? 0);
    $r7 = number_format($data['by_role'][7] ?? 0);
    $total = number_format($data['total']);
    $out[] = "  " . str_pad($label, 30) . str_pad($r6, 12) . str_pad($r7, 12) . str_pad($total, 12) . $change;
    $prev_total = $data['total'];
}

$out[] = "\n=========================================================";
$out[] = "  NOTE";  
$out[] = "=========================================================";
$out[] = "  - basket_transition_log เริ่มบันทึก: 24 ม.ค. 2026";
$out[] = "  - customer_audit_log (assigned_to) เริ่มบันทึก: 5 มี.ค. 2026";
$out[] = "  - customer_assignment_history เริ่มบันทึก: 23 พ.ย. 2025";
$out[] = "  - ข้อมูลก่อนมกราคม 2026 ไม่สามารถ reconstruct ได้จาก transition log";
$out[] = "  - ต.ค. 2025: ไม่มี log ใดๆ ที่ครอบคลุมช่วงนี้";
$out[] = "  - สิ้น ธ.ค. 2025 เป็นค่าประมาณ (reverse จาก ม.ค. 2026 ซึ่ง BTL เริ่ม 24 ม.ค.)";

$conn->close();
echo implode("\n", $out) . "\n";
