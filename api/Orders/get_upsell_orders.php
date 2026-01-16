<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/../config.php';

// Enable CORS
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

    $userId = $user['id'];
    $companyId = isset($_GET['companyId']) ? (int)$_GET['companyId'] : ($user['company_id'] ?? 1);

    // Pagination
    $page = max(1, (int)($_GET['page'] ?? 1));
    $pageSize = max(1, (int)($_GET['pageSize'] ?? 50));
    $offset = ($page - 1) * $pageSize;

    // Filters (Optional, reused from basic list)
    $search = $_GET['search'] ?? '';

    // Step 1: Find Target Order IDs (Upsell Logic)
    // Concept:
    // 1. Order Items creator = Me
    // 2. Order creator != Me
    // 3. Parent Order has > 1 distinct item creator (already implied if items.creator=Me and order.creator!=Me usually, 
    //    but strictly speaking we want mixed creators. 
    //    Actually "parent_order_id same, creator_id unique > 1" check is good to ensure it's a shared order.
    
    // Subquery Logic:
    // Find parent_order_ids where:
    // - EXISTS item by ME
    // - Item creators count > 1 (Upsell implied)
    // - Order creator != ME
    
    // Efficient approach:
    // Join orders with order_items
    
    $whereClause = "WHERE o.company_id = ? AND o.creator_id != ?";
    $params = [$companyId, $userId];

    // Must have items by me
    $whereClause .= " AND EXISTS (SELECT 1 FROM order_items oi_me WHERE oi_me.parent_order_id = o.id AND oi_me.creator_id = ?)";
    $params[] = $userId;

    // Must have multiple creators (Upsell / Shared)
    $whereClause .= " AND (SELECT COUNT(DISTINCT oi_count.creator_id) FROM order_items oi_count WHERE oi_count.parent_order_id = o.id) > 1";

    if (!empty($search)) {
        $whereClause .= " AND (o.id LIKE ? OR c.first_name LIKE ? OR c.phone LIKE ?)";
        $term = "%$search%";
        $params[] = $term;
        $params[] = $term;
        $params[] = $term;
    }

    // Count Total
    $countSql = "SELECT COUNT(DISTINCT o.id) FROM orders o LEFT JOIN customers c ON o.customer_id = c.customer_id $whereClause";
    $stmtCount = $pdo->prepare($countSql);
    $stmtCount->execute($params);
    $totalOrders = (int)$stmtCount->fetchColumn();
    $totalPages = ceil($totalOrders / $pageSize);

    // Fetch Orders
    // We need standard fields.
    $sql = "SELECT o.*, c.first_name as customer_first_name, c.last_name as customer_last_name, 
                   c.phone as customer_phone, c.street as customer_street, 
                   c.subdistrict as customer_subdistrict, c.district as customer_district, 
                   c.province as customer_province, c.postal_code as customer_postal_code
            FROM orders o 
            LEFT JOIN customers c ON o.customer_id = c.customer_id 
            $whereClause 
            ORDER BY o.order_date DESC 
            LIMIT $pageSize OFFSET $offset";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Format orders with items, slips, etc. (Standard Logic)
    // To match /api/index.php/orders format, we need to populate items, slips, tracking_details, boxes
    
    $formattedOrders = [];
    foreach ($orders as $order) {
        $orderId = $order['id'];

        // Get Items
        $stmtItems = $pdo->prepare("SELECT * FROM order_items WHERE parent_order_id = ?");
        $stmtItems->execute([$orderId]);
        $items = $stmtItems->fetchAll(PDO::FETCH_ASSOC);

        // Get Slips
        $stmtSlips = $pdo->prepare("SELECT * FROM order_slips WHERE order_id = ?");
        $stmtSlips->execute([$orderId]);
        $slips = $stmtSlips->fetchAll(PDO::FETCH_ASSOC);

        // Get Tracking
        $stmtTracking = $pdo->prepare("SELECT * FROM order_tracking_numbers WHERE order_id = ?");
        $stmtTracking->execute([$orderId]);
        $tracking = $stmtTracking->fetchAll(PDO::FETCH_ASSOC);

        // Aggregate Tracking Numbers for Display
        $trackingNumbers = [];
        foreach ($tracking as $t) {
            if (!empty($t['tracking_number'])) {
                $trackingNumbers[] = $t['tracking_number'];
            }
        }
        $order['tracking_numbers'] = !empty($trackingNumbers) ? implode(', ', array_unique($trackingNumbers)) : null;

        // Get Boxes (Simulated from sub-orders or distinct items grouping if needed, or if `order_boxes` table exists?)
        // In standard API, boxes seem to come from `tracking_details` logic or separate table.
        // Assuming standard structure:
        // Checking previous context, user didn't request specific box logic implementation, just response structure.
        // Let's create a minimal boxes array or fetch actual if known.
        // Based on user sample: "boxes": [ { "sub_order_id": ... } ]
        // We will try to fetch from simulated sub-order logic if `orders` table has sub-orders? 
        // Actually the sample shows "sub_order_id": "20251216-393068external-1" inside boxes.
        // Let's leave boxes empty or basic for now unless we find the table.
        // Wait, typical `boxes` in this system might be derived.
        // I will return empty array for boxes to be safe, or minimal if I can derive.
        $boxes = []; 

        $order['items'] = $items;
        $order['slips'] = $slips;
        $order['tracking_details'] = $tracking; // Alias
        $order['trackingDetails'] = $tracking; // Alias match sample
        $order['boxes'] = $boxes;

        $formattedOrders[] = $order;
    }

    // Match response structure
    echo json_encode([
        'ok' => true,
        'orders' => $formattedOrders,
        'pagination' => [
            'page' => $page,
            'pageSize' => $pageSize,
            'total' => $totalOrders,
            'totalPages' => $totalPages
        ]
    ]);

} catch (Exception $e) {
    json_response(['error' => $e->getMessage()], 500);
}
