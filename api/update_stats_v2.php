<?php
/**
 * Unified Customer Statistics Batch Recalculation
 * ================================================
 * Single Source of Truth: uses recalculate_customer_full_stats()
 * from Services/CustomerStatsHelper.php — the SAME logic that the
 * event-driven API uses, so calculations never diverge.
 *
 * Features:
 * - Configurable batch size via ?batch=N  (default 50, max 500)
 * - No transactions (prevents long locks on shared hosting)
 * - Checkpoint support (auto-resume if interrupted)
 * - Auto-stop after 55 minutes (prevents hosting kill)
 * - Lock file prevents concurrent runs
 * - File-based JSON progress reporting
 * - Future-date guard on last_order_date
 * - Grade calculation (A/B/C/D)
 *
 * Usage:
 *   Start:    /api/update_stats_v2.php
 *   Fast:     /api/update_stats_v2.php?batch=200
 *   Reset:    /api/update_stats_v2.php?reset=1
 *   Progress: /api/update_stats_progress.php
 *
 * Replaces: update_stats.php, update_stats_safe.php, update_stats_ultra_safe.php
 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/Services/CustomerStatsHelper.php';

set_time_limit(0);
ini_set('memory_limit', '256M');

// --- Configuration ---
$BATCH_SIZE          = max(10, min(500, (int) ($_GET['batch'] ?? 50)));
$PAUSE_SECONDS       = $BATCH_SIZE <= 50 ? 0.5 : ($BATCH_SIZE <= 100 ? 0.2 : 0.1);
$MAX_RUNTIME_MINUTES = 55;

$start_time      = time();
$checkpoint_file = __DIR__ . '/update_stats_checkpoint.txt';
$progress_file   = __DIR__ . '/update_stats_progress.json';
$lock_file       = __DIR__ . '/update_stats.lock';

// --- Auth check (require admin token or CLI) ---
$isCli = php_sapi_name() === 'cli';
if (!$isCli) {
    cors();
    $pdo_auth = db_connect();
    $user = get_authenticated_user($pdo_auth);
    if (!$user || !in_array($user['role'] ?? '', ['SuperAdmin', 'Admin'])) {
        header('Content-Type: application/json');
        echo json_encode(['error' => 'UNAUTHORIZED', 'message' => 'Admin role required'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $pdo_auth = null; // release
}

// --- Helper functions ---
function update_progress(array $data): void {
    global $progress_file;
    $data['updated_at'] = date('Y-m-d H:i:s');
    file_put_contents($progress_file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

function save_checkpoint(int $offset): void {
    global $checkpoint_file;
    file_put_contents($checkpoint_file, $offset);
}

function load_checkpoint(): int {
    global $checkpoint_file;
    return file_exists($checkpoint_file) ? (int) file_get_contents($checkpoint_file) : 0;
}

function clear_checkpoint(): void {
    global $checkpoint_file, $lock_file;
    @unlink($checkpoint_file);
    @unlink($lock_file);
}

// --- Reset mode ---
if (isset($_GET['reset']) && $_GET['reset'] === '1') {
    clear_checkpoint();
    @unlink($progress_file);
    header('Content-Type: application/json');
    echo json_encode(['ok' => true, 'message' => 'Checkpoint and lock cleared']);
    exit;
}

// --- Lock check ---
if (file_exists($lock_file)) {
    $lock_time = filemtime($lock_file);
    if (time() - $lock_time < 3600) {
        header('Content-Type: application/json');
        echo json_encode([
            'status'           => 'already_running',
            'message'          => 'Script is already running. Check progress at api/update_stats_progress.php',
            'lock_age_seconds' => time() - $lock_time,
        ]);
        exit;
    }
    unlink($lock_file); // stale lock
}

// Create lock
file_put_contents($lock_file, date('Y-m-d H:i:s'));

header('Content-Type: application/json');

try {
    $pdo = db_connect();
    $pdo->exec("SET SESSION innodb_lock_wait_timeout = 10");

    $stmt            = $pdo->query("SELECT COUNT(*) FROM customers");
    $total_customers = (int) $stmt->fetchColumn();

    $processed = load_checkpoint();

    update_progress([
        'status'     => 'running',
        'total'      => $total_customers,
        'processed'  => $processed,
        'percent'    => $total_customers > 0 ? round(($processed / $total_customers) * 100, 1) : 0,
        'batch_size' => $BATCH_SIZE,
        'started_at' => date('Y-m-d H:i:s'),
        'message'    => $processed > 0 ? "Resuming from checkpoint {$processed}..." : 'Starting update...',
    ]);

    // Quick response to browser (background continues)
    echo json_encode([
        'status'        => 'started',
        'total'         => $total_customers,
        'resuming_from' => $processed,
        'batch_size'    => $BATCH_SIZE,
        'message'       => 'Update started. Check progress at api/update_stats_progress.php',
    ]);

    if (function_exists('fastcgi_finish_request')) {
        fastcgi_finish_request();
    } else {
        ignore_user_abort(true);
        header('Connection: close');
        header('Content-Length: ' . ob_get_length());
        ob_end_flush();
        flush();
    }

    // --- Main processing loop ---
    $batch_count = 0;
    $error_count = 0;

    while ($processed < $total_customers) {
        // Check max runtime
        $elapsed_minutes = (time() - $start_time) / 60;
        if ($elapsed_minutes >= $MAX_RUNTIME_MINUTES) {
            update_progress([
                'status'    => 'paused',
                'total'     => $total_customers,
                'processed' => $processed,
                'percent'   => round(($processed / $total_customers) * 100, 1),
                'message'   => "Auto-stopped at {$MAX_RUNTIME_MINUTES} min. Run again to continue.",
                'errors'    => $error_count,
            ]);
            save_checkpoint($processed);
            @unlink($lock_file);
            exit;
        }

        // Get batch of customer IDs
        $stmt = $pdo->prepare("SELECT customer_id FROM customers ORDER BY customer_id LIMIT :limit OFFSET :offset");
        $stmt->bindValue(':limit',  $BATCH_SIZE, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $processed,  PDO::PARAM_INT);
        $stmt->execute();
        $customer_ids = $stmt->fetchAll(PDO::FETCH_COLUMN);

        if (empty($customer_ids)) break;

        // Update each customer using the shared helper (Single Source of Truth)
        foreach ($customer_ids as $cid) {
            try {
                recalculate_customer_full_stats($pdo, (int) $cid);
            } catch (Throwable $e) {
                $error_count++;
            }
        }

        $processed += count($customer_ids);
        $batch_count++;

        // Update progress file every batch
        $elapsed_minutes = (time() - $start_time) / 60;
        update_progress([
            'status'          => 'running',
            'total'           => $total_customers,
            'processed'       => $processed,
            'percent'         => round(($processed / $total_customers) * 100, 1),
            'batch'           => $batch_count,
            'elapsed_minutes' => round($elapsed_minutes, 1),
            'errors'          => $error_count,
            'message'         => 'Processing...',
        ]);

        // Save checkpoint every 10 batches
        if ($batch_count % 10 === 0) {
            save_checkpoint($processed);
        }

        // Pause to let MySQL breathe
        usleep((int) ($PAUSE_SECONDS * 1_000_000));
    }

    // Done!
    update_progress([
        'status'          => 'completed',
        'total'           => $total_customers,
        'processed'       => $processed,
        'percent'         => 100,
        'elapsed_minutes' => round((time() - $start_time) / 60, 1),
        'errors'          => $error_count,
        'message'         => 'Update completed successfully!',
    ]);

    clear_checkpoint();

} catch (Throwable $e) {
    update_progress([
        'status'    => 'error',
        'message'   => $e->getMessage(),
        'processed' => $processed ?? 0,
    ]);
    @unlink($lock_file);
}
