<?php
header('Content-Type: application/json');

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (!empty($origin)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
} else {
    header('Access-Control-Allow-Origin: *');
}
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once 'config.php';

try {
    $pdo = db_connect();
    $companyId = isset($_GET['company_id']) ? intval($_GET['company_id']) : null;
    $startDate = isset($_GET['start_date']) ? $_GET['start_date'] : null;
    $endDate = isset($_GET['end_date']) ? $_GET['end_date'] : null;
    
    $sql = "SELECT 
                sm.id,
                sm.warehouse_id,
                sm.product_id,
                sm.movement_type,
                sm.quantity,
                sm.lot_number,
                sm.reference_type,
                sm.reference_id,
                sm.reason,
                sm.notes,
                sm.created_by,
                sm.created_at,
                p.name as product_name,
                p.sku as product_code,
                w.name as warehouse_name,
                u.first_name,
                u.last_name
            FROM stock_movements sm
            INNER JOIN products p ON sm.product_id = p.id
            INNER JOIN warehouses w ON sm.warehouse_id = w.id
            LEFT JOIN users u ON sm.created_by = u.id
            WHERE 1=1";
    
    $params = [];
    
    if ($companyId) {
        $sql .= " AND p.company_id = ? AND w.company_id = ?";
        $params[] = $companyId;
        $params[] = $companyId;
    }
    
    if ($startDate) {
        $sql .= " AND DATE(sm.created_at) >= ?";
        $params[] = $startDate;
    }
    
    if ($endDate) {
        $sql .= " AND DATE(sm.created_at) <= ?";
        $params[] = $endDate;
    }
    
    $sql .= " ORDER BY sm.created_at DESC";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $movements = $stmt->fetchAll();
    
    $result = [];
    foreach ($movements as $row) {
        $result[] = [
            'id' => (int)$row['id'],
            'warehouseId' => (int)$row['warehouse_id'],
            'warehouseName' => $row['warehouse_name'],
            'productId' => (int)$row['product_id'],
            'productName' => $row['product_name'],
            'productCode' => $row['product_code'],
            'movementType' => $row['movement_type'],
            'quantity' => (int)$row['quantity'],
            'lotNumber' => $row['lot_number'],
            'referenceType' => $row['reference_type'],
            'referenceId' => $row['reference_id'],
            'reason' => $row['reason'],
            'notes' => $row['notes'],
            'createdBy' => (int)$row['created_by'],
            'createdByName' => trim(($row['first_name'] ?? '') . ' ' . ($row['last_name'] ?? '')),
            'createdAt' => $row['created_at']
        ];
    }
    
    echo json_encode([
        'success' => true,
        'data' => $result
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>
