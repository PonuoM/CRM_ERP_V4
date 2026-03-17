<?php
/**
 * Export Commission Orders as CSV
 * GET ?company_id=&status=pending|calculated|incomplete|all&start_date=&end_date=
 * Template mirrors ReportsPage detailed order export + commission columns
 */
require_once __DIR__ . "/../config.php";

try {
    $pdo = db_connect();

    $company_id = (int)($_GET['company_id'] ?? 0);
    $status = $_GET['status'] ?? 'all';
    $start_date = $_GET['start_date'] ?? null;
    $end_date = $_GET['end_date'] ?? null;

    $where = "WHERE 1=1";
    $params = [];

    if ($company_id > 0) {
        $where .= " AND o.company_id = ?";
        $params[] = $company_id;
    }

    // Filter sub-orders
    $where .= " AND o.id NOT REGEXP '-[0-9]+$'";

    if ($start_date) {
        $where .= " AND o.order_date >= ?";
        $params[] = $start_date;
    }
    if ($end_date) {
        $where .= " AND o.order_date <= ?";
        $params[] = $end_date . ' 23:59:59';
    }

    // Status filter
    switch ($status) {
        case 'calculated':
            $where .= " AND cso.order_id IS NOT NULL";
            break;
        case 'pending':
            $where .= " AND cso.order_id IS NULL AND o.payment_status = 'Approved'";
            break;
        case 'incomplete':
            $where .= " AND cso.order_id IS NULL AND (o.payment_status != 'Approved' OR o.payment_status IS NULL)";
            break;
        // 'all' — no extra filter
    }

    $sql = "
        SELECT
            o.id as order_id,
            o.order_date,
            o.creator_id,
            o.customer_id,
            o.delivery_date,
            o.sales_channel,
            o.sales_channel_page_id,
            o.payment_method,
            o.payment_status,
            o.order_status,
            o.total_amount,
            o.amount_paid,
            o.street, o.subdistrict, o.district, o.province, o.postal_code,
            o.recipient_first_name, o.recipient_last_name,
            o.customer_type,
            o.slip_url,
            oi.id as item_id,
            oi.product_id,
            oi.product_name,
            oi.quantity,
            oi.price_per_unit,
            oi.discount,
            oi.net_total,
            oi.is_freebie,
            oi.box_number,
            oi.promotion_id,
            oi.parent_item_id,
            oi.is_promotion_parent,
            oi.creator_id as item_creator_id,
            p.sku as product_sku,
            p.category as product_category,
            p.report_category as product_report_category,
            c.first_name as customer_first_name,
            c.last_name as customer_last_name,
            c.phone as customer_phone,
            c.lifecycle_status,
            u.first_name as creator_first_name,
            u.last_name as creator_last_name,
            u.role as creator_role,
            iu.first_name as item_creator_first_name,
            iu.last_name as item_creator_last_name,
            iu.role as item_creator_role,
            cso.commission_amount as stamp_commission,
            cso.user_id as stamp_user_id,
            cso.stamped_at as stamp_date,
            cso.note as stamp_note,
            csb.name as stamp_batch_name,
            su.first_name as stamp_by_first, su.last_name as stamp_by_last
        FROM orders o
        LEFT JOIN order_items oi ON oi.parent_order_id = o.id
        LEFT JOIN products p ON p.id = oi.product_id
        LEFT JOIN customers c ON c.customer_id = o.customer_id
        LEFT JOIN users u ON u.id = o.creator_id
        LEFT JOIN users iu ON iu.id = oi.creator_id
        LEFT JOIN (
            SELECT order_id, 
                   GROUP_CONCAT(DISTINCT commission_amount) as commission_amount,
                   GROUP_CONCAT(DISTINCT user_id) as user_id,
                   MIN(stamped_at) as stamped_at,
                   GROUP_CONCAT(DISTINCT note SEPARATOR '; ') as note,
                   MIN(batch_id) as batch_id,
                   MIN(stamped_by) as stamped_by
            FROM commission_stamp_orders
            GROUP BY order_id
        ) cso ON cso.order_id = o.id
        LEFT JOIN commission_stamp_batches csb ON csb.id = cso.batch_id
        LEFT JOIN users su ON su.id = cso.stamped_by
        $where
        ORDER BY o.order_date DESC, o.id, oi.id
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Region mapping
    $regionMap = [
        'กรุงเทพมหานคร' => 'ภาคกลาง', 'นนทบุรี' => 'ภาคกลาง', 'ปทุมธานี' => 'ภาคกลาง',
        'สมุทรปราการ' => 'ภาคกลาง', 'สมุทรสาคร' => 'ภาคกลาง', 'นครปฐม' => 'ภาคกลาง',
        'อยุธยา' => 'ภาคกลาง', 'พระนครศรีอยุธยา' => 'ภาคกลาง',
        'เชียงใหม่' => 'ภาคเหนือ', 'เชียงราย' => 'ภาคเหนือ', 'ลำปาง' => 'ภาคเหนือ',
        'ขอนแก่น' => 'ภาคอีสาน', 'อุดรธานี' => 'ภาคอีสาน', 'นครราชสีมา' => 'ภาคอีสาน',
        'ชลบุรี' => 'ภาคตะวันออก', 'ระยอง' => 'ภาคตะวันออก',
        'ราชบุรี' => 'ภาคตะวันตก', 'กาญจนบุรี' => 'ภาคตะวันตก',
        'ภูเก็ต' => 'ภาคใต้', 'สุราษฎร์ธานี' => 'ภาคใต้', 'สงขลา' => 'ภาคใต้',
    ];

    $statusThai = [
        'Pending' => 'รอดำเนินการ', 'Confirmed' => 'ยืนยันแล้ว',
        'Picking' => 'กำลังจัดเตรียม', 'Shipping' => 'กำลังจัดส่ง',
        'Delivered' => 'จัดส่งสำเร็จ', 'Cancelled' => 'ยกเลิก',
        'Returned' => 'ตีกลับ', 'BadDebt' => 'หนี้สูญ', 'PreApproved' => 'รออนุมัติ'
    ];

    $customerTypeThai = [
        'New Customer' => 'ลูกค้าใหม่',
        'Reorder Customer' => 'ลูกค้ารีออเดอร์',
        'Reorder' => 'ลูกค้ารีออเดอร์'
    ];

    // Build CSV
    $headers = [
        'วันที่สั่งซื้อ', 'เลขคำสั่งซื้อ', 'user_id', 'ผู้ขาย', 'แผนก',
        'ชื่อลูกค้า', 'เบอร์โทรลูกค้า', 'ประเภทลูกค้า',
        'วันที่จัดส่ง', 'ช่องทางสั่งซื้อ', 'ช่องทางการชำระ',
        'ที่อยู่', 'ตำบล', 'อำเภอ', 'จังหวัด', 'รหัสไปรษณีย์', 'ภาค',
        'รหัสสินค้า/โปร', 'สินค้า', 'ประเภทสินค้า', 'ประเภทสินค้า (รีพอร์ต)',
        'ของแถม', 'จำนวน (ชิ้น)', 'ราคาต่อหน่วย', 'ส่วนลด', 'ยอดรวมรายการ',
        'หมายเลขกล่อง',
        'สถานะออเดอร์', 'สถานะการชำระเงิน',
        // Commission columns
        'สถานะค่าคอม', 'รอบ Stamp', 'ค่าคอม', 'ผู้ได้รับค่าคอม (user_id)', 'วันที่ Stamp', 'หมายเหตุ Stamp'
    ];

    // Output CSV
    header('Content-Type: text/csv; charset=utf-8');
    $statusLabel = $status === 'all' ? 'all' : $status;
    $filename = "commission_orders_{$statusLabel}_" . date('Y-m-d') . ".csv";
    header("Content-Disposition: attachment; filename=\"$filename\"");

    $output = fopen('php://output', 'w');
    // BOM for Excel Thai
    fprintf($output, chr(0xEF) . chr(0xBB) . chr(0xBF));
    fputcsv($output, $headers);

    foreach ($rows as $row) {
        $creatorId = $row['item_creator_id'] ?? $row['creator_id'];
        $creatorName = ($row['item_creator_first_name'] ?? $row['creator_first_name'] ?? '') . ' ' . ($row['item_creator_last_name'] ?? $row['creator_last_name'] ?? '');
        $creatorRole = $row['item_creator_role'] ?? $row['creator_role'] ?? '-';

        $customerName = trim(($row['customer_first_name'] ?? '') . ' ' . ($row['customer_last_name'] ?? ''));
        if (!$customerName) $customerName = trim(($row['recipient_first_name'] ?? '') . ' ' . ($row['recipient_last_name'] ?? ''));

        $province = $row['province'] ?? '';
        $region = $regionMap[$province] ?? 'ไม่ทราบภาค';

        $productCode = '-';
        if ($row['is_promotion_parent']) {
            $productCode = $row['promotion_id'] ? 'PROMO-' . str_pad($row['promotion_id'], 3, '0', STR_PAD_LEFT) : '-';
        } elseif ($row['promotion_id']) {
            $productCode = 'PROMO-' . str_pad($row['promotion_id'], 3, '0', STR_PAD_LEFT);
        } elseif ($row['product_sku']) {
            $productCode = $row['product_sku'];
        }

        $productName = $row['product_name'] ?? '-';
        if ($row['is_promotion_parent']) $productName = '📦 ' . $productName;
        elseif ($row['is_freebie']) $productName .= ' (ของแถม)';

        $qty = (int)($row['quantity'] ?? 0);
        $price = (float)($row['price_per_unit'] ?? 0);
        $discount = (float)($row['discount'] ?? 0);
        $netTotal = (float)($row['net_total'] ?? 0);
        $itemTotal = $row['is_freebie'] ? 0 : (($qty * $price - $discount) > 0 ? ($qty * $price - $discount) : $netTotal);

        $paid = (float)($row['amount_paid'] ?? 0);
        $total = (float)($row['total_amount'] ?? 0);
        $paymentComparison = $total == 0 ? 'ไม่มียอด' : ($paid == 0 ? 'ค้าง' : ($paid == $total ? 'ตรง' : ($paid < $total ? 'ขาด' : 'เกิน')));

        $commissionStatus = $row['stamp_commission'] !== null || $row['stamp_user_id'] !== null || $row['stamp_date'] !== null
            ? 'คิดค่าคอมแล้ว'
            : ($row['payment_status'] === 'Approved' ? 'รอคิดค่าคอม' : 'ยังไม่สำเร็จ');

        fputcsv($output, [
            $row['order_date'] ? date('d/m/Y', strtotime($row['order_date'])) : '-',
            $row['order_id'],
            $creatorId ?? '',
            trim($creatorName) ?: '-',
            $creatorRole,
            $customerName ?: '-',
            $row['customer_phone'] ?? '-',
            $customerTypeThai[$row['customer_type'] ?? ''] ?? ($row['customer_type'] ?? '-'),
            $row['delivery_date'] ? date('d/m/Y', strtotime($row['delivery_date'])) : '-',
            $row['sales_channel'] ?? '-',
            $row['payment_method'] ?? '-',
            $row['street'] ?? '-',
            $row['subdistrict'] ?? '-',
            $row['district'] ?? '-',
            $province ?: '-',
            $row['postal_code'] ?? '-',
            $region,
            $productCode,
            $productName,
            $row['product_category'] ?? '-',
            $row['product_report_category'] ?? '-',
            $row['is_freebie'] ? 'ใช่' : 'ไม่',
            $qty,
            $price,
            $discount,
            $itemTotal,
            $row['box_number'] ?? 1,
            $statusThai[$row['order_status'] ?? ''] ?? ($row['order_status'] ?? '-'),
            $paymentComparison,
            // Commission columns
            $commissionStatus,
            $row['stamp_batch_name'] ?? '-',
            $row['stamp_commission'] ?? '-',
            $row['stamp_user_id'] ?? '-',
            $row['stamp_date'] ? date('d/m/Y H:i', strtotime($row['stamp_date'])) : '-',
            $row['stamp_note'] ?? '-'
        ]);
    }

    fclose($output);
    exit;

} catch (Exception $e) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
