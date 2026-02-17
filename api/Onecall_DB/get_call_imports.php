<?php
/**
 * get_call_imports.php
 * GET:  ดึง call_import_logs + LEFT JOIN users + JOIN batches
 * Params: batch_id, date_from, date_to, search, page, limit
 *         mode=batches → ดึง batches list แทน
 */
error_reporting(E_ALL);
ini_set("display_errors", 1);

require_once __DIR__ . "/../config.php";
cors();

try {
    $pdo = db_connect();
} catch (RuntimeException $e) {
    json_response(["success" => false, "error" => "Database connection failed: " . $e->getMessage()], 500);
}

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
    json_response(["success" => false, "error" => "Method not allowed"], 405);
}

$mode = $_GET['mode'] ?? 'logs';

// ═══════════════════════════════════════
// MODE: batches — list all import batches
// ═══════════════════════════════════════
if ($mode === 'batches') {
    $companyId = isset($_GET['company_id']) ? intval($_GET['company_id']) : null;
    $page = max(1, intval($_GET['page'] ?? 1));
    $limit = max(1, min(100, intval($_GET['limit'] ?? 20)));
    $offset = ($page - 1) * $limit;

    $where = [];
    $params = [];

    if ($companyId) {
        $where[] = "b.company_id = ?";
        $params[] = $companyId;
    }

    $whereSQL = count($where) > 0 ? "WHERE " . implode(" AND ", $where) : "";

    // Count
    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM call_import_batches b $whereSQL");
    $countStmt->execute($params);
    $total = (int) $countStmt->fetchColumn();

    // Fetch
    $sql = "SELECT b.*, u.first_name, u.last_name
          FROM call_import_batches b
          LEFT JOIN users u ON u.id = b.created_by
          $whereSQL
          ORDER BY b.created_at DESC
          LIMIT $limit OFFSET $offset";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $batches = $stmt->fetchAll();

    json_response([
        "success" => true,
        "data" => $batches,
        "pagination" => [
            "page" => $page,
            "limit" => $limit,
            "total" => $total,
            "totalPages" => ceil($total / $limit),
        ],
    ]);
}

// ═══════════════════════════════════════
// MODE: report — summary grouped by matched user
// ═══════════════════════════════════════
if ($mode === 'report') {
    $dateFrom = $_GET['date_from'] ?? null;
    $dateTo = $_GET['date_to'] ?? null;
    $companyId = isset($_GET['company_id']) ? intval($_GET['company_id']) : null;

    $where = ["l.matched_user_id IS NOT NULL"];
    $params = [];

    if ($dateFrom) {
        $where[] = "l.call_date >= ?";
        $params[] = $dateFrom;
    }
    if ($dateTo) {
        $where[] = "l.call_date <= ?";
        $params[] = $dateTo;
    }
    if ($companyId) {
        $where[] = "u.company_id = ?";
        $params[] = $companyId;
    }

    $whereSQL = "WHERE " . implode(" AND ", $where);

    $sql = "SELECT
            l.matched_user_id,
            u.first_name,
            u.last_name,
            u.phone AS user_phone,
            l.agent_phone,
            COUNT(*) AS total_calls,
            SUM(CASE WHEN l.status = 1 THEN 1 ELSE 0 END) AS answered_calls,
            SUM(CASE WHEN l.status = 0 THEN 1 ELSE 0 END) AS missed_calls,
            SUM(TIME_TO_SEC(l.duration)) AS total_duration_sec,
            AVG(CASE WHEN l.status = 1 THEN TIME_TO_SEC(l.duration) ELSE NULL END) AS avg_duration_sec,
            MIN(l.call_date) AS first_call_date,
            MAX(l.call_date) AS last_call_date
          FROM call_import_logs l
          LEFT JOIN users u ON u.id = l.matched_user_id
          $whereSQL
          GROUP BY l.matched_user_id, u.first_name, u.last_name, u.phone, l.agent_phone
          ORDER BY total_calls DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    // Compute totals
    $grandTotalCalls = 0;
    $grandAnswered = 0;
    $grandMissed = 0;
    $grandDuration = 0;
    foreach ($rows as &$row) {
        $row['total_duration_sec'] = (int) $row['total_duration_sec'];
        $row['avg_duration_sec'] = $row['avg_duration_sec'] !== null ? round((float) $row['avg_duration_sec']) : 0;
        $grandTotalCalls += (int) $row['total_calls'];
        $grandAnswered += (int) $row['answered_calls'];
        $grandMissed += (int) $row['missed_calls'];
        $grandDuration += $row['total_duration_sec'];
    }
    unset($row);

    json_response([
        "success" => true,
        "data" => $rows,
        "summary" => [
            "totalUsers" => count($rows),
            "totalCalls" => $grandTotalCalls,
            "totalAnswered" => $grandAnswered,
            "totalMissed" => $grandMissed,
            "totalDurationSec" => $grandDuration,
        ],
    ]);
}

// ═══════════════════════════════════════
// MODE: logs — list call import logs
// ═══════════════════════════════════════
$batchId = isset($_GET['batch_id']) ? intval($_GET['batch_id']) : null;
$dateFrom = $_GET['date_from'] ?? null;
$dateTo = $_GET['date_to'] ?? null;
$search = $_GET['search'] ?? null;
$page = max(1, intval($_GET['page'] ?? 1));
$limit = max(1, min(100, intval($_GET['limit'] ?? 50)));
$offset = ($page - 1) * $limit;

$where = [];
$params = [];

if ($batchId) {
    $where[] = "l.batch_id = ?";
    $params[] = $batchId;
}
if ($dateFrom) {
    $where[] = "l.call_date >= ?";
    $params[] = $dateFrom;
}
if ($dateTo) {
    $where[] = "l.call_date <= ?";
    $params[] = $dateTo;
}
if ($search) {
    $where[] = "(l.call_origination LIKE ? OR l.display_number LIKE ? OR l.call_termination LIKE ? OR l.agent_phone LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?)";
    $s = "%$search%";
    $params = array_merge($params, [$s, $s, $s, $s, $s, $s]);
}

$whereSQL = count($where) > 0 ? "WHERE " . implode(" AND ", $where) : "";

// Count total
$countStmt = $pdo->prepare(
    "SELECT COUNT(*) FROM call_import_logs l LEFT JOIN users u ON u.id = l.matched_user_id $whereSQL"
);
$countStmt->execute($params);
$total = (int) $countStmt->fetchColumn();

// Fetch logs
$sql = "SELECT l.*,
               u.first_name AS matched_first_name,
               u.last_name AS matched_last_name,
               u.phone AS matched_user_phone,
               b.file_name
        FROM call_import_logs l
        LEFT JOIN users u ON u.id = l.matched_user_id
        LEFT JOIN call_import_batches b ON b.id = l.batch_id
        $whereSQL
        ORDER BY l.call_date DESC, l.start_time DESC
        LIMIT $limit OFFSET $offset";
$stmt = $pdo->prepare($sql);
$stmt->execute($params);
$logs = $stmt->fetchAll();

json_response([
    "success" => true,
    "data" => $logs,
    "pagination" => [
        "page" => $page,
        "limit" => $limit,
        "total" => $total,
        "totalPages" => ceil($total / $limit),
    ],
]);
?>