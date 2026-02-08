<?php
// Enable error reporting for debugging
error_reporting(E_ALL);
ini_set("display_errors", 1);

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../phone_utils.php';

// CORS headers
cors();

// Only allow GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
}

try {
    $pdo = db_connect();
} catch (Throwable $e) {
    json_response(['ok' => false, 'error' => 'DB_CONNECT_FAILED', 'message' => $e->getMessage()], 500);
}

// Params: month=YYYY-MM, optional userId, companyId, currentUserId, role
$month = isset($_GET['month']) ? (string)$_GET['month'] : null;
$userId = isset($_GET['userId']) ? (int)$_GET['userId'] : null;
$companyId = isset($_GET['companyId']) ? (int)$_GET['companyId'] : null;
$currentUserId = isset($_GET['currentUserId']) ? (int)$_GET['currentUserId'] : null;
$role = isset($_GET['role']) ? (string)$_GET['role'] : null;

try {
    // Step 1: Determine which users to include
    $userFilter = "role IN ('Telesale', 'Supervisor Telesale')";
    $userParams = [];

    if (!empty($userId)) {
        // Single user selected
        $userFilter .= " AND id = ?";
        $userParams[] = $userId;
    } elseif (!empty($currentUserId) && $role === 'Supervisor Telesale') {
        // Supervisor: self + team members
        $userFilter .= " AND (id = ? OR supervisor_id = ?)";
        $userParams[] = $currentUserId;
        $userParams[] = $currentUserId;
    } elseif (!empty($currentUserId) && $role === 'Telesale') {
        // Telesale: self only
        $userFilter .= " AND id = ?";
        $userParams[] = $currentUserId;
    } elseif (!empty($companyId)) {
        // Filter by company
        $userFilter .= " AND company_id = ?";
        $userParams[] = $companyId;
    }

    // Fetch relevant users with their phones
    $uStmt = $pdo->prepare("SELECT id, first_name, role, phone FROM users WHERE $userFilter");
    $uStmt->execute($userParams);
    $teamUsers = $uStmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($teamUsers)) {
        json_response([]);
        exit();
    }

    // Step 2: Build phone-to-user mapping (normalized to 66xxx format used in onecall_log)
    $phoneToUser = [];
    $userMap = [];
    foreach ($teamUsers as $u) {
        $userMap[$u['id']] = $u;
        if (!empty($u['phone'])) {
            $norm = normalize_phone_to_66($u['phone']);
            if ($norm) {
                $phoneToUser[$norm] = $u['id'];
            }
        }
    }

    $phones = array_keys($phoneToUser);
    $userIds = array_map(function($u) { return $u['id']; }, $teamUsers);

    // Step 3: Query onecall_log directly with phone_telesale IN (...) — uses idx_onecall_ph index
    $callData = []; // user_id => { month_key, total_calls, connected_calls, total_minutes }
    if (!empty($phones)) {
        $phPlaceholders = implode(',', array_fill(0, count($phones), '?'));
        $callSql = "SELECT 
                phone_telesale,
                DATE_FORMAT(`timestamp`, '%Y-%m') AS month_key,
                COUNT(*) AS total_calls,
                SUM(CASE WHEN duration >= 40 THEN 1 ELSE 0 END) AS connected_calls,
                ROUND(SUM(duration) / 60, 2) AS total_minutes
            FROM onecall_log
            WHERE phone_telesale IN ($phPlaceholders)";
        $callParams = $phones;

        if (!empty($month)) {
            $callSql .= " AND DATE_FORMAT(`timestamp`, '%Y-%m') = ?";
            $callParams[] = $month;
        }

        $callSql .= " GROUP BY phone_telesale, DATE_FORMAT(`timestamp`, '%Y-%m')";
        $cStmt = $pdo->prepare($callSql);
        $cStmt->execute($callParams);

        while ($row = $cStmt->fetch(PDO::FETCH_ASSOC)) {
            $uid = $phoneToUser[$row['phone_telesale']] ?? null;
            if ($uid) {
                $key = $uid . '_' . $row['month_key'];
                $callData[$key] = [
                    'user_id' => $uid,
                    'month_key' => $row['month_key'],
                    'total_calls' => (int)$row['total_calls'],
                    'connected_calls' => (int)$row['connected_calls'],
                    'total_minutes' => (float)$row['total_minutes'],
                ];
            }
        }
    }

    // Step 4: Query attendance data
    $attData = []; // user_id => { month_key, working_days }
    if (!empty($userIds)) {
        $uidPlaceholders = implode(',', array_fill(0, count($userIds), '?'));
        $attSql = "SELECT 
                user_id,
                DATE_FORMAT(work_date, '%Y-%m') AS month_key,
                SUM(attendance_value) AS working_days
            FROM user_daily_attendance
            WHERE user_id IN ($uidPlaceholders)";
        $attParams = $userIds;

        if (!empty($month)) {
            $attSql .= " AND DATE_FORMAT(work_date, '%Y-%m') = ?";
            $attParams[] = $month;
        }

        $attSql .= " GROUP BY user_id, DATE_FORMAT(work_date, '%Y-%m')";
        $aStmt = $pdo->prepare($attSql);
        $aStmt->execute($attParams);

        while ($row = $aStmt->fetch(PDO::FETCH_ASSOC)) {
            $key = $row['user_id'] . '_' . $row['month_key'];
            $attData[$key] = [
                'user_id' => (int)$row['user_id'],
                'month_key' => $row['month_key'],
                'working_days' => (float)$row['working_days'],
            ];
        }
    }

    // Step 5: Merge calls + attendance into unified result
    $allKeys = array_unique(array_merge(array_keys($callData), array_keys($attData)));
    $result = [];

    foreach ($allKeys as $key) {
        $call = $callData[$key] ?? null;
        $att = $attData[$key] ?? null;
        $uid = $call ? $call['user_id'] : ($att ? $att['user_id'] : null);
        $mk = $call ? $call['month_key'] : ($att ? $att['month_key'] : null);
        $user = $uid ? ($userMap[$uid] ?? null) : null;

        if (!$user || !$mk) continue;

        $totalMinutes = $call ? $call['total_minutes'] : 0;
        $workingDays = $att ? $att['working_days'] : 0;

        $result[] = [
            'month_key' => $mk,
            'user_id' => (int)$uid,
            'first_name' => $user['first_name'],
            'role' => $user['role'],
            'phone' => !empty($user['phone']) ? preg_replace('/\D+/', '', trim($user['phone'])) : null,
            'working_days' => round((float)$workingDays, 1),
            'total_minutes' => $totalMinutes,
            'connected_calls' => $call ? $call['connected_calls'] : 0,
            'total_calls' => $call ? $call['total_calls'] : 0,
            'minutes_per_workday' => $workingDays > 0 ? round($totalMinutes / $workingDays, 2) : null,
        ];
    }

    // Sort by month_key DESC, user_id ASC
    usort($result, function ($a, $b) {
        $cmp = strcmp($b['month_key'], $a['month_key']);
        return $cmp !== 0 ? $cmp : ($a['user_id'] - $b['user_id']);
    });

    json_response($result);

} catch (Throwable $e) {
    json_response(['error' => 'QUERY_FAILED', 'message' => $e->getMessage()], 500);
}

?>
