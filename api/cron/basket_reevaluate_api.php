<?php
/**
 * Basket Re-evaluate API (JSON)
 * 
 * Logic: ตรวจว่าถังปัจจุบันถูกต้องหรือไม่ (validate current basket)
 * 
 * GET  ?action=scan                     → Scan all misrouted customers (summary + preview)
 * GET  ?action=detail&transition=38→47  → Full list for specific transition with details
 * POST ?action=fix                      → Fix selected transitions
 */

header('Content-Type: application/json; charset=utf-8');

define('SKIP_AUTH', true);
require_once __DIR__ . '/../config.php';

try {
    $pdo = db_connect();
    $action = $_GET['action'] ?? $_POST['action'] ?? 'scan';
    
    // ============================================================
    // Core query: find customers whose current basket is INVALID
    // ============================================================
    $sql = "
        SELECT 
            c.customer_id,
            c.first_name,
            c.last_name,
            c.assigned_to,
            c.current_basket_key,
            lo.creator_id AS latest_creator_id,
            lo.order_date AS latest_order_date,
            lo.order_id AS latest_order_id,
            DATEDIFF(CURDATE(), lo.order_date) AS days_since_order,
            c.last_order_date AS customer_last_order_date,
            CONCAT(COALESCE(u_creator.first_name,''), ' ', COALESCE(u_creator.last_name,'')) AS creator_name,
            CONCAT(COALESCE(u_owner.first_name,''), ' ', COALESCE(u_owner.last_name,'')) AS owner_name,
            bc_from.basket_name AS current_basket_name
        FROM customers c
        INNER JOIN (
            SELECT o1.customer_id, o1.creator_id, o1.order_date, o1.id AS order_id
            FROM orders o1
            INNER JOIN (
                SELECT customer_id, MAX(id) AS max_id
                FROM orders
                WHERE order_status != 'CANCELLED'
                GROUP BY customer_id
            ) o2 ON o1.id = o2.max_id
        ) lo ON lo.customer_id = c.customer_id
        LEFT JOIN basket_config bc_from ON bc_from.id = c.current_basket_key
        LEFT JOIN users u_creator ON u_creator.id = lo.creator_id
        LEFT JOIN users u_owner ON u_owner.id = c.assigned_to
        WHERE c.assigned_to IS NOT NULL
          AND c.current_basket_key IN (38, 39, 40, 46, 47, 48, 49, 50)
          AND NOT (
              (c.current_basket_key = 38 AND DATEDIFF(CURDATE(), lo.order_date) BETWEEN 0 AND 60 AND lo.creator_id != c.assigned_to)
              OR (c.current_basket_key = 39 AND DATEDIFF(CURDATE(), lo.order_date) BETWEEN 0 AND 60 AND lo.creator_id = c.assigned_to)
              OR (c.current_basket_key = 40 AND DATEDIFF(CURDATE(), lo.order_date) BETWEEN 61 AND 90 AND lo.creator_id = c.assigned_to)
              OR (c.current_basket_key = 46 AND DATEDIFF(CURDATE(), lo.order_date) BETWEEN 91 AND 180)
              OR (c.current_basket_key = 47 AND DATEDIFF(CURDATE(), lo.order_date) BETWEEN 0 AND 90 AND lo.creator_id != c.assigned_to)
              OR (c.current_basket_key = 48 AND DATEDIFF(CURDATE(), lo.order_date) BETWEEN 181 AND 365)
              OR (c.current_basket_key = 49 AND DATEDIFF(CURDATE(), lo.order_date) BETWEEN 366 AND 1095)
              OR (c.current_basket_key = 50 AND DATEDIFF(CURDATE(), lo.order_date) >= 1096)
          )
    ";
    
    $stmt = $pdo->query($sql);
    $wrongCustomers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Load basket names
    $nameStmt = $pdo->query("SELECT id, basket_name FROM basket_config");
    $basketNames = [];
    while ($row = $nameStmt->fetch(PDO::FETCH_ASSOC)) {
        $basketNames[$row['id']] = $row['basket_name'];
    }
    
    // Calculate correct basket + reason for each wrong customer
    $processed = [];
    foreach ($wrongCustomers as &$cust) {
        $days = (int)$cust['days_since_order'];
        $isOwn = $cust['latest_creator_id'] == $cust['assigned_to'];
        $currentBasket = (int)$cust['current_basket_key'];
        
        // Determine correct basket
        if ($isOwn) {
            if ($days <= 60) $cust['correct_basket'] = 39;
            elseif ($days <= 90) $cust['correct_basket'] = 40;
            elseif ($days <= 180) $cust['correct_basket'] = 46;
            elseif ($days <= 365) $cust['correct_basket'] = 48;
            elseif ($days <= 1095) $cust['correct_basket'] = 49;
            else $cust['correct_basket'] = 50;
        } else {
            if ($days <= 90) $cust['correct_basket'] = 47;
            elseif ($days <= 180) $cust['correct_basket'] = 46;
            elseif ($days <= 365) $cust['correct_basket'] = 48;
            elseif ($days <= 1095) $cust['correct_basket'] = 49;
            else $cust['correct_basket'] = 50;
        }
        
        // Build reason
        $reasons = [];
        $creatorName = trim($cust['creator_name']);
        $ownerName = trim($cust['owner_name']);
        
        // Why is current basket wrong?
        switch ($currentBasket) {
            case 38: // ลูกค้าใหม่: valid 0-60d, creator ≠ owner
                if ($days > 60) $reasons[] = "อยู่ถัง 38 (0-60d) แต่ order ผ่านมา {$days} วันแล้ว (เกิน 60d)";
                if ($isOwn) $reasons[] = "ผู้สร้าง order = เจ้าของ → ควรอยู่ถัง 39";
                break;
            case 39: // ส่วนตัว: valid 0-60d, creator = owner
                if ($days > 60) $reasons[] = "อยู่ถัง 39 (0-60d) แต่ order ผ่านมา {$days} วันแล้ว (เกิน 60d)";
                if (!$isOwn) $reasons[] = "ผู้สร้าง order ({$creatorName}) ≠ เจ้าของ ({$ownerName}) → ไม่ใช่ขายเอง";
                break;
            case 40: // โอกาสสุดท้าย: valid 61-90d, creator = owner
                if ($days < 61 || $days > 90) $reasons[] = "อยู่ถัง 40 (61-90d) แต่ order ผ่านมา {$days} วัน (นอกช่วง)";
                if (!$isOwn) $reasons[] = "ผู้สร้าง order ({$creatorName}) ≠ เจ้าของ ({$ownerName}) → ไม่ใช่ขายเอง";
                break;
            case 46: // หาคนดูแลใหม่: valid 91-180d
                if ($days < 91 || $days > 180) $reasons[] = "อยู่ถัง 46 (91-180d) แต่ order ผ่านมา {$days} วัน (นอกช่วง)";
                break;
            case 47: // รอจีบ: valid 0-90d, creator ≠ owner
                if ($days > 90) $reasons[] = "อยู่ถัง 47 (0-90d) แต่ order ผ่านมา {$days} วันแล้ว (เกิน 90d)";
                if ($isOwn) $reasons[] = "ผู้สร้าง order = เจ้าของ → ขายเอง ควรอยู่ถัง 39/40";
                break;
            case 48: // กลาง 6-12m: valid 181-365d
                if ($days < 181 || $days > 365) $reasons[] = "อยู่ถัง 48 (181-365d) แต่ order ผ่านมา {$days} วัน (นอกช่วง)";
                break;
            case 49: // กลาง 1-3y: valid 366-1095d
                if ($days < 366 || $days > 1095) $reasons[] = "อยู่ถัง 49 (366-1095d) แต่ order ผ่านมา {$days} วัน (นอกช่วง)";
                break;
            case 50: // โบราณ: valid 1096+
                if ($days < 1096) $reasons[] = "อยู่ถัง 50 (1096d+) แต่ order ผ่านมา {$days} วัน (ยังไม่ถึง)";
                break;
        }
        $cust['reason'] = implode(' | ', $reasons);
        
        if ($cust['correct_basket'] == $currentBasket) continue;
        
        $processed[] = $cust;
    }
    unset($cust);
    $wrongCustomers = $processed;
    
    // Build summary
    $summary = [];
    foreach ($wrongCustomers as $cust) {
        $from = $cust['current_basket_key'];
        $to = $cust['correct_basket'];
        $key = "{$from}→{$to}";
        if (!isset($summary[$key])) {
            $summary[$key] = [
                'from_basket' => (int)$from,
                'from_name' => $basketNames[$from] ?? "Basket $from",
                'to_basket' => (int)$to,
                'to_name' => $basketNames[$to] ?? "Basket $to",
                'count' => 0
            ];
        }
        $summary[$key]['count']++;
    }
    
    // ============================================================
    // ACTION: scan → summary + 100 preview
    // ============================================================
    if ($action === 'scan') {
        $customers = array_map(function($c) use ($basketNames) {
            return [
                'customer_id' => (int)$c['customer_id'],
                'name' => trim($c['first_name'] . ' ' . $c['last_name']),
                'days_since_order' => (int)$c['days_since_order'],
                'current_basket' => (int)$c['current_basket_key'],
                'current_basket_name' => $c['current_basket_name'],
                'correct_basket' => (int)$c['correct_basket'],
                'correct_basket_name' => $basketNames[$c['correct_basket']] ?? "Basket {$c['correct_basket']}",
            ];
        }, array_slice($wrongCustomers, 0, 100));
        
        echo json_encode([
            'success' => true,
            'total_wrong' => count($wrongCustomers),
            'summary' => array_values($summary),
            'customers' => $customers,
            'scanned_at' => date('Y-m-d H:i:s')
        ]);
        exit;
    }
    
    // ============================================================
    // ACTION: detail → full list for a specific transition
    // ============================================================
    if ($action === 'detail') {
        $transition = $_GET['transition'] ?? '';
        
        // Filter customers
        $filtered = array_filter($wrongCustomers, function($c) use ($transition) {
            return "{$c['current_basket_key']}→{$c['correct_basket']}" === $transition;
        });
        
        $customers = array_values(array_map(function($c) use ($basketNames) {
            return [
                'customer_id' => (int)$c['customer_id'],
                'name' => trim($c['first_name'] . ' ' . $c['last_name']),
                'days_since_order' => (int)$c['days_since_order'],
                'current_basket' => (int)$c['current_basket_key'],
                'current_basket_name' => $c['current_basket_name'],
                'correct_basket' => (int)$c['correct_basket'],
                'correct_basket_name' => $basketNames[$c['correct_basket']] ?? "Basket {$c['correct_basket']}",
                'creator_name' => trim($c['creator_name']),
                'creator_id' => (int)$c['latest_creator_id'],
                'owner_name' => trim($c['owner_name']),
                'assigned_to' => (int)$c['assigned_to'],
                'latest_order_date' => $c['latest_order_date'],
                'latest_order_id' => (int)$c['latest_order_id'],
                'is_own_sale' => $c['latest_creator_id'] == $c['assigned_to'],
                'reason' => $c['reason'],
            ];
        }, $filtered));
        
        echo json_encode([
            'success' => true,
            'transition' => $transition,
            'total' => count($customers),
            'customers' => $customers,
        ]);
        exit;
    }
    
    // ============================================================
    // ACTION: fix → move selected transitions
    // ============================================================
    if ($action === 'fix') {
        $fixed = 0;
        $errors = 0;
        
        $body = json_decode(file_get_contents('php://input'), true);
        $allowedTransitions = $body['transitions'] ?? null;
        
        foreach ($wrongCustomers as $cust) {
            $customerId = $cust['customer_id'];
            $toBasket = $cust['correct_basket'];
            $fromBasket = $cust['current_basket_key'];
            
            if ($allowedTransitions !== null) {
                $transKey = "{$fromBasket}→{$toBasket}";
                if (!in_array($transKey, $allowedTransitions)) continue;
            }
            
            $name = trim($cust['first_name'] . ' ' . $cust['last_name']);
            $daysOrder = $cust['days_since_order'];
            
            try {
                $updateStmt = $pdo->prepare("
                    UPDATE customers SET 
                        current_basket_key = ?,
                        basket_entered_date = NOW()
                    WHERE customer_id = ?
                ");
                $updateStmt->execute([$toBasket, $customerId]);
                
                $logStmt = $pdo->prepare("
                    INSERT INTO basket_transition_log 
                        (customer_id, from_basket_key, to_basket_key, transition_type, triggered_by, notes, created_at)
                    VALUES (?, ?, ?, 'safety_reevaluate', ?, ?, NOW())
                ");
                $fromName = $basketNames[$fromBasket] ?? $fromBasket;
                $toName = $basketNames[$toBasket] ?? $toBasket;
                $note = "Safety re-evaluate: '$name' (Order: {$daysOrder}d) $fromName → $toName";
                $logStmt->execute([$customerId, $fromBasket, $toBasket, $cust['assigned_to'], $note]);
                
                $fixed++;
            } catch (Exception $e) {
                $errors++;
            }
        }
        
        echo json_encode([
            'success' => true,
            'total_wrong' => count($wrongCustomers),
            'fixed' => $fixed,
            'errors' => $errors,
            'fixed_at' => date('Y-m-d H:i:s')
        ]);
        exit;
    }
    
    // ============================================================
    // ACTION: misassigned → customers in 39/40 but creator ≠ assigned_to
    // Only flag when creator is Telesale (role 6/7) and NOT inactive
    // Cross-check basket_transition_log to find cause
    // ============================================================
    if ($action === 'misassigned') {
        $showAll = ($_GET['show_all'] ?? '0') === '1';
        
        $misSql = "
            SELECT 
                c.customer_id,
                c.first_name,
                c.last_name,
                c.assigned_to,
                c.current_basket_key,
                lo.creator_id AS latest_creator_id,
                lo.order_date AS latest_order_date,
                lo.order_id AS latest_order_id,
                DATEDIFF(CURDATE(), lo.order_date) AS days_since_order,
                CONCAT(COALESCE(u_creator.first_name,''), ' ', COALESCE(u_creator.last_name,'')) AS creator_name,
                COALESCE(u_creator.role, '') AS creator_role,
                CONCAT(COALESCE(u_owner.first_name,''), ' ', COALESCE(u_owner.last_name,'')) AS owner_name,
                bc.basket_name AS current_basket_name,
                c.basket_entered_date,
                -- Last transition into current basket
                tl.transition_type AS last_transition_type,
                tl.notes AS last_transition_notes,
                tl.created_at AS last_transition_date,
                CONCAT(COALESCE(u_trigger.first_name,''), ' ', COALESCE(u_trigger.last_name,'')) AS last_transition_by
            FROM customers c
            INNER JOIN (
                SELECT o1.customer_id, o1.creator_id, o1.order_date, o1.id AS order_id
                FROM orders o1
                INNER JOIN (
                    SELECT customer_id, MAX(id) AS max_id
                    FROM orders
                    WHERE order_status != 'CANCELLED'
                    GROUP BY customer_id
                ) o2 ON o1.id = o2.max_id
            ) lo ON lo.customer_id = c.customer_id
            INNER JOIN users u_creator ON u_creator.id = lo.creator_id
            LEFT JOIN users u_owner ON u_owner.id = c.assigned_to
            LEFT JOIN basket_config bc ON bc.id = c.current_basket_key
            LEFT JOIN (
                SELECT t1.customer_id, t1.transition_type, t1.notes, t1.created_at, t1.triggered_by
                FROM basket_transition_log t1
                INNER JOIN (
                    SELECT customer_id, MAX(id) AS max_id
                    FROM basket_transition_log
                    GROUP BY customer_id
                ) t2 ON t1.id = t2.max_id
            ) tl ON tl.customer_id = c.customer_id
            LEFT JOIN users u_trigger ON u_trigger.id = tl.triggered_by
            WHERE c.assigned_to IS NOT NULL
              AND c.current_basket_key IN (39, 40)
              AND lo.creator_id != c.assigned_to
              AND u_creator.role_id IN (6, 7)
              AND (u_creator.status IS NULL OR u_creator.status != 'inactive')
        ";
        
        $misStmt = $pdo->query($misSql);
        $misCustomers = $misStmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Prepare statement to check customer_logs for manual assigned_to changes
        // If assigned_to was changed AFTER the latest order → intentional transfer
        $logCheckStmt = $pdo->prepare("
            SELECT cl.created_at, cl.old_values, cl.new_values, cl.created_by,
                   CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,'')) AS changed_by_name
            FROM customer_logs cl
            LEFT JOIN users u ON u.id = cl.created_by
            WHERE cl.customer_id = ?
              AND cl.action_type = 'update'
              AND JSON_CONTAINS(cl.changed_fields, '\"assigned_to\"')
              AND cl.created_at >= ?
            ORDER BY cl.id DESC
            LIMIT 1
        ");
        
        // Classify cause and optionally filter
        $processed = [];
        foreach ($misCustomers as &$mc) {
            $transType = $mc['last_transition_type'] ?? '';
            
            // First: check customer_logs for manual transfer AFTER order date
            $manualTransferDetected = false;
            $manualTransferInfo = '';
            try {
                $logCheckStmt->execute([$mc['customer_id'], $mc['latest_order_date']]);
                $logEntry = $logCheckStmt->fetch(PDO::FETCH_ASSOC);
                if ($logEntry) {
                    // Someone changed assigned_to AFTER the latest order
                    $manualTransferDetected = true;
                    $changedBy = trim($logEntry['changed_by_name']);
                    $manualTransferInfo = "ย้ายโดย {$changedBy} เมื่อ {$logEntry['created_at']}";
                }
            } catch (Exception $e) {
                // If query fails (table might not exist), continue with normal logic
            }
            
            // Determine cause
            if ($manualTransferDetected) {
                $mc['cause'] = 'manual';
                $mc['cause_label'] = 'ย้ายเจ้าของเอง';
                $mc['manual_transfer_info'] = $manualTransferInfo;
            } elseif ($transType === 'monthly_cron') {
                $mc['cause'] = 'cron';
                $mc['cause_label'] = 'Cron ดึงรายชื่อ';
            } elseif ($transType === 'manual_transfer' || $transType === 'admin_reassign') {
                $mc['cause'] = 'manual';
                $mc['cause_label'] = 'ผู้ดูแลย้ายเอง';
            } elseif ($transType === 'new_sale' || $transType === 'sale') {
                $mc['cause'] = 'sale';
                $mc['cause_label'] = 'เข้าจากการขาย';
            } elseif ($transType === 'sale_picking' || $transType === 'picking_telesale_own') {
                $mc['cause'] = 'picking';
                $mc['cause_label'] = 'Cron Picking/Shipping';
            } elseif ($transType === 'safety_reevaluate') {
                $mc['cause'] = 'reevaluate';
                $mc['cause_label'] = 'Safety re-evaluate';
            } elseif ($transType === 'reassign_owner') {
                $mc['cause'] = 'manual';
                $mc['cause_label'] = 'ย้ายเจ้าของ (ระบบ)';
            } elseif (empty($transType)) {
                $mc['cause'] = 'unknown';
                $mc['cause_label'] = 'ไม่มี log';
            } else {
                $mc['cause'] = 'other';
                $mc['cause_label'] = $transType;
            }
            
            // If not show_all, skip manual transfers (intentional)
            if (!$showAll && $mc['cause'] === 'manual') {
                continue;
            }
            
            $processed[] = $mc;
        }
        unset($mc);
        $misCustomers = $processed;
        
        // Group by cause
        $causeSummary = [];
        foreach ($misCustomers as $mc) {
            $cause = $mc['cause'];
            if (!isset($causeSummary[$cause])) {
                $causeSummary[$cause] = [
                    'cause' => $cause,
                    'cause_label' => $mc['cause_label'],
                    'count' => 0
                ];
            }
            $causeSummary[$cause]['count']++;
        }
        
        // Group by basket
        $summary = [];
        foreach ($misCustomers as $mc) {
            $bk = (int)$mc['current_basket_key'];
            if (!isset($summary[$bk])) {
                $summary[$bk] = [
                    'basket_id' => $bk,
                    'basket_name' => $mc['current_basket_name'],
                    'count' => 0
                ];
            }
            $summary[$bk]['count']++;
        }
        
        $customers = array_map(function($mc) {
            return [
                'customer_id' => (int)$mc['customer_id'],
                'name' => trim($mc['first_name'] . ' ' . $mc['last_name']),
                'days_since_order' => (int)$mc['days_since_order'],
                'current_basket' => (int)$mc['current_basket_key'],
                'current_basket_name' => $mc['current_basket_name'],
                'assigned_to' => (int)$mc['assigned_to'],
                'owner_name' => trim($mc['owner_name']),
                'creator_id' => (int)$mc['latest_creator_id'],
                'creator_name' => trim($mc['creator_name']),
                'creator_role' => $mc['creator_role'],
                'latest_order_date' => $mc['latest_order_date'],
                'latest_order_id' => $mc['latest_order_id'],
                'basket_entered_date' => $mc['basket_entered_date'],
                'cause' => $mc['cause'],
                'cause_label' => $mc['cause_label'],
                'last_transition_type' => $mc['last_transition_type'] ?? '',
                'last_transition_date' => $mc['last_transition_date'] ?? '',
                'last_transition_by' => trim($mc['last_transition_by'] ?? ''),
                'last_transition_notes' => $mc['last_transition_notes'] ?? '',
                'reason' => "order ล่าสุดสร้างโดย " . trim($mc['creator_name']) . " (#{$mc['latest_creator_id']}) แต่ลูกค้า assigned ให้ " . trim($mc['owner_name']) . " (#{$mc['assigned_to']})"
                    . ($mc['cause_label'] ? " | สาเหตุ: {$mc['cause_label']}" : ''),
            ];
        }, $misCustomers);
        
        echo json_encode([
            'success' => true,
            'total' => count($misCustomers),
            'show_all' => $showAll,
            'summary' => array_values($summary),
            'cause_summary' => array_values($causeSummary),
            'customers' => $customers,
            'scanned_at' => date('Y-m-d H:i:s')
        ]);
        exit;
    }
    
    // ============================================================
    // ACTION: fix_misassigned → Reassign customers to the order creator
    // ============================================================
    if ($action === 'fix_misassigned') {
        $body = json_decode(file_get_contents('php://input'), true);
        $customerIds = $body['customer_ids'] ?? [];
        
        if (empty($customerIds)) {
            echo json_encode(['success' => false, 'error' => 'No customer IDs provided']);
            exit;
        }
        
        // Re-run the same query to validate
        $misSql = "
            SELECT 
                c.customer_id,
                c.first_name,
                c.last_name,
                c.assigned_to,
                c.current_basket_key,
                lo.creator_id AS latest_creator_id,
                CONCAT(COALESCE(u_creator.first_name,''), ' ', COALESCE(u_creator.last_name,'')) AS creator_name,
                CONCAT(COALESCE(u_owner.first_name,''), ' ', COALESCE(u_owner.last_name,'')) AS owner_name
            FROM customers c
            INNER JOIN (
                SELECT o1.customer_id, o1.creator_id, o1.order_date, o1.id AS order_id
                FROM orders o1
                INNER JOIN (
                    SELECT customer_id, MAX(id) AS max_id
                    FROM orders WHERE order_status != 'CANCELLED'
                    GROUP BY customer_id
                ) o2 ON o1.id = o2.max_id
            ) lo ON lo.customer_id = c.customer_id
            INNER JOIN users u_creator ON u_creator.id = lo.creator_id
            LEFT JOIN users u_owner ON u_owner.id = c.assigned_to
            WHERE c.customer_id IN (" . implode(',', array_map('intval', $customerIds)) . ")
              AND c.current_basket_key IN (39, 40)
              AND lo.creator_id != c.assigned_to
              AND u_creator.role_id IN (6, 7)
              AND (u_creator.status IS NULL OR u_creator.status != 'inactive')
        ";
        
        $misStmt = $pdo->query($misSql);
        $toFix = $misStmt->fetchAll(PDO::FETCH_ASSOC);
        
        $nameStmt = $pdo->query("SELECT id, basket_name FROM basket_config");
        $basketNames2 = [];
        while ($row = $nameStmt->fetch(PDO::FETCH_ASSOC)) {
            $basketNames2[$row['id']] = $row['basket_name'];
        }
        
        $fixed = 0;
        $errors = 0;
        
        foreach ($toFix as $cust) {
            try {
                $updateStmt = $pdo->prepare("
                    UPDATE customers SET assigned_to = ? WHERE customer_id = ?
                ");
                $updateStmt->execute([$cust['latest_creator_id'], $cust['customer_id']]);
                
                $logStmt = $pdo->prepare("
                    INSERT INTO basket_transition_log 
                        (customer_id, from_basket_key, to_basket_key, transition_type, triggered_by, notes, created_at)
                    VALUES (?, ?, ?, 'reassign_owner', ?, ?, NOW())
                ");
                $name = trim($cust['first_name'] . ' ' . $cust['last_name']);
                $fromOwner = trim($cust['owner_name']);
                $toOwner = trim($cust['creator_name']);
                $bk = $cust['current_basket_key'];
                $bName = $basketNames2[$bk] ?? $bk;
                $note = "Reassign: '$name' ถัง $bName — จาก {$fromOwner} (#{$cust['assigned_to']}) → {$toOwner} (#{$cust['latest_creator_id']})";
                $logStmt->execute([$cust['customer_id'], $bk, $bk, $cust['latest_creator_id'], $note]);
                
                $fixed++;
            } catch (Exception $e) {
                $errors++;
            }
        }
        
        echo json_encode([
            'success' => true,
            'fixed' => $fixed,
            'errors' => $errors,
            'fixed_at' => date('Y-m-d H:i:s')
        ]);
        exit;
    }
    
    echo json_encode(['success' => false, 'error' => 'Invalid action']);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
