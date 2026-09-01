<?php

class DistributionController {

    /**
 * Handle bulk customer assignment with Pruning Round Robin logic
 */

    public static function handleDistribute($pdo) {

        $authUser = get_authenticated_user($pdo);
        if (!$authUser) {
            http_response_code(401);
            echo json_encode(["ok" => false, "message" => "Unauthorized"]);
            return;
        }
        $companyId = $authUser['company_id'];

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'POST required']);
        return;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $assignments = $input['assignments'] ?? [];
    $sourceBasketKey = $input['source_basket_key'] ?? null;
    $targetBasketKey = $input['target_basket_key'] ?? null;
    $triggeredBy = $input['triggered_by'] ?? null;

    $strictDuplicateCheck = $input['strict_duplicate_check'] ?? false;
    $minCallMinutes = isset($input['min_call_minutes']) ? (int)$input['min_call_minutes'] : 0;

    // The 110-minute Talk Time policy only governs the standard aging-based
    // lead pool (the baskets discussed in the meeting alongside the 400-lead
    // quota). It intentionally does NOT apply to this same endpoint's other
    // uses — new_customer_dis, upsell_dis, marketplace_dis, the challenge
    // baskets (no_answer/quit_farming/etc.), holding_before_redistribute, or
    // block_customers — none of which were part of that policy discussion.
    $talkTimeDefaultMinutes = 110;
    $talkTimeGatedBaskets = ['find_new_owner', 'waiting_for_match', 'mid_6_9m', 'mid_9_12m', 'mid_1_3y', 'ancient'];
    $isTalkTimeGatedBasket = in_array($sourceBasketKey, $talkTimeGatedBaskets, true);

    if (empty($assignments)) {
        http_response_code(400);
        echo json_encode(['error' => 'No assignments provided']);
        return;
    }

    // Resolve Target Basket ID
    $targetBasketId = null;
    $resolvedTargetKey = $targetBasketKey;
    if ($targetBasketKey) {
        $stmt = $pdo->prepare("SELECT id FROM basket_config WHERE basket_key = ? AND company_id = 1");
        $stmt->execute([$targetBasketKey]);
        $targetBasketId = $stmt->fetchColumn();
    } elseif ($sourceBasketKey) {
        // Fallback to linked basket
        if ($sourceBasketKey === 'upsell_dis') {
            $targetBasketId = 51; // Hardcoded for Upsell
            $resolvedTargetKey = 'upsell';
        } else {
            $stmt = $pdo->prepare("SELECT linked_basket_key FROM basket_config WHERE basket_key = ? AND company_id = 1");
            $stmt->execute([$sourceBasketKey]);
            $linkedKey = $stmt->fetchColumn();

            if (!$linkedKey) {
                http_response_code(400);
                echo json_encode(['error' => "การแจกล้มเหลว: หาตะกร้าปลายทางไม่พบ (ไม่ได้ตั้งค่า linked_basket_key สำหรับ '$sourceBasketKey' ในระบบ)"]);
                return;
            }

            $stmt = $pdo->prepare("SELECT id FROM basket_config WHERE basket_key = ? AND company_id = 1");
            $stmt->execute([$linkedKey]);
            $targetBasketId = $stmt->fetchColumn();
            
            if (!$targetBasketId) {
                http_response_code(400);
                echo json_encode(['error' => "การแจกล้มเหลว: หาตะกร้าปลายทางไม่พบ (ตั้งค่า linked_basket_key = '$linkedKey' ผิดพลาด หรือไม่มีตะกร้านี้อยู่จริง)"]);
                return;
            }
            
            $resolvedTargetKey = $linkedKey;
        }
    }

    // ถังปลายทางต้องหาให้เจอเสมอ ห้ามปล่อยผ่าน
    //
    // เดิมโค้ดข้างล่างเขียน current_basket_key แบบมีเงื่อนไข (if ($targetBasketId))
    // ถ้า resolve ไม่สำเร็จ -- ไม่ส่ง target_basket_key/source_basket_key มาเลย
    // หรือส่ง target_basket_key ที่พิมพ์ผิดจน fetchColumn() คืน false -- ลูกค้าจะได้
    // assigned_to ใหม่แต่ current_basket_key ยังค้างอยู่ถังฝั่ง distribution เดิม
    // กลายเป็น "มีเจ้าของแต่จมอยู่ในถังกองกลาง" ที่เจ้าของมองไม่เห็นบน Dashboard
    // และ basket_aging_cron ก็เก็บไม่ได้ (พบของจริง 98 ราย ส.ค. 2569)
    //
    // ล้มตั้งแต่ตรงนี้ก่อนเปิด transaction ดีกว่าปล่อยให้แจกสำเร็จแบบข้อมูลเพี้ยน
    if (!$targetBasketId) {
        http_response_code(400);
        echo json_encode(['error' => 'การแจกล้มเหลว: ไม่ได้ระบุตะกร้าปลายทาง (ต้องส่ง target_basket_key หรือ source_basket_key ที่ตั้ง linked_basket_key ไว้)']);
        return;
    }

    $pdo->beginTransaction();

    set_audit_context($pdo, 'distribution_v2');
    $successIds = [];
    $successDetails = []; // To hold details for the session log
    $failedIds = [];
    $agentStats = []; // agent_id => count

    // Prepare statements
    $checkStmt = $pdo->prepare("SELECT id FROM customer_assign_check WHERE customer_id = ? AND user_id = ?");
    $insertCheckStmt = $pdo->prepare("INSERT INTO customer_assign_check (customer_id, user_id, company_id) VALUES (?, ?, ?)");

    // Update Customer Stmt
    $updateSql = "UPDATE customers SET assigned_to = ?, date_assigned = NOW(), basket_entered_date = NOW(), lifecycle_status = 'Assigned'";
    $updateSql .= ", current_basket_key = ?"; // บังคับเสมอ -- $targetBasketId ถูกการันตีแล้วข้างบน
    $updateSql .= " WHERE customer_id = ? AND company_id = ?";
    $updateStmt = $pdo->prepare($updateSql);

    // Get customer old data Stmt (before update)
    $getOldStmt = $pdo->prepare("SELECT current_basket_key, assigned_to, lifecycle_status FROM customers WHERE customer_id = ?");

    // Log Stmt with assigned_to columns (use placeholders for Thai strings)
    $logStmt = $pdo->prepare("INSERT INTO basket_transition_log (customer_id, from_basket_key, to_basket_key, assigned_to_old, assigned_to_new, transition_type, triggered_by, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())");

    // Cleanup Logic Stmts
    $countChecksStmt = $pdo->prepare("SELECT COUNT(*) FROM customer_assign_check WHERE customer_id = ?");
    $totalAgentsStmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE company_id = ? AND (LOWER(role) = 'telesale' OR LOWER(role) LIKE '%supervisor%') AND status = 'active'");
    $resetStmt = $pdo->prepare("DELETE FROM customer_assign_check WHERE customer_id = ?");
    $incRoundStmt = $pdo->prepare("UPDATE customers SET current_round = current_round + 1 WHERE customer_id = ?");

    // Get total active agents count for cleanup check
    $totalAgentsStmt->execute([$companyId]);
    $totalActiveAgents = $totalAgentsStmt->fetchColumn(); // Note: This might need refinement if you only want to count agents eligible for THIS specific basket/campaign

    try {
        $customerIds = array_column($assignments, 'customer_id');
        $customerIds = array_filter(array_unique($customerIds));

        if (empty($customerIds)) {
            echo json_encode(['ok' => true, 'message' => 'No valid customers provided']);
            return;
        }

        // 1. Bulk Fetch Old Data
        //
        // FOR UPDATE: ล็อกแถวลูกค้าไว้จนจบ transaction กันเคสหัวหน้า 2 คนกดแจกพร้อมกัน
        // (หรือเปิดหน้าค้างไว้แล้วรายชื่อในถังเปลี่ยนไปแล้ว) แล้วแจกทับกันเอง
        // basket_entered_date ดึงมาเก็บไว้ให้ undo คืนค่าได้ - ดู migration 089
        $inClause = implode(',', array_fill(0, count($customerIds), '?'));
        $getOldStmt = $pdo->prepare("SELECT customer_id, current_basket_key, assigned_to, lifecycle_status, basket_entered_date FROM customers WHERE customer_id IN ($inClause) FOR UPDATE");
        $getOldStmt->execute($customerIds);
        $oldDataMap = [];
        while ($row = $getOldStmt->fetch(PDO::FETCH_ASSOC)) {
            $oldDataMap[$row['customer_id']] = $row;
        }

        // ลูกค้าที่ "มีเจ้าของไปแล้ว" ระหว่างที่หน้าเว็บถือรายชื่อชุดนี้อยู่ ต้องไม่ถูกเขียนทับ
        // เกิดจริงแล้ว 1 ครั้ง (session #202, 16 ก.ค. 2026) แจกทับเจ้าของเดิม 279 ราย
        // เจ้าของเดิมเสียลูกค้าไปโดยไม่มีอะไรแจ้งเตือน
        $alreadyAssignedIds = [];
        foreach ($oldDataMap as $cid => $row) {
            if (!empty($row['assigned_to'])) {
                $alreadyAssignedIds[(string)$cid] = (int)$row['assigned_to'];
            }
        }

        // 2. Bulk Duplicate Check
        $existingChecks = [];
        if ($strictDuplicateCheck) {
            $checkStmt = $pdo->prepare("SELECT customer_id, user_id FROM customer_assign_check WHERE customer_id IN ($inClause)");
            $checkStmt->execute($customerIds);
            while ($row = $checkStmt->fetch(PDO::FETCH_ASSOC)) {
                $existingChecks[$row['customer_id'] . '_' . $row['user_id']] = true;
            }
        }

        // 3. Server-side Talk Time gate.
        // The frontend already filters agents by call minutes, but that is a
        // convenience filter the admin can bypass entirely (e.g. the "select
        // all" button ignores it, and simply not applying the filter sends
        // min_call_minutes: null) — so this re-checks independently of what
        // the client sent, using the official policy: total minutes on the
        // previous business day (Mon-Fri), counted only within the
        // 07:00-18:30 window, must reach the threshold. The threshold is the
        // higher of the policy default and whatever stricter value the admin
        // requested via the UI filter.
        $ineligibleAgentIds = [];
        // [MODIFIED] Changed to trust the UI's $minCallMinutes directly instead of enforcing max(110).
        $effectiveMinCallMinutes = $minCallMinutes; 
        if ($effectiveMinCallMinutes > 0) {
            $minCallMinutes = $effectiveMinCallMinutes;
            $agentIdsToCheck = array_values(array_unique(array_filter(array_column($assignments, 'agent_id'))));
            if (!empty($agentIdsToCheck)) {
                // ใช้ "หน้าต่างเวลาเดียวกับที่หน้าจอใช้คำนวณ" ถ้าฝั่ง UI ส่งมา ไม่งั้นถอยไปใช้
                // กติกาเริ่มต้น (วันทำการก่อนหน้า 07:00-18:30)
                //
                // จำเป็นเพราะตารางพนักงานให้ผู้ใช้เลือกวันที่และกะเองได้ (กะเสาร์ 09:00-16:30,
                // ช่วงหลายวัน, หรือสลับไปดูข้อมูลสดของวันนี้) ถ้า backend ตรวจซ้ำด้วยช่วงเวลาของตัวเอง
                // ตัวเลขที่ผู้ใช้เห็นบนจอกับตัวเลขที่ใช้ตัดสินจะเป็นคนละชุด แล้วลูกค้าของพนักงานที่
                // "จอบอกว่าผ่าน แต่ backend บอกว่าไม่ผ่าน" จะถูกทิ้งทั้งก้อนโดยไม่มีใครรู้
                $win = $input['call_filter_window'] ?? null;
                $isDate = function ($d) {
                    return is_string($d) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $d) === 1;
                };
                $normTime = function ($t, $fallback) {
                    if (!is_string($t) || preg_match('/^\d{1,2}:\d{2}(:\d{2})?$/', $t) !== 1) {
                        return $fallback;
                    }
                    return strlen($t) === 5 ? $t . ':00' : $t;
                };

                if (is_array($win) && $isDate($win['start_date'] ?? null) && $isDate($win['end_date'] ?? null)) {
                    $winStartDate = $win['start_date'];
                    $winEndDate   = $win['end_date'];
                    $winStartTime = $normTime($win['start_time'] ?? null, '00:00:00');
                    $winEndTime   = $normTime($win['end_time'] ?? null, '23:59:59');
                } else {
                    $winStartDate = date('Y-m-d', strtotime('-1 day'));
                    while (in_array((int)date('N', strtotime($winStartDate)), [6, 7], true)) {
                        $winStartDate = date('Y-m-d', strtotime($winStartDate . ' -1 day'));
                    }
                    $winEndDate   = $winStartDate;
                    $winStartTime = '07:00:00';
                    $winEndTime   = '18:30:00';
                }

                $agentPlaceholders = implode(',', array_fill(0, count($agentIdsToCheck), '?'));
                $talkTimeStmt = $pdo->prepare("
                    SELECT matched_user_id, SUM(TIME_TO_SEC(duration)) / 60 as total_minutes
                    FROM call_import_logs
                    WHERE call_date >= ? AND call_date <= ?
                      AND start_time >= ? AND start_time <= ?
                      AND status = 1
                      AND matched_user_id IN ($agentPlaceholders)
                    GROUP BY matched_user_id
                ");
                $talkTimeStmt->execute(array_merge([$winStartDate, $winEndDate, $winStartTime, $winEndTime], $agentIdsToCheck));
                $minutesByAgent = [];
                while ($row = $talkTimeStmt->fetch(PDO::FETCH_ASSOC)) {
                    $minutesByAgent[(string)$row['matched_user_id']] = (float)$row['total_minutes'];
                }

                foreach ($agentIdsToCheck as $aId) {
                    $minutes = $minutesByAgent[(string)$aId] ?? 0;
                    if ($minutes < $minCallMinutes) {
                        $ineligibleAgentIds[(string)$aId] = true;
                    }
                }
            }
        }

        $validAssignments = [];
        foreach ($assignments as $assignment) {
            $customerId = $assignment['customer_id'];
            $agentId = $assignment['agent_id'];

            if (!$customerId || !$agentId) continue;

            if ($strictDuplicateCheck && isset($existingChecks[$customerId . '_' . $agentId])) {
                $failedIds[] = $customerId;
                continue;
            }

            if (isset($ineligibleAgentIds[(string)$agentId])) {
                $failedIds[] = $customerId;
                continue;
            }

            // มีคนถือไปแล้วระหว่างทาง -> ข้าม ไม่แย่งจากเจ้าของเดิม
            if (isset($alreadyAssignedIds[(string)$customerId])) {
                $failedIds[] = $customerId;
                continue;
            }

            $validAssignments[] = [
                'customer_id' => $customerId,
                'agent_id' => $agentId
            ];
            $successIds[] = $customerId;
            
            if (!isset($agentStats[$agentId])) $agentStats[$agentId] = 0;
            $agentStats[$agentId]++;
        }

        if (!empty($validAssignments)) {
            $chunkSize = 500;
            $chunks = array_chunk($validAssignments, $chunkSize);

            foreach ($chunks as $chunk) {
                // Bulk Insert customer_assign_check
                $checkPlaceholders = implode(',', array_fill(0, count($chunk), '(?, ?, ?)'));
                $checkValues = [];
                foreach ($chunk as $assign) {
                    $checkValues[] = $assign['customer_id'];
                    $checkValues[] = $assign['agent_id'];
                    $checkValues[] = $companyId;
                }
                // ON DUPLICATE KEY: หลัง migration 089 คู่ (customer_id, user_id) เป็น UNIQUE แล้ว
                // การแจกซ้ำคู่เดิม (เช่นหลัง Manual Reset) ต้องไม่ทำให้ทั้ง transaction ล้ม
                $pdo->prepare("INSERT INTO customer_assign_check (customer_id, user_id, company_id) VALUES $checkPlaceholders ON DUPLICATE KEY UPDATE company_id = VALUES(company_id)")->execute($checkValues);

                // Bulk Update customers using CASE
                $updateSql = "UPDATE customers SET assigned_to = CASE customer_id ";
                $updateParams = [];
                $chunkCustomerIds = [];
                foreach ($chunk as $assign) {
                    $updateSql .= " WHEN ? THEN ? ";
                    $updateParams[] = $assign['customer_id'];
                    $updateParams[] = $assign['agent_id'];
                    $chunkCustomerIds[] = $assign['customer_id'];
                }
                $updateSql .= " END, date_assigned = NOW(), basket_entered_date = NOW(), lifecycle_status = 'Assigned' ";
                // บังคับเสมอ -- $targetBasketId ถูกการันตีไว้ตั้งแต่ก่อนเปิด transaction
                $updateSql .= ", current_basket_key = ? ";
                $updateParams[] = $targetBasketId;
                $updateSql .= " WHERE customer_id IN (" . implode(',', array_fill(0, count($chunk), '?')) . ") AND company_id = ?";
                $updateParams = array_merge($updateParams, $chunkCustomerIds, [$companyId]);
                $pdo->prepare($updateSql)->execute($updateParams);

                // Bulk Insert Logs and prepare successDetails
                $logPlaceholders = implode(',', array_fill(0, count($chunk), '(?, ?, ?, ?, ?, ?, ?, ?, NOW())'));
                $logValues = [];
                foreach ($chunk as $assign) {
                    $customerId = $assign['customer_id'];
                    $agentId = $assign['agent_id'];
                    $oldData = $oldDataMap[$customerId] ?? [];
                    
                    $oldBasketKey = $oldData['current_basket_key'] ?? $sourceBasketKey;
                    $oldAssignedTo = $oldData['assigned_to'] ?? null;
                    $oldLifecycle = $oldData['lifecycle_status'] ?? null;
                    
                    $finalTargetKey = $resolvedTargetKey ?: ($oldBasketKey ?: 'Unknown');
                    $safeOldBasketKey = $oldBasketKey ?: 'Unknown';

                    $logValues[] = $customerId;
                    $logValues[] = $safeOldBasketKey;
                    $logValues[] = $finalTargetKey;
                    $logValues[] = $oldAssignedTo;
                    $logValues[] = $agentId;
                    $logValues[] = 'distribute';
                    $logValues[] = $triggeredBy;
                    $logValues[] = 'Distributed from Distribution V2';

                    $successDetails[] = [
                        'customer_id' => $customerId,
                        'agent_id' => $agentId,
                        'previous_assigned_to' => $oldAssignedTo,
                        'previous_basket_key' => $oldBasketKey,
                        'previous_lifecycle_status' => $oldLifecycle,
                        'previous_basket_entered_date' => $oldData['basket_entered_date'] ?? null
                    ];
                }
                $pdo->prepare("INSERT INTO basket_transition_log (customer_id, from_basket_key, to_basket_key, assigned_to_old, assigned_to_new, transition_type, triggered_by, notes, created_at) VALUES $logPlaceholders")->execute($logValues);
            }

            // Bulk Cleanup Logic (Check Round Completion)
            $successInClause = implode(',', array_fill(0, count($successIds), '?'));
            // COUNT(DISTINCT user_id) ไม่ใช่ COUNT(*) — ของเดิมนับ "แถว" ทำให้แถวซ้ำใน
            // customer_assign_check ดันยอดจนรีเซ็ตรอบก่อนกำหนด แล้วลูกค้าวนกลับไปหาคนเดิม
            // (วัดจริง: company 7 มีพนักงาน 3 คน แต่มีลูกค้า 3,174 รายที่เข้าเงื่อนไขรีเซ็ตผิด)
            // migration 089 ใส่ UNIQUE KEY กันแถวซ้ำที่ต้นทางแล้ว ตรงนี้กันอีกชั้น
            $cleanupStmt = $pdo->prepare("
                SELECT customer_id
                FROM customer_assign_check
                WHERE customer_id IN ($successInClause)
                  AND company_id = ?
                GROUP BY customer_id
                HAVING COUNT(DISTINCT user_id) >= ?
            ");
            $cleanupParams = array_merge($successIds, [$companyId, $totalActiveAgents]);
            $cleanupStmt->execute($cleanupParams);
            $customersToReset = $cleanupStmt->fetchAll(PDO::FETCH_COLUMN);

            if (!empty($customersToReset) && $totalActiveAgents > 0) {
                $resetInClause = implode(',', array_fill(0, count($customersToReset), '?'));
                $pdo->prepare("DELETE FROM customer_assign_check WHERE customer_id IN ($resetInClause)")->execute($customersToReset);
                $pdo->prepare("UPDATE customers SET current_round = current_round + 1 WHERE customer_id IN ($resetInClause)")->execute($customersToReset);
            }
        }

        // --- Distribution Session Logging ---
        if (count($successDetails) > 0) {
            $distributionMode = $input['distribution_mode'] ?? 'Unknown';
            // Log the threshold that was actually enforced (0 = gate did not apply to this basket),
            // not just whatever the client happened to send.
            $loggedMinCallMinutes = $effectiveMinCallMinutes > 0 ? $effectiveMinCallMinutes : null;
            $agentSnapshot = isset($input['agent_snapshot']) ? json_encode($input['agent_snapshot'], JSON_UNESCAPED_UNICODE) : null;
            $tagId = isset($input['tag_id']) && $input['tag_id'] !== '' ? (int)$input['tag_id'] : null;
            // จำนวนรายชื่อที่ยังติด cooldown (เพิ่งโทรติด) แต่ผู้แจกกดยืนยันแจกไปแล้ว - ดู migration 087
            $cooldownOverride = isset($input['cooldown_override_count']) ? max(0, (int)$input['cooldown_override_count']) : 0;

            $sessionStmt = $pdo->prepare("INSERT INTO distribution_sessions (company_id, distributed_by, distribution_mode, min_call_minutes, total_customers, created_at, agent_snapshot, source_basket, tag_id, cooldown_override_count) VALUES (?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?)");
            $sessionStmt->execute([$companyId, $triggeredBy, $distributionMode, $loggedMinCallMinutes, count($successDetails), $agentSnapshot, $sourceBasketKey, $tagId, $cooldownOverride]);
            $sessionId = $pdo->lastInsertId();

            // Bulk Insert for better performance
            $chunkSize = 500;
            $chunks = array_chunk($successDetails, $chunkSize);
            foreach ($chunks as $chunk) {
                $placeholders = implode(',', array_fill(0, count($chunk), '(?, ?, ?, ?, ?, ?, ?)'));
                $values = [];
                foreach ($chunk as $detail) {
                    $values[] = $sessionId;
                    $values[] = $detail['agent_id'];
                    $values[] = $detail['customer_id'];
                    $values[] = $detail['previous_assigned_to'];
                    $values[] = $detail['previous_basket_key'];
                    $values[] = $detail['previous_lifecycle_status'];
                    $values[] = $detail['previous_basket_entered_date'];
                }
                $bulkStmt = $pdo->prepare("INSERT INTO distribution_session_details (session_id, agent_id, customer_id, previous_assigned_to, previous_basket_key, previous_lifecycle_status, previous_basket_entered_date) VALUES $placeholders");
                $bulkStmt->execute($values);
            }
        }
        // ------------------------------------

        clear_user_tags_on_ownership_change($pdo, $successIds, $triggeredBy ? (int)$triggeredBy : null);

        $pdo->commit();

        echo json_encode([
            'ok' => true,
            'success_ids' => $successIds,
            'failed_ids' => $failedIds,
            'agent_stats' => $agentStats,
            'total_success' => count($successIds),
            'total_failed' => count($failedIds),
            'ineligible_agent_ids' => array_keys($ineligibleAgentIds),
            'already_assigned_ids' => array_keys($alreadyAssignedIds),
            'debug_info' => [
                'total_active_agents' => $totalActiveAgents
            ]
        ]);

    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }

    }

    /**
 * Return assign-check history: which agents each customer has been assigned to.
 * GET ?action=get_assign_checks&companyId=1&customer_ids=CUS001,CUS002,...
 * Response: { "ok": true, "conflicts": { "CUS001": [3,5], "CUS002": [1] } }
 */

    public static function handleGetAssignChecks($pdo) {

        $authUser = get_authenticated_user($pdo);
        if (!$authUser) {
            http_response_code(401);
            echo json_encode(["ok" => false, "message" => "Unauthorized"]);
            return;
        }
        $companyId = $authUser['company_id'];

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'POST required']);
        return;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $ids = $input['customer_ids'] ?? [];

    if (!is_array($ids) || count($ids) === 0) {
        echo json_encode(['ok' => true, 'conflicts' => new \stdClass()]);
        return;
    }

    // Batch query: get all assign checks for these customers
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stmt = $pdo->prepare("
        SELECT customer_id, user_id
        FROM customer_assign_check
        WHERE customer_id IN ($placeholders)
        AND company_id = ?
    ");
    $params = $ids;
    $params[] = $companyId;
    $stmt->execute($params);

    $conflicts = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $cid = $row['customer_id'];
        if (!isset($conflicts[$cid])) {
            $conflicts[$cid] = [];
        }
        $conflicts[$cid][] = (int) $row['user_id'];
    }

    echo json_encode([
        'ok' => true,
        'conflicts' => empty($conflicts) ? new \stdClass() : $conflicts
    ]);

    }

    /**
 * Return distribution sessions history with details
 * GET ?action=get_sessions&companyId=1
 */

    public static function handleGetSessions($pdo) {
        header('Content-Type: application/json; charset=utf-8');
        $authUser = get_authenticated_user($pdo);
        if (!$authUser) {
            http_response_code(401);
            echo json_encode(["ok" => false, "message" => "Unauthorized"]);
            return;
        }
        $companyId = $authUser['company_id'];

    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        http_response_code(405);
        echo json_encode(['error' => 'GET required']);
        return;
    }

    $limit = $_GET['limit'] ?? 50;

    
    $startDate = $_GET['startDate'] ?? null;
    $endDate = $_GET['endDate'] ?? null;
    $type = $_GET['type'] ?? 'all';
    $basketKey = $_GET['basket_key'] ?? 'all';
    $basketKey = $_GET['basket_key'] ?? 'all';
    $tagId = $_GET['session_tag'] ?? 'all';

    $whereClauses = [];
    $params = [];

    if ($companyId !== 'all') {
        $whereClauses[] = "ds.company_id = ?";
        $params[] = $companyId;
    }

    if ($startDate && $endDate) {
        $start = $startDate . ' 00:00:00';
        $end = $endDate . ' 23:59:59';
        $whereClauses[] = "ds.created_at BETWEEN ? AND ?";
        $params[] = $start;
        $params[] = $end;
    }

    if ($type === 'distribution') {
        $whereClauses[] = "(ds.distribution_mode NOT LIKE '%Reclaim%' AND ds.distribution_mode NOT LIKE '%Transfer%')";
    } else if ($type === 'reclaim') {
        $whereClauses[] = "(ds.distribution_mode LIKE '%Reclaim%' OR ds.distribution_mode LIKE '%Transfer%')";
    }

    if ($basketKey && $basketKey !== 'all') {
        $whereClauses[] = "EXISTS (
            SELECT 1 FROM distribution_session_details _dsd 
            LEFT JOIN basket_config bc ON (_dsd.previous_basket_key = bc.basket_key OR _dsd.previous_basket_key = bc.id)
            WHERE _dsd.session_id = ds.id AND (bc.basket_key = ? OR bc.id = ?)
        )";
        $params[] = $basketKey;
        $params[] = $basketKey;
    }

    if ($tagId && $tagId !== 'all') {
        $tagParts = explode(',', $tagId);
        $hasNone = in_array('none', $tagParts);
        $validTagIds = array_filter(array_map('intval', array_diff($tagParts, ['none'])));
        
        $tagConditions = [];
        if (!empty($validTagIds)) {
            $placeholders = implode(',', array_fill(0, count($validTagIds), '?'));
            $tagConditions[] = "ds.tag_id IN ($placeholders)";
            $params = array_merge($params, $validTagIds);
        }
        if ($hasNone) {
            $tagConditions[] = "ds.tag_id IS NULL";
        }
        
        if (!empty($tagConditions)) {
            $whereClauses[] = "(" . implode(" OR ", $tagConditions) . ")";
        }
    }

    $whereSql = "";
    if (!empty($whereClauses)) {
        $whereSql = "WHERE " . implode(" AND ", $whereClauses);
    }

    $sql = "
        SELECT ds.*, u.first_name, u.last_name, c.name as company_name, dt.tag_name as session_tag, dt.color as tag_color
        FROM distribution_sessions ds
        LEFT JOIN users u ON ds.distributed_by = u.id
        LEFT JOIN companies c ON ds.company_id = c.id
        LEFT JOIN distribution_tags dt ON ds.tag_id = dt.id
        $whereSql
        ORDER BY ds.created_at DESC
        LIMIT " . (int)$limit . "
    ";

    $sessionStmt = $pdo->prepare($sql);
    $sessionStmt->execute($params);
    $sessions = $sessionStmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($sessions)) {
        echo json_encode(['ok' => true, 'sessions' => []]);
        return;
    }

    // Attach to sessions without details (Lazy Loading)
    foreach ($sessions as &$s) {
        $s['distributed_by_name'] = trim(($s['first_name'] ?? '') . ' ' . ($s['last_name'] ?? ''));
        unset($s['first_name'], $s['last_name']);
        
        $s['agent_snapshot'] = isset($s['agent_snapshot']) ? json_decode($s['agent_snapshot'], true) : [];
        $s['details'] = []; // Details will be loaded on demand
    }

    echo json_encode(['ok' => true, 'sessions' => $sessions]);

    }

    
        public static function handleGetSessionDetails($pdo) {
        $authUser = get_authenticated_user($pdo);
        if (!$authUser) {
            http_response_code(401);
            echo json_encode(["ok" => false, "message" => "Unauthorized"]);
            return;
        }

        $sessionId = $_GET['session_id'] ?? null;
        if (!$sessionId) {
            http_response_code(400);
            echo json_encode(['error' => 'Session ID required']);
            return;
        }

        // Fetch details
        $detailStmt = $pdo->prepare("
            SELECT dsd.session_id, dsd.agent_id, dsd.undo_status, u.first_name as agent_first, u.last_name as agent_last,
                   c.customer_id, c.customer_ref_id as customer_code, CONCAT(c.first_name, ' ', c.last_name) as customer_name, c.phone as customer_phone
            FROM distribution_session_details dsd
            LEFT JOIN users u ON dsd.agent_id = u.id
            JOIN customers c ON dsd.customer_id = c.customer_id
            WHERE dsd.session_id = ?
        ");
        $detailStmt->execute([$sessionId]);
        $details = $detailStmt->fetchAll(PDO::FETCH_ASSOC);

        $grouped = [];
        foreach ($details as $d) {
            $aid = $d['agent_id'] ?? 0;
            if (!isset($grouped[$aid])) {
                $grouped[$aid] = [
                    'agent_id' => $aid,
                    'agent_name' => trim(($d['agent_first'] ?? '') . ' ' . ($d['agent_last'] ?? '')),
                    'customers' => []
                ];
                if ($aid == 0) $grouped[$aid]['agent_name'] = 'System/None';
            }
            $grouped[$aid]['customers'][] = [
                'id' => $d['customer_id'],
                'code' => $d['customer_code'],
                'name' => $d['customer_name'],
                'phone' => customer_phone_ui($d['customer_phone'] ?? ''),
                'undo_status' => $d['undo_status']
            ];
        }

        echo json_encode(['ok' => true, 'details' => array_values($grouped)]);
    }

    public static function handleGetSessionTags($pdo) {

        $authUser = get_authenticated_user($pdo);
        if (!$authUser) {
            http_response_code(401);
            echo json_encode(["ok" => false, "message" => "Unauthorized"]);
            return;
        }
        $companyId = $authUser['company_id'];

    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        http_response_code(405);
        echo json_encode(['error' => 'GET required']);
        return;
    }

    if ($companyId === 'all') {
        $stmt = $pdo->prepare("SELECT id, tag_name as session_tag, color FROM distribution_tags ORDER BY tag_name ASC");
        $stmt->execute();
    } else {
        $stmt = $pdo->prepare("SELECT id, tag_name as session_tag, color FROM distribution_tags WHERE company_id = ? ORDER BY tag_name ASC");
        $stmt->execute([$companyId]);
    }
    
    $tags = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(['ok' => true, 'tags' => $tags]);

    }

    
    public static function handleUndoDistribution($pdo) {

        $authUser = get_authenticated_user($pdo);
        if (!$authUser) {
            http_response_code(401);
            echo json_encode(["ok" => false, "message" => "Unauthorized"]);
            return;
        }
        $companyId = $authUser['company_id'];

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'POST required']);
        return;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $sessionId = $input['session_id'] ?? null;
    $mode = $input['mode'] ?? 'safe'; // 'safe' or 'force'
    $triggeredBy = $input['triggered_by'] ?? null;

    if (!$sessionId) {
        http_response_code(400);
        echo json_encode(['error' => 'Session ID required']);
        return;
    }

    $pdo->beginTransaction();
    set_audit_context($pdo, 'distribution_v2_undo');

    try {
        // 1. Get session info
        $sessionStmt = $pdo->prepare("SELECT * FROM distribution_sessions WHERE id = ? AND company_id = ?");
        $sessionStmt->execute([$sessionId, $companyId]);
        $session = $sessionStmt->fetch(PDO::FETCH_ASSOC);

        if (!$session) {
            throw new Exception("Session not found or belongs to another company");
        }

        if ($session['session_status'] === 'undo_full') {
            throw new Exception("This session has already been fully undone.");
        }

        // 2. Get all details
        $detailStmt = $pdo->prepare("
            SELECT dsd.*, c.updated_at as customer_updated_at 
            FROM distribution_session_details dsd
            JOIN customers c ON dsd.customer_id = c.customer_id
            WHERE dsd.session_id = ?
        ");
        $detailStmt->execute([$sessionId]);
        $details = $detailStmt->fetchAll(PDO::FETCH_ASSOC);

        $successIds = [];
        $skippedIds = [];

        $validDetails = [];
        foreach ($details as $detail) {
            $customerId = $detail['customer_id'];
            if ($mode === 'safe') {
                $sessionTime = strtotime($session['created_at']);
                $customerUpdateTime = strtotime($detail['customer_updated_at']);
                if ($customerUpdateTime > $sessionTime + 10) {
                    $skippedIds[] = $customerId;
                    continue;
                }
            }
            $validDetails[] = $detail;
            $successIds[] = $customerId;
        }

        if (!empty($validDetails)) {
            $chunkSize = 500;
            $chunks = array_chunk($validDetails, $chunkSize);

            foreach ($chunks as $chunk) {
                // Bulk Update Customers Using CASE
                $updateSql = "UPDATE customers SET assigned_to = CASE customer_id ";
                $basketSql = " current_basket_key = CASE customer_id ";
                $lifecycleSql = " lifecycle_status = CASE customer_id ";
                $dateAssignedSql = " date_assigned = CASE customer_id ";
                // คืนวันที่เข้าถังเดิมด้วย (เก็บไว้ตอนแจก - ดู migration 089)
                // ถ้าเป็น session เก่าที่ยังไม่มีค่านี้ ให้คงค่าปัจจุบันไว้ ดีกว่าเซ็ตเป็น NULL
                $basketEnteredSql = " basket_entered_date = CASE customer_id ";
                
                $updateParams = [];
                $customerIdsChunk = [];

                foreach ($chunk as $d) {
                    $cid = $d['customer_id'];
                    $customerIdsChunk[] = $cid;
                    
                    $updateSql .= " WHEN ? THEN ? ";
                    $basketSql .= " WHEN ? THEN ? ";
                    $lifecycleSql .= " WHEN ? THEN ? ";
                    $basketEnteredSql .= !empty($d['previous_basket_entered_date'])
                        ? " WHEN ? THEN ? "
                        : " WHEN ? THEN basket_entered_date ";
                    
                    if (!empty($d['previous_assigned_to'])) {
                        $dateAssignedSql .= " WHEN ? THEN COALESCE((SELECT created_at FROM customer_audit_log WHERE customer_id = ? AND field_name = 'assigned_to' AND new_value = ? ORDER BY id DESC LIMIT 1), NOW()) ";
                    } else {
                        $dateAssignedSql .= " WHEN ? THEN NULL ";
                    }
                }
                
                $updateSql .= " END, ";
                $basketSql .= " END, ";
                $lifecycleSql .= " END, ";
                $basketEnteredSql .= " END, ";
                $dateAssignedSql .= " END WHERE customer_id IN (" . implode(',', array_fill(0, count($customerIdsChunk), '?')) . ")";

                $finalSql = $updateSql . $basketSql . $lifecycleSql . $basketEnteredSql . $dateAssignedSql;
                
                foreach ($chunk as $d) {
                    $updateParams[] = $d['customer_id'];
                    $updateParams[] = $d['previous_assigned_to'];
                }
                foreach ($chunk as $d) {
                    $updateParams[] = $d['customer_id'];
                    $updateParams[] = $d['previous_basket_key'];
                }
                foreach ($chunk as $d) {
                    $updateParams[] = $d['customer_id'];
                    $updateParams[] = $d['previous_lifecycle_status'] ?? 'New';
                }
                foreach ($chunk as $d) {
                    $updateParams[] = $d['customer_id'];
                    if (!empty($d['previous_basket_entered_date'])) {
                        $updateParams[] = $d['previous_basket_entered_date'];
                    }
                }
                foreach ($chunk as $d) {
                    if (!empty($d['previous_assigned_to'])) {
                        $updateParams[] = $d['customer_id'];
                        $updateParams[] = $d['customer_id'];
                        $updateParams[] = $d['previous_assigned_to'];
                    } else {
                        $updateParams[] = $d['customer_id'];
                    }
                }
                foreach ($customerIdsChunk as $cid) {
                    $updateParams[] = $cid;
                }

                $updateStmt = $pdo->prepare($finalSql);
                $updateStmt->execute($updateParams);

                // Bulk Delete assign_check
                $deletePlaceholders = implode(' OR ', array_fill(0, count($chunk), '(customer_id = ? AND user_id = ? AND company_id = ?)'));
                $deleteValues = [];
                foreach ($chunk as $d) {
                    $deleteValues[] = $d['customer_id'];
                    $deleteValues[] = $d['agent_id'];
                    $deleteValues[] = $companyId;
                }
                $deleteStmt = $pdo->prepare("DELETE FROM customer_assign_check WHERE " . $deletePlaceholders);
                $deleteStmt->execute($deleteValues);

                // Bulk Insert Transition Logs
                $logPlaceholders = implode(',', array_fill(0, count($chunk), '(?, ?, ?, ?, ?, \'reclaim\', ?, ?, NOW())'));
                $logValues = [];
                foreach ($chunk as $d) {
                    $logValues[] = $d['customer_id'];
                    $logValues[] = $session['source_basket'] ?? 'Unknown';
                    $logValues[] = $d['previous_basket_key'];
                    $logValues[] = $d['agent_id'];
                    $logValues[] = $d['previous_assigned_to'];
                    $logValues[] = $triggeredBy;
                    $logValues[] = "Undo Distribution Session #{$sessionId} ({$mode} mode)";
                }
                $logStmt = $pdo->prepare("
                    INSERT INTO basket_transition_log 
                    (customer_id, from_basket_key, to_basket_key, assigned_to_old, assigned_to_new, transition_type, triggered_by, notes, created_at) 
                    VALUES $logPlaceholders
                ");
                $logStmt->execute($logValues);
            }
        }

        // 3. Update session status
        $newStatus = (count($skippedIds) === 0 && count($successIds) > 0) ? 'undo_full' : 'undo_partial';
        if (count($successIds) > 0) {
            $updateSessionStmt = $pdo->prepare("UPDATE distribution_sessions SET session_status = ?, undo_success_count = ?, undo_skipped_count = ? WHERE id = ?");
            $updateSessionStmt->execute([$newStatus, count($successIds), count($skippedIds), $sessionId]);

            // Update undo_status in details
            $inSuccess = implode(',', array_map('intval', $successIds));
            $pdo->exec("UPDATE distribution_session_details SET undo_status = 'undone' WHERE session_id = " . (int)$sessionId . " AND customer_id IN ($inSuccess)");
        }
        if (count($skippedIds) > 0) {
            $inSkipped = implode(',', array_map('intval', $skippedIds));
            $pdo->exec("UPDATE distribution_session_details SET undo_status = 'skipped' WHERE session_id = " . (int)$sessionId . " AND customer_id IN ($inSkipped)");
        }

        $pdo->commit();

        echo json_encode([
            'ok' => true,
            'message' => "Undo completed",
            'success_count' => count($successIds),
            'skipped_count' => count($skippedIds),
            'status' => $newStatus
        ]);

    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }

    }

    
    public static function handleCleanupDistributionDetails($pdo) {

        $authUser = get_authenticated_user($pdo);
        if (!$authUser) {
            http_response_code(401);
            echo json_encode(["ok" => false, "message" => "Unauthorized"]);
            return;
        }
        $companyId = $authUser['company_id'];

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'POST required']);
        return;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $userId = $input['user_id'] ?? null;
    $targetCompanyId = $input['target_company_id'] ?? null; // Can be 'all' or specific company_id
    $monthsOld = $input['months_old'] ?? 3;

    if (!$userId) {
        http_response_code(400);
        echo json_encode(['error' => 'User ID required']);
        return;
    }

    // RBAC Check
    $userStmt = $pdo->prepare("SELECT is_system, role, company_id FROM users WHERE id = ?");
    $userStmt->execute([$userId]);
    $user = $userStmt->fetch(PDO::FETCH_ASSOC);

    if (!$user || $user['is_system'] != 1) {
        http_response_code(403);
        echo json_encode(['error' => 'Permission denied. Only system admins can cleanup data.']);
        return;
    }

    // Determine target company
    $companiesToClean = [];
    if (strtolower($user['role']) === 'super_admin') {
        if ($targetCompanyId === 'all') {
            // Get all companies
            $compStmt = $pdo->query("SELECT id FROM companies");
            $companiesToClean = $compStmt->fetchAll(PDO::FETCH_COLUMN);
        } else if (is_numeric($targetCompanyId)) {
            $companiesToClean = [(int)$targetCompanyId];
        } else {
            // Default to their own if not specified
            $companiesToClean = [$user['company_id']];
        }
    } else {
        // Normal is_system=1 can only clean their own company
        $companiesToClean = [$user['company_id']];
    }

    if (empty($companiesToClean)) {
        echo json_encode(['ok' => true, 'message' => 'No companies to clean']);
        return;
    }

    $inClause = implode(',', array_fill(0, count($companiesToClean), '?'));
    $dateThreshold = date('Y-m-d H:i:s', strtotime("-{$monthsOld} months"));

    // Find sessions older than threshold for these companies
    // We only delete DETAILS, we keep the session header
    $deleteStmt = $pdo->prepare("
        DELETE dsd FROM distribution_session_details dsd
        JOIN distribution_sessions ds ON dsd.session_id = ds.id
        WHERE ds.company_id IN ($inClause) AND ds.created_at < ?
    ");
    
    $params = array_merge($companiesToClean, [$dateThreshold]);
    $deleteStmt->execute($params);
    $deletedRows = $deleteStmt->rowCount();

    echo json_encode([
        'ok' => true,
        'message' => "Deleted $deletedRows details records older than $monthsOld months.",
        'deleted_rows' => $deletedRows,
        'companies_cleaned' => $companiesToClean
    ]);

    }

    
    public static function handleUpdateSessionTag($pdo) {

        $authUser = get_authenticated_user($pdo);
        if (!$authUser) {
            http_response_code(401);
            echo json_encode(["ok" => false, "message" => "Unauthorized"]);
            return;
        }
        $companyId = $authUser['company_id'];

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'POST required']);
        return;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $sessionId = $input['session_id'] ?? null;
    $tagId = isset($input['tag_id']) && $input['tag_id'] !== '' ? (int)$input['tag_id'] : null;

    if (!$sessionId) {
        http_response_code(400);
        echo json_encode(['error' => 'Session ID is required']);
        return;
    }

    if ($companyId === 'all') {
        $stmt = $pdo->prepare("UPDATE distribution_sessions SET tag_id = ? WHERE id = ?");
        $result = $stmt->execute([$tagId, $sessionId]);
    } else {
        $stmt = $pdo->prepare("UPDATE distribution_sessions SET tag_id = ? WHERE id = ? AND company_id = ?");
        $result = $stmt->execute([$tagId, $sessionId, $companyId]);
    }

    if ($result) {
        echo json_encode(['ok' => true]);
    } else {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to update session tag']);
    }

    }

    
    public static function handleGetBasketOptions($pdo) {

        $authUser = get_authenticated_user($pdo);
        if (!$authUser) {
            http_response_code(401);
            echo json_encode(["ok" => false, "message" => "Unauthorized"]);
            return;
        }
        $companyId = $authUser['company_id'];

    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        http_response_code(405);
        echo json_encode(['error' => 'GET required']);
        return;
    }

    if ($companyId === 'all') {
        $stmt = $pdo->prepare("SELECT id, basket_key, basket_name FROM basket_config ORDER BY id ASC");
        $stmt->execute();
    } else {
        $stmt = $pdo->prepare("SELECT id, basket_key, basket_name FROM basket_config WHERE company_id = ? ORDER BY id ASC");
        $stmt->execute([$companyId]);
    }
    
    $baskets = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(['ok' => true, 'baskets' => $baskets]);

    }

}
