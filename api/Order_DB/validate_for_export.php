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

    if (empty($orderIds)) {
        json_response(['valid' => [], 'invalid' => []]);
    }

    $pdo = db_connect();

    // 1. Fetch Rules
    $stmt = $pdo->prepare("SELECT * FROM order_tab_rules WHERE tab_key = ? AND is_active = 1");
    $stmt->execute([$tabKey]);
    $rules = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 2. Fetch Orders
    // Create placeholders for IN clause
    $placeholders = implode(',', array_fill(0, count($orderIds), '?'));
    $stmt = $pdo->prepare("SELECT id, payment_method, payment_status, order_status FROM orders WHERE id IN ($placeholders)");
    $stmt->execute($orderIds);
    $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $validOrders = [];
    $invalidOrders = [];

    // If no rules exist for this tab, generic logic (or pass all? or fail all?)
    // Assuming if rules exist, we enforce them. If no rules, maybe pass all or fail all.
    // Frontend logic was: `const tabRules = ...; if (tabRules.length > 0) { ... }`
    // So if no rules, it skipped validation (effectively valid).
    
    if (empty($rules)) {
         // Return all as valid if no rules? Or return as is?
         // Frontend behavior: "if (tabRules.length > 0) { check... }" -> implies if 0, do nothing (pass).
         // So we just return everything as valid.
         foreach ($orders as $order) {
             $validOrders[] = $order;
         }
         json_response(['valid' => $validOrders, 'invalid' => []]);
    }

    foreach ($orders as $order) {
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
            // Include reason or just the order
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
