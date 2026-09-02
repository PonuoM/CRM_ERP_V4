<?php
/**
 * Standby Export API — Backend for the emergency order export tool.
 *
 * Runs on localhost only (127.0.0.1:8899).
 * Reads from the local standby MySQL database (synced by sync_tables.php).
 *
 * Actions:
 *   ?action=status    → Sync status + server health
 *   ?action=orders    → Fetch today's exportable orders
 *   ?action=export_csv → Download CSV for selected order IDs
 */
declare(strict_types=1);

date_default_timezone_set('Asia/Bangkok');

header('Content-Type: application/json; charset=utf-8');

// ─── Security: localhost only ───────────────────────────────────────────────

$remote = $_SERVER['REMOTE_ADDR'] ?? '';
if (!in_array($remote, ['127.0.0.1', '::1'], true)) {
    http_response_code(403);
    die(json_encode(['error' => 'localhost only']));
}

// ─── Load shared helpers ────────────────────────────────────────────────────

require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . '..'
    . DIRECTORY_SEPARATOR . 'backup' . DIRECTORY_SEPARATOR . 'job.php';

$env  = backup_env();
$work = backup_workdir($env);

$localUser = $env['LOCAL_MYSQL_USER'] ?? 'root';
$localPass = $env['LOCAL_MYSQL_PASS'] ?? '12345678';
$localDb   = $env['STANDBY_DB_NAME'] ?? 'standby_erp';

// ─── Database Connection ────────────────────────────────────────────────────

function standby_db(string $user, string $pass, string $db): ?PDO
{
    try {
        $pdo = new PDO(
            "mysql:host=127.0.0.1;dbname=$db;charset=utf8mb4",
            $user,
            $pass,
            [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]
        );
        return $pdo;
    } catch (\PDOException $e) {
        return null;
    }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function json_out(array $data, int $code = 200): void
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function read_sync_log(string $work): ?array
{
    $path = $work . DIRECTORY_SEPARATOR . 'sync' . DIRECTORY_SEPARATOR . 'sync_log.json';
    if (!is_file($path)) return null;
    return json_decode((string) file_get_contents($path), true) ?: null;
}

function read_health_state(string $work): ?array
{
    $path = $work . DIRECTORY_SEPARATOR . 'sync' . DIRECTORY_SEPARATOR . 'health_state.json';
    if (!is_file($path)) return null;
    return json_decode((string) file_get_contents($path), true) ?: null;
}

function check_production_health(): bool
{
    $ctx = stream_context_create([
        'http' => ['timeout' => 5, 'ignore_errors' => true],
        'ssl'  => ['verify_peer' => false, 'verify_peer_name' => false],
    ]);
    $res = @file_get_contents('https://prima49.com/mini_erp/api/health.php', false, $ctx);
    if ($res === false) return false;
    $data = json_decode($res, true);
    return is_array($data) && ($data['db'] ?? '') === 'up';
}

// ─── Router ─────────────────────────────────────────────────────────────────

$action = $_GET['action'] ?? 'status';

switch ($action) {

// ─────────────────────────────────────────────────────────────────────────────
case 'status':
    $syncLog = read_sync_log($work);
    $healthState = read_health_state($work);

    // Quick live check (non-blocking, 5s timeout)
    $serverUp = check_production_health();

    json_out([
        'sync' => $syncLog ? [
            'status'      => $syncLog['status'] ?? 'unknown',
            'finished_at' => $syncLog['finished_at'] ?? $syncLog['started_at'] ?? null,
            'elapsed_sec' => $syncLog['elapsed_sec'] ?? null,
            'row_counts'  => $syncLog['row_counts'] ?? null,
            'error'       => $syncLog['error'] ?? null,
        ] : null,
        'server_up'   => $serverUp,
        'health_state' => $healthState ? [
            'server_up'   => $healthState['server_up'] ?? null,
            'down_since'  => $healthState['down_since'] ?? null,
            'last_check'  => $healthState['last_check_at'] ?? null,
        ] : null,
    ]);
    break;

// ─────────────────────────────────────────────────────────────────────────────
case 'orders':
    $pdo = standby_db($localUser, $localPass, $localDb);
    if (!$pdo) {
        json_out(['error' => 'Cannot connect to local standby database. Have you run sync_tables.php?'], 500);
    }

    // Fetch today's confirmed orders (ready for export)
    $today = date('Y-m-d');
    $dateFilter = $_GET['date'] ?? $today;

    $stmt = $pdo->prepare("
        SELECT o.*,
               c.first_name AS customer_first_name,
               c.last_name AS customer_last_name,
               c.phone AS customer_phone,
               c.street AS customer_street,
               c.subdistrict AS customer_subdistrict,
               c.district AS customer_district,
               c.province AS customer_province,
               c.postal_code AS customer_postal_code
        FROM orders o
        LEFT JOIN customers c ON c.customer_id = o.customer_id
        WHERE o.delivery_date = ?
          AND o.order_status = 'Confirmed'
        ORDER BY o.order_date DESC
    ");
    $stmt->execute([$dateFilter]);
    $orders = $stmt->fetchAll();

    if (empty($orders)) {
        json_out(['orders' => [], 'count' => 0, 'date' => $dateFilter]);
    }

    // Fetch items for these orders
    $orderIds = array_column($orders, 'id');
    $placeholders = implode(',', array_fill(0, count($orderIds), '?'));

    $itemStmt = $pdo->prepare("
        SELECT oi.*, p.name AS product_name, p.sku, p.shop
        FROM order_items oi
        LEFT JOIN products p ON p.id = oi.product_id
        WHERE oi.parent_order_id IN ($placeholders)
        ORDER BY oi.parent_order_id, oi.id
    ");
    $itemStmt->execute($orderIds);
    $allItems = $itemStmt->fetchAll();

    $boxStmt = $pdo->prepare("
        SELECT ob.* FROM order_boxes ob
        WHERE ob.order_id IN ($placeholders)
        ORDER BY ob.order_id, ob.box_number
    ");
    $boxStmt->execute($orderIds);
    $allBoxes = $boxStmt->fetchAll();

    // Group by order
    $itemsByOrder = [];
    foreach ($allItems as $item) {
        $itemsByOrder[$item['parent_order_id']][] = $item;
    }
    $boxesByOrder = [];
    foreach ($allBoxes as $box) {
        $boxesByOrder[$box['order_id']][] = $box;
    }

    foreach ($orders as &$order) {
        $order['items'] = $itemsByOrder[$order['id']] ?? [];
        $order['boxes'] = $boxesByOrder[$order['id']] ?? [];
    }
    unset($order);

    json_out(['orders' => $orders, 'count' => count($orders), 'date' => $dateFilter]);
    break;

// ─────────────────────────────────────────────────────────────────────────────
case 'export_csv':
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        json_out(['error' => 'POST required'], 405);
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $orderIds = $input['orderIds'] ?? [];

    if (empty($orderIds) || !is_array($orderIds)) {
        json_out(['error' => 'orderIds required'], 400);
    }

    $pdo = standby_db($localUser, $localPass, $localDb);
    if (!$pdo) {
        json_out(['error' => 'Cannot connect to local standby database'], 500);
    }

    // Limit to 500
    $orderIds = array_slice($orderIds, 0, 500);
    $placeholders = implode(',', array_fill(0, count($orderIds), '?'));

    // Fetch orders
    $stmt = $pdo->prepare("
        SELECT o.*,
               c.first_name AS customer_first_name,
               c.last_name AS customer_last_name,
               c.phone AS customer_phone,
               c.street AS customer_street,
               c.subdistrict AS customer_subdistrict,
               c.district AS customer_district,
               c.province AS customer_province,
               c.postal_code AS customer_postal_code
        FROM orders o
        LEFT JOIN customers c ON c.customer_id = o.customer_id
        WHERE o.id IN ($placeholders)
    ");
    $stmt->execute($orderIds);
    $orders = $stmt->fetchAll();

    // Fetch items
    $foundIds = array_column($orders, 'id');
    if (empty($foundIds)) {
        json_out(['error' => 'No orders found'], 404);
    }

    $fp = implode(',', array_fill(0, count($foundIds), '?'));
    $itemStmt = $pdo->prepare("
        SELECT oi.*, p.name AS product_name, p.sku, p.shop
        FROM order_items oi
        LEFT JOIN products p ON p.id = oi.product_id
        WHERE oi.parent_order_id IN ($fp)
        ORDER BY oi.parent_order_id, oi.id
    ");
    $itemStmt->execute($foundIds);
    $allItems = $itemStmt->fetchAll();

    $boxStmt = $pdo->prepare("
        SELECT ob.* FROM order_boxes ob WHERE ob.order_id IN ($fp) ORDER BY ob.order_id, ob.box_number
    ");
    $boxStmt->execute($foundIds);
    $allBoxes = $boxStmt->fetchAll();

    // Group
    $itemsByOrder = [];
    foreach ($allItems as $item) {
        $itemsByOrder[$item['parent_order_id']][] = $item;
    }
    $boxesByOrder = [];
    foreach ($allBoxes as $box) {
        $boxesByOrder[$box['order_id']][] = $box;
    }

    // Get creator names
    $creatorIds = array_unique(array_filter(array_column($orders, 'creator_id')));
    $creatorNames = [];
    if (!empty($creatorIds)) {
        $cp = implode(',', array_fill(0, count($creatorIds), '?'));
        $userStmt = $pdo->prepare("SELECT id, first_name, last_name FROM users WHERE id IN ($cp)");
        $userStmt->execute(array_values($creatorIds));
        foreach ($userStmt->fetchAll() as $u) {
            $creatorNames[$u['id']] = trim(($u['first_name'] ?? '') . ' ' . ($u['last_name'] ?? ''));
        }
    }

    // Generate CSV
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="standby_export_' . date('Ymd_His') . '.csv"');
    // Remove JSON content type
    header_remove('Content-Type');
    header('Content-Type: text/csv; charset=utf-8');

    $out = fopen('php://output', 'w');

    // BOM for Excel UTF-8
    fwrite($out, "\xEF\xBB\xBF");

    // CSV Headers (matching the 37-column format from ManageOrdersPage)
    fputcsv($out, [
        'หมายเลขออเดอร์ออนไลน์',
        'ชื่อร้านค้า',
        'เวลาที่สั่งซื้อ',
        'บัญชีร้านค้า',
        'หมายเลขใบชำระเงิน',
        'COD',
        'ช่องทางชำระเงิน',
        'เวลาชำระเงิน',
        'หมายเหตุใบสั่งซื้อ',
        'ข้อความจากร้านค้า',
        'ค่าขนส่ง',
        'จำนวนเงินที่ต้องชำระ',
        'ผู้รับสินค้า',
        'นามสกุลผู้รับสินค้า',
        'หมายเลขโทรศัพท์',
        'หมายเลขมือถือ',
        'สถานที่',
        'ภูมิภาค',
        'อำเภอ',
        'จังหวัด',
        'รหัสไปรษณีย์',
        'ประเทศ',
        'รับสินค้าที่ร้านหรือไม่',
        'รหัสสินค้าบนแพลตฟอร์ม',
        'รหัสสินค้าในระบบ',
        'ชื่อสินค้า',
        'สีและรูปแบบ',
        'จำนวน',
        'ราคาสินค้าต่อหน่วย',
        'บริษัทขนส่ง',
        'หมายเลขขนส่ง',
        'เวลาส่งสินค้า',
        'สถานะ',
        'พนักงานขาย',
        'หมายเหตุออฟไลน์',
        'รูปแบบคำสั่งซื้อ',
        'รูปแบบการชำระ',
    ]);

    // Write rows (one per item per order)
    foreach ($orders as $order) {
        $items = $itemsByOrder[$order['id']] ?? [];
        $boxes = $boxesByOrder[$order['id']] ?? [];
        $seller = $creatorNames[$order['creator_id'] ?? 0] ?? '';

        // Calculate COD from boxes
        $totalCod = 0;
        foreach ($boxes as $box) {
            $totalCod += (float) ($box['cod_amount'] ?? 0);
        }

        if (empty($items)) {
            // Order with no items — still output one row
            fputcsv($out, [
                $order['id'],
                $order['shop'] ?? '',
                $order['order_date'] ?? '',
                '',
                '',
                $totalCod > 0 ? $totalCod : '',
                $order['payment_method'] ?? '',
                '',
                $order['note'] ?? $order['notes'] ?? '',
                '',
                $order['shipping_cost'] ?? 0,
                $order['total_amount'] ?? 0,
                $order['recipient_first_name'] ?? $order['customer_first_name'] ?? '',
                $order['recipient_last_name'] ?? $order['customer_last_name'] ?? '',
                $order['recipient_phone'] ?? $order['customer_phone'] ?? '',
                $order['recipient_phone'] ?? $order['customer_phone'] ?? '',
                $order['street'] ?? $order['customer_street'] ?? '',
                $order['subdistrict'] ?? $order['customer_subdistrict'] ?? '',
                $order['district'] ?? $order['customer_district'] ?? '',
                $order['province'] ?? $order['customer_province'] ?? '',
                $order['postal_code'] ?? $order['customer_postal_code'] ?? '',
                'TH',
                'ไม่',
                '',
                '',
                '',
                '',
                '',
                '',
                $order['shipping_provider'] ?? '',
                '',
                $order['delivery_date'] ?? '',
                $order['order_status'] ?? '',
                $seller,
                '',
                '',
                $order['payment_method'] ?? '',
            ]);
        }

        foreach ($items as $item) {
            // Skip promotion parent rows (matching frontend behavior)
            if (!empty($item['is_promotion_parent'])) continue;

            fputcsv($out, [
                $order['id'],
                $item['shop'] ?? $order['shop'] ?? '',
                $order['order_date'] ?? '',
                '',
                '',
                $totalCod > 0 ? $totalCod : '',
                $order['payment_method'] ?? '',
                '',
                $order['note'] ?? $order['notes'] ?? '',
                '',
                $order['shipping_cost'] ?? 0,
                $order['total_amount'] ?? 0,
                $order['recipient_first_name'] ?? $order['customer_first_name'] ?? '',
                $order['recipient_last_name'] ?? $order['customer_last_name'] ?? '',
                $order['recipient_phone'] ?? $order['customer_phone'] ?? '',
                $order['recipient_phone'] ?? $order['customer_phone'] ?? '',
                $order['street'] ?? $order['customer_street'] ?? '',
                $order['subdistrict'] ?? $order['customer_subdistrict'] ?? '',
                $order['district'] ?? $order['customer_district'] ?? '',
                $order['province'] ?? $order['customer_province'] ?? '',
                $order['postal_code'] ?? $order['customer_postal_code'] ?? '',
                'TH',
                'ไม่',
                '',
                $item['sku'] ?? '',
                $item['product_name'] ?? '',
                '',
                $item['quantity'] ?? 1,
                $item['price_per_unit'] ?? 0,
                $order['shipping_provider'] ?? '',
                '',
                $order['delivery_date'] ?? '',
                $order['order_status'] ?? '',
                $seller,
                '',
                '',
                $order['payment_method'] ?? '',
            ]);
        }
    }

    fclose($out);
    exit;

// ─────────────────────────────────────────────────────────────────────────────
default:
    json_out(['error' => 'Unknown action: ' . $action], 400);
}
