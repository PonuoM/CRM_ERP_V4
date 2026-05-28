<?php
if (function_exists('opcache_reset')) {
    opcache_reset();
}
require_once __DIR__ . '/../config.php';
cors();

$pdo = db_connect();
validate_auth($pdo);

$user = get_authenticated_user($pdo);
if (!$user) {
    json_response(['error' => 'UNAUTHORIZED', 'message' => 'Not authenticated'], 401);
}

// Ensure user has admin role (optional, based on system design, but grades are usually system-wide configs)
$allowedRoles = ['admin', 'superadmin', 'manager', 'super admin', 'admin control'];
if (!in_array(strtolower($user['role'] ?? ''), $allowedRoles)) {
    json_response(['error' => 'FORBIDDEN', 'message' => 'Insufficient permissions'], 403);
}

$companyId = (int)$user['company_id'];
$input = json_input();
file_put_contents('C:\laragon\www\CRM_ERP_V4_test_e2e\test-results\grades_debug.txt', date('Y-m-d H:i:s') . " INPUT: " . json_encode($input) . "\n", FILE_APPEND);

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
        $delStmt = $pdo->prepare("DELETE FROM customer_grades_config WHERE company_id = ? AND id = ?");
        foreach ($idsToDelete as $delId) {
            $delStmt->execute([$companyId, $delId]);
        }
    }

    foreach ($input['grades'] as $grade) {
        $name = trim($grade['grade_name'] ?? '');
        $min = (float)($grade['min_order_amount'] ?? 0);
        $color = trim($grade['color_theme'] ?? 'bg-gray-100 text-gray-800');

        if (empty($name)) continue;

        $gradeId = !empty($grade['id']) ? (int)$grade['id'] : 0;
        // Frontend uses Date.now() for temporary IDs, ignore them
        if ($gradeId > 1000000000) {
            $gradeId = 0;
        }

        if ($gradeId > 0) {
            // Check if exists by ID
            $check = $pdo->prepare("SELECT id FROM customer_grades_config WHERE id = ? AND company_id = ?");
            $check->execute([$gradeId, $companyId]);
            if ($check->fetch()) {
                $stmt = $pdo->prepare("UPDATE customer_grades_config SET grade_name = ?, min_order_amount = ?, color_theme = ? WHERE id = ? AND company_id = ?");
                $stmt->execute([$name, $min, $color, $gradeId, $companyId]);
                continue;
            }
        }
        
        // Check if exists by name
        $checkName = $pdo->prepare("SELECT id FROM customer_grades_config WHERE company_id = ? AND grade_name = ?");
        $checkName->execute([$companyId, $name]);
        $existing = $checkName->fetch(PDO::FETCH_ASSOC);
        
        if ($existing) {
            $stmt = $pdo->prepare("UPDATE customer_grades_config SET min_order_amount = ?, color_theme = ? WHERE id = ? AND company_id = ?");
            $stmt->execute([$min, $color, $existing['id'], $companyId]);
        } else {
            $stmt = $pdo->prepare("INSERT INTO customer_grades_config (company_id, grade_name, min_order_amount, color_theme) VALUES (?, ?, ?, ?)");
            $stmt->execute([$companyId, $name, $min, $color]);
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

        $checkStmt = $pdo->prepare("SELECT company_id FROM customer_grades_settings WHERE company_id = ?");
        $checkStmt->execute([$companyId]);
        
        if ($checkStmt->fetch()) {
            $setStmt = $pdo->prepare("
                UPDATE customer_grades_settings 
                SET calc_mode = :calc, time_range_type = :time_type, fixed_start_date = :f_start, fixed_end_date = :f_end, relative_days = :rel
                WHERE company_id = :comp
            ");
            $setStmt->execute([
                ':calc' => $calcMode,
                ':time_type' => $timeRangeType,
                ':f_start' => $fixedStart,
                ':f_end' => $fixedEnd,
                ':rel' => $relativeDays,
                ':comp' => $companyId
            ]);
        } else {
            $setStmt = $pdo->prepare("
                INSERT INTO customer_grades_settings (company_id, calc_mode, time_range_type, fixed_start_date, fixed_end_date, relative_days)
                VALUES (:comp, :calc, :time_type, :f_start, :f_end, :rel)
            ");
            $setStmt->execute([
                ':comp' => $companyId,
                ':calc' => $calcMode,
                ':time_type' => $timeRangeType,
                ':f_start' => $fixedStart,
                ':f_end' => $fixedEnd,
                ':rel' => $relativeDays
            ]);
        }
    }

    $pdo->commit();
    json_response(['status' => 'success', 'message' => 'Grades configuration saved']);
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    file_put_contents('C:\laragon\www\CRM_ERP_V4_test_e2e\test-results\grades_error.txt', date('Y-m-d H:i:s') . ' ' . $e->getMessage() . " on line " . $e->getLine() . "\n", FILE_APPEND);
    json_response(['status' => 'error', 'message' => 'Failed on line ' . $e->getLine() . ': ' . $e->getMessage()], 500);
}
