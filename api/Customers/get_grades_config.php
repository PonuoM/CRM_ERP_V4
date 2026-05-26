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

try {
    $stmt = $pdo->prepare("
        SELECT id, grade_name, min_order_amount, color_theme 
        FROM customer_grades_config 
        WHERE company_id = ? 
        ORDER BY min_order_amount DESC
    ");
    $stmt->execute([$companyId]);
    $grades = $stmt->fetchAll();

    // ensure numericals are cast properly
    foreach ($grades as &$g) {
        $g['id'] = (int)$g['id'];
        $g['min_order_amount'] = (float)$g['min_order_amount'];
    }

    $stmt = $pdo->prepare("SELECT * FROM customer_grades_settings WHERE company_id = ?");
    $stmt->execute([$companyId]);
    $settings = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$settings) {
        $settings = [
            'calc_mode' => 'all',
            'time_range_type' => 'fixed',
            'fixed_start_date' => null,
            'fixed_end_date' => null,
            'relative_days' => 365
        ];
    }

    json_response(['status' => 'success', 'data' => $grades, 'settings' => $settings]);
} catch (Exception $e) {
    file_put_contents(__DIR__ . '/../logs/grades_error.log', date('Y-m-d H:i:s') . ' ' . $e->getMessage() . "\n", FILE_APPEND);
    json_response(['status' => 'error', 'message' => 'Failed to fetch grade configurations'], 500);
}
