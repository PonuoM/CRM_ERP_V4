<?php
/**
 * Stamp Batch Lump Sum — Insert or Update lump sum records into a batch
 * POST { batch_id, company_id, user_id (stamper), orders: [{user_id, amount}] }
 */
require_once __DIR__ . "/../config.php";

header('Content-Type: application/json; charset=utf-8');

try {
    $pdo = db_connect();
    $input = json_decode(file_get_contents('php://input'), true);

    $company_id = (int)($input['company_id'] ?? 0);
    $stamper_id = (int)($input['user_id'] ?? 0);
    $batch_id = (int)($input['batch_id'] ?? 0);
    $orders = $input['orders'] ?? [];
    $dry_run = !empty($input['dry_run']);

    if (!$company_id || !$batch_id) {
        echo json_encode(['ok' => false, 'error' => 'Missing company_id or batch_id']);
        exit;
    }
    if (empty($orders)) {
        echo json_encode(['ok' => false, 'error' => 'No data provided']);
        exit;
    }

    // === DRY RUN MODE ===
    if ($dry_run) {
        $errors = [];
        $valid = 0;
        
        $batchCheckStmt = $pdo->prepare("SELECT id FROM commission_stamp_batches WHERE id = ? AND company_id = ?");
        $batchCheckStmt->execute([$batch_id, $company_id]);
        if (!$batchCheckStmt->fetch()) {
            echo json_encode(['ok' => false, 'error' => 'Batch not found']);
            exit;
        }

        $userCheckStmt = $pdo->prepare("SELECT id FROM users WHERE id = ? AND company_id = ? LIMIT 1");

        foreach ($orders as $idx => $item) {
            $rowNum = $idx + 1;
            
            $user_id = isset($item['user_id']) && $item['user_id'] !== '' ? (int)$item['user_id'] : null;
            if ($user_id === null) {
                $errors[] = "แถวที่ {$rowNum}: ไม่ระบุ User ID";
                continue;
            }

            // Validate user exists
            $userCheckStmt->execute([$user_id, $company_id]);
            if (!$userCheckStmt->fetch()) {
                $globalCheckStmt = $pdo->prepare("SELECT id, company_id FROM users WHERE id = ? LIMIT 1");
                $globalCheckStmt->execute([$user_id]);
                if ($globalCheckStmt->fetch()) {
                    $errors[] = "แถวที่ {$rowNum}: User ID '{$user_id}' ไม่ได้อยู่บริษัทนี้";
                } else {
                    $errors[] = "แถวที่ {$rowNum}: ไม่พบ User ID '{$user_id}' ในระบบ";
                }
                continue;
            }

            if (!isset($item['amount']) || $item['amount'] === '') {
                $errors[] = "แถวที่ {$rowNum}: ไม่ระบุยอดค่าคอม (Amount)";
                continue;
            }

            $valid++;
        }

        echo json_encode([
            'ok' => true,
            'dry_run' => true,
            'data' => [
                'total' => count($orders),
                'valid' => $valid,
                'errors' => $errors,
            ]
        ]);
        exit;
    }

    // ACTUAL STAMP
    $pdo->beginTransaction();

    // Verify batch
    $batchCheckStmt = $pdo->prepare("SELECT id FROM commission_stamp_batches WHERE id = ? AND company_id = ? FOR UPDATE");
    $batchCheckStmt->execute([$batch_id, $company_id]);
    if (!$batchCheckStmt->fetch()) {
        $pdo->rollBack();
        echo json_encode(['ok' => false, 'error' => 'Batch not found']);
        exit;
    }

    $stamped = 0;
    $replaced = 0;
    $added = 0;
    $errors = [];

    $findExactStmt = $pdo->prepare("
        SELECT id FROM commission_stamp_orders
        WHERE batch_id = ? AND order_id = 'sum_commission' AND user_id = ?
    ");

    $insertStmt = $pdo->prepare("
        INSERT INTO commission_stamp_orders (batch_id, order_id, user_id, commission_amount, note, stamped_by)
        VALUES (?, 'sum_commission', ?, ?, ?, ?)
    ");

    $updateStmt = $pdo->prepare("
        UPDATE commission_stamp_orders
        SET commission_amount = ?, note = ?, stamped_at = NOW(), stamped_by = ?
        WHERE id = ?
    ");

    $userCheckStmt = $pdo->prepare("SELECT id FROM users WHERE id = ? AND company_id = ? LIMIT 1");

    foreach ($orders as $item) {
        $user_id = isset($item['user_id']) && $item['user_id'] !== '' ? (int)$item['user_id'] : null;
        if ($user_id === null) continue;

        // Verify User
        $userCheckStmt->execute([$user_id, $company_id]);
        if (!$userCheckStmt->fetch()) {
            $errors[] = "User '$user_id' invalid";
            continue;
        }

        $amount = isset($item['amount']) && $item['amount'] !== '' ? (float)$item['amount'] : 0.00;
        $note = "LUMP SUM Import";

        // Upsert
        $findExactStmt->execute([$batch_id, $user_id]);
        $exactMatch = $findExactStmt->fetch(PDO::FETCH_ASSOC);

        if ($exactMatch) {
            $updateStmt->execute([$amount, $note, $stamper_id ?: null, $exactMatch['id']]);
            $replaced++;
        } else {
            $insertStmt->execute([$batch_id, $user_id, $amount, $note, $stamper_id ?: null]);
            $added++;
        }
        $stamped++;
    }

    // Update batch counts
    $pdo->exec("
        UPDATE commission_stamp_batches b
        SET 
            order_count = (SELECT COUNT(*) FROM commission_stamp_orders WHERE batch_id = b.id),
            total_commission = (SELECT COALESCE(SUM(commission_amount), 0) FROM commission_stamp_orders WHERE batch_id = b.id)
        WHERE b.id = " . (int)$batch_id . "
    ");

    $pdo->commit();

    echo json_encode([
        'ok' => true,
        'data' => [
            'batch_id' => $batch_id,
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
