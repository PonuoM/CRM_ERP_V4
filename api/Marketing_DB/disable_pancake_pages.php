<?php
require_once __DIR__ . '/../config.php';

cors();

try {
    $input = json_input();

    $companyId = !empty($input['company_id']) ? (int)$input['company_id'] : null;

    if (!$companyId) {
        json_response([
            'success' => false,
            'error' => 'Company ID is required',
        ], 400);
    }

    $pdo = db_connect();

    $sql = "
        UPDATE pages
        SET still_in_list = 0, updated_at = CURRENT_TIMESTAMP
        WHERE page_type = 'pancake' AND company_id = ?
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([$companyId]);

    $affected = $stmt->rowCount();

    json_response([
        'success' => true,
        'affected_rows' => $affected,
        'message' => 'Pancake pages disabled successfully',
    ]);
} catch (Exception $e) {
    error_log('Error in disable_pancake_pages.php: ' . $e->getMessage());
    json_response([
        'success' => false,
        'error' => $e->getMessage(),
        'message' => 'Failed to disable Pancake pages',
    ], 500);
}

