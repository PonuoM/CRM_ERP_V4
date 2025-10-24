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
                $stmt = $pdo->prepare('SELECT * FROM customers WHERE id = ?');
                $stmt->execute([$id]);
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
    $stmt = $pdo->prepare('SELECT * FROM customers WHERE id = ?');
    $stmt->execute([$customerId]);
    $customer = $stmt->fetch();
    if (!$customer) { json_response(['error' => 'Customer not found'], 404); }

    try {
        $chk = $pdo->prepare("SELECT COUNT(*) FROM orders WHERE customer_id = ? AND payment_status = 'Paid' AND order_status = 'Delivered' LIMIT 1");
        $chk->execute([$customerId]);
        if ((int)$chk->fetchColumn() <= 0) {
            json_response(['error' => 'SALE_NOT_COMPLETED', 'message' => 'Sale grants only after Paid + Delivered'], 400);
        }
    } catch (Throwable $e) {
        json_response(['error' => 'SALE_CHECK_FAILED'], 500);
    }

    $now = new DateTime();
    $currentExpiry = new DateTime($customer['ownership_expires']);
    $newExpiry = clone $currentExpiry;
    $newExpiry->add(new DateInterval('P90D'));
    $maxAllowed = (clone $now);
    $maxAllowed->add(new DateInterval('P90D'));
    if ($newExpiry > $maxAllowed) { $newExpiry = $maxAllowed; }

    $update = $pdo->prepare("UPDATE customers
        SET ownership_expires = ?, has_sold_before = 1, last_sale_date = ?,
            follow_up_count = 0, lifecycle_status = 'Old3Months', followup_bonus_remaining = 1
        WHERE id = ?");
    $update->execute([
        $newExpiry->format('Y-m-d H:i:s'),
        $now->format('Y-m-d H:i:s'),
        $customerId
    ]);

    json_response(['success' => true, 'message' => 'Sale recorded successfully']);
}

function handleFollowUpQuota(PDO $pdo, string $customerId, array $input): void {
    $stmt = $pdo->prepare('SELECT * FROM customers WHERE id = ?');
    $stmt->execute([$customerId]);
    $customer = $stmt->fetch();
    if (!$customer) { json_response(['error' => 'Customer not found'], 404); }

    ensure_schema($pdo);
    $now = new DateTime();
    $bonusRemaining = isset($customer['followup_bonus_remaining']) ? (int)$customer['followup_bonus_remaining'] : 1;
    if ($bonusRemaining > 0) {
        $currentExpiry = new DateTime($customer['ownership_expires']);
        $newExpiry = clone $currentExpiry;
        $newExpiry->add(new DateInterval('P90D'));
        $maxAllowed = (clone $now);
        $maxAllowed->add(new DateInterval('P90D'));
        if ($newExpiry > $maxAllowed) { $newExpiry = $maxAllowed; }
        $upd = $pdo->prepare('UPDATE customers SET ownership_expires = ?, follow_up_count = follow_up_count + 1, last_follow_up_date = ?, followup_bonus_remaining = GREATEST(followup_bonus_remaining - 1, 0) WHERE id = ?');
        $upd->execute([$newExpiry->format('Y-m-d H:i:s'), $now->format('Y-m-d H:i:s'), $customerId]);
        json_response(['success' => true, 'message' => 'Follow-up recorded (+90 applied)']);
    } else {
        $upd = $pdo->prepare('UPDATE customers SET follow_up_count = follow_up_count + 1, last_follow_up_date = ? WHERE id = ?');
        $upd->execute([$now->format('Y-m-d H:i:s'), $customerId]);
        json_response(['success' => true, 'message' => 'Follow-up recorded (no bonus)']);
    }
}

function handleRedistribute(PDO $pdo, string $customerId): void {
    $now = new DateTime();
    $newExpiry = (clone $now); $newExpiry->add(new DateInterval('P30D'));
    $upd = $pdo->prepare("UPDATE customers SET ownership_expires = ?, lifecycle_status = 'DailyDistribution', follow_up_count = 0, last_follow_up_date = NULL, is_in_waiting_basket = 0, waiting_basket_start_date = NULL, followup_bonus_remaining = 1 WHERE id = ?");
    $upd->execute([$newExpiry->format('Y-m-d H:i:s'), $customerId]);
    json_response(['success' => true, 'message' => 'Customer redistributed successfully']);
}

function handleRetrieve(PDO $pdo, string $customerId): void {
    $stmt = $pdo->prepare('SELECT * FROM customers WHERE id = ?');
    $stmt->execute([$customerId]);
    $customer = $stmt->fetch();
    if (!$customer) { json_response(['error' => 'Customer not found'], 404); }

    $now = new DateTime();
    if (!empty($customer['has_sold_before'])) {
        $upd = $pdo->prepare("UPDATE customers SET is_in_waiting_basket = 1, waiting_basket_start_date = ?, lifecycle_status = 'FollowUp' WHERE id = ?");
        $upd->execute([$now->format('Y-m-d H:i:s'), $customerId]);
        json_response(['success' => true, 'message' => 'Customer moved to waiting basket for 30 days']);
    } else {
        $newExpiry = (clone $now); $newExpiry->add(new DateInterval('P30D'));
        $upd = $pdo->prepare("UPDATE customers SET ownership_expires = ?, lifecycle_status = 'DailyDistribution', follow_up_count = 0, last_follow_up_date = NULL, is_in_waiting_basket = 0, waiting_basket_start_date = NULL, followup_bonus_remaining = 1 WHERE id = ?");
        $upd->execute([$newExpiry->format('Y-m-d H:i:s'), $customerId]);
        json_response(['success' => true, 'message' => 'Customer redistributed directly to distribution basket']);
    }
}

function checkAndUpdateCustomerStatus(PDO $pdo, array $customer): array {
    $now = new DateTime();
    $expiry = new DateTime($customer['ownership_expires']);
    try {
        $maxAllowed = (clone $now); $maxAllowed->add(new DateInterval('P90D'));
        if ($expiry > $maxAllowed) {
            $upd = $pdo->prepare('UPDATE customers SET ownership_expires = ? WHERE id = ?');
            $upd->execute([$maxAllowed->format('Y-m-d H:i:s'), $customer['id']]);
            $customer['ownership_expires'] = $maxAllowed->format('Y-m-d H:i:s');
            $expiry = $maxAllowed;
        }
    } catch (Throwable $e) {}

    if ($expiry <= $now && empty($customer['is_in_waiting_basket'])) {
        $upd = $pdo->prepare("UPDATE customers SET is_in_waiting_basket = 1, waiting_basket_start_date = ?, lifecycle_status = 'FollowUp' WHERE id = ?");
        $upd->execute([$now->format('Y-m-d H:i:s'), $customer['id']]);
        $customer['is_in_waiting_basket'] = 1;
        $customer['waiting_basket_start_date'] = $now->format('Y-m-d H:i:s');
        $customer['lifecycle_status'] = 'FollowUp';
    }

    if (!empty($customer['is_in_waiting_basket']) && !empty($customer['waiting_basket_start_date'])) {
        $waitingStart = new DateTime($customer['waiting_basket_start_date']);
        $daysInWaiting = $now->diff($waitingStart)->days;
        if ($daysInWaiting >= 30) {
            $newExpiry = (clone $now); $newExpiry->add(new DateInterval('P30D'));
            $upd = $pdo->prepare("UPDATE customers SET is_in_waiting_basket = 0, waiting_basket_start_date = NULL, ownership_expires = ?, lifecycle_status = 'DailyDistribution', follow_up_count = 0, followup_bonus_remaining = 1 WHERE id = ?");
            $upd->execute([$newExpiry->format('Y-m-d H:i:s'), $customer['id']]);
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

