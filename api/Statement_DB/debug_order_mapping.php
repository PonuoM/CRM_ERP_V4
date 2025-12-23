<?php
require_once __DIR__ . "/../config.php";

$orderId = '251219-00020admin26';

try {
    $pdo = db_connect();

    echo "=== ORDER DATA ===\n";
    $stmt = $pdo->prepare("SELECT * FROM orders WHERE id = ?");
    $stmt->execute([$orderId]);
    $order = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$order) {
        echo "Order not found!\n";
        exit;
    }
    print_r($order);

    echo "\n=== ORDER SLIPS ===\n";
    $stmt = $pdo->prepare("SELECT * FROM order_slips WHERE order_id = ?");
    $stmt->execute([$orderId]);
    $slips = $stmt->fetchAll(PDO::FETCH_ASSOC);
    print_r($slips);

    echo "\n=== POTENTIAL STATEMENTS ===\n";
    if (empty($slips)) {
        echo "No slips to match against.\n";
    } else {
        foreach ($slips as $i => $slip) {
            echo "--- Checking matches for Slip #$i (Amount: {$slip['amount']}, Date: {$slip['transfer_date']}) ---\n";
            // Search criteria: Same amount, time within +/- 5 minutes
            $amount = $slip['amount'];
            $date = $slip['transfer_date'];
            
            if (!$date || !$amount) {
                echo "Skipping invalid slip data.\n";
                continue;
            }

            $sql = "SELECT * FROM statement_logs 
                    WHERE amount = :amount 
                    AND transfer_at BETWEEN DATE_SUB(:date1, INTERVAL 5 MINUTE) AND DATE_ADD(:date2, INTERVAL 5 MINUTE)";
            
            // Also matching bank account if possible?
            // AND (bank_account_id = :bankId OR :bankId IS NULL)
            
            $matchStmt = $pdo->prepare($sql);
            $matchStmt->execute([':amount' => $amount, ':date1' => $date, ':date2' => $date]);
            $statements = $matchStmt->fetchAll(PDO::FETCH_ASSOC);
            
            if (count($statements) > 0) {
                foreach ($statements as $st) {
                    $diff = abs(strtotime($st['transfer_at']) - strtotime($date));
                    echo "FOUND: ID {$st['id']} | Time: {$st['transfer_at']} (Diff: {$diff}s) | BankID: {$st['bank_account_id']} | Desc: {$st['description']}\n";
                    
                    // Check if already reconciled
                    $reconStmt = $pdo->prepare("SELECT * FROM statement_reconcile_logs WHERE statement_log_id = ?");
                    $reconStmt->execute([$st['id']]);
                    $recon = $reconStmt->fetch(PDO::FETCH_ASSOC);
                    if ($recon) {
                        echo "   [!] ALREADY RECONCILED TO: {$recon['order_id']} (ReconID: {$recon['id']})\n";
                    } else {
                        echo "   [OK] Not yet reconciled.\n";
                    }
                }
            } else {
                echo "No statements found within +/- 5 minutes for this amount.\n";
            }
        }
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
