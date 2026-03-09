<?php
/**
 * Dashboard: วิเคราะห์การโทรของพนักงานต่อลูกค้า Old3Months
 * 
 * เปิดผ่าน: /testweb1/api/dashboard_call_analysis.php
 * 
 * VERSION 3: ULTRA-OPTIMIZED — ไม่มี correlated subquery 
 * ใช้ LEFT JOIN เท่านั้น ไม่ล็อก DB
 */

require_once __DIR__ . '/config.php';

// ป้องกัน DB lock — จำกัดเวลา
ini_set('max_execution_time', '30');

$pdo = db_connect();

// ==================== CHECK PREREQUISITES ====================
$tablesExist = true;
$missingTables = [];

try {
    $pdo->query("SELECT 1 FROM old_customers LIMIT 1");
} catch (Exception $e) {
    $tablesExist = false;
    $missingTables[] = 'old_customers';
}

try {
    $pdo->query("SELECT 1 FROM customer_logs LIMIT 1");
} catch (Exception $e) {
    $tablesExist = false;
    $missingTables[] = 'customer_logs';
}

// ==================== BUILD DATA ====================
$summaryData = [];
$detailData = [];
$employeeSummary = [];
$totalCustomers = 0;
$totalCalled = 0;
$totalNotCalled = 0;
$overallPct = 0;
$months = [];
$employees = [];

if ($tablesExist) {
    // ==============================================================
    // STRATEGY v4: ใช้ 4 query ง่ายๆ (ไม่มี correlated subquery)
    // แล้วคำนวณ assignment periods + เช็คการโทร ใน PHP
    //
    // old_customers = บอกว่าลูกค้าอยู่ในมือใคร ณ 1 ม.ค.
    // customer_logs = บอกว่า assigned_to เปลี่ยนเมื่อไหร่
    // period ของพนักงาน = เริ่มตั้งแต่วันที่ได้รับ ถึงวันที่ถูกเปลี่ยนคนดูแล
    // นับเฉพาะการโทรที่เกิดขึ้น "ระหว่าง" period เท่านั้น
    // ==============================================================

    // --- QUERY 1: old_customers (ใครดูแลใคร ณ 1 ม.ค.) ---
    $oldCustData = $pdo->query("
        SELECT customer_id, assigned_to 
        FROM old_customers 
        WHERE company_id = 1 AND assigned_to IS NOT NULL AND customer_status = 'existing_3m'
    ")->fetchAll(PDO::FETCH_ASSOC);

    $oldCustMap = []; // customer_id => assigned_to
    foreach ($oldCustData as $oc) {
        $oldCustMap[$oc['customer_id']] = (int) $oc['assigned_to'];
    }

    // --- QUERY 2: customer_logs (ประวัติเปลี่ยน assigned_to) ---
    $logsData = $pdo->query("
        SELECT CAST(cl.customer_id AS UNSIGNED) AS customer_id, cl.assigned_to, cl.created_at
        FROM customer_logs cl
        JOIN customers c ON c.customer_id = cl.customer_id
        WHERE c.company_id = 1 
          AND cl.lifecycle_status = 'Old3Months' 
          AND cl.assigned_to IS NOT NULL
        ORDER BY cl.customer_id, cl.created_at ASC
    ")->fetchAll(PDO::FETCH_ASSOC);

    // Group logs by customer
    $logsByCustomer = [];
    foreach ($logsData as $log) {
        $logsByCustomer[$log['customer_id']][] = $log;
    }

    // --- QUERY 3: users (เฉพาะ role_id 6,7 = Telesale) ---
    $userNames = [];
    $usersStmt = $pdo->query("SELECT id, first_name, last_name FROM users WHERE role_id IN (6,7)");
    while ($u = $usersStmt->fetch(PDO::FETCH_ASSOC)) {
        $userNames[(int) $u['id']] = $u['first_name'] . ' ' . $u['last_name'];
    }

    // --- QUERY 4: customers (ชื่อ+เบอร์ลูกค้า) ---
    $custInfo = [];
    $custStmt = $pdo->query("SELECT customer_id, first_name, last_name, phone FROM customers WHERE company_id = 1");
    while ($c = $custStmt->fetch(PDO::FETCH_ASSOC)) {
        $custInfo[$c['customer_id']] = [
            'name' => $c['first_name'] . ' ' . $c['last_name'],
            'phone' => $c['phone'],
        ];
    }

    // ==================== BUILD ASSIGNMENT PERIODS IN PHP ====================
    $periods = [];
    $now = date('Y-m-d H:i:s');

    // Part A: จาก old_customers (วันที่ 1 ม.ค. ไปจนกว่าจะเปลี่ยนคนดูแล)
    foreach ($oldCustMap as $cid => $assignedTo) {
        $periodEnd = $now;

        // หา customer_logs entry แรกที่ assigned_to ต่างจาก old_customers
        if (isset($logsByCustomer[$cid])) {
            foreach ($logsByCustomer[$cid] as $log) {
                if ((int) $log['assigned_to'] !== $assignedTo) {
                    $periodEnd = $log['created_at'];
                    break;
                }
            }
        }

        $periods[] = [
            'customer_id' => $cid,
            'assigned_to' => $assignedTo,
            'period_start' => '2026-01-01 00:00:00',
            'period_end' => $periodEnd,
            'source' => 'old_system',
            'month_key' => '2026-01',
        ];
    }

    // Part B: จาก customer_logs (แต่ละ entry ที่ assigned_to เปลี่ยน = period ใหม่)
    foreach ($logsByCustomer as $cid => $entries) {
        // ถ้ามีใน old_customers ให้เริ่มจาก assigned_to ของ old เพื่อข้ามซ้ำ
        $prevAssigned = $oldCustMap[$cid] ?? null;

        for ($i = 0; $i < count($entries); $i++) {
            $entry = $entries[$i];
            $assignedTo = (int) $entry['assigned_to'];

            // ข้าม entry ที่ assigned_to เหมือนกับคนก่อนหน้า (ไม่ใช่การเปลี่ยนจริง)
            if ($assignedTo === $prevAssigned) {
                continue;
            }
            $prevAssigned = $assignedTo;

            // หาจุดสิ้นสุด = entry ถัดไปที่ assigned_to ต่างออกไป
            $start = $entry['created_at'];
            $end = $now;
            for ($j = $i + 1; $j < count($entries); $j++) {
                if ((int) $entries[$j]['assigned_to'] !== $assignedTo) {
                    $end = $entries[$j]['created_at'];
                    break;
                }
            }

            $periods[] = [
                'customer_id' => $cid,
                'assigned_to' => $assignedTo,
                'period_start' => $start,
                'period_end' => $end,
                'source' => 'customer_logs',
                'month_key' => substr($start, 0, 7),
            ];
        }
    }

    // --- QUERY 5: call_history (ทุกสายตั้งแต่ ม.ค. 2026) ---
    $callsByCustomer = []; // customer_id => [date1, date2, ...]
    $callStmt = $pdo->query("
        SELECT ch.customer_id, ch.date 
        FROM call_history ch
        JOIN customers c ON c.customer_id = ch.customer_id
        WHERE c.company_id = 1 AND ch.date >= '2026-01-01'
        ORDER BY ch.customer_id, ch.date
    ");
    while ($call = $callStmt->fetch(PDO::FETCH_ASSOC)) {
        $callsByCustomer[$call['customer_id']][] = $call['date'];
    }

    // ==================== MATCH CALLS AGAINST PERIODS ====================
    $allRows = [];
    foreach ($periods as &$p) {
        // ข้ามพนักงานที่ไม่ใช่ role_id 6,7
        if (!isset($userNames[$p['assigned_to']]))
            continue;

        $callCount = 0;
        $lastCall = null;

        if (isset($callsByCustomer[$p['customer_id']])) {
            foreach ($callsByCustomer[$p['customer_id']] as $callDate) {
                // นับเฉพาะสายที่โทรในช่วง period เท่านั้น
                if ($callDate >= $p['period_start'] && $callDate <= $p['period_end']) {
                    $callCount++;
                    if (!$lastCall || $callDate > $lastCall) {
                        $lastCall = $callDate;
                    }
                }
            }
        }

        $allRows[] = [
            'month_key' => $p['month_key'],
            'user_id' => $p['assigned_to'],
            'employee_name' => $userNames[$p['assigned_to']] ?? 'ไม่ทราบ',
            'customer_id' => $p['customer_id'],
            'customer_name' => $custInfo[$p['customer_id']]['name'] ?? '-',
            'customer_phone' => $custInfo[$p['customer_id']]['phone'] ?? '-',
            'period_start' => $p['period_start'],
            'period_end' => $p['period_end'],
            'is_active' => ($p['period_end'] >= $now) ? 1 : 0,
            'source' => $p['source'],
            'has_call' => $callCount > 0 ? 1 : 0,
            'call_count' => $callCount,
            'last_call_date' => $lastCall,
        ];
    }
    unset($p);

    // ==================== AGGREGATE ====================
    $detailData = $allRows;
    $summaryMap = [];

    foreach ($allRows as $row) {
        $key = $row['month_key'] . '|' . $row['user_id'];
        if (!isset($summaryMap[$key])) {
            $summaryMap[$key] = [
                'month_key' => $row['month_key'],
                'user_id' => $row['user_id'],
                'employee_name' => $row['employee_name'],
                'customers' => [],
            ];
        }
        $cid = $row['customer_id'];
        if (!isset($summaryMap[$key]['customers'][$cid])) {
            $summaryMap[$key]['customers'][$cid] = $row['has_call'];
        } else if ($row['has_call']) {
            $summaryMap[$key]['customers'][$cid] = 1;
        }
    }

    foreach ($summaryMap as $data) {
        $total = count($data['customers']);
        $called = array_sum($data['customers']);
        $notCalled = $total - $called;
        $pct = $total > 0 ? round($called * 100.0 / $total, 1) : 0;

        $summaryData[] = [
            'month_key' => $data['month_key'],
            'user_id' => $data['user_id'],
            'employee_name' => $data['employee_name'],
            'total_customers' => $total,
            'called_customers' => $called,
            'not_called_customers' => $notCalled,
            'call_percentage' => $pct,
        ];

        $totalCustomers += $total;
        $totalCalled += $called;
        $totalNotCalled += $notCalled;
        $months[$data['month_key']] = true;
        $employees[$data['user_id']] = $data['employee_name'];
    }

    usort($summaryData, function ($a, $b) {
        $cmp = strcmp($a['month_key'], $b['month_key']);
        if ($cmp !== 0)
            return $cmp;
        return $b['call_percentage'] <=> $a['call_percentage'];
    });

    $overallPct = $totalCustomers > 0 ? round($totalCalled * 100 / $totalCustomers, 1) : 0;

    foreach ($summaryData as $row) {
        $uid = $row['user_id'];
        if (!isset($employeeSummary[$uid])) {
            $employeeSummary[$uid] = ['name' => $row['employee_name'], 'total' => 0, 'called' => 0];
        }
        $employeeSummary[$uid]['total'] += $row['total_customers'];
        $employeeSummary[$uid]['called'] += $row['called_customers'];
    }
    uasort($employeeSummary, function ($a, $b) {
        $pctA = $a['total'] > 0 ? $a['called'] / $a['total'] : 0;
        $pctB = $b['total'] > 0 ? $b['called'] / $b['total'] : 0;
        return $pctA <=> $pctB;
    });
}

// Get filter params
$filterMonth = $_GET['month'] ?? '';
$filterEmployee = $_GET['employee'] ?? '';
$filterStatus = $_GET['status'] ?? '';

// Filter detail data
$filteredDetail = array_filter($detailData, function ($row) use ($filterMonth, $filterEmployee, $filterStatus) {
    if ($filterMonth && $row['month_key'] !== $filterMonth)
        return false;
    if ($filterEmployee && $row['user_id'] != $filterEmployee)
        return false;
    if ($filterStatus === 'called' && !$row['has_call'])
        return false;
    if ($filterStatus === 'not_called' && $row['has_call'])
        return false;
    return true;
});

// Sort detail: not called first
usort($filteredDetail, function ($a, $b) {
    $cmp = strcmp($a['month_key'], $b['month_key']);
    if ($cmp !== 0)
        return $cmp;
    $cmp = strcmp($a['employee_name'], $b['employee_name']);
    if ($cmp !== 0)
        return $cmp;
    return $a['has_call'] <=> $b['has_call']; // not called first
});

// Thai month names
function thaiMonth($ym)
{
    $months_th = [
        '01' => 'ม.ค.',
        '02' => 'ก.พ.',
        '03' => 'มี.ค.',
        '04' => 'เม.ย.',
        '05' => 'พ.ค.',
        '06' => 'มิ.ย.',
        '07' => 'ก.ค.',
        '08' => 'ส.ค.',
        '09' => 'ก.ย.',
        '10' => 'ต.ค.',
        '11' => 'พ.ย.',
        '12' => 'ธ.ค.'
    ];
    $parts = explode('-', $ym);
    $thaiYear = intval($parts[0]) + 543;
    return ($months_th[$parts[1]] ?? $parts[1]) . ' ' . $thaiYear;
}

$execTime = round(microtime(true) - $_SERVER['REQUEST_TIME_FLOAT'], 2);
?>
<!DOCTYPE html>
<html lang="th">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard วิเคราะห์การโทร - Old3Months</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600;700&display=swap"
        rel="stylesheet">
    <style>
        :root {
            --bg-primary: #0f172a;
            --bg-secondary: #1e293b;
            --bg-card: #1e293b;
            --bg-card-hover: #273548;
            --border: #334155;
            --text-primary: #f1f5f9;
            --text-secondary: #94a3b8;
            --text-muted: #64748b;
            --accent-blue: #3b82f6;
            --accent-cyan: #06b6d4;
            --accent-green: #10b981;
            --accent-red: #ef4444;
            --accent-amber: #f59e0b;
            --accent-purple: #8b5cf6;
            --gradient-blue: linear-gradient(135deg, #3b82f6, #06b6d4);
            --gradient-green: linear-gradient(135deg, #10b981, #34d399);
            --gradient-red: linear-gradient(135deg, #ef4444, #f87171);
            --gradient-amber: linear-gradient(135deg, #f59e0b, #fbbf24);
            --shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
            --radius: 16px;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Noto Sans Thai', sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            min-height: 100vh;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 24px;
        }

        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 32px;
            flex-wrap: wrap;
            gap: 16px;
        }

        .header h1 {
            font-size: 28px;
            font-weight: 700;
            background: var(--gradient-blue);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .header .subtitle {
            color: var(--text-secondary);
            font-size: 14px;
            margin-top: 4px;
        }

        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
        }

        .badge-live {
            background: rgba(16, 185, 129, 0.15);
            color: var(--accent-green);
            border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .badge-perf {
            background: rgba(139, 92, 246, 0.15);
            color: var(--accent-purple);
            border: 1px solid rgba(139, 92, 246, 0.3);
            margin-left: 8px;
        }

        /* Cards */
        .cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 20px;
            margin-bottom: 32px;
        }

        .card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 24px;
            position: relative;
            overflow: hidden;
            transition: transform 0.2s, box-shadow 0.2s;
        }

        .card:hover {
            transform: translateY(-2px);
            box-shadow: var(--shadow);
        }

        .card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
        }

        .card:nth-child(1)::before {
            background: var(--gradient-blue);
        }

        .card:nth-child(2)::before {
            background: var(--gradient-green);
        }

        .card:nth-child(3)::before {
            background: var(--gradient-red);
        }

        .card:nth-child(4)::before {
            background: var(--gradient-amber);
        }

        .card-label {
            font-size: 13px;
            color: var(--text-secondary);
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 12px;
        }

        .card-value {
            font-size: 36px;
            font-weight: 700;
            line-height: 1;
            margin-bottom: 8px;
        }

        .card:nth-child(1) .card-value {
            color: var(--accent-blue);
        }

        .card:nth-child(2) .card-value {
            color: var(--accent-green);
        }

        .card:nth-child(3) .card-value {
            color: var(--accent-red);
        }

        .card:nth-child(4) .card-value {
            color: var(--accent-amber);
        }

        .card-sub {
            font-size: 13px;
            color: var(--text-muted);
        }

        /* Filters */
        .filters {
            display: flex;
            gap: 12px;
            margin-bottom: 24px;
            flex-wrap: wrap;
            align-items: center;
        }

        .filters label {
            font-size: 13px;
            color: var(--text-secondary);
            font-weight: 500;
        }

        .filters select {
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            color: var(--text-primary);
            padding: 8px 12px;
            border-radius: 8px;
            font-size: 14px;
            font-family: inherit;
            cursor: pointer;
            min-width: 140px;
        }

        .filters select:focus {
            outline: none;
            border-color: var(--accent-blue);
            box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
        }

        .btn-filter {
            background: var(--accent-blue);
            color: white;
            border: none;
            padding: 8px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-family: inherit;
            cursor: pointer;
            font-weight: 500;
        }

        .btn-filter:hover {
            background: #2563eb;
        }

        .btn-reset {
            background: transparent;
            color: var(--text-secondary);
            border: 1px solid var(--border);
            padding: 8px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-family: inherit;
            cursor: pointer;
            text-decoration: none;
        }

        .btn-reset:hover {
            background: var(--bg-card-hover);
            color: var(--text-primary);
        }

        /* Section */
        .section {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 24px;
            margin-bottom: 24px;
        }

        .section-title {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .section-title .icon {
            width: 32px;
            height: 32px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
        }

        /* Tables */
        .table-wrap {
            overflow-x: auto;
            border-radius: 12px;
            border: 1px solid var(--border);
        }

        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
        }

        thead th {
            background: rgba(59, 130, 246, 0.08);
            color: var(--text-secondary);
            font-weight: 600;
            text-align: left;
            padding: 12px 16px;
            border-bottom: 1px solid var(--border);
            white-space: nowrap;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }

        tbody td {
            padding: 10px 16px;
            border-bottom: 1px solid rgba(51, 65, 85, 0.5);
            white-space: nowrap;
        }

        tbody tr:hover {
            background: var(--bg-card-hover);
        }

        tbody tr:last-child td {
            border-bottom: none;
        }

        /* Progress */
        .progress-bar {
            width: 120px;
            height: 8px;
            background: rgba(255, 255, 255, 0.06);
            border-radius: 4px;
            overflow: hidden;
            display: inline-block;
            vertical-align: middle;
            margin-right: 8px;
        }

        .progress-bar .fill {
            height: 100%;
            border-radius: 4px;
        }

        .pct-high .fill {
            background: var(--gradient-green);
        }

        .pct-mid .fill {
            background: var(--gradient-amber);
        }

        .pct-low .fill {
            background: var(--gradient-red);
        }

        .pct-text {
            font-weight: 600;
            display: inline-block;
            min-width: 48px;
        }

        .pct-high .pct-text {
            color: var(--accent-green);
        }

        .pct-mid .pct-text {
            color: var(--accent-amber);
        }

        .pct-low .pct-text {
            color: var(--accent-red);
        }

        /* Badges */
        .status-called {
            background: rgba(16, 185, 129, 0.12);
            color: var(--accent-green);
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
        }

        .status-not-called {
            background: rgba(239, 68, 68, 0.12);
            color: var(--accent-red);
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
        }

        .source-badge {
            background: rgba(139, 92, 246, 0.12);
            color: var(--accent-purple);
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 500;
        }

        /* Employee Cards */
        .emp-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 16px;
        }

        .emp-card {
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 16px;
            display: flex;
            align-items: center;
            gap: 16px;
            transition: background 0.2s;
        }

        .emp-card:hover {
            background: var(--bg-card-hover);
        }

        .emp-rank {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 14px;
            flex-shrink: 0;
        }

        .emp-rank-top {
            background: var(--gradient-green);
            color: white;
        }

        .emp-rank-mid {
            background: var(--gradient-amber);
            color: white;
        }

        .emp-rank-low {
            background: var(--gradient-red);
            color: white;
        }

        .emp-info {
            flex: 1;
            min-width: 0;
        }

        .emp-name {
            font-weight: 600;
            font-size: 15px;
        }

        .emp-stats {
            font-size: 13px;
            color: var(--text-secondary);
            margin-top: 4px;
        }

        .emp-pct {
            font-size: 20px;
            font-weight: 700;
            flex-shrink: 0;
        }

        /* Error */
        .error-box {
            background: rgba(239, 68, 68, 0.08);
            border: 1px solid rgba(239, 68, 68, 0.3);
            color: #fca5a5;
            padding: 24px;
            border-radius: var(--radius);
            margin-bottom: 24px;
        }

        .error-box h3 {
            color: var(--accent-red);
            margin-bottom: 8px;
        }

        .error-box code {
            display: block;
            background: rgba(0, 0, 0, 0.3);
            padding: 12px;
            border-radius: 8px;
            margin-top: 12px;
            font-size: 13px;
            overflow-x: auto;
        }

        /* Tabs */
        .tabs {
            display: flex;
            gap: 4px;
            margin-bottom: 20px;
            border-bottom: 1px solid var(--border);
            padding-bottom: 0;
        }

        .tab {
            padding: 10px 20px;
            cursor: pointer;
            color: var(--text-secondary);
            font-weight: 500;
            font-size: 14px;
            border-bottom: 2px solid transparent;
            margin-bottom: -1px;
        }

        .tab:hover {
            color: var(--text-primary);
        }

        .tab.active {
            color: var(--accent-blue);
            border-bottom-color: var(--accent-blue);
        }

        .tab-content {
            display: none;
        }

        .tab-content.active {
            display: block;
        }

        .count-badge {
            background: rgba(59, 130, 246, 0.15);
            color: var(--accent-blue);
            font-size: 12px;
            padding: 2px 8px;
            border-radius: 10px;
            font-weight: 600;
            margin-left: 8px;
        }

        /* Month Selector */
        .month-selector {
            display: flex;
            gap: 8px;
            margin-bottom: 20px;
            flex-wrap: wrap;
            align-items: center;
        }

        .month-selector .label {
            font-size: 13px;
            color: var(--text-secondary);
            font-weight: 500;
            margin-right: 4px;
        }

        .month-pill {
            padding: 6px 16px;
            border-radius: 20px;
            border: 1px solid var(--border);
            background: transparent;
            color: var(--text-secondary);
            font-size: 13px;
            font-family: inherit;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.2s;
        }

        .month-pill:hover {
            background: var(--bg-card-hover);
            color: var(--text-primary);
        }

        .month-pill.active {
            background: var(--accent-blue);
            border-color: var(--accent-blue);
            color: white;
        }

        @media (max-width: 768px) {
            .container {
                padding: 12px;
            }

            .cards {
                grid-template-columns: 1fr 1fr;
            }

            .card-value {
                font-size: 28px;
            }

            .emp-grid {
                grid-template-columns: 1fr;
            }

            .header h1 {
                font-size: 22px;
            }
        }

        @media (max-width: 480px) {
            .cards {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>

<body>
    <div class="container">
        <div class="header">
            <div>
                <h1>📊 วิเคราะห์การโทร — ลูกค้า Old3Months</h1>
                <div class="subtitle">รายงานสรุปพนักงานดูแลลูกค้ากี่คน และโทรหาแล้วกี่คน</div>
            </div>
            <div>
                <span class="badge badge-live">● ข้อมูล ณ <?= date('d/m/Y H:i') ?></span>
                <span class="badge badge-perf">⚡ <?= $execTime ?>s</span>
            </div>
        </div>

        <?php if (!$tablesExist): ?>
            <div class="error-box">
                <h3>⚠️ ยังไม่มีตารางที่จำเป็น</h3>
                <p>กรุณา import ข้อมูลก่อนใช้งาน Dashboard:</p>
                <p style="margin-top:8px;">ตารางที่ขาด: <strong><?= implode(', ', $missingTables) ?></strong></p>
                <code>
                -- 1. รัน Step 1 ใน employee_customer_call_analysis.sql เพื่อสร้างตาราง old_customers
                -- 2. Import ไฟล์ customers (9).sql ผ่าน phpMyAdmin
                        </code>
            </div>
        <?php else: ?>

            <!-- Month Selector (global) -->
            <div class="month-selector" id="monthSelector">
                <span class="label">📅 เลือกเดือน:</span>
                <button class="month-pill active" data-month="">ทั้งหมด</button>
                <?php foreach (array_keys($months) as $m): ?>
                    <button class="month-pill" data-month="<?= $m ?>"><?= thaiMonth($m) ?></button>
                <?php endforeach; ?>
            </div>

            <div class="cards">
                <div class="card">
                    <div class="card-label">ลูกค้าทั้งหมด</div>
                    <div class="card-value" id="kpi-total"><?= number_format($totalCustomers) ?></div>
                    <div class="card-sub">จำนวนลูกค้า Old3Months ทั้งหมดในระบบ</div>
                </div>
                <div class="card">
                    <div class="card-label">โทรแล้ว ✅</div>
                    <div class="card-value" id="kpi-called"><?= number_format($totalCalled) ?></div>
                    <div class="card-sub">ลูกค้าที่พนักงานโทรติดต่อแล้ว</div>
                </div>
                <div class="card">
                    <div class="card-label">ยังไม่โทร ❌</div>
                    <div class="card-value" id="kpi-not-called"><?= number_format($totalNotCalled) ?></div>
                    <div class="card-sub">ลูกค้าที่ยังไม่ถูกติดต่อ</div>
                </div>
                <div class="card">
                    <div class="card-label">เปอร์เซ็นต์โทร</div>
                    <div class="card-value" id="kpi-pct"><?= $overallPct ?>%</div>
                    <div class="card-sub">อัตราการโทรเฉลี่ยทั้งระบบ</div>
                </div>
            </div>

            <div class="tabs">
                <div class="tab active" data-tab="summary">📋 สรุปรายเดือน</div>
                <div class="tab" data-tab="ranking">🏆 อันดับพนักงาน</div>
                <div class="tab" data-tab="detail">🔍 รายละเอียด</div>
            </div>

            <!-- Tab 1: Summary -->
            <div class="tab-content active" id="tab-summary">
                <div class="section">
                    <div class="section-title">
                        <span class="icon" style="background:rgba(59,130,246,0.15);">📅</span>
                        สรุปพนักงาน — ดูแลลูกค้ากี่คน / โทรหากี่คน
                    </div>
                    <div class="table-wrap">
                        <table id="summaryTable">
                            <thead>
                                <tr>
                                    <th>พนักงาน</th>
                                    <th style="text-align:right">ลูกค้าทั้งหมด</th>
                                    <th style="text-align:right">โทรแล้ว ✅</th>
                                    <th style="text-align:right">ยังไม่โทร ❌</th>
                                    <th>เปอร์เซ็นต์โทร</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php foreach ($summaryData as $row):
                                    $pct = floatval($row['call_percentage']);
                                    $pctClass = $pct >= 70 ? 'pct-high' : ($pct >= 40 ? 'pct-mid' : 'pct-low');
                                    ?>
                                    <tr data-month="<?= $row['month_key'] ?>" data-total="<?= $row['total_customers'] ?>"
                                        data-called="<?= $row['called_customers'] ?>"
                                        data-not-called="<?= $row['not_called_customers'] ?>">
                                        <td><strong><?= htmlspecialchars($row['employee_name']) ?></strong></td>
                                        <td style="text-align:right"><?= number_format($row['total_customers']) ?></td>
                                        <td style="text-align:right"><?= number_format($row['called_customers']) ?></td>
                                        <td style="text-align:right"><?= number_format($row['not_called_customers']) ?></td>
                                        <td>
                                            <span class="<?= $pctClass ?>">
                                                <span class="progress-bar"><span class="fill"
                                                        style="width:<?= $pct ?>%"></span></span>
                                                <span class="pct-text"><?= $pct ?>%</span>
                                            </span>
                                        </td>
                                    </tr>
                                <?php endforeach; ?>
                                <?php if (empty($summaryData)): ?>
                                    <tr>
                                        <td colspan="5" style="text-align:center;color:var(--text-muted);padding:32px;">
                                            ไม่มีข้อมูล</td>
                                    </tr>
                                <?php endif; ?>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Tab 2: Ranking -->
            <div class="tab-content" id="tab-ranking">
                <div class="section">
                    <div class="section-title">
                        <span class="icon" style="background:rgba(245,158,11,0.15);">🏆</span>
                        อันดับพนักงาน (เรียงจากน้อยไปมาก — เพื่อติดตาม)
                    </div>
                    <div class="emp-grid" id="empGrid">
                        <?php
                        $rank = 1;
                        foreach ($employeeSummary as $uid => $emp):
                            $pct = $emp['total'] > 0 ? round($emp['called'] * 100 / $emp['total'], 1) : 0;
                            $not_called = $emp['total'] - $emp['called'];
                            $rankClass = $pct >= 70 ? 'emp-rank-top' : ($pct >= 40 ? 'emp-rank-mid' : 'emp-rank-low');
                            $pctColor = $pct >= 70 ? 'var(--accent-green)' : ($pct >= 40 ? 'var(--accent-amber)' : 'var(--accent-red)');
                            ?>
                            <div class="emp-card">
                                <div class="emp-rank <?= $rankClass ?>"><?= $rank ?></div>
                                <div class="emp-info">
                                    <div class="emp-name"><?= htmlspecialchars($emp['name']) ?></div>
                                    <div class="emp-stats">
                                        ดูแล <?= number_format($emp['total']) ?> คน |
                                        โทรแล้ว <?= number_format($emp['called']) ?> |
                                        ยังไม่โทร <?= number_format($not_called) ?>
                                    </div>
                                </div>
                                <div class="emp-pct" style="color:<?= $pctColor ?>"><?= $pct ?>%</div>
                            </div>
                            <?php $rank++; endforeach; ?>
                    </div>
                </div>
            </div>

            <!-- Tab 3: Detail -->
            <div class="tab-content" id="tab-detail">
                <div class="section">
                    <div class="section-title">
                        <span class="icon" style="background:rgba(6,182,212,0.15);">🔍</span>
                        รายละเอียดลูกค้า
                        <span class="count-badge"><?= count($filteredDetail) ?> รายการ</span>
                    </div>
                    <form class="filters" method="GET">
                        <label>เดือน:</label>
                        <select name="month">
                            <option value="">ทั้งหมด</option>
                            <?php foreach (array_keys($months) as $m): ?>
                                <option value="<?= $m ?>" <?= $filterMonth === $m ? 'selected' : '' ?>><?= thaiMonth($m) ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                        <label>พนักงาน:</label>
                        <select name="employee">
                            <option value="">ทั้งหมด</option>
                            <?php foreach ($employees as $eid => $ename): ?>
                                <option value="<?= $eid ?>" <?= $filterEmployee == $eid ? 'selected' : '' ?>>
                                    <?= htmlspecialchars($ename) ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                        <label>สถานะ:</label>
                        <select name="status">
                            <option value="">ทั้งหมด</option>
                            <option value="called" <?= $filterStatus === 'called' ? 'selected' : '' ?>>โทรแล้ว ✅</option>
                            <option value="not_called" <?= $filterStatus === 'not_called' ? 'selected' : '' ?>>ยังไม่โทร ❌
                            </option>
                        </select>
                        <button type="submit" class="btn-filter">กรอง</button>
                        <a href="?" class="btn-reset">ล้างตัวกรอง</a>
                    </form>
                    <div class="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>เดือน</th>
                                    <th>พนักงาน</th>
                                    <th>รหัสลูกค้า</th>
                                    <th>ชื่อลูกค้า</th>
                                    <th>เบอร์</th>
                                    <th>สถานะการโทร</th>
                                    <th style="text-align:right">จำนวนครั้ง</th>
                                    <th>โทรครั้งล่าสุด</th>
                                    <th>แหล่งข้อมูล</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php
                                $displayCount = 0;
                                foreach ($filteredDetail as $row):
                                    if ($displayCount >= 300)
                                        break;
                                    $displayCount++;
                                    ?>
                                    <tr data-month="<?= $row['month_key'] ?>">
                                        <td><?= thaiMonth($row['month_key']) ?></td>
                                        <td><strong><?= htmlspecialchars($row['employee_name']) ?></strong></td>
                                        <td><?= $row['customer_id'] ?></td>
                                        <td><?= htmlspecialchars($row['customer_name']) ?></td>
                                        <td><?= htmlspecialchars($row['customer_phone'] ?? '-') ?></td>
                                        <td>
                                            <?php if ($row['has_call']): ?>
                                                <span class="status-called">โทรแล้ว ✅</span>
                                            <?php else: ?>
                                                <span class="status-not-called">ยังไม่โทร ❌</span>
                                            <?php endif; ?>
                                        </td>
                                        <td style="text-align:right"><?= $row['call_count'] ?></td>
                                        <td><?= $row['last_call_date'] ? date('d/m/Y H:i', strtotime($row['last_call_date'])) : '-' ?>
                                        </td>
                                        <td><span class="source-badge"><?= $row['source'] ?></span></td>
                                    </tr>
                                <?php endforeach; ?>
                                <?php if ($displayCount === 0): ?>
                                    <tr>
                                        <td colspan="9" style="text-align:center;color:var(--text-muted);padding:32px;">
                                            ไม่มีข้อมูลตรงตามเงื่อนไข</td>
                                    </tr>
                                <?php endif; ?>
                                <?php if (count($filteredDetail) > 300): ?>
                                    <tr>
                                        <td colspan="9" style="text-align:center;color:var(--accent-amber);padding:16px;">
                                            ⚠️ แสดง 300 รายการแรก (ทั้งหมด <?= number_format(count($filteredDetail)) ?> —
                                            ใช้ตัวกรองเพื่อดูเพิ่ม)
                                        </td>
                                    </tr>
                                <?php endif; ?>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        <?php endif; ?>
    </div>

    <script>
        // === Summary data for JS filtering ===
        const summaryData = <?= json_encode($summaryData, JSON_UNESCAPED_UNICODE) ?>;
        const allTotals = { total: <?= $totalCustomers ?>, called: <?= $totalCalled ?>, notCalled: <?= $totalNotCalled ?>, pct: <?= $overallPct ?> };

        // Tab switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
                history.replaceState(null, null, '#' + tab.dataset.tab);
            });
            if (window.location.hash === '#' + tab.dataset.tab) tab.click();
        });

        // Month filtering
        function numberFormat(n) {
            return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        }

        function filterByMonth(month) {
            // Update pill buttons
            document.querySelectorAll('.month-pill').forEach(p => p.classList.remove('active'));
            document.querySelector(`.month-pill[data-month="${month}"]`).classList.add('active');

            // Filter summary table rows
            let total = 0, called = 0, notCalled = 0;
            document.querySelectorAll('#summaryTable tbody tr[data-month]').forEach(row => {
                if (!month || row.dataset.month === month) {
                    row.style.display = '';
                    total += parseInt(row.dataset.total || 0);
                    called += parseInt(row.dataset.called || 0);
                    notCalled += parseInt(row.dataset.notCalled || 0);
                } else {
                    row.style.display = 'none';
                }
            });

            // Update KPI cards
            if (!month) {
                total = allTotals.total;
                called = allTotals.called;
                notCalled = allTotals.notCalled;
            }
            const pct = total > 0 ? (called * 100 / total).toFixed(1) : '0.0';
            document.getElementById('kpi-total').textContent = numberFormat(total);
            document.getElementById('kpi-called').textContent = numberFormat(called);
            document.getElementById('kpi-not-called').textContent = numberFormat(notCalled);
            document.getElementById('kpi-pct').textContent = pct + '%';

            // Filter detail table rows
            document.querySelectorAll('#tab-detail tbody tr[data-month]').forEach(row => {
                if (!month || row.dataset.month === month) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });

            // Rebuild ranking from summary data
            rebuildRanking(month);
        }

        function rebuildRanking(month) {
            // Aggregate from summaryData
            const empMap = {};
            summaryData.forEach(row => {
                if (month && row.month_key !== month) return;
                const uid = row.user_id;
                if (!empMap[uid]) {
                    empMap[uid] = { name: row.employee_name, total: 0, called: 0 };
                }
                empMap[uid].total += row.total_customers;
                empMap[uid].called += row.called_customers;
            });

            // Sort by pct ascending (worst first)
            const sorted = Object.entries(empMap).sort((a, b) => {
                const pctA = a[1].total > 0 ? a[1].called / a[1].total : 0;
                const pctB = b[1].total > 0 ? b[1].called / b[1].total : 0;
                return pctA - pctB;
            });

            const grid = document.getElementById('empGrid');
            if (!grid) return;
            grid.innerHTML = '';

            sorted.forEach(([uid, emp], i) => {
                const pct = emp.total > 0 ? (emp.called * 100 / emp.total).toFixed(1) : '0.0';
                const notCalled = emp.total - emp.called;
                const rankClass = pct >= 70 ? 'emp-rank-top' : (pct >= 40 ? 'emp-rank-mid' : 'emp-rank-low');
                const pctColor = pct >= 70 ? 'var(--accent-green)' : (pct >= 40 ? 'var(--accent-amber)' : 'var(--accent-red)');

                grid.innerHTML += `
                    <div class="emp-card">
                        <div class="emp-rank ${rankClass}">${i + 1}</div>
                        <div class="emp-info">
                            <div class="emp-name">${emp.name}</div>
                            <div class="emp-stats">
                                \u0e14\u0e39\u0e41\u0e25 ${numberFormat(emp.total)} \u0e04\u0e19 |
                                \u0e42\u0e17\u0e23\u0e41\u0e25\u0e49\u0e27 ${numberFormat(emp.called)} |
                                \u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e42\u0e17\u0e23 ${numberFormat(notCalled)}
                            </div>
                        </div>
                        <div class="emp-pct" style="color:${pctColor}">${pct}%</div>
                    </div>`;
            });

            if (sorted.length === 0) {
                grid.innerHTML = '<div style="color:var(--text-muted);padding:32px;text-align:center;">\u0e44\u0e21\u0e48\u0e21\u0e35\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25</div>';
            }
        }

        // Month pill click handlers
        document.querySelectorAll('.month-pill').forEach(pill => {
            pill.addEventListener('click', () => filterByMonth(pill.dataset.month));
        });
    </script>
</body>

</html>