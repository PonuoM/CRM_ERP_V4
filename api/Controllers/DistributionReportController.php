<?php
class DistributionReportController {
    
    public static function get_movement_stats($pdo) {
        $authUser = get_authenticated_user($pdo);
        if (!$authUser) {
            http_response_code(401);
            echo json_encode(["ok" => false, "message" => "Unauthorized"]);
            return;
        }

        $company_id = $authUser['company_id'];
        $start_date = isset($_GET['start_date']) ? $_GET['start_date'] . ' 00:00:00' : date('Y-m-d 00:00:00', strtotime('-7 days'));
        $end_date = isset($_GET['end_date']) ? $_GET['end_date'] . ' 23:59:59' : date('Y-m-d 23:59:59');
        $agent_id = isset($_GET['agent_id']) ? $_GET['agent_id'] : '';

        // Enforce max 31 days to prevent overload
        $d1 = new DateTime($start_date);
        $d2 = new DateTime($end_date);
        $diff = $d1->diff($d2)->days;
        if ($diff > 31) {
            http_response_code(400);
            echo json_encode(["ok" => false, "message" => "สามารถเรียกดูข้อมูลได้สูงสุด 31 วันต่อครั้ง"]);
            return;
        }

        try {
            $agent_filter_received = "";
            $agent_filter_lost = "";
            $params = [
                ':company_id1' => $company_id,
                ':start_date1' => $start_date,
                ':end_date1' => $end_date,
                ':company_id2' => $company_id,
                ':start_date2' => $start_date,
                ':end_date2' => $end_date
            ];

            if ($agent_id !== '') {
                $agent_filter_received = " AND cal.new_value = :agent_id1 ";
                $agent_filter_lost = " AND cal.old_value = :agent_id2 ";
                $params[':agent_id1'] = $agent_id;
                $params[':agent_id2'] = $agent_id;
            }

            $sql = "
                SELECT 
                    DATE(cal.created_at) as movement_date,
                    cal.new_value as agent_id,
                    'received' as direction,
                    CASE WHEN (cal.old_value IS NULL OR cal.old_value = '' OR cal.old_value = '0') THEN 'from_basket' ELSE 'from_agent' END as transfer_type,
                    cal.api_source,
                    COUNT(*) as cnt
                FROM customer_audit_log cal
                JOIN customers c ON c.customer_id = cal.customer_id
                WHERE cal.field_name = 'assigned_to'
                  AND cal.new_value IS NOT NULL AND cal.new_value != '' AND cal.new_value != '0'
                  AND c.company_id = :company_id1
                  AND cal.created_at BETWEEN :start_date1 AND :end_date1
                  $agent_filter_received
                GROUP BY movement_date, agent_id, transfer_type, api_source

                UNION ALL

                SELECT 
                    DATE(cal.created_at) as movement_date,
                    cal.old_value as agent_id,
                    'lost' as direction,
                    CASE WHEN (cal.new_value IS NULL OR cal.new_value = '' OR cal.new_value = '0') THEN 'to_basket' ELSE 'to_agent' END as transfer_type,
                    cal.api_source,
                    COUNT(*) as cnt
                FROM customer_audit_log cal
                JOIN customers c ON c.customer_id = cal.customer_id
                WHERE cal.field_name = 'assigned_to'
                  AND cal.old_value IS NOT NULL AND cal.old_value != '' AND cal.old_value != '0'
                  AND c.company_id = :company_id2
                  AND cal.created_at BETWEEN :start_date2 AND :end_date2
                  $agent_filter_lost
                GROUP BY movement_date, agent_id, transfer_type, api_source
            ";

            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode(["ok" => true, "message" => "Success", "data" => $results]);

        } catch (Exception $e) {
            error_log("Error in get_movement_stats: " . $e->getMessage());
            http_response_code(500);
            echo json_encode(["ok" => false, "message" => "Database error"]);
        }
    }

    public static function get_movement_ledger($pdo) {
        $authUser = get_authenticated_user($pdo);
        if (!$authUser) {
            http_response_code(401);
            echo json_encode(["ok" => false, "message" => "Unauthorized"]);
            return;
        }

        $company_id = $authUser['company_id'];
        $start_date = isset($_GET['start_date']) ? $_GET['start_date'] . ' 00:00:00' : date('Y-m-d 00:00:00', strtotime('-7 days'));
        $end_date = isset($_GET['end_date']) ? $_GET['end_date'] . ' 23:59:59' : date('Y-m-d 23:59:59');
        $agent_id = isset($_GET['agent_id']) ? $_GET['agent_id'] : '';
        $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
        $offset = ($page - 1) * $limit;

        $d1 = new DateTime($start_date);
        $d2 = new DateTime($end_date);
        $diff = $d1->diff($d2)->days;
        if ($diff > 31) {
            http_response_code(400);
            echo json_encode(["ok" => false, "message" => "สามารถเรียกดูข้อมูลได้สูงสุด 31 วันต่อครั้ง"]);
            return;
        }

        try {
            $params = [
                ':company_id' => $company_id,
                ':start_date' => $start_date,
                ':end_date' => $end_date
            ];

            $agent_filter = "";
            if ($agent_id !== '') {
                $agent_filter = " AND (cal.old_value = :agent_id OR cal.new_value = :agent_id) ";
                $params[':agent_id'] = $agent_id;
            }

            $sql = "
                SELECT 
                    cal.id,
                    cal.created_at,
                    cal.customer_id,
                    c.first_name,
                    c.last_name,
                    c.phone,
                    cal.old_value,
                    cal.new_value,
                    cal.api_source,
                    u1.first_name as old_agent_name,
                    u2.first_name as new_agent_name,
                    cal.changed_by,
                    u3.first_name as changed_by_name
                FROM customer_audit_log cal
                JOIN customers c ON c.customer_id = cal.customer_id
                LEFT JOIN users u1 ON cal.old_value = u1.id
                LEFT JOIN users u2 ON cal.new_value = u2.id
                LEFT JOIN users u3 ON cal.changed_by = u3.id
                WHERE cal.field_name = 'assigned_to'
                  AND c.company_id = :company_id
                  AND cal.created_at BETWEEN :start_date AND :end_date
                  $agent_filter
                ORDER BY cal.created_at DESC
                LIMIT $limit OFFSET $offset
            ";

            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Get total count for pagination
            $count_sql = "
                SELECT COUNT(*) 
                FROM customer_audit_log cal
                JOIN customers c ON c.customer_id = cal.customer_id
                WHERE cal.field_name = 'assigned_to'
                  AND c.company_id = :company_id
                  AND cal.created_at BETWEEN :start_date AND :end_date
                  $agent_filter
            ";
            $count_stmt = $pdo->prepare($count_sql);
            $count_stmt->execute($params);
            $total = $count_stmt->fetchColumn();

            echo json_encode([
                "ok" => true, 
                "message" => "Success", 
                "data" => $results,
                "pagination" => [
                    "total" => (int)$total,
                    "page" => $page,
                    "limit" => $limit,
                    "total_pages" => ceil($total / $limit)
                ]
            ]);

        } catch (Exception $e) {
            error_log("Error in get_movement_ledger: " . $e->getMessage());
            http_response_code(500);
            echo json_encode(["ok" => false, "message" => "Database error"]);
        }
    }
    public static function get_monthly_summary($pdo) {
        $authUser = get_authenticated_user($pdo);
        if (!$authUser) {
            http_response_code(401);
            echo json_encode(["ok" => false, "message" => "Unauthorized"]);
            return;
        }

        $company_id = $authUser['company_id'];
        $month = isset($_GET['month']) ? $_GET['month'] : date('Y-m');
        $start_date = $month . '-01 00:00:00';
        $end_date = date('Y-m-t 23:59:59', strtotime($start_date));

        try {
            // 1. Get Current Balances
            $sql_current = "
                SELECT 
                    CASE 
                        WHEN bc.target_page = 'distribution' AND bc.basket_name IS NOT NULL THEN CONCAT('BASKET_', bc.basket_name)
                        WHEN bc.target_page = 'distribution' THEN 'CENTRAL' 
                        WHEN c.assigned_to > 0 AND bc.basket_name IS NOT NULL THEN CONCAT('AGENT_', c.assigned_to, '_BASKET_', bc.basket_name)
                        WHEN c.assigned_to > 0 THEN CONCAT('AGENT_', c.assigned_to)
                        ELSE 'OTHER'
                    END as group_id,
                    COUNT(*) as cnt
                FROM customers c
                LEFT JOIN basket_config bc ON (c.current_basket_key = bc.basket_key OR c.current_basket_key = bc.id)
                WHERE c.company_id = :company_id
                GROUP BY group_id
            ";
            $stmt = $pdo->prepare($sql_current);
            $stmt->execute([':company_id' => $company_id]);
            $current_balances = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

            // 2. Get New Customers Created This Month
            $sql_new = "
                SELECT 
                    CASE 
                        WHEN bc.target_page = 'distribution' AND bc.basket_name IS NOT NULL THEN CONCAT('BASKET_', bc.basket_name)
                        WHEN bc.target_page = 'distribution' THEN 'CENTRAL' 
                        WHEN c.assigned_to > 0 AND bc.basket_name IS NOT NULL THEN CONCAT('AGENT_', c.assigned_to, '_BASKET_', bc.basket_name)
                        WHEN c.assigned_to > 0 THEN CONCAT('AGENT_', c.assigned_to)
                        ELSE 'OTHER'
                    END as group_id,
                    COUNT(*) as cnt
                FROM customers c
                LEFT JOIN basket_config bc ON (c.current_basket_key = bc.basket_key OR c.current_basket_key = bc.id)
                WHERE c.company_id = :company_id
                  AND c.date_registered BETWEEN :start_date AND :end_date
                GROUP BY group_id
            ";
            $stmt = $pdo->prepare($sql_new);
            $stmt->execute([
                ':company_id' => $company_id,
                ':start_date' => $start_date,
                ':end_date' => $end_date
            ]);
            $new_customers = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

            // 3. Get Received / Lost from audit log
            $sql_movements = "
                SELECT 
                    group_id,
                    SUM(received) as received,
                    SUM(lost) as lost
                FROM (
                    -- Received (new_value is Agent or NULL for Central)
                    SELECT 
                        CASE 
                            WHEN (cal.new_value IS NULL OR cal.new_value = '' OR cal.new_value = '0') AND bc.target_page = 'distribution' AND bc.basket_name IS NOT NULL THEN CONCAT('BASKET_', bc.basket_name) 
                            WHEN (cal.new_value IS NULL OR cal.new_value = '' OR cal.new_value = '0') THEN 'CENTRAL' 
                            WHEN cal.new_value > 0 AND bc.basket_name IS NOT NULL THEN CONCAT('AGENT_', cal.new_value, '_BASKET_', bc.basket_name) 
                            WHEN cal.new_value > 0 THEN CONCAT('AGENT_', cal.new_value)
                            ELSE cal.new_value
                        END as group_id,
                        COUNT(*) as received,
                        0 as lost
                    FROM customer_audit_log cal
                    JOIN customers c ON c.customer_id = cal.customer_id
                    LEFT JOIN basket_config bc ON (c.current_basket_key = bc.basket_key OR c.current_basket_key = bc.id)
                    WHERE cal.field_name = 'assigned_to'
                      AND c.company_id = :company_id1
                      AND cal.created_at BETWEEN :start_date1 AND :end_date1
                    GROUP BY group_id

                    UNION ALL

                    -- Lost (old_value is Agent or NULL for Central)
                    SELECT 
                        CASE 
                            WHEN (cal.old_value IS NULL OR cal.old_value = '' OR cal.old_value = '0') AND bc.target_page = 'distribution' AND bc.basket_name IS NOT NULL THEN CONCAT('BASKET_', bc.basket_name) 
                            WHEN (cal.old_value IS NULL OR cal.old_value = '' OR cal.old_value = '0') THEN 'CENTRAL' 
                            WHEN cal.old_value > 0 AND bc.basket_name IS NOT NULL THEN CONCAT('AGENT_', cal.old_value, '_BASKET_', bc.basket_name) 
                            WHEN cal.old_value > 0 THEN CONCAT('AGENT_', cal.old_value)
                            ELSE cal.old_value
                        END as group_id,
                        0 as received,
                        COUNT(*) as lost
                    FROM customer_audit_log cal
                    JOIN customers c ON c.customer_id = cal.customer_id
                    LEFT JOIN basket_config bc ON (c.current_basket_key = bc.basket_key OR c.current_basket_key = bc.id)
                    WHERE cal.field_name = 'assigned_to'
                      AND c.company_id = :company_id2
                      AND cal.created_at BETWEEN :start_date2 AND :end_date2
                    GROUP BY group_id
                ) t
                GROUP BY group_id
            ";
            $stmt = $pdo->prepare($sql_movements);
            $stmt->execute([
                ':company_id1' => $company_id,
                ':start_date1' => $start_date,
                ':end_date1' => $end_date,
                ':company_id2' => $company_id,
                ':start_date2' => $start_date,
                ':end_date2' => $end_date
            ]);
            $movements = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Combine stats
            $sql_users = "SELECT id, first_name, last_name FROM users WHERE company_id = :company_id";
            $stmt = $pdo->prepare($sql_users);
            $stmt->execute([':company_id' => $company_id]);
            $users = [];
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $users[$row['id']] = $row['first_name'] . ' ' . $row['last_name'];
            }

            $summary = [];
            $all_groups = array_unique(array_merge(
                array_keys($current_balances),
                array_keys($new_customers),
                array_column($movements, 'group_id')
            ));

            foreach ($all_groups as $g) {
                $current = $current_balances[$g] ?? 0;
                $new = $new_customers[$g] ?? 0;
                
                $received = 0;
                $lost = 0;
                foreach ($movements as $m) {
                    if ((string)$m['group_id'] === (string)$g) {
                        $received = (int)$m['received'];
                        $lost = (int)$m['lost'];
                        break;
                    }
                }

                $start = $current - $new + $lost - $received;
                
                if ($start < 0) $start = 0; // Guard against anomalies

                $name = "ไม่ทราบชื่อ";
                if (strpos($g, 'BASKET_') === 0) {
                    $basketName = substr($g, 7);
                    $name = "ตะกร้ากลาง ($basketName)";
                } else if ($g === 'CENTRAL') {
                    $name = "ตะกร้ากลาง (Distribution)";
                } else if ($g === 'OTHER') {
                    $name = "อื่นๆ (ไม่มีข้อมูลตะกร้า)";
                    // Skip 'OTHER' if 0 balance to keep it clean
                    if ($current == 0 && $start == 0 && $received == 0 && $lost == 0) continue;
                } else if (strpos($g, 'AGENT_') === 0) {
                    if (preg_match('/^AGENT_(\d+)_BASKET_(.+)$/', $g, $matches)) {
                        $agentId = $matches[1];
                        $basketName = $matches[2];
                        $agentName = isset($users[$agentId]) ? $users[$agentId] : "ไม่ระบุ ($agentId)";
                        $name = "$agentName ($basketName)";
                    } else {
                        $agentId = substr($g, 6);
                        $name = isset($users[$agentId]) ? $users[$agentId] : "ไม่ระบุ ($agentId)";
                    }
                } else if (isset($users[$g])) {
                    $name = $users[$g];
                }

                $summary[] = [
                    'group_id' => $g,
                    'name' => $name,
                    'start_balance' => $start,
                    'new_created' => $new,
                    'received' => $received,
                    'lost' => $lost,
                    'current_balance' => $current
                ];
            }

            // Sort: CENTRAL first, then by current balance desc
            usort($summary, function($a, $b) {
                if (strpos($a['group_id'], 'BASKET_') === 0 && strpos($b['group_id'], 'BASKET_') !== 0) return -1;
                if (strpos($b['group_id'], 'BASKET_') === 0 && strpos($a['group_id'], 'BASKET_') !== 0) return 1;
                if ($a['group_id'] === 'CENTRAL') return -1;
                if ($b['group_id'] === 'CENTRAL') return 1;
                return $b['current_balance'] <=> $a['current_balance'];
            });

            echo json_encode(["ok" => true, "data" => $summary]);

        } catch (Exception $e) {
            error_log("Error in get_monthly_summary: " . $e->getMessage());
            http_response_code(500);
            echo json_encode(["ok" => false, "message" => "Database error"]);
        }
    }

    public static function get_time_travel_snapshot($pdo) {
        $authUser = get_authenticated_user($pdo);
        if (!$authUser) {
            http_response_code(401);
            echo json_encode(["ok" => false, "message" => "Unauthorized"]);
            return;
        }

        $company_id = $authUser['company_id'];
        if (!isset($_GET['target_time'])) {
            http_response_code(400);
            echo json_encode(["ok" => false, "message" => "Missing target_time"]);
            return;
        }
        $target_time = $_GET['target_time']; // format 'YYYY-MM-DD HH:mm:ss'
        $now = date('Y-m-d H:i:s');

        try {
            // 1. Get Current Balances
            $sql_current = "
                SELECT 
                    CASE 
                        WHEN bc.target_page = 'distribution' AND bc.basket_name IS NOT NULL THEN CONCAT('BASKET_', bc.basket_name)
                        WHEN bc.target_page = 'distribution' THEN 'CENTRAL' 
                        WHEN c.assigned_to > 0 AND bc.basket_name IS NOT NULL THEN CONCAT('AGENT_', c.assigned_to, '_BASKET_', bc.basket_name)
                        WHEN c.assigned_to > 0 THEN CONCAT('AGENT_', c.assigned_to)
                        ELSE 'OTHER'
                    END as group_id,
                    COUNT(*) as cnt
                FROM customers c
                LEFT JOIN basket_config bc ON (c.current_basket_key = bc.basket_key OR c.current_basket_key = bc.id)
                WHERE c.company_id = :company_id
                GROUP BY group_id
            ";
            $stmt = $pdo->prepare($sql_current);
            $stmt->execute([':company_id' => $company_id]);
            $current_balances = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

            // 2. Get New Customers Created between target_time and NOW
            $sql_new = "
                SELECT 
                    CASE 
                        WHEN bc.target_page = 'distribution' AND bc.basket_name IS NOT NULL THEN CONCAT('BASKET_', bc.basket_name)
                        WHEN bc.target_page = 'distribution' THEN 'CENTRAL' 
                        WHEN c.assigned_to > 0 AND bc.basket_name IS NOT NULL THEN CONCAT('AGENT_', c.assigned_to, '_BASKET_', bc.basket_name)
                        WHEN c.assigned_to > 0 THEN CONCAT('AGENT_', c.assigned_to)
                        ELSE 'OTHER'
                    END as group_id,
                    COUNT(*) as cnt
                FROM customers c
                LEFT JOIN basket_config bc ON (c.current_basket_key = bc.basket_key OR c.current_basket_key = bc.id)
                WHERE c.company_id = :company_id
                  AND c.date_registered BETWEEN :target_time AND :now
                GROUP BY group_id
            ";
            $stmt = $pdo->prepare($sql_new);
            $stmt->execute([
                ':company_id' => $company_id,
                ':target_time' => $target_time,
                ':now' => $now
            ]);
            $new_customers = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

            // 3. Get Received / Lost from audit log between target_time and NOW
            $sql_movements = "
                SELECT 
                    group_id,
                    SUM(received) as received,
                    SUM(lost) as lost
                FROM (
                    -- Received
                    SELECT 
                        CASE 
                            WHEN (cal.new_value IS NULL OR cal.new_value = '' OR cal.new_value = '0') AND bc.target_page = 'distribution' AND bc.basket_name IS NOT NULL THEN CONCAT('BASKET_', bc.basket_name) 
                            WHEN (cal.new_value IS NULL OR cal.new_value = '' OR cal.new_value = '0') THEN 'CENTRAL' 
                            WHEN cal.new_value > 0 AND bc.basket_name IS NOT NULL THEN CONCAT('AGENT_', cal.new_value, '_BASKET_', bc.basket_name) 
                            WHEN cal.new_value > 0 THEN CONCAT('AGENT_', cal.new_value)
                            ELSE cal.new_value
                        END as group_id,
                        COUNT(*) as received,
                        0 as lost
                    FROM customer_audit_log cal
                    JOIN customers c ON c.customer_id = cal.customer_id
                    LEFT JOIN basket_config bc ON (c.current_basket_key = bc.basket_key OR c.current_basket_key = bc.id)
                    WHERE cal.field_name = 'assigned_to'
                      AND c.company_id = :company_id1
                      AND cal.created_at BETWEEN :target_time1 AND :now1
                    GROUP BY group_id

                    UNION ALL

                    -- Lost
                    SELECT 
                        CASE 
                            WHEN (cal.old_value IS NULL OR cal.old_value = '' OR cal.old_value = '0') AND bc.target_page = 'distribution' AND bc.basket_name IS NOT NULL THEN CONCAT('BASKET_', bc.basket_name) 
                            WHEN (cal.old_value IS NULL OR cal.old_value = '' OR cal.old_value = '0') THEN 'CENTRAL' 
                            WHEN cal.old_value > 0 AND bc.basket_name IS NOT NULL THEN CONCAT('AGENT_', cal.old_value, '_BASKET_', bc.basket_name) 
                            WHEN cal.old_value > 0 THEN CONCAT('AGENT_', cal.old_value)
                            ELSE cal.old_value
                        END as group_id,
                        0 as received,
                        COUNT(*) as lost
                    FROM customer_audit_log cal
                    JOIN customers c ON c.customer_id = cal.customer_id
                    LEFT JOIN basket_config bc ON (c.current_basket_key = bc.basket_key OR c.current_basket_key = bc.id)
                    WHERE cal.field_name = 'assigned_to'
                      AND c.company_id = :company_id2
                      AND cal.created_at BETWEEN :target_time2 AND :now2
                    GROUP BY group_id
                ) t
                GROUP BY group_id
            ";
            $stmt = $pdo->prepare($sql_movements);
            $stmt->execute([
                ':company_id1' => $company_id,
                ':target_time1' => $target_time,
                ':now1' => $now,
                ':company_id2' => $company_id,
                ':target_time2' => $target_time,
                ':now2' => $now
            ]);
            $movements = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Combine stats
            $sql_users = "SELECT id, first_name, last_name FROM users WHERE company_id = :company_id";
            $stmt = $pdo->prepare($sql_users);
            $stmt->execute([':company_id' => $company_id]);
            $users = [];
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $users[$row['id']] = $row['first_name'] . ' ' . $row['last_name'];
            }

            $summary = [];
            $all_groups = array_unique(array_merge(
                array_keys($current_balances),
                array_keys($new_customers),
                array_column($movements, 'group_id')
            ));

            foreach ($all_groups as $g) {
                $current = $current_balances[$g] ?? 0;
                $new = $new_customers[$g] ?? 0;
                
                $received = 0;
                $lost = 0;
                foreach ($movements as $m) {
                    if ((string)$m['group_id'] === (string)$g) {
                        $received = (int)$m['received'];
                        $lost = (int)$m['lost'];
                        break;
                    }
                }

                // Rollback Formula
                // Snapshot = Current - New - Received + Lost
                $snapshot = $current - $new - $received + $lost;
                
                if ($snapshot < 0) $snapshot = 0;

                $name = "ไม่ทราบชื่อ";
                if (strpos($g, 'BASKET_') === 0) {
                    $basketName = substr($g, 7);
                    $name = "ตะกร้ากลาง ($basketName)";
                } else if ($g === 'CENTRAL') {
                    $name = "ตะกร้ากลาง (Distribution)";
                } else if ($g === 'OTHER') {
                    $name = "อื่นๆ (ไม่มีข้อมูลตะกร้า)";
                    if ($current == 0 && $snapshot == 0) continue;
                } else if (strpos($g, 'AGENT_') === 0) {
                    if (preg_match('/^AGENT_(\d+)_BASKET_(.+)$/', $g, $matches)) {
                        $agentId = $matches[1];
                        $basketName = $matches[2];
                        $agentName = isset($users[$agentId]) ? $users[$agentId] : "ไม่ระบุ ($agentId)";
                        $name = "$agentName ($basketName)";
                    } else {
                        $agentId = substr($g, 6);
                        $name = isset($users[$agentId]) ? $users[$agentId] : "ไม่ระบุ ($agentId)";
                    }
                } else if (isset($users[$g])) {
                    $name = $users[$g];
                }

                $summary[] = [
                    'group_id' => $g,
                    'name' => $name,
                    'snapshot_balance' => $snapshot,
                    'current_balance' => $current,
                    'new_since' => $new,
                    'received_since' => $received,
                    'lost_since' => $lost
                ];
            }

            // Sort: CENTRAL first, then by snapshot balance desc
            usort($summary, function($a, $b) {
                if (strpos($a['group_id'], 'BASKET_') === 0 && strpos($b['group_id'], 'BASKET_') !== 0) return -1;
                if (strpos($b['group_id'], 'BASKET_') === 0 && strpos($a['group_id'], 'BASKET_') !== 0) return 1;
                if ($a['group_id'] === 'CENTRAL') return -1;
                if ($b['group_id'] === 'CENTRAL') return 1;
                return $b['snapshot_balance'] <=> $a['snapshot_balance'];
            });

            echo json_encode(["ok" => true, "data" => $summary]);

        } catch (Exception $e) {
            error_log("Error in get_time_travel_snapshot: " . $e->getMessage());
            http_response_code(500);
            echo json_encode(["ok" => false, "message" => "Database error"]);
        }
    }

    public static function export_time_travel_call_stats($pdo) {
        $authUser = get_authenticated_user($pdo);
        if (!$authUser) {
            http_response_code(401);
            echo json_encode(["ok" => false, "message" => "Unauthorized"]);
            return;
        }

        $company_id = $authUser['company_id'];
        if (!isset($_GET['target_time'])) {
            http_response_code(400);
            echo json_encode(["ok" => false, "message" => "Missing target_time"]);
            return;
        }
        $target_time = $_GET['target_time']; // format 'YYYY-MM-DD HH:mm:ss'
        
        try {
            // Complex SQL to find the state of customers at target_time
            $sql = "
            WITH CustomerPool AS (
                SELECT customer_id, assigned_to as current_assigned_to, date_registered, current_basket_key
                FROM customers
                WHERE company_id = :company_id
                  AND date_registered <= :target_time1
            ),
            LogsBefore AS (
                SELECT 
                    cal.customer_id,
                    cal.new_value as assigned_to,
                    cal.created_at as assignment_time,
                    ROW_NUMBER() OVER (PARTITION BY cal.customer_id ORDER BY cal.created_at DESC) as rn
                FROM customer_audit_log cal
                INNER JOIN CustomerPool cp ON cal.customer_id = cp.customer_id
                WHERE cal.field_name = 'assigned_to' 
                  AND cal.created_at <= :target_time2
            ),
            LogsAfter AS (
                SELECT 
                    cal.customer_id,
                    cal.old_value as assigned_to,
                    ROW_NUMBER() OVER (PARTITION BY cal.customer_id ORDER BY cal.created_at ASC) as rn
                FROM customer_audit_log cal
                INNER JOIN CustomerPool cp ON cal.customer_id = cp.customer_id
                WHERE cal.field_name = 'assigned_to' 
                  AND cal.created_at > :target_time3
            ),
            HistoricalState AS (
                SELECT 
                    cp.customer_id,
                    COALESCE(la.assigned_to, cp.current_assigned_to) as historical_assigned_to,
                    COALESCE(lb.assignment_time, cp.date_registered) as historical_assignment_time,
                    cp.current_basket_key
                FROM CustomerPool cp
                LEFT JOIN LogsAfter la ON cp.customer_id = la.customer_id AND la.rn = 1
                LEFT JOIN LogsBefore lb ON cp.customer_id = lb.customer_id AND lb.rn = 1
            ),
            CallStats AS (
                SELECT 
                    hs.customer_id,
                    hs.historical_assigned_to as assigned_to,
                    hs.historical_assignment_time as assignment_time,
                    hs.current_basket_key,
                    CASE WHEN EXISTS (
                        SELECT 1 FROM call_history ch 
                        WHERE ch.customer_id = hs.customer_id 
                          AND ch.date >= hs.historical_assignment_time
                          AND ch.date <= :target_time4
                    ) THEN 1 ELSE 0 END as has_call,
                    CASE WHEN EXISTS (
                        SELECT 1 FROM appointments a 
                        WHERE a.customer_id = hs.customer_id 
                          AND a.created_at >= hs.historical_assignment_time
                          AND a.created_at <= :target_time5
                    ) THEN 1 ELSE 0 END as has_appointment
                FROM HistoricalState hs
                WHERE hs.historical_assigned_to > 0
            )
            SELECT 
                cs.assigned_to,
                u.first_name,
                u.last_name,
                u.status,
                bc.basket_name,
                COUNT(*) as total_held,
                SUM(CASE WHEN has_call = 0 AND has_appointment = 0 THEN 1 ELSE 0 END) as not_called,
                SUM(CASE WHEN has_call = 1 AND has_appointment = 0 THEN 1 ELSE 0 END) as called_no_appt,
                SUM(CASE WHEN has_call = 1 AND has_appointment = 1 THEN 1 ELSE 0 END) as called_and_appt,
                SUM(CASE WHEN has_call = 0 AND has_appointment = 1 THEN 1 ELSE 0 END) as appt_no_call
            FROM CallStats cs
            LEFT JOIN users u ON cs.assigned_to = u.id
            LEFT JOIN basket_config bc ON (cs.current_basket_key = bc.basket_key OR cs.current_basket_key = bc.id)
            GROUP BY cs.assigned_to, u.first_name, u.last_name, u.status, bc.basket_name
            ORDER BY u.first_name ASC
            ";
            
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                ':target_time1' => $target_time,
                ':target_time2' => $target_time,
                ':target_time3' => $target_time,
                ':target_time4' => $target_time,
                ':target_time5' => $target_time,
                ':company_id' => $company_id
            ]);
            $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            // Fetch all users to support "Everyone" option
            $usersStmt = $pdo->prepare("SELECT id, first_name, last_name, status FROM users WHERE company_id = :company_id");
            $usersStmt->execute([':company_id' => $company_id]);
            $allUsers = $usersStmt->fetchAll(PDO::FETCH_ASSOC);
            
            echo json_encode(["ok" => true, "data" => $results, "allUsers" => $allUsers]);
            
        } catch (Exception $e) {
            error_log("Error in export_time_travel_call_stats: " . $e->getMessage());
            http_response_code(500);
            echo json_encode(["ok" => false, "message" => "Database error"]);
        }
    }
}
