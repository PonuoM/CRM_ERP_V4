<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once '../config.php';
$pdo = db_connect();

try {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || !isset($input['expectation_id']) || !isset($input['actual_qty'])) {
        throw new Exception('Invalid input');
    }

    $expectationId = (int)$input['expectation_id'];
    $actualQty = (int)$input['actual_qty'];
    $actualDate = $input['actual_date'] ?? null;
    $decision = $input['decision'] ?? null; // 'reschedule' | 'close_short' -- applies to the shortfall only
    $newDate = $input['new_date'] ?? null;
    $note = $input['note'] ?? null;
    $userId = $input['user_id'] ?? null;

    if ($actualQty < 0) {
        throw new Exception('Actual quantity must be zero or more');
    }

    $pdo->beginTransaction();

    $stmt = $pdo->prepare("SELECT * FROM stock_arrival_plan_expectations WHERE id = ? FOR UPDATE");
    $stmt->execute([$expectationId]);
    $expectation = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$expectation) {
        throw new Exception('Expectation not found');
    }
    if ($expectation['status'] !== 'expected') {
        throw new Exception('This expectation is already confirmed or closed');
    }

    if (empty($actualDate)) {
        $actualDate = $expectation['expected_date'];
    }

    $expectedQty = (int)$expectation['expected_qty'];
    $shortfall = $expectedQty - $actualQty;
    $newExpectationId = null;

    if ($shortfall > 0) {
        // Part (or none) of this expectation arrived -- the remainder needs a decision
        if ($decision === 'reschedule') {
            if (empty($newDate)) {
                throw new Exception('New date is required to reschedule the remaining quantity');
            }
            $newExpStmt = $pdo->prepare("INSERT INTO stock_arrival_plan_expectations (item_id, expected_qty, expected_date, so_number, created_by) VALUES (?, ?, ?, ?, ?)");
            $newExpStmt->execute([$expectation['item_id'], $shortfall, $newDate, $expectation['so_number'], $userId]);
            $newExpectationId = $pdo->lastInsertId();
        } elseif ($decision === 'close_short') {
            if (empty($note)) {
                throw new Exception('Note is required when closing the remaining quantity as not coming');
            }
        } else {
            throw new Exception('Please choose whether the remaining quantity will be rescheduled or closed');
        }
    }

    $pdo->prepare("UPDATE stock_arrival_plan_expectations
                    SET status = 'confirmed', actual_qty = ?, actual_date = ?, note = ?,
                        confirmed_by = ?, confirmed_at = NOW(), next_expectation_id = ?
                    WHERE id = ?")
        ->execute([$actualQty, $actualDate, $note, $userId, $newExpectationId, $expectationId]);

    $pdo->commit();
    echo json_encode(['success' => true, 'new_expectation_id' => $newExpectationId]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
