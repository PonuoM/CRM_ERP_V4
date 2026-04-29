<?php
// api/Distribution/export_distribution.php
require_once __DIR__ . '/../config.php';

$pdo = db_connect();

$company_id = (int)($_GET['companyId'] ?? 1);
$basket_key = $_GET['basket_key'] ?? '';
$start_date = $_GET['start_date'] ?? '';
$end_date = $_GET['end_date'] ?? '';

$where = "WHERE log.transition_type = 'distribute' AND c.company_id = ?";
$params = [$company_id];

if ($basket_key) {
    if ($basket_key === 'upsell_dis') {
         $where .= " AND log.from_basket_key = ?";
         $params[] = $basket_key;
    } else {
         $where .= " AND log.from_basket_key = ?";
         $params[] = $basket_key;
    }
}

if ($start_date) {
    $where .= " AND DATE(log.created_at) >= ?";
    $params[] = $start_date;
}

if ($end_date) {
    $where .= " AND DATE(log.created_at) <= ?";
    $params[] = $end_date;
}

$sql = "
    SELECT 
        log.created_at as distribute_date,
        c.customer_id,
        c.first_name,
        c.last_name,
        c.phone,
        log.from_basket_key,
        log.to_basket_key,
        u_new.first_name as new_agent_first,
        u_new.last_name as new_agent_last,
        u_trigger.first_name as trigger_first,
        u_trigger.last_name as trigger_last
    FROM basket_transition_log log
    LEFT JOIN customers c ON c.customer_id = log.customer_id
    LEFT JOIN users u_new ON u_new.id = log.assigned_to_new
    LEFT JOIN users u_trigger ON u_trigger.id = log.triggered_by
    $where
    ORDER BY log.created_at DESC
";

try {
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $format = $_GET['format'] ?? 'csv';

    if ($format === 'json') {
        $data = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $data[] = $row;
        }
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['ok' => true, 'data' => $data]);
        exit;
    }

    header('Content-Type: text/csv; charset=utf-8');
    header("Content-Disposition: attachment; filename=\"distribution_history_" . date('Y-m-d') . ".csv\"");
    $output = fopen('php://output', 'w');
    // Add BOM for Excel UTF-8 support
    fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));

    $headers = [
        'วันที่จ่ายออก', 'รหัสลูกค้า', 'ชื่อลูกค้า', 'นามสกุล', 'เบอร์โทรศัพท์', 
        'จากตะกร้า', 'ไปตะกร้า', 'ผู้รับงาน (Telesale)', 'ผู้ดำเนินการแจก (Supervisor)'
    ];
    fputcsv($output, $headers);

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $formattedDate = $row['distribute_date'] ? date('d/m/Y H:i', strtotime($row['distribute_date'])) : '-';
        
        $newAgentName = trim(($row['new_agent_first'] ?? '') . ' ' . ($row['new_agent_last'] ?? ''));
        $triggerName = trim(($row['trigger_first'] ?? '') . ' ' . ($row['trigger_last'] ?? ''));

        $exportRow = [
            $formattedDate,
            $row['customer_id'],
            $row['first_name'] ?? '-',
            $row['last_name'] ?? '-',
            $row['phone'] ?? '-',
            $row['from_basket_key'] ?? '-',
            $row['to_basket_key'] ?? '-',
            $newAgentName ?: '-',
            $triggerName ?: '-'
        ];
        fputcsv($output, $exportRow);
    }

    fclose($output);
    exit;

} catch (Exception $e) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
