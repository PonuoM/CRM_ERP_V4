<?php
/**
 * Batch update orders after COD import.
 * Instead of N sequential (cod_records + order_slips + patchOrder) per order,
 * this does everything in one request.
 *
 * POST body: {
 *   "company_id": 5,
 *   "order_ids": ["250101-00001", "250101-00002", ...]
 * }
 * Response: { "ok": true, "updates": { "250101-00001": { amountPaid, paymentStatus }, ... } }
 */
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
    http_response_code(204);
    exit();
}

require_once dirname(__DIR__) . "/config.php";

$input = json_decode(file_get_contents("php://input"), true);
$companyId = isset($input["company_id"]) ? (int) $input["company_id"] : 0;
$orderIds = $input["order_ids"] ?? [];

if ($companyId <= 0 || !is_array($orderIds) || count($orderIds) === 0) {
    echo json_encode(["ok" => true, "updates" => new \stdClass()]);
    exit();
}

// Limit to 500
$orderIds = array_slice($orderIds, 0, 500);

try {
    $pdo = db_connect();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $placeholders = implode(',', array_fill(0, count($orderIds), '?'));

    // 1. Sum cod_amounts per order (using LIKE for sub-order matching)
    //    We need to handle base order IDs that might have sub-orders like "250101-00001admin1"
    //    So we query all cod_records and group by matching base order
    $codSql = "
    SELECT cr.order_id, SUM(cr.cod_amount) AS total_cod
    FROM cod_records cr
    WHERE cr.company_id = ?
      AND (cr.order_id IN ($placeholders) OR " .
        implode(' OR ', array_fill(0, count($orderIds), 'cr.order_id LIKE ?'))
        . ")
    GROUP BY cr.order_id
  ";
    $codParams = [$companyId];
    $codParams = array_merge($codParams, $orderIds); // exact match
    foreach ($orderIds as $oid) {
        $codParams[] = $oid . '%'; // LIKE match for sub-orders
    }
    $codStmt = $pdo->prepare($codSql);
    $codStmt->execute($codParams);
    $codRows = $codStmt->fetchAll(PDO::FETCH_ASSOC);

    // Aggregate by base order ID
    $codTotals = [];
    foreach ($codRows as $row) {
        // Extract base order ID (before any suffix letters)
        $baseId = $row['order_id'];
        // Match to whichever input order ID is a prefix
        foreach ($orderIds as $oid) {
            if (strpos($baseId, $oid) === 0) {
                $codTotals[$oid] = ($codTotals[$oid] ?? 0) + (float) $row['total_cod'];
                break;
            }
        }
    }

    // 2. Sum slip amounts per order (non-rejected)
    $slipSql = "
    SELECT os.order_id, SUM(os.amount) AS total_slip
    FROM order_slips os
    JOIN orders o ON os.order_id = o.id AND o.company_id = ?
    WHERE os.order_id IN ($placeholders)
    GROUP BY os.order_id
  ";
    $slipParams = [$companyId];
    $slipParams = array_merge($slipParams, $orderIds);
    $slipStmt = $pdo->prepare($slipSql);
    $slipStmt->execute($slipParams);
    $slipRows = $slipStmt->fetchAll(PDO::FETCH_ASSOC);

    $slipTotals = [];
    foreach ($slipRows as $row) {
        $slipTotals[$row['order_id']] = (float) $row['total_slip'];
    }

    // 3. Update each order
    $pdo->beginTransaction();
    $updates = [];

    $updateStmt = $pdo->prepare("
    UPDATE orders SET amount_paid = ?, payment_status = ?, order_status = CASE WHEN ? = 'preapproved' THEN 'PreApproved' ELSE order_status END
    WHERE id = ? AND company_id = ?
  ");

    foreach ($orderIds as $orderId) {
        $codTotal = $codTotals[$orderId] ?? 0;
        $slipTotal = $slipTotals[$orderId] ?? 0;
        $totalPaid = round($codTotal + $slipTotal, 2);

        $paymentStatus = $totalPaid > 0 ? 'preapproved' : 'pending_verification';

        $updateStmt->execute([$totalPaid, $paymentStatus, $paymentStatus, $orderId, $companyId]);

        $updates[$orderId] = [
            'amountPaid' => $totalPaid,
            'paymentStatus' => $paymentStatus === 'preapproved' ? 'PreApproved' : 'PendingVerification',
        ];
    }

    $pdo->commit();

    echo json_encode(["ok" => true, "updates" => $updates], JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(["ok" => false, "error" => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
?>