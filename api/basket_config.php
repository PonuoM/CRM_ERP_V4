<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

/**
 * Basket Config API
 * CRUD operations for basket configuration rules
 * 
 * Endpoints:
 * GET /basket_config - List all basket configs
 * GET /basket_config?id=X - Get single config
 * POST /basket_config - Create new config
 * PUT /basket_config?id=X - Update config
 * DELETE /basket_config?id=X - Delete config
 * GET /basket_config?action=return_config - Get return-to-pool config
 * PUT /basket_config?action=return_config - Update return-to-pool config
 */

require_once __DIR__ . '/config.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? null;
$id = $_GET['id'] ?? null;
$companyId = $_GET['companyId'] ?? 1;

// Get database connection
$pdo = db_connect();

try {
    // Handle basket customers fetch (filter by basket rules)
    if ($action === 'basket_customers') {
        handleBasketCustomers($pdo, $companyId);
        exit;
    }

    // Handle bulk assign (batch update multiple customers at once)
    if ($action === 'bulk_assign') {
        handleBulkAssign($pdo, $companyId);
        exit;
    }

    // Handle return-to-pool config separately
    if ($action === 'return_config') {
        handleReturnConfig($pdo, $method, $companyId);
        exit;
    }

    // Handle reclaim customers (pull back from agent)
    if ($action === 'reclaim_customers') {
        handleReclaimCustomers($pdo, $companyId);
        exit;
    }

    switch ($method) {
        case 'GET':
            if ($id) {
                // Get single config - SHARED: Always use company 1
                $stmt = $pdo->prepare("SELECT * FROM basket_config WHERE id = ? AND company_id = 1");
                $stmt->execute([$id]);
                $config = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($config) {
                    echo json_encode($config);
                } else {
                    http_response_code(404);
                    echo json_encode(['error' => 'Not found']);
                }
            } else {
                // Get all configs - SHARED: Always use company 1 baskets for all companies
                $targetPage = $_GET['target_page'] ?? null;
                $sql = "SELECT * FROM basket_config WHERE company_id = 1"; // Force company 1
                $params = [];

                if ($targetPage) {
                    $sql .= " AND target_page = ?";
                    $params[] = $targetPage;
                }

                $sql .= " ORDER BY display_order ASC";

                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $configs = $stmt->fetchAll(PDO::FETCH_ASSOC);

                // Note: Upsell basket is now managed via basket 53 (upsell_dis) in database
                // No more virtual/hardcoded injection needed

                echo json_encode($configs);
            }
            break;

        case 'POST':
            $input = json_decode(file_get_contents('php://input'), true);

            $stmt = $pdo->prepare("
                INSERT INTO basket_config 
                (basket_key, basket_name, min_order_count, max_order_count, 
                 min_days_since_order, max_days_since_order, days_since_first_order, 
                 days_since_registered, target_page, display_order, is_active, company_id,
                 on_sale_basket_key, fail_after_days, on_fail_basket_key, on_fail_reevaluate, has_loop,
                 max_distribution_count, hold_days_before_redistribute, linked_basket_key, on_max_dist_basket_key, blocked_target_baskets)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");

            $stmt->execute([
                $input['basket_key'],
                $input['basket_name'],
                $input['min_order_count'] ?? null,
                $input['max_order_count'] ?? null,
                $input['min_days_since_order'] ?? null,
                $input['max_days_since_order'] ?? null,
                $input['days_since_first_order'] ?? null,
                $input['days_since_registered'] ?? null,
                $input['target_page'] ?? 'dashboard_v2',
                $input['display_order'] ?? 0,
                $input['is_active'] ?? true,
                $companyId,
                $input['on_sale_basket_key'] ?? null,
                $input['fail_after_days'] ?? null,
                $input['on_fail_basket_key'] ?? null,
                $input['on_fail_reevaluate'] ?? 0,
                $input['has_loop'] ?? 0,
                $input['max_distribution_count'] ?? null,
                $input['hold_days_before_redistribute'] ?? null,
                $input['linked_basket_key'] ?? null,
                $input['on_max_dist_basket_key'] ?? null,
                $input['blocked_target_baskets'] ?? null
            ]);

            $newId = $pdo->lastInsertId();
            echo json_encode(['ok' => true, 'id' => $newId]);
            break;

        case 'PUT':
            if (!$id) {
                http_response_code(400);
                echo json_encode(['error' => 'ID required']);
                exit;
            }

            $input = json_decode(file_get_contents('php://input'), true);

            $fields = [];
            $params = [];

            $allowedFields = [
                'basket_key',
                'basket_name',
                'min_order_count',
                'max_order_count',
                'min_days_since_order',
                'max_days_since_order',
                'days_since_first_order',
                'days_since_registered',
                'target_page',
                'display_order',
                'is_active',
                'on_sale_basket_key',
                'fail_after_days',
                'on_fail_basket_key',
                'on_fail_reevaluate',
                'has_loop',
                'max_distribution_count',
                'hold_days_before_redistribute',
                'linked_basket_key',
                'on_max_dist_basket_key',
                'blocked_target_baskets'
            ];

            foreach ($allowedFields as $field) {
                if (array_key_exists($field, $input)) {
                    $fields[] = "$field = ?";
                    $params[] = $input[$field];
                }
            }

            if (empty($fields)) {
                echo json_encode(['ok' => true, 'message' => 'No changes']);
                exit;
            }

            $params[] = $id;
            // Basket config is GLOBAL (always company_id = 1)

            $sql = "UPDATE basket_config SET " . implode(', ', $fields) . " WHERE id = ? AND company_id = 1";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);

            echo json_encode(['ok' => true]);
            break;

        case 'DELETE':
            if (!$id) {
                http_response_code(400);
                echo json_encode(['error' => 'ID required']);
                exit;
            }

            // Basket config is GLOBAL (always company_id = 1)
            $stmt = $pdo->prepare("DELETE FROM basket_config WHERE id = ? AND company_id = 1");
            $stmt->execute([$id]);

            echo json_encode(['ok' => true]);
            break;

        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => $e->getMessage(),
        'trace' => $e->getTraceAsString(),
        'file' => $e->getFile(),
        'line' => $e->getLine()
    ]);
}

/**
 * Handle return-to-pool configuration
 */
function handleReturnConfig($pdo, $method, $companyId)
{
    switch ($method) {
        case 'GET':
            $stmt = $pdo->prepare("
                SELECT config_key, config_value, description 
                FROM basket_return_config 
                WHERE company_id = ? AND is_active = 1
            ");
            $stmt->execute([$companyId]);
            $configs = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Convert to key-value object
            $result = [];
            foreach ($configs as $config) {
                $result[$config['config_key']] = [
                    'value' => $config['config_value'],
                    'description' => $config['description']
                ];
            }
            echo json_encode($result);
            break;

        case 'PUT':
            $input = json_decode(file_get_contents('php://input'), true);

            $pdo->beginTransaction();
            try {
                foreach ($input as $key => $value) {
                    $stmt = $pdo->prepare("
                        UPDATE basket_return_config 
                        SET config_value = ? 
                        WHERE config_key = ? AND company_id = ?
                    ");
                    $stmt->execute([$value, $key, $companyId]);
                }
                $pdo->commit();
                echo json_encode(['ok' => true]);
            } catch (Exception $e) {
                $pdo->rollBack();
                throw $e;
            }
            break;

        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

/**
 * Handle basket customers fetch - filter customers by current_basket_key
 * Uses global basket config (company_id = 1) but filters customers by their actual company_id
 */
function handleBasketCustomers($pdo, $companyId)
{
    $basketKey = $_GET['basket_key'] ?? null;
    $limit = intval($_GET['limit'] ?? 500);

    if (!$basketKey) {
        http_response_code(400);
        echo json_encode(['error' => 'basket_key required']);
        return;
    }

    // Get basket config - GLOBAL: Always use company 1 for config
    $stmt = $pdo->prepare("SELECT * FROM basket_config WHERE basket_key = ? AND company_id = 1 AND is_active = 1");
    $stmt->execute([$basketKey]);
    $config = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$config) {
        echo json_encode([]);
        return;
    }

    // Note: Upsell basket is now managed via basket 53 (upsell_dis) in database
    // Uses standard ID-based query like other baskets

    $basketId = $config['id'];

    // Query customers who are:
    // 1. In the correct company (companyId from request)
    // 2. Have current_basket_key matching the basket's ID
    // 3. Are NOT assigned to anyone (available for distribution)
    $sql = "
        SELECT 
            c.customer_id,
            c.first_name,
            c.last_name,
            c.phone,
            c.province,
            c.assigned_to,
            c.date_registered,
            c.last_order_date,
            c.total_purchases,
            c.previous_assigned_to,
            DATEDIFF(CURDATE(), c.last_order_date) as days_since_order,
            DATEDIFF(CURDATE(), c.date_registered) as days_since_registered
        FROM customers c
        WHERE c.company_id = ?
        AND c.current_basket_key = ?
        AND (c.assigned_to IS NULL OR c.assigned_to = 0)
    ";

    $params = [$companyId, $basketId];

    // First, get total count WITHOUT limit
    $countSql = "SELECT COUNT(*) as total FROM (" . $sql . ") as subquery";
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute($params);
    $totalCount = $countStmt->fetch(PDO::FETCH_ASSOC)['total'] ?? 0;

    // Then get data WITH limit
    $sql .= " ORDER BY c.last_order_date DESC LIMIT ?";
    $params[] = $limit;

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'data' => $customers,
        'count' => intval($totalCount),
        'basket_key' => $basketKey,
        'basket_id' => $basketId
    ]);
}

/**
 * Handle bulk customer assignment - update multiple customers in one request
 * POST body: { assignments: [ {customer_id: X, agent_id: Y}, ... ] }
 */
function handleBulkAssign($pdo, $companyId)
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

    if (empty($assignments)) {
        http_response_code(400);
        echo json_encode(['error' => 'No assignments provided']);
        return;
    }

    // Check for linked basket or target override
    $linkedBasketId = null;
    $targetBasketId = null;

    // 1. If target_basket_key is provided explicitly, try to resolve it
    if ($targetBasketKey) {
        // Basket config is GLOBAL (always company_id = 1)
        $idStmt = $pdo->prepare("SELECT id FROM basket_config WHERE basket_key = ? AND company_id = 1");
        $idStmt->execute([$targetBasketKey]);
        $targetBasketId = $idStmt->fetchColumn();
    }

    // 2. If no explicit target, fallback to linked/source logic
    if (!$targetBasketId && $sourceBasketKey) {
        // Handle upsell_dis -> go to basket 51 (Upsell Dashboard)
        if ($sourceBasketKey === 'upsell_dis') {
            $targetBasketId = 51; // Force distribution to ID 51 (Upsell Dashboard)
        } else {
            // Get linked_basket_key from source (Basket config is GLOBAL)
            $linkStmt = $pdo->prepare("SELECT linked_basket_key FROM basket_config WHERE basket_key = ? AND company_id = 1");
            $linkStmt->execute([$sourceBasketKey]);
            $linkedBasketKey = $linkStmt->fetchColumn();

            error_log("[Distribution V2 DEBUG] Source basket: $sourceBasketKey, Linked basket key: " . ($linkedBasketKey ?: 'NULL'));

            if ($linkedBasketKey) {
                $idStmt = $pdo->prepare("SELECT id FROM basket_config WHERE basket_key = ? AND company_id = 1");
                $idStmt->execute([$linkedBasketKey]);
                $targetBasketId = $idStmt->fetchColumn();
                
                error_log("[Distribution V2 DEBUG] Resolved target basket ID: " . ($targetBasketId ?: 'NULL'));
            }
        }
    }

    error_log("[Distribution V2 DEBUG] Final target basket ID for distribution: " . ($targetBasketId ?: 'NULL'));

    $pdo->beginTransaction();
    try {
        // Prepare statement to get old data before update (basket + current agent + previous agents)
        $getOldDataStmt = $pdo->prepare("
            SELECT current_basket_key, assigned_to, previous_assigned_to 
            FROM customers 
            WHERE customer_id = ? AND company_id = ?
        ");
        
        if ($targetBasketId) {
            // Update WITH current_basket_key (ID) AND basket_entered_date if target is resolved
            $stmt = $pdo->prepare("
                UPDATE customers 
                SET assigned_to = ?, 
                    date_assigned = NOW(),
                    basket_entered_date = NOW(),
                    lifecycle_status = 'Assigned',
                    current_basket_key = ?,
                    previous_assigned_to = ?
                WHERE customer_id = ? AND company_id = ?
            ");
        } else {
            // Standard update (also update basket_entered_date)
            $stmt = $pdo->prepare("
                UPDATE customers 
                SET assigned_to = ?, 
                    date_assigned = NOW(),
                    basket_entered_date = NOW(),
                    lifecycle_status = 'Assigned',
                    previous_assigned_to = ?
                WHERE customer_id = ? AND company_id = ?
            ");
        }

        // Prepare statement for basket transition log
        $logStmt = $pdo->prepare("
            INSERT INTO basket_transition_log 
            (customer_id, from_basket_key, to_basket_key, transition_type, triggered_by, notes, created_at) 
            VALUES (?, ?, ?, 'redistribute', ?, 'Distributed via Distribution V2', NOW())
        ");

        $successCount = 0;
        $errors = [];

        foreach ($assignments as $assignment) {
            $customerId = $assignment['customer_id'] ?? null;
            $agentId = $assignment['agent_id'] ?? null;

            if (!$customerId || !$agentId) {
                $errors[] = "Missing customer_id or agent_id";
                continue;
            }

            try {
                // Get old data before update (basket + current agent + previous agents JSON)
                $getOldDataStmt->execute([$customerId, $companyId]);
                $oldData = $getOldDataStmt->fetch(PDO::FETCH_ASSOC);
                $oldBasketKey = $oldData['current_basket_key'] ?? null;
                $oldAgentId = $oldData['assigned_to'] ?? null;
                $previousAgentsJson = $oldData['previous_assigned_to'] ?? null;
                
                // Build updated previous_assigned_to array
                $previousAgents = $previousAgentsJson ? json_decode($previousAgentsJson, true) : [];
                if (!is_array($previousAgents)) {
                    $previousAgents = [];
                }
                
                // PREVENT DUPLICATE ASSIGNMENT: Skip if this agent was previously assigned to this customer
                if (in_array((int)$agentId, $previousAgents)) {
                    $errors[] = "Customer $customerId was previously assigned to agent $agentId - skipping";
                    continue;
                }
                
                // Add NEW agent (the one being assigned) to the history
                // This tracks "which agents has this customer been assigned to"
                $previousAgents[] = (int)$agentId;
                
                $newPreviousAgentsJson = json_encode($previousAgents);
                
                if ($targetBasketId) {
                    $stmt->execute([$agentId, $targetBasketId, $newPreviousAgentsJson, $customerId, $companyId]);
                } else {
                    $stmt->execute([$agentId, $newPreviousAgentsJson, $customerId, $companyId]);
                }

                if ($stmt->rowCount() > 0) {
                    $successCount++;
                    
                    // Log basket transition (triggered_by = agent receiving customer)
                    $logStmt->execute([
                        $customerId, 
                        $oldBasketKey ?: null, 
                        $targetBasketId ?: null,
                        $agentId
                    ]);
                }
            } catch (Exception $e) {
                $errors[] = "Failed to assign customer $customerId: " . $e->getMessage();
            }
        }

        $pdo->commit();

        echo json_encode([
            'ok' => true,
            'assigned' => $successCount,
            'total' => count($assignments),
            'errors' => $errors
        ]);

    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
}
/**
 * Handle reclaiming customers from an agent back to the pool
 * POST: { agent_id: 123, baskets: { 'new_lead': 10, 'follow_up': 5 } }
 */
function handleReclaimCustomers($pdo, $companyId)
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'POST required']);
        return;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $agentId = $input['agent_id'] ?? null;
    $baskets = $input['baskets'] ?? []; // key => quantity

    if (!$agentId || empty($baskets)) {
        http_response_code(400);
        echo json_encode(['error' => 'agent_id and baskets required']);
        return;
    }

    $pdo->beginTransaction();
    try {
        $totalReclaimed = 0;

        // We need to map basket_key string to basket_config.id because current_basket_key stores ID
        // Also fetch linked_basket_key to handle customers that were moved to a linked basket
        // Basket config is GLOBAL (always company_id = 1)
        $basketMapStmt = $pdo->prepare("SELECT id, linked_basket_key FROM basket_config WHERE basket_key = ? AND company_id = 1");

        foreach ($baskets as $basketKey => $quantity) {
            $qty = intval($quantity);
            if ($qty <= 0)
                continue;

            // basketKey is the Dashboard basket key (e.g., 'find_new_owner_dash')
            // We need to find customers in this basket and move them to the linked Distribution basket
            $basketMapStmt->execute([$basketKey]);
            $basketConfig = $basketMapStmt->fetch(PDO::FETCH_ASSOC);
            $dashboardBasketId = $basketConfig['id'] ?? null;
            $linkedBasketKey = $basketConfig['linked_basket_key'] ?? null;

            if (!$dashboardBasketId)
                continue; // Basket not found

            // Determine the target basket (where to move customers)
            // If linked_basket_key exists, move to that Distribution basket
            // Otherwise, just unassign them (keep in same basket)
            $targetBasketId = $dashboardBasketId; // Default: keep in same basket
            
            if ($linkedBasketKey) {
                // Find the Distribution basket ID from linked_basket_key (Basket config is GLOBAL)
                $linkIdStmt = $pdo->prepare("SELECT id FROM basket_config WHERE basket_key = ? AND company_id = 1");
                $linkIdStmt->execute([$linkedBasketKey]);
                $linkedId = $linkIdStmt->fetchColumn();

                if ($linkedId) {
                    $targetBasketId = $linkedId; // Move to Distribution basket
                }
            }

            // We want to move customers FROM dashboardBasketId TO targetBasketId (Distribution)
            // So SET current_basket_key = $targetBasketId
            // WHERE current_basket_key = $dashboardBasketId

            // First, get the customer IDs that will be affected (for logging)
            $selectStmt = $pdo->prepare("
                SELECT customer_id FROM customers 
                WHERE company_id = ? 
                AND assigned_to = ?
                AND current_basket_key = ?
                LIMIT ?
            ");
            $selectStmt->execute([$companyId, $agentId, $dashboardBasketId, $qty]);
            $affectedCustomerIds = $selectStmt->fetchAll(PDO::FETCH_COLUMN);

            if (empty($affectedCustomerIds)) {
                continue; // No customers to reclaim
            }

            // Execute update for these specific customers
            $placeholders = implode(',', array_fill(0, count($affectedCustomerIds), '?'));
            $updateSql = "
                UPDATE customers 
                SET assigned_to = NULL, 
                    date_assigned = NULL,
                    lifecycle_status = 'Pool',
                    current_basket_key = ?,
                    basket_entered_date = NOW()
                WHERE customer_id IN ($placeholders)
            ";
            $updateStmt = $pdo->prepare($updateSql);
            $updateStmt->execute(array_merge([$targetBasketId], $affectedCustomerIds));
            $totalReclaimed += $updateStmt->rowCount();

            // Log basket transitions for each customer
            $logStmt = $pdo->prepare("
                INSERT INTO basket_transition_log 
                (customer_id, from_basket_key, to_basket_key, transition_type, triggered_by, notes, created_at) 
                VALUES (?, ?, ?, 'manual', ?, 'Reclaimed via Distribution V2', NOW())
            ");
            foreach ($affectedCustomerIds as $custId) {
                $logStmt->execute([$custId, $dashboardBasketId, $targetBasketId, $agentId]);
            }
        }

        $pdo->commit();

        echo json_encode([
            'ok' => true,
            'reclaimed' => $totalReclaimed
        ]);

    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }
}