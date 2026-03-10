<?php
/**
 * get_talktime_daily_month.php - Get daily call statistics for a specific month
 * Supports role-based access: Telesale, Supervisor, System users
 */
error_reporting(E_ALL);
ini_set("display_errors", 1);

require_once __DIR__ . "/../config.php";
require_once __DIR__ . "/../phone_utils.php";

cors();

try {
  $pdo = db_connect();
} catch (RuntimeException $e) {
  json_response(["success" => false, "error" => "Database connection failed"], 500);
}

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
  json_response(["success" => false, "error" => "Method not allowed"], 405);
}

try {
  // Get parameters
  $date = isset($_GET["date"]) ? $_GET["date"] : date("Y-m-d"); // Format: YYYY-MM-DD
  $monthStr = substr($date, 0, 7); // Extract YYYY-MM
  
  $userId = isset($_GET["user_id"]) ? intval($_GET["user_id"]) : null;
  $companyId = isset($_GET["company_id"]) ? intval($_GET["company_id"]) : null;
  $isSystem = isset($_GET["is_system"]) && $_GET["is_system"] === "1";
  
  // Build WHERE clause
  $where = "WHERE DATE_FORMAT(cl.call_date, '%Y-%m') = :month";
  $params = [":month" => $monthStr];
  
  // Join users table to filter by company or user role visibility
  $joinUsers = "JOIN users u ON u.id = cl.matched_user_id";
  
  // Filter by company_id 
  if (!empty($companyId)) {
    $where .= " AND u.company_id = :company_id";
    $params[":company_id"] = $companyId;
  }
  
  // Filter by user ID ONLY if NOT system user, or if a specific user was requested
  if (!$isSystem && !empty($userId)) {
    $where .= " AND cl.matched_user_id = :userid";
    $params[":userid"] = $userId;
  } else if ($isSystem && !empty($userId)) {
    // System user sent a user_id — check if it's actually a telesale
    $checkStmt = $pdo->prepare("SELECT role FROM users WHERE id = :uid LIMIT 1");
    $checkStmt->execute([":uid" => $userId]);
    $checkRow = $checkStmt->fetch(PDO::FETCH_ASSOC);
    $isTelesaleUser = $checkRow && stripos($checkRow["role"], "telesale") !== false;
    
    if ($isTelesaleUser) {
      $where .= " AND cl.matched_user_id = :userid";
      $params[":userid"] = $userId;
    }
    // else: user_id is admin/non-telesale → ignore filter, show ALL telesales
  }

  // Telesales only
  $where .= " AND u.role LIKE '%telesale%'";
  
  // Get daily breakdown
  $sql = "SELECT 
            DATE(cl.call_date) AS date_val,
            COUNT(*) AS total_calls,
            SUM(CASE WHEN cl.status = 1 THEN 1 ELSE 0 END) AS connected_calls,
            SUM(CASE WHEN cl.status = 1 AND TIME_TO_SEC(cl.duration) >= 40 THEN 1 ELSE 0 END) AS talked_calls,
            SUM(CASE WHEN cl.status = 0 THEN 1 ELSE 0 END) AS missed_calls,
            ROUND(COALESCE(SUM(TIME_TO_SEC(cl.duration)), 0) / 60, 2) AS total_minutes,
            ROUND(COALESCE(AVG(TIME_TO_SEC(cl.duration)), 0) / 60, 2) AS avg_minutes
          FROM call_import_logs cl
          $joinUsers
          $where
          GROUP BY DATE(cl.call_date)
          ORDER BY date_val ASC";
  
  $stmt = $pdo->prepare($sql);
  $stmt->execute($params);
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
  
  // Process results to add percentage
  $dailyData = [];
  foreach ($rows as $r) {
    $totalCalls = intval($r["total_calls"]);
    $connectedCalls = intval($r["connected_calls"]);
    $answerRate = $totalCalls > 0 ? round(($connectedCalls / $totalCalls) * 100, 2) : 0;
    
    $dailyData[] = [
      "date" => $r["date_val"], // Return original YYYY-MM-DD format
      "total_calls" => $totalCalls,
      "connected_calls" => $connectedCalls,
      "talked_calls" => intval($r["talked_calls"]),
      "missed_calls" => intval($r["missed_calls"]),
      "total_minutes" => floatval($r["total_minutes"]),
      "avg_minutes" => floatval($r["avg_minutes"]),
      "answer_rate" => $answerRate
    ];
  }
  
  json_response([
    "success" => true,
    "month" => $monthStr,
    "data" => $dailyData
  ]);

} catch (PDOException $e) {
  error_log("get_talktime_daily_month error: " . $e->getMessage());
  json_response(["success" => false, "error" => $e->getMessage()], 500);
}
?>
