<?php
/**
 * get_team_users.php - Get users for Talk Time Dashboard dropdown
 * Role-based: Telesale sees self, Supervisor sees team, System sees all
 */
error_reporting(E_ALL);
ini_set("display_errors", 1);

require_once __DIR__ . "/../config.php";

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
  $userId = isset($_GET["user_id"]) ? intval($_GET["user_id"]) : null;
  $companyId = isset($_GET["company_id"]) ? intval($_GET["company_id"]) : null;
  $role = isset($_GET["role"]) ? $_GET["role"] : null;
  $isSystem = isset($_GET["is_system"]) && $_GET["is_system"] === "1";
  
  if (!$userId || !$companyId) {
    json_response(["success" => false, "error" => "user_id and company_id required"], 400);
  }
  
  $users = [];
  
  if ($isSystem) {
    // System user: can see all Telesale and Supervisor Telesale in same company
    $stmt = $pdo->prepare("
      SELECT id, first_name, last_name, phone, role, supervisor_id 
      FROM users 
      WHERE company_id = :cid 
        AND status = 'active'
        AND (role = 'Telesale' OR role = 'Supervisor Telesale')
      ORDER BY first_name, last_name
    ");
    $stmt->execute([":cid" => $companyId]);
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
  } elseif ($role === "Supervisor Telesale") {
    // Supervisor: see self + team members (only Telesale roles)
    $stmt = $pdo->prepare("
      SELECT id, first_name, last_name, phone, role, supervisor_id 
      FROM users 
      WHERE (id = :uid1 OR supervisor_id = :uid2) 
        AND company_id = :cid 
        AND status = 'active'
        AND (role = 'Telesale' OR role = 'Supervisor Telesale')
      ORDER BY 
        CASE WHEN id = :uid3 THEN 0 ELSE 1 END,
        first_name, last_name
    ");
    $stmt->execute([
      ":uid1" => $userId, 
      ":uid2" => $userId, 
      ":uid3" => $userId, 
      ":cid" => $companyId
    ]);
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
  } else {
    // Telesale: see only self
    $stmt = $pdo->prepare("
      SELECT id, first_name, last_name, phone, role, supervisor_id 
      FROM users 
      WHERE id = :uid AND company_id = :cid
    ");
    $stmt->execute([":uid" => $userId, ":cid" => $companyId]);
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
  }
  
  // Format response
  $formatted = array_map(function($u) {
    return [
      "id" => intval($u["id"]),
      "name" => trim($u["first_name"] . " " . $u["last_name"]),
      "phone" => $u["phone"] ?? null, // Handle NULL phone
      "role" => $u["role"] ?? ""
    ];
  }, $users);
  
  json_response([
    "success" => true,
    "users" => $formatted,
    "count" => count($formatted)
  ]);

} catch (PDOException $e) {
  error_log("get_team_users error: " . $e->getMessage());
  json_response(["success" => false, "error" => $e->getMessage()], 500);
}
?>
