<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../config.php';
$pdo = db_connect();

try {
    $companyId = $_GET['company_id'] ?? 1;

    // Get current mappings
    $stmt = $pdo->prepare("SELECT m.id, m.dispatch_warehouse_name, m.main_warehouse_id, w.name as main_warehouse_name 
                           FROM inv2_warehouse_mappings m
                           JOIN warehouses w ON m.main_warehouse_id = w.id
                           WHERE m.company_id = ?");
    $stmt->execute([$companyId]);
    $mappings = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Auto-discover distinct dispatch warehouse names from dispatch items that are NOT mapped
    $stmtUnmapped = $pdo->prepare("SELECT DISTINCT warehouse_name 
                                   FROM inv2_dispatch_items 
                                   WHERE warehouse_name IS NOT NULL 
                                   AND warehouse_name != ''
                                   AND warehouse_name NOT IN (SELECT dispatch_warehouse_name FROM inv2_warehouse_mappings WHERE company_id = ?)");
    $stmtUnmapped->execute([$companyId]);
    $unmappedNames = $stmtUnmapped->fetchAll(PDO::FETCH_COLUMN);

    echo json_encode([
        'success' => true, 
        'mappings' => $mappings, 
        'unmapped' => $unmappedNames
    ]);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
