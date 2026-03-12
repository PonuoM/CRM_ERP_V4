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
    set_audit_context($pdo, 'cron/basket_reevaluate');
    $action = $_GET['action'] ?? $_POST['action'] ?? 'scan';
    $companyId = isset($_GET['companyId']) ? (int)$_GET['companyId'] : null;

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
    if ($companyId) {
        $sql .= " AND c.company_id = " . $companyId;
    }

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
        $days = (int) $cust['days_since_order'];
        $isOwn = $cust['latest_creator_id'] == $cust['assigned_to'];
        $currentBasket = (int) $cust['current_basket_key'];

        // Determine correct basket
        if ($isOwn) {
            if ($days <= 60)
                $cust['correct_basket'] = 39;
            elseif ($days <= 90)
                $cust['correct_basket'] = 40;
            elseif ($days <= 180)
                $cust['correct_basket'] = 46;
            elseif ($days <= 365)
                $cust['correct_basket'] = 48;
            elseif ($days <= 1095)
                $cust['correct_basket'] = 49;
            else
                $cust['correct_basket'] = 50;
        } else {
            if ($days <= 90)
                $cust['correct_basket'] = 47;
            elseif ($days <= 180)
                $cust['correct_basket'] = 46;
            elseif ($days <= 365)
                $cust['correct_basket'] = 48;
            elseif ($days <= 1095)
                $cust['correct_basket'] = 49;
            else
                $cust['correct_basket'] = 50;
        }

        // Build reason
        $reasons = [];
        $creatorName = trim($cust['creator_name']);
        $ownerName = trim($cust['owner_name']);

        // Why is current basket wrong?
        switch ($currentBasket) {
            case 38: // ลูกค้าใหม่: valid 0-60d, creator ≠ owner
                if ($days > 60)
                    $reasons[] = "อยู่ถัง 38 (0-60d) แต่ order ผ่านมา {$days} วันแล้ว (เกิน 60d)";
                if ($isOwn)
                    $reasons[] = "ผู้สร้าง order = เจ้าของ → ควรอยู่ถัง 39";
                break;
            case 39: // ส่วนตัว: valid 0-60d, creator = owner
                if ($days > 60)
                    $reasons[] = "อยู่ถัง 39 (0-60d) แต่ order ผ่านมา {$days} วันแล้ว (เกิน 60d)";
                if (!$isOwn)
                    $reasons[] = "ผู้สร้าง order ({$creatorName}) ≠ เจ้าของ ({$ownerName}) → ไม่ใช่ขายเอง";
                break;
            case 40: // โอกาสสุดท้าย: valid 61-90d, creator = owner
                if ($days < 61 || $days > 90)
                    $reasons[] = "อยู่ถัง 40 (61-90d) แต่ order ผ่านมา {$days} วัน (นอกช่วง)";
                if (!$isOwn)
                    $reasons[] = "ผู้สร้าง order ({$creatorName}) ≠ เจ้าของ ({$ownerName}) → ไม่ใช่ขายเอง";
                break;
            case 46: // หาคนดูแลใหม่: valid 91-180d
                if ($days < 91 || $days > 180)
                    $reasons[] = "อยู่ถัง 46 (91-180d) แต่ order ผ่านมา {$days} วัน (นอกช่วง)";
                break;
            case 47: // รอจีบ: valid 0-90d, creator ≠ owner
                if ($days > 90)
                    $reasons[] = "อยู่ถัง 47 (0-90d) แต่ order ผ่านมา {$days} วันแล้ว (เกิน 90d)";
                if ($isOwn)
                    $reasons[] = "ผู้สร้าง order = เจ้าของ → ขายเอง ควรอยู่ถัง 39/40";
                break;
            case 48: // กลาง 6-12m: valid 181-365d
                if ($days < 181 || $days > 365)
                    $reasons[] = "อยู่ถัง 48 (181-365d) แต่ order ผ่านมา {$days} วัน (นอกช่วง)";
                break;
            case 49: // กลาง 1-3y: valid 366-1095d
                if ($days < 366 || $days > 1095)
                    $reasons[] = "อยู่ถัง 49 (366-1095d) แต่ order ผ่านมา {$days} วัน (นอกช่วง)";
                break;
            case 50: // โบราณ: valid 1096+
                if ($days < 1096)
                    $reasons[] = "อยู่ถัง 50 (1096d+) แต่ order ผ่านมา {$days} วัน (ยังไม่ถึง)";
                break;
        }
        $cust['reason'] = implode(' | ', $reasons);

        if ($cust['correct_basket'] == $currentBasket)
            continue;

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
                'from_basket' => (int) $from,
                'from_name' => $basketNames[$from] ?? "Basket $from",
                'to_basket' => (int) $to,
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
        $customers = array_map(function ($c) use ($basketNames) {
            return [
                'customer_id' => (int) $c['customer_id'],
                'name' => trim($c['first_name'] . ' ' . $c['last_name']),
                'days_since_order' => (int) $c['days_since_order'],
                'current_basket' => (int) $c['current_basket_key'],
                'current_basket_name' => $c['current_basket_name'],
                'correct_basket' => (int) $c['correct_basket'],
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
        $filtered = array_filter($wrongCustomers, function ($c) use ($transition) {
            return "{$c['current_basket_key']}→{$c['correct_basket']}" === $transition;
        });

        $customers = array_values(array_map(function ($c) use ($basketNames) {
            return [
                'customer_id' => (int) $c['customer_id'],
                'name' => trim($c['first_name'] . ' ' . $c['last_name']),
                'days_since_order' => (int) $c['days_since_order'],
                'current_basket' => (int) $c['current_basket_key'],
                'current_basket_name' => $c['current_basket_name'],
                'correct_basket' => (int) $c['correct_basket'],
                'correct_basket_name' => $basketNames[$c['correct_basket']] ?? "Basket {$c['correct_basket']}",
                'creator_name' => trim($c['creator_name']),
                'creator_id' => (int) $c['latest_creator_id'],
                'owner_name' => trim($c['owner_name']),
                'assigned_to' => (int) $c['assigned_to'],
                'latest_order_date' => $c['latest_order_date'],
                'latest_order_id' => (int) $c['latest_order_id'],
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
                if (!in_array($transKey, $allowedTransitions))
                    continue;
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
                        (customer_id, from_basket_key, to_basket_key, assigned_to_old, assigned_to_new, transition_type, triggered_by, notes, created_at)
                    VALUES (?, ?, ?, ?, ?, 'safety_reevaluate', ?, ?, NOW())
                ");
                $fromName = $basketNames[$fromBasket] ?? $fromBasket;
                $toName = $basketNames[$toBasket] ?? $toBasket;
                $note = "Safety re-evaluate: '$name' (Order: {$daysOrder}d) $fromName → $toName";
                $logStmt->execute([$customerId, $fromBasket, $toBasket, $cust['assigned_to'], $cust['assigned_to'], $cust['assigned_to'], $note]);

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
        if ($companyId) {
            $misSql .= " AND c.company_id = " . $companyId;
        }

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
            $bk = (int) $mc['current_basket_key'];
            if (!isset($summary[$bk])) {
                $summary[$bk] = [
                    'basket_id' => $bk,
                    'basket_name' => $mc['current_basket_name'],
                    'count' => 0
                ];
            }
            $summary[$bk]['count']++;
        }

        $customers = array_map(function ($mc) {
            return [
                'customer_id' => (int) $mc['customer_id'],
                'name' => trim($mc['first_name'] . ' ' . $mc['last_name']),
                'days_since_order' => (int) $mc['days_since_order'],
                'current_basket' => (int) $mc['current_basket_key'],
                'current_basket_name' => $mc['current_basket_name'],
                'assigned_to' => (int) $mc['assigned_to'],
                'owner_name' => trim($mc['owner_name']),
                'creator_id' => (int) $mc['latest_creator_id'],
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
                        (customer_id, from_basket_key, to_basket_key, assigned_to_old, assigned_to_new, transition_type, triggered_by, notes, created_at)
                    VALUES (?, ?, ?, ?, ?, 'reassign_owner', ?, ?, NOW())
                ");
                $name = trim($cust['first_name'] . ' ' . $cust['last_name']);
                $fromOwner = trim($cust['owner_name']);
                $toOwner = trim($cust['creator_name']);
                $bk = $cust['current_basket_key'];
                $bName = $basketNames2[$bk] ?? $bk;
                $note = "Reassign: '$name' ถัง $bName — จาก {$fromOwner} (#{$cust['assigned_to']}) → {$toOwner} (#{$cust['latest_creator_id']})";
                $logStmt->execute([$cust['customer_id'], $bk, $bk, $cust['assigned_to'], $cust['latest_creator_id'], $cust['latest_creator_id'], $note]);

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

    // ============================================================
    // ACTION: upsell_stuck → customers in basket 51 without Pending orders
    // ============================================================
    if ($action === 'upsell_stuck') {
        $upsellSql = "
            SELECT 
                c.customer_id,
                c.first_name,
                c.last_name,
                c.assigned_to,
                c.current_basket_key,
                c.basket_entered_date,
                c.company_id,
                DATEDIFF(NOW(), c.basket_entered_date) AS days_in_basket,
                c.last_order_date,
                CONCAT(COALESCE(u_owner.first_name,''), ' ', COALESCE(u_owner.last_name,'')) AS owner_name,
                u_owner.role AS owner_role,
                bc.basket_name AS current_basket_name
            FROM customers c
            LEFT JOIN users u_owner ON u_owner.id = c.assigned_to
            LEFT JOIN basket_config bc ON bc.id = c.current_basket_key
            WHERE c.current_basket_key = 51
              AND COALESCE(c.is_blocked, 0) = 0
              AND NOT EXISTS (
                  SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id AND o.order_status = 'Pending'
              )
        ";
        if ($companyId) {
            $upsellSql .= " AND c.company_id = " . $companyId;
        }
        $upsellSql .= " ORDER BY c.basket_entered_date ASC";

        $uStmt = $pdo->query($upsellSql);
        $stuckCustomers = $uStmt->fetchAll(PDO::FETCH_ASSOC);

        // Load basket names
        $nameStmt2 = $pdo->query("SELECT id, basket_name FROM basket_config");
        $bNames = [];
        while ($row = $nameStmt2->fetch(PDO::FETCH_ASSOC)) {
            $bNames[$row['id']] = $row['basket_name'];
        }

        // Prepare order lookup
        $orderStmt = $pdo->prepare("
            SELECT id, order_status, order_date, creator_id, company_id
            FROM orders WHERE customer_id = ? ORDER BY order_date DESC
        ");

        // Prepare transition log lookup (last entry into basket 51)
        $transStmt = $pdo->prepare("
            SELECT tl.from_basket_key, tl.to_basket_key, tl.transition_type, tl.triggered_by, tl.notes, tl.created_at,
                   CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,'')) AS triggered_by_name
            FROM basket_transition_log tl
            LEFT JOIN users u ON u.id = tl.triggered_by
            WHERE tl.customer_id = ? AND tl.to_basket_key = 51
            ORDER BY tl.created_at DESC LIMIT 1
        ");

        // Prepare creator name lookup
        $creatorStmt = $pdo->prepare("SELECT id, first_name, last_name, role, role_id FROM users WHERE id = ?");

        // Status summary
        $statusSummary = [];
        $customers = [];

        foreach ($stuckCustomers as $sc) {
            $cid = (int) $sc['customer_id'];

            // Fetch all orders
            $orderStmt->execute([$cid]);
            $orders = $orderStmt->fetchAll(PDO::FETCH_ASSOC);

            // Enrich orders with creator names
            $enrichedOrders = [];
            $latestNonCancelledOrder = null;
            foreach ($orders as $ord) {
                $creatorName = '';
                $creatorRole = '';
                $creatorRoleId = null;
                if ($ord['creator_id']) {
                    $creatorStmt->execute([$ord['creator_id']]);
                    $cr = $creatorStmt->fetch(PDO::FETCH_ASSOC);
                    if ($cr) {
                        $creatorName = trim($cr['first_name'] . ' ' . $cr['last_name']);
                        $creatorRole = $cr['role'] ?? '';
                        $creatorRoleId = (int) ($cr['role_id'] ?? 0);
                    }
                }
                $enrichedOrders[] = [
                    'id' => $ord['id'],
                    'status' => $ord['order_status'],
                    'date' => $ord['order_date'],
                    'creator_id' => (int) $ord['creator_id'],
                    'creator_name' => $creatorName,
                    'creator_role' => $creatorRole,
                    'company_id' => (int) $ord['company_id'],
                ];

                // Track latest non-cancelled order for correct basket calculation
                if (!$latestNonCancelledOrder && !in_array($ord['order_status'], ['Cancelled', 'CANCELLED', 'Returned'])) {
                    $latestNonCancelledOrder = $ord;
                    $latestNonCancelledOrder['creator_role_id'] = $creatorRoleId;
                }
            }

            // Count statuses
            foreach ($enrichedOrders as $eo) {
                $s = $eo['status'];
                if (!isset($statusSummary[$s])) $statusSummary[$s] = 0;
                $statusSummary[$s]++;
            }

            // Fetch transition log
            $transStmt->execute([$cid]);
            $transition = $transStmt->fetch(PDO::FETCH_ASSOC) ?: null;

            // Calculate correct basket
            $correctBasket = 38; // Default: new customer
            $correctReason = '';
            if ($latestNonCancelledOrder) {
                $days = (int) ((time() - strtotime($latestNonCancelledOrder['order_date'])) / 86400);
                $isTelesaleCreator = in_array($latestNonCancelledOrder['creator_role_id'], [6, 7]);
                $isOwnSale = $isTelesaleCreator && ($latestNonCancelledOrder['creator_id'] == $sc['assigned_to']);

                if ($isOwnSale) {
                    if ($days <= 60) { $correctBasket = 39; $correctReason = "ขายเอง, {$days}d <= 60d"; }
                    elseif ($days <= 90) { $correctBasket = 40; $correctReason = "ขายเอง, {$days}d (61-90d)"; }
                    elseif ($days <= 180) { $correctBasket = 46; $correctReason = "ขายเอง, {$days}d (91-180d)"; }
                    elseif ($days <= 365) { $correctBasket = 48; $correctReason = "{$days}d (181-365d)"; }
                    elseif ($days <= 1095) { $correctBasket = 49; $correctReason = "{$days}d (1-3y)"; }
                    else { $correctBasket = 50; $correctReason = "{$days}d (3y+)"; }
                } elseif ($isTelesaleCreator) {
                    if ($days <= 90) { $correctBasket = 47; $correctReason = "Telesale อื่นขาย, {$days}d <= 90d"; }
                    elseif ($days <= 180) { $correctBasket = 46; $correctReason = "{$days}d (91-180d)"; }
                    elseif ($days <= 365) { $correctBasket = 48; $correctReason = "{$days}d (181-365d)"; }
                    elseif ($days <= 1095) { $correctBasket = 49; $correctReason = "{$days}d (1-3y)"; }
                    else { $correctBasket = 50; $correctReason = "{$days}d (3y+)"; }
                } else {
                    // Non-telesale creator
                    if ($days <= 60) { $correctBasket = 38; $correctReason = "ไม่ใช่ Telesale สร้าง, {$days}d <= 60d"; }
                    elseif ($days <= 90) { $correctBasket = 47; $correctReason = "ไม่ใช่ Telesale, {$days}d (61-90d)"; }
                    elseif ($days <= 180) { $correctBasket = 46; $correctReason = "{$days}d (91-180d)"; }
                    elseif ($days <= 365) { $correctBasket = 48; $correctReason = "{$days}d (181-365d)"; }
                    elseif ($days <= 1095) { $correctBasket = 49; $correctReason = "{$days}d (1-3y)"; }
                    else { $correctBasket = 50; $correctReason = "{$days}d (3y+)"; }
                }
            } else {
                // All orders cancelled/returned
                $correctBasket = 38;
                $correctReason = "ทุก order ถูกยกเลิก/คืน → กลับ pool ลูกค้าใหม่";
            }

            $customers[] = [
                'customer_id' => (int) $sc['customer_id'],
                'name' => trim($sc['first_name'] . ' ' . $sc['last_name']),
                'company_id' => (int) $sc['company_id'],
                'assigned_to' => (int) $sc['assigned_to'],
                'owner_name' => trim($sc['owner_name']),
                'owner_role' => $sc['owner_role'] ?? '',
                'basket_entered_date' => $sc['basket_entered_date'],
                'days_in_basket' => (int) $sc['days_in_basket'],
                'orders' => $enrichedOrders,
                'order_statuses' => implode(', ', array_unique(array_column($enrichedOrders, 'status'))),
                'total_orders' => count($enrichedOrders),
                'transition' => $transition ? [
                    'from' => (int) ($transition['from_basket_key'] ?? 0),
                    'from_name' => $bNames[$transition['from_basket_key'] ?? 0] ?? '-',
                    'type' => $transition['transition_type'],
                    'by_name' => trim($transition['triggered_by_name']),
                    'notes' => $transition['notes'],
                    'date' => $transition['created_at'],
                ] : null,
                'correct_basket' => $correctBasket,
                'correct_basket_name' => $bNames[$correctBasket] ?? "Basket $correctBasket",
                'correct_reason' => $correctReason,
            ];
        }

        // Build summary by correct basket destination
        $destSummary = [];
        foreach ($customers as $c) {
            $dest = $c['correct_basket'];
            if (!isset($destSummary[$dest])) {
                $destSummary[$dest] = [
                    'basket_id' => $dest,
                    'basket_name' => $c['correct_basket_name'],
                    'count' => 0
                ];
            }
            $destSummary[$dest]['count']++;
        }

        echo json_encode([
            'success' => true,
            'total' => count($customers),
            'status_summary' => $statusSummary,
            'destination_summary' => array_values($destSummary),
            'customers' => $customers,
            'scanned_at' => date('Y-m-d H:i:s'),
        ]);
        exit;
    }

    // ============================================================
    // ACTION: fix_upsell_stuck → Move selected customers out of basket 51
    // ============================================================
    if ($action === 'fix_upsell_stuck') {
        $body = json_decode(file_get_contents('php://input'), true);
        $customerIds = $body['customer_ids'] ?? [];

        if (empty($customerIds)) {
            echo json_encode(['success' => false, 'error' => 'No customer IDs provided']);
            exit;
        }

        // Load basket names
        $nameStmt3 = $pdo->query("SELECT id, basket_name FROM basket_config");
        $bNames3 = [];
        while ($row = $nameStmt3->fetch(PDO::FETCH_ASSOC)) {
            $bNames3[$row['id']] = $row['basket_name'];
        }

        // Verify these customers are actually in basket 51
        $placeholders = implode(',', array_map('intval', $customerIds));
        $verifyStmt = $pdo->query("
            SELECT c.customer_id, c.first_name, c.last_name, c.assigned_to, c.current_basket_key
            FROM customers c
            WHERE c.customer_id IN ($placeholders)
              AND c.current_basket_key = 51
              AND COALESCE(c.is_blocked, 0) = 0
        ");
        $toFix = $verifyStmt->fetchAll(PDO::FETCH_ASSOC);

        // For each customer, calculate correct basket (same logic as scan)
        $orderStmt2 = $pdo->prepare("
            SELECT id, order_status, order_date, creator_id 
            FROM orders WHERE customer_id = ? AND order_status NOT IN ('Cancelled','CANCELLED','Returned')
            ORDER BY order_date DESC LIMIT 1
        ");
        $creatorStmt2 = $pdo->prepare("SELECT role_id FROM users WHERE id = ?");

        $fixed = 0;
        $errors = 0;
        $results = [];

        $updateStmt = $pdo->prepare("UPDATE customers SET current_basket_key = ?, basket_entered_date = NOW() WHERE customer_id = ?");
        $logStmt = $pdo->prepare("
            INSERT INTO basket_transition_log 
                (customer_id, from_basket_key, to_basket_key, assigned_to_old, assigned_to_new, transition_type, triggered_by, notes, created_at)
            VALUES (?, 51, ?, ?, ?, 'upsell_stuck_fix', ?, ?, NOW())
        ");

        foreach ($toFix as $cust) {
            try {
                $cid = (int) $cust['customer_id'];
                $assignedTo = (int) $cust['assigned_to'];

                // Calculate correct basket
                $orderStmt2->execute([$cid]);
                $latestOrder = $orderStmt2->fetch(PDO::FETCH_ASSOC);

                $correctBasket = 38;
                if ($latestOrder) {
                    $days = (int) ((time() - strtotime($latestOrder['order_date'])) / 86400);
                    $creatorStmt2->execute([$latestOrder['creator_id']]);
                    $creatorInfo = $creatorStmt2->fetch(PDO::FETCH_ASSOC);
                    $isTelesale = $creatorInfo && in_array($creatorInfo['role_id'], [6, 7]);
                    $isOwn = $isTelesale && ($latestOrder['creator_id'] == $assignedTo);

                    if ($isOwn) {
                        if ($days <= 60) $correctBasket = 39;
                        elseif ($days <= 90) $correctBasket = 40;
                        elseif ($days <= 180) $correctBasket = 46;
                        elseif ($days <= 365) $correctBasket = 48;
                        elseif ($days <= 1095) $correctBasket = 49;
                        else $correctBasket = 50;
                    } elseif ($isTelesale) {
                        if ($days <= 90) $correctBasket = 47;
                        elseif ($days <= 180) $correctBasket = 46;
                        elseif ($days <= 365) $correctBasket = 48;
                        elseif ($days <= 1095) $correctBasket = 49;
                        else $correctBasket = 50;
                    } else {
                        if ($days <= 60) $correctBasket = 38;
                        elseif ($days <= 90) $correctBasket = 47;
                        elseif ($days <= 180) $correctBasket = 46;
                        elseif ($days <= 365) $correctBasket = 48;
                        elseif ($days <= 1095) $correctBasket = 49;
                        else $correctBasket = 50;
                    }
                }

                $updateStmt->execute([$correctBasket, $cid]);

                $name = trim($cust['first_name'] . ' ' . $cust['last_name']);
                $toName = $bNames3[$correctBasket] ?? "Basket $correctBasket";
                $note = "Upsell stuck fix: '$name' Basket 51 → $toName";
                $logStmt->execute([$cid, $correctBasket, $assignedTo, $assignedTo, $assignedTo, $note]);

                $fixed++;
                $results[] = ['customer_id' => $cid, 'to_basket' => $correctBasket, 'status' => 'ok'];
            } catch (Exception $e) {
                $errors++;
                $results[] = ['customer_id' => $cid, 'error' => $e->getMessage()];
            }
        }

        echo json_encode([
            'success' => true,
            'fixed' => $fixed,
            'errors' => $errors,
            'results' => $results,
            'fixed_at' => date('Y-m-d H:i:s')
        ]);
        exit;
    }

    echo json_encode(['success' => false, 'error' => 'Invalid action']);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
