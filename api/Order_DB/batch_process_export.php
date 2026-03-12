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
require_once __DIR__ . '/../Services/BasketRoutingServiceV2.php';

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

    // Create basket router instance
    $basketRouter = new BasketRoutingServiceV2($pdo);

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

    $customerUpdates = [];
    $processedCount = 0;
    $basketRoutingResults = [];

    foreach ($ordersById as $orderId => &$order) {
        $updateStmt->execute([$targetStatus, $orderId]);

        if (!empty($order['customer_id']) && !empty($order['creator_id'])) {
            $customerUpdates[$order['customer_id']] = $order['creator_id'];
        }
        $processedCount++;

        // ═══════════════════════════════════════════════════════════
        // 2b. Trigger Basket Routing (Event-Driven)
        //     This updates current_basket_key based on business rules
        // ═══════════════════════════════════════════════════════════
        try {
            $routeResult = $basketRouter->handleOrderStatusChange(
                $orderId, 
                $targetStatus, 
                (int) ($actorId ?? 0)
            );
            if ($routeResult) {
                $basketRoutingResults[] = $routeResult;
                error_log("[BatchExport] Basket routing for order $orderId: " . json_encode($routeResult));
            }
        } catch (Exception $routeEx) {
            // Don't fail the entire batch for a routing error
            error_log("[BatchExport] Basket routing error for order $orderId: " . $routeEx->getMessage());
        }

        // Update local order data to reflect new status
        $order['order_status'] = $targetStatus;
    }
    unset($order);

    // ═══════════════════════════════════════════════════════════
    // 3. Update Customers (Lifecycle & Ownership)
    //    - assigned_to จะอัปเดตเฉพาะเมื่อผู้ขายเป็น Telesale (role_id 6,7)
    //    - ถ้าผู้ขายไม่ใช่ Telesale จะอัปเดตเฉพาะ lifecycle/ownership/followup
    //    NOTE: current_basket_key is now handled by BasketRoutingServiceV2 above
    // ═══════════════════════════════════════════════════════════
    if ($targetStatus === 'Picking' && !empty($customerUpdates)) {
        $ownershipExpires = date('Y-m-d H:i:s', strtotime('+90 days'));

        // Lookup which creator IDs are Telesale (role_id 6 = Telesale, 7 = Supervisor Telesale)
        $creatorIds = array_unique(array_values($customerUpdates));
        $creatorPlaceholders = implode(',', array_fill(0, count($creatorIds), '?'));
        $roleStmt = $pdo->prepare("SELECT id FROM users WHERE id IN ($creatorPlaceholders) AND role_id IN (6, 7)");
        $roleStmt->execute($creatorIds);
        $telesaleUserIds = $roleStmt->fetchAll(PDO::FETCH_COLUMN, 0);
        $telesaleSet = array_flip($telesaleUserIds);

        // Statement WITH assigned_to update (for Telesale sellers)
        $custStmtWithAssign = $pdo->prepare("
            UPDATE customers 
            SET 
                lifecycle_status = 'Old3Months',
                assigned_to = ?,
                ownership_expires = ?,
                followup_bonus_remaining = 1
            WHERE customer_id = ?
        ");

        // Statement WITHOUT assigned_to update (for non-Telesale sellers)
        $custStmtNoAssign = $pdo->prepare("
            UPDATE customers 
            SET 
                lifecycle_status = 'Old3Months',
                ownership_expires = ?,
                followup_bonus_remaining = 1
            WHERE customer_id = ?
        ");

        foreach ($customerUpdates as $custId => $creatorId) {
            if (isset($telesaleSet[$creatorId])) {
                // ผู้ขายเป็น Telesale → อัปเดต assigned_to ด้วย
                $custStmtWithAssign->execute([$creatorId, $ownershipExpires, $custId]);
            } else {
                // ผู้ขายไม่ใช่ Telesale → ไม่แตะ assigned_to
                $custStmtNoAssign->execute([$ownershipExpires, $custId]);
            }
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
    // 5. Return full order data for CSV generation
    // ═══════════════════════════════════════════════════════════
    json_response([
        'success' => true,
        'processed' => $processedCount,
        'customerUpdates' => count($customerUpdates),
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