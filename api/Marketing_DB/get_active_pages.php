<?php
require_once __DIR__ . '/../config.php';

cors();

try {
    // Get company_id from query parameter if provided
    $companyId = isset($_GET['company_id']) ? (int)$_GET['company_id'] : null;

    $pdo = db_connect();

    // Build query based on whether company_id is provided
    if ($companyId) {
        $stmt = $pdo->prepare("
            SELECT id, name, platform, url, company_id, active, still_in_list
            FROM pages
            WHERE still_in_list = 1 AND company_id = ?
            ORDER BY name ASC
        ");
        $stmt->execute([$companyId]);
    } else {
        $stmt = $pdo->prepare("
            SELECT id, name, platform, url, company_id, active, still_in_list
            FROM pages
            WHERE still_in_list = 1
            ORDER BY name ASC
        ");
        $stmt->execute();
    }

    $pages = $stmt->fetchAll();

    json_response([
        'success' => true,
        'data' => $pages,
        'count' => count($pages)
    ]);

} catch (Exception $e) {
    error_log("Error in get_active_pages.php: " . $e->getMessage());
    json_response([
        'success' => false,
        'error' => $e->getMessage(),
        'message' => 'Failed to fetch active pages'
    ], 500);
}
