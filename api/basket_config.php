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
                 max_distribution_count, hold_days_before_redistribute, linked_basket_key, on_max_dist_basket_key)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                $input['on_max_dist_basket_key'] ?? null
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
                'on_max_dist_basket_key'
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
            $params[] = $companyId;

            $sql = "UPDATE basket_config SET " . implode(', ', $fields) . " WHERE id = ? AND company_id = ?";
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

            $stmt = $pdo->prepare("DELETE FROM basket_config WHERE id = ? AND company_id = ?");
            $stmt->execute([$id, $companyId]);

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
 * Handle basket customers fetch - filter customers by basket config rules
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

    // Get basket config
    $stmt = $pdo->prepare("SELECT * FROM basket_config WHERE basket_key = ? AND company_id = ? AND is_active = 1");
    $stmt->execute([$basketKey, $companyId]);
    $config = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$config) {
        echo json_encode([]);
        return;
    }

    // Build SQL with LEFT JOIN to orders to get order stats
    $sql = "
        SELECT 
            c.customer_id,
            c.first_name,
            c.last_name,
            c.phone,
            c.province,
            c.assigned_to,
            c.date_registered,
            COALESCE(os.order_count, 0) as order_count,
            os.last_order_date,
            os.first_order_date,
            COALESCE(os.total_purchases, 0) as total_purchases,
            DATEDIFF(CURDATE(), os.last_order_date) as days_since_order,
            DATEDIFF(CURDATE(), c.date_registered) as days_since_registered
        FROM customers c
        LEFT JOIN (
            SELECT 
                customer_id,
                COUNT(*) as order_count,
                MAX(order_date) as last_order_date,
                MIN(order_date) as first_order_date,
                SUM(CASE WHEN order_status != 'Cancelled' THEN total_amount ELSE 0 END) as total_purchases
            FROM orders 
            WHERE order_status != 'Cancelled'
            GROUP BY customer_id
        ) os ON c.customer_id = os.customer_id
        WHERE c.company_id = ?
        AND (c.assigned_to IS NULL OR c.assigned_to = 0)
    ";

    $params = [$companyId];
    $conditions = [];

    // Apply basket rules
    if ($config['min_order_count'] !== null) {
        $conditions[] = "COALESCE(os.order_count, 0) >= ?";
        $params[] = $config['min_order_count'];
    }

    if ($config['max_order_count'] !== null) {
        $conditions[] = "COALESCE(os.order_count, 0) <= ?";
        $params[] = $config['max_order_count'];
    }

    if ($config['min_days_since_order'] !== null) {
        $conditions[] = "(os.last_order_date IS NULL OR DATEDIFF(CURDATE(), os.last_order_date) >= ?)";
        $params[] = $config['min_days_since_order'];
    }

    if ($config['max_days_since_order'] !== null) {
        $conditions[] = "(os.last_order_date IS NOT NULL AND DATEDIFF(CURDATE(), os.last_order_date) <= ?)";
        $params[] = $config['max_days_since_order'];
    }

    if ($config['days_since_registered'] !== null) {
        $conditions[] = "DATEDIFF(CURDATE(), c.date_registered) <= ?";
        $params[] = $config['days_since_registered'];
    }

    if (!empty($conditions)) {
        $sql .= " AND (" . implode(" AND ", $conditions) . ")";
    }

    // First, get total count WITHOUT limit
    $countSql = "SELECT COUNT(*) as total FROM (" . $sql . ") as subquery";
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute($params);
    $totalCount = $countStmt->fetch(PDO::FETCH_ASSOC)['total'] ?? 0;

    // Then get data WITH limit
    $sql .= " ORDER BY os.last_order_date DESC LIMIT ?";
    $params[] = $limit;

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'data' => $customers,
        'count' => intval($totalCount),
        'basket_key' => $basketKey
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

    if (empty($assignments)) {
        http_response_code(400);
        echo json_encode(['error' => 'No assignments provided']);
        return;
    }

    // Check for linked basket
    $linkedBasketId = null;
    if ($sourceBasketKey) {
        // 1. Get linked_basket_key from source basket
        $linkStmt = $pdo->prepare("SELECT linked_basket_key FROM basket_config WHERE basket_key = ? AND company_id = ?");
        $linkStmt->execute([$sourceBasketKey, $companyId]);
        $linkedBasketKey = $linkStmt->fetchColumn();

        // 2. If valid linked_basket_key, resolve its ID
        if ($linkedBasketKey) {
            $idStmt = $pdo->prepare("SELECT id FROM basket_config WHERE basket_key = ? AND company_id = ?");
            $idStmt->execute([$linkedBasketKey, $companyId]);
            $linkedBasketId = $idStmt->fetchColumn();
        }
    }

    $pdo->beginTransaction();
    try {
        if ($linkedBasketId) {
            // Update WITH current_basket_key (ID) if linked basket exists
            $stmt = $pdo->prepare("
                UPDATE customers 
                SET assigned_to = ?, 
                    date_assigned = NOW(),
                    lifecycle_status = 'Assigned',
                    current_basket_key = ?
                WHERE customer_id = ? AND company_id = ?
            ");
        } else {
            // Standard update
            $stmt = $pdo->prepare("
                UPDATE customers 
                SET assigned_to = ?, 
                    date_assigned = NOW(),
                    lifecycle_status = 'Assigned'
                WHERE customer_id = ? AND company_id = ?
            ");
        }

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
                if ($linkedBasketId) {
                    $stmt->execute([$agentId, $linkedBasketId, $customerId, $companyId]);
                } else {
                    $stmt->execute([$agentId, $customerId, $companyId]);
                }

                if ($stmt->rowCount() > 0) {
                    $successCount++;
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
        $basketMapStmt = $pdo->prepare("SELECT id, linked_basket_key FROM basket_config WHERE basket_key = ? AND company_id = ?");

        foreach ($baskets as $basketKey => $quantity) {
            $qty = intval($quantity);
            if ($qty <= 0)
                continue;

            $basketMapStmt->execute([$basketKey, $companyId]);
            $basketConfig = $basketMapStmt->fetch(PDO::FETCH_ASSOC);
            $basketId = $basketConfig['id'] ?? null;
            $linkedBasketKey = $basketConfig['linked_basket_key'] ?? null;

            if (!$basketId)
                continue; // Basket not found

            // Determine the search target (where customers currently are)
            $searchBasketId = $basketId;

            if ($linkedBasketKey) {
                // If linked, customers are in the linked basket
                $linkIdStmt = $pdo->prepare("SELECT id FROM basket_config WHERE basket_key = ? AND company_id = ?");
                $linkIdStmt->execute([$linkedBasketKey, $companyId]);
                $linkedId = $linkIdStmt->fetchColumn();

                if ($linkedId) {
                    $searchBasketId = $linkedId;
                }
            }

            // We want to move them BACK to the source basket ($basketId)
            // So SET current_basket_key = $basketId
            // WHERE current_basket_key = $searchBasketId

            // Execute update with LIMIT
            $limitStmt = $pdo->prepare("
                UPDATE customers 
                SET assigned_to = NULL, 
                    date_assigned = NULL,
                    lifecycle_status = 'Pool',
                    current_basket_key = :new_basket_id
                WHERE company_id = :company_id 
                AND assigned_to = :agent_id
                AND current_basket_key = :search_basket_id
                LIMIT :limit
            ");

            $limitStmt->bindValue(':company_id', $companyId, PDO::PARAM_INT);
            $limitStmt->bindValue(':agent_id', $agentId, PDO::PARAM_INT);
            $limitStmt->bindValue(':new_basket_id', $basketId, PDO::PARAM_INT); // Set to Source ID
            $limitStmt->bindValue(':search_basket_id', $searchBasketId, PDO::PARAM_INT); // Find in Search ID
            $limitStmt->bindValue(':limit', $qty, PDO::PARAM_INT);

            $limitStmt->execute();
            $totalReclaimed += $limitStmt->rowCount();
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