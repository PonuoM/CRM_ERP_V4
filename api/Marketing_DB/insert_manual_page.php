<?php
require_once __DIR__ . '/../config.php';

cors();

try {
    // Get JSON input
    $input = json_input();

    // Validate required fields
    if (empty($input['name'])) {
        json_response([
            'success' => false,
            'error' => 'Page name is required'
        ], 400);
    }

    if (empty($input['company_id'])) {
        json_response([
            'success' => false,
            'error' => 'Company ID is required'
        ], 400);
    }

    // Extract and sanitize input
    $name = trim($input['name']);
    $platform = !empty($input['platform']) ? trim($input['platform']) : 'Facebook';
    $url = !empty($input['url']) ? trim($input['url']) : null;
    $companyId = (int)$input['company_id'];
    $pageType = 'manual'; // Fixed value as requested
    $active = 1; // Fixed value as requested
    $stillInList = 1; // Fixed value as requested

    // Generate page_id if not provided (using timestamp and random string)
    $pageId = !empty($input['page_id']) ? trim($input['page_id']) : 'manual_' . time() . '_' . substr(md5(uniqid()), 0, 8);

    // Connect to database
    $pdo = db_connect();

    // Check if page with same name and company already exists
    $checkStmt = $pdo->prepare("
        SELECT id FROM pages
        WHERE name = ? AND company_id = ? AND still_in_list = 1
    ");
    $checkStmt->execute([$name, $companyId]);

    if ($checkStmt->fetch()) {
        json_response([
            'success' => false,
            'error' => 'Page with this name already exists in your company'
        ], 409);
    }

    // Insert the new page
    $stmt = $pdo->prepare("
        INSERT INTO pages (
            page_id, name, platform, page_type, url, company_id, active, still_in_list
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?
        )
    ");

    $result = $stmt->execute([
        $pageId,
        $name,
        $platform,
        $pageType,
        $url,
        $companyId,
        $active,
        $stillInList
    ]);

    if (!$result) {
        throw new Exception('Failed to insert page');
    }

    // Get the inserted page data
    $pageId_db = $pdo->lastInsertId();

    $selectStmt = $pdo->prepare("
        SELECT id, page_id, name, platform, page_type, url, company_id, active, still_in_list, created_at, updated_at, user_count
        FROM pages
        WHERE id = ?
    ");
    $selectStmt->execute([$pageId_db]);
    $newPage = $selectStmt->fetch();

    json_response([
        'success' => true,
        'data' => $newPage,
        'message' => 'Page created successfully'
    ]);

} catch (Exception $e) {
    error_log("Error in insert_manual_page.php: " . $e->getMessage());
    json_response([
        'success' => false,
        'error' => $e->getMessage(),
        'message' => 'Failed to create page'
    ], 500);
}
