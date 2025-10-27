<?php
require_once __DIR__ . '/../config.php';

cors();

try {
    $pdo = db_connect();

    // Get query parameters
    $pageId = isset($_GET['page_id']) ? (int)$_GET['page_id'] : null;
    $userId = isset($_GET['user_id']) ? (int)$_GET['user_id'] : null;
    $dateFrom = isset($_GET['date_from']) ? $_GET['date_from'] : null;
    $dateTo = isset($_GET['date_to']) ? $_GET['date_to'] : null;
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : null;
    $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;

    // Build WHERE conditions
    $whereConditions = [];
    $params = [];

    if ($pageId) {
        $whereConditions[] = "mal.page_id = ?";
        $params[] = $pageId;
    }

    if ($userId) {
        $whereConditions[] = "mal.user_id = ?";
        $params[] = $userId;
    }

    if ($dateFrom) {
        $whereConditions[] = "mal.date >= ?";
        $params[] = $dateFrom;
    }

    if ($dateTo) {
        $whereConditions[] = "mal.date <= ?";
        $params[] = $dateTo;
    }

    $whereClause = !empty($whereConditions) ? "WHERE " . implode(" AND ", $whereConditions) : "";

    // Build LIMIT clause
    $limitClause = "";
    if ($limit) {
        $limitClause = "LIMIT ? OFFSET ?";
        $params[] = $limit;
        $params[] = $offset;
    }

    // Main query with joins to get page and user details
    $sql = "
        SELECT
            mal.id,
            mal.page_id,
            mal.user_id,
            mal.date,
            mal.ads_cost,
            mal.impressions,
            mal.reach,
            mal.clicks,
            mal.created_at,
            mal.updated_at,
            p.name as page_name,
            p.platform as page_platform,
            u.username as user_username,
            CONCAT(u.first_name, ' ', u.last_name) as user_fullname
        FROM marketing_ads_log mal
        LEFT JOIN pages p ON mal.page_id = p.id
        LEFT JOIN users u ON mal.user_id = u.id
        {$whereClause}
        ORDER BY mal.date DESC, mal.created_at DESC
        {$limitClause}
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $logs = $stmt->fetchAll();

    // Get total count for pagination
    $countSql = "
        SELECT COUNT(*) as total
        FROM marketing_ads_log mal
        {$whereClause}
    ";

    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute($params);
    $totalCount = $countStmt->fetch()['total'];

    json_response([
        'success' => true,
        'data' => $logs,
        'pagination' => [
            'total' => (int)$totalCount,
            'limit' => $limit,
            'offset' => $offset,
            'has_more' => $limit ? ($offset + $limit) < $totalCount : false
        ],
        'filters' => [
            'page_id' => $pageId,
            'user_id' => $userId,
            'date_from' => $dateFrom,
            'date_to' => $dateTo
        ]
    ]);

} catch (Exception $e) {
    error_log("Error in ads_log_get.php: " . $e->getMessage());
    json_response([
        'success' => false,
        'error' => $e->getMessage(),
        'message' => 'Failed to fetch ads logs'
    ], 500);
}
