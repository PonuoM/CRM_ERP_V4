<?php
/**
 * Export Call History as CSV/JSON
 * GET ?company_id=&start_date=&end_date=&format=
 */
require_once __DIR__ . "/../config.php";

function formatCsvRow(array $row): array {
    $date = $row['call_date'] ? date('d/m/Y H:i', strtotime($row['call_date'])) : '-';
    
    // Format duration from seconds to mm:ss
    $durationSec = (int)($row['duration'] ?? 0);
    $duration = sprintf('%02d:%02d', floor($durationSec / 60), $durationSec % 60);

    return [
        $date,
        $row['caller'] ?? '-',
        trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? '')) ?: '-',
        $row['phone'] ?? '-',
        $row['status'] ?? '-',
        $row['result'] ?? '-',
        $row['crop_type'] ?? '-',
        $row['area_size'] ?? '-',
        $row['notes'] ?? '-',
        $duration
    ];
}

try {
    $pdo = db_connect();
    set_time_limit(300);

    // Get authentication to support role-based filtering if needed
    // The ReportsPage will send token via headers or GET parameter
    // If you need strict auth, you can call validate_auth($pdo);
    // But since it's an export link, it usually passes token via GET ?token=...
    $user = get_authenticated_user($pdo);
    $isAdmin = $user && strtolower($user['role'] ?? '') === 'superadmin';

    $company_id = (int)($_GET['company_id'] ?? 0);
    $start_date = $_GET['start_date'] ?? null;
    $end_date = $_GET['end_date'] ?? null;

    $where = "WHERE 1=1";
    $params = [];

    if ($company_id > 0) {
        $where .= " AND c.company_id = ?";
        $params[] = $company_id;
    }

    if ($start_date) {
        $where .= " AND DATE(ch.date) >= ?";
        $params[] = $start_date;
    }
    if ($end_date) {
        $where .= " AND DATE(ch.date) <= ?";
        $params[] = $end_date;
    }

    $sql = "
        SELECT 
            ch.date as call_date, 
            ch.caller,
            ch.status, 
            ch.result, 
            ch.crop_type, 
            ch.area_size, 
            ch.notes, 
            ch.duration,
            c.first_name, 
            c.last_name, 
            c.phone,
            c.company_id
        FROM call_history ch
        LEFT JOIN customers c ON ch.customer_id = c.customer_id
        $where
        ORDER BY ch.date DESC
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $headers = [
        'วันที่โทร', 'ผู้ติดต่อ (Agent)', 'ชื่อลูกค้า', 'เบอร์โทร', 
        'สถานะ', 'ผลลัพธ์', 'พืชที่ปลูก', 'ขนาดพื้นที่', 
        'หมายเหตุ', 'ระยะเวลา (นาที:วินาที)'
    ];

    $format = $_GET['format'] ?? 'csv';

    if ($format === 'preview') {
        header('Content-Type: application/json; charset=utf-8');
        $previewRows = [];
        $limit = min(count($rows), 15);
        for ($i = 0; $i < $limit; $i++) {
            $rowArray = formatCsvRow($rows[$i]);
            $obj = [];
            foreach ($headers as $index => $header) {
                $obj[$header] = $rowArray[$index];
            }
            $previewRows[] = $obj;
        }
        echo json_encode(['ok' => true, 'data' => $previewRows]);
        exit;
    }

    if ($format === 'json') {
        header('Content-Type: application/json; charset=utf-8');
        $jsonRows = [$headers];
        foreach ($rows as $row) {
            $jsonRows[] = formatCsvRow($row);
        }
        echo json_encode(['ok' => true, 'data' => $jsonRows]);
        exit;
    }

    header('Content-Type: text/csv; charset=utf-8');
    $filename = "call_history_" . date('Y-m-d') . ".csv";
    header("Content-Disposition: attachment; filename=\"$filename\"");

    $output = fopen('php://output', 'w');
    fprintf($output, chr(0xEF) . chr(0xBB) . chr(0xBF));
    fputcsv($output, $headers);

    foreach ($rows as $row) {
        fputcsv($output, formatCsvRow($row));
    }

    fclose($output);
    unset($rows);
    exit;

} catch (Exception $e) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
