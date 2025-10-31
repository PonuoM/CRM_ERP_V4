<?php
require_once __DIR__ . "/../config.php";

cors();

try {
    $pdo = db_connect();

    // Get query parameters
    $dateFrom = isset($_GET["date_from"]) ? $_GET["date_from"] : null;
    $dateTo = isset($_GET["date_to"]) ? $_GET["date_to"] : null;
    $pageIds = isset($_GET["page_ids"]) ? $_GET["page_ids"] : null;

    // Build WHERE conditions
    $whereConditions = [];
    $params = [];

    if ($pageIds) {
        $pageIdArray = explode(",", $pageIds);
        $pageIdArray = array_map("intval", $pageIdArray);
        $pageIdArray = array_filter($pageIdArray);
        if (!empty($pageIdArray)) {
            $placeholders = str_repeat("?,", count($pageIdArray) - 1) . "?";
            $whereConditions[] = "mal.page_id IN ($placeholders)";
            $params = array_merge($params, $pageIdArray);
        }
    }

    if ($dateFrom) {
        $whereConditions[] = "mal.date >= ?";
        $params[] = $dateFrom;
    }

    if ($dateTo) {
        $whereConditions[] = "mal.date <= ?";
        $params[] = $dateTo;
    }

    $whereClause = !empty($whereConditions)
        ? "WHERE " . implode(" AND ", $whereConditions)
        : "";

    // Main query to get ads log data
    $sql = "
        SELECT
            mal.id,
            mal.date,
            mal.ads_cost,
            mal.impressions,
            mal.reach,
            mal.clicks,
            mal.created_at,
            p.name as page_name,
            p.platform as page_platform,
            CONCAT(u.first_name, ' ', u.last_name) as user_fullname,
            u.username as user_username
        FROM marketing_ads_log mal
        LEFT JOIN pages p ON mal.page_id = p.id
        LEFT JOIN users u ON mal.user_id = u.id
        {$whereClause}
        ORDER BY mal.date DESC, mal.created_at DESC
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $logs = $stmt->fetchAll();

    // Set headers for CSV download
    header('Content-Type: text/csv; charset=UTF-8');
    header('Content-Disposition: attachment; filename="marketing_ads_log_' . date('Y-m-d_H-i-s') . '.csv"');
    header('Cache-Control: no-cache, must-revalidate');
    header('Expires: Sat, 26 Jul 1997 05:00:00 GMT');

    // Open output stream
    $output = fopen('php://output', 'w');

    // Add BOM for UTF-8 (to fix Thai characters in Excel)
    fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));

    // CSV headers in Thai
    $headers = [
        'ID',
        'วันที่',
        'ชื่อเพจ',
        'แพลตฟอร์ม',
        'ผู้ใช้งาน',
        'ชื่อผู้ใช้',
        'ค่าโฆษณา (บาท)',
        'การแสดงผล (Impressions)',
        'การเข้าถึง (Reach)',
        'การคลิก (Clicks)',
        'วันที่สร้าง'
    ];

    // Write headers
    fputcsv($output, $headers);

    // Write data rows
    foreach ($logs as $log) {
        $row = [
            $log['id'],
            $log['date'],
            $log['page_name'] ?: '',
            $log['page_platform'] ?: '',
            $log['user_fullname'] ?: '',
            $log['user_username'] ?: '',
            number_format($log['ads_cost'], 2, '.', ','),
            number_format($log['impressions'], 0, '.', ','),
            number_format($log['reach'], 0, '.', ','),
            number_format($log['clicks'], 0, '.', ','),
            $log['created_at']
        ];
        fputcsv($output, $row);
    }

    // Close output stream
    fclose($output);
    exit;

} catch (Exception $e) {
    error_log("Error in ads_log_export_csv.php: " . $e->getMessage());

    // Return error response
    header('Content-Type: application/json');
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "error" => $e->getMessage(),
        "message" => "Failed to export CSV"
    ]);
}
?>
