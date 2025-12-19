<?php

function handle_order_counts($pdo) {
    if (method() !== 'GET') {
        json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }

    $companyId = $_GET['companyId'] ?? null;
    if (!$companyId) {
        json_response(['error' => 'COMPANY_ID_REQUIRED'], 400);
    }
    
    $tabCounts = [];
    // Exclude 'completed' from global counts for performance (loaded on demand)
    $tabs = ['waitingVerifySlip', 'waitingExport', 'preparing', 'shipping', 'awaiting_account'];

    foreach ($tabs as $t) {
        $conds = ["o.company_id = ?"];
        $p = [$companyId];
        $conds[] = "o.id NOT REGEXP '^.+-[0-9]+$'";

        switch ($t) {
                case 'waitingVerifySlip':
                // Transfer + Pending Status
                $conds[] = 'o.order_status = ?';
                $p[] = 'Pending';
                $conds[] = 'o.payment_method = ?';
                $p[] = 'Transfer';
                break;
                case 'waitingExport':
                // Pending Status (All Payment Methods)
                $conds[] = 'o.order_status = ?';
                $p[] = 'Pending';
                break;
                case 'preparing':
                $conds[] = 'o.order_status IN (?, ?)';
                $p[] = 'Preparing';
                $p[] = 'Picking';
                break;
                case 'shipping':
                $conds[] = 'o.order_status = ?';
                $p[] = 'Shipping';
                break;
                case 'awaiting_account':
                $conds[] = 'o.payment_status = ?';
                $p[] = 'PreApproved';
                $conds[] = 'o.payment_method NOT IN ("Claim", "FreeGift")';
                break;
                case 'completed':
                $conds[] = 'o.order_status = "Delivered"';
                break;
        }
        
        $tabSql = "SELECT COUNT(DISTINCT o.id) FROM orders o";
        if ($t === 'completed') {
                $tabSql .= " LEFT JOIN statement_reconcile_logs srl ON (
                srl.order_id COLLATE utf8mb4_unicode_ci = o.id 
                OR srl.confirmed_order_id COLLATE utf8mb4_unicode_ci = o.id
                )";
        }
        
        $sqlT = $tabSql . " WHERE " . implode(' AND ', $conds);
        $stmtT = $pdo->prepare($sqlT);
        $stmtT->execute($p);
        $tabCounts[$t] = (int)$stmtT->fetchColumn();
    }
    
    json_response(['ok' => true, 'tabCounts' => $tabCounts]);
}
