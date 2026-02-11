<?php
require_once '../config.php';

cors();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_response(['error' => 'Method not allowed'], 405);
}

try {
    $pdo = db_connect();

    $user = get_authenticated_user($pdo);
    if (!$user) {
        json_response(['error' => 'UNAUTHORIZED'], 401);
    }

    // Parameters
    $startDate = $_GET['startDate'] ?? null;
    $endDate = $_GET['endDate'] ?? null;
    $exportType = $_GET['type'] ?? 'history'; // 'history' or 'orders'
    $status = $_GET['status'] ?? 'all'; // 'active', 'completed', 'all'

    $whereConditions = [];
    $params = [];

    if ($exportType === 'history') {
        // ===== Export: ประวัติการติดตาม (แต่ละ record) =====
        
        // Company filter
        $companyId = isset($_GET['companyId']) ? (int) $_GET['companyId'] : ($user['company_id'] ?? 0);
        if ($companyId > 0) {
            $whereConditions[] = "o.company_id = ?";
            $params[] = $companyId;
        }

        // Date filter on debt_collection.created_at
        if ($startDate) {
            $whereConditions[] = "dc.created_at >= ?";
            $params[] = $startDate . ' 00:00:00';
        }
        if ($endDate) {
            $whereConditions[] = "dc.created_at <= ?";
            $params[] = $endDate . ' 23:59:59';
        }

        // Exclude sub-orders
        $whereConditions[] = "o.id NOT REGEXP '^.+-[0-9]+$'";

        // Status filter (active/completed)
        if ($status === 'active') {
            $whereConditions[] = "NOT EXISTS (SELECT 1 FROM debt_collection dc_check WHERE dc_check.order_id = o.id AND dc_check.is_complete = 1)";
        } elseif ($status === 'completed') {
            $whereConditions[] = "EXISTS (SELECT 1 FROM debt_collection dc_check WHERE dc_check.order_id = o.id AND dc_check.is_complete = 1)";
        }

        $whereClause = !empty($whereConditions) ? 'WHERE ' . implode(' AND ', $whereConditions) : '';

        $sql = "SELECT 
                    dc.id as tracking_id,
                    dc.order_id,
                    dc.amount_collected,
                    dc.result_status,
                    dc.is_complete,
                    dc.note,
                    dc.created_at as tracking_date,
                    o.total_amount,
                    o.order_status,
                    o.payment_status,
                    o.delivery_date,
                    o.order_date,
                    c.first_name as customer_first_name,
                    c.last_name as customer_last_name,
                    c.phone as customer_phone,
                    u.first_name as tracker_first_name,
                    u.last_name as tracker_last_name,
                    (SELECT COALESCE(SUM(dc2.amount_collected), 0) FROM debt_collection dc2 WHERE dc2.order_id = dc.order_id) as total_collected
                FROM debt_collection dc
                JOIN orders o ON dc.order_id = o.id
                LEFT JOIN customers c ON o.customer_id = c.customer_id
                LEFT JOIN users u ON dc.user_id = u.id
                $whereClause
                ORDER BY dc.created_at DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $records = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $statusMap = [1 => 'เก็บไม่ได้', 2 => 'เก็บได้บางส่วน', 3 => 'เก็บได้ทั้งหมด'];
        $orderStatusMap = [
            'Pending' => 'รอดำเนินการ', 'Confirmed' => 'ยืนยันแล้ว', 'Picking' => 'กำลังแพ็ค',
            'Shipping' => 'กำลังจัดส่ง', 'Delivered' => 'ส่งแล้ว', 'Cancelled' => 'ยกเลิก',
            'Returned' => 'คืนสินค้า', 'Claiming' => 'เคลม', 'BadDebt' => 'หนี้สูญ', 'PreApproved' => 'รอตรวจสอบ'
        ];
        $paymentStatusMap = [
            'Unpaid' => 'ยังไม่ชำระ', 'PendingVerification' => 'รอตรวจสอบ',
            'Approved' => 'อนุมัติแล้ว', 'Rejected' => 'ปฏิเสธ'
        ];

        $formatted = array_map(function ($r) use ($statusMap, $orderStatusMap, $paymentStatusMap) {
            return [
                'trackingId' => $r['tracking_id'],
                'orderId' => $r['order_id'],
                'customerName' => trim($r['customer_first_name'] . ' ' . $r['customer_last_name']),
                'customerPhone' => $r['customer_phone'],
                'orderDate' => $r['order_date'],
                'deliveryDate' => $r['delivery_date'],
                'totalAmount' => (float) $r['total_amount'],
                'amountCollected' => (float) $r['amount_collected'],
                'totalCollected' => (float) $r['total_collected'],
                'remainingDebt' => max(0, (float) $r['total_amount'] - (float) $r['total_collected']),
                'resultStatus' => $statusMap[(int) $r['result_status']] ?? $r['result_status'],
                'isComplete' => (int) $r['is_complete'],
                'note' => $r['note'],
                'trackingDate' => $r['tracking_date'],
                'trackerName' => trim($r['tracker_first_name'] . ' ' . $r['tracker_last_name']),
                'orderStatus' => $orderStatusMap[$r['order_status']] ?? $r['order_status'],
                'paymentStatus' => $paymentStatusMap[$r['payment_status']] ?? $r['payment_status']
            ];
        }, $records);

        json_response([
            'ok' => true,
            'type' => 'history',
            'records' => $formatted,
            'total' => count($formatted)
        ]);

    } else {
        // ===== Export: ข้อมูลออเดอร์ (เดิม - redirect ไป get_debt_collection_orders) =====
        // ใช้ logic เดิมจาก get_debt_collection_orders.php
        json_response(['ok' => false, 'error' => 'Use get_debt_collection_orders.php for order export'], 400);
    }

} catch (Exception $e) {
    error_log("Export Debt Collection Error: " . $e->getMessage());
    json_response(['ok' => false, 'error' => $e->getMessage()], 500);
}
