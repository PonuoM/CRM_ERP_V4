<?php
require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');

try {
    $pdo = db_connect();
    
    // Get full order data like the API does
    $id = '251226-00023adminga';
    
    $items = $pdo->prepare("
        SELECT oi.*, u.first_name as creator_first_name, u.last_name as creator_last_name,
               p.sku as product_sku,
               pr.sku as promotion_sku
        FROM order_items oi 
        LEFT JOIN users u ON u.id = oi.creator_id
        LEFT JOIN products p ON oi.product_id = p.id
        LEFT JOIN promotions pr ON oi.promotion_id = pr.id
        WHERE oi.parent_order_id = ? OR oi.order_id = ? 
        ORDER BY oi.order_id, oi.id
    ");
    $items->execute([$id, $id]);
    $allItems = $items->fetchAll(PDO::FETCH_ASSOC);
    
    // Show only items with creator_id = 1655
    $filtered = array_filter($allItems, function($item) {
        return $item['creator_id'] == 1655;
    });
    
    echo json_encode([
        'success' => true,
        'items_with_creator_1655' => array_values($filtered)
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
}
