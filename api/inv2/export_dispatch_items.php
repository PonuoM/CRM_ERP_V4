<?php
// Export Dispatch Items CSV
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config.php';
$pdo = db_connect();

try {
    $companyId = $_GET['company_id'] ?? null;
    $startDate = $_GET['start_date'] ?? null;
    $endDate = $_GET['end_date'] ?? null;

    if (!$companyId) {
        throw new Exception("company_id is required");
    }

    $where = ["b.company_id = ?"];
    $params = [$companyId];

    if ($startDate && $endDate) {
        $where[] = "DATE(b.created_at) BETWEEN ? AND ?";
        $params[] = $startDate;
        $params[] = $endDate;
    }

    $whereSql = implode(" AND ", $where);

    $sql = "SELECT i.*, b.batch_doc_number, b.created_at as batch_created_at
            FROM inv2_dispatch_items i
            JOIN inv2_dispatch_batches b ON i.batch_id = b.id
            WHERE $whereSql
            ORDER BY b.created_at DESC, i.id ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    
    // Set headers for CSV download
    $filename = "dispatch_export_" . date('Ymd_His') . ".csv";
    if ($startDate && $endDate) {
        $filename = "dispatch_export_{$startDate}_to_{$endDate}.csv";
    }

    header('Content-Type: text/csv; charset=UTF-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');

    // Clean output buffer to ensure purely CSV output
    if (ob_get_level()) ob_end_clean();

    $output = fopen('php://output', 'w');
    // Add UTF-8 BOM for Excel
    fputs($output, "\xEF\xBB\xBF");

    // CSV Headers
    fputcsv($output, [
        'หมายเลข Batch (อ้างอิง)',
        'เวลาที่ Import',
        'รหัสสินค้า',
        'ชื่อสินค้า',
        'รหัสรูปแบบ',
        'รูปแบบสินค้า',
        'หมายเลขออเดอร์ภายใน',
        'หมายเลขคำสั่งซื้อออนไลน์',
        'จำนวน',
        'ราคาสินค้าทั้งหมด',
        'วันที่สั่งซื้อ',
        'วันที่จัดส่ง',
        'สถานะคำสั่งซื้อ',
        'แพลตฟอร์ม',
        'ร้านค้า',
        'คลังส่งสินค้า',
        'หมายเลขพัสดุ',
        'สถานะ',
        'สถานะหักคลัง'
    ]);

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        fputcsv($output, [
            $row['batch_doc_number'],
            $row['batch_created_at'],
            $row['product_sku'],
            $row['product_name'],
            $row['variant_code'],
            $row['variant_name'],
            $row['internal_order_id'],
            $row['online_order_id'],
            $row['quantity'],
            $row['total_price'],
            $row['order_date'],
            $row['ship_date'],
            $row['order_status'],
            $row['platform'],
            $row['shop'],
            $row['warehouse_name'],
            $row['tracking_number'],
            $row['status'],
            ($row['stock_deducted'] == '1') ? 'Yes' : 'No'
        ]);
    }

    fclose($output);
    exit;

} catch (Exception $e) {
    http_response_code(500);
    echo "Error: " . $e->getMessage();
    exit;
}
