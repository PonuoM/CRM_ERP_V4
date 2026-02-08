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
  error_log("Database connection successful for get_daily_calls.php");
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
  $month = isset($_GET["month"]) ? intval($_GET["month"]) : intval(date("m"));
  $year = isset($_GET["year"]) ? intval($_GET["year"]) : intval(date("Y"));
  $userId = isset($_GET["user_id"]) ? intval($_GET["user_id"]) : null;
  $companyId = isset($_GET["company_id"]) ? intval($_GET["company_id"]) : null;
  $userIds = isset($_GET["user_ids"]) ? (string)$_GET["user_ids"] : null;

  $params = [":year" => $year, ":month" => $month];
  $userPhone = null;

  $where = "WHERE YEAR(`timestamp`) = :year AND MONTH(`timestamp`) = :month";

  if (!empty($userId)) {
    // Get user's phone, normalize to '66' format, and match onecall_log.phone_telesale
    $uStmt = $pdo->prepare("SELECT phone FROM users WHERE id = :uid LIMIT 1");
    $uStmt->execute([":uid" => $userId]);
    $row = $uStmt->fetch(PDO::FETCH_ASSOC);
    if ($row && !empty($row["phone"])) {
      $normalized = normalize_phone_to_66($row["phone"]);
      if (!empty($normalized)) {
        $where .= " AND phone_telesale = :userphone";
        $params[":userphone"] = $normalized;
      }
    } else {
      // If user not found (or has no phone), return zeroed days
      // If user not found, return zeroed days for month
      $daysInMonth = cal_days_in_month(CAL_GREGORIAN, $month, $year);
      $empty = [];
      for ($d = 1; $d <= $daysInMonth; $d++) {
        $dateStr = sprintf("%04d-%02d-%02d", $year, $month, $d);
        $empty[] = ["date" => $dateStr, "count" => 0, "total_minutes" => 0];
      }
      json_response([
        "success" => true,
        "year" => $year,
        "month" => $month,
        "data" => $empty,
      ]);
      exit();
    }
  } elseif (!empty($userIds)) {
    // Filter by specific user IDs (supervisor team scope)
    $idList = array_filter(array_map('intval', explode(',', $userIds)));
    if (empty($idList)) {
        $where .= " AND 1=0";
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
            $where .= " AND 1=0";
        } else {
            $phPlaceholders = [];
            foreach ($phones as $i => $p) {
                $key = ":ph$i";
                $phPlaceholders[] = $key;
                $params[$key] = $p;
            }
            $inQuery = implode(',', $phPlaceholders);
            $where .= " AND phone_telesale IN ($inQuery)";
        }
    }
  } elseif (!empty($companyId)) {
    // Filter by Company
    $usersParams = [$companyId];
    $uStmt = $pdo->prepare("SELECT phone FROM users WHERE company_id = ? AND phone IS NOT NULL AND phone != ''");
    $uStmt->execute($usersParams);
    
    $phones = [];
    while ($row = $uStmt->fetch(PDO::FETCH_ASSOC)) {
        $norm = normalize_phone_to_66($row['phone']);
        if ($norm) $phones[] = $norm;
    }
    
    if (empty($phones)) {
        $where .= " AND 1=0";
    } else {
        $phPlaceholders = [];
        foreach ($phones as $i => $p) {
            $key = ":ph$i";
            $phPlaceholders[] = $key;
            $params[$key] = $p;
        }
        $inQuery = implode(',', $phPlaceholders);
        $where .= " AND phone_telesale IN ($inQuery)";
    }
  }

  $sql = "SELECT DATE(`timestamp`) AS d, COUNT(*) AS cnt, FLOOR(SUM(duration)/60) AS total_min
            FROM onecall_log
            $where
            GROUP BY DATE(`timestamp`)
            ORDER BY d";
  $stmt = $pdo->prepare($sql);
  $stmt->execute($params);
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
  
  $byDate = [];
  foreach ($rows as $r) {
    $dateKey = substr($r["d"], 0, 10); // YYYY-MM-DD
    $byDate[$dateKey] = [
      "date" => $dateKey,
      "count" => intval($r["cnt"]),
      "total_minutes" => intval($r["total_min"] ?? 0),
    ];
  }

  $daysInMonth = cal_days_in_month(CAL_GREGORIAN, $month, $year);
  $result = [];
  for ($d = 1; $d <= $daysInMonth; $d++) {
    $dateStr = sprintf("%04d-%02d-%02d", $year, $month, $d);
    if (isset($byDate[$dateStr])) {
      $result[] = $byDate[$dateStr];
    } else {
      $result[] = ["date" => $dateStr, "count" => 0, "total_minutes" => 0];
    }
  }

  json_response([
    "success" => true,
    "year" => $year,
    "month" => $month,
    "data" => $result,
  ]);
} catch (PDOException $e) {
  error_log("Failed to retrieve daily calls: " . $e->getMessage());
  json_response(
    [
      "success" => false,
      "error" => "Failed to retrieve daily calls: " . $e->getMessage(),
    ],
    500,
  );
}
?>
