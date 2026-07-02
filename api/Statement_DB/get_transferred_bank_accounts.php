<?php
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
  http_response_code(204);
  exit();
}

require_once dirname(__DIR__) . "/config.php";

/**
 * รายชื่อบัญชีธนาคาร (ของบริษัทอื่น) ที่มี statement ถูกโอนสิทธิ์มาให้บริษัทนี้
 * ใช้เติมใน dropdown เลือกธนาคารของหน้า Bank Account Audit ฝั่งบริษัทผู้รับโอน
 *
 * GET ?company_id=X
 */

$companyId = isset($_GET["company_id"]) ? (int) $_GET["company_id"] : 0;
if ($companyId <= 0) {
  echo json_encode(["ok" => false, "error" => "company_id is required"], JSON_UNESCAPED_UNICODE);
  exit();
}

try {
  $pdo = db_connect();

  // Transfer columns may not exist yet on older DBs
  try {
    $pdo->query("SELECT assigned_company_id FROM statement_logs LIMIT 0");
  } catch (PDOException $e) {
    echo json_encode(["ok" => true, "data" => []], JSON_UNESCAPED_UNICODE);
    exit();
  }

  $stmt = $pdo->prepare("
    SELECT DISTINCT
      ba.id,
      ba.bank,
      ba.bank_number,
      c.name AS owner_company_name,
      sb.company_id AS owner_company_id
    FROM statement_logs sl
    INNER JOIN statement_batchs sb ON sb.id = sl.batch_id
    INNER JOIN bank_account ba ON ba.id = sl.bank_account_id
    LEFT JOIN companies c ON c.id = sb.company_id
    WHERE sl.assigned_company_id = :companyId
      AND sb.company_id <> :companyId2
    ORDER BY ba.bank, ba.bank_number
  ");
  $stmt->execute([":companyId" => $companyId, ":companyId2" => $companyId]);
  $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

  echo json_encode(["ok" => true, "data" => $rows], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Exception $e) {
  http_response_code(500);
  echo json_encode(["ok" => false, "error" => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
?>
