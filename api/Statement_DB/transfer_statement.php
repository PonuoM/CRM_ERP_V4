<?php
header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER["REQUEST_METHOD"] === "OPTIONS") {
  http_response_code(204);
  exit();
}

require_once dirname(__DIR__) . "/config.php";

/**
 * โอนสิทธิ์ statement ให้บริษัทอื่น / ยกเลิกการโอน
 *
 * POST { action: 'transfer', statement_log_id, company_id, user_id, target_company_id, note? }
 * POST { action: 'cancel',   statement_log_id, company_id, user_id }
 *
 * กติกา:
 * - โอนได้เฉพาะ statement ที่ยัง Unmatched (ไม่มี reconcile log และไม่ถูก match กับ COD)
 * - ผู้โอนต้องเป็นเจ้าของสิทธิ์ปัจจุบัน: COALESCE(assigned_company_id, batch.company_id)
 * - ยกเลิกโอนได้ทั้งบริษัทต้นทาง (batch owner) และบริษัทที่ถือสิทธิ์อยู่ ตราบใดที่ยังไม่ผูก
 */

function ensure_statement_transfer_columns(PDO $pdo): void
{
  foreach (
    [
      "ALTER TABLE statement_logs ADD COLUMN assigned_company_id INT NULL DEFAULT NULL AFTER bank_display_name",
      "ALTER TABLE statement_logs ADD COLUMN assigned_by INT NULL DEFAULT NULL AFTER assigned_company_id",
      "ALTER TABLE statement_logs ADD COLUMN assigned_at DATETIME NULL DEFAULT NULL AFTER assigned_by",
      "ALTER TABLE statement_logs ADD COLUMN assign_note VARCHAR(255) NULL DEFAULT NULL AFTER assigned_at",
      "ALTER TABLE statement_logs ADD INDEX idx_statement_logs_assigned_company (assigned_company_id, transfer_at)",
    ] as $ddl
  ) {
    try {
      $pdo->exec($ddl);
    } catch (PDOException $e) {
      // Column/index already exists
    }
  }
}

$payload = json_decode(file_get_contents("php://input"), true);
$action = isset($payload["action"]) ? trim($payload["action"]) : "";
$statementLogId = isset($payload["statement_log_id"]) ? (int) $payload["statement_log_id"] : 0;
$companyId = isset($payload["company_id"]) ? (int) $payload["company_id"] : 0;
$userId = isset($payload["user_id"]) ? (int) $payload["user_id"] : 0;
$targetCompanyId = isset($payload["target_company_id"]) ? (int) $payload["target_company_id"] : 0;
$note = isset($payload["note"]) ? trim($payload["note"]) : null;

if (!in_array($action, ["transfer", "cancel"], true) || $statementLogId <= 0 || $companyId <= 0 || $userId <= 0) {
  echo json_encode(["ok" => false, "error" => "action, statement_log_id, company_id, user_id are required"], JSON_UNESCAPED_UNICODE);
  exit();
}
if ($action === "transfer" && $targetCompanyId <= 0) {
  echo json_encode(["ok" => false, "error" => "target_company_id is required for transfer"], JSON_UNESCAPED_UNICODE);
  exit();
}

try {
  $pdo = db_connect();
  $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
  ensure_statement_transfer_columns($pdo);

  $pdo->beginTransaction();
  set_audit_context($pdo, 'statement/transfer_statement');

  // Lock statement row to prevent race with reconcile/transfer from another session
  $stmtFetch = $pdo->prepare("
    SELECT sl.id, sl.amount, sl.assigned_company_id, sb.company_id AS owner_company_id
    FROM statement_logs sl
    INNER JOIN statement_batchs sb ON sb.id = sl.batch_id
    WHERE sl.id = :id
    FOR UPDATE
  ");
  $stmtFetch->execute([":id" => $statementLogId]);
  $stmt = $stmtFetch->fetch(PDO::FETCH_ASSOC);
  if (!$stmt) {
    throw new RuntimeException("Statement not found");
  }

  $ownerCompanyId = (int) $stmt["owner_company_id"];
  $assignedCompanyId = $stmt["assigned_company_id"] !== null ? (int) $stmt["assigned_company_id"] : null;
  $effectiveCompanyId = $assignedCompanyId ?: $ownerCompanyId;

  // Statement must still be Unmatched (no reconcile logs, no COD match)
  $reconCheck = $pdo->prepare("SELECT COUNT(*) FROM statement_reconcile_logs WHERE statement_log_id = :id");
  $reconCheck->execute([":id" => $statementLogId]);
  $hasRecon = ((int) $reconCheck->fetchColumn()) > 0;

  $codCheck = $pdo->prepare("SELECT COUNT(*) FROM cod_documents WHERE matched_statement_log_id = :id");
  $codCheck->execute([":id" => $statementLogId]);
  $hasCod = ((int) $codCheck->fetchColumn()) > 0;

  if ($hasRecon || $hasCod) {
    throw new RuntimeException("Statement นี้ถูกผูกกับออเดอร์/COD แล้ว ต้องยกเลิกการผูกก่อนจึงจะโอนหรือยกเลิกโอนได้");
  }

  if ($action === "transfer") {
    // Only the current rights holder can transfer
    if ($companyId !== $effectiveCompanyId) {
      throw new RuntimeException("บริษัทของคุณไม่ใช่ผู้ถือสิทธิ์ statement นี้ในปัจจุบัน");
    }
    if ($targetCompanyId === $effectiveCompanyId) {
      throw new RuntimeException("บริษัทปลายทางเป็นผู้ถือสิทธิ์อยู่แล้ว");
    }

    // Validate target company exists
    $companyCheck = $pdo->prepare("SELECT id, name FROM companies WHERE id = :id");
    $companyCheck->execute([":id" => $targetCompanyId]);
    $targetCompany = $companyCheck->fetch(PDO::FETCH_ASSOC);
    if (!$targetCompany) {
      throw new RuntimeException("ไม่พบบริษัทปลายทาง");
    }

    // Transferring back to original owner = same as cancelling the assignment
    if ($targetCompanyId === $ownerCompanyId) {
      $update = $pdo->prepare("
        UPDATE statement_logs
        SET assigned_company_id = NULL, assigned_by = NULL, assigned_at = NULL, assign_note = NULL
        WHERE id = :id
      ");
      $update->execute([":id" => $statementLogId]);
    } else {
      $update = $pdo->prepare("
        UPDATE statement_logs
        SET assigned_company_id = :target, assigned_by = :userId, assigned_at = NOW(), assign_note = :note
        WHERE id = :id
      ");
      $update->execute([
        ":target" => $targetCompanyId,
        ":userId" => $userId,
        ":note" => ($note !== null && $note !== "") ? $note : null,
        ":id" => $statementLogId,
      ]);
    }

    $pdo->commit();
    echo json_encode([
      "ok" => true,
      "action" => "transfer",
      "statement_log_id" => $statementLogId,
      "target_company_id" => $targetCompanyId,
      "target_company_name" => $targetCompany["name"],
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  } else {
    // cancel — allowed by the original owner or the current holder
    if ($assignedCompanyId === null) {
      throw new RuntimeException("Statement นี้ไม่ได้ถูกโอนอยู่");
    }
    if ($companyId !== $ownerCompanyId && $companyId !== $assignedCompanyId) {
      throw new RuntimeException("บริษัทของคุณไม่มีสิทธิ์ยกเลิกการโอนนี้");
    }

    $update = $pdo->prepare("
      UPDATE statement_logs
      SET assigned_company_id = NULL, assigned_by = NULL, assigned_at = NULL, assign_note = NULL
      WHERE id = :id
    ");
    $update->execute([":id" => $statementLogId]);

    $pdo->commit();
    echo json_encode([
      "ok" => true,
      "action" => "cancel",
      "statement_log_id" => $statementLogId,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  }
} catch (Exception $e) {
  if (isset($pdo) && $pdo->inTransaction()) {
    $pdo->rollBack();
  }
  http_response_code(500);
  echo json_encode(["ok" => false, "error" => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}
?>
