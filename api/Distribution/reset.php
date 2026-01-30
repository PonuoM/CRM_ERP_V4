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

// Helper to get total count
function getCandidatesCount($pdo, $companyId, $targetCount)
{
    $stmt = $pdo->prepare("
        SELECT COUNT(*) FROM (
            SELECT customer_id 
            FROM customer_assign_check 
            WHERE company_id = ? 
            GROUP BY customer_id 
            HAVING COUNT(id) = ?
        ) as sub
    ");
    $stmt->execute([$companyId, $targetCount]);
    return $stmt->fetchColumn();
}

function handleGetCandidates($pdo, $companyId)
{
    $targetCount = $_GET['target_count'] ?? null;
    $page = isset($_GET['page']) ? (int) $_GET['page'] : 1;
    $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 20;
    $offset = ($page - 1) * $limit;

    if (!is_numeric($targetCount)) {
        http_response_code(400);
        echo json_encode(['error' => 'target_count is required and must be a number']);
        return;
    }

    // Get Total Count
    $total = getCandidatesCount($pdo, $companyId, $targetCount);

    // Efficient query using Covering Index + Join + Pagination
    $stmt = $pdo->prepare("
        SELECT 
            c.customer_id as id, 
            c.customer_id as code, 
            c.first_name, 
            c.last_name, 
            COUNT(cac.id) as assigned_count
        FROM customer_assign_check cac
        JOIN customers c ON cac.customer_id = c.customer_id
        WHERE cac.company_id = ?
        GROUP BY cac.customer_id
        HAVING COUNT(cac.id) = ?
        LIMIT ? OFFSET ?
    ");
    // Bind parameters for LIMIT/OFFSET (must be integers for some PDO drivers)
    $stmt->bindValue(1, $companyId, PDO::PARAM_INT);
    $stmt->bindValue(2, $targetCount, PDO::PARAM_INT);
    $stmt->bindValue(3, $limit, PDO::PARAM_INT);
    $stmt->bindValue(4, $offset, PDO::PARAM_INT);
    $stmt->execute();

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
