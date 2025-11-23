<?php
require_once 'config.php';

header('Content-Type: application/json');

function ensure_schema(PDO $pdo): void {
    try { $pdo->exec("ALTER TABLE customers ADD COLUMN followup_bonus_remaining TINYINT(1) NOT NULL DEFAULT 1"); } catch (Throwable $e) {}
}

function handle_ownership(PDO $pdo, ?string $id): void {
    // Ensure new column exists (idempotent)
    ensure_schema($pdo);
    switch (method()) {
        case 'POST':
            $input = json_decode(file_get_contents('php://input'), true);
            $action = $input['action'] ?? '';
            $customerId = $input['customerId'] ?? '';
            
            if (!$customerId) {
                json_response(['error' => 'Customer ID required'], 400);
                return;
            }
            
            switch ($action) {
                case 'sale':
                    handleSale($pdo, $customerId);
                    break;
                case 'followup':
                    handleFollowUpQuota($pdo, $customerId, $input);
                    break;
                case 'redistribute':
                    handleRedistribute($pdo, $customerId);
                    break;
                case 'retrieve':
                    handleRetrieve($pdo, $customerId);
                    break;
                default:
                    json_response(['error' => 'Invalid action'], 400);
            }
            break;
            
        case 'GET':
            if ($id) {
                // Get customer ownership status
                $stmt = $pdo->prepare('SELECT * FROM customers WHERE id = ?');
                $stmt->execute([$id]);
                $customer = $stmt->fetch();
                
                if ($customer) {
                    // Check and update status
                    $updatedCustomer = checkAndUpdateCustomerStatus($pdo, $customer);
                    json_response($updatedCustomer);
                } else {
                    json_response(['error' => 'Customer not found'], 404);
                }
            } else {
                // Get all customers with updated status
                $stmt = $pdo->query('SELECT * FROM customers');
                $customers = $stmt->fetchAll();
                
                $updatedCustomers = array_map(function($customer) use ($pdo) {
                    return checkAndUpdateCustomerStatus($pdo, $customer);
                }, $customers);
                
                json_response($updatedCustomers);
            }
            break;
            
        default:
            json_response(['error' => 'Method not allowed'], 405);
    }
}

function handleSale(PDO $pdo, string $customerId): void {
    $stmt = $pdo->prepare('SELECT * FROM customers WHERE id = ?');
    $stmt->execute([$customerId]);
    $customer = $stmt->fetch();
    
    if (!$customer) {
        json_response(['error' => 'Customer not found'], 404);
        return;
    }
    // Enforce sale completion: require at least one order that is Picking with delivery_date
    try {
        // Get delivery_date from order with Picking status
        $orderStmt = $pdo->prepare("SELECT delivery_date FROM orders WHERE customer_id = ? AND order_status = 'Picking' ORDER BY order_date DESC LIMIT 1");
        $orderStmt->execute([$customerId]);
        $deliveryDateStr = $orderStmt->fetchColumn();
        
        if (!$deliveryDateStr) {
            json_response(['error' => 'SALE_NOT_COMPLETED', 'message' => 'Sale quota grants only when order status is Picking and delivery_date exists'], 400);
            return;
        }
    } catch (Throwable $e) { /* if check fails, do not grant */ json_response(['error' => 'SALE_CHECK_FAILED'], 500); return; }

        // Use delivery_date as sale date, then add 90 days for ownership_expires
        $deliveryDate = new DateTime($deliveryDateStr);
        $newExpiry = clone $deliveryDate;
        $newExpiry->add(new DateInterval('P90D'));
        
        // Ensure max 90 days from current date
        $now = new DateTime();
        $maxAllowed = (clone $now);
        $maxAllowed->add(new DateInterval('P90D'));
        if ($newExpiry > $maxAllowed) { $newExpiry = $maxAllowed; }
        
        $updateStmt = $pdo->prepare("
            UPDATE customers
            SET ownership_expires = ?, has_sold_before = 1, last_sale_date = ?,
                follow_up_count = 0, lifecycle_status = 'Old3Months', followup_bonus_remaining = 1
            WHERE id = ?
        ");
        $updateStmt->execute([
            $newExpiry->format('Y-m-d H:i:s'),
            $deliveryDate->format('Y-m-d H:i:s'),
            $customerId
        ]);

        // Hard-clamp to maximum 90 days remaining after sale
        try {
            $nowClamp = new DateTime();
            $stmt2 = $pdo->prepare('SELECT ownership_expires FROM customers WHERE id = ?');
            $stmt2->execute([$customerId]);
            $row2 = $stmt2->fetch();
            if ($row2 && !empty($row2['ownership_expires'])) {
                $exp2 = new DateTime($row2['ownership_expires']);
                $daysRem2 = (int) floor(($exp2->getTimestamp() - $nowClamp->getTimestamp()) / (60*60*24));
                if ($daysRem2 > 90) {
                    $clamped = clone $nowClamp;
                    $clamped->add(new DateInterval('P90D'));
                    $upd2 = $pdo->prepare('UPDATE customers SET ownership_expires = ? WHERE id = ?');
                    $upd2->execute([$clamped->format('Y-m-d H:i:s'), $customerId]);
                }
            }
        } catch (Exception $e) { /* ignore clamp errors */ }

    json_response(['success' => true, 'message' => 'Sale recorded successfully']);
}

// New follow-up logic using one-time +90 quota (resets to 1 on sale)
function handleFollowUpV2(PDO $pdo, string $customerId, array $input): void {
    $stmt = $pdo->prepare('SELECT * FROM customers WHERE id = ?');
    $stmt->execute([$customerId]);
    $customer = $stmt->fetch();
    if (!$customer) { json_response(['error' => 'Customer not found'], 404); return; }

    // Ensure schema exists
    ensure_schema($pdo);

    $now = new DateTime();
    $bonusRemaining = isset($customer['followup_bonus_remaining']) ? (int)$customer['followup_bonus_remaining'] : 1;

    if ($bonusRemaining > 0) {
        // Apply +90 days once
        $currentExpiry = new DateTime($customer['ownership_expires']);
        $newExpiry = clone $currentExpiry;
        $newExpiry->add(new DateInterval('P90D'));

        $updateStmt = $pdo->prepare('\n            UPDATE customers \n            SET ownership_expires = ?, follow_up_count = follow_up_count + 1, last_follow_up_date = ?, followup_bonus_remaining = GREATEST(followup_bonus_remaining - 1, 0)\n            WHERE id = ?\n        ');
        $updateStmt->execute([
            $newExpiry->format('Y-m-d H:i:s'),
            $now->format('Y-m-d H:i:s'),
            $customerId
        ]);
        json_response(['success' => true, 'message' => 'Follow-up recorded successfully (+90 applied)']);
    } else {
        // No extension, just track follow-up
        $updateStmt = $pdo->prepare('\n            UPDATE customers \n            SET follow_up_count = follow_up_count + 1, last_follow_up_date = ?\n            WHERE id = ?\n        ');
        $updateStmt->execute([
            $now->format('Y-m-d H:i:s'),
            $customerId
        ]);
        json_response(['success' => true, 'message' => 'Follow-up recorded successfully (no bonus left)']);
    }
}

// Corrected follow-up logic (uses proper SQL newlines)
function handleFollowUpQuota(PDO $pdo, string $customerId, array $input): void {
    $stmt = $pdo->prepare('SELECT * FROM customers WHERE id = ?');
    $stmt->execute([$customerId]);
    $customer = $stmt->fetch();
    if (!$customer) { json_response(['error' => 'Customer not found'], 404); return; }

    ensure_schema($pdo);

    $now = new DateTime();
    $bonusRemaining = isset($customer['followup_bonus_remaining']) ? (int)$customer['followup_bonus_remaining'] : 1;

    if ($bonusRemaining > 0) {
        $currentExpiry = new DateTime($customer['ownership_expires']);
        $newExpiry = clone $currentExpiry;
        $newExpiry->add(new DateInterval('P90D'));
        // Clamp to at most now + 90 days remaining
        $maxAllowed = (clone $now);
        $maxAllowed->add(new DateInterval('P90D'));
        if ($newExpiry > $maxAllowed) { $newExpiry = $maxAllowed; }

        $updateStmt = $pdo->prepare('
            UPDATE customers 
            SET ownership_expires = ?, follow_up_count = follow_up_count + 1, last_follow_up_date = ?, followup_bonus_remaining = GREATEST(followup_bonus_remaining - 1, 0)
            WHERE id = ?
        ');
        $updateStmt->execute([
            $newExpiry->format('Y-m-d H:i:s'),
            $now->format('Y-m-d H:i:s'),
            $customerId
        ]);
        json_response(['success' => true, 'message' => 'Follow-up recorded successfully (+90 applied)']);
    } else {
        $updateStmt = $pdo->prepare('
            UPDATE customers 
            SET follow_up_count = follow_up_count + 1, last_follow_up_date = ?
            WHERE id = ?
        ');
        $updateStmt->execute([
            $now->format('Y-m-d H:i:s'),
            $customerId
        ]);
        json_response(['success' => true, 'message' => 'Follow-up recorded successfully (no bonus left)']);
    }
}

function handleFollowUp(PDO $pdo, string $customerId, array $input): void {
    $stmt = $pdo->prepare('SELECT * FROM customers WHERE id = ?');
    $stmt->execute([$customerId]);
    $customer = $stmt->fetch();
    
    if (!$customer) {
        json_response(['error' => 'Customer not found'], 404);
        return;
    }
    
    $now = new DateTime();
    $followUpCount = $customer['follow_up_count'] ?? 0;

    // New rule: Only add +90 days on the first follow-up AFTER a sale
    $shouldAddDays = ($customer['has_sold_before'] && $followUpCount === 0);

    if ($shouldAddDays) {
        // Add +90 days (only once after sale) and increment follow-up count
        $currentExpiry = new DateTime($customer['ownership_expires']);
        $newExpiry = clone $currentExpiry;
        $newExpiry->add(new DateInterval('P90D'));

        $updateStmt = $pdo->prepare("
            UPDATE customers
            SET ownership_expires = ?, follow_up_count = follow_up_count + 1, last_follow_up_date = ?
            WHERE id = ?
        ");
        $updateStmt->execute([
            $newExpiry->format('Y-m-d H:i:s'),
            $now->format('Y-m-d H:i:s'),
            $customerId
        ]);
    } else {
        // No day extension, just track follow-up
        $updateStmt = $pdo->prepare("
            UPDATE customers
            SET follow_up_count = follow_up_count + 1, last_follow_up_date = ?
            WHERE id = ?
        ");
        $updateStmt->execute([
            $now->format('Y-m-d H:i:s'),
            $customerId
        ]);
    }
    
    json_response(['success' => true, 'message' => 'Follow-up recorded successfully']);
}

function handleRedistribute(PDO $pdo, string $customerId): void {
    $now = new DateTime();
    $newExpiry = clone $now;
    $newExpiry->add(new DateInterval('P30D')); // 30 days
    
    $updateStmt = $pdo->prepare("
        UPDATE customers
        SET ownership_expires = ?, lifecycle_status = 'DailyDistribution', follow_up_count = 0,
            last_follow_up_date = NULL, is_in_waiting_basket = 0, waiting_basket_start_date = NULL, followup_bonus_remaining = 1
        WHERE id = ?
    ");
    $updateStmt->execute([
        $newExpiry->format('Y-m-d H:i:s'),
        'ลูกค้าแจกรายวัน',
        $customerId
    ]);
    
    json_response(['success' => true, 'message' => 'Customer redistributed successfully']);
}

function handleRetrieve(PDO $pdo, string $customerId): void {
    $stmt = $pdo->prepare('SELECT * FROM customers WHERE id = ?');
    $stmt->execute([$customerId]);
    $customer = $stmt->fetch();
    
    if (!$customer) {
        json_response(['error' => 'Customer not found'], 404);
        return;
    }
    
    $now = new DateTime();
    
    if ($customer['has_sold_before']) {
        // ถ้าเคยขายได้แล้ว ต้องพักฟื้น 30 วันในตะกร้ารอ
        $updateStmt = $pdo->prepare("
            UPDATE customers
            SET is_in_waiting_basket = 1, waiting_basket_start_date = ?, lifecycle_status = 'FollowUp'
            WHERE id = ?
        ");
        $updateStmt->execute([
            $now->format('Y-m-d H:i:s'),
            'ลูกค้าติดตาม',
            $customerId
        ]);
        
        json_response(['success' => true, 'message' => 'Customer moved to waiting basket for 30 days']);
    } else {
        // ถ้ายังไม่เคยขายได้ มาตะกร้าแจกทันที
        $newExpiry = clone $now;
        $newExpiry->add(new DateInterval('P30D')); // 30 days
        
        $updateStmt = $pdo->prepare("
            UPDATE customers
            SET ownership_expires = ?, lifecycle_status = 'DailyDistribution', follow_up_count = 0,
                last_follow_up_date = NULL, is_in_waiting_basket = 0, waiting_basket_start_date = NULL, followup_bonus_remaining = 1
            WHERE id = ?
        ");
        $updateStmt->execute([
            $newExpiry->format('Y-m-d H:i:s'),
            'ลูกค้าแจกรายวัน',
            $customerId
        ]);
        
        json_response(['success' => true, 'message' => 'Customer redistributed directly to distribution basket']);
    }
}

function checkAndUpdateCustomerStatus(PDO $pdo, array $customer): array {
    $now = new DateTime();
    $expiry = new DateTime($customer['ownership_expires']);

    // Clamp any value exceeding 90 days remaining back to 90
    try {
        $secondsDiff = $expiry->getTimestamp() - $now->getTimestamp();
        $daysRemaining = (int) floor($secondsDiff / (60 * 60 * 24));
        if ($daysRemaining > 90) {
            $clamped = clone $now;
            $clamped->add(new DateInterval('P90D'));
            $upd = $pdo->prepare('UPDATE customers SET ownership_expires = ? WHERE id = ?');
            $upd->execute([$clamped->format('Y-m-d H:i:s'), $customer['id']]);
            $customer['ownership_expires'] = $clamped->format('Y-m-d H:i:s');
            $expiry = $clamped;
        }
    } catch (Exception $e) { /* ignore */ }
    
    // Check if should move to waiting basket
    if ($expiry <= $now && !$customer['is_in_waiting_basket']) {
        $updateStmt = $pdo->prepare("
            UPDATE customers
            SET is_in_waiting_basket = 1, waiting_basket_start_date = ?, lifecycle_status = 'FollowUp'
            WHERE id = ?
        ");
        $updateStmt->execute([
            $now->format('Y-m-d H:i:s'),
            'ลูกค้าติดตาม',
            $customer['id']
        ]);
        
        $customer['is_in_waiting_basket'] = 1;
        $customer['waiting_basket_start_date'] = $now->format('Y-m-d H:i:s');
        $customer['lifecycle_status'] = 'ลูกค้าติดตาม';
    }
    
    // Check if should move from waiting basket to distribution
    if ($customer['is_in_waiting_basket'] && $customer['waiting_basket_start_date']) {
        $waitingStart = new DateTime($customer['waiting_basket_start_date']);
        $daysInWaiting = $now->diff($waitingStart)->days;
        
        if ($daysInWaiting >= 30) {
            $newExpiry = clone $now;
            $newExpiry->add(new DateInterval('P30D'));
            
            $updateStmt = $pdo->prepare("
                UPDATE customers
                SET is_in_waiting_basket = 0, waiting_basket_start_date = NULL,
                    ownership_expires = ?, lifecycle_status = ?, follow_up_count = 0, followup_bonus_remaining = 1
                WHERE id = ?
            ");
            $updateStmt->execute([
                $newExpiry->format('Y-m-d H:i:s'),
                'ลูกค้าแจกรายวัน',
                $customer['id']
            ]);
            
            $customer['is_in_waiting_basket'] = 0;
            $customer['waiting_basket_start_date'] = null;
            $customer['ownership_expires'] = $newExpiry->format('Y-m-d H:i:s');
            $customer['lifecycle_status'] = 'ลูกค้าแจกรายวัน';
            $customer['follow_up_count'] = 0;
        }
    }
    
    return $customer;
}

// Route handling
$path = $_SERVER['PATH_INFO'] ?? '';
$pathParts = explode('/', trim($path, '/'));
$resource = $pathParts[0] ?? '';
$id = $pathParts[1] ?? null;

if ($resource === 'ownership') {
    handle_ownership($pdo, $id);
} else {
    json_response(['error' => 'Not found'], 404);
}
?>




