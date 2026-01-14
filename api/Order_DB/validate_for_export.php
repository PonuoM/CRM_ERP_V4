<?php
require_once '../config.php';

header('Content-Type: application/json');



if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['error' => 'Method Not Allowed'], 405);
}

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $orderIds = $input['orderIds'] ?? [];
    $tabKey = $input['tabKey'] ?? 'waitingExport';
    $companyId = $input['companyId'] ?? null;

    if (empty($orderIds)) {
        json_response(['valid' => [], 'invalid' => []]);
    }

    $pdo = db_connect();

    // 1. Fetch Rules
    $stmt = $pdo->prepare("SELECT * FROM order_tab_rules WHERE tab_key = ? AND is_active = 1");
    $stmt->execute([$tabKey]);
    $rules = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 2. Fetch Orders (with Company ID Check)
    $placeholders = implode(',', array_fill(0, count($orderIds), '?'));
    $sql = "SELECT id, payment_method, payment_status, order_status FROM orders WHERE id IN ($placeholders)";
    $params = $orderIds;

    if ($companyId) {
        $sql .= " AND company_id = ?";
        $params[] = $companyId;
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $fetchedOrders = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Index by ID for easier lookup
    $ordersById = [];
    foreach ($fetchedOrders as $o) {
        $ordersById[$o['id']] = $o;
    }

    $validOrders = [];
    $invalidOrders = [];

    // Verify each requested ID
    foreach ($orderIds as $reqId) {
        // A. Check existence & company (if not in fetched, it's invalid)
        if (!isset($ordersById[$reqId])) {
            $invalidOrders[] = ['id' => $reqId, 'error' => 'Not found or wrong company'];
            continue;
        }

        $order = $ordersById[$reqId];

        // B. Check Tab Rules
        if (empty($rules)) {
             // No rules = pass
             $validOrders[] = $order;
             continue;
        }

        $isMatch = false;
        foreach ($rules as $rule) {
            $r_pm = trim($rule['payment_method'] ?? '');
            $r_ps = trim($rule['payment_status'] ?? '');
            $r_os = trim($rule['order_status'] ?? '');

            $o_pm = trim($order['payment_method'] ?? '');
            $o_ps = trim($order['payment_status'] ?? '');
            $o_os = trim($order['order_status'] ?? '');

            $paymentMethodMatch = empty($r_pm) || strcasecmp($r_pm, 'ALL') === 0 || $r_pm === $o_pm;
            $paymentStatusMatch = empty($r_ps) || strcasecmp($r_ps, 'ALL') === 0 || $r_ps === $o_ps;
            $orderStatusMatch = empty($r_os) || strcasecmp($r_os, 'ALL') === 0 || $r_os === $o_os;

            if ($paymentMethodMatch && $paymentStatusMatch && $orderStatusMatch) {
                $isMatch = true;
                break; 
            }
        }

        if ($isMatch) {
            $validOrders[] = $order;
        } else {
            $invalidOrders[] = $order;
        }
    }

    json_response([
        'valid' => $validOrders,
        'invalid' => $invalidOrders
    ]);

} catch (Throwable $e) {
    json_response(['error' => $e->getMessage()], 500);
}
?>
