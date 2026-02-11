<?php
/**
 * validate_return_candidates.php
 * ตรวจสอบ tracking numbers ว่าสามารถบันทึกการคืนได้หรือไม่
 * ใช้ตาราง order_boxes แทน order_returns
 *
 * Payload: { candidates: [{trackingNumber, index}], mode: 'returning'|'returned' }
 */

require_once __DIR__ . '/../config.php';
cors();
$pdo = db_connect();

header('Content-Type: application/json; charset=utf-8');

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $candidates = $input['candidates'] ?? [];
    $mode = $input['mode'] ?? 'returning';

    // Extract tracking numbers from candidates array
    $trackingNumbers = [];
    foreach ($candidates as $candidate) {
        $tn = trim($candidate['trackingNumber'] ?? $candidate['tracking_number'] ?? '');
        if ($tn !== '') {
            $trackingNumbers[] = $tn;
        }
    }

    if (empty($candidates)) {
        echo json_encode(['success' => false, 'error' => 'No tracking numbers provided']);
        exit;
    }

    $results = [];

    foreach ($candidates as $candidate) {
        $trackingNumber = trim($candidate['trackingNumber'] ?? $candidate['tracking_number'] ?? '');
        $candidateIndex = $candidate['index'] ?? null;

        if (empty($trackingNumber))
            continue;

        $result = [
            'index' => $candidateIndex,
            'tracking_number' => $trackingNumber,
            'valid' => false,
            'message' => '',
            'subOrderId' => null,
            'foundStatus' => null,
            'isWarning' => false,
            'order_id' => null,
        ];

        // 1. Check order_tracking_numbers table
        $stmtTrack = $pdo->prepare("
            SELECT otn.id, otn.parent_order_id, otn.order_id, otn.box_number, otn.tracking_number
            FROM order_tracking_numbers otn
            WHERE otn.tracking_number = ?
            LIMIT 1
        ");
        $stmtTrack->execute([$trackingNumber]);
        $trackRow = $stmtTrack->fetch(PDO::FETCH_ASSOC);

        if (!$trackRow) {
            $result['message'] = 'Tracking number not found';
            $results[] = $result;
            continue;
        }

        $orderId = $trackRow['parent_order_id'] ?: $trackRow['order_id'];
        $boxNumber = $trackRow['box_number'];
        $result['order_id'] = $orderId;

        // 2. Check order_boxes for this tracking's box
        $stmtBox = $pdo->prepare("
            SELECT ob.id, ob.sub_order_id, ob.return_status, ob.order_id, ob.box_number
            FROM order_boxes ob
            WHERE ob.order_id = ? AND ob.box_number = ?
            LIMIT 1
        ");
        $stmtBox->execute([$orderId, $boxNumber]);
        $boxRow = $stmtBox->fetch(PDO::FETCH_ASSOC);

        if (!$boxRow) {
            $result['message'] = 'Order box not found for this tracking number';
            $results[] = $result;
            continue;
        }

        $result['subOrderId'] = $boxRow['sub_order_id'];
        $currentReturnStatus = $boxRow['return_status'];
        $result['foundStatus'] = $currentReturnStatus;

        // 3. Always valid (no status restrictions)
        $result['valid'] = true;
        $result['message'] = 'OK';

        // Warn if already has a return status
        if ($currentReturnStatus) {
            $statusMap = [
                'returning' => 'กำลังตีกลับ',
                'returned' => 'เข้าคลังแล้ว',
                'good' => 'สภาพดี',
                'damaged' => 'เสียหาย',
                'lost' => 'สูญหาย',
            ];
            $thaiStatus = $statusMap[$currentReturnStatus] ?? $currentReturnStatus;
            $result['isWarning'] = true;
            $result['message'] = "เลข Tracking มีสถานะเป็น \"$thaiStatus\"";
        }

        $results[] = $result;
    }

    echo json_encode([
        'success' => true,
        'results' => $results,
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
    ]);
}