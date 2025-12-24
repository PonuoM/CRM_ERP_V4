<?php
require_once __DIR__ . '/../config.php';
$pdo = db_connect();

echo "Starting migration of allocations to stock_movements...\n";

// chunking to avoid memory issues
$batchSize = 500;
$offset = 0;
$totalMigrated = 0;

while (true) {
    // Select ALLOCATED items
    $sql = "SELECT * FROM order_item_allocations 
            WHERE status = 'ALLOCATED' 
            ORDER BY id ASC 
            LIMIT $batchSize OFFSET $offset";
    $stmt = $pdo->query($sql);
    $allocations = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($allocations)) {
        break;
    }

    foreach ($allocations as $alloc) {
        // Check if exists
        $chk = $pdo->prepare("SELECT id FROM stock_movements WHERE reference_type = 'order_item_allocations' AND reference_id = ?");
        $chk->execute([$alloc['id']]);
        if ($chk->fetch()) {
            continue; // Already exists
        }

        // Insert
        // Use created_by if exists, else 1
        $createdBy = !empty($alloc['created_by']) ? $alloc['created_by'] : 1;
        // Use order_id as document_number
        $docNum = $alloc['order_id'];
        
        // Quantity is negative for OUT
        $qty = -(int)$alloc['allocated_quantity'];

        $ins = $pdo->prepare("INSERT INTO stock_movements 
            (warehouse_id, product_id, movement_type, quantity, lot_number, document_number, reference_type, reference_id, reason, created_by, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        
        $ins->execute([
            $alloc['warehouse_id'], 
            $alloc['product_id'], 
            'OUT', 
            $qty, 
            $alloc['lot_number'], 
            $docNum, 
            'order_item_allocations', 
            $alloc['id'], 
            'Order Allocation (Migration)', 
            $createdBy,
            $alloc['created_at'] // Preserve timestamp
        ]);

        $totalMigrated++;
    }

    $offset += $batchSize;
    echo "Processed batch ending at offset $offset. Migrated so far: $totalMigrated\n";
}

echo "Migration complete. Total migrated: $totalMigrated\n";
