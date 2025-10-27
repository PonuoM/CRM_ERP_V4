<?php
require_once __DIR__ . '/../config.php';

cors();

try {
    $pdo = db_connect();

    // Get input data
    $input = json_input();
    $data = $input['data'] ?? [];
    $userId = $input['userId'] ?? null;

    // Validate input
    if (!$userId) {
        json_response([
            'success' => false,
            'error' => 'Missing required parameter: userId'
        ], 400);
    }

    if (empty($data)) {
        json_response([
            'success' => false,
            'error' => 'No data to save'
        ], 400);
    }

    $pdo->beginTransaction();
    $savedCount = 0;

    foreach ($data as $row) {
        // Validate required fields
        if (!isset($row['pageId']) || !isset($row['adsCost'])) {
            continue; // Skip invalid rows
        }

        $pageId = $row['pageId'];
        $adsCost = $row['adsCost'] ?? 0;
        $impressions = $row['impressions'] ?? 0;
        $reach = $row['reach'] ?? 0;
        $clicks = $row['clicks'] ?? 0;

        // Verify user has access to this page
        $accessCheck = $pdo->prepare("
            SELECT COUNT(*) as has_access
            FROM marketing_user_page
            WHERE user_id = ? AND page_id = ?
        ");
        $accessCheck->execute([$userId, $pageId]);
        $hasAccess = $accessCheck->fetch()['has_access'];

        if (!$hasAccess) {
            continue; // Skip pages user doesn't have access to
        }

        // Insert or update ads data
        $stmt = $pdo->prepare("
            INSERT INTO ads_data (
                page_id,
                user_id,
                ads_cost,
                impressions,
                reach,
                clicks,
                created_at,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
            ON DUPLICATE KEY UPDATE
                ads_cost = VALUES(ads_cost),
                impressions = VALUES(impressions),
                reach = VALUES(reach),
                clicks = VALUES(clicks),
                updated_at = NOW()
        ");

        $stmt->execute([
            $pageId,
            $userId,
            $adsCost,
            $impressions,
            $reach,
            $clicks
        ]);

        $savedCount++;
    }

    $pdo->commit();

    json_response([
        'success' => true,
        'message' => "บันทึกข้อมูลสำเร็จ $savedCount รายการ",
        'data' => [
            'saved_count' => $savedCount,
            'total_rows' => count($data)
        ]
    ]);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    error_log("Error in save_ads_data.php: " . $e->getMessage());
    json_response([
        'success' => false,
        'error' => $e->getMessage(),
        'message' => 'Failed to save ads data'
    ], 500);
}
