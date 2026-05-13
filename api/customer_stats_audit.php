<?php
/**
 * Customer Stats Audit API
 * ========================
 * Provides dry-run and fix endpoints for auditing customer statistics.
 * Used by BasketSettingsPage -> "ตรวจสอบยอดขายและวันที่สั่งซื้อล่าสุด" tab.
 *
 * Endpoints:
 *   ?action=scan    — Dry-run: find customers with mismatched stats
 *   ?action=fix     — Fix all mismatched customers (POST)
 *
 * @since 2026-05-13
 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/Services/CustomerStatsHelper.php';

cors();
header('Content-Type: application/json; charset=utf-8');

$pdo = db_connect();

// Auth check
$auth = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
if (!$auth && function_exists('getallheaders')) {
    $headers = getallheaders();
    $auth = $headers['Authorization'] ?? $headers['authorization'] ?? '';
}
if (!$auth && isset($_GET['token'])) {
    $auth = 'Bearer ' . $_GET['token'];
}
if (!preg_match('/Bearer\s+(\S+)/', $auth, $matches)) {
    echo json_encode(['error' => 'UNAUTHORIZED'], JSON_UNESCAPED_UNICODE);
    exit;
}
$token = $matches[1];
$stmt = $pdo->prepare('SELECT u.id, u.role FROM user_tokens ut JOIN users u ON u.id = ut.user_id WHERE ut.token = ? AND ut.expires_at > NOW()');
$stmt->execute([$token]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$user || !in_array($user['role'], ['Super Admin', 'Admin'])) {
    echo json_encode(['error' => 'UNAUTHORIZED', 'message' => 'Admin required'], JSON_UNESCAPED_UNICODE);
    exit;
}

$action    = $_GET['action'] ?? 'scan';
$companyId = isset($_GET['companyId']) ? (int)$_GET['companyId'] : null;
$limit     = isset($_GET['limit']) ? min(500, max(10, (int)$_GET['limit'])) : 100;

// Build the mismatch subquery used by both scan and fix
function buildMismatchSQL(string $selectCols, ?int $companyId, ?int $limit = null): string {
    $companyFilter = $companyId ? "AND c.company_id = $companyId" : '';
    $limitClause   = $limit ? "LIMIT $limit" : '';

    return "
        SELECT $selectCols
        FROM (
            SELECT
                c.customer_id,
                CONCAT(COALESCE(c.first_name,''), ' ', COALESCE(c.last_name,'')) AS cust_name,
                c.company_id,
                COALESCE(c.total_purchases, 0)  AS cached_total,
                COALESCE(c.order_count, 0)      AS cached_order_count,
                c.last_order_date               AS cached_last_order,
                c.first_order_date              AS cached_first_order,
                c.grade                         AS cached_grade,

                COALESCE(o.actual_order_count, 0)  AS actual_order_count,
                COALESCE(o.actual_total, 0)        AS actual_total,
                o.actual_first_date,
                o.actual_last_date

            FROM customers c
            LEFT JOIN (
                SELECT
                    customer_id,
                    COUNT(*)          AS actual_order_count,
                    SUM(total_amount) AS actual_total,
                    MIN(order_date)   AS actual_first_date,
                    MAX(order_date)   AS actual_last_date
                FROM orders
                WHERE order_status != 'Cancelled'
                GROUP BY customer_id
            ) o ON o.customer_id = c.customer_id
            WHERE 1=1 $companyFilter
        ) t
        WHERE
            ROUND(cached_total, 2) != ROUND(actual_total, 2)
            OR cached_order_count != actual_order_count
            OR IFNULL(cached_last_order, '1970-01-01') != IFNULL(actual_last_date, '1970-01-01')
            OR IFNULL(cached_first_order, '1970-01-01') != IFNULL(actual_first_date, '1970-01-01')
        ORDER BY ABS(cached_total - actual_total) DESC
        $limitClause
    ";
}

switch ($action) {

    case 'scan':
        // -------------------------------------------------------------------
        // DRY RUN: Find customers whose cached stats differ from actual orders
        // -------------------------------------------------------------------

        // Get mismatched customers (sample)
        $sql = buildMismatchSQL('*', $companyId, $limit);
        $mismatches = $pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC);

        // Count total mismatches
        $countSql = buildMismatchSQL('COUNT(*) AS cnt', $companyId);
        // Wrap to count properly since buildMismatchSQL has ORDER BY
        $countSql = "SELECT COUNT(*) FROM (" . buildMismatchSQL('customer_id', $companyId) . ") cnt_sub";
        $totalWrong = (int)$pdo->query($countSql)->fetchColumn();

        // Count future dates
        $companyFilter = $companyId ? "AND company_id = $companyId" : '';
        $futureDates = (int)$pdo->query("SELECT COUNT(*) FROM customers WHERE last_order_date > NOW() $companyFilter")->fetchColumn();

        // Count total customers
        $totalCustomers = (int)$pdo->query("SELECT COUNT(*) FROM customers WHERE 1=1 $companyFilter")->fetchColumn();

        // Classify mismatches
        $wrongTotal = 0; $wrongCount = 0; $wrongLast = 0; $wrongFirst = 0;
        $sampleCustomers = [];

        foreach ($mismatches as &$m) {
            $m['name']            = $m['cust_name'];
            $m['cached_total']    = round((float)$m['cached_total'], 2);
            $m['actual_total']    = round((float)$m['actual_total'], 2);
            $m['diff_total']      = round($m['actual_total'] - $m['cached_total'], 2);
            $m['actual_grade']    = calculate_customer_grade($m['actual_total']);
            $m['grade_mismatch']  = $m['cached_grade'] !== $m['actual_grade'];

            $issues = [];
            if ($m['cached_total'] != $m['actual_total']) { $wrongTotal++; $issues[] = 'ยอดซื้อไม่ตรง'; }
            if ((int)$m['cached_order_count'] != (int)$m['actual_order_count']) { $wrongCount++; $issues[] = 'จำนวนออเดอร์ไม่ตรง'; }
            if (($m['cached_last_order'] ?? '1970-01-01') != ($m['actual_last_date'] ?? '1970-01-01')) { $wrongLast++; $issues[] = 'วันสั่งซื้อล่าสุดไม่ตรง'; }
            if (($m['cached_first_order'] ?? '1970-01-01') != ($m['actual_first_date'] ?? '1970-01-01')) { $wrongFirst++; $issues[] = 'วันสั่งซื้อแรกไม่ตรง'; }
            $m['issues'] = $issues;

            // Clean up internal-only field
            unset($m['cust_name']);
            $sampleCustomers[] = $m;
        }
        unset($m);

        echo json_encode([
            'success'          => true,
            'total_customers'  => $totalCustomers,
            'total_wrong'      => $totalWrong,
            'future_dates'     => $futureDates,
            'breakdown'        => [
                'wrong_total'      => $wrongTotal,
                'wrong_order_count'=> $wrongCount,
                'wrong_last_date'  => $wrongLast,
                'wrong_first_date' => $wrongFirst,
            ],
            'showing'          => count($sampleCustomers),
            'customers'        => $sampleCustomers,
            'scanned_at'       => date('Y-m-d H:i:s'),
        ], JSON_UNESCAPED_UNICODE);
        break;

    case 'fix':
        // -------------------------------------------------------------------
        // FIX: Recalculate all mismatched customers
        // -------------------------------------------------------------------
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            echo json_encode(['error' => 'Method must be POST'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $body  = json_decode(file_get_contents('php://input'), true) ?: [];
        $batch = min(1000, max(10, (int)($body['batch'] ?? 100)));

        // Find mismatched customer IDs (limited by batch)
        $sql = buildMismatchSQL('customer_id', $companyId, $batch);
        $ids = $pdo->query($sql)->fetchAll(PDO::FETCH_COLUMN);

        $fixed  = 0;
        $errors = 0;

        foreach ($ids as $cid) {
            try {
                recalculate_customer_stats_safe($pdo, (int)$cid);
                $fixed++;
            } catch (Throwable $e) {
                $errors++;
            }
        }

        echo json_encode([
            'success'   => true,
            'total'     => count($ids),
            'fixed'     => $fixed,
            'errors'    => $errors,
            'fixed_at'  => date('Y-m-d H:i:s'),
        ], JSON_UNESCAPED_UNICODE);
        break;

    default:
        echo json_encode(['error' => 'Unknown action: ' . $action], JSON_UNESCAPED_UNICODE);
}
