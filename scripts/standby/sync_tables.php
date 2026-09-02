<?php
/**
 * Orders Sync: Fetch only Pending orders + related data from production
 * and write them into the local standby database.
 *
 * This is NOT a full table dump. It uses targeted SQL SELECTs to pull
 * only what the Standby Export Tool needs (~3,000 orders, ~40,000 total rows).
 *
 * Designed to run via Windows Task Scheduler every 1 minute
 * during business hours (08:00–13:00, Mon–Sat).
 *
 * Usage (CLI only):
 *   php scripts/standby/sync_tables.php
 */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    die('CLI only');
}

set_time_limit(120); // 2 min max (should finish in ~5 sec)
date_default_timezone_set('Asia/Bangkok');

require_once __DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR
    . 'backup' . DIRECTORY_SEPARATOR . 'job.php';

// ─── Configuration ──────────────────────────────────────────────────────────

const SYNC_BATCH_SIZE = 500; // INSERT batch size

// ─── Helpers ────────────────────────────────────────────────────────────────

function sync_log_dir(string $work): string
{
    return $work . DIRECTORY_SEPARATOR . 'sync';
}

function sync_log_path(string $work): string
{
    return sync_log_dir($work) . DIRECTORY_SEPARATOR . 'sync_log.json';
}

function sync_write_log(string $work, array $data): void
{
    $dir = sync_log_dir($work);
    if (!is_dir($dir)) mkdir($dir, 0777, true);
    $data['updated_at'] = date('c');
    file_put_contents(
        sync_log_path($work),
        json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT),
        LOCK_EX
    );
}

function sync_msg(string $msg): void
{
    echo "[" . date('H:i:s') . "] $msg\n";
}

/**
 * Connect to a MySQL database via PDO.
 */
function sync_connect(string $host, string $port, string $user, string $pass, string $db): PDO
{
    $dsn = "mysql:host=$host;port=$port;dbname=$db;charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
    $pdo->exec("SET SESSION sql_mode='NO_ENGINE_SUBSTITUTION'");
    $pdo->exec("SET time_zone = '+07:00'");
    return $pdo;
}

/**
 * Batch INSERT rows into a local table.
 * Uses INSERT IGNORE to skip duplicates gracefully.
 */
function sync_insert_batch(PDO $pdo, string $table, array $rows): int
{
    if (empty($rows)) return 0;

    $cols = array_keys($rows[0]);
    $colList = '`' . implode('`, `', $cols) . '`';
    $placeholderRow = '(' . implode(', ', array_fill(0, count($cols), '?')) . ')';

    $inserted = 0;
    foreach (array_chunk($rows, SYNC_BATCH_SIZE) as $chunk) {
        $placeholders = implode(', ', array_fill(0, count($chunk), $placeholderRow));
        $sql = "INSERT IGNORE INTO `$table` ($colList) VALUES $placeholders";

        $values = [];
        foreach ($chunk as $row) {
            foreach ($cols as $col) {
                $values[] = $row[$col] ?? null;
            }
        }

        $stmt = $pdo->prepare($sql);
        $stmt->execute($values);
        $inserted += $stmt->rowCount();
    }

    return $inserted;
}

/**
 * Clone table structure from production to local (CREATE TABLE IF NOT EXISTS).
 */
function sync_ensure_table(PDO $prodPdo, PDO $localPdo, string $table): void
{
    $stmt = $prodPdo->query("SHOW CREATE TABLE `$table`");
    $row = $stmt->fetch();
    if (!$row) return;

    $createSql = $row['Create Table'] ?? '';
    // Replace CREATE TABLE with CREATE TABLE IF NOT EXISTS
    $createSql = preg_replace('/^CREATE TABLE/', 'CREATE TABLE IF NOT EXISTS', $createSql);
    $localPdo->exec($createSql);
}

// ─── Main ───────────────────────────────────────────────────────────────────

$env  = backup_env();
$work = backup_workdir($env);
backup_ensure_dirs($work);

// Production MySQL credentials
$prodHost = $env['MYSQL_HOST'] ?? '202.183.192.218';
$prodPort = $env['MYSQL_PORT'] ?? '3306';
$prodUser = $env['MYSQL_USER'] ?? 'primacom_mini_erp_backup';
$prodPass = $env['MYSQL_PASSWORD'] ?? '';
$prodDb   = $env['MYSQL_DATABASE'] ?? 'primacom_mini_erp';

// Local MySQL credentials
$localUser = $env['LOCAL_MYSQL_USER'] ?? 'root';
$localPass = $env['LOCAL_MYSQL_PASS'] ?? '';
$localDb   = $env['STANDBY_DB_NAME'] ?? 'standby_erp';

if ($prodPass === '') {
    sync_msg('ERROR: MYSQL_PASSWORD is not set in .env');
    sync_write_log($work, ['status' => 'error', 'error' => 'MYSQL_PASSWORD not set', 'started_at' => date('c')]);
    exit(1);
}

$startedAt = date('c');
$startTime = microtime(true);

sync_msg("Starting Pending orders sync from $prodHost:$prodPort/$prodDb");
sync_write_log($work, ['status' => 'running', 'started_at' => $startedAt, 'error' => null]);

try {
    // ─── Connect to both databases ──────────────────────────────────────
    $prodPdo = sync_connect($prodHost, $prodPort, $prodUser, $prodPass, $prodDb);
    sync_msg("Connected to production");

    // Ensure local database exists
    $localPdoInit = new PDO("mysql:host=127.0.0.1;charset=utf8mb4", $localUser, $localPass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
    $localPdoInit->exec("CREATE DATABASE IF NOT EXISTS `$localDb` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $localPdoInit = null;

    $localPdo = sync_connect('127.0.0.1', '3306', $localUser, $localPass, $localDb);
    sync_msg("Connected to local standby");

    // ─── Step 1: Fetch Pending orders ───────────────────────────────────
    $orders = $prodPdo->query("
        SELECT * FROM orders WHERE order_status = 'Pending'
    ")->fetchAll();

    $orderCount = count($orders);
    sync_msg("Found $orderCount Pending orders");

    if ($orderCount === 0) {
        $elapsed = round(microtime(true) - $startTime, 1);
        sync_write_log($work, [
            'status' => 'done', 'started_at' => $startedAt, 'finished_at' => date('c'),
            'elapsed_sec' => $elapsed, 'row_counts' => ['orders' => 0], 'error' => null,
        ]);
        sync_msg("✅ No Pending orders — done ({$elapsed}s)");
        exit(0);
    }

    $orderIds     = array_column($orders, 'id');
    $customerIds  = array_unique(array_filter(array_column($orders, 'customer_id')));
    $creatorIds   = array_unique(array_filter(array_column($orders, 'creator_id')));

    // ─── Step 2: Fetch related data ─────────────────────────────────────

    // Order Items
    $placeholders = implode(',', array_fill(0, count($orderIds), '?'));
    $stmt = $prodPdo->prepare("SELECT * FROM order_items WHERE parent_order_id IN ($placeholders)");
    $stmt->execute($orderIds);
    $orderItems = $stmt->fetchAll();
    sync_msg("  order_items: " . count($orderItems) . " rows");

    // Collect product IDs from items
    $productIds = array_unique(array_filter(array_column($orderItems, 'product_id')));

    // Order Boxes
    $stmt = $prodPdo->prepare("SELECT * FROM order_boxes WHERE order_id IN ($placeholders)");
    $stmt->execute($orderIds);
    $orderBoxes = $stmt->fetchAll();
    sync_msg("  order_boxes: " . count($orderBoxes) . " rows");

    // Order Tracking Numbers
    $stmt = $prodPdo->prepare("SELECT * FROM order_tracking_numbers WHERE parent_order_id IN ($placeholders)");
    $stmt->execute($orderIds);
    $orderTracking = $stmt->fetchAll();
    sync_msg("  order_tracking_numbers: " . count($orderTracking) . " rows");

    // Customers
    $customers = [];
    if (!empty($customerIds)) {
        $cp = implode(',', array_fill(0, count($customerIds), '?'));
        $stmt = $prodPdo->prepare("SELECT * FROM customers WHERE customer_id IN ($cp)");
        $stmt->execute(array_values($customerIds));
        $customers = $stmt->fetchAll();
    }
    sync_msg("  customers: " . count($customers) . " rows");

    // Products
    $products = [];
    if (!empty($productIds)) {
        $pp = implode(',', array_fill(0, count($productIds), '?'));
        $stmt = $prodPdo->prepare("SELECT * FROM products WHERE id IN ($pp)");
        $stmt->execute(array_values($productIds));
        $products = $stmt->fetchAll();
    }
    sync_msg("  products: " . count($products) . " rows");

    // Users
    $users = [];
    if (!empty($creatorIds)) {
        $up = implode(',', array_fill(0, count($creatorIds), '?'));
        $stmt = $prodPdo->prepare("SELECT * FROM users WHERE id IN ($up)");
        $stmt->execute(array_values($creatorIds));
        $users = $stmt->fetchAll();
    }
    sync_msg("  users: " . count($users) . " rows");

    // ─── Step 3: Ensure local table schemas exist ───────────────────────
    $tables = ['orders', 'order_items', 'order_boxes', 'order_tracking_numbers', 'customers', 'products', 'users'];
    foreach ($tables as $t) {
        sync_ensure_table($prodPdo, $localPdo, $t);
    }

    // ─── Step 4: Write to local MySQL (atomic swap) ─────────────────────
    $localPdo->beginTransaction();

    // Truncate all tables first
    // Disable FK checks temporarily for clean truncate
    $localPdo->exec("SET FOREIGN_KEY_CHECKS = 0");
    foreach ($tables as $t) {
        $localPdo->exec("TRUNCATE TABLE `$t`");
    }
    $localPdo->exec("SET FOREIGN_KEY_CHECKS = 1");

    // Insert all data
    $counts = [];
    $counts['orders']                 = sync_insert_batch($localPdo, 'orders', $orders);
    $counts['order_items']            = sync_insert_batch($localPdo, 'order_items', $orderItems);
    $counts['order_boxes']            = sync_insert_batch($localPdo, 'order_boxes', $orderBoxes);
    $counts['order_tracking_numbers'] = sync_insert_batch($localPdo, 'order_tracking_numbers', $orderTracking);
    $counts['customers']              = sync_insert_batch($localPdo, 'customers', $customers);
    $counts['products']               = sync_insert_batch($localPdo, 'products', $products);
    $counts['users']                  = sync_insert_batch($localPdo, 'users', $users);

    $localPdo->commit();

    // ─── Step 5: Log success ────────────────────────────────────────────
    $elapsed   = round(microtime(true) - $startTime, 1);
    $totalRows = array_sum($counts);

    sync_write_log($work, [
        'status'      => 'done',
        'started_at'  => $startedAt,
        'finished_at' => date('c'),
        'elapsed_sec' => $elapsed,
        'row_counts'  => $counts,
        'total_rows'  => $totalRows,
        'error'       => null,
    ]);

    sync_msg("✅ Sync done — $totalRows rows across " . count($tables) . " tables ({$elapsed}s)");

} catch (\Exception $e) {
    $elapsed = round(microtime(true) - $startTime, 1);
    $error   = $e->getMessage();

    // Don't overwrite local data on connection failure
    sync_msg("❌ ERROR ({$elapsed}s): $error");
    sync_write_log($work, [
        'status'      => 'error',
        'started_at'  => $startedAt,
        'elapsed_sec' => $elapsed,
        'error'       => substr($error, 0, 500),
    ]);
    exit(1);
}
