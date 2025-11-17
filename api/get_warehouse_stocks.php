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
    
    $sql = "SELECT 
                ws.id,
                ws.warehouse_id,
                ws.product_id,
                ws.lot_number,
                ws.quantity,
                ws.reserved_quantity,
                ws.available_quantity,
                ws.expiry_date,
                ws.purchase_price,
                ws.selling_price,
                ws.location_in_warehouse,
                ws.notes,
                ws.created_at,
                ws.updated_at,
                p.name as product_name,
                p.sku as product_code,
                w.name as warehouse_name
            FROM warehouse_stocks ws
            INNER JOIN products p ON ws.product_id = p.id
            INNER JOIN warehouses w ON ws.warehouse_id = w.id
            WHERE 1=1";
    
    $params = [];
    
    if ($companyId) {
        $sql .= " AND p.company_id = ? AND w.company_id = ?";
        $params[] = $companyId;
        $params[] = $companyId;
    }
    
    $sql .= " ORDER BY ws.warehouse_id, p.name";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $stocks = $stmt->fetchAll();
    
    $result = [];
    foreach ($stocks as $row) {
        $result[] = [
            'id' => (int)$row['id'],
            'warehouseId' => (int)$row['warehouse_id'],
            'warehouseName' => $row['warehouse_name'],
            'productId' => (int)$row['product_id'],
            'productName' => $row['product_name'],
            'productCode' => $row['product_code'],
            'lotNumber' => $row['lot_number'],
            'quantity' => (int)$row['quantity'],
            'reservedQuantity' => (int)$row['reserved_quantity'],
            'availableQuantity' => (int)$row['available_quantity'],
            'expiryDate' => $row['expiry_date'],
            'purchasePrice' => $row['purchase_price'] ? (float)$row['purchase_price'] : null,
            'sellingPrice' => $row['selling_price'] ? (float)$row['selling_price'] : null,
            'locationInWarehouse' => $row['location_in_warehouse'],
            'notes' => $row['notes'],
            'createdAt' => $row['created_at'],
            'updatedAt' => $row['updated_at']
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
