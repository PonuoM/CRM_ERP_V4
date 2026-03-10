<?php
/**
 * get_talktime_hourly.php - Get hourly call statistics for Talk Time Dashboard
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
  $date = isset($_GET["date"]) ? $_GET["date"] : date("Y-m-d");
  $userId = isset($_GET["user_id"]) ? intval($_GET["user_id"]) : null;
  $requestingUserId = isset($_GET["requesting_user_id"]) ? intval($_GET["requesting_user_id"]) : null;
  $companyId = isset($_GET["company_id"]) ? intval($_GET["company_id"]) : null;
  $isSystem = isset($_GET["is_system"]) && $_GET["is_system"] === "1";
  
  // Debug logging
  error_log("=== Talk Time API Debug ===");
  error_log("Date: " . $date);
  error_log("User ID: " . ($userId ?? "null"));
  error_log("Company ID: " . ($companyId ?? "null"));
  error_log("Is System: " . ($isSystem ? "YES" : "NO"));
  
  // Build WHERE clause
  $where = "WHERE DATE(cl.call_date) = :date";
  $params = [":date" => $date];
  
  // Need to join users table to filter by company or user role visibility
  $joinUsers = "JOIN users u ON u.id = cl.matched_user_id";
  
  // Filter by company_id 
  if (!empty($companyId)) {
    $where .= " AND u.company_id = :company_id";
    $params[":company_id"] = $companyId;
    error_log("Added company filter: " . $companyId);
  }
  
  // Filter by user ID ONLY if NOT system user, or if a specific user was requested
  if (!$isSystem && !empty($userId)) {
    $where .= " AND cl.matched_user_id = :userid";
    $params[":userid"] = $userId;
    error_log("Added user ID filter: " . $userId);
  } else if ($isSystem && !empty($userId)) {
    // System user sent a user_id — check if it's actually a telesale
    $checkStmt = $pdo->prepare("SELECT role FROM users WHERE id = :uid LIMIT 1");
    $checkStmt->execute([":uid" => $userId]);
    $checkRow = $checkStmt->fetch(PDO::FETCH_ASSOC);
    $isTelesaleUser = $checkRow && stripos($checkRow["role"], "telesale") !== false;
    
    if ($isTelesaleUser) {
      // Specific telesale user selected from dropdown
      $where .= " AND cl.matched_user_id = :userid";
      $params[":userid"] = $userId;
      error_log("System user selected specific telesale: " . $userId);
    } else {
      // user_id is admin/CEO/non-telesale → ignore filter, show ALL telesales
      error_log("System user sent non-telesale user_id ($userId), ignoring filter - showing ALL");
    }
  } else if ($isSystem) {
    error_log("System user - NO user ID filter, showing ALL company data");
  }

  // Telesales only
  $where .= " AND u.role LIKE '%telesale%'";
  
  error_log("Final WHERE: " . $where);
  error_log("Params: " . json_encode($params));
  
  // Get hourly breakdown with company filtering
  $sql = "SELECT 
            HOUR(cl.start_time) AS hour,
            COUNT(*) AS total_calls,
            SUM(CASE WHEN cl.status = 1 AND TIME_TO_SEC(cl.duration) >= 40 THEN 1 ELSE 0 END) AS talked_calls,
            ROUND(COALESCE(SUM(TIME_TO_SEC(cl.duration)), 0) / 60, 2) AS total_minutes,
            ROUND(COALESCE(AVG(TIME_TO_SEC(cl.duration)), 0) / 60, 2) AS avg_minutes
          FROM call_import_logs cl
          $joinUsers
          $where
          GROUP BY HOUR(cl.start_time)
          ORDER BY hour";
  
  error_log("SQL Query: " . $sql);
  error_log("SQL Params: " . json_encode($params));
  
  $stmt = $pdo->prepare($sql);
  $stmt->execute($params);
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
  
  error_log("Query returned " . count($rows) . " hourly rows");
  
  // Test query without company filter to see if data exists
  $testSQL = "SELECT COUNT(*) as total FROM call_import_logs WHERE DATE(call_date) = :date";
  $testStmt = $pdo->prepare($testSQL);
  $testStmt->execute([":date" => $date]);
  $testResult = $testStmt->fetch(PDO::FETCH_ASSOC);
  error_log("Total logs for date (no filter): " . $testResult["total"]);
  
  // Fill all 24 hours
  $hourlyData = [];
  for ($h = 0; $h < 24; $h++) {
    $hourlyData[$h] = [
      "hour" => $h,
      "label" => sprintf("%02d:00-%02d:00", $h, ($h + 1) % 24),
      "total_calls" => 0,
      "talked_calls" => 0,
      "total_minutes" => 0,
      "avg_minutes" => 0
    ];
  }
  
  foreach ($rows as $r) {
    $h = intval($r["hour"]);
    $hourlyData[$h] = [
      "hour" => $h,
      "label" => sprintf("%02d:00-%02d:00", $h, ($h + 1) % 24),
      "total_calls" => intval($r["total_calls"]),
      "talked_calls" => intval($r["talked_calls"]),
      "total_minutes" => floatval($r["total_minutes"]),
      "avg_minutes" => floatval($r["avg_minutes"])
    ];
  }
  
  // Get daily summary stats with company filtering
  $summarySQL = "SELECT 
                  COUNT(*) AS total_calls,
                  SUM(CASE WHEN cl.status = 1 AND TIME_TO_SEC(cl.duration) >= 40 THEN 1 ELSE 0 END) AS talked_calls,
                  ROUND(COALESCE(SUM(TIME_TO_SEC(cl.duration)), 0) / 60, 2) AS total_minutes,
                  ROUND(COALESCE(AVG(TIME_TO_SEC(cl.duration)), 0) / 60, 2) AS avg_minutes,
                  ROUND(COALESCE(AVG(CASE WHEN cl.status = 1 AND TIME_TO_SEC(cl.duration) >= 40 THEN TIME_TO_SEC(cl.duration) ELSE NULL END), 0) / 60, 2) AS avg_talk_minutes
                FROM call_import_logs cl
                $joinUsers
                $where";
  
  $summaryStmt = $pdo->prepare($summarySQL);
  $summaryStmt->execute($params);
  $summary = $summaryStmt->fetch(PDO::FETCH_ASSOC);
  
  // Calculate idle time between calls (approximation) with company filtering
  $idleSQL = "SELECT 
                TIMESTAMPDIFF(SECOND, LAG(cl.start_time) OVER (ORDER BY cl.start_time), cl.start_time) AS gap
              FROM call_import_logs cl
              $joinUsers
              $where
              ORDER BY cl.start_time";
  $idleStmt = $pdo->prepare($idleSQL);
  $idleStmt->execute($params);
  $gaps = $idleStmt->fetchAll(PDO::FETCH_COLUMN);
  
  $validGaps = array_filter($gaps, function($g) { return $g !== null && $g > 0 && $g < 3600; }); // Max 1 hour gap
  $avgIdleMinutes = count($validGaps) > 0 ? round(array_sum($validGaps) / count($validGaps) / 60, 2) : 0;
  
  json_response([
    "success" => true,
    "date" => $date,
    "summary" => [
      "total_calls" => intval($summary["total_calls"] ?? 0),
      "talked_calls" => intval($summary["talked_calls"] ?? 0),
      "total_minutes" => floatval($summary["total_minutes"] ?? 0),
      "avg_minutes" => floatval($summary["avg_minutes"] ?? 0),
      "avg_talk_minutes" => floatval($summary["avg_talk_minutes"] ?? 0),
      "avg_idle_minutes" => $avgIdleMinutes
    ],
    "hourly" => array_values($hourlyData)
  ]);

} catch (PDOException $e) {
  error_log("get_talktime_hourly error: " . $e->getMessage());
  json_response(["success" => false, "error" => $e->getMessage()], 500);
}
?>
