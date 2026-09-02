<?php
/**
 * Office-only backup helper. DO NOT deploy under public_html.
 * Bind to 127.0.0.1 only: php -S 127.0.0.1:8787 -t scripts/backup
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$remote = $_SERVER['REMOTE_ADDR'] ?? '';
if (!in_array($remote, ['127.0.0.1', '::1'], true)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'message' => 'localhost only']);
    exit;
}

require_once __DIR__ . DIRECTORY_SEPARATOR . 'job.php';

function backup_json($data, int $code = 200): void
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$env = backup_env();
$action = $_GET['action'] ?? $_POST['action'] ?? 'status';
$work = backup_workdir($env);
backup_ensure_dirs($work);

if ($action === 'status') {
    $files = [];
    if (is_dir($work)) {
        foreach (glob($work . DIRECTORY_SEPARATOR . '*.sql.gz') ?: [] as $f) {
            $files[] = [
                'name' => basename($f),
                'size' => filesize($f),
                'mtime' => date('c', filemtime($f)),
            ];
        }
    }
    usort($files, fn($a, $b) => strcmp($b['mtime'], $a['mtime']));
    $job = backup_job_reconcile($work, backup_job_read($work));
    
    // Read standby sync log lightly
    $syncLog = null;
    $syncPath = $work . DIRECTORY_SEPARATOR . 'sync' . DIRECTORY_SEPARATOR . 'sync_log.json';
    if (is_file($syncPath)) {
        $syncLog = json_decode((string) file_get_contents($syncPath), true);
    }

    backup_json([
        'ok' => true,
        'workdir' => $work,
        'env_present' => is_readable(dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . '.env')
            || is_readable(__DIR__ . DIRECTORY_SEPARATOR . '.env'),
        'rclone_dest' => $env['RCLONE_DEST'] ?? '',
        'files' => $files,
        'job' => $job,
        'busy' => backup_job_is_busy($job),
        'hint' => 'กด Dump แล้วอัป Drive จากเครื่องนี้เท่านั้น ห้ามวางสคริปต์นี้บนโฮสต์',
        'standby_sync' => $syncLog ? [
            'finished_at' => $syncLog['finished_at'] ?? $syncLog['started_at'] ?? null
        ] : null
    ]);
}

if ($action === 'job') {
    $job = backup_job_reconcile($work, backup_job_read($work));
    backup_json([
        'ok' => true,
        'job' => $job,
        'busy' => backup_job_is_busy($job),
    ]);
}

if ($action === 'dump') {
    $mysqldump = $env['MYSQLDUMP'] ?? 'C:\\xampp\\mysql\\bin\\mysqldump.exe';
    $gzip = $env['GZIP'] ?? 'C:\\Program Files\\Git\\usr\\bin\\gzip.exe';
    if (!is_file($mysqldump) || !is_file($gzip)) {
        backup_json(['ok' => false, 'message' => 'ไม่พบ mysqldump หรือ gzip'], 500);
    }
    if (($env['MYSQL_PASSWORD'] ?? '') === '') {
        backup_json(['ok' => false, 'message' => 'ใส่ MYSQL_PASSWORD ใน .env ที่รากโปรเจกต์ (หรือ overlay ที่ scripts/backup/.env)'], 400);
    }
    $existing = backup_job_reconcile($work, backup_job_read($work));
    if (backup_job_is_busy($existing)) {
        backup_json(['ok' => false, 'message' => 'มีงานกำลังรันอยู่ รอให้จบก่อน'], 409);
    }
    $stamp = date('Ymd_His');
    $file = 'primacom_mini_erp_' . $stamp . '.sql.gz';
    $job = backup_job_new('dump', $file, backup_prev_dump_bytes($work));
    backup_job_write($work, $job);
    backup_spawn_worker('dump');
    backup_json([
        'ok' => true,
        'started' => true,
        'file' => $file,
        'job' => $job,
        'note' => 'dump รันพื้นหลัง — หน้าเว็บจะอัปเดต progress เอง',
    ]);
}

if ($action === 'upload') {
    $dest = trim($env['RCLONE_DEST'] ?? '');
    $file = basename((string) ($_POST['file'] ?? $_GET['file'] ?? ''));
    if ($dest === '') {
        backup_json(['ok' => false, 'message' => 'ตั้ง RCLONE_DEST ใน .env ที่รากโปรเจกต์ หลัง rclone config หรืออัปด้วยมือบน Drive'], 400);
    }
    if ($file === '' || !preg_match('/^[\w.-]+\.sql\.gz$/', $file)) {
        backup_json(['ok' => false, 'message' => 'ชื่อไฟล์ไม่ถูกต้อง'], 400);
    }
    $full = $work . DIRECTORY_SEPARATOR . $file;
    if (!is_file($full)) {
        backup_json(['ok' => false, 'message' => 'ไม่พบไฟล์'], 404);
    }
    $rcloneBin = trim((string) ($env['RCLONE'] ?? ''));
    if ($rcloneBin === '') {
        $rcloneBin = 'rclone';
    }
    if ($rcloneBin !== 'rclone' && !is_file($rcloneBin)) {
        backup_json(['ok' => false, 'message' => 'ไม่พบ rclone ตาม RCLONE ใน .env'], 500);
    }
    $existing = backup_job_reconcile($work, backup_job_read($work));
    if (backup_job_is_busy($existing)) {
        backup_json(['ok' => false, 'message' => 'มีงานกำลังรันอยู่ รอให้จบก่อน'], 409);
    }
    $job = backup_job_new('upload', $file, (int) filesize($full));
    backup_job_write($work, $job);
    backup_spawn_worker('upload', $file);
    backup_json([
        'ok' => true,
        'started' => true,
        'file' => $file,
        'job' => $job,
    ]);
}

if ($action === 'delete_file') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        backup_json(['ok' => false, 'message' => 'POST required'], 405);
    }
    $input = json_decode(file_get_contents('php://input'), true);
    $file = trim((string)($input['file'] ?? ''));
    if (!preg_match('/^[\w\.-]+$/', $file) || strpos($file, '..') !== false) {
        backup_json(['ok' => false, 'message' => 'ชื่อไฟล์ไม่ถูกต้อง'], 400);
    }
    $full = $work . DIRECTORY_SEPARATOR . $file;
    if (!is_file($full)) {
        backup_json(['ok' => false, 'message' => 'ไม่พบไฟล์'], 404);
    }
    if (unlink($full)) {
        backup_json(['ok' => true, 'message' => 'ลบไฟล์สำเร็จ']);
    } else {
        backup_json(['ok' => false, 'message' => 'ลบไฟล์ไม่ได้ (อาจติด permission)'], 500);
    }
}
// ═══════════════════════════════════════════════════════════════════════════════
// Standby Export Actions (merged from scripts/standby/web/api.php)
// ═══════════════════════════════════════════════════════════════════════════════

function standby_db(array $env): ?PDO
{
    $user = $env['LOCAL_MYSQL_USER'] ?? 'root';
    $pass = $env['LOCAL_MYSQL_PASS'] ?? '';
    $db   = $env['STANDBY_DB_NAME'] ?? 'standby_erp';
    try {
        return new PDO(
            "mysql:host=127.0.0.1;dbname=$db;charset=utf8mb4",
            $user, $pass,
            [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]
        );
    } catch (\PDOException $e) {
        return null;
    }
}

function standby_read_sync_log(string $work): ?array
{
    $path = $work . DIRECTORY_SEPARATOR . 'sync' . DIRECTORY_SEPARATOR . 'sync_log.json';
    if (!is_file($path)) return null;
    return json_decode((string) file_get_contents($path), true) ?: null;
}

function standby_read_health_state(string $work): ?array
{
    $path = $work . DIRECTORY_SEPARATOR . 'sync' . DIRECTORY_SEPARATOR . 'health_state.json';
    if (!is_file($path)) return null;
    return json_decode((string) file_get_contents($path), true) ?: null;
}

function standby_check_server(array $env): bool
{
    $url = $env['HEALTH_CHECK_URL'] ?? 'https://prima49.com/mini_erp/api/health.php';
    if (empty($url)) return false;

    $ctx = stream_context_create([
        'http' => ['timeout' => 5, 'ignore_errors' => true],
        'ssl'  => ['verify_peer' => false, 'verify_peer_name' => false],
    ]);
    $res = @file_get_contents($url, false, $ctx);
    if ($res === false) return false;
    $data = json_decode($res, true);
    return is_array($data) && ($data['db'] ?? '') === 'up';
}

if ($action === 'standby_status') {
    $syncLog = standby_read_sync_log($work);
    $healthState = standby_read_health_state($work);
    $serverUp = standby_check_server($env);

    // Cleanup log
    $cleanupLog = null;
    $cleanupDir = $work . DIRECTORY_SEPARATOR . 'cleanup_logs';
    if (is_dir($cleanupDir)) {
        $logs = glob($cleanupDir . DIRECTORY_SEPARATOR . 'cleanup_*.log');
        if ($logs) {
            usort($logs, fn($a, $b) => filemtime($b) - filemtime($a));
            $cleanupLog = ['file' => basename($logs[0]), 'mtime' => date('c', filemtime($logs[0]))];
        }
    }

    // Disk usage of dump files
    $dumpFiles = glob($work . DIRECTORY_SEPARATOR . '*.sql.gz') ?: [];
    $totalSize = 0;
    foreach ($dumpFiles as $f) $totalSize += filesize($f);

    backup_json([
        'ok' => true,
        'sync' => $syncLog ? [
            'status'      => $syncLog['status'] ?? 'unknown',
            'finished_at' => $syncLog['finished_at'] ?? $syncLog['started_at'] ?? null,
            'elapsed_sec' => $syncLog['elapsed_sec'] ?? null,
            'row_counts'  => $syncLog['row_counts'] ?? null,
            'total_rows'  => $syncLog['total_rows'] ?? null,
            'error'       => $syncLog['error'] ?? null,
        ] : null,
        'server_up'    => $serverUp,
        'health_state' => $healthState ? [
            'server_up'  => $healthState['server_up'] ?? null,
            'down_since' => $healthState['down_since'] ?? null,
            'last_check' => $healthState['last_check_at'] ?? null,
        ] : null,
        'cleanup'      => $cleanupLog,
        'disk'         => [
            'dump_files'  => count($dumpFiles),
            'total_bytes' => $totalSize,
        ],
    ]);
}

if ($action === 'standby_orders') {
    $pdo = standby_db($env);
    if (!$pdo) {
        backup_json(['ok' => false, 'message' => 'ไม่สามารถเชื่อมต่อ Local standby database — เคยรัน sync_tables.php หรือยัง?'], 500);
    }

    $today = date('Y-m-d');
    $dateFilter = $_GET['date'] ?? $today;

    $stmt = $pdo->query("
        SELECT o.*,
               c.first_name AS customer_first_name,
               c.last_name AS customer_last_name,
               c.phone AS customer_phone,
               c.street AS customer_street,
               c.subdistrict AS customer_subdistrict,
               c.district AS customer_district,
               c.province AS customer_province,
               c.postal_code AS customer_postal_code,
               comp.name AS company_name
        FROM orders o
        LEFT JOIN customers c ON c.customer_id = o.customer_id
        LEFT JOIN companies comp ON comp.id = o.company_id
        WHERE o.order_status = 'Pending'
        ORDER BY o.order_date DESC
    ");
    $orders = $stmt->fetchAll();

    if (!empty($orders)) {
        $orderIds = array_column($orders, 'id');
        $ph = implode(',', array_fill(0, count($orderIds), '?'));

        $itemStmt = $pdo->prepare("
            SELECT oi.*, p.name AS product_name, p.sku, p.shop
            FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
            WHERE oi.parent_order_id IN ($ph) ORDER BY oi.parent_order_id, oi.id
        ");
        $itemStmt->execute($orderIds);
        $allItems = $itemStmt->fetchAll();

        $boxStmt = $pdo->prepare("SELECT ob.* FROM order_boxes ob WHERE ob.order_id IN ($ph) ORDER BY ob.order_id, ob.box_number");
        $boxStmt->execute($orderIds);
        $allBoxes = $boxStmt->fetchAll();

        $itemsByOrder = [];
        foreach ($allItems as $it) $itemsByOrder[$it['parent_order_id']][] = $it;
        $boxesByOrder = [];
        foreach ($allBoxes as $bx) $boxesByOrder[$bx['order_id']][] = $bx;

        foreach ($orders as &$o) {
            $o['items'] = $itemsByOrder[$o['id']] ?? [];
            $o['boxes'] = $boxesByOrder[$o['id']] ?? [];
        }
        unset($o);
    }

    backup_json(['ok' => true, 'orders' => $orders, 'count' => count($orders), 'date' => $dateFilter]);
}

if ($action === 'standby_export') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        backup_json(['ok' => false, 'message' => 'POST required'], 405);
    }
    $input = json_decode(file_get_contents('php://input'), true);
    $orderIds = $input['orderIds'] ?? [];
    $companyName = trim((string)($input['companyName'] ?? 'export'));
    
    if (empty($orderIds) || !is_array($orderIds)) {
        backup_json(['ok' => false, 'message' => 'orderIds required'], 400);
    }

    $pdo = standby_db($env);
    if (!$pdo) {
        backup_json(['ok' => false, 'message' => 'ไม่สามารถเชื่อมต่อ Local standby database'], 500);
    }

    $orderIds = array_slice($orderIds, 0, 500);
    $ph = implode(',', array_fill(0, count($orderIds), '?'));

    $stmt = $pdo->prepare("
        SELECT o.*, c.first_name AS customer_first_name, c.last_name AS customer_last_name,
               c.phone AS customer_phone, c.street AS customer_street,
               c.subdistrict AS customer_subdistrict, c.district AS customer_district,
               c.province AS customer_province, c.postal_code AS customer_postal_code
        FROM orders o LEFT JOIN customers c ON c.customer_id = o.customer_id
        WHERE o.id IN ($ph)
    ");
    $stmt->execute($orderIds);
    $orders = $stmt->fetchAll();

    $foundIds = array_column($orders, 'id');
    if (empty($foundIds)) {
        backup_json(['ok' => false, 'message' => 'ไม่พบออเดอร์'], 404);
    }

    $fp = implode(',', array_fill(0, count($foundIds), '?'));
    $itemStmt = $pdo->prepare("SELECT oi.*, p.name AS product_name, p.sku, p.shop FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id WHERE oi.parent_order_id IN ($fp) ORDER BY oi.parent_order_id, oi.id");
    $itemStmt->execute($foundIds);
    $allItems = $itemStmt->fetchAll();

    $boxStmt = $pdo->prepare("SELECT ob.* FROM order_boxes ob WHERE ob.order_id IN ($fp) ORDER BY ob.order_id, ob.box_number");
    $boxStmt->execute($foundIds);
    $allBoxes = $boxStmt->fetchAll();

    $itemsByOrder = [];
    foreach ($allItems as $it) $itemsByOrder[$it['parent_order_id']][] = $it;
    $boxesByOrder = [];
    foreach ($allBoxes as $bx) $boxesByOrder[$bx['order_id']][] = $bx;

    $creatorIds = array_unique(array_filter(array_column($orders, 'creator_id')));
    $creatorNames = [];
    if (!empty($creatorIds)) {
        $cp = implode(',', array_fill(0, count($creatorIds), '?'));
        $us = $pdo->prepare("SELECT id, first_name, last_name FROM users WHERE id IN ($cp)");
        $us->execute(array_values($creatorIds));
        foreach ($us->fetchAll() as $u) {
            $creatorNames[$u['id']] = trim(($u['first_name'] ?? '') . ' ' . ($u['last_name'] ?? ''));
        }
    }

    // Safe filename
    $safeName = preg_replace('/[^a-zA-Z0-9_\x{0E00}-\x{0E7F}]/u', '_', $companyName);
    if (empty($safeName)) $safeName = 'export';

    // Output CSV
    header_remove('Content-Type');
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="standby_' . $safeName . '_' . date('Ymd_His') . '.csv"');

    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF");

    fputcsv($out, [
        'หมายเลขออเดอร์ออนไลน์','ชื่อร้านค้า','เวลาที่สั่งซื้อ','บัญชีร้านค้า','หมายเลขใบชำระเงิน',
        'COD','ช่องทางชำระเงิน','เวลาชำระเงิน','หมายเหตุใบสั่งซื้อ','ข้อความจากร้านค้า',
        'ค่าขนส่ง','จำนวนเงินที่ต้องชำระ','ผู้รับสินค้า','นามสกุลผู้รับสินค้า','หมายเลขโทรศัพท์',
        'หมายเลขมือถือ','สถานที่','ภูมิภาค','อำเภอ','จังหวัด','รหัสไปรษณีย์','ประเทศ',
        'รับสินค้าที่ร้านหรือไม่','รหัสสินค้าบนแพลตฟอร์ม','รหัสสินค้าในระบบ','ชื่อสินค้า',
        'สีและรูปแบบ','จำนวน','ราคาสินค้าต่อหน่วย','บริษัทขนส่ง','หมายเลขขนส่ง','เวลาส่งสินค้า',
        'สถานะ','พนักงานขาย','หมายเหตุออฟไลน์','รูปแบบคำสั่งซื้อ','รูปแบบการชำระ',
    ]);

    foreach ($orders as $order) {
        $items = $itemsByOrder[$order['id']] ?? [];
        $boxes = $boxesByOrder[$order['id']] ?? [];
        $seller = $creatorNames[$order['creator_id'] ?? 0] ?? '';
        $totalCod = 0;
        foreach ($boxes as $box) $totalCod += (float) ($box['cod_amount'] ?? 0);

        $rowBase = [
            $order['id'], '', $order['order_date'] ?? '', '', '',
            $totalCod > 0 ? $totalCod : '', $order['payment_method'] ?? '', '',
            $order['note'] ?? $order['notes'] ?? '', '',
            $order['shipping_cost'] ?? 0, $order['total_amount'] ?? 0,
            $order['recipient_first_name'] ?? $order['customer_first_name'] ?? '',
            $order['recipient_last_name'] ?? $order['customer_last_name'] ?? '',
            $order['recipient_phone'] ?? $order['customer_phone'] ?? '',
            $order['recipient_phone'] ?? $order['customer_phone'] ?? '',
            $order['street'] ?? $order['customer_street'] ?? '',
            $order['subdistrict'] ?? $order['customer_subdistrict'] ?? '',
            $order['district'] ?? $order['customer_district'] ?? '',
            $order['province'] ?? $order['customer_province'] ?? '',
            $order['postal_code'] ?? $order['customer_postal_code'] ?? '',
            'TH', 'ไม่',
        ];

        if (empty($items)) {
            fputcsv($out, array_merge($rowBase, [
                '', '', '', '', '', '',
                $order['shipping_provider'] ?? '', '', $order['delivery_date'] ?? '',
                $order['order_status'] ?? '', $seller, '', '', $order['payment_method'] ?? '',
            ]));
        }

        foreach ($items as $item) {
            if (!empty($item['is_promotion_parent'])) continue;
            fputcsv($out, array_merge($rowBase, [
                '', $item['sku'] ?? '', $item['product_name'] ?? '', '',
                $item['quantity'] ?? 1, $item['price_per_unit'] ?? 0,
                $order['shipping_provider'] ?? '', '', $order['delivery_date'] ?? '',
                $order['order_status'] ?? '', $seller, '', '', $order['payment_method'] ?? '',
            ]));
            $rowBase[1] = $item['shop'] ?? $order['shop'] ?? '';
        }
    }

    fclose($out);
    exit;
}

backup_json(['ok' => false, 'message' => 'unknown action'], 400);
