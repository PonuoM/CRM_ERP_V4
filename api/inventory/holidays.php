<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once '../config.php';
require_once 'stock_plan_company_group.php';
$pdo = db_connect();

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $month = isset($_GET['month']) ? (int)$_GET['month'] : null;
        $year = isset($_GET['year']) ? (int)$_GET['year'] : null;
        $companyId = isset($_GET['companyId']) ? (int)$_GET['companyId'] : null;

        if (!$companyId) {
            throw new Exception('Missing companyId');
        }

        // We fetch holidays for the collaboration group
        $companyIds = stock_plan_company_ids($companyId);
        $placeholders = implode(',', array_fill(0, count($companyIds), '?'));
        
        $params = $companyIds;
        $whereSql = "company_id IN ($placeholders)";

        if ($month && $year) {
            $whereSql .= " AND MONTH(holiday_date) = ? AND YEAR(holiday_date) = ?";
            $params[] = $month;
            $params[] = $year;
        }

        $stmt = $pdo->prepare("SELECT holiday_date FROM stock_arrival_holidays WHERE $whereSql");
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $dates = array_map(function ($row) {
            return $row['holiday_date'];
        }, $rows);
        
        // Remove duplicates if any (due to group sharing)
        $dates = array_values(array_unique($dates));

        echo json_encode(['success' => true, 'data' => $dates]);
    } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $input = json_decode(file_get_contents('php://input'), true);
        $companyId = $input['companyId'] ?? null;
        $dates = $input['dates'] ?? [];
        $userId = $input['userId'] ?? null;
        $month = $input['month'] ?? null;
        $year = $input['year'] ?? null;

        if (!$companyId) {
            throw new Exception('Missing companyId');
        }
        if (!$month || !$year) {
            throw new Exception('Missing month or year');
        }

        $pdo->beginTransaction();

        // 1. Delete all existing holidays for the given month/year and company
        $deleteStmt = $pdo->prepare("DELETE FROM stock_arrival_holidays WHERE company_id = ? AND MONTH(holiday_date) = ? AND YEAR(holiday_date) = ?");
        $deleteStmt->execute([$companyId, $month, $year]);

        // 2. Insert new ones
        if (!empty($dates)) {
            $insertStmt = $pdo->prepare("INSERT IGNORE INTO stock_arrival_holidays (company_id, holiday_date, created_by) VALUES (?, ?, ?)");
            foreach ($dates as $date) {
                $insertStmt->execute([$companyId, $date, $userId]);
            }
        }

        $pdo->commit();

        echo json_encode(['success' => true]);
    } else {
        throw new Exception('Invalid method');
    }

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
