<?php
/**
 * Batch Process Export API
 * 
 * Combines fetch + status update in ONE request:
 * 1. Fetch full order details (items, boxes, tracking, customer) in bulk
 * 2. Update order_status to targetStatus (e.g. Picking)
 * 3. Update customer lifecycle & ownership
 * 4. Log activities
 * 5. Return full order data for CSV generation
 *
 * POST body: {
 *   "orderIds": ["250101-00001", ...],
 *   "targetStatus": "Picking",
 *   "actorId": 123,
 *   "actorName": "John Doe"
 * }
 * Response: { "success": true, "processed": 24, "orders": [{ full order data }] }
 */
require_once '../config.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method Not Allowed'], 405);
}

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $orderIds = $input['orderIds'] ?? [];
    $targetStatus = $input['targetStatus'] ?? 'Picking';
    $actorId = $input['actorId'] ?? null;
    $actorName = $input['actorName'] ?? 'Unknown User';

    if (empty($orderIds)) {
        json_response(['success' => true, 'processed' => 0, 'orders' => [], 'message' => 'No orders provided']);
    }

    // Limit to 500
    $orderIds = array_slice($orderIds, 0, 500);

    $pdo = db_connect();
    set_audit_context($pdo, 'orders/batch_export');

    $pdo->beginTransaction();

    $placeholders = implode(',', array_fill(0, count($orderIds), '?'));

    // ═══════════════════════════════════════════════════════════
    // 1. Fetch full order data
    // ═══════════════════════════════════════════════════════════
    $orderSql = "
        SELECT o.*,
               c.first_name AS customer_first_name,
               c.last_name AS customer_last_name,
               c.phone AS customer_phone,
               c.street AS customer_street,
               c.subdistrict AS customer_subdistrict,
               c.district AS customer_district,
               c.province AS customer_province,
               c.postal_code AS customer_postal_code
        FROM orders o
        LEFT JOIN customers c ON c.customer_id = o.customer_id
        WHERE o.id IN ($placeholders)
    ";
    $stmt = $pdo->prepare($orderSql);
    $stmt->execute($orderIds);
    $ordersRaw = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($ordersRaw)) {
        $pdo->rollBack();
        json_response(['error' => 'No matching orders found'], 404);
    }

    // Index by order ID
    $ordersById = [];
    foreach ($ordersRaw as $o) {
        $ordersById[$o['id']] = $o;
        $ordersById[$o['id']]['items'] = [];
        $ordersById[$o['id']]['boxes'] = [];
        $ordersById[$o['id']]['tracking_details'] = [];
    }
    $foundIds = array_keys($ordersById);
    $foundPlaceholders = implode(',', array_fill(0, count($foundIds), '?'));

    // 1a. Fetch order_items
    $itemsSql = "
        SELECT oi.*, p.name AS product_name, p.sku, p.shop
        FROM order_items oi
        LEFT JOIN products p ON p.id = oi.product_id
        WHERE oi.parent_order_id IN ($foundPlaceholders)
        ORDER BY oi.parent_order_id, oi.id
    ";
    $itemsStmt = $pdo->prepare($itemsSql);
    $itemsStmt->execute($foundIds);
    foreach ($itemsStmt->fetchAll(PDO::FETCH_ASSOC) as $item) {
        $oid = $item['parent_order_id'];
        if (isset($ordersById[$oid])) {
            $ordersById[$oid]['items'][] = $item;
        }
    }

    // 1b. Fetch order_boxes
    $boxesSql = "
        SELECT ob.*
        FROM order_boxes ob
        WHERE ob.order_id IN ($foundPlaceholders)
        ORDER BY ob.order_id, ob.box_number
    ";
    $boxesStmt = $pdo->prepare($boxesSql);
    $boxesStmt->execute($foundIds);
    foreach ($boxesStmt->fetchAll(PDO::FETCH_ASSOC) as $box) {
        $oid = $box['order_id'];
        if (isset($ordersById[$oid])) {
            $ordersById[$oid]['boxes'][] = $box;
        }
    }

    // 1c. Fetch tracking numbers
    $trackSql = "
        SELECT otn.*
        FROM order_tracking_numbers otn
        WHERE otn.parent_order_id IN ($foundPlaceholders)
        ORDER BY otn.parent_order_id, otn.id
    ";
    $trackStmt = $pdo->prepare($trackSql);
    $trackStmt->execute($foundIds);
    foreach ($trackStmt->fetchAll(PDO::FETCH_ASSOC) as $track) {
        $oid = $track['parent_order_id'];
        if (isset($ordersById[$oid])) {
            $ordersById[$oid]['tracking_details'][] = $track;
        }
    }

    // ═══════════════════════════════════════════════════════════
    // 2. Update Order Status
    // ═══════════════════════════════════════════════════════════
    $updateStmt = $pdo->prepare("UPDATE orders SET order_status = ? WHERE id = ?");

    // Collect customer_id => delivery_date (or order_date as fallback)
    $customerSaleDates = [];
    $processedCount = 0;

    foreach ($ordersById as $orderId => &$order) {
        $updateStmt->execute([$targetStatus, $orderId]);

        if (!empty($order['customer_id'])) {
            // ใช้ delivery_date ถ้ามี ไม่งั้นใช้ order_date (เหมือน recordSale)
            $saleDate = $order['delivery_date'] ?? $order['order_date'] ?? date('Y-m-d');
            // ถ้า customer มีหลาย order ใน batch เดียวกัน ใช้อันล่าสุด
            if (!isset($customerSaleDates[$order['customer_id']]) || $saleDate > $customerSaleDates[$order['customer_id']]) {
                $customerSaleDates[$order['customer_id']] = $saleDate;
            }
        }
        $processedCount++;

        // Update local order data to reflect new status
        $order['order_status'] = $targetStatus;
    }
    unset($order);

    // ═══════════════════════════════════════════════════════════
    // 3. Update Customers (Lifecycle & Ownership)
    //    - ไม่แตะ assigned_to (ปล่อยให้ cron/basket routing จัดการ)
    //    - ใช้ delivery_date + 90 days สำหรับ ownership_expires (max 90 days จากวันนี้)
    //    - เหมือน logic ของ recordSale ใน ownership_handler.php
    // ═══════════════════════════════════════════════════════════
    if ($targetStatus === 'Picking' && !empty($customerSaleDates)) {
        $now = new DateTime();
        $maxAllowed = (clone $now)->add(new DateInterval('P90D'));

        $custStmt = $pdo->prepare("
            UPDATE customers 
            SET 
                lifecycle_status = 'Old3Months',
                ownership_expires = ?,
                has_sold_before = 1,
                last_sale_date = ?,
                follow_up_count = 0,
                followup_bonus_remaining = 1
            WHERE customer_id = ?
        ");

        foreach ($customerSaleDates as $custId => $saleDate) {
            $deliveryDate = new DateTime($saleDate);
            $newExpiry = (clone $deliveryDate)->add(new DateInterval('P90D'));

            // Cap at max 90 days from today (เหมือน recordSale)
            if ($newExpiry > $maxAllowed) {
                $newExpiry = clone $maxAllowed;
            }

            $custStmt->execute([
                $newExpiry->format('Y-m-d H:i:s'),
                $deliveryDate->format('Y-m-d H:i:s'),
                $custId
            ]);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // 4. Log Activities (Bulk Insert)
    // ═══════════════════════════════════════════════════════════
    if (!empty($actorId)) {
        $activitySql = "INSERT INTO activities (customer_id, type, description, actor_name, timestamp) VALUES ";
        $activityParams = [];
        $activityRows = [];
        $now = date('Y-m-d H:i:s');

        foreach ($ordersById as $orderId => $order) {
            if (empty($order['customer_id']))
                continue;

            $activityRows[] = "(?, ?, ?, ?, ?)";
            $activityParams[] = $order['customer_id'];
            $activityParams[] = 'OrderStatusChanged';
            $activityParams[] = "อัปเดตสถานะคำสั่งซื้อ {$orderId} เป็น '$targetStatus' (Batch Export)";
            $activityParams[] = $actorName;
            $activityParams[] = $now;
        }

        if (!empty($activityRows)) {
            $activitySql .= implode(',', $activityRows);
            $actStmt = $pdo->prepare($activitySql);
            $actStmt->execute($activityParams);
        }
    }

    $pdo->commit();

    // ═══════════════════════════════════════════════════════════
    // 4.5. Trigger Basket Routing V2 (AFTER commit)
    //      เหมือน hook ใน api/index.php lines 5869-5899
    //      ต้องอยู่หลัง commit เพราะ BasketRoutingServiceV2 มี transaction ของตัวเอง
    // ═══════════════════════════════════════════════════════════
    try {
        require_once __DIR__ . '/../Services/BasketRoutingServiceV2.php';
        $router = new BasketRoutingServiceV2($pdo);
        $routingResults = [];

        foreach ($ordersById as $orderId => $order) {
            try {
                $triggeredBy = $actorId ? (int)$actorId : 0;
                $result = $router->handleOrderStatusChange(
                    $orderId,
                    $targetStatus,
                    $triggeredBy
                );
                if ($result) {
                    $routingResults[$orderId] = $result;
                }
            } catch (Exception $routeError) {
                error_log("[BatchExport] Basket routing error for order #$orderId: " . $routeError->getMessage());
                $routingResults[$orderId] = ['error' => $routeError->getMessage()];
            }
        }
    } catch (Throwable $routeLoadError) {
        error_log("[BatchExport] Failed to load BasketRoutingServiceV2: " . $routeLoadError->getMessage());
        $routingResults = ['load_error' => $routeLoadError->getMessage()];
    }

    // ═══════════════════════════════════════════════════════════
    // 5. Return full order data for CSV generation
    // ═══════════════════════════════════════════════════════════
    json_response([
        'success' => true,
        'processed' => $processedCount,
        'customerUpdates' => count($customerSaleDates),
        'basketRouting' => $routingResults ?? [],
        'orders' => array_values($ordersById)
    ]);

} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Batch Export Error: " . $e->getMessage());
    json_response(['error' => 'Batch processing failed: ' . $e->getMessage()], 500);
}
?>