<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once '../config.php';
$pdo = db_connect();

try {
    $month = isset($_GET['month']) ? (int)$_GET['month'] : null;
    $year = isset($_GET['year']) ? (int)$_GET['year'] : null;

    $where = '1=1';
    $params = [];
    if ($month && $year) {
        $where = 'MONTH(holiday_date) = ? AND YEAR(holiday_date) = ?';
        $params = [$month, $year];
    }

    $stmt = $pdo->prepare("SELECT id, holiday_date, label FROM stock_arrival_factory_holidays WHERE $where ORDER BY holiday_date ASC");
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $data = array_map(function ($row) {
        return [
            'id' => (int)$row['id'],
            'holiday_date' => $row['holiday_date'],
            'label' => $row['label'],
        ];
    }, $rows);

    echo json_encode(['success' => true, 'data' => $data]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
