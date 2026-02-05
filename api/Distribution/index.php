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

    if (empty($assignments)) {
        http_response_code(400);
        echo json_encode(['error' => 'No assignments provided']);
        return;
    }

    // Resolve Target Basket ID
    $targetBasketId = null;
    if ($targetBasketKey) {
        $stmt = $pdo->prepare("SELECT id FROM basket_config WHERE basket_key = ? AND company_id = 1");
        $stmt->execute([$targetBasketKey]);
        $targetBasketId = $stmt->fetchColumn();
    } elseif ($sourceBasketKey) {
        // Fallback to linked basket
        if ($sourceBasketKey === 'upsell_dis') {
            $targetBasketId = 51; // Hardcoded for Upsell
        } else {
            $stmt = $pdo->prepare("SELECT linked_basket_key FROM basket_config WHERE basket_key = ? AND company_id = 1");
            $stmt->execute([$sourceBasketKey]);
            $linkedKey = $stmt->fetchColumn();
            if ($linkedKey) {
                $stmt = $pdo->prepare("SELECT id FROM basket_config WHERE basket_key = ? AND company_id = 1");
                $stmt->execute([$linkedKey]);
                $targetBasketId = $stmt->fetchColumn();
            }
        }
    }

    $pdo->beginTransaction();

    $successIds = [];
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
    $getOldStmt = $pdo->prepare("SELECT current_basket_key, assigned_to FROM customers WHERE customer_id = ?");
    
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
            $checkStmt->execute([$customerId, $agentId]);
            if ($checkStmt->fetchColumn()) {
                // Already assigned to this agent in current round
                $failedIds[] = $customerId;
                continue;
            }

            // 1.5 Get old data before update
            $getOldStmt->execute([$customerId]);
            $oldData = $getOldStmt->fetch(PDO::FETCH_ASSOC);
            $oldBasketKey = $oldData['current_basket_key'] ?? $sourceBasketKey;
            $oldAssignedTo = $oldData['assigned_to'] ?? null;

            // 2. Perform Assignment
            $insertCheckStmt->execute([$customerId, $agentId, $companyId]);

            if ($targetBasketId) {
                $updateStmt->execute([$agentId, $targetBasketId, $customerId, $companyId]);
            } else {
                $updateStmt->execute([$agentId, $customerId, $companyId]);
            }

            // 3. Log with assigned_to_old and assigned_to_new
            $logStmt->execute([$customerId, $oldBasketKey, $targetBasketId, $oldAssignedTo, $agentId, 'distribute', $triggeredBy, 'Distributed from Distribution V2']);

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
            if (!isset($agentStats[$agentId]))
                $agentStats[$agentId] = 0;
            $agentStats[$agentId]++;
        }

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
