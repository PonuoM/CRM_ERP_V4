<?php
require_once __DIR__ . '/config.php';

header('Content-Type: application/json');

function ensure_schema(PDO $pdo): void {
    try {
        $pdo->exec("ALTER TABLE customers ADD COLUMN followup_bonus_remaining TINYINT(1) NOT NULL DEFAULT 1");
    } catch (Throwable $e) {
        // ignore if exists
    }
}

function handle_ownership(PDO $pdo, ?string $id): void {
    ensure_schema($pdo);
    switch (method()) {
        case 'POST':
            $input = json_input();
            $action = $input['action'] ?? '';
            $customerId = $input['customerId'] ?? '';
            if (!$customerId) {
                json_response(['error' => 'Customer ID required'], 400);
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
                // Try to find customer by customer_ref_id or customer_id
                $stmt = $pdo->prepare('SELECT * FROM customers WHERE customer_ref_id = ? OR customer_id = ? LIMIT 1');
                $stmt->execute([$id, is_numeric($id) ? (int)$id : null]);
                $customer = $stmt->fetch();
                if (!$customer) { json_response(['error' => 'Customer not found'], 404); }
                $updated = checkAndUpdateCustomerStatus($pdo, $customer);
                json_response($updated);
            } else {
                $stmt = $pdo->query('SELECT * FROM customers');
                $customers = $stmt->fetchAll();
                $updated = array_map(function($c) use ($pdo) { return checkAndUpdateCustomerStatus($pdo, $c); }, $customers);
                json_response($updated);
            }
            break;
        default:
            json_response(['error' => 'Method not allowed'], 405);
    }
}

function handleSale(PDO $pdo, string $customerId): void {
    // Try to find customer by customer_ref_id or customer_id
    $stmt = $pdo->prepare('SELECT * FROM customers WHERE customer_ref_id = ? OR customer_id = ? LIMIT 1');
    $stmt->execute([$customerId, is_numeric($customerId) ? (int)$customerId : null]);
    $customer = $stmt->fetch();
    if (!$customer) { 
        json_response(['error' => 'Customer not found', 'customerId' => $customerId], 404); 
        return;
    }

    try {
        // Get delivery_date from order with Picking status
        // Use customer_id (PK) for order lookup
        $orderCustomerId = $customer['customer_id'];
        if (!$orderCustomerId) {
            json_response(['error' => 'INVALID_CUSTOMER_ID', 'message' => 'Customer ID not found in result'], 500);
            return;
        }
        // Try to get delivery_date first, then order_date as fallback
        $orderStmt = $pdo->prepare("SELECT delivery_date, order_date FROM orders WHERE customer_id = ? AND order_status = 'Picking' ORDER BY order_date DESC LIMIT 1");
        $orderStmt->execute([$orderCustomerId]);
        $orderRow = $orderStmt->fetch();
        
        if (!$orderRow) {
            json_response(['error' => 'SALE_NOT_COMPLETED', 'message' => 'No order with Picking status found'], 400);
            return;
        }
        
        // Use delivery_date if available, otherwise use order_date (one of these should always exist)
        $deliveryDateStr = $orderRow['delivery_date'] ?? $orderRow['order_date'];
    } catch (Throwable $e) {
        json_response(['error' => 'SALE_CHECK_FAILED'], 500);
        return;
    }

    // Use delivery_date as sale date, then add 90 days for ownership_expires
    $deliveryDate = new DateTime($deliveryDateStr);
    $newExpiry = clone $deliveryDate;
    $newExpiry->add(new DateInterval('P90D'));
    
    // Ensure max 90 days from current date
    $now = new DateTime();
    $maxAllowed = (clone $now);
    $maxAllowed->add(new DateInterval('P90D'));
    if ($newExpiry > $maxAllowed) { $newExpiry = $maxAllowed; }

    $updateId = $customer['customer_id'];
    if (!$updateId) {
        json_response(['error' => 'INVALID_CUSTOMER_ID', 'message' => 'Customer ID not found in result'], 500);
        return;
    }
    $update = $pdo->prepare("UPDATE customers
        SET ownership_expires = ?, has_sold_before = 1, last_sale_date = ?,
            follow_up_count = 0, lifecycle_status = 'Old3Months', followup_bonus_remaining = 1
        WHERE customer_id = ?");
    $update->execute([
        $newExpiry->format('Y-m-d H:i:s'),
        $deliveryDate->format('Y-m-d H:i:s'),
        $updateId
    ]);

    json_response(['success' => true, 'message' => 'Sale recorded successfully']);
}

function handleFollowUpQuota(PDO $pdo, string $customerId, array $input): void {
    // Try to find customer by customer_ref_id or customer_id (no 'id' column exists)
    // First try as customer_ref_id (VARCHAR), then as customer_id (INT)
    $stmt = $pdo->prepare('SELECT * FROM customers WHERE customer_ref_id = ? OR customer_id = ? LIMIT 1');
    $stmt->execute([$customerId, is_numeric($customerId) ? (int)$customerId : null]);
    $customer = $stmt->fetch();
    if (!$customer) { 
        json_response(['error' => 'Customer not found', 'customerId' => $customerId], 404); 
        return;
    }

    ensure_schema($pdo);
    $now = new DateTime();
    $bonusRemaining = isset($customer['followup_bonus_remaining']) ? (int)$customer['followup_bonus_remaining'] : 1;
    

    // Check for skipStatusUpdate flag in the nested data object
    $skipStatusUpdate = !empty($input['data']['skipStatusUpdate']);
    
    // Debug logging
    error_log("Follow-up for customer {$customerId}: customer_id={$customer['customer_id']}, customer_ref_id={$customer['customer_ref_id']}, bonusRemaining={$bonusRemaining}, currentExpiry={$customer['ownership_expires']}, skipStatusUpdate=" . ($skipStatusUpdate ? 'true' : 'false'));
    
    if ($bonusRemaining > 0) {
        if (empty($customer['ownership_expires'])) {
            json_response(['error' => 'OWNERSHIP_EXPIRES_MISSING', 'message' => 'Customer has no ownership_expires date'], 400);
            return;
        }
        
        $currentExpiry = new DateTime($customer['ownership_expires']);
        $newExpiry = clone $currentExpiry;
        $newExpiry->add(new DateInterval('P90D'));
        $maxAllowed = (clone $now);
        $maxAllowed->add(new DateInterval('P90D'));
        
        $wasClamped = false;
        if ($newExpiry > $maxAllowed) {
            $wasClamped = true;
            $newExpiry = $maxAllowed;
        }
        
        // Check if the new expiry is actually different from current
        $willChange = ($newExpiry->format('Y-m-d H:i:s') !== $currentExpiry->format('Y-m-d H:i:s'));
        
        if ($willChange) {
            // Use customer_id (PK) for update
            $updateId = $customer['customer_id'];
            if (!$updateId) {
                error_log("ERROR: Customer ID not found for customerId={$customerId}, customer=" . json_encode($customer));
                json_response(['error' => 'INVALID_CUSTOMER_ID', 'message' => 'Customer ID not found in result'], 500);
                return;
            }
            error_log("Updating customer_id={$updateId}: old_expiry={$currentExpiry->format('Y-m-d H:i:s')}, new_expiry={$newExpiry->format('Y-m-d H:i:s')}");
            
            $sql = 'UPDATE customers SET ownership_expires = ?, follow_up_count = follow_up_count + 1, last_follow_up_date = ?, followup_bonus_remaining = GREATEST(followup_bonus_remaining - 1, 0)';
            if (!$skipStatusUpdate) {
                $sql .= ", lifecycle_status = 'FollowUp'";
            }
            $sql .= ' WHERE customer_id = ?';
            
            $upd = $pdo->prepare($sql);
            $result = $upd->execute([$newExpiry->format('Y-m-d H:i:s'), $now->format('Y-m-d H:i:s'), $updateId]);
            $affectedRows = $upd->rowCount();
            error_log("Update result: success={$result}, affectedRows={$affectedRows}");
            
            $message = 'Follow-up recorded (+90 applied)';
            if ($wasClamped) {
                $message .= ' (clamped to max 90 days from today)';
            }
            json_response([
                'success' => true, 
                'message' => $message,
                'debug' => [
                    'old_expiry' => $currentExpiry->format('Y-m-d H:i:s'),
                    'new_expiry' => $newExpiry->format('Y-m-d H:i:s'),
                    'max_allowed' => $maxAllowed->format('Y-m-d H:i:s'),
                    'was_clamped' => $wasClamped
                ]
            ]);
        } else {
            // Even though bonus > 0, the date won't change (likely already at max)
            // Still consume the bonus and record the follow-up
            $updateId = $customer['customer_id'];
            if (!$updateId) {
                json_response(['error' => 'INVALID_CUSTOMER_ID', 'message' => 'Customer ID not found in result'], 500);
                return;
            }
            $sql = 'UPDATE customers SET follow_up_count = follow_up_count + 1, last_follow_up_date = ?, followup_bonus_remaining = GREATEST(followup_bonus_remaining - 1, 0)';
            if (!$skipStatusUpdate) {
                $sql .= ", lifecycle_status = 'FollowUp'";
            }
            $sql .= ' WHERE customer_id = ?';
            
            $upd = $pdo->prepare($sql);
            $upd->execute([$now->format('Y-m-d H:i:s'), $updateId]);
            json_response([
                'success' => true, 
                'message' => 'Follow-up recorded (bonus consumed but expiry already at maximum)',
                'debug' => [
                    'current_expiry' => $currentExpiry->format('Y-m-d H:i:s'),
                    'calculated_new_expiry' => $newExpiry->format('Y-m-d H:i:s'),
                    'max_allowed' => $maxAllowed->format('Y-m-d H:i:s'),
                    'reason' => 'New expiry equals current expiry (already at maximum allowed)'
                ]
            ]);
        }
    } else {
        $updateId = $customer['customer_id'];
        if (!$updateId) {
            json_response(['error' => 'INVALID_CUSTOMER_ID', 'message' => 'Customer ID not found in result'], 500);
            return;
        }
        $sql = 'UPDATE customers SET follow_up_count = follow_up_count + 1, last_follow_up_date = ?';
        if (!$skipStatusUpdate) {
            $sql .= ", lifecycle_status = 'FollowUp'";
        }
        $sql .= ' WHERE customer_id = ?';
        
        $upd = $pdo->prepare($sql);
        $upd->execute([$now->format('Y-m-d H:i:s'), $updateId]);
        json_response(['success' => true, 'message' => 'Follow-up recorded (no bonus)']);
    }
}

function handleRedistribute(PDO $pdo, string $customerId): void {
    // Try to find customer by customer_ref_id or customer_id
    $stmt = $pdo->prepare('SELECT customer_id FROM customers WHERE customer_ref_id = ? OR customer_id = ? LIMIT 1');
    $stmt->execute([$customerId, is_numeric($customerId) ? (int)$customerId : null]);
    $customer = $stmt->fetch();
    if (!$customer) { 
        json_response(['error' => 'Customer not found', 'customerId' => $customerId], 404); 
        return;
    }
    
    $now = new DateTime();
    $newExpiry = (clone $now); $newExpiry->add(new DateInterval('P30D'));
    $updateId = $customer['customer_id'];
    if (!$updateId) {
        json_response(['error' => 'INVALID_CUSTOMER_ID', 'message' => 'Customer ID not found in result'], 500);
        return;
    }
    $upd = $pdo->prepare("UPDATE customers SET ownership_expires = ?, lifecycle_status = 'DailyDistribution', follow_up_count = 0, last_follow_up_date = NULL, is_in_waiting_basket = 0, waiting_basket_start_date = NULL, followup_bonus_remaining = 1 WHERE customer_id = ?");
    $upd->execute([$newExpiry->format('Y-m-d H:i:s'), $updateId]);
    json_response(['success' => true, 'message' => 'Customer redistributed successfully']);
}

function handleRetrieve(PDO $pdo, string $customerId): void {
    // Try to find customer by customer_ref_id or customer_id
    $stmt = $pdo->prepare('SELECT * FROM customers WHERE customer_ref_id = ? OR customer_id = ? LIMIT 1');
    $stmt->execute([$customerId, is_numeric($customerId) ? (int)$customerId : null]);
    $customer = $stmt->fetch();
    if (!$customer) { 
        json_response(['error' => 'Customer not found', 'customerId' => $customerId], 404); 
        return;
    }

    $now = new DateTime();
    $updateId = $customer['customer_id'];
    if (!$updateId) {
        json_response(['error' => 'INVALID_CUSTOMER_ID', 'message' => 'Customer ID not found in result'], 500);
        return;
    }
    if (!empty($customer['has_sold_before'])) {
        $upd = $pdo->prepare("UPDATE customers SET is_in_waiting_basket = 1, waiting_basket_start_date = ? WHERE customer_id = ?");
        $upd->execute([$now->format('Y-m-d H:i:s'), $updateId]);
        json_response(['success' => true, 'message' => 'Customer moved to waiting basket for 30 days']);
    } else {
        $newExpiry = (clone $now); $newExpiry->add(new DateInterval('P30D'));
        $upd = $pdo->prepare("UPDATE customers SET ownership_expires = ?, lifecycle_status = 'DailyDistribution', follow_up_count = 0, last_follow_up_date = NULL, is_in_waiting_basket = 0, waiting_basket_start_date = NULL, followup_bonus_remaining = 1 WHERE customer_id = ?");
        $upd->execute([$newExpiry->format('Y-m-d H:i:s'), $updateId]);
        json_response(['success' => true, 'message' => 'Customer redistributed directly to distribution basket']);
    }
}

function checkAndUpdateCustomerStatus(PDO $pdo, array $customer): array {
    $now = new DateTime();
    $expiry = new DateTime($customer['ownership_expires']);
    try {
        $maxAllowed = (clone $now); $maxAllowed->add(new DateInterval('P90D'));
        if ($expiry > $maxAllowed) {
            $updateId = $customer['customer_id'];
            if ($updateId) {
                $upd = $pdo->prepare('UPDATE customers SET ownership_expires = ? WHERE customer_id = ?');
                $upd->execute([$maxAllowed->format('Y-m-d H:i:s'), $updateId]);
            }
            $customer['ownership_expires'] = $maxAllowed->format('Y-m-d H:i:s');
            $expiry = $maxAllowed;
        }
    } catch (Throwable $e) {}

    if ($expiry <= $now && empty($customer['is_in_waiting_basket'])) {
        $updateId = $customer['customer_id'];
        if ($updateId) {
            $upd = $pdo->prepare("UPDATE customers SET is_in_waiting_basket = 1, waiting_basket_start_date = ? WHERE customer_id = ?");
            $upd->execute([$now->format('Y-m-d H:i:s'), $updateId]);
        }
        $customer['is_in_waiting_basket'] = 1;
        $customer['waiting_basket_start_date'] = $now->format('Y-m-d H:i:s');
        // $customer['lifecycle_status'] = 'FollowUp'; // Do NOT override status
    }

    if (!empty($customer['is_in_waiting_basket']) && !empty($customer['waiting_basket_start_date'])) {
        $waitingStart = new DateTime($customer['waiting_basket_start_date']);
        $daysInWaiting = $now->diff($waitingStart)->days;
        if ($daysInWaiting >= 30) {
            $newExpiry = (clone $now); $newExpiry->add(new DateInterval('P30D'));
            $updateId = $customer['customer_id'];
            if ($updateId) {
                $upd = $pdo->prepare("UPDATE customers SET is_in_waiting_basket = 0, waiting_basket_start_date = NULL, ownership_expires = ?, lifecycle_status = 'DailyDistribution', follow_up_count = 0, followup_bonus_remaining = 1 WHERE customer_id = ?");
                $upd->execute([$newExpiry->format('Y-m-d H:i:s'), $updateId]);
            }
            $customer['is_in_waiting_basket'] = 0;
            $customer['waiting_basket_start_date'] = null;
            $customer['ownership_expires'] = $newExpiry->format('Y-m-d H:i:s');
            $customer['lifecycle_status'] = 'DailyDistribution';
            $customer['follow_up_count'] = 0;
        }
    }

    return $customer;
}

?>

