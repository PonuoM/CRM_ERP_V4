<?php
// V2 Call Overview - per-employee detail with attendance, from call_import_logs
require_once __DIR__ . "/../config.php";
cors();

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    json_response(["success" => false, "error" => "Method not allowed"], 405);
}

try {
    $pdo = db_connect();

    $month = isset($_GET['month']) ? (string) $_GET['month'] : null; // YYYY-MM
    $companyId = isset($_GET['companyId']) ? (int) $_GET['companyId'] : null;
    $currentUserId = isset($_GET['currentUserId']) ? (int) $_GET['currentUserId'] : null;
    $role = isset($_GET['role']) ? (string) $_GET['role'] : null;

    // Step 1: Determine which users to include
    $userFilter = "role IN ('Telesale', 'Supervisor Telesale') AND status = 'active'";
    $userParams = [];

    if (!empty($currentUserId) && $role === 'Supervisor Telesale') {
        $userFilter .= " AND (id = ? OR supervisor_id = ?)";
        $userParams[] = $currentUserId;
        $userParams[] = $currentUserId;
    } elseif (!empty($currentUserId) && $role === 'Telesale') {
        $userFilter .= " AND id = ?";
        $userParams[] = $currentUserId;
    } elseif (!empty($companyId)) {
        $userFilter .= " AND company_id = ?";
        $userParams[] = $companyId;
    }

    $uStmt = $pdo->prepare("SELECT id, first_name, role, phone FROM users WHERE $userFilter");
    $uStmt->execute($userParams);
    $teamUsers = $uStmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($teamUsers)) {
        json_response([]);
        exit();
    }

    $userMap = [];
    $userIds = [];
    foreach ($teamUsers as $u) {
        $userMap[$u['id']] = $u;
        $userIds[] = $u['id'];
    }

    // Step 2: Query call_import_logs for these users
    $callData = [];
    if (!empty($userIds)) {
        $in = implode(',', array_fill(0, count($userIds), '?'));
        $callSql = "SELECT
      matched_user_id,
      COUNT(*) AS total_calls,
      SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS connected_calls,
      SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) AS missed_calls,
      SUM(CASE WHEN status = 1 AND TIME_TO_SEC(duration) >= 40 THEN 1 ELSE 0 END) AS talked_calls,
      ROUND(SUM(TIME_TO_SEC(duration)) / 60, 2) AS total_minutes,
      SUM(CASE WHEN rec_type = 1 THEN 1 ELSE 0 END) AS inbound_calls,
      SUM(CASE WHEN rec_type = 2 THEN 1 ELSE 0 END) AS outbound_calls
    FROM call_import_logs
    WHERE matched_user_id IN ($in)
      AND matched_user_id IS NOT NULL";
        $callParams = $userIds;

        if (!empty($month)) {
            $callSql .= " AND DATE_FORMAT(call_date, '%Y-%m') = ?";
            $callParams[] = $month;
        }

        $callSql .= " GROUP BY matched_user_id";
        $cStmt = $pdo->prepare($callSql);
        $cStmt->execute($callParams);

        while ($row = $cStmt->fetch(PDO::FETCH_ASSOC)) {
            $callData[(int) $row['matched_user_id']] = $row;
        }
    }

    // Step 3: Query attendance
    $attData = [];
    if (!empty($userIds)) {
        $in = implode(',', array_fill(0, count($userIds), '?'));
        $attSql = "SELECT
      user_id,
      SUM(attendance_value) AS working_days
    FROM user_daily_attendance
    WHERE user_id IN ($in)
      AND work_date < CURDATE()";
        $attParams = $userIds;

        if (!empty($month)) {
            $attSql .= " AND DATE_FORMAT(work_date, '%Y-%m') = ?";
            $attParams[] = $month;
        }

        $attSql .= " GROUP BY user_id";
        $aStmt = $pdo->prepare($attSql);
        $aStmt->execute($attParams);

        while ($row = $aStmt->fetch(PDO::FETCH_ASSOC)) {
            $attData[(int) $row['user_id']] = (float) $row['working_days'];
        }
    }

    // Step 4: Merge
    $result = [];
    foreach ($userIds as $uid) {
        // Skip users with no call data in the selected period
        if (!isset($callData[$uid]) || (int) $callData[$uid]['total_calls'] === 0)
            continue;

        $user = $userMap[$uid];
        $call = $callData[$uid] ?? null;
        $workingDays = $attData[$uid] ?? 0;

        $totalCalls = $call ? (int) $call['total_calls'] : 0;
        $connected = $call ? (int) $call['connected_calls'] : 0;
        $missed = $call ? (int) $call['missed_calls'] : 0;
        $talked = $call ? (int) $call['talked_calls'] : 0;
        $totalMinutes = $call ? (float) $call['total_minutes'] : 0;
        $inbound = $call ? (int) $call['inbound_calls'] : 0;
        $outbound = $call ? (int) $call['outbound_calls'] : 0;

        $result[] = [
            'user_id' => (int) $uid,
            'first_name' => $user['first_name'],
            'role' => $user['role'],
            'phone' => $user['phone'] ? preg_replace('/\D+/', '', trim($user['phone'])) : null,
            'working_days' => round($workingDays, 1),
            'total_minutes' => $totalMinutes,
            'connected_calls' => $connected,
            'missed_calls' => $missed,
            'talked_calls' => $talked,
            'total_calls' => $totalCalls,
            'inbound_calls' => $inbound,
            'outbound_calls' => $outbound,
            'answer_rate' => $totalCalls > 0 ? round(($connected / $totalCalls) * 100, 1) : 0,
            'outbound_rate' => $totalCalls > 0 ? round(($outbound / $totalCalls) * 100, 1) : 0,
            'minutes_per_workday' => $workingDays > 0 ? round($totalMinutes / $workingDays, 2) : null,
        ];
    }

    // Sort by total_calls DESC
    usort($result, function ($a, $b) {
        return $b['total_calls'] - $a['total_calls'];
    });

    json_response($result);
} catch (Throwable $e) {
    json_response(['error' => 'QUERY_FAILED', 'message' => $e->getMessage()], 500);
}
?>