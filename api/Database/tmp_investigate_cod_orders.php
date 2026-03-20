<?php
/**
 * Fix COD orders - reset amount_paid and payment_status
 * For order 260127-01483ice4w: keep amounts from other COD docs (19,700)
 */
$conn = new mysqli('202.183.192.218', 'primacom_bloguser', 'pJnL53Wkhju2LaGPytw8', 'primacom_mini_erp');
$conn->set_charset("utf8mb4");

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

// The deleted COD document numbers
$deletedCodDocs = [
    'pa19-03-2569-1156', 'sur19-03-2569-1420', 'pa19-03-2569-1245',
    'brm19-03-2569-1210', 'brm19-03-2569-1202', 'pa17-03-2569-1838',
    'cha17-03-2569-1538', 'pa18-03-2569-1515', 'pa18-03-2569-1451',
    'pa18-03-2569-1049', 'pa18-03-2569-1244', 'ubn17-03-2569-1914',
    'yala17-03-2569-0603', 'sur15-03-2569-1616', 'pa14-03-2569-0828',
    'pa14-03-2569-1331', 'pa02-03-2569-2130', 'pa14-03-2569-0627',
    'pa13-03-2569-1150', 'sra13-03-2569-0948', 'bkk14-03-2569-1230',
    'pa12-03-2569-1524', 'yala10-03-2569-1722'
];

// Tracking -> Order mapping (from investigation)
$trackingToOrder = [
    '495105' => '260203-00116ang0q',
    '511443' => '260311-00592ebbwa',
    '514946' => '260316-00953pppsz',
    '511416' => '260312-00613iceqa',
    '506171' => '260304-00176ebbdz',
    '508888' => '260309-00416mawy0',
    '514208' => '260315-00843ebbw6',
    '513392' => '260315-00818wrn5u',
    '514167' => '260316-00879angmd',
    '514214' => '260315-00838wrndq',
    '512916' => '260314-00758pppw1',
    '514206' => '260315-00845ebbwx',
    '511419' => '260312-00610gifkt',
    '511398' => '260312-00630maw8z',
    '499216' => '260224-01120mawuh',
    '508858' => '260308-00385wrn6u',
    '474945' => '260127-01483ice4w',
    '454090' => '260104-00085nan7g',
    '509801' => '260310-00473nancf',
    '509798' => '260310-00477ppp5o',
    '512188' => '260312-00656wrn3p',
    '509832' => '260309-00445pppx9',
    '508822' => '260308-00349pppwa',
];

$uniqueOrderIds = array_unique(array_values($trackingToOrder));

echo "=== PRE-FIX: CHECK CURRENT STATE ===\n\n";

// Check reconcile logs that reference deleted COD docs via notes
echo "--- Reconcile logs referencing deleted COD docs ---\n";
$deletedDocReconcileLogs = [];
foreach ($deletedCodDocs as $docNum) {
    $like = '%' . $conn->real_escape_string($docNum) . '%';
    $stmt = $conn->prepare("SELECT srl.id, srl.order_id, srl.confirmed_amount, srb.notes, srb.id as batch_id
             FROM statement_reconcile_logs srl
             JOIN statement_reconcile_batches srb ON srb.id = srl.batch_id
             WHERE srb.notes LIKE ?");
    $stmt->bind_param('s', $like);
    $stmt->execute();
    $r = $stmt->get_result();
    while ($row = $r->fetch_assoc()) {
        echo "  Doc: $docNum => RecLog #{$row['id']}: Order={$row['order_id']}, ConfAmt={$row['confirmed_amount']}, Batch={$row['batch_id']}\n";
        $deletedDocReconcileLogs[] = $row;
    }
}
echo "Total reconcile logs from deleted docs: " . count($deletedDocReconcileLogs) . "\n";

// Check ALL reconcile logs for each order (to find ones from OTHER docs)
echo "\n--- ALL reconcile logs per order ---\n";
$orderRemainingAmounts = [];
foreach ($uniqueOrderIds as $orderId) {
    $oid = $conn->real_escape_string($orderId);
    $r = $conn->query("SELECT srl.id, srl.order_id, srl.confirmed_amount, srb.notes, srb.document_no
             FROM statement_reconcile_logs srl
             JOIN statement_reconcile_batches srb ON srb.id = srl.batch_id
             WHERE srl.order_id = '$oid'");
    $totalFromDeletedDocs = 0;
    $totalFromOtherDocs = 0;
    $allLogs = [];
    while ($row = $r->fetch_assoc()) {
        $allLogs[] = $row;
        $isFromDeleted = false;
        foreach ($deletedCodDocs as $docNum) {
            if (strpos($row['notes'], $docNum) !== false) {
                $isFromDeleted = true;
                break;
            }
        }
        if ($isFromDeleted) {
            $totalFromDeletedDocs += (float)$row['confirmed_amount'];
        } else {
            $totalFromOtherDocs += (float)$row['confirmed_amount'];
        }
    }
    $orderRemainingAmounts[$orderId] = $totalFromOtherDocs;
    if (count($allLogs) > 0) {
        echo "  Order: $orderId => Total logs: " . count($allLogs) . 
             ", FromDeletedDocs: $totalFromDeletedDocs, FromOtherDocs: $totalFromOtherDocs\n";
        foreach ($allLogs as $log) {
            echo "    RecLog #{$log['id']}: Amt={$log['confirmed_amount']}, Notes={$log['notes']}\n";
        }
    }
}

echo "\n\n=== EXECUTING FIX ===\n\n";

$conn->begin_transaction();

try {
    $fixedOrders = 0;
    $deletedReconcileLogs = 0;
    $deletedBatches = 0;
    
    // Step 1: Delete reconcile logs from deleted COD docs
    foreach ($deletedCodDocs as $docNum) {
        $like = '%' . $conn->real_escape_string($docNum) . '%';
        
        // Delete reconcile logs where batch notes reference this doc
        $stmt = $conn->prepare("DELETE srl FROM statement_reconcile_logs srl
                 JOIN statement_reconcile_batches srb ON srb.id = srl.batch_id
                 WHERE srb.notes LIKE ?");
        $stmt->bind_param('s', $like);
        $stmt->execute();
        $deletedReconcileLogs += $stmt->affected_rows;
        
        // Delete empty batches
        $stmt2 = $conn->prepare("DELETE srb FROM statement_reconcile_batches srb
                  WHERE srb.notes LIKE ?
                  AND NOT EXISTS (SELECT 1 FROM statement_reconcile_logs srl WHERE srl.batch_id = srb.id)");
        $stmt2->bind_param('s', $like);
        $stmt2->execute();
        $deletedBatches += $stmt2->affected_rows;
    }
    
    echo "Deleted reconcile logs: $deletedReconcileLogs\n";
    echo "Deleted empty batches: $deletedBatches\n";
    
    // Step 2: Delete cod_records for tracking numbers still referencing deleted docs
    // Only tracking 474945 had records - check if they reference deleted doc pa02-03-2569-2130
    // Actually the cod_records for 474945 point to pa14-01-2569-1225 and pa12-02-2569-1004 (NOT deleted)
    // So we don't need to delete those
    
    // Step 3: Update orders - set amount_paid to remaining amount from OTHER docs
    foreach ($uniqueOrderIds as $orderId) {
        $remainingAmount = $orderRemainingAmounts[$orderId] ?? 0;
        
        if ($remainingAmount > 0) {
            // Has remaining amount from other docs - set to that amount
            $stmt = $conn->prepare("UPDATE orders SET amount_paid = ?, payment_status = 'PreApproved' WHERE id = ?");
            $stmt->bind_param('ds', $remainingAmount, $orderId);
            $stmt->execute();
            echo "Order $orderId: set amount_paid = $remainingAmount (remaining from other docs), payment_status = PreApproved\n";
        } else {
            // No remaining amount - reset to 0/Unpaid
            $stmt = $conn->prepare("UPDATE orders SET amount_paid = 0, payment_status = 'Unpaid' WHERE id = ?");
            $stmt->bind_param('s', $orderId);
            $stmt->execute();
            echo "Order $orderId: reset amount_paid = 0, payment_status = Unpaid\n";
        }
        $fixedOrders++;
    }
    
    echo "\nTotal orders fixed: $fixedOrders\n";
    
    $conn->commit();
    echo "\n✅ COMMIT SUCCESSFUL\n";
    
    // Step 4: Verify
    echo "\n\n=== POST-FIX VERIFICATION ===\n\n";
    $oidList = implode(',', array_map(function($o) use ($conn) { return "'" . $conn->real_escape_string($o) . "'"; }, $uniqueOrderIds));
    $r = $conn->query("SELECT id, total_amount, amount_paid, payment_status, order_status FROM orders WHERE id IN ($oidList) ORDER BY id");
    echo sprintf("%-30s %-12s %-12s %-15s %-15s\n", "OrderID", "Total", "AmtPaid", "PayStatus", "OrdStatus");
    echo str_repeat("-", 90) . "\n";
    while ($row = $r->fetch_assoc()) {
        $status = "";
        if ((float)$row['amount_paid'] == 0) $status = "✅ RESET";
        else if ((float)$row['amount_paid'] < (float)$row['total_amount']) $status = "✅ PARTIAL (other docs)";
        else $status = "⚠️ STILL FULL";
        echo sprintf("%-30s %-12s %-12s %-15s %-15s %s\n",
            $row['id'], $row['total_amount'], $row['amount_paid'], 
            $row['payment_status'], $row['order_status'], $status);
    }
    
} catch (Exception $e) {
    $conn->rollback();
    echo "❌ ROLLBACK: " . $e->getMessage() . "\n";
}

$conn->close();
