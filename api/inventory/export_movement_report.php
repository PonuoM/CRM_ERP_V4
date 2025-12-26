<?php
/**
 * Export Stock Movement Report
 * Filters: startDate, endDate, warehouseId, productId, type
 * Columns: Date, Document Number, Type, Created By, Quantity, Product, Warehouse, Reason, Balance (Running)
 */
header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename=stock_movement_report.csv');

require_once __DIR__ . '/../config.php';
$pdo = db_connect();

// Get Filters
$startDate = $_GET['startDate'] ?? date('Y-m-01');
$endDate = $_GET['endDate'] ?? date('Y-m-d');
$warehouseId = !empty($_GET['warehouseId']) ? $_GET['warehouseId'] : null;
$productId = !empty($_GET['productId']) ? $_GET['productId'] : null; // Can be text search or ID
$type = !empty($_GET['type']) ? $_GET['type'] : null;
$companyId = !empty($_GET['companyId']) ? $_GET['companyId'] : null; // Filter logic not fully implemented for company in stock tables yet?

// Output Stream
$output = fopen('php://output', 'w');
fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF)); // UTF-8 BOM

// Headlines
fputcsv($output, ['Stock Movement Report']);
fputcsv($output, ["Period: $startDate to $endDate"]);
fputcsv($output, []); // Empty line

// Headers
fputcsv($output, [
    'Date (วันที่)',
    'Document No. (เลขที่เอกสาร)',
    'Type (ประเภท)',
    'Product (สินค้า)',
    'Warehouse (คลัง)',
    'Lot Number (Lot)',
    'Quantity (จำนวน)',
    'Movement Type (สถานะ)',
    'Created By (ผู้ทำรายการ)',
    'Document Remark (หมายเหตุเอกสาร)',
    'Item Remark (หมายเหตุรายรุ่น)'
]);

try {
    // 1. Build Query
    $where = ["sm.created_at BETWEEN ? AND ?"];
    $params = ["$startDate 00:00:00", "$endDate 23:59:59"];

    if ($warehouseId) {
        $where[] = "sm.warehouse_id = ?";
        $params[] = $warehouseId;
    }

    if ($productId) {
        // If numeric, ID. If string, search name/sku.
        if (is_numeric($productId)) {
            $where[] = "sm.product_id = ?";
            $params[] = $productId;
        } else {
            $where[] = "(p.sku LIKE ? OR p.name LIKE ?)";
            $params[] = "%$productId%";
            $params[] = "%$productId%";
        }
    }

    if ($type) {
        $where[] = "sm.movement_type = ?";
        $params[] = $type;
    }

    if ($companyId) {
        $where[] = "w.company_id = ?";
        $params[] = $companyId;
    }

    $sql = "SELECT 
                sm.created_at,
                sm.document_number,
                sm.movement_type,
                sm.quantity,
                sm.lot_number,
                sm.reason,
                CASE 
                    WHEN sm.reference_type = 'stock_transactions' THEN (SELECT remarks FROM stock_transaction_items sti WHERE sti.transaction_id = sm.reference_id AND sti.product_id = sm.product_id LIMIT 1)
                    WHEN sm.reference_type = 'order_item_allocations' THEN (SELECT notes FROM order_item_allocations oia WHERE oia.id = sm.reference_id LIMIT 1)
                    ELSE NULL
                END as item_remark,
                p.sku as product_code,
                p.name as product_name,
                w.name as warehouse_name,
                CONCAT(u.first_name, ' ', u.last_name) as user_name
            FROM stock_movements sm
            LEFT JOIN products p ON sm.product_id = p.id
            LEFT JOIN warehouses w ON sm.warehouse_id = w.id
            LEFT JOIN users u ON sm.created_by = u.id
            WHERE " . implode(" AND ", $where) . "
            ORDER BY sm.created_at ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        // Map Type
        $moveTypeDisplay = $row['movement_type'];
        if ($moveTypeDisplay === 'IN') $moveTypeDisplay = 'รับเข้า';
        elseif ($moveTypeDisplay === 'OUT') $moveTypeDisplay = 'จ่ายออก';
        elseif ($moveTypeDisplay === 'ADJUSTMENT') $moveTypeDisplay = 'ปรับปรุง';
        elseif ($moveTypeDisplay === 'Edit Document') $moveTypeDisplay = 'แก้ไขเอกสาร';
        elseif ($moveTypeDisplay === 'Delete Document') $moveTypeDisplay = 'ลบเอกสาร';

        fputcsv($output, [
            $row['created_at'],
            $row['document_number'],
            $moveTypeDisplay,
            $row['product_code'] . ' - ' . $row['product_name'],
            $row['warehouse_name'],
            $row['lot_number'],
            $row['quantity'],
            $row['movement_type'], // Keep raw or just display? Using formatted above.
            $row['user_name'],
            $row['reason'],
            $row['item_remark']
        ]);
    }

} catch (Exception $e) {
    fputcsv($output, ['Error generating report: ' . $e->getMessage()]);
}

fclose($output);
exit;
