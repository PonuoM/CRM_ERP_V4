<?php
/**
 * save_tracking_log.php
 * บันทึก log ข้อมูลที่ผู้ใช้ import tracking number จากหน้า BulkTrackingPage
 * เพื่อใช้ตรวจสอบกรณีข้อมูลหาย (debug ว่าเป็นที่ระบบหรือฝั่งผู้ใช้)
 *
 * Payload: {
 *   batch_id: string (UUID),
 *   user_id?: number,
 *   username?: string,
 *   company_id?: number,
 *   logs: [{
 *     order_id: string,
 *     resolved_order_id?: string,
 *     tracking_number: string,
 *     box_number?: number,
 *     action?: string,
 *     status?: string,
 *     message?: string
 *   }]
 * }
 */

require_once __DIR__ . '/../config.php';
cors();
$pdo = db_connect();

header('Content-Type: application/json; charset=utf-8');

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'error' => 'Method not allowed']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $logs = $input['logs'] ?? [];
    $batchId = $input['batch_id'] ?? '';

    if (empty($logs) || empty($batchId)) {
        echo json_encode(['success' => false, 'error' => 'No log data or batch_id provided']);
        exit;
    }

    // Get user info from payload (sent by frontend from currentUser)
    $userId = $input['user_id'] ?? null;
    $username = $input['username'] ?? null;
    $companyId = $input['company_id'] ?? null;

    $ipAddress = $_SERVER['REMOTE_ADDR'] ?? null;
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? null;

    $stmt = $pdo->prepare("
        INSERT INTO tracking_import_logs
            (batch_id, user_id, username, company_id, order_id, resolved_order_id, tracking_number, box_number, action, status, message, ip_address, user_agent)
        VALUES
            (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");

    $insertedCount = 0;

    foreach ($logs as $log) {
        $orderId = $log['order_id'] ?? '';
        $resolvedOrderId = $log['resolved_order_id'] ?? null;
        $trackingNumber = $log['tracking_number'] ?? '';
        $boxNumber = $log['box_number'] ?? 1;
        $action = $log['action'] ?? 'import';
        $status = $log['status'] ?? 'success';
        $message = $log['message'] ?? null;

        if (empty($orderId) && empty($trackingNumber)) {
            continue;
        }

        $stmt->execute([
            $batchId,
            $userId,
            $username,
            $companyId,
            $orderId,
            $resolvedOrderId,
            $trackingNumber,
            $boxNumber,
            $action,
            $status,
            $message,
            $ipAddress,
            $userAgent,
        ]);
        $insertedCount++;
    }

    echo json_encode([
        'success' => true,
        'message' => "Logged $insertedCount entries",
        'batch_id' => $batchId,
        'count' => $insertedCount,
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
    ]);
}
