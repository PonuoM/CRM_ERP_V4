<?php
// SO Save API — Create or Update Stock Order
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

require_once __DIR__ . '/../config.php';
$pdo = db_connect();

try {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) throw new Exception('Invalid input');

    $id = $input['id'] ?? null;
    $customSONumber = $input['so_number'] ?? null;
    $warehouseId = $input['warehouse_id'] ?? null;
    $orderDate = $input['order_date'] ?? date('Y-m-d');
    $expectedDate = $input['expected_date'] ?? null;
    $status = $input['status'] ?? 'Ordered';
    $notes = $input['notes'] ?? null;
    $images = $input['images'] ?? [];
    $userId = $input['user_id'] ?? 1;
    $companyId = $input['company_id'] ?? 1;
    $items = $input['items'] ?? [];

    if (!$warehouseId) throw new Exception('Warehouse ID required');
    if (empty($items)) throw new Exception('At least one item required');

    $pdo->beginTransaction();

    if ($id) {
        // UPDATE existing SO
        $stmt = $pdo->prepare("SELECT id, status FROM inv2_stock_orders WHERE id = ?");
        $stmt->execute([$id]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$existing) throw new Exception("SO not found");

        $pdo->prepare("UPDATE inv2_stock_orders SET warehouse_id=?, order_date=?, expected_date=?, status=?, notes=?, images=? WHERE id=?")
            ->execute([$warehouseId, $orderDate, $expectedDate, $status, $notes, json_encode($images), $id]);

        // Delete old items that are not yet received, then re-insert
        // Keep items that have received_quantity > 0
        $pdo->prepare("DELETE FROM inv2_stock_order_items WHERE stock_order_id = ? AND received_quantity = 0")
            ->execute([$id]);

    } else {
        // CREATE new SO — use custom number or auto-generate
        if ($customSONumber && trim($customSONumber) !== '') {
            $soNumber = trim($customSONumber);
        } else {
            $datePart = date('Ymd', strtotime($orderDate));
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM inv2_stock_orders WHERE so_number LIKE ?");
            $stmt->execute(["SO-$datePart-%"]);
            $count = (int)$stmt->fetchColumn();
            $soNumber = "SO-$datePart-" . str_pad($count + 1, 5, '0', STR_PAD_LEFT);
        }

        $pdo->prepare("INSERT INTO inv2_stock_orders (so_number, warehouse_id, order_date, expected_date, status, notes, images, created_by, company_id) VALUES (?,?,?,?,?,?,?,?,?)")
            ->execute([$soNumber, $warehouseId, $orderDate, $expectedDate, $status, $notes, json_encode($images), $userId, $companyId]);
        $id = $pdo->lastInsertId();
    }

    // Insert items
    foreach ($items as $item) {
        $productId = $item['product_id'] ?? null;
        if (!$productId) continue;

        // Check if item already exists (for update case, might have received_quantity)
        $existingItem = null;
        if (!empty($item['id'])) {
            $stmt = $pdo->prepare("SELECT id FROM inv2_stock_order_items WHERE id = ? AND stock_order_id = ?");
            $stmt->execute([$item['id'], $id]);
            $existingItem = $stmt->fetchColumn();
        }

        if ($existingItem) {
            // Update existing item
            $pdo->prepare("UPDATE inv2_stock_order_items SET product_id=?, variant=?, quantity=?, unit_cost=?, notes=? WHERE id=?")
                ->execute([$productId, $item['variant'] ?? null, $item['quantity'], $item['unit_cost'] ?? null, $item['notes'] ?? null, $existingItem]);
        } else {
            // Insert new item
            $pdo->prepare("INSERT INTO inv2_stock_order_items (stock_order_id, product_id, variant, quantity, unit_cost, notes) VALUES (?,?,?,?,?,?)")
                ->execute([$id, $productId, $item['variant'] ?? null, $item['quantity'], $item['unit_cost'] ?? null, $item['notes'] ?? null]);
        }
    }

    $pdo->commit();

    // Fetch the created/updated SO number
    $stmt = $pdo->prepare("SELECT so_number FROM inv2_stock_orders WHERE id = ?");
    $stmt->execute([$id]);
    $soNumber = $stmt->fetchColumn();

    echo json_encode(['success' => true, 'id' => (int)$id, 'so_number' => $soNumber]);

} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
