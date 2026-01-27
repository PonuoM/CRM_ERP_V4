<?php
require_once 'config.php';

header('Content-Type: application/json');

if (!function_exists('method')) {
    function method() {
        return $_SERVER['REQUEST_METHOD'] ?? 'GET';
    }
}

function ensure_schema(PDO $pdo): void {
    try { $pdo->exec("ALTER TABLE customers ADD COLUMN followup_bonus_remaining TINYINT(1) NOT NULL DEFAULT 1"); } catch (Throwable $e) {}
}

function handle_ownership(PDO $pdo, ?string $id): void {
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
                case 'sale': handleSale($pdo, $customerId); break;
                case 'followup': handleFollowUpQuota($pdo, $customerId, $input); break;
                case 'redistribute': handleRedistribute($pdo, $customerId); break;
                case 'retrieve': handleRetrieve($pdo, $customerId); break;
                default: json_response(['error' => 'Invalid action'], 400);
            }
            break;
        case 'GET':
            if ($id) {
                $stmt = $pdo->prepare('SELECT * FROM customers WHERE customer_id = ?');
                $stmt->execute([$id]);
                $customer = $stmt->fetch();
                if ($customer) {
                    $updatedCustomer = checkAndUpdateCustomerStatus($pdo, $customer);
                    json_response($updatedCustomer);
                } else {
                    json_response(['error' => 'Customer not found'], 404);
                }
            } else {
                $now = date('Y-m-d H:i:s');
                $stmt = $pdo->query("SELECT * FROM customers 
                                    WHERE (assigned_to IS NOT NULL AND (ownership_expires <= '$now' OR ownership_expires > DATE_ADD(NOW(), INTERVAL 90 DAY)))
                                       OR (is_in_waiting_basket = 1)");
                $customers = $stmt->fetchAll();
                $updatedCount = 0;
                foreach ($customers as $customer) {
                    checkAndUpdateCustomerStatus($pdo, $customer);
                    $updatedCount++;
                }
                json_response(['ok' => true, 'processed' => $updatedCount]);
            }
            break;
        default: json_response(['error' => 'Method not allowed'], 405);
    }
}

function handleSale(PDO $pdo, string $customerId): void {
    $stmt = $pdo->prepare('SELECT * FROM customers WHERE customer_id = ?');
    $stmt->execute([$customerId]);
    $customer = $stmt->fetch();
    if (!$customer) { json_response(['error' => 'Customer not found'], 404); return; }
    try {
        $orderStmt = $pdo->prepare("SELECT delivery_date FROM orders WHERE customer_id = ? AND order_status = 'Picking' ORDER BY order_date DESC LIMIT 1");
        $orderStmt->execute([$customerId]);
        $deliveryDateStr = $orderStmt->fetchColumn();
        if (!$deliveryDateStr) {
            json_response(['error' => 'SALE_NOT_COMPLETED', 'message' => 'Sale quota grants only when order status is Picking and delivery_date exists'], 400);
            return;
        }
    } catch (Throwable $e) { json_response(['error' => 'SALE_CHECK_FAILED'], 500); return; }

    $deliveryDate = new DateTime($deliveryDateStr);
    $newExpiry = clone $deliveryDate;
    $newExpiry->add(new DateInterval('P90D'));
    $now = new DateTime();
    $maxAllowed = (clone $now)->add(new DateInterval('P90D'));
    if ($newExpiry > $maxAllowed) { $newExpiry = $maxAllowed; }
    
    $updateStmt = $pdo->prepare("UPDATE customers SET ownership_expires = ?, has_sold_before = 1, last_sale_date = ?, follow_up_count = 0, lifecycle_status = 'Old3Months', followup_bonus_remaining = 1 WHERE customer_id = ?");
    $updateStmt->execute([$newExpiry->format('Y-m-d H:i:s'), $deliveryDate->format('Y-m-d H:i:s'), $customerId]);
    json_response(['success' => true, 'message' => 'Sale recorded successfully']);
}

function handleFollowUpQuota(PDO $pdo, string $customerId, array $input): void {
    $stmt = $pdo->prepare('SELECT * FROM customers WHERE customer_id = ?');
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
        $maxAllowed = (clone $now)->add(new DateInterval('P90D'));
        if ($newExpiry > $maxAllowed) { $newExpiry = $maxAllowed; }
        $pdo->prepare("UPDATE customers SET ownership_expires = ?, follow_up_count = follow_up_count + 1, last_follow_up_date = ?, followup_bonus_remaining = GREATEST(followup_bonus_remaining - 1, 0) WHERE customer_id = ?")
            ->execute([$newExpiry->format('Y-m-d H:i:s'), $now->format('Y-m-d H:i:s'), $customerId]);
        json_response(['success' => true, 'message' => 'Follow-up recorded successfully (+90 applied)']);
    } else {
        $pdo->prepare("UPDATE customers SET follow_up_count = follow_up_count + 1, last_follow_up_date = ? WHERE customer_id = ?")
            ->execute([$now->format('Y-m-d H:i:s'), $customerId]);
        json_response(['success' => true, 'message' => 'Follow-up recorded successfully (no bonus left)']);
    }
}

function handleRedistribute(PDO $pdo, string $customerId): void {
    $now = new DateTime();
    $newExpiry = (clone $now)->add(new DateInterval('P30D'));
    $pdo->prepare("UPDATE customers SET ownership_expires = ?, lifecycle_status = 'DailyDistribution', follow_up_count = 0, last_follow_up_date = NULL, is_in_waiting_basket = 0, waiting_basket_start_date = NULL, followup_bonus_remaining = 1 WHERE customer_id = ?")
        ->execute([$newExpiry->format('Y-m-d H:i:s'), $customerId]);
    json_response(['success' => true, 'message' => 'Customer redistributed successfully']);
}

function handleRetrieve(PDO $pdo, string $customerId): void {
    $stmt = $pdo->prepare('SELECT * FROM customers WHERE customer_id = ?');
    $stmt->execute([$customerId]);
    $customer = $stmt->fetch();
    if (!$customer) { json_response(['error' => 'Customer not found'], 404); return; }
    $now = new DateTime();
    if ($customer['has_sold_before']) {
        $pdo->prepare("UPDATE customers SET is_in_waiting_basket = 1, waiting_basket_start_date = ?, follow_up_date = NULL WHERE customer_id = ?")
            ->execute([$now->format('Y-m-d H:i:s'), $customerId]);
        // Removed: Auto-complete appointments disabled - V2 Dashboard allows next owner to follow up
        // $pdo->prepare("UPDATE appointments SET status = 'เสร็จสิ้น' WHERE customer_id = ? AND status <> 'เสร็จสิ้น'")->execute([$customerId]);
        json_response(['success' => true, 'message' => 'Customer moved to waiting basket for 30 days']);
    } else {
        $newExpiry = (clone $now)->add(new DateInterval('P30D'));
        $pdo->prepare("UPDATE customers SET ownership_expires = ?, lifecycle_status = 'DailyDistribution', follow_up_count = 0, last_follow_up_date = NULL, is_in_waiting_basket = 0, waiting_basket_start_date = NULL, followup_bonus_remaining = 1 WHERE customer_id = ?")
            ->execute([$newExpiry->format('Y-m-d H:i:s'), $customerId]);
        json_response(['success' => true, 'message' => 'Customer redistributed directly to distribution basket']);
    }
}

function checkAndUpdateCustomerStatus(PDO $pdo, array $customer): array {
    $now = new DateTime();
    if (!empty($customer['ownership_expires'])) {
        $expiry = new DateTime($customer['ownership_expires']);
        $secondsDiff = $expiry->getTimestamp() - $now->getTimestamp();
        $daysRemaining = (int) floor($secondsDiff / (86400));
        if ($daysRemaining > 90) {
            $clamped = (clone $now)->add(new DateInterval('P90D'));
            $pdo->prepare('UPDATE customers SET ownership_expires = ? WHERE customer_id = ?')->execute([$clamped->format('Y-m-d H:i:s'), $customer['customer_id']]);
            $customer['ownership_expires'] = $clamped->format('Y-m-d H:i:s');
            $expiry = $clamped;
        }
        // DISABLED 2026-01-27: No longer using ownership_expires system
        // Now using Dashboard V2 basket system for ownership management
        // if ($expiry <= $now && !$customer['is_in_waiting_basket'] && !empty($customer['assigned_to'])) {
        //     $pdo->prepare("UPDATE customers SET is_in_waiting_basket = 1, waiting_basket_start_date = ?, follow_up_date = NULL, assigned_to = NULL WHERE customer_id = ?")
        //         ->execute([$now->format('Y-m-d H:i:s'), $customer['customer_id']]);
        //     $customer['is_in_waiting_basket'] = 1;
        //     $customer['waiting_basket_start_date'] = $now->format('Y-m-d H:i:s');
        //     $customer['assigned_to'] = NULL;
        // }
    }
    if ($customer['is_in_waiting_basket'] && $customer['waiting_basket_start_date']) {
        $waitingStart = new DateTime($customer['waiting_basket_start_date']);
        $daysInWaiting = $now->diff($waitingStart)->days;
        $daysSinceLastCall = 999;
        if (!empty($customer['last_follow_up_date'])) { $lastCall = new DateTime($customer['last_follow_up_date']); $daysSinceLastCall = $now->diff($lastCall)->days; }
        if ($daysInWaiting >= 30 && $daysSinceLastCall >= 7) {
            $newExpiry = (clone $now)->add(new DateInterval('P30D'));
            $pdo->prepare("UPDATE customers SET is_in_waiting_basket = 0, waiting_basket_start_date = NULL, ownership_expires = ?, lifecycle_status = 'DailyDistribution', follow_up_count = 0, followup_bonus_remaining = 1 WHERE customer_id = ?")
                ->execute([$newExpiry->format('Y-m-d H:i:s'), $customer['customer_id']]);
            $customer['is_in_waiting_basket'] = 0;
            $customer['waiting_basket_start_date'] = null;
            $customer['ownership_expires'] = $newExpiry->format('Y-m-d H:i:s');
            $customer['lifecycle_status'] = 'DailyDistribution';
            $customer['follow_up_count'] = 0;
        }
    }
    return $customer;
}

// Route handling - Only run if called directly
if (basename($_SERVER['SCRIPT_FILENAME']) === 'ownership.php') {
    $path = $_SERVER['PATH_INFO'] ?? '';
    $parts = explode('/', trim($path, '/'));
    if (($parts[0] ?? '') === 'ownership') {
        handle_ownership($pdo, $parts[1] ?? null);
    } else {
        json_response(['error' => 'Not found'], 404);
    }
}
