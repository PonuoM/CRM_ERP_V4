<?php
require_once __DIR__ . '/../config.php';
cors();

$pdo = db_connect();
validate_auth($pdo);

$user = get_authenticated_user($pdo);
if (!$user) {
    json_response(['error' => 'UNAUTHORIZED', 'message' => 'Not authenticated'], 401);
}


$companyId = (int)$user['company_id'];
$input = json_input();

if (!isset($input['grades']) || !is_array($input['grades'])) {
    json_response(['error' => 'BAD_REQUEST', 'message' => 'Invalid grades data'], 400);
}

try {
    $pdo->beginTransaction();

    // 1. Get existing grades for this company
    $stmt = $pdo->prepare("SELECT id FROM customer_grades_config WHERE company_id = ?");
    $stmt->execute([$companyId]);
    $existingIds = $stmt->fetchAll(PDO::FETCH_COLUMN);

    $incomingIds = [];
    foreach ($input['grades'] as $grade) {
        if (!empty($grade['id'])) {
            $incomingIds[] = (int)$grade['id'];
        }
    }

    // 2. Delete removed grades
    $idsToDelete = array_diff($existingIds, $incomingIds);
    if (!empty($idsToDelete)) {
        $placeholders = implode(',', array_fill(0, count($idsToDelete), '?'));
        $delStmt = $pdo->prepare("DELETE FROM customer_grades_config WHERE company_id = ? AND id IN ($placeholders)");
        $params = array_merge([$companyId], $idsToDelete);
        $delStmt->execute($params);
    }

    // 3. Update or Insert
    $insertStmt = $pdo->prepare("
        INSERT INTO customer_grades_config (company_id, grade_name, min_order_amount, color_theme) 
        VALUES (?, ?, ?, ?)
    ");
    $updateStmt = $pdo->prepare("
        UPDATE customer_grades_config 
        SET grade_name = ?, min_order_amount = ?, color_theme = ? 
        WHERE id = ? AND company_id = ?
    ");

    foreach ($input['grades'] as $grade) {
        $name = trim($grade['grade_name'] ?? '');
        $min = (float)($grade['min_order_amount'] ?? 0);
        $color = trim($grade['color_theme'] ?? 'bg-gray-100 text-gray-800');

        if (empty($name)) continue;

        if (!empty($grade['id'])) {
            // Update
            $updateStmt->execute([$name, $min, $color, $grade['id'], $companyId]);
        } else {
            // Insert
            $insertStmt->execute([$companyId, $name, $min, $color]);
        }
    }

    // 4. Save settings
    if (isset($input['settings'])) {
        $set = $input['settings'];
        $calcMode = $set['calc_mode'] ?? 'all';
        $timeRangeType = $set['time_range_type'] ?? 'fixed';
        $fixedStart = !empty($set['fixed_start_date']) ? $set['fixed_start_date'] : null;
        $fixedEnd = !empty($set['fixed_end_date']) ? $set['fixed_end_date'] : null;
        $relativeDays = isset($set['relative_days']) ? (int)$set['relative_days'] : 365;

        $setStmt = $pdo->prepare("
            INSERT INTO customer_grades_settings (company_id, calc_mode, time_range_type, fixed_start_date, fixed_end_date, relative_days)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                calc_mode = VALUES(calc_mode),
                time_range_type = VALUES(time_range_type),
                fixed_start_date = VALUES(fixed_start_date),
                fixed_end_date = VALUES(fixed_end_date),
                relative_days = VALUES(relative_days)
        ");
        $setStmt->execute([$companyId, $calcMode, $timeRangeType, $fixedStart, $fixedEnd, $relativeDays]);
    }

    $pdo->commit();
    json_response(['status' => 'success', 'message' => 'Grades configuration saved']);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    file_put_contents(__DIR__ . '/../logs/grades_error.log', date('Y-m-d H:i:s') . ' ' . $e->getMessage() . "\n", FILE_APPEND);
    json_response(['status' => 'error', 'message' => 'Failed to save configuration'], 500);
}
