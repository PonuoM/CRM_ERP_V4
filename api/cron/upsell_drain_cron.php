<?php
/**
 * Upsell Drain Cron — Basket 51 only (safe daily runner)
 *
 * Why this exists:
 * - Basket 51 (Upsell) exits only via event-driven order routing. Customers that
 *   land in 51 via Rule P5 (picking_admin_to_upsell) and never get a fresh order
 *   become dead-ended (see root-cause analysis 2026-06-16).
 * - monthly_transfer_web_v2.php DOES handle basket 51 (once fail_after_days is set)
 *   but it reprocesses EVERY basket — unsafe to run daily (would convert the whole
 *   system's monthly cadence to daily).
 * - basket_aging_cron.php uses a DIFFERENT re-evaluate (findMatchingBasket) that would
 *   route 51 → new_customer(38) instead of the distribution-range baskets.
 *
 * This cron replicates ONLY monthly_transfer_web_v2's re-evaluate logic, scoped to
 * basket 51, so it can run daily without touching other baskets.
 *
 * Usage:
 *   Dry run (default): /api/cron/upsell_drain_cron.php?key=basket_transfer_2026_secret&dryrun=1
 *   Live:              /api/cron/upsell_drain_cron.php?key=basket_transfer_2026_secret&dryrun=0
 *   One company:      &company=2     (default: all)
 *
 * @date 2026-06-16
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);
header('Content-Type: text/plain; charset=utf-8');

// ========================
// Security
// ========================
$SECRET_KEY = 'basket_transfer_2026_secret';
if (($_GET['key'] ?? '') !== $SECRET_KEY) {
    http_response_code(403);
    die("Access Denied. Invalid key.\n");
}
define('SKIP_AUTH', true);

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/cron_logger.php';
ini_set('max_execution_time', '1800');

$dryRun = ($_GET['dryrun'] ?? '1') === '1';
$companyParam = $_GET['company'] ?? 'all';

const UPSELL_BASKET_ID = 51;

$logger = new CronLogger('upsell_drain_cron');
$logger->logStart();

echo "===========================================\n";
echo "Upsell Drain Cron (basket 51 only)\n";
echo "Date: " . date('Y-m-d H:i:s') . "\n";
echo "Mode: " . ($dryRun ? "DRY RUN" : "LIVE") . "\n";
echo "Company: $companyParam\n";
echo "===========================================\n\n";

try {
    $pdo = db_connect();
    set_audit_context($pdo, 'upsell_drain_cron', null);

    // ----- Load basket 51 config -----
    $cfg = $pdo->query("
        SELECT fail_after_days, on_fail_basket_key, on_fail_reevaluate, blocked_target_baskets
        FROM basket_config WHERE id = " . UPSELL_BASKET_ID . " AND is_active = 1
    ")->fetch(PDO::FETCH_ASSOC);

    if (!$cfg) {
        echo "ABORT: basket 51 config not found or inactive.\n";
        $logger->logEnd(false);
        exit;
    }

    $failDays = (int) $cfg['fail_after_days'];
    if ($failDays <= 0) {
        echo "ABORT: basket 51 has no fail_after_days configured (got '{$cfg['fail_after_days']}'). Nothing to do.\n";
        $logger->logEnd(false);
        exit;
    }

    $reevaluate = (bool) $cfg['on_fail_reevaluate'];
    $onFailBasketKey = $cfg['on_fail_basket_key'];
    $blocked = array_filter(explode(',', $cfg['blocked_target_baskets'] ?? ''));

    echo "Config: fail_after_days=$failDays, reevaluate=" . ($reevaluate ? '1' : '0')
        . ", on_fail_basket_key=" . ($onFailBasketKey ?: 'NULL')
        . ", blocked=[" . implode(',', $blocked) . "]\n\n";

    // ----- Build basket maps (GLOBAL config) -----
    $allB = $pdo->query("
        SELECT id, basket_key, basket_name, target_page, min_days_since_order, max_days_since_order
        FROM basket_config WHERE is_active = 1
    ")->fetchAll(PDO::FETCH_ASSOC);

    $keyToId = [];
    $idToName = [];
    $idToPage = [];
    $dist = [];
    foreach ($allB as $b) {
        $keyToId[$b['basket_key']] = (string) $b['id'];
        $idToName[(string) $b['id']] = $b['basket_name'];
        $idToPage[(string) $b['id']] = $b['target_page'];
        if ($b['target_page'] === 'distribution' && $b['min_days_since_order'] !== null) {
            $dist[] = [
                'id' => (string) $b['id'],
                'basket_key' => $b['basket_key'],
                'min_days' => (int) $b['min_days_since_order'],
                'max_days' => $b['max_days_since_order'] !== null ? (int) $b['max_days_since_order'] : PHP_INT_MAX,
            ];
        }
    }
    usort($dist, function ($a, $b) {
        return $a['min_days'] - $b['min_days'];
    });

    // ----- Companies -----
    if ($companyParam === 'all') {
        $companies = $pdo->query("SELECT DISTINCT id FROM companies")->fetchAll(PDO::FETCH_COLUMN);
    } else {
        $companies = [(int) $companyParam];
    }

    $grandMoved = 0;
    $grandErrors = 0;

    $selStmt = $pdo->prepare("
        SELECT c.customer_id, c.first_name, c.last_name, c.assigned_to, c.distribution_count,
               DATEDIFF(NOW(), c.basket_entered_date) AS days_in,
               DATEDIFF(NOW(), c.last_order_date) AS days_since_order
        FROM customers c
        WHERE c.company_id = ?
          AND c.current_basket_key = " . UPSELL_BASKET_ID . "
          AND c.basket_entered_date IS NOT NULL
          AND DATEDIFF(NOW(), c.basket_entered_date) >= ?
          AND DATEDIFF(NOW(), c.last_order_date) >= ?
    ");

    foreach ($companies as $companyId) {
        $selStmt->execute([$companyId, $failDays, $failDays]);
        $rows = $selStmt->fetchAll(PDO::FETCH_ASSOC);
        if (!$rows) {
            echo "co$companyId: 0 eligible\n";
            continue;
        }

        $moved = 0;
        foreach ($rows as $r) {
            $cid = $r['customer_id'];
            $dso = (int) $r['days_since_order'];
            $name = trim($r['first_name'] . ' ' . $r['last_name']);

            // ----- Determine target -----
            $targetKey = $onFailBasketKey;
            if ($reevaluate) {
                $targetKey = null;
                foreach ($dist as $d) {
                    if (in_array($d['id'], $blocked)) continue;
                    if ($dso >= $d['min_days'] && $dso <= $d['max_days']) {
                        $targetKey = $d['basket_key'];
                        break;
                    }
                }
                if (!$targetKey) { // closest fallback (ignoring blocked)
                    $best = null;
                    $bestGap = PHP_INT_MAX;
                    foreach ($dist as $d) {
                        if (in_array($d['id'], $blocked)) continue;
                        if ($dso < $d['min_days']) {
                            $gap = $d['min_days'] - $dso;
                        } elseif ($dso > $d['max_days']) {
                            $gap = $dso - $d['max_days'];
                        } else {
                            $gap = 0;
                        }
                        if ($gap < $bestGap) {
                            $bestGap = $gap;
                            $best = $d;
                        }
                    }
                    if ($best) $targetKey = $best['basket_key'];
                }
            }

            if (!$targetKey) {
                echo "  ERR #$cid $name: no target\n";
                $grandErrors++;
                continue;
            }
            $tid = $keyToId[$targetKey] ?? null;
            if (!$tid) {
                echo "  ERR #$cid $name: target '$targetKey' not found\n";
                $grandErrors++;
                continue;
            }

            $targetName = $idToName[$tid] ?? $targetKey;
            $keepAssigned = ($idToPage[$tid] ?? 'distribution') === 'dashboard_v2';

            echo "  -> #$cid $name | {$r['days_in']}d in, {$dso}d order -> $targetName";

            if ($dryRun) {
                echo " [DRY]\n";
                $moved++;
                continue;
            }

            try {
                $assignedTo = $r['assigned_to'] !== null ? (int) $r['assigned_to'] : null;
                if ($keepAssigned) {
                    $u = $pdo->prepare("
                        UPDATE customers SET current_basket_key = ?, basket_entered_date = NOW(),
                               distribution_count = distribution_count + 1
                        WHERE customer_id = ?
                    ");
                    $u->execute([$tid, $cid]);
                    $assignedToNew = $assignedTo;
                } else {
                    $u = $pdo->prepare("
                        UPDATE customers SET current_basket_key = ?, basket_entered_date = NOW(),
                               assigned_to = NULL, distribution_count = distribution_count + 1
                        WHERE customer_id = ?
                    ");
                    $u->execute([$tid, $cid]);
                    $assignedToNew = null;
                }

                $note = "Upsell daily drain: stuck {$r['days_in']}d in Upsell -> $targetName (dso={$dso}d)";
                $lg = $pdo->prepare("
                    INSERT INTO basket_transition_log
                        (customer_id, from_basket_key, to_basket_key, assigned_to_old, assigned_to_new,
                         transition_type, triggered_by, notes, created_at)
                    VALUES (?, " . UPSELL_BASKET_ID . ", ?, ?, ?, 'monthly_cron', ?, ?, NOW())
                ");
                $lg->execute([$cid, $tid, $assignedTo, $assignedToNew, $assignedTo, $note]);

                $rl = $pdo->prepare("
                    INSERT INTO basket_return_log
                        (customer_id, previous_assigned_to, reason, days_since_last_order, batch_date, created_at)
                    VALUES (?, ?, ?, ?, CURDATE(), NOW())
                ");
                $rl->execute([$cid, $assignedTo, "Upsell drain: exceeded {$failDays}d in Upsell", $dso]);

                echo " [OK]\n";
                $moved++;
            } catch (Exception $e) {
                echo " [ERR " . $e->getMessage() . "]\n";
                $grandErrors++;
            }
        }
        echo "co$companyId: " . ($dryRun ? 'WOULD MOVE ' : 'MOVED ') . "$moved (eligible=" . count($rows) . ")\n";
        $grandMoved += $moved;
    }

    echo "\n===========================================\n";
    echo "SUMMARY: " . ($dryRun ? 'Would move' : 'Moved') . " $grandMoved, Errors $grandErrors\n";
    echo "===========================================\n";

    $logger->log(($dryRun ? "DRY: would move" : "LIVE: moved") . " $grandMoved, errors $grandErrors");
    $logger->logEnd($grandMoved > 0 || $grandErrors > 0);

} catch (Exception $e) {
    $logger->logError($e->getMessage());
    echo "FATAL: " . $e->getMessage() . "\n";
    exit(1);
}
