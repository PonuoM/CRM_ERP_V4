<?php
/**
 * Daily Customer-Ownership Snapshot
 *
 * Freezes "ลูกค้าที่ดูแล" — the number of customers each agent owns, split by
 * basket — into `customer_ownership_snapshots`, so reports can show the value
 * as it stood on a past date instead of only "right now".
 *
 * WHY THE TIMING MATTERS
 *   `monthly_cron` (monthly_basket_transfer.php) strips ownership in bulk at
 *   01:00 on the 1st of each month. A snapshot taken at 23:50 on the LAST day
 *   of the month therefore captures the month-end figure BEFORE the reclaim —
 *   which is exactly the number the Campaign Compare report needs.
 *
 * SCHEDULE (cron)
 *   50 23 * * *  →  /api/cron/snapshot_customer_ownership.php?key=ownership_snapshot_2026_secret&dryrun=0
 *
 * USAGE
 *   URL  : /api/cron/snapshot_customer_ownership.php?key=ownership_snapshot_2026_secret&dryrun=0
 *          optional: &date=2026-08-31   (re-snapshot "as of" a specific date — uses CURRENT state,
 *                                        so only meaningful for today; for the past use the backfill script)
 *   CLI  : php snapshot_customer_ownership.php [--dry-run] [--date=YYYY-MM-DD]
 *
 * Idempotent: re-running for the same date overwrites that date's rows.
 *
 * @date 2026-08-03
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);
date_default_timezone_set('Asia/Bangkok');

$isCli = (PHP_SAPI === 'cli');

if (!$isCli) {
    header('Content-Type: text/plain; charset=utf-8');
    $expectedKey = 'ownership_snapshot_2026_secret';
    if (($_GET['key'] ?? '') !== $expectedKey) {
        http_response_code(403);
        die("Access denied. Invalid key.\n");
    }
    // Web default is DRY RUN unless dryrun=0 is passed explicitly (same convention as basket_aging_cron)
    $dryRun = !isset($_GET['dryrun']) || $_GET['dryrun'] !== '0';
    $dateArg = isset($_GET['date']) ? trim($_GET['date']) : null;
} else {
    $argvSafe = $argv ?? [];
    $dryRun = in_array('--dry-run', $argvSafe, true);
    $dateArg = null;
    foreach ($argvSafe as $a) {
        if (strpos($a, '--date=') === 0) $dateArg = substr($a, 7);
    }
}

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/cron_logger.php';
require_once __DIR__ . '/ownership_snapshot_lib.php';
set_time_limit(0); // month-end runs write ~234K per-customer rows

$snapshotDate = ($dateArg && preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateArg)) ? $dateArg : date('Y-m-d');
$capturedAt = ($snapshotDate === date('Y-m-d')) ? date('Y-m-d H:i:s') : ($snapshotDate . ' 23:59:59');
$isMonthEnd = ($snapshotDate === date('Y-m-t', strtotime($snapshotDate))) ? 1 : 0;

$logger = new CronLogger('snapshot_customer_ownership');
$logger->logStart();

$out = function ($line) use ($logger) {
    echo $line . "\n";
    $logger->log($line);
};

$out("=====================================================");
$out("Customer Ownership Snapshot");
$out("Run at      : " . date('Y-m-d H:i:s'));
$out("Snapshot for: {$snapshotDate}" . ($isMonthEnd ? "  [MONTH-END]" : ""));
$out("Mode        : " . ($dryRun ? "DRY RUN" : "LIVE"));
$out("=====================================================");

try {
    $pdo = db_connect();
    set_audit_context($pdo, 'cron/snapshot_customer_ownership');

    // Live data: keep an unrecognised basket value verbatim rather than silently dropping the customer.
    $normBasket = ownership_basket_normaliser($pdo, true);

    // ---- Read every customer once. On a month-end day the per-customer detail is stored too,
    // because reports need to bucket a month's CALLS by the basket the customer was in then.
    // Non-month-end days only keep the aggregate — per-customer rows every day would be ~234K/day.
    $cur = $pdo->query("
        SELECT customer_id, COALESCE(company_id, 0) AS company_id, assigned_to,
               COALESCE(current_basket_key, '') AS basket_key
        FROM customers
    ");

    $agg = [];
    $perCustomer = [];
    $totalCustomers = 0;
    $seen = 0;
    while ($r = $cur->fetch(PDO::FETCH_ASSOC)) {
        $seen++;
        $bk = $normBasket($r['basket_key']);
        $cid = (int) $r['company_id'];
        $owner = ($r['assigned_to'] === null || $r['assigned_to'] === '') ? null : (int) $r['assigned_to'];
        if ($isMonthEnd) {
            $perCustomer[] = [(int) $r['customer_id'], $cid, $owner, $bk];
        }
        if ($owner !== null) {
            $k = $cid . '|' . $owner . '|' . $bk;
            $agg[$k] = ($agg[$k] ?? 0) + 1;
            $totalCustomers++;
        }
    }
    $cur->closeCursor();

    $out("Customers scanned: " . number_format($seen)
        . "  |  groups (agent x basket): " . count($agg)
        . "  |  with an owner: " . number_format($totalCustomers));

    if ($dryRun) {
        $out("\nDRY RUN — nothing written. Sample of first 10 groups:");
        $i = 0;
        foreach ($agg as $k => $cnt) {
            [$cid, $aid, $bk] = explode('|', $k, 3);
            $out(sprintf("  company=%s agent=%s basket=%s owned=%d", $cid, $aid, $bk === '' ? '(none)' : $bk, $cnt));
            if (++$i >= 10) break;
        }
        $logger->logEnd(false);
        exit(0);
    }

    // ---- Write. Replace the whole day so a re-run is exact (stale groups do not linger).
    $pdo->beginTransaction();
    $del = $pdo->prepare("DELETE FROM customer_ownership_snapshots WHERE snapshot_date = ?");
    $del->execute([$snapshotDate]);
    $deleted = $del->rowCount();

    $ins = $pdo->prepare("
        INSERT INTO customer_ownership_snapshots
            (snapshot_date, company_id, agent_id, basket_key, owned_count, is_month_end, captured_at, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'cron')
    ");
    $written = 0;
    foreach ($agg as $k => $cnt) {
        [$cid, $aid, $bk] = explode('|', $k, 3);
        $ins->execute([$snapshotDate, (int) $cid, (int) $aid, $bk, $cnt, $isMonthEnd, $capturedAt]);
        $written++;
    }
    $pdo->commit();
    $out("Replaced {$deleted} old row(s), wrote {$written} aggregate row(s) for {$snapshotDate}.");

    if ($isMonthEnd) {
        $pdo->prepare("DELETE FROM customer_basket_snapshots WHERE snapshot_date = ?")->execute([$snapshotDate]);
        $detail = writeCustomerBasketSnapshots($pdo, $snapshotDate, $perCustomer);
        $out("Month-end: wrote " . number_format($detail) . " per-customer row(s).");
    }

    $out("=====================================================");
    $logger->logEnd(true);

} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    $msg = "ERROR: " . $e->getMessage();
    echo $msg . "\n";
    $logger->logError($e->getMessage());
    error_log("snapshot_customer_ownership: " . $e->getMessage());
    exit(1);
}
