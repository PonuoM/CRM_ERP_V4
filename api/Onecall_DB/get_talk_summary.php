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
  error_log("Database connection successful for get_talk_summary.php");
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
  $threshold = 40; // seconds

  $userFirstName = null;
  $additionalWhere = "";
  $userPhone = null;
  $companyPhoneParams = [];

  if (!empty($userId)) {
    // Get user's phone, normalize to '66' format, and match onecall_log.phone_telesale
    $uStmt = $pdo->prepare("SELECT phone FROM users WHERE id = :uid LIMIT 1");
    $uStmt->execute([":uid" => $userId]);
    $row = $uStmt->fetch(PDO::FETCH_ASSOC);
    if ($row && !empty($row["phone"])) {
      $normalized = normalize_phone_to_66($row["phone"]);
      if (!empty($normalized)) {
        $userPhone = $normalized;
        $additionalWhere = " AND phone_telesale = :userphone";
      }
    }
  } elseif (!empty($userIds)) {
    // Filter by specific user IDs (supervisor team scope)
    $idList = array_filter(array_map('intval', explode(',', $userIds)));
    if (empty($idList)) {
      $additionalWhere = " AND 1=0";
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
          $additionalWhere = " AND 1=0";
      } else {
          $phPlaceholders = [];
          foreach ($phones as $i => $p) {
              $key = ":ph$i";
              $phPlaceholders[] = $key;
              $companyPhoneParams[$key] = $p;
          }
          $inQuery = implode(',', $phPlaceholders);
          $additionalWhere = " AND phone_telesale IN ($inQuery)";
      }
    }
  } elseif (!empty($companyId)) {
    // Filter by Company Users
    $usersParams = [$companyId];
    $uStmt = $pdo->prepare("SELECT phone FROM users WHERE company_id = ? AND phone IS NOT NULL AND phone != ''");
    $uStmt->execute($usersParams);
    
    $phones = [];
    while ($row = $uStmt->fetch(PDO::FETCH_ASSOC)) {
        $norm = normalize_phone_to_66($row['phone']);
        if ($norm) $phones[] = $norm;
    }

    if (empty($phones)) {
         $additionalWhere = " AND 1=0";
    } else {
         $phPlaceholders = [];
         foreach ($phones as $i => $p) {
             $key = ":ph$i";
             $phPlaceholders[] = $key;
             $companyPhoneParams[$key] = $p;
         }
         $inQuery = implode(',', $phPlaceholders);
         $additionalWhere = " AND phone_telesale IN ($inQuery)";
    }
  }

  // Use a simpler SQL query approach
  $sql = "SELECT
                SUM(CASE WHEN duration >= {$threshold} THEN 1 ELSE 0 END) AS talked,
                SUM(CASE WHEN duration < {$threshold} THEN 1 ELSE 0 END) AS not_talked
            FROM onecall_log
            WHERE YEAR(`timestamp`) = :year AND MONTH(`timestamp`) = :month
            {$additionalWhere}";

  $params = [":year" => $year, ":month" => $month];

  if (!empty($userPhone)) {
    $params[":userphone"] = $userPhone;
  }
  
  if (!empty($companyPhoneParams)) {
      $params = array_merge($params, $companyPhoneParams);
  }

  // Log SQL and parameters for debugging
  error_log("SQL Query: " . $sql);
  error_log("Parameters: " . json_encode($params));

  $stmt = $pdo->prepare($sql);
  $stmt->execute($params);
  $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: ["talked" => 0, "not_talked" => 0];

  json_response([
    "success" => true,
    "month" => $month,
    "year" => $year,
    "threshold" => $threshold,
    "data" => [
      "talked" => intval($row["talked"] ?? 0),
      "not_talked" => intval($row["not_talked"] ?? 0),
    ],
  ]);
} catch (PDOException $e) {
  error_log("Failed to retrieve talk summary: " . $e->getMessage());
  json_response(
    [
      "success" => false,
      "error" => "Failed to retrieve talk summary: " . $e->getMessage(),
    ],
    500,
  );
}
?>
