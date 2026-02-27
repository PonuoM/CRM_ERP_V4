<?php
// V2 Dashboard Stats - reads from call_import_logs (CSV imported data)
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

    // Build WHERE clause using matched_user_id
    $where = "WHERE MONTH(cil.call_date) = ? AND YEAR(cil.call_date) = ?";
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
        // Get user IDs from this company
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

    // Only count matched records
    $where .= " AND cil.matched_user_id IS NOT NULL";

    $sql = "SELECT
    COUNT(*) AS totalCalls,
    SUM(CASE WHEN cil.status = 1 THEN 1 ELSE 0 END) AS answeredCalls,
    SUM(CASE WHEN cil.status = 0 THEN 1 ELSE 0 END) AS missedCalls,
    SUM(CASE WHEN cil.status = 1 AND TIME_TO_SEC(cil.duration) >= 40 THEN 1 ELSE 0 END) AS talkedCalls,
    ROUND(SUM(TIME_TO_SEC(cil.duration)) / 60, 2) AS totalMinutes,
    SUM(CASE WHEN cil.rec_type = 1 THEN 1 ELSE 0 END) AS inboundCalls,
    SUM(CASE WHEN cil.rec_type = 2 THEN 1 ELSE 0 END) AS outboundCalls,
    SUM(CASE WHEN cil.rec_type = 3 THEN 1 ELSE 0 END) AS internalCalls,
    SUM(CASE WHEN cil.rec_type = 4 THEN 1 ELSE 0 END) AS voicemailCalls
  FROM call_import_logs cil
  $where";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    $total = (int) ($row['totalCalls'] ?? 0);
    $answered = (int) ($row['answeredCalls'] ?? 0);
    $missed = (int) ($row['missedCalls'] ?? 0);
    $talked = (int) ($row['talkedCalls'] ?? 0);
    $totalMin = (float) ($row['totalMinutes'] ?? 0);
    $inbound = (int) ($row['inboundCalls'] ?? 0);
    $outbound = (int) ($row['outboundCalls'] ?? 0);
    $internal = (int) ($row['internalCalls'] ?? 0);
    $voicemail = (int) ($row['voicemailCalls'] ?? 0);

    // Calculate avg minutes per answered call
    $avgMinutes = $answered > 0 ? round($totalMin / $answered, 2) : 0;
    $answerRate = $total > 0 ? round(($answered / $total) * 100, 1) : 0;
    $inboundRate = $total > 0 ? round(($inbound / $total) * 100, 1) : 0;
    $outboundRate = $total > 0 ? round(($outbound / $total) * 100, 1) : 0;

    json_response([
        "success" => true,
        "data" => [
            "totalCalls" => $total,
            "answeredCalls" => $answered,
            "missedCalls" => $missed,
            "talkedCalls" => $talked,
            "totalMinutes" => $totalMin,
            "avgMinutes" => $avgMinutes,
            "answerRate" => $answerRate,
            "inboundCalls" => $inbound,
            "outboundCalls" => $outbound,
            "internalCalls" => $internal,
            "voicemailCalls" => $voicemail,
            "inboundRate" => $inboundRate,
            "outboundRate" => $outboundRate,
        ],
    ]);
} catch (Exception $e) {
    json_response(["success" => false, "error" => $e->getMessage()], 500);
}
?>