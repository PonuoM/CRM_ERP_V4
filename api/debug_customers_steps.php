<?php
/**
 * Debug endpoint - simulates authenticated customers API call
 * Tests each step of the customers handler to find where it fails
 */
ini_set('display_errors', 1);
ini_set('log_errors', 1);
ini_set('memory_limit', '256M');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

require_once __DIR__ . '/config.php';

$results = ['steps' => []];

function addStep($name, $data, &$results) {
    $results['steps'][] = ['name' => $name, 'data' => $data, 'memory' => memory_get_usage(true) / 1024 / 1024 . ' MB'];
}

try {
    $pdo = db_connect();
    addStep('db_connect', 'success', $results);
    
    // Simulate get_authenticated_user - bypass auth for debug
    // Just get any active user for testing
    $stmt = $pdo->query("SELECT id, username, company_id, status FROM users WHERE status = 'active' LIMIT 1");
    $user = $stmt->fetch();
    addStep('get_user', $user, $results);
    
    if (!$user) {
        echo json_encode(['error' => 'No admin user found']);
        exit;
    }
    
    $authCompanyId = $user['company_id'];
    $companyId = $_GET['companyId'] ?? $authCompanyId;
    $pageSize = min((int)($_GET['pageSize'] ?? 50), 5000); // Increased for stress test
    
    addStep('params', ['companyId' => $companyId, 'pageSize' => $pageSize], $results);
    
    // Step 1: Simple count
    $countStmt = $pdo->prepare("SELECT COUNT(*) as cnt FROM customers WHERE company_id = ?");
    $countStmt->execute([$companyId]);
    $count = $countStmt->fetch();
    addStep('customer_count', $count, $results);
    
    // Step 2: Fetch customers with limit
    $fetchStmt = $pdo->prepare("SELECT * FROM customers WHERE company_id = ? LIMIT ?");
    $fetchStmt->execute([$companyId, $pageSize]);
    $customers = $fetchStmt->fetchAll();
    addStep('fetch_customers', ['count' => count($customers)], $results);
    
    if (empty($customers)) {
        $results['success'] = true;
        $results['message'] = 'No customers found';
        echo json_encode($results, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        exit;
    }
    
    $customerIds = array_column($customers, 'customer_id');
    addStep('customer_ids', ['count' => count($customerIds), 'sample' => array_slice($customerIds, 0, 5)], $results);
    
    // Step 3: Upsell batch query
    if (!empty($customerIds)) {
        $placeholders = implode(',', array_fill(0, count($customerIds), '?'));
        $upsellSql = "SELECT DISTINCT o.customer_id FROM orders o
                      WHERE o.customer_id IN ($placeholders) 
                      AND o.order_status = 'Pending' 
                      AND o.order_date >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                      AND NOT EXISTS (
                          SELECT 1 FROM order_items oi 
                          WHERE oi.parent_order_id = o.id 
                          AND oi.creator_id != o.creator_id
                      )";
        $upsellStmt = $pdo->prepare($upsellSql);
        $upsellStmt->execute($customerIds);
        $upsellCount = count($upsellStmt->fetchAll());
        addStep('upsell_batch', ['count' => $upsellCount], $results);
    }
    
    // Step 4: Call notes batch query
    if (!empty($customerIds)) {
        $placeholders = implode(',', array_fill(0, count($customerIds), '?'));
        $notesSql = "SELECT ch.customer_id, ch.notes 
                     FROM call_history ch
                     INNER JOIN (
                         SELECT customer_id, MAX(id) as max_id
                         FROM call_history
                         WHERE customer_id IN ($placeholders)
                         AND notes IS NOT NULL AND notes != ''
                         GROUP BY customer_id
                     ) latest ON ch.customer_id = latest.customer_id AND ch.id = latest.max_id";
        $notesStmt = $pdo->prepare($notesSql);
        $notesStmt->execute($customerIds);
        $notesCount = count($notesStmt->fetchAll());
        addStep('notes_batch', ['count' => $notesCount], $results);
    }
    
    // Step 5: Order stats batch
    if (!empty($customerIds)) {
        $placeholders = implode(',', array_fill(0, count($customerIds), '?'));
        $orderStatsSql = "SELECT customer_id, COUNT(*) as order_count, 
                          SUM(total_amount) as total_purchases,
                          MIN(order_date) as first_order_date,
                          MAX(order_date) as last_order_date
                          FROM orders 
                          WHERE customer_id IN ($placeholders)
                          AND (order_status IS NULL OR order_status NOT IN ('Cancelled', 'Returned'))
                          GROUP BY customer_id";
        $orderStatsStmt = $pdo->prepare($orderStatsSql);
        $orderStatsStmt->execute($customerIds);
        $orderStatsCount = count($orderStatsStmt->fetchAll());
        addStep('order_stats_batch', ['count' => $orderStatsCount], $results);
    }
    
    // Step 6: Tags batch
    if (!empty($customerIds)) {
        $placeholders = implode(',', array_fill(0, count($customerIds), '?'));
        $tagsSql = "SELECT ct.customer_id, t.id, t.name, t.color 
                    FROM customer_tags ct
                    JOIN tags t ON t.id = ct.tag_id
                    WHERE ct.customer_id IN ($placeholders)";
        $tagsStmt = $pdo->prepare($tagsSql);
        $tagsStmt->execute($customerIds);
        $tagsCount = count($tagsStmt->fetchAll());
        addStep('tags_batch', ['count' => $tagsCount], $results);
    }
    
    // Step 7: Appointments batch
    if (!empty($customerIds)) {
        $placeholders = implode(',', array_fill(0, count($customerIds), '?'));
        $aptSql = "SELECT customer_id, id, date, title, status, notes
                   FROM appointments 
                   WHERE customer_id IN ($placeholders)
                   AND status != 'เสร็จสิ้น'
                   AND date >= CURDATE()
                   ORDER BY date ASC";
        $aptStmt = $pdo->prepare($aptSql);
        $aptStmt->execute($customerIds);
        $aptCount = count($aptStmt->fetchAll());
        addStep('appointments_batch', ['count' => $aptCount], $results);
    }
    
    $results['success'] = true;
    $results['message'] = 'All steps completed successfully';
    
} catch (Throwable $e) {
    $results['success'] = false;
    $results['error'] = [
        'message' => $e->getMessage(),
        'file' => basename($e->getFile()),
        'line' => $e->getLine()
    ];
}

echo json_encode($results, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
