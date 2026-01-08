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
    $tabs = ['waitingVerifySlip', 'waitingExport', 'preparing', 'shipping', 'awaiting_account', 'cancelled'];

    // Fetch active tab rules
    $tabRules = [];
    try {
        $ruleStmt = $pdo->prepare("SELECT * FROM order_tab_rules WHERE (company_id = ? OR company_id = 0) AND is_active = 1 ORDER BY display_order");
        $ruleStmt->execute([$companyId]);
        $allRules = $ruleStmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($allRules as $r) {
            $tabRules[$r['tab_key']][] = $r;
        }
    } catch (Throwable $e) {
        // Fallback or log error
        error_log("Failed to fetch tab rules in counts: " . $e->getMessage());
    }

    foreach ($tabs as $t) {
        $conds = ["o.company_id = ?"];
        $p = [$companyId];
        $conds[] = "o.id NOT REGEXP '^.+-[0-9]+$'";

        // Check for Dynamic Rules first
        if (!empty($tabRules[$t])) {
             $ruleConditions = [];
             foreach ($tabRules[$t] as $r) {
                 $subConds = [];
                 if (!empty($r['payment_method'])) {
                     $subConds[] = "o.payment_method = " . $pdo->quote($r['payment_method']);
                 }
                 if (!empty($r['payment_status'])) {
                     if ($r['payment_status'] === 'NULL') {
                         $subConds[] = "o.payment_status IS NULL";
                     } else {
                         $subConds[] = "o.payment_status = " . $pdo->quote($r['payment_status']);
                     }
                 }
                 if (!empty($r['order_status'])) {
                     $subConds[] = "o.order_status = " . $pdo->quote($r['order_status']);
                 }
                 
                 if (!empty($subConds)) {
                     $ruleConditions[] = "(" . implode(' AND ', $subConds) . ")";
                 }
             }
             
             if (!empty($ruleConditions)) {
                 $conds[] = "(" . implode(' OR ', $ruleConditions) . ")";
             } else {
                 // Optimization: If rules exist but generate no conditions (empty rules?), 
                 // it effectively means "Match all" or "Match None" depending on interpretation.
                 // Assuming "Match All" if user created a rule with no constraints? 
                 // Or safer to just add nothing (Match All subset of company).
             }
        } 
        else {
            // Fallback: Hardcoded Logic
            switch ($t) {
                    case 'waitingVerifySlip':
                    // Transfer + Pending Status (Exclude Verified, include NULLs)
                    $conds[] = 'o.order_status = ?';
                    $p[] = 'Pending';
                    $conds[] = 'o.payment_method = ?';
                    $p[] = 'Transfer';
                    $conds[] = '(o.payment_status != ? OR o.payment_status IS NULL)';
                    $p[] = 'Verified';
                    break;
                    case 'waitingExport':
                    // Pending Status
                    // For Transfer, must be Verified. For others (COD), just Pending.
                    $conds[] = 'o.order_status = ?';
                    $p[] = 'Pending';
                    $conds[] = '(o.payment_method != ? OR o.payment_status = ?)';
                    $p[] = 'Transfer';
                    $p[] = 'Verified';
                    // COD orders must have payment_status = Unpaid
                    $conds[] = '(o.payment_method != ? OR o.payment_status = ?)';
                    $p[] = 'COD';
                    $p[] = 'Unpaid';
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
                    case 'cancelled':
                    $conds[] = 'o.order_status = "Cancelled"';
                    break;
            }
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
