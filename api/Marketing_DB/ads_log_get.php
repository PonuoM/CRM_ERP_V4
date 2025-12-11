<?php
require_once __DIR__ . "/../config.php";

cors();

try {
  $pdo = db_connect();

  // Get query parameters
  $pageId = isset($_GET["page_id"]) ? (int) $_GET["page_id"] : null;
  $pageIds = isset($_GET["page_ids"]) ? $_GET["page_ids"] : null;
  $userId = isset($_GET["user_id"]) ? (int) $_GET["user_id"] : null;
  $dateFrom = isset($_GET["date_from"]) ? $_GET["date_from"] : null;
  $dateTo = isset($_GET["date_to"]) ? $_GET["date_to"] : null;
  $limit = isset($_GET["limit"]) ? (int) $_GET["limit"] : null;
  $offset = isset($_GET["offset"]) ? (int) $_GET["offset"] : 0;

  // Build WHERE conditions
  $whereConditions = [];
  $params = [];

  if ($pageId) {
    $whereConditions[] = "mal.page_id = ?";
    $params[] = $pageId;
  } elseif ($pageIds) {
    $pageIdArray = explode(",", $pageIds);
    $pageIdArray = array_map("intval", $pageIdArray);
    $pageIdArray = array_filter($pageIdArray);
    if (!empty($pageIdArray)) {
      $placeholders = str_repeat("?,", count($pageIdArray) - 1) . "?";
      $whereConditions[] = "mal.page_id IN ($placeholders)";
      $params = array_merge($params, $pageIdArray);
    }
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

  // Authenticate user via Token
  $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
  if (!$auth && function_exists('getallheaders')) {
      $headers = getallheaders();
      $auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';
  }
  if (!$auth && isset($_GET['token'])) {
      $auth = 'Bearer ' . $_GET['token'];
  }

  $currentUser = null;
  $userRole = '';
  $currentUserId = 0;

  if (preg_match('/Bearer\s+(\S+)/', $auth, $matches)) {
    $token = $matches[1];
    // Check token
    $stmt = $pdo->prepare("
      SELECT u.id, u.role, u.username, u.first_name, u.last_name, u.company_id
      FROM user_tokens ut
      JOIN users u ON ut.user_id = u.id
      WHERE ut.token = ? AND ut.expires_at > NOW()
    ");
    $stmt->execute([$token]);
    $currentUser = $stmt->fetch();
    
    if ($currentUser) {
      $currentUserId = $currentUser['id'];
      $userRole = $currentUser['role'];
      $currentUserCompanyId = $currentUser['company_id'];
    }
  }

  // Fallback to session if no token (legacy/testing support)
  if (!$currentUser && session_status() === PHP_SESSION_NONE) {
    session_start();
    if (isset($_SESSION['user'])) {
      $currentUser = $_SESSION['user'];
      $currentUserId = $currentUser['id'];
      $userRole = $currentUser['role'];
      $currentUserCompanyId = $currentUser['company_id'] ?? null;
    }
  }

  // Check user permissions (Bypass for Super Admin and Admin Control)
  if (!in_array($userRole, ['Super Admin', 'Admin Control'])) {
      if (!$currentUserId) {
        // Not logged in or invalid token -> Return empty or 401
        // We return empty to avoid breaking UI if it expects data
          json_response([
              "success" => true,
              "data" => [],
              "pagination" => [
                  "total" => 0,
                  "limit" => $limit,
                  "offset" => $offset,
                  "page_size" => $limit ?: 10,
                  "current_page" => 1,
                  "total_pages" => 1,
                  "has_more" => false,
                  "has_previous" => false,
              ]
          ]);
          exit;
      }

      // Get allowed pages
      $permStmt = $pdo->prepare("SELECT page_id FROM marketing_user_page WHERE user_id = ?");
      $permStmt->execute([$currentUserId]);
      $allowedPageIds = $permStmt->fetchAll(PDO::FETCH_COLUMN);

      if (empty($allowedPageIds)) {
          // No allowed pages
          json_response([
              "success" => true,
              "data" => [],
              "pagination" => [
                  "total" => 0,
                  "limit" => $limit,
                  "offset" => $offset,
                  "page_size" => $limit ?: 10,
                  "current_page" => 1,
                  "total_pages" => 1,
                  "has_more" => false,
                  "has_previous" => false,
              ]
          ]);
          exit;
      }

      // Add permission condition
      $placeholders = str_repeat("?,", count($allowedPageIds) - 1) . "?";
      $whereConditions[] = "mal.page_id IN ($placeholders)";
      $params = array_merge($params, $allowedPageIds);
  }

  // Always filter by company_id via joined pages table (p.company_id)
  // Ensure we join pages table in count query too
  if (isset($currentUserCompanyId)) {
      $whereConditions[] = "p.company_id = ?";
      $params[] = $currentUserCompanyId;
  }

  $whereClause = !empty($whereConditions)
    ? "WHERE " . implode(" AND ", $whereConditions)
    : "";

  // Capture params for count query (before LIMIT/OFFSET are added)
  $countParams = $params;

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

  // Get total count for pagination (use same WHERE conditions but without LIMIT/OFFSET)
  // Get total count for pagination (use same WHERE conditions but without LIMIT/OFFSET)
  // $countParams is already captured above

  $countSql = "
      SELECT COUNT(*) as total
      FROM marketing_ads_log mal
      LEFT JOIN pages p ON mal.page_id = p.id
      LEFT JOIN users u ON mal.user_id = u.id
      {$whereClause}
  ";

  $countStmt = $pdo->prepare($countSql);
  $countStmt->execute($countParams);
  $totalCount = $countStmt->fetch()["total"];

  // Calculate pagination info
  $pageSize = $limit ?: 10; // Default page size if not specified
  $totalPages = $pageSize > 0 ? ceil($totalCount / $pageSize) : 1;
  $currentPage = $pageSize > 0 ? floor($offset / $pageSize) + 1 : 1;

  json_response([
    "success" => true,
    "data" => $logs,
    "pagination" => [
      "total" => (int) $totalCount,
      "limit" => $limit,
      "offset" => $offset,
      "page_size" => $pageSize,
      "current_page" => (int) $currentPage,
      "total_pages" => (int) $totalPages,
      "has_more" => $limit ? $offset + $limit < $totalCount : false,
      "has_previous" => $offset > 0,
    ],
    "filters" => [
      "page_id" => $pageId,
      "page_ids" => $pageIds,
      "user_id" => $userId,
      "date_from" => $dateFrom,
      "date_to" => $dateTo,
    ],
  ]);
} catch (Exception $e) {
  error_log("Error in ads_log_get.php: " . $e->getMessage());
  json_response(
    [
      "success" => false,
      "error" => $e->getMessage(),
      "message" => "Failed to fetch ads logs",
    ],
    500,
  );
}
