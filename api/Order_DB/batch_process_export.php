<?php
require_once '../config.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method Not Allowed'], 405);
}

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $orderIds = $input['orderIds'] ?? [];
    $targetStatus = $input['targetStatus'] ?? 'Picking';
    // User ID who performed the action (for activity log)
    $actorId = $input['actorId'] ?? null; 
    $actorName = $input['actorName'] ?? 'Unknown User';

    if (empty($orderIds)) {
        json_response(['success' => true, 'processed' => 0, 'message' => 'No orders provided']);
    }

    $pdo = db_connect();
    
    // Start Transaction
    $pdo->beginTransaction();

    // 1. Fetch Orders to identify Customers and Creators
    // We need to know who created the order to assign ownership
    $placeholders = implode(',', array_fill(0, count($orderIds), '?'));
    $stmt = $pdo->prepare("SELECT id, customer_id, creator_id, order_status FROM orders WHERE id IN ($placeholders)");
    $stmt->execute($orderIds);
    $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($orders)) {
        $pdo->rollBack();
        json_response(['error' => 'No matching orders found'], 404);
    }

    // 2. Update Order Status
    $updateStmt = $pdo->prepare("UPDATE orders SET order_status = ? WHERE id = ?");
    
    // Prepare Data for Customer Updates
    $customerUpdates = []; // customer_id => creator_id (latest wins)
    $processedCount = 0;

    foreach ($orders as $order) {
        // Skip if already correct status? (Optional, but good for idempotency)
        // Frontend logic forced update, so we do it.
        $updateStmt->execute([$targetStatus, $order['id']]);
        
        if (!empty($order['customer_id']) && !empty($order['creator_id'])) {
            $customerUpdates[$order['customer_id']] = $order['creator_id'];
        }
        $processedCount++;
    }

    // 3. Update Customers (Lifecycle & Ownership)
    // "Picking" status implies a sale is confirmed enough to extend ownership.
    if ($targetStatus === 'Picking' && !empty($customerUpdates)) {
        // Prepare expiration date (Now + 90 days)
        $ownershipExpires = date('Y-m-d H:i:s', strtotime('+90 days'));
        
        $custStmt = $pdo->prepare("
            UPDATE customers 
            SET 
                lifecycle_status = 'Old3Months',
                assigned_to = ?,
                ownership_expires = ?,
                followup_bonus_remaining = 1
            WHERE id = ? OR pk = ?
        ");

        foreach ($customerUpdates as $custId => $creatorId) {
            // Try to match both id (string) and pk (int) just in case
            // Though usually customer_id in orders is the PK or String ID depending on schema version.
            // Safe approach: Bind both to check.
            // Note: $custId from orders might be int or string.
            $custStmt->execute([$creatorId, $ownershipExpires, $custId, $custId]);
        }
    }

    // 4. Log Activities (Bulk Insert for performance)
    if (!empty($actorId)) {
        $activitySql = "INSERT INTO activities (customer_id, type, description, actor_name, timestamp) VALUES ";
        $activityParams = [];
        $activityRows = [];
        $now = date('Y-m-d H:i:s');
        
        foreach ($orders as $order) {
            if (empty($order['customer_id'])) continue;
            
            $activityRows[] = "(?, ?, ?, ?, ?)";
            $activityParams[] = $order['customer_id']; // Assuming checking against PK/ID logic is handled by DB FK or flexible
            $activityParams[] = 'OrderStatusChanged'; // Enum or String
            $activityParams[] = "อัปเดตสถานะคำสั่งซื้อ {$order['id']} เป็น '$targetStatus' (Batch Export)";
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

    json_response([
        'success' => true,
        'processed' => $processedCount,
        'customerUpdates' => count($customerUpdates)
    ]);

} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Batch Export Error: " . $e->getMessage());
    json_response(['error' => 'Batch processing failed: ' . $e->getMessage()], 500);
}
?>
