<?php
require_once __DIR__ . '/../config.php';

try {
    $pdo = db_connect();
    cors();
    validate_auth($pdo);

    $company_id = $_GET['company_id'] ?? null;
    $month_year = $_GET['month_year'] ?? '';
    $platform = $_GET['platform'] ?? '';
    $employee_id = $_GET['employee_id'] ?? '';
    $store_id = $_GET['store_id'] ?? '';

    if (!$company_id) {
        json_response(['success' => false, 'error' => 'Missing company_id']);
    }

    $params = [intval($company_id)];
    $where = ["i.company_id = ?"];

    if ($month_year) {
        $where[] = "i.month_year = ?";
        $params[] = $month_year;
    }
    if ($platform) {
        $where[] = "i.platform = ?";
        $params[] = $platform;
    }
    if ($employee_id) {
        $where[] = "i.employee_id = ?";
        $params[] = intval($employee_id);
    }
    if ($store_id) {
        $where[] = "i.store_id = ?";
        $params[] = intval($store_id);
    }

    $whereSql = implode(" AND ", $where);

    $sql = "SELECT i.*, 
            s.name as store_name, 
            u.first_name as employee_first_name, 
            u.last_name as employee_last_name
            FROM marketplace_invoices i
            LEFT JOIN marketplace_stores s ON i.store_id = s.id
            LEFT JOIN users u ON i.employee_id = u.id
            WHERE $whereSql
            ORDER BY i.month_year DESC, i.id DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $data = $stmt->fetchAll();

    json_response(['success' => true, 'data' => $data]);

} catch (\Throwable $e) {
    file_put_contents(__DIR__ . '/../../tmp/php_errors.log', date('Y-m-d H:i:s') . " invoices_list error: " . $e->getMessage() . "\n", FILE_APPEND);
    json_response(['success' => false, 'error' => $e->getMessage()]);
}
