<?php
$conn = new mysqli('202.183.192.218', 'primacom_bloguser', 'pJnL53Wkhju2LaGPytw8', 'primacom_mini_erp');
$conn->set_charset("utf8mb4");

$output = "=== Remove External Order Reconciliations (Company 1) ===\n";
$output .= "Time: " . date('Y-m-d H:i:s') . "\n\n";

// Step 1: Get all reconcile logs for external orders in company 1
$sql = "
SELECT 
    srl.id as log_id,
    srl.order_id,
    srl.batch_id,
    srl.statement_log_id,
    srl.confirmed_amount,
    o.total_amount,
    o.amount_paid
FROM statement_reconcile_logs srl
INNER JOIN statement_reconcile_batches srb ON srb.id = srl.batch_id
LEFT JOIN orders o ON o.id = srl.order_id
WHERE srb.company_id = 1
  AND (srl.order_id LIKE '%external' OR srl.order_id LIKE '%EXTERNAL')
ORDER BY srl.id
";

$result = $conn->query($sql);
if (!$result) {
    $output .= "SQL ERROR: " . $conn->error . "\n";
    file_put_contents('tmp_result.txt', $output);
    echo $output;
    exit;
}

$logs = [];
$orderIds = [];
$batchIds = [];
while ($row = $result->fetch_assoc()) {
    $logs[] = $row;
    $orderIds[$row['order_id']] = true;
    $batchIds[$row['batch_id']] = true;
}

$output .= "Logs to remove: " . count($logs) . "\n";
$output .= "Unique orders: " . count($orderIds) . "\n";
$output .= "Batches involved: " . count($batchIds) . "\n\n";

// Step 2: BEFORE state
$output .= "=== BEFORE ===\n";
foreach (array_keys($orderIds) as $oid) {
    $r = $conn->query("SELECT id, order_status, payment_status, amount_paid, total_amount FROM orders WHERE id = '" . $conn->real_escape_string($oid) . "'");
    if ($r && $row = $r->fetch_assoc()) {
        $output .= sprintf("  [%s] os=%s ps=%s paid=%.2f total=%.2f\n",
            $row['id'], $row['order_status'], $row['payment_status'], $row['amount_paid'], $row['total_amount']
        );
    }
}

// Step 3: Delete reconcile logs
$output .= "\n=== Deleting reconcile logs ===\n";
foreach ($logs as $log) {
    $stmt = $conn->prepare("DELETE FROM statement_reconcile_logs WHERE id = ?");
    $stmt->bind_param('i', $log['log_id']);
    $stmt->execute();
    $output .= sprintf("  Deleted log #%d (order=%s stmt=#%d amount=%.2f)\n",
        $log['log_id'], $log['order_id'], $log['statement_log_id'], $log['confirmed_amount']
    );
    $stmt->close();
}

// Step 4: Recalculate amount_paid for each affected order
$output .= "\n=== Recalculating amount_paid ===\n";
foreach (array_keys($orderIds) as $oid) {
    $escaped = $conn->real_escape_string($oid);
    
    // Sum remaining reconcile logs
    $r = $conn->query("SELECT COALESCE(SUM(srl.confirmed_amount), 0) as total FROM statement_reconcile_logs srl INNER JOIN statement_reconcile_batches srb ON srb.id = srl.batch_id WHERE srl.order_id = '$escaped' AND srb.company_id = 1");
    $reconTotal = ($r && $row = $r->fetch_assoc()) ? (float)$row['total'] : 0;
    
    // Sum COD records
    $r = $conn->query("SELECT COALESCE(SUM(cod_amount), 0) as total FROM cod_records WHERE order_id = '$escaped' OR order_id LIKE '{$escaped}-%'");
    $codTotal = ($r && $row = $r->fetch_assoc()) ? (float)$row['total'] : 0;
    
    // Sum slips
    $r = $conn->query("SELECT COALESCE(SUM(amount), 0) as total FROM order_slips WHERE order_id = '$escaped'");
    $slipTotal = ($r && $row = $r->fetch_assoc()) ? (float)$row['total'] : 0;
    
    // Sum debt
    $r = $conn->query("SELECT COALESCE(SUM(amount_collected), 0) as total FROM debt_collection WHERE order_id = '$escaped'");
    $debtTotal = ($r && $row = $r->fetch_assoc()) ? (float)$row['total'] : 0;
    
    // Get order total
    $r = $conn->query("SELECT total_amount, order_status FROM orders WHERE id = '$escaped'");
    $orderTotal = 0;
    $currentStatus = '';
    if ($r && $row = $r->fetch_assoc()) {
        $orderTotal = (float)$row['total_amount'];
        $currentStatus = $row['order_status'];
    }
    
    $newPaid = max($reconTotal, $codTotal, $slipTotal, $debtTotal);
    $newPaid = min($orderTotal, $newPaid);
    
    // Determine new statuses
    if ($newPaid <= 0) {
        $newPaymentStatus = 'Unpaid';
        // Revert PreApproved → check tracking
        if ($currentStatus === 'PreApproved') {
            $r = $conn->query("SELECT COUNT(*) as cnt FROM order_tracking_numbers WHERE parent_order_id = '$escaped'");
            $hasTracking = ($r && ($tr = $r->fetch_assoc()) && ($tr['cnt'] ?? 0) > 0);
            $newOrderStatus = $hasTracking ? 'Shipping' : 'Confirmed';
        } else {
            $newOrderStatus = $currentStatus;
        }
    } else {
        $newPaymentStatus = 'PreApproved';
        $newOrderStatus = $currentStatus;
    }
    
    $stmt = $conn->prepare("UPDATE orders SET amount_paid = ?, payment_status = ?, order_status = ? WHERE id = ?");
    $stmt->bind_param('dsss', $newPaid, $newPaymentStatus, $newOrderStatus, $oid);
    $stmt->execute();
    $stmt->close();
    
    $output .= sprintf("  [%s] recon=%.2f cod=%.2f slip=%.2f debt=%.2f → paid=%.2f ps=%s os=%s\n",
        $oid, $reconTotal, $codTotal, $slipTotal, $debtTotal, $newPaid, $newPaymentStatus, $newOrderStatus
    );
}

// Step 5: Clean up empty batches
$output .= "\n=== Cleaning empty batches ===\n";
$cleanedBatches = 0;
foreach (array_keys($batchIds) as $bid) {
    $r = $conn->query("SELECT COUNT(*) as cnt FROM statement_reconcile_logs WHERE batch_id = $bid");
    $remaining = ($r && $row = $r->fetch_assoc()) ? (int)$row['cnt'] : 0;
    if ($remaining === 0) {
        $conn->query("DELETE FROM statement_reconcile_batches WHERE id = $bid");
        $output .= "  Deleted empty batch #$bid\n";
        $cleanedBatches++;
    } else {
        $output .= "  Batch #$bid still has $remaining logs, kept\n";
    }
}
$output .= "Cleaned $cleanedBatches empty batches\n";

// Step 6: Count freed statements
$freedStatements = count(array_unique(array_column($logs, 'statement_log_id')));
$output .= "\n=== Freed $freedStatements statements for re-matching ===\n";

// Step 7: AFTER state
$output .= "\n=== AFTER ===\n";
foreach (array_keys($orderIds) as $oid) {
    $r = $conn->query("SELECT id, order_status, payment_status, amount_paid, total_amount FROM orders WHERE id = '" . $conn->real_escape_string($oid) . "'");
    if ($r && $row = $r->fetch_assoc()) {
        $output .= sprintf("  [%s] os=%s ps=%s paid=%.2f total=%.2f ✅\n",
            $row['id'], $row['order_status'], $row['payment_status'], $row['amount_paid'], $row['total_amount']
        );
    }
}

file_put_contents('tmp_result.txt', $output);
echo $output;
$conn->close();
