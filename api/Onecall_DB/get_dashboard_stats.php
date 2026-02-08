<?php
// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set("display_errors", 1);

// Load config file
require_once __DIR__ . "/../config.php";
require_once __DIR__ . "/../phone_utils.php";

// Set CORS headers
cors();

// Database connection using config
try {
  $pdo = db_connect();
  error_log("Database connection successful for get_dashboard_stats.php");
} catch (RuntimeException $e) {
  error_log("Database connection failed: " . $e->getMessage());
  json_response(
    [
      "success" => false,
      "error" => "Database connection failed: " . $e->getMessage(),
    ],
    500,
  );
}


// Set CORS headers
cors();

// Database connection using config
try {
  $pdo = db_connect();
  error_log("Database connection successful for get_dashboard_stats.php");
} catch (RuntimeException $e) {
  error_log("Database connection failed: " . $e->getMessage());
  json_response(
    [
      "success" => false,
      "error" => "Database connection failed: " . $e->getMessage(),
    ],
    500,
  );
}

// Only allow GET requests
if ($_SERVER["REQUEST_METHOD"] !== "GET") {
  json_response(["success" => false, "error" => "Method not allowed"], 405);
}

try {
  // Get month and year from query parameters
  $month = isset($_GET["month"]) ? intval($_GET["month"]) : intval(date("m"));
  $year = isset($_GET["year"]) ? intval($_GET["year"]) : intval(date("Y"));
  $userId = isset($_GET["user_id"]) ? intval($_GET["user_id"]) : null;
  $companyId = isset($_GET["company_id"]) ? intval($_GET["company_id"]) : null;
  $userIds = isset($_GET["user_ids"]) ? (string)$_GET["user_ids"] : null;

  // Build WHERE clause
  $whereClause = "WHERE MONTH(timestamp) = ? AND YEAR(timestamp) = ?";
  $params = [$month, $year];
  $phones = []; // Collected normalized phones for per-person avg calculation

  // If a specific user is selected, add filter for that user
  if (!empty($userId)) {
    // Get user's phone, normalize to '66' format, then match phone_telesale
    $userStmt = $pdo->prepare("SELECT phone FROM users WHERE id = ? LIMIT 1");
    $userStmt->execute([$userId]);
    $userRow = $userStmt->fetch(PDO::FETCH_ASSOC);

    if ($userRow && !empty($userRow["phone"])) {
      $normalized = normalize_phone_to_66($userRow["phone"]);
      if (!empty($normalized)) {
        $whereClause .= " AND phone_telesale = ?";
        $params[] = $normalized;
        $phones[] = $normalized;
      }
    } else {
       // User found but no phone?
       $whereClause .= " AND 1=0";
    }
  } elseif (!empty($userIds)) {
    // Filter by specific user IDs (supervisor team scope)
    $idList = array_filter(array_map('intval', explode(',', $userIds)));
    if (empty($idList)) {
      $whereClause .= " AND 1=0";
    } else {
      $inPlaceholders = implode(',', array_fill(0, count($idList), '?'));
      $uStmt = $pdo->prepare("SELECT phone FROM users WHERE id IN ($inPlaceholders) AND phone IS NOT NULL AND phone != ''");
      $uStmt->execute($idList);

      $phones = [];
      while ($row = $uStmt->fetch(PDO::FETCH_ASSOC)) {
          $norm = normalize_phone_to_66($row['phone']);
          if ($norm) $phones[] = $norm;
      }

      if (empty($phones)) {
           $whereClause .= " AND 1=0";
      } else {
           $inParams = implode(',', array_fill(0, count($phones), '?'));
           $whereClause .= " AND phone_telesale IN ($inParams)";
           foreach ($phones as $p) {
               $params[] = $p;
           }
      }
    }
  } elseif (!empty($companyId)) {
    // Filter by Company Users
    $uStmt = $pdo->prepare("SELECT phone FROM users WHERE company_id = ? AND phone IS NOT NULL AND phone != ''");
    $uStmt->execute([$companyId]);

    $phones = [];
    while ($row = $uStmt->fetch(PDO::FETCH_ASSOC)) {
        $norm = normalize_phone_to_66($row['phone']);
        if ($norm) $phones[] = $norm;
    }

    if (empty($phones)) {
         $whereClause .= " AND 1=0";
    } else {
         $inParams = implode(',', array_fill(0, count($phones), '?'));
         $whereClause .= " AND phone_telesale IN ($inParams)";
         foreach ($phones as $p) {
             $params[] = $p;
         }
    }
  }

  // Calculate total calls
  $stmt = $pdo->prepare(
    "SELECT COUNT(*) as total_calls FROM onecall_log $whereClause"
  );
  $stmt->execute($params);
  $totalCalls = $stmt->fetch(PDO::FETCH_ASSOC)["total_calls"];

  // Calculate answered calls (duration >= 40 seconds = connected/talked)
  $stmt = $pdo->prepare(
    "SELECT COUNT(*) as answered_calls FROM onecall_log $whereClause AND duration >= 40"
  );
  $stmt->execute($params);
  $answeredCalls = $stmt->fetch(PDO::FETCH_ASSOC)["answered_calls"];

  // Calculate total duration in seconds and convert to minutes directly in SQL
  $stmt = $pdo->prepare(
    "SELECT SUM(duration) / 60 as total_duration_minutes FROM onecall_log $whereClause",
  );
  $stmt->execute($params);
  $totalMinutes = floor(
    $stmt->fetch(PDO::FETCH_ASSOC)["total_duration_minutes"] ?: 0,
  );

  // Calculate average minutes per call: average-of-per-person-averages
  // Each person: their_minutes / their_answered_calls → then average across all people
  $avgMinutesPerCall = 0;
  if (!empty($phones)) {
    $phIn = implode(',', array_fill(0, count($phones), '?'));
    $perPersonSql = "SELECT phone_telesale,
        SUM(duration) / 60.0 AS person_minutes,
        SUM(CASE WHEN duration >= 40 THEN 1 ELSE 0 END) AS person_answered
      FROM onecall_log
      WHERE MONTH(timestamp) = ? AND YEAR(timestamp) = ?
        AND phone_telesale IN ($phIn)
      GROUP BY phone_telesale";
    $ppParams = array_merge([$month, $year], $phones);
    $ppStmt = $pdo->prepare($perPersonSql);
    $ppStmt->execute($ppParams);

    $personAvgs = [];
    while ($row = $ppStmt->fetch(PDO::FETCH_ASSOC)) {
      if ($row['person_answered'] > 0) {
        $personAvgs[] = $row['person_minutes'] / $row['person_answered'];
      }
    }
    if (!empty($personAvgs)) {
      $avgMinutesPerCall = round(array_sum($personAvgs) / count($personAvgs), 2);
    }
  }

  // Return success response with stats
  json_response([
    "success" => true,
    "data" => [
      "totalCalls" => $totalCalls,
      "answeredCalls" => $answeredCalls,
      "totalMinutes" => $totalMinutes,
      "avgMinutes" => $avgMinutesPerCall,
    ],
  ]);
} catch (PDOException $e) {
  error_log("Failed to retrieve dashboard stats: " . $e->getMessage());
  json_response(
    [
      "success" => false,
      "error" => "Failed to retrieve dashboard stats: " . $e->getMessage(),
    ],
    500,
  );
}
?>
