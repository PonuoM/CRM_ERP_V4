
<?php
// api/Distribution/index.php

require_once __DIR__ . '/../config.php';
// Get database connection
header('Content-Type: application/json');
$pdo = db_connect();

$action = $_GET['action'] ?? null;
$companyId = $_GET['companyId'] ?? 1;

// Schema is now handled manually via schema.sql
// ensure_distribution_schema($pdo);

try {
    if ($action === 'distribute') {
        handleDistribute($pdo, $companyId);
    } elseif ($action === 'get_assign_checks') {
        handleGetAssignChecks($pdo, $companyId);
    } elseif ($action === 'get_sessions') {
        handleGetSessions($pdo, $companyId);
    } elseif ($action === 'get_session_tags') {
        handleGetSessionTags($pdo, $companyId);
    } elseif ($action === 'get_basket_options') {
        handleGetBasketOptions($pdo, $companyId);
    } elseif ($action === 'undo_distribution') {
        handleUndoDistribution($pdo, $companyId);
    } elseif ($action === 'cleanup_distribution_details') {
        handleCleanupDistributionDetails($pdo, $companyId);
    } elseif ($action === 'batch_export') {
        handleBatchExport($pdo, $companyId);
    } elseif ($action === 'get_cron_logs') {
        handleGetCronLogs($pdo, $companyId);
    } elseif ($action === 'update_session_tag') {
        handleUpdateSessionTag($pdo, $companyId);
    } else {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid action']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
}

/**
 * Handle bulk customer assignment with Pruning Round Robin logic
 */
function handleDistribute($pdo, $companyId)
{
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
    if ($targetBasketId) {
        $updateSql .= ", current_basket_key = ?";
    }
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
        foreach ($assignments as $assignment) {
            $customerId = $assignment['customer_id'];
            $agentId = $assignment['agent_id'];

            if (!$customerId || !$agentId)
                continue;

            // 1. Check if already assigned in this round
            if ($strictDuplicateCheck) {
                $checkStmt->execute([$customerId, $agentId]);
                if ($checkStmt->fetchColumn()) {
                    // Already assigned to this agent in current round
                    $failedIds[] = $customerId;
                    continue;
                }
            }

            // 1.5 Get old data before update
            $getOldStmt->execute([$customerId]);
            $oldData = $getOldStmt->fetch(PDO::FETCH_ASSOC);
            $oldBasketKey = $oldData['current_basket_key'] ?? $sourceBasketKey;
            $oldAssignedTo = $oldData['assigned_to'] ?? null;
            $oldLifecycle = $oldData['lifecycle_status'] ?? null;

            // 2. Perform Assignment
            $insertCheckStmt->execute([$customerId, $agentId, $companyId]);

            if ($targetBasketId) {
                $updateStmt->execute([$agentId, $targetBasketId, $customerId, $companyId]);
            } else {
                $updateStmt->execute([$agentId, $customerId, $companyId]);
            }

            // 3. Log with assigned_to_old and assigned_to_new
            $finalTargetKey = $resolvedTargetKey ?: ($oldBasketKey ?: 'Unknown');
            $safeOldBasketKey = $oldBasketKey ?: 'Unknown';
            $logStmt->execute([$customerId, $safeOldBasketKey, $finalTargetKey, $oldAssignedTo, $agentId, 'distribute', $triggeredBy, 'Distributed from Distribution V2']);

            // 4. Lazy Cleanup (Check Round Completion)
            $countChecksStmt->execute([$customerId]);
            $assignedCount = $countChecksStmt->fetchColumn();

            // Logic: If assigned count >= Total Active Agents (or a heuristic limit), reset
            // Refinement: Ideally, we should count distinct users this customer has been assigned to vs total users.
            // But checking count in customer_assign_check is sufficient for "Round Robin" completeness.
            if ($assignedCount >= $totalActiveAgents && $totalActiveAgents > 0) {
                $resetStmt->execute([$customerId]);
                $incRoundStmt->execute([$customerId]);
            }

            $successIds[] = $customerId;
            $successDetails[] = [
                'customer_id' => $customerId, 
                'agent_id' => $agentId,
                'previous_assigned_to' => $oldAssignedTo,
                'previous_basket_key' => $oldBasketKey,
                'previous_lifecycle_status' => $oldLifecycle
            ];
            if (!isset($agentStats[$agentId]))
                $agentStats[$agentId] = 0;
            $agentStats[$agentId]++;
        }

        // --- Distribution Session Logging ---
        if (count($successDetails) > 0) {
            $distributionMode = $input['distribution_mode'] ?? 'Unknown';
            $minCallMinutes = isset($input['min_call_minutes']) ? (int)$input['min_call_minutes'] : null;
            $agentSnapshot = isset($input['agent_snapshot']) ? json_encode($input['agent_snapshot'], JSON_UNESCAPED_UNICODE) : null;
            $tagId = isset($input['tag_id']) && $input['tag_id'] !== '' ? (int)$input['tag_id'] : null;
            
            $sessionStmt = $pdo->prepare("INSERT INTO distribution_sessions (company_id, distributed_by, distribution_mode, min_call_minutes, total_customers, created_at, agent_snapshot, source_basket, tag_id) VALUES (?, ?, ?, ?, ?, NOW(), ?, ?, ?)");
            $sessionStmt->execute([$companyId, $triggeredBy, $distributionMode, $minCallMinutes, count($successDetails), $agentSnapshot, $sourceBasketKey, $sessionTag]);
            $sessionId = $pdo->lastInsertId();

            $detailStmt = $pdo->prepare("INSERT INTO distribution_session_details (session_id, agent_id, customer_id, previous_assigned_to, previous_basket_key, previous_lifecycle_status) VALUES (?, ?, ?, ?, ?, ?)");
            foreach ($successDetails as $detail) {
                $detailStmt->execute([
                    $sessionId, 
                    $detail['agent_id'], 
                    $detail['customer_id'],
                    $detail['previous_assigned_to'],
                    $detail['previous_basket_key'],
                    $detail['previous_lifecycle_status']
                ]);
            }
        }
        // ------------------------------------

        $pdo->commit();

        echo json_encode([
            'ok' => true,
            'success_ids' => $successIds,
            'failed_ids' => $failedIds,
            'agent_stats' => $agentStats,
            'total_success' => count($successIds),
            'total_failed' => count($failedIds),
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
function handleGetAssignChecks($pdo, $companyId)
{
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
function handleGetSessions($pdo, $companyId)
{
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
    $tagId = $_GET['tag_id'] ?? 'all';
    $basketKey = $_GET['basket_key'] ?? '';
    $tagId = $_GET['tag_id'] ?? '';

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
        $whereClauses[] = "EXISTS (SELECT 1 FROM distribution_session_details dsd WHERE dsd.session_id = ds.id AND dsd.previous_basket_key = ?)";
        $params[] = $basketKey;
    }

    if ($tagId && $tagId !== 'all') {
        $whereClauses[] = "ds.tag_id = ?";
        $params[] = $tagId;
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

    $sessionIds = array_column($sessions, 'id');
    $inClause = implode(',', array_fill(0, count($sessionIds), '?'));

    // Fetch details
    $detailStmt = $pdo->prepare("
        SELECT dsd.session_id, dsd.agent_id, u.first_name as agent_first, u.last_name as agent_last,
               c.customer_id, c.customer_ref_id as customer_code, CONCAT(c.first_name, ' ', c.last_name) as customer_name, c.phone as customer_phone
        FROM distribution_session_details dsd
        JOIN users u ON dsd.agent_id = u.id
        JOIN customers c ON dsd.customer_id = c.customer_id
        WHERE dsd.session_id IN ($inClause)
    ");
    $detailStmt->execute($sessionIds);
    $details = $detailStmt->fetchAll(PDO::FETCH_ASSOC);

    // Group details by session -> agent -> customers
    $groupedDetails = [];
    foreach ($details as $d) {
        $sid = $d['session_id'];
        $aid = $d['agent_id'];
        
        if (!isset($groupedDetails[$sid])) {
            $groupedDetails[$sid] = [];
        }
        if (!isset($groupedDetails[$sid][$aid])) {
            $groupedDetails[$sid][$aid] = [
                'agent_id' => $aid,
                'agent_name' => trim($d['agent_first'] . ' ' . $d['agent_last']),
                'customers' => []
            ];
        }
        $groupedDetails[$sid][$aid]['customers'][] = [
            'id' => $d['customer_id'],
            'code' => $d['customer_code'],
            'name' => $d['customer_name'],
            'phone' => $d['customer_phone']
        ];
    }

    // Attach to sessions
    foreach ($sessions as &$s) {
        $sid = $s['id'];
        $s['distributed_by_name'] = trim(($s['first_name'] ?? '') . ' ' . ($s['last_name'] ?? ''));
        unset($s['first_name'], $s['last_name']);
        
        $s['agent_snapshot'] = isset($s['agent_snapshot']) ? json_decode($s['agent_snapshot'], true) : [];
        $s['details'] = isset($groupedDetails[$sid]) ? array_values($groupedDetails[$sid]) : [];
    }

    echo json_encode(['ok' => true, 'sessions' => $sessions]);
}

function handleGetSessionTags($pdo, $companyId) {
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

function handleUndoDistribution($pdo, $companyId) {
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

        // Statements for rollback
        $updateCustomerStmt = $pdo->prepare("
            UPDATE customers 
            SET assigned_to = ?, current_basket_key = ?, lifecycle_status = ? 
            WHERE customer_id = ?
        ");
        
        $deleteCheckStmt = $pdo->prepare("
            DELETE FROM customer_assign_check 
            WHERE customer_id = ? AND user_id = ? AND company_id = ?
        ");

        $logStmt = $pdo->prepare("
            INSERT INTO basket_transition_log 
            (customer_id, from_basket_key, to_basket_key, assigned_to_old, assigned_to_new, transition_type, triggered_by, notes, created_at) 
            VALUES (?, ?, ?, ?, ?, 'reclaim', ?, ?, NOW())
        ");

        foreach ($details as $detail) {
            $customerId = $detail['customer_id'];
            $agentId = $detail['agent_id'];
            $prevAssignedTo = $detail['previous_assigned_to'];
            $prevBasketKey = $detail['previous_basket_key'];
            $prevLifecycle = $detail['previous_lifecycle_status'] ?? 'New';

            // Check if untouched (Safe mode)
            if ($mode === 'safe') {
                $sessionTime = strtotime($session['created_at']);
                $customerUpdateTime = strtotime($detail['customer_updated_at']);
                
                // If customer was updated more than 10 seconds after distribution, consider it "touched"
                if ($customerUpdateTime > $sessionTime + 10) {
                    $skippedIds[] = $customerId;
                    continue; // Skip this customer
                }
            }

            // Perform Rollback
            $updateCustomerStmt->execute([
                $prevAssignedTo, 
                $prevBasketKey, 
                $prevLifecycle, 
                $customerId
            ]);

            // Remove assign check so they can be assigned to this agent again in the future
            $deleteCheckStmt->execute([$customerId, $agentId, $companyId]);

            // Log the transition (Undo)
            $logStmt->execute([
                $customerId, 
                $session['source_basket'] ?? 'Unknown', 
                $prevBasketKey, 
                $agentId, 
                $prevAssignedTo, 
                $triggeredBy, 
                "Undo Distribution Session #{$sessionId} ({$mode} mode)"
            ]);

            $successIds[] = $customerId;
        }

        // 3. Update session status
        $newStatus = (count($skippedIds) === 0 && count($successIds) > 0) ? 'undo_full' : 'undo_partial';
        if (count($successIds) > 0) {
            $updateSessionStmt = $pdo->prepare("UPDATE distribution_sessions SET session_status = ? WHERE id = ?");
            $updateSessionStmt->execute([$newStatus, $sessionId]);
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

function handleCleanupDistributionDetails($pdo, $companyId) {
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

function handleGetCronLogs($pdo, $companyId) {
    if (!isset($companyId) || empty($companyId)) {
        http_response_code(400);
        echo json_encode(['error' => 'Company ID is required']);
        return;
    }

    // Role check logic would typically be handled by session middleware,
    // assuming it is passed or we verify it if needed.

    $limit = $_GET['limit'] ?? 20;

    $stmt = $pdo->prepare("SELECT id, started_at, finished_at, status, snapshot_before, snapshot_after, error_count, transferred_count FROM cron_execution_logs WHERE status = 'success' ORDER BY id DESC LIMIT ?");
    // Ensure limit is bound as an integer
    $stmt->bindValue(1, (int)$limit, PDO::PARAM_INT);
    $stmt->execute();
    $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $results = [];
    
    // Get Basket Names for mapping
    $basketNames = [];
    $bStmt = $pdo->query("SELECT id, basket_name FROM basket_config");
    while ($b = $bStmt->fetch(PDO::FETCH_ASSOC)) {
        $basketNames[$b['id']] = $b['basket_name'];
    }

    foreach ($logs as $log) {
        $before = json_decode($log['snapshot_before'], true);
        $after = json_decode($log['snapshot_after'], true);
        $cKey = 'company_' . $companyId;
        
        $cBefore = $before[$cKey] ?? [];
        $cAfter = $after[$cKey] ?? [];

        $cBeforeDist = $cBefore['distribution_pool']['__total__'] ?? 0;
        $cAfterDist = $cAfter['distribution_pool']['__total__'] ?? 0;

        $distBreakdown = [];
        $poolKeys = array_unique(array_merge(array_keys($cBefore['distribution_pool'] ?? []), array_keys($cAfter['distribution_pool'] ?? [])));
        foreach ($poolKeys as $pk) {
            if ($pk === '__total__') continue;
            $bk = $cBefore['distribution_pool'][$pk] ?? 0;
            $ak = $cAfter['distribution_pool'][$pk] ?? 0;
            if ($bk !== $ak) {
                $basketName = $basketNames[$pk] ?? "Basket ID: $pk";
                $distBreakdown[] = [
                    'basket_key' => $pk,
                    'basket_name' => $basketName,
                    'before' => $bk,
                    'after' => $ak,
                    'diff' => $ak - $bk
                ];
            }
        }

        // We can safely unset massive JSON objects before sending to frontend
        $results[] = [
            'id' => $log['id'],
            'started_at' => $log['started_at'],
            'finished_at' => $log['finished_at'],
            'status' => $log['status'],
            'transferred_count' => $log['transferred_count'], // Global trans count
            'dist_diff' => $cAfterDist - $cBeforeDist,
            'dist_total_after' => $cAfterDist,
            'dist_breakdown' => $distBreakdown
        ];
    }

    echo json_encode(['ok' => true, 'data' => $results]);
}


/**
 * Handle Batch Export of Distribution Sessions
 * GET ?action=batch_export&companyId=all&startDate=...&endDate=...&type=all
 */
function handleBatchExport($pdo, $companyId)
{
    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        http_response_code(405);
        echo json_encode(['error' => 'GET required']);
        return;
    }

    $startDate = $_GET['startDate'] ?? null;
    $endDate = $_GET['endDate'] ?? null;
    $type = $_GET['type'] ?? 'all';
    $basketKey = $_GET['basket_key'] ?? 'all';
    $tagId = $_GET['tag_id'] ?? 'all';

    if (!$startDate || !$endDate) {
        http_response_code(400);
        echo json_encode(['error' => 'startDate and endDate required']);
        return;
    }

    // Prepare date filter
    $start = $startDate . ' 00:00:00';
    $end = $endDate . ' 23:59:59';

    $params = [$start, $end];
    $companyFilter = "";
    
    if ($companyId !== 'all') {
        $companyFilter = " AND ds.company_id = ? ";
        $params[] = $companyId;
    }

    $typeFilter = "";
    if ($type === 'distribution') {
        $typeFilter = " AND (ds.distribution_mode NOT LIKE '%Reclaim%' AND ds.distribution_mode NOT LIKE '%Transfer%') ";
    } else if ($type === 'reclaim') {
        $typeFilter = " AND (ds.distribution_mode LIKE '%Reclaim%' OR ds.distribution_mode LIKE '%Transfer%') ";
    }

    if ($basketKey && $basketKey !== 'all') {
        $typeFilter .= " AND EXISTS (SELECT 1 FROM distribution_session_details _dsd WHERE _dsd.session_id = ds.id AND _dsd.previous_basket_key = ?) ";
        $params[] = $basketKey;
    }

    if ($tagId && $tagId !== 'all') {
        $typeFilter .= " AND ds.tag_id = ? ";
        $params[] = $tagId;
    }

    $sql = "
        SELECT 
            ds.id as session_id,
            ds.created_at,
            ds.distribution_mode,
            ds.min_call_minutes,
            c.name as company_name,
            u_dist.first_name as distributed_by_first,
            u_dist.last_name as distributed_by_last,
            dsd.agent_id,
            u_agent.first_name as agent_first,
            u_agent.last_name as agent_last,
            dsd.customer_id,
            
            cust.customer_ref_id as customer_code,
            CONCAT(cust.first_name, ' ', cust.last_name) as customer_name,
            cust.phone as customer_phone,
            dsd.previous_basket_key,
            bc.basket_name as previous_basket_name,
            dsd.previous_lifecycle_status,
            ds.session_tag

        FROM distribution_sessions ds
        JOIN distribution_session_details dsd ON ds.id = dsd.session_id
        LEFT JOIN companies c ON ds.company_id = c.id
        LEFT JOIN distribution_tags dt ON ds.tag_id = dt.id
        LEFT JOIN users u_dist ON ds.distributed_by = u_dist.id
        LEFT JOIN users u_agent ON dsd.agent_id = u_agent.id
        LEFT JOIN customers cust ON dsd.customer_id = cust.customer_id
        LEFT JOIN basket_config bc ON dsd.previous_basket_key = bc.basket_key
        WHERE ds.created_at BETWEEN ? AND ?
        $companyFilter
        $typeFilter
        ORDER BY ds.created_at DESC, ds.id DESC, dsd.id ASC
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'ok' => true,
        'data' => $results
    ]);
}

function handleUpdateSessionTag($pdo, $companyId)
{
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

function handleGetBasketOptions($pdo, $companyId) {
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
