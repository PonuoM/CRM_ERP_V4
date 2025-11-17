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
                pl.id,
                pl.lot_number,
                pl.product_id,
                pl.warehouse_id,
                pl.purchase_date,
                pl.expiry_date,
                pl.quantity_received,
                pl.quantity_remaining,
                pl.unit_cost,
                pl.supplier_id,
                pl.supplier_invoice,
                pl.status,
                pl.notes,
                pl.created_at,
                pl.updated_at,
                p.name as product_name,
                p.sku as product_code,
                w.name as warehouse_name
            FROM product_lots pl
            INNER JOIN products p ON pl.product_id = p.id
            INNER JOIN warehouses w ON pl.warehouse_id = w.id
            WHERE 1=1";
    
    $params = [];
    
    if ($companyId) {
        $sql .= " AND p.company_id = ? AND w.company_id = ?";
        $params[] = $companyId;
        $params[] = $companyId;
    }
    
    $sql .= " ORDER BY pl.warehouse_id, p.name, pl.lot_number";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $lots = $stmt->fetchAll();
    
    $result = [];
    foreach ($lots as $row) {
        $result[] = [
            'id' => (int)$row['id'],
            'lotNumber' => $row['lot_number'],
            'productId' => (int)$row['product_id'],
            'productName' => $row['product_name'],
            'productCode' => $row['product_code'],
            'warehouseId' => (int)$row['warehouse_id'],
            'warehouseName' => $row['warehouse_name'],
            'purchaseDate' => $row['purchase_date'],
            'expiryDate' => $row['expiry_date'],
            'quantityReceived' => (float)$row['quantity_received'],
            'quantityRemaining' => (float)$row['quantity_remaining'],
            'unitCost' => (float)$row['unit_cost'],
            'supplierId' => $row['supplier_id'] ? (int)$row['supplier_id'] : null,
            'supplierInvoice' => $row['supplier_invoice'],
            'status' => $row['status'],
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

