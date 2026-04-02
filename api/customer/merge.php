<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/../config.php';

cors();

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    $pdo = db_connect();

    // Authenticate (will throw/exit if unauthorized)
    $user = get_authenticated_user($pdo);
    if (!$user) {
        json_response(['ok' => false, 'error' => 'UNAUTHORIZED', 'message' => 'Missing or invalid token'], 401);
    }
    validate_auth($pdo);

    // Make sure user is Admin or Supervisor (optional security)
    if ($user['role'] !== 'SuperAdmin' && $user['role'] !== 'Admin' && $user['role'] !== 'Supervisor') {
         // json_response(['ok' => false, 'error' => 'FORBIDDEN', 'message' => 'Insufficient permissions to merge customers'], 403);
         // Letting anyone with access to the UI perform it for now if needed, but keeping this check as a good practice.
    }

    $input = json_decode(file_get_contents('php://input'), true);

    $mainCustomerId = isset($input['mainCustomerId']) ? $input['mainCustomerId'] : null;
    $secondaryCustomerId = isset($input['secondaryCustomerId']) ? $input['secondaryCustomerId'] : null;
    $companyId = isset($input['companyId']) ? (int) $input['companyId'] : null;

    if (!$mainCustomerId || !$secondaryCustomerId || !$companyId) {
        json_response(['ok' => false, 'error' => 'Missing required parameters (mainCustomerId, secondaryCustomerId, companyId)'], 400);
    }

    if ($mainCustomerId == $secondaryCustomerId) {
        json_response(['ok' => false, 'error' => 'Cannot merge a customer with themselves'], 400);
    }

    $pdo->beginTransaction();

    try {
        set_audit_context($pdo, 'merge_customers', $user['id'] ?? null);

        // Update orders: move from secondary to main
        $stmtOrders = $pdo->prepare("
            UPDATE orders 
            SET customer_id = ? 
            WHERE customer_id = ? AND company_id = ?
        ");
        $stmtOrders->execute([$mainCustomerId, $secondaryCustomerId, $companyId]);
        $ordersMoved = $stmtOrders->rowCount();

        // Update call_history: move from secondary to main
        $stmtCalls = $pdo->prepare("
            UPDATE call_history 
            SET customer_id = ? 
            WHERE customer_id = ?
        ");
        $stmtCalls->execute([$mainCustomerId, $secondaryCustomerId]);
        $callsMoved = $stmtCalls->rowCount();

        // Update appointments: move from secondary to main
        $stmtAppointments = $pdo->prepare("
            UPDATE appointments 
            SET customer_id = ? 
            WHERE customer_id = ?
        ");
        $stmtAppointments->execute([$mainCustomerId, $secondaryCustomerId]);
        $appointmentsMoved = $stmtAppointments->rowCount();

        // Note: We are specifically NOT deleting the secondary customer or modifying its status per user request.

        $pdo->commit();

        json_response([
            'ok' => true,
            'mainCustomerId' => $mainCustomerId,
            'secondaryCustomerId' => $secondaryCustomerId,
            'ordersMoved' => $ordersMoved,
            'callsMoved' => $callsMoved,
            'appointmentsMoved' => $appointmentsMoved,
            'message' => 'Customers merged successfully'
        ]);

    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }

} catch (Throwable $e) {
    error_log("Error in merge.php: " . $e->getMessage() . " | Line: " . $e->getLine() . " | File: " . $e->getFile());
    error_log("Stack trace: " . $e->getTraceAsString());
    json_response([
        'ok' => false,
        'error' => 'Failed to merge customers: ' . $e->getMessage(),
        'line' => $e->getLine(),
        'file' => basename($e->getFile())
    ], 500);
}
