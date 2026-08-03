<?php
/**
 * Backfill month-end rows into `customer_ownership_snapshots` for months that
 * ended BEFORE the daily snapshot cron existed.
 *
 * HOW THE PAST IS RECONSTRUCTED
 *   `basket_transition_log` stores the pre-state of every basket move
 *   (`from_basket_key`, `assigned_to_old`). So the state of a customer at time T
 *   is the pre-state of their FIRST transition after T — and for customers with
 *   no transition after T, simply their current state. This is the same
 *   reverse-replay the basket-flow report already uses (tmp_repeat_flow_basket.php).
 *
 *   Cross-checked against an independent replay of `customer_audit_log`
 *   (field_name = assigned_to / current_basket_key): the two agree on
 *   97.5–99.7% of customers, and the owned totals differ by 0.01–0.5%.
 *   Treat backfilled months as accurate-but-reconstructed, not exact.
 *
 * CUT-OFF — "ยอดก่อนดึงกลับ"
 *   `monthly_cron` normally strips ownership at 01:00 on the 1st, so 23:59:59 on
 *   the last day is safely before it. But it does not always: on 2026-05-31 it
 *   ran at 21:00, and a naive 23:59:59 cut reports 25,116 owned instead of the
 *   80,067 that stood before the reclaim. So for each month this script finds the
 *   first mass ownership-strip of that month's cycle and, if it landed on the last
 *   day, cuts one second before it.
 *
 * DATA LIMIT
 *   `basket_transition_log` starts 2026-01-24, so the first trustworthy month-end
 *   is 2026-02-28. Earlier months are refused rather than guessed at.
 *
 * USAGE
 *   CLI : php backfill_ownership_snapshots.php [--from=2026-02] [--to=2026-07] [--dry-run] [--force]
 *   URL : /api/cron/backfill_ownership_snapshots.php?key=ownership_snapshot_2026_secret&dryrun=0
 *         optional: &from=2026-02&to=2026-07&force=1
 *
 *   --force overwrites month-end rows that already exist (default: existing months are skipped,
 *   which protects rows written by the real daily cron — those are exact, backfill is not).
 *
 * @date 2026-08-03
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);
set_time_limit(0);
date_default_timezone_set('Asia/Bangkok');

$isCli = (PHP_SAPI === 'cli');

if (!$isCli) {
    header('Content-Type: text/plain; charset=utf-8');
    if (($_GET['key'] ?? '') !== 'ownership_snapshot_2026_secret') {
        http_response_code(403);
        die("Access denied. Invalid key.\n");
    }
    $dryRun = !isset($_GET['dryrun']) || $_GET['dryrun'] !== '0';
    $force  = isset($_GET['force']) && $_GET['force'] === '1';
    $from   = $_GET['from'] ?? null;
    $to     = $_GET['to'] ?? null;
} else {
    $argvSafe = $argv ?? [];
    $dryRun = in_array('--dry-run', $argvSafe, true);
    $force  = in_array('--force', $argvSafe, true);
    $from = $to = null;
    foreach ($argvSafe as $a) {
        if (strpos($a, '--from=') === 0) $from = substr($a, 7);
        if (strpos($a, '--to=') === 0)   $to = substr($a, 5);
    }
}

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/ownership_snapshot_lib.php';
set_time_limit(0); // after config.php, which caps max_execution_time at 120s for normal API calls

const BTL_FIRST_TRUSTWORTHY_MONTH = '2026-02'; // basket_transition_log starts 2026-01-24

$from = ($from && preg_match('/^\d{4}-\d{2}$/', $from)) ? $from : BTL_FIRST_TRUSTWORTHY_MONTH;
$to   = ($to   && preg_match('/^\d{4}-\d{2}$/', $to))   ? $to   : date('Y-m', strtotime('first day of last month'));

if ($from < BTL_FIRST_TRUSTWORTHY_MONTH) {
    die("Refusing to backfill before " . BTL_FIRST_TRUSTWORTHY_MONTH . " — basket_transition_log has no data to replay before 2026-01-24.\n");
}

echo "=====================================================\n";
echo "Backfill Ownership Snapshots (reverse-replay)\n";
echo "Run at: " . date('Y-m-d H:i:s') . "\n";
echo "Range : {$from} .. {$to}\n";
echo "Mode  : " . ($dryRun ? "DRY RUN" : "LIVE") . ($force ? " (force overwrite)" : "") . "\n";
echo "=====================================================\n\n";

try {
    $pdo = db_connect();
    set_audit_context($pdo, 'cron/backfill_ownership_snapshots');

    // Replayed values include bulk-operation placeholders ('Multiple Baskets'), which are not
    // baskets — drop them rather than inventing a segment for them.
    $normBasket = ownership_basket_normaliser($pdo, false);

    // ---- Build the month list
    $months = [];
    $cur = $from;
    while ($cur <= $to) {
        $months[] = $cur;
        $cur = date('Y-m', strtotime($cur . '-01 +1 month'));
    }
    if (empty($months)) die("Empty month range.\n");

    $existsStmt = $pdo->prepare("SELECT COUNT(*) FROM customer_ownership_snapshots WHERE snapshot_date = ?");

    // For a given month-end, the first mass ownership-strip of that cycle.
    // Window = last day 00:00 .. next month day-2 00:00, so both the "01:00 on the 1st"
    // normal run and an early run on the last day are caught.
    $burstStmt = $pdo->prepare("
        SELECT MIN(created_at) AS first_strip
        FROM basket_transition_log
        WHERE transition_type = 'monthly_cron'
          AND assigned_to_old IS NOT NULL AND assigned_to_new IS NULL
          AND created_at >= ? AND created_at < ?
    ");

    // One company at a time. Driving `customers` unfiltered makes MariaDB flip to a plan that
    // takes 10+ minutes on some month-ends; scoped to a single company it stays at ~5-15s.
    // Aggregation is done in PHP (a few hundred groups) rather than GROUP BY, for the same reason.
    $replayStmt = $pdo->prepare("
        SELECT c.customer_id,
               CASE WHEN fa.customer_id IS NULL THEN c.assigned_to ELSE fa.assigned_to_old END AS agent_id,
               COALESCE(fa.from_basket_key, c.current_basket_key) AS basket_key
        FROM customers c
        LEFT JOIN (
            SELECT customer_id, from_basket_key, assigned_to_old,
                   ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY created_at ASC, id ASC) AS rn
            FROM basket_transition_log
            WHERE created_at > ?
        ) fa ON fa.customer_id = c.customer_id AND fa.rn = 1
        WHERE c.company_id <=> ?
          AND (c.date_registered IS NULL OR c.date_registered <= ?)
    ");

    $companyIds = [];
    foreach ($pdo->query("SELECT DISTINCT company_id FROM customers")->fetchAll(PDO::FETCH_COLUMN) as $cid) {
        $companyIds[] = ($cid === null) ? null : (int) $cid;
    }

    $ins = $pdo->prepare("
        INSERT INTO customer_ownership_snapshots
            (snapshot_date, company_id, agent_id, basket_key, owned_count, is_month_end, captured_at, source)
        VALUES (?, ?, ?, ?, ?, 1, ?, 'backfill')
    ");

    foreach ($months as $m) {
        $lastDay = date('Y-m-t', strtotime($m . '-01'));
        $nextMonthDay2 = date('Y-m-d', strtotime($lastDay . ' +2 day'));

        echo "--- {$m} (สิ้นเดือน {$lastDay}) ---\n";

        $existsStmt->execute([$lastDay]);
        $already = (int) $existsStmt->fetchColumn();
        if ($already > 0 && !$force) {
            echo "  SKIP — already has {$already} row(s). Use --force to overwrite.\n\n";
            continue;
        }

        // Cut-off: default end of last day, pulled earlier if the reclaim ran early
        $cutoff = $lastDay . ' 23:59:59';
        $burstStmt->execute([$lastDay . ' 00:00:00', $nextMonthDay2 . ' 00:00:00']);
        $firstStrip = $burstStmt->fetchColumn();
        if ($firstStrip && substr($firstStrip, 0, 10) === $lastDay) {
            $cutoff = date('Y-m-d H:i:s', strtotime($firstStrip) - 1);
            echo "  ⚠ reclaim cron ran early ({$firstStrip}) — cutting at {$cutoff} to capture the pre-reclaim figure\n";
        }

        $t0 = microtime(true);
        $agg = [];         // aggregate, derived from the per-customer rows so the two always agree
        $perCustomer = []; // [customer_id, company_id, agent_id|null, basket_key]
        $total = 0;
        foreach ($companyIds as $cid) {
            $replayStmt->execute([$cutoff, $cid, $cutoff]);
            $cidKey = (int) $cid; // NULL company groups under 0, same as the daily cron
            while ($r = $replayStmt->fetch(PDO::FETCH_ASSOC)) {
                $bk = $normBasket($r['basket_key']);
                $owner = ($r['agent_id'] === null || $r['agent_id'] === '') ? null : (int) $r['agent_id'];
                // every customer is stored, owned or not — call bucketing needs the unowned ones too
                $perCustomer[] = [(int) $r['customer_id'], $cidKey, $owner, $bk];
                if ($owner !== null) {
                    $k = $cidKey . '|' . $owner . '|' . $bk;
                    $agg[$k] = ($agg[$k] ?? 0) + 1;
                    $total++;
                }
            }
            $replayStmt->closeCursor();
        }
        printf("  replayed as of %s → %s customer(s), %d group(s), %s owned [%.1fs]\n",
            $cutoff, number_format(count($perCustomer)), count($agg), number_format($total), microtime(true) - $t0);

        if ($dryRun) {
            echo "  DRY RUN — not written.\n\n";
            continue;
        }

        $t1 = microtime(true);
        $pdo->beginTransaction();
        $pdo->prepare("DELETE FROM customer_ownership_snapshots WHERE snapshot_date = ?")->execute([$lastDay]);
        $wrote = 0;
        foreach ($agg as $k => $cnt) {
            [$cid, $aid, $bk] = explode('|', $k, 3);
            $ins->execute([$lastDay, (int) $cid, (int) $aid, $bk, $cnt, $cutoff]);
            $wrote++;
        }
        $pdo->commit();

        // Per-customer rows: hundreds of thousands, so batch them — one round trip per row
        // over a remote connection would take hours.
        $pdo->prepare("DELETE FROM customer_basket_snapshots WHERE snapshot_date = ?")->execute([$lastDay]);
        $wroteDetail = writeCustomerBasketSnapshots($pdo, $lastDay, $perCustomer);

        printf("  wrote %d aggregate row(s) + %s per-customer row(s) [%.1fs]\n\n",
            $wrote, number_format($wroteDetail), microtime(true) - $t1);
    }

    echo "=====================================================\n";
    echo "Done.\n";

} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    echo "ERROR: " . $e->getMessage() . "\n";
    exit(1);
}
