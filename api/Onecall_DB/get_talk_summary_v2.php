<?php
// V2 Talk Summary - breakdown by status and rec_type from call_import_logs
require_once __DIR__ . "/../config.php";
cors();

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    json_response(["success" => false, "error" => "Method not allowed"], 405);
}

try {
    $pdo = db_connect();

    $month = isset($_GET["month"]) ? intval($_GET["month"]) : intval(date("m"));
    $year = isset($_GET["year"]) ? intval($_GET["year"]) : intval(date("Y"));
    $userId = isset($_GET["user_id"]) ? intval($_GET["user_id"]) : null;
    $companyId = isset($_GET["company_id"]) ? intval($_GET["company_id"]) : null;
    $userIds = isset($_GET["user_ids"]) ? (string) $_GET["user_ids"] : null;

    $where = "WHERE MONTH(cil.call_date) = ? AND YEAR(cil.call_date) = ? AND cil.matched_user_id IS NOT NULL";
    $params = [$month, $year];

    if (!empty($userId)) {
        $where .= " AND cil.matched_user_id = ?";
        $params[] = $userId;
    } elseif (!empty($userIds)) {
        $idList = array_filter(array_map('intval', explode(',', $userIds)));
        if (empty($idList)) {
            $where .= " AND 1=0";
        } else {
            $in = implode(',', array_fill(0, count($idList), '?'));
            $where .= " AND cil.matched_user_id IN ($in)";
            $params = array_merge($params, $idList);
        }
    } elseif (!empty($companyId)) {
        $uStmt = $pdo->prepare("SELECT id FROM users WHERE company_id = ? AND role IN ('Telesale', 'Supervisor Telesale')");
        $uStmt->execute([$companyId]);
        $ids = $uStmt->fetchAll(PDO::FETCH_COLUMN);
        if (empty($ids)) {
            $where .= " AND 1=0";
        } else {
            $in = implode(',', array_fill(0, count($ids), '?'));
            $where .= " AND cil.matched_user_id IN ($in)";
            $params = array_merge($params, $ids);
        }
    }

    $sql = "SELECT
    SUM(CASE WHEN cil.status = 1 THEN 1 ELSE 0 END) AS answered,
    SUM(CASE WHEN cil.status = 0 THEN 1 ELSE 0 END) AS missed,
    SUM(CASE WHEN cil.rec_type = 1 THEN 1 ELSE 0 END) AS inbound,
    SUM(CASE WHEN cil.rec_type = 2 THEN 1 ELSE 0 END) AS outbound,
    SUM(CASE WHEN cil.rec_type = 3 THEN 1 ELSE 0 END) AS internal,
    SUM(CASE WHEN cil.rec_type = 4 THEN 1 ELSE 0 END) AS voicemail
  FROM call_import_logs cil
  $where";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    json_response([
        "success" => true,
        "data" => [
            "answered" => (int) ($row['answered'] ?? 0),
            "missed" => (int) ($row['missed'] ?? 0),
            "inbound" => (int) ($row['inbound'] ?? 0),
            "outbound" => (int) ($row['outbound'] ?? 0),
            "internal" => (int) ($row['internal'] ?? 0),
            "voicemail" => (int) ($row['voicemail'] ?? 0),
        ],
    ]);
} catch (Exception $e) {
    json_response(["success" => false, "error" => $e->getMessage()], 500);
}
?>