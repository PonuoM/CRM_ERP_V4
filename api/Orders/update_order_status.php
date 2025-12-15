<?php
require_once __DIR__ . '/../config.php';

function handle_update_order_status(PDO $pdo) {
    // Debug logging
    file_put_contents(__DIR__ . '/../../debug_log.txt', "Entered handle_update_order_status\n", FILE_APPEND);

    if (method() !== 'POST') {
        file_put_contents(__DIR__ . '/../../debug_log.txt', "Method not POST\n", FILE_APPEND);
        json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }

    $data = json_input();
    file_put_contents(__DIR__ . '/../../debug_log.txt', "Data: " . print_r($data, true) . "\n", FILE_APPEND);
    
    if (!isset($data['orderId']) || !isset($data['status'])) {
        file_put_contents(__DIR__ . '/../../debug_log.txt', "Missing params\n", FILE_APPEND);
        json_response(['error' => 'MISSING_PARAMETERS'], 400);
    }

    $orderId = $data['orderId'];
    $status = $data['status'];
    $note = isset($data['note']) ? $data['note'] : '';

    file_put_contents(__DIR__ . '/../../debug_log.txt', "OrderId: $orderId, Status: $status\n", FILE_APPEND);

    // Validate status
    $allowedStatuses = ['Claiming', 'BadDebt', 'Pending', 'Confirmed', 'Returned', 'Cancelled']; 
    if (!in_array($status, $allowedStatuses)) {
        file_put_contents(__DIR__ . '/../../debug_log.txt', "Status not allowed\n", FILE_APPEND);
    }

    try {
        file_put_contents(__DIR__ . '/../../debug_log.txt', "Preparing update...\n", FILE_APPEND);
        
        $sql = "UPDATE orders SET order_status = ?, notes = CONCAT(COALESCE(notes, ''), ' ', ?) WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        
        $noteContent = $note ? "\n[Status Update: $status] $note" : "";
        
        $stmt->execute([$status, $noteContent, $orderId]);
        
        file_put_contents(__DIR__ . '/../../debug_log.txt', "Execute success. RowCount: " . $stmt->rowCount() . "\n", FILE_APPEND);

        if ($stmt->rowCount() > 0) {
            json_response(['success' => true, 'message' => 'Order status updated']);
        } else {
             // Check if order exists
            $check = $pdo->prepare("SELECT id FROM orders WHERE id = ?");
            $check->execute([$orderId]);
            if ($check->rowCount() === 0) {
                json_response(['error' => 'ORDER_NOT_FOUND'], 404);
            } else {
                json_response(['success' => true, 'message' => 'No changes made']);
            }
        }

    } catch (PDOException $e) {
        file_put_contents(__DIR__ . '/../../debug_log.txt', "Exception: " . $e->getMessage() . "\n", FILE_APPEND);
        json_response(['error' => 'QUERY_FAILED', 'message' => $e->getMessage()], 500);
    }
}

if (basename(__FILE__) == basename($_SERVER["SCRIPT_FILENAME"])) {
    $pdo = db_connect();
    handle_update_order_status($pdo);
}
?>
