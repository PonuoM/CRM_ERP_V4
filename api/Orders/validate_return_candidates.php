<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header('Content-Type: application/json');

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once '../config.php';

$data = json_decode(file_get_contents("php://input"), true);

if (!$data || !isset($data['candidates']) || !is_array($data['candidates'])) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "Invalid input data"]);
    exit;
}

$mode = isset($data['mode']) ? $data['mode'] : 'returning'; // returning | returned
// returning: Check if tracking exists in system, AND ensure NOT in order_returns (or allow if correcting?) 
// -> User requirement: "เมื่อวาง tracking no แล้วตรวจสอบว่ามี tracking no มีการผูกกับ sub order id จริงๆ"
// returned: Check if exists in order_returns (created via returning step) and status is returning/returned?

$conn = db_connect();

try {
    $results = [];

    foreach ($data['candidates'] as $item) {
        $trackingNumber = trim($item['trackingNumber']);
        $index = $item['index'];

        // Helper to translate statuses
        $statusMap = [
            'pending' => 'รอดำเนินการ',
            'returning' => 'กำลังตีกลับ',
            'returned' => 'เข้าคลังแล้ว',
            'good' => 'สภาพดี',
            'damaged' => 'เสียหาย',
            'lost' => 'สูญหาย'
        ];
        $thaiMode = isset($statusMap[$mode]) ? $statusMap[$mode] : $mode;

        if (empty($trackingNumber)) {
            $results[] = [
                'index' => $index,
                'valid' => false,
                'message' => 'ไม่ระบุเลขพัสดุ'
            ];
            continue;
        }

        // 1. Check if Tracking Exists in System (order_tracking_numbers)
        $stmt = $conn->prepare("SELECT order_id, parent_order_id, box_number FROM order_tracking_numbers WHERE tracking_number = ? LIMIT 1");
        $stmt->execute([$trackingNumber]);
        $trackRow = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$trackRow) {
            $results[] = [
                'index' => $index,
                'valid' => false,
                'message' => 'ไม่พบเลขพัสดุในระบบ'
            ];
            continue;
        }

        // Resolve Sub Order ID
        $subOrderId = '';
        if (!empty($trackRow['parent_order_id']) && !empty($trackRow['box_number'])) {
            $subOrderId = $trackRow['parent_order_id'] . '-' . $trackRow['box_number'];
        } elseif (!empty($trackRow['order_id'])) {
            $subOrderId = $trackRow['order_id'];
        }

        // 2. Check Order Returns Table
        $stmtReturn = $conn->prepare("SELECT id, status FROM order_returns WHERE tracking_number = ? LIMIT 1");
        $stmtReturn->execute([$trackingNumber]);
        $returnRow = $stmtReturn->fetch(PDO::FETCH_ASSOC);

        // Validation based on Mode
        // "Unrestricted" logic: Always valid if tracking exists in system.
        if ($returnRow) {
            $currentStatus = $returnRow['status'];
            $thaiStatus = isset($statusMap[$currentStatus]) ? $statusMap[$currentStatus] : $currentStatus;

            if ($currentStatus === 'pending') {
                $results[] = [
                    'index' => $index,
                    'valid' => true,
                    'message' => 'พร้อมอัปเดต (สถานะเดิม: ' . $thaiStatus . ')',
                    'subOrderId' => $subOrderId,
                    'foundStatus' => $currentStatus
                ];
            } else {
                // Return as valid but with warning flag for UI awareness
                $results[] = [
                    'index' => $index,
                    'valid' => true,
                    'isWarning' => true,
                    'message' => 'สถานะปัจจุบัน: ' . $thaiStatus . ' (นำเข้าซ้ำได้)',
                    'subOrderId' => $subOrderId,
                    'foundStatus' => $currentStatus
                ];
            }
        } else {
            $results[] = [
                'index' => $index,
                'valid' => true,
                'message' => 'สร้างรายการใหม่ (' . $thaiMode . ')',
                'subOrderId' => $subOrderId
            ];
        }
    }

    echo json_encode(['results' => $results]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>