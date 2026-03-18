<?php
/**
 * Stamp Orders — Create/update batch + upsert orders
 * POST { batch_name, company_id, user_id (stamper), note?, orders: [{order_id, user_id?, commission_amount?, note?}] }
 * OR { batch_id (existing), ... } to add to existing batch
 */
require_once __DIR__ . "/../config.php";

header('Content-Type: application/json; charset=utf-8');

try {
    $pdo = db_connect();
    $input = json_decode(file_get_contents('php://input'), true);

    $company_id = (int)($input['company_id'] ?? 0);
    $stamper_id = (int)($input['user_id'] ?? 0);
    $batch_name = trim($input['batch_name'] ?? '');
    $batch_note = trim($input['note'] ?? '');
    $batch_id = (int)($input['batch_id'] ?? 0);
    $orders = $input['orders'] ?? [];

    if (!$company_id) {
        echo json_encode(['ok' => false, 'error' => 'Missing company_id']);
        exit;
    }
    if (empty($orders)) {
        echo json_encode(['ok' => false, 'error' => 'No orders provided']);
        exit;
    }


    // Ensure tables exist (MUST run before transaction — DDL causes implicit commit in MySQL)
    ob_start();
    require_once __DIR__ . '/migrate_commission_stamp.php';
    ob_end_clean();

    $pdo->beginTransaction();

    if ($batch_id > 0) {
        // Add to existing batch
        $checkStmt = $pdo->prepare("SELECT id, company_id FROM commission_stamp_batches WHERE id = ?");
        $checkStmt->execute([$batch_id]);
        $existingBatch = $checkStmt->fetch(PDO::FETCH_ASSOC);
        if (!$existingBatch) {
            $pdo->rollBack();
            echo json_encode(['ok' => false, 'error' => 'Batch not found']);
            exit;
        }
    } else {
        // Create new batch
        if (!$batch_name) {
            $batch_name = 'Batch ' . date('Y-m-d H:i');
        }
        $batchStmt = $pdo->prepare("
            INSERT INTO commission_stamp_batches (company_id, name, created_by, note)
            VALUES (?, ?, ?, ?)
        ");
        $batchStmt->execute([$company_id, $batch_name, $stamper_id ?: null, $batch_note ?: null]);
        $batch_id = $pdo->lastInsertId();
    }

    // Upsert orders
    $stamped = 0;
    $replaced = 0;
    $added = 0;
    $errors = [];

    // Check if order_id exists in orders table
    $orderCheckStmt = $pdo->prepare("SELECT id FROM orders WHERE id = ? LIMIT 1");

    // Find existing stamp with matching user_id (across ALL batches)
    $findExactStmt = $pdo->prepare("
        SELECT id, batch_id, commission_amount FROM commission_stamp_orders
        WHERE order_id = ? AND (user_id = ? OR (user_id IS NULL AND ? IS NULL))
        ORDER BY stamped_at DESC LIMIT 1
    ");

    // Find existing stamp with NULL user_id for this order (across ALL batches)
    $findNullUserStmt = $pdo->prepare("
        SELECT id, batch_id, commission_amount FROM commission_stamp_orders
        WHERE order_id = ? AND user_id IS NULL
        ORDER BY stamped_at DESC LIMIT 1
    ");

    // Insert new stamp
    $insertStmt = $pdo->prepare("
        INSERT INTO commission_stamp_orders (batch_id, order_id, user_id, commission_amount, note, stamped_by)
        VALUES (?, ?, ?, ?, ?, ?)
    ");

    // Update existing stamp (in-place)
    $updateStmt = $pdo->prepare("
        UPDATE commission_stamp_orders
        SET commission_amount = ?, note = ?, user_id = ?, batch_id = ?, stamped_at = NOW(), stamped_by = ?
        WHERE id = ?
    ");

    // Delete existing stamp (for replace scenario)
    $deleteStmt = $pdo->prepare("DELETE FROM commission_stamp_orders WHERE id = ?");

    foreach ($orders as $item) {
        $order_id = trim($item['order_id'] ?? '');
        if (!$order_id) continue;

        // Validate order exists
        $orderCheckStmt->execute([$order_id]);
        if (!$orderCheckStmt->fetch()) {
            $errors[] = "Order '$order_id' not found";
            continue;
        }

        $user_id = isset($item['user_id']) && $item['user_id'] !== '' && $item['user_id'] !== null
            ? (int)$item['user_id']
            : null;
        $commission_amount = isset($item['commission_amount']) && $item['commission_amount'] !== '' && $item['commission_amount'] !== null
            ? (float)$item['commission_amount']
            : null;
        $note = isset($item['note']) ? trim($item['note']) : null;

        // --- Upsert Logic ---
        // Step 1: Check for exact match (same order_id + same user_id across all batches)
        $findExactStmt->execute([$order_id, $user_id, $user_id]);
        $exactMatch = $findExactStmt->fetch(PDO::FETCH_ASSOC);

        if ($exactMatch) {
            // Same order_id + same user_id exists → UPDATE in place
            $newAmount = $commission_amount !== null ? $commission_amount : $exactMatch['commission_amount'];
            $updateStmt->execute([
                $newAmount, $note, $user_id, $batch_id,
                $stamper_id ?: null, $exactMatch['id']
            ]);
            $replaced++;
        } else {
            // Step 2: If importing WITH user_id, check if there's a NULL user_id record for this order
            if ($user_id !== null) {
                $findNullUserStmt->execute([$order_id]);
                $nullUserMatch = $findNullUserStmt->fetch(PDO::FETCH_ASSOC);

                if ($nullUserMatch) {
                    // Replace NULL user_id record → delete old, insert new into current batch
                    $deleteStmt->execute([$nullUserMatch['id']]);
                    $insertStmt->execute([
                        $batch_id, $order_id, $user_id, $commission_amount,
                        $note ?: null, $stamper_id ?: null
                    ]);
                    $replaced++;
                } else {
                    // No NULL user_id match → INSERT new record (different user_id)
                    $insertStmt->execute([
                        $batch_id, $order_id, $user_id, $commission_amount,
                        $note ?: null, $stamper_id ?: null
                    ]);
                    $added++;
                }
            } else {
                // Importing WITHOUT user_id and no existing NULL-user record
                // → INSERT new
                $insertStmt->execute([
                    $batch_id, $order_id, null, $commission_amount,
                    $note ?: null, $stamper_id ?: null
                ]);
                $added++;
            }
        }
        $stamped++;
    }

    // Update batch counts for ALL batches (records may have moved between batches)
    $pdo->exec("
        UPDATE commission_stamp_batches b
        SET 
            order_count = (SELECT COUNT(*) FROM commission_stamp_orders WHERE batch_id = b.id),
            total_commission = (SELECT COALESCE(SUM(commission_amount), 0) FROM commission_stamp_orders WHERE batch_id = b.id)
    ");

    $pdo->commit();

    echo json_encode([
        'ok' => true,
        'data' => [
            'batch_id' => (int)$batch_id,
            'stamped' => $stamped,
            'added' => $added,
            'replaced' => $replaced,
            'errors' => $errors
        ]
    ]);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
