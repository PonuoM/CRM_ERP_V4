<?php
// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set("display_errors", 1);

// Load config file
require_once __DIR__ . "/../config.php";

// Set CORS headers
cors();

// Database connection using config
try {
  $pdo = db_connect();
  error_log("Database connection successful for get_monthly_calls.php");
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
  $year = isset($_GET["year"]) ? intval($_GET["year"]) : intval(date("Y"));
  $userId = isset($_GET["user_id"]) ? intval($_GET["user_id"]) : null;

  $params = [":year" => $year];
  $userFirstName = null;

  if (!empty($userId)) {
    // Map user_id to first_name to match onecall_log.phone_telesale
    $uStmt = $pdo->prepare(
      "SELECT first_name FROM users WHERE id = :uid LIMIT 1",
    );
    $uStmt->execute([":uid" => $userId]);
    $row = $uStmt->fetch(PDO::FETCH_ASSOC);
    if ($row && !empty($row["first_name"])) {
      $userFirstName = $row["first_name"];
    } else {
      // If user not found, return empty data for all months
      $empty = [];
      for ($m = 1; $m <= 12; $m++) {
        $empty[] = ["month" => $m, "count" => 0, "total_minutes" => 0];
      }
      json_response([
        "success" => true,
        "year" => $year,
        "data" => $empty,
      ]);
      exit();
    }
  } elseif (!empty($companyId)) {
    // Filter by Company Users (Phone based)
    $usersParams = [$companyId];
    $uStmt = $pdo->prepare("SELECT phone FROM users WHERE company_id = ? AND phone IS NOT NULL AND phone != ''");
    $uStmt->execute($usersParams);
    
    $phones = [];
    while ($row = $uStmt->fetch(PDO::FETCH_ASSOC)) {
        $norm = normalize_phone_to_66($row['phone']);
        if ($norm) $phones[] = $norm;
    }

    if (empty($phones)) {
         // No valid phones in company -> empty result
         $empty = [];
         for ($m = 1; $m <= 12; $m++) {
           $empty[] = ["month" => $m, "count" => 0, "total_minutes" => 0];
         }
         json_response([
           "success" => true,
           "year" => $year,
           "data" => $empty,
         ]);
         exit();
    } else {
         $companyPhones = $phones;
    }
  }

  $where = "WHERE YEAR(`timestamp`) = :year";
  if ($userFirstName !== null) {
    $where .= " AND phone_telesale = :firstname";
    $params[":firstname"] = $userFirstName;
  } elseif (!empty($companyPhones)) {
    $phPlaceholders = [];
    foreach ($companyPhones as $i => $p) {
        $key = ":ph$i";
        $phPlaceholders[] = $key;
        $params[$key] = $p;
    }
    $inQuery = implode(',', $phPlaceholders);
    $where .= " AND phone_telesale IN ($inQuery)";
  }

  // Aggregate by month
  $sql = "SELECT MONTH(`timestamp`) AS m, COUNT(*) AS cnt, FLOOR(SUM(duration)/60) AS total_min
            FROM onecall_log
            $where
            GROUP BY MONTH(`timestamp`)
            ORDER BY m";
  $stmt = $pdo->prepare($sql);
  $stmt->execute($params);
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

  // Normalize to 12 months
  $byMonth = [];
  foreach ($rows as $r) {
    $byMonth[intval($r["m"])] = [
      "month" => intval($r["m"]),
      "count" => intval($r["cnt"]),
      "total_minutes" => intval($r["total_min"] ?? 0),
    ];
  }

  $result = [];
  for ($m = 1; $m <= 12; $m++) {
    if (isset($byMonth[$m])) {
      $result[] = $byMonth[$m];
    } else {
      $result[] = ["month" => $m, "count" => 0, "total_minutes" => 0];
    }
  }

  json_response(["success" => true, "year" => $year, "data" => $result]);
} catch (PDOException $e) {
  error_log("Failed to retrieve monthly calls: " . $e->getMessage());
  json_response(
    [
      "success" => false,
      "error" => "Failed to retrieve monthly calls: " . $e->getMessage(),
    ],
    500,
  );
}
?>
