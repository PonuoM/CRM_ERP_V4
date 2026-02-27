<?php
// V2 Employee Summary - per-user call stats from call_import_logs
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
    cil.matched_user_id AS user_id,
    u.first_name,
    u.last_name,
    u.role,
    u.phone,
    COUNT(*) AS total_calls,
    SUM(CASE WHEN cil.status = 1 THEN 1 ELSE 0 END) AS answered_calls,
    SUM(CASE WHEN cil.status = 0 THEN 1 ELSE 0 END) AS missed_calls,
    ROUND(SUM(TIME_TO_SEC(cil.duration)) / 60, 2) AS total_minutes,
    SUM(CASE WHEN cil.rec_type = 1 THEN 1 ELSE 0 END) AS inbound_calls,
    SUM(CASE WHEN cil.rec_type = 2 THEN 1 ELSE 0 END) AS outbound_calls,
    SUM(CASE WHEN cil.rec_type = 3 THEN 1 ELSE 0 END) AS internal_calls
  FROM call_import_logs cil
  LEFT JOIN users u ON u.id = cil.matched_user_id
  $where
  GROUP BY cil.matched_user_id, u.first_name, u.last_name, u.role, u.phone
  ORDER BY total_calls DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Calculate percentages
    $result = [];
    foreach ($rows as $r) {
        $total = (int) $r['total_calls'];
        $answered = (int) $r['answered_calls'];
        $inbound = (int) $r['inbound_calls'];

        $r['answer_rate'] = $total > 0 ? round(($answered / $total) * 100, 1) : 0;
        $r['outbound_rate'] = $total > 0 ? round(((int) $r['outbound_calls'] / $total) * 100, 1) : 0;
        $r['avg_minutes'] = $answered > 0 ? round((float) $r['total_minutes'] / $answered, 2) : 0;
        $result[] = $r;
    }

    json_response(["success" => true, "data" => $result]);
} catch (Exception $e) {
    json_response(["success" => false, "error" => $e->getMessage()], 500);
}
?>