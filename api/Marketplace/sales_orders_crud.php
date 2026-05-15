<?php
require_once __DIR__ . '/../config.php';

try {
    $pdo = db_connect();
    cors();
    validate_auth($pdo);

    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        $company_id = $_GET['company_id'] ?? null;
        if (!$company_id) json_response(['success' => false, 'error' => 'Missing company_id']);

        $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 100;
        $offset = isset($_GET['offset']) ? intval($_GET['offset']) : 0;
        
        $where = ["o.company_id = ?"];
        $params = [intval($company_id)];

        if (!empty($_GET['month_year'])) {
            $where[] = "DATE_FORMAT(o.order_date, '%Y-%m') = ?";
            $params[] = $_GET['month_year'];
        }
        if (!empty($_GET['platform'])) {
            $where[] = "o.platform = ?";
            $params[] = $_GET['platform'];
        }
        if (!empty($_GET['store_id'])) {
            $where[] = "o.store_id = ?";
            $params[] = intval($_GET['store_id']);
        }
        if (!empty($_GET['search'])) {
            $where[] = "(o.order_id LIKE ? OR o.product_name LIKE ? OR o.sku LIKE ?)";
            $search = '%' . $_GET['search'] . '%';
            $params[] = $search;
            $params[] = $search;
            $params[] = $search;
        }

        $whereSql = implode(" AND ", $where);
        
        // Count total
        $countStmt = $pdo->prepare("SELECT COUNT(*) FROM marketplace_orders o WHERE $whereSql");
        $countStmt->execute($params);
        $total = $countStmt->fetchColumn();

        // Fetch data
        $sql = "SELECT o.*, s.name as store_name 
                FROM marketplace_orders o
                LEFT JOIN marketplace_stores s ON o.store_id = s.id
                WHERE $whereSql
                ORDER BY o.order_date DESC, o.id DESC
                LIMIT $limit OFFSET $offset";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $data = $stmt->fetchAll();

        json_response(['success' => true, 'data' => $data, 'total' => $total]);
    } 
    else if ($method === 'POST') {
        $data = json_input();
        $company_id = $data['company_id'] ?? null;
        if (!$company_id) json_response(['success' => false, 'error' => 'Missing company_id']);

        $sql = "INSERT INTO marketplace_sales_orders 
                (store_id, order_date, order_id, product_name, sku, quantity, unit_price, net_price, status, reason, platform, company_id) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            $data['store_id'] ?? null,
            $data['order_date'] ?? date('Y-m-d H:i:s'),
            $data['order_id'] ?? '',
            $data['product_name'] ?? '',
            $data['sku'] ?? '',
            intval($data['quantity'] ?? 1),
            floatval($data['unit_price'] ?? 0),
            floatval($data['net_price'] ?? 0),
            $data['status'] ?? 'Completed',
            $data['reason'] ?? '',
            $data['platform'] ?? '',
            intval($company_id)
        ]);

        json_response(['success' => true, 'id' => $pdo->lastInsertId()]);
    }
    else if ($method === 'PUT') {
        $data = json_input();
        $id = $data['id'] ?? null;
        $company_id = $data['company_id'] ?? null;
        
        if (!$id || !$company_id) json_response(['success' => false, 'error' => 'Missing id or company_id']);

        $sql = "UPDATE marketplace_sales_orders SET 
                store_id = ?, order_date = ?, order_id = ?, product_name = ?, sku = ?, 
                quantity = ?, unit_price = ?, net_price = ?, status = ?, reason = ?, platform = ? 
                WHERE id = ? AND company_id = ?";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            $data['store_id'] ?? null,
            $data['order_date'] ?? date('Y-m-d H:i:s'),
            $data['order_id'] ?? '',
            $data['product_name'] ?? '',
            $data['sku'] ?? '',
            intval($data['quantity'] ?? 1),
            floatval($data['unit_price'] ?? 0),
            floatval($data['net_price'] ?? 0),
            $data['status'] ?? 'Completed',
            $data['reason'] ?? '',
            $data['platform'] ?? '',
            $id,
            $company_id
        ]);

        json_response(['success' => true]);
    }
    else if ($method === 'DELETE') {
        $data = json_input();
        $id = $data['id'] ?? null;
        $company_id = $data['company_id'] ?? null;
        if (!$id || !$company_id) json_response(['success' => false, 'error' => 'Missing id or company_id']);

        $stmt = $pdo->prepare("DELETE FROM marketplace_sales_orders WHERE id = ? AND company_id = ?");
        $stmt->execute([$id, $company_id]);
        
        json_response(['success' => true]);
    }

} catch (\Throwable $e) {
    file_put_contents(__DIR__ . '/../../tmp/php_errors.log', date('Y-m-d H:i:s') . " sales_orders_crud error: " . $e->getMessage() . "\n", FILE_APPEND);
    json_response(['success' => false, 'error' => $e->getMessage()]);
}
