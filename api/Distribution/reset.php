<?php
// api/Distribution/reset.php

require_once __DIR__ . '/../config.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Get database connection
$pdo = db_connect();

$action = $_GET['action'] ?? null;
$companyId = $_GET['companyId'] ?? 1;

try {
    if ($action === 'get_candidates') {
        handleGetCandidates($pdo, $companyId);
    } elseif ($action === 'manual_reset') {
        handleManualReset($pdo, $companyId);
    } elseif ($action === 'get_reset_summary') {
        handleGetResetSummary($pdo, $companyId);
    } elseif ($action === 'get_assign_history') {
        handleGetAssignHistory($pdo, $companyId);
    } elseif ($action === 'get_agents_in_checks') {
        handleGetAgentsInChecks($pdo, $companyId);
    } else {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid action']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
}

function handleGetResetSummary($pdo, $companyId)
{
    // Aggregate count of how many times customers have been distributed
    $stmt = $pdo->prepare("
        SELECT assigned_count, COUNT(*) as customer_count 
        FROM (
            SELECT customer_id, COUNT(id) as assigned_count
            FROM customer_assign_check
            WHERE company_id = ?
            GROUP BY customer_id
        ) as sub
        GROUP BY assigned_count
        ORDER BY assigned_count ASC
    ");
    $stmt->execute([$companyId]);
    $summary = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'ok' => true,
        'summary' => $summary
    ]);
}

function handleGetAssignHistory($pdo, $companyId)
{
    $customerId = $_GET['customer_id'] ?? null;
    if (!$customerId) {
        http_response_code(400);
        echo json_encode(['error' => 'customer_id is required']);
        return;
    }

    $stmt = $pdo->prepare("
        SELECT 
            u.first_name, 
            u.last_name, 
            cac.created_at
        FROM customer_assign_check cac
        JOIN users u ON cac.user_id = u.id
        WHERE cac.customer_id = ? AND cac.company_id = ?
        ORDER BY cac.created_at DESC
    ");
    $stmt->execute([$customerId, $companyId]);
    $history = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'ok' => true,
        'history' => $history
    ]);
}

// Helper to build agent filter subquery
function buildAgentFilterClause($agentIds, $agentMode, &$params, $companyId) {
    if (!$agentIds || count($agentIds) === 0) return '';
    $placeholders = implode(',', array_fill(0, count($agentIds), '?'));
    
    if ($agentMode === 'all') {
        // Must have been assigned to ALL selected agents
        $clause = " AND cac.customer_id IN (SELECT customer_id FROM customer_assign_check WHERE user_id IN ($placeholders) AND company_id = ? GROUP BY customer_id HAVING COUNT(DISTINCT user_id) = ?)";
        foreach ($agentIds as $aid) { $params[] = (int) $aid; }
        $params[] = $companyId;
        $params[] = count($agentIds);
    } else {
        // ANY of the selected agents
        $clause = " AND cac.customer_id IN (SELECT customer_id FROM customer_assign_check WHERE user_id IN ($placeholders) AND company_id = ?)";
        foreach ($agentIds as $aid) { $params[] = (int) $aid; }
        $params[] = $companyId;
    }
    return $clause;
}

// Helper to get total count (with optional search/agent_ids filters)
function getCandidatesCount($pdo, $companyId, $targetCount, $search = null, $agentIds = null, $agentMode = 'any')
{
    $params = [];
    $whereExtra = '';
    $joinExtra = '';

    $params[] = $companyId;
    if ($agentIds && count($agentIds) > 0) {
        $joinExtra = ' JOIN customers c2 ON cac.customer_id = c2.customer_id';
        $whereExtra .= buildAgentFilterClause($agentIds, $agentMode, $params, $companyId);
    }

    if ($search) {
        if (!$agentIds || count($agentIds) === 0) {
            $joinExtra = ' JOIN customers c2 ON cac.customer_id = c2.customer_id';
        }
        $like = '%' . $search . '%';
        $whereExtra .= ' AND (c2.first_name LIKE ? OR c2.last_name LIKE ? OR c2.phone LIKE ? OR c2.customer_id LIKE ?)';
        $params[] = $like;
        $params[] = $like;
        $params[] = $like;
        $params[] = $like;
    }
    $params[] = $targetCount;

    $sql = "
        SELECT COUNT(*) FROM (
            SELECT cac.customer_id 
            FROM customer_assign_check cac
            $joinExtra
            WHERE cac.company_id = ?
            $whereExtra
            GROUP BY cac.customer_id 
            HAVING COUNT(cac.id) = ?
        ) as sub
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    return $stmt->fetchColumn();
}

function handleGetCandidates($pdo, $companyId)
{
    $targetCount = $_GET['target_count'] ?? null;
    $page = isset($_GET['page']) ? (int) $_GET['page'] : 1;
    $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 20;
    $offset = ($page - 1) * $limit;
    $search = isset($_GET['search']) && $_GET['search'] !== '' ? trim($_GET['search']) : null;
    // Support comma-separated agent IDs + mode (any/all)
    $agentIds = null;
    $agentMode = $_GET['agent_mode'] ?? 'any'; // 'any' or 'all'
    if (isset($_GET['agent_ids']) && $_GET['agent_ids'] !== '') {
        $agentIds = array_filter(array_map('intval', explode(',', $_GET['agent_ids'])));
        if (empty($agentIds)) $agentIds = null;
    }

    if (!is_numeric($targetCount)) {
        http_response_code(400);
        echo json_encode(['error' => 'target_count is required and must be a number']);
        return;
    }

    // Get Total Count with filters
    $total = getCandidatesCount($pdo, $companyId, $targetCount, $search, $agentIds, $agentMode);

    // Build query with filters
    $params = [];
    $whereExtra = '';

    $params[] = $companyId;
    if ($agentIds && count($agentIds) > 0) {
        $whereExtra .= buildAgentFilterClause($agentIds, $agentMode, $params, $companyId);
    }
    if ($search) {
        $like = '%' . $search . '%';
        $whereExtra .= ' AND (c.first_name LIKE ? OR c.last_name LIKE ? OR c.phone LIKE ? OR c.customer_id LIKE ?)';
        $params[] = $like;
        $params[] = $like;
        $params[] = $like;
        $params[] = $like;
    }
    $params[] = $targetCount;
    $params[] = $limit;
    $params[] = $offset;

    $sql = "
        SELECT 
            c.customer_id as id, 
            c.customer_id as code, 
            c.first_name, 
            c.last_name,
            c.phone,
            COUNT(cac.id) as assigned_count,
            GROUP_CONCAT(DISTINCT CONCAT(u.first_name, ' ', u.last_name) ORDER BY cac.created_at DESC SEPARATOR ', ') as agent_names
        FROM customer_assign_check cac
        JOIN customers c ON cac.customer_id = c.customer_id
        JOIN users u ON cac.user_id = u.id
        WHERE cac.company_id = ?
        $whereExtra
        GROUP BY cac.customer_id
        HAVING COUNT(cac.id) = ?
        LIMIT ? OFFSET ?
    ";



    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $candidates = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'ok' => true,
        'candidates' => $candidates,
        'total' => (int) $total,
        'page' => $page,
        'limit' => $limit,
        'total_pages' => ceil($total / $limit)
    ]);
}

function handleGetAgentsInChecks($pdo, $companyId)
{
    $stmt = $pdo->prepare("
        SELECT DISTINCT u.id, u.first_name, u.last_name
        FROM customer_assign_check cac
        JOIN users u ON cac.user_id = u.id
        WHERE cac.company_id = ?
        ORDER BY u.first_name, u.last_name
    ");
    $stmt->execute([$companyId]);
    $agents = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'ok' => true,
        'agents' => $agents
    ]);
}

function handleManualReset($pdo, $companyId)
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'POST required']);
        return;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $mode = $input['mode'] ?? 'selected'; // 'selected' or 'all'
    $triggeredBy = $input['triggered_by'] ?? null;

    $pdo->beginTransaction();

    try {
        $totalReset = 0;

        if ($mode === 'all') {
            $targetCount = $input['target_count'] ?? null;
            if (!$targetCount) {
                throw new Exception("target_count required for mode='all'");
            }

            // Subquery to find target customers
            // Note: MySQL doesn't natively support DELETE with JOIN/Subquery on same table easily in some versions,
            // but IN clause usually works if not selecting from the exact table being updated in a way that locks it.
            // Using a temporary table approach or straightforward IN is better.
            // Simplified approach: Select IDs first then limit update to chunks to avoid locks? 
            // OR just one big atomic statement. Let's try direct approach.

            // Get ALL eligible IDs first (to avoid "You can't specify target table for update in FROM clause" error on MySQL)
            $stmt = $pdo->prepare("
                SELECT customer_id 
                FROM customer_assign_check 
                WHERE company_id = ? 
                GROUP BY customer_id 
                HAVING COUNT(id) = ?
            ");
            $stmt->execute([$companyId, $targetCount]);
            $customerIds = $stmt->fetchAll(PDO::FETCH_COLUMN);

            if (empty($customerIds)) {
                $pdo->commit();
                echo json_encode(['ok' => true, 'total_reset' => 0]);
                return;
            }

            // reuse existing logic for chunks
        } else {
            $customerIds = $input['customer_ids'] ?? [];
            if (empty($customerIds)) {
                http_response_code(400);
                echo json_encode(['error' => 'No customer_ids provided']);
                return;
            }
        }

        // Common Reset Logic (Chunked)
        $chunks = array_chunk($customerIds, 1000);
        $totalDeleted = 0;
        $totalUpdated = 0;

        foreach ($chunks as $chunk) {
            $placeholders = implode(',', array_fill(0, count($chunk), '?'));

            // Delete check
            $deleteStmt = $pdo->prepare("DELETE FROM customer_assign_check WHERE customer_id IN ($placeholders) AND company_id = ?");
            $params = $chunk;
            $params[] = $companyId;
            $deleteStmt->execute($params);
            $totalDeleted += $deleteStmt->rowCount();

            // Increment Round
            $updateStmt = $pdo->prepare("UPDATE customers SET current_round = current_round + 1 WHERE customer_id IN ($placeholders) AND company_id = ?");
            // Reuse params
            $updateStmt->execute($params);
            $totalUpdated += $updateStmt->rowCount();
        }

        // Log action (Removed as per request)
        // if ($triggeredBy) {
        //     $logStmt = $pdo->prepare("INSERT INTO system_logs (action, description, user_id, company_id, created_at) VALUES (?, ?, ?, ?, NOW())");
        //     $desc = $mode === 'all' ? "Reset round ALL for count=$targetCount ($totalUpdated customers)" : "Reset round for $totalUpdated customers";
        //     $logStmt->execute(['manual_round_reset', $desc, $triggeredBy, $companyId]);
        // }

        $pdo->commit();

        echo json_encode([
            'ok' => true,
            'total_reset' => $totalUpdated,
            'log_deleted' => $totalDeleted
        ]);

    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}
