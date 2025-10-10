<?php
require_once __DIR__ . '/config.php';

// Polyfill for PHP < 8 str_starts_with
if (!function_exists('str_starts_with')) {
    function str_starts_with(string $haystack, string $needle): bool {
        return $needle !== '' && strpos($haystack, $needle) === 0 || ($needle === '' && true);
    }
}

cors();

// Router helper
function route_path(): array {
    $uri = $_SERVER['REQUEST_URI'] ?? '/';
    $scriptDir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/');
    $path = parse_url($uri, PHP_URL_PATH) ?: '/';
    if ($scriptDir && str_starts_with($path, $scriptDir)) {
        $path = substr($path, strlen($scriptDir));
    }
    $path = trim($path, '/');
    // Expecting paths like: api/customers, customers/ID, etc.
    // If this app is mounted at /api, strip that prefix
    if (str_starts_with($path, 'api/')) {
        $path = substr($path, 4);
    } elseif ($path === 'api') {
        $path = '';
    }
    // If path begins with index.php/, strip it (fallback when rewrite not active)
    if (str_starts_with($path, 'index.php/')) {
        $path = substr($path, strlen('index.php/'));
    } elseif ($path === 'index.php') {
        $path = '';
    }
    return explode('/', $path);
}

function method(): string { return $_SERVER['REQUEST_METHOD'] ?? 'GET'; }

try {
    $pdo = db_connect();
} catch (Throwable $e) {
    json_response(['ok' => false, 'error' => 'DB_CONNECT_FAILED', 'message' => $e->getMessage()], 500);
}

$parts = route_path();
$resource = $parts[0] ?? '';
$id = $parts[1] ?? null;

if ($resource === '' || $resource === 'health') {
    json_response(['ok' => true, 'status' => 'healthy']);
}

switch ($resource) {
    case 'auth':
        handle_auth($pdo, $id);
        break;
    case 'tags':
        handle_tags($pdo, $id);
        break;
    case 'customer_tags':
        handle_customer_tags($pdo);
        break;
    case 'companies':
        handle_companies($pdo, $id);
        break;
    case 'permissions':
        handle_permissions($pdo);
        break;
    case 'users':
        handle_users($pdo, $id);
        break;
    case 'customers':
        handle_customers($pdo, $id);
        break;
    case 'products':
        handle_products($pdo, $id);
        break;
    case 'promotions':
        handle_promotions($pdo, $id);
        break;
    case 'orders':
        handle_orders($pdo, $id);
        break;
    case 'pages':
        handle_pages($pdo, $id);
        break;
    case 'warehouses':
        handle_warehouses($pdo, $id);
        break;
    case 'ad_spend':
        handle_ad_spend($pdo, $id);
        break;
    case 'appointments':
        handle_appointments($pdo, $id);
        break;
    case 'call_history':
        handle_calls($pdo, $id);
        break;
    case 'activities':
        handle_activities($pdo, $id);
        break;
    case 'do_dashboard':
        handle_do_dashboard($pdo);
        break;
    case 'exports':
        handle_exports($pdo, $id);
        break;
    case 'order_slips':
        handle_order_slips($pdo, $id);
        break;
    case 'ownership':
        require_once 'ownership.php';
        handle_ownership($pdo, $id);
        break;
    default:
        json_response(['ok' => false, 'error' => 'NOT_FOUND', 'path' => $parts], 404);
}

function handle_auth(PDO $pdo, ?string $id): void {
    if ($id === 'login' && method() === 'POST') {
        $in = json_input();
        // Fallbacks for non-JSON posts
        if (!$in || !is_array($in)) { $in = []; }
        if (!isset($in['username']) && isset($_POST['username'])) { $in['username'] = $_POST['username']; }
        if (!isset($in['password']) && isset($_POST['password'])) { $in['password'] = $_POST['password']; }
        if (!isset($in['username']) && isset($_GET['username'])) { $in['username'] = $_GET['username']; }
        if (!isset($in['password']) && isset($_GET['password'])) { $in['password'] = $_GET['password']; }
        $username = $in['username'] ?? '';
        $password = $in['password'] ?? '';
        if ($username === '' || $password === '') {
            json_response(['ok' => false, 'error' => 'MISSING_CREDENTIALS'], 400);
        }
        $stmt = $pdo->prepare('SELECT id, username, password, first_name, last_name, email, phone, role, company_id, team_id, supervisor_id FROM users WHERE username=? LIMIT 1');
        $stmt->execute([$username]);
        $u = $stmt->fetch();
        if (!$u) json_response(['ok' => false, 'error' => 'INVALID_CREDENTIALS'], 401);
        // Demo: plaintext password match (replace with hashing in production)
        if (!hash_equals((string)$u['password'], (string)$password)) {
            json_response(['ok' => false, 'error' => 'INVALID_CREDENTIALS'], 401);
        }
        unset($u['password']);
        json_response(['ok' => true, 'user' => $u]);
    }
    json_response(['error' => 'NOT_FOUND'], 404);
}

function handle_users(PDO $pdo, ?string $id): void {
    switch (method()) {
        case 'GET':
            if ($id) {
                $stmt = $pdo->prepare('SELECT id, username, first_name, last_name, email, phone, role, company_id, team_id, supervisor_id FROM users WHERE id = ?');
                $stmt->execute([$id]);
                $row = $stmt->fetch();
                $row ? json_response($row) : json_response(['error' => 'NOT_FOUND'], 404);
            } else {
                $stmt = $pdo->query('SELECT id, username, first_name, last_name, email, phone, role, company_id, team_id, supervisor_id FROM users ORDER BY id');
                json_response($stmt->fetchAll());
            }
            break;
        case 'POST':
            $in = json_input();
            if (!$in || !is_array($in)) { $in = []; }
            $username = trim((string)($in['username'] ?? ''));
            $password = isset($in['password']) ? (string)$in['password'] : null; // plaintext for demo only
            $first = trim((string)($in['firstName'] ?? ''));
            $last = trim((string)($in['lastName'] ?? ''));
            $email = $in['email'] ?? null;
            $phone = $in['phone'] ?? null;
            $role = trim((string)($in['role'] ?? ''));
            $companyId = $in['companyId'] ?? null;
            $teamId = $in['teamId'] ?? null;
            $supervisorId = $in['supervisorId'] ?? null;
            if ($username === '' || $first === '' || $last === '' || $role === '' || !$companyId) {
                json_response(['error' => 'VALIDATION_FAILED', 'message' => 'username, firstName, lastName, role, companyId are required'], 400);
            }
            try {
                $stmt = $pdo->prepare('INSERT INTO users(username, password, first_name, last_name, email, phone, role, company_id, team_id, supervisor_id) VALUES (?,?,?,?,?,?,?,?,?,?)');
                $stmt->execute([$username, $password, $first, $last, $email, $phone, $role, $companyId, $teamId, $supervisorId]);
                $newId = (int)$pdo->lastInsertId();
                $get = $pdo->prepare('SELECT id, username, first_name, last_name, email, phone, role, company_id, team_id, supervisor_id FROM users WHERE id = ?');
                $get->execute([$newId]);
                json_response($get->fetch(), 201);
            } catch (Throwable $e) {
                $code = 500;
                $msg = $e->getMessage();
                if (strpos($msg, 'Duplicate') !== false || strpos($msg, 'UNIQUE') !== false) {
                    $code = 409;
                }
                json_response(['error' => 'CREATE_FAILED', 'message' => $msg], $code);
            }
            break;
        case 'PUT':
        case 'PATCH':
            if (!$id) json_response(['error' => 'ID_REQUIRED'], 400);
            $in = json_input();
            if (!$in || !is_array($in)) { $in = []; }
            $fields = [];
            $params = [];
            $map = [
                'username' => 'username',
                'password' => 'password',
                'firstName' => 'first_name',
                'lastName' => 'last_name',
                'email' => 'email',
                'phone' => 'phone',
                'role' => 'role',
                'companyId' => 'company_id',
                'teamId' => 'team_id',
                'supervisorId' => 'supervisor_id',
            ];
            foreach ($map as $inKey => $col) {
                if (array_key_exists($inKey, $in)) {
                    $fields[] = "$col = ?";
                    $params[] = $in[$inKey];
                }
            }
            if (empty($fields)) {
                json_response(['ok' => true]);
            }
            $params[] = $id;
            try {
                $sql = 'UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = ?';
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $get = $pdo->prepare('SELECT id, username, first_name, last_name, email, phone, role, company_id, team_id, supervisor_id FROM users WHERE id = ?');
                $get->execute([$id]);
                $row = $get->fetch();
                $row ? json_response($row) : json_response(['error' => 'NOT_FOUND'], 404);
            } catch (Throwable $e) {
                json_response(['error' => 'UPDATE_FAILED', 'message' => $e->getMessage()], 500);
            }
            break;
        case 'DELETE':
            if (!$id) json_response(['error' => 'ID_REQUIRED'], 400);
            try {
                $stmt = $pdo->prepare('DELETE FROM users WHERE id = ?');
                $stmt->execute([$id]);
                json_response(['ok' => true]);
            } catch (Throwable $e) {
                // Likely foreign key constraint (assigned customers, orders, etc.)
                json_response(['error' => 'DELETE_FAILED', 'message' => $e->getMessage()], 409);
            }
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

function handle_customers(PDO $pdo, ?string $id): void {
    switch (method()) {
        case 'GET':
            if ($id) {
                $stmt = $pdo->prepare('SELECT * FROM customers WHERE id = ?');
                $stmt->execute([$id]);
                $cust = $stmt->fetch();
                if (!$cust) json_response(['error' => 'NOT_FOUND'], 404);
                $tags = $pdo->prepare('SELECT t.* FROM tags t JOIN customer_tags ct ON ct.tag_id=t.id WHERE ct.customer_id=?');
                $tags->execute([$id]);
                $cust['tags'] = $tags->fetchAll();
                json_response($cust);
            } else {
                $q = $_GET['q'] ?? '';
                $companyId = $_GET['companyId'] ?? null;
                $bucket = $_GET['bucket'] ?? null;
                $userId = $_GET['userId'] ?? null;

                if ($bucket === 'NewForMe') {
                    if (!$userId) json_response(['error' => 'USER_ID_REQUIRED'], 400);
                    $sql = 'SELECT c.*
                            FROM customers c
                            JOIN users u ON u.id = ?
                            WHERE c.assigned_to = ?
                              AND EXISTS (SELECT 1 FROM customer_assignment_history h WHERE h.customer_id=c.id AND h.user_id=?)
                              AND NOT EXISTS (
                                   SELECT 1 FROM call_history ch
                                   WHERE ch.customer_id=c.id AND ch.caller = CONCAT(u.first_name, " ", u.last_name)
                              )';
                    $params = [$userId, $userId, $userId];
                    if ($companyId) { $sql .= ' AND c.company_id = ?'; $params[] = $companyId; }
                    if ($q !== '') {
                        $sql .= ' AND (c.first_name LIKE ? OR c.last_name LIKE ? OR c.phone LIKE ? OR c.id LIKE ?)';
                        $params[] = "%$q%"; $params[] = "%$q%"; $params[] = "%$q%"; $params[] = "%$q%";
                    }
                    $sql .= ' ORDER BY c.date_assigned DESC LIMIT 200';
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute($params);
                    $customers = $stmt->fetchAll();
                    
                    // Add tags to each customer
                    foreach ($customers as &$customer) {
                        $tagsStmt = $pdo->prepare('SELECT t.* FROM tags t JOIN customer_tags ct ON ct.tag_id=t.id WHERE ct.customer_id=?');
                        $tagsStmt->execute([$customer['id']]);
                        $customer['tags'] = $tagsStmt->fetchAll();
                    }
                    
                    json_response($customers);
                } else {
                    $sql = 'SELECT * FROM customers WHERE 1';
                    $params = [];
                    if ($q !== '') { $sql .= ' AND (first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? OR id LIKE ?)'; $params[] = "%$q%"; $params[] = "%$q%"; $params[] = "%$q%"; $params[] = "%$q%"; }
                    if ($companyId) { $sql .= ' AND company_id = ?'; $params[] = $companyId; }
                    $sql .= ' ORDER BY date_assigned DESC LIMIT 200';
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute($params);
                    $customers = $stmt->fetchAll();
                    
                    // Add tags to each customer
                    foreach ($customers as &$customer) {
                        $tagsStmt = $pdo->prepare('SELECT t.* FROM tags t JOIN customer_tags ct ON ct.tag_id=t.id WHERE ct.customer_id=?');
                        $tagsStmt->execute([$customer['id']]);
                        $customer['tags'] = $tagsStmt->fetchAll();
                    }
                    
                    json_response($customers);
                }
            }
            break;
        case 'POST':
            $in = json_input();
            $stmt = $pdo->prepare('INSERT INTO customers (id, first_name, last_name, phone, email, province, company_id, assigned_to, date_assigned, date_registered, follow_up_date, ownership_expires, lifecycle_status, behavioral_status, grade, total_purchases, total_calls, facebook_name, line_id, street, subdistrict, district, postal_code) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
            $stmt->execute([
                $in['id'], $in['firstName'] ?? '', $in['lastName'] ?? '', $in['phone'] ?? '', $in['email'] ?? null,
                $in['province'] ?? '', $in['companyId'] ?? null, $in['assignedTo'] ?? null,
                $in['dateAssigned'] ?? date('c'), $in['dateRegistered'] ?? null, $in['followUpDate'] ?? null, $in['ownershipExpires'] ?? null,
                $in['lifecycleStatus'] ?? null, $in['behavioralStatus'] ?? null, $in['grade'] ?? null,
                $in['totalPurchases'] ?? 0, $in['totalCalls'] ?? 0, $in['facebookName'] ?? null, $in['lineId'] ?? null,
                $in['address']['street'] ?? null, $in['address']['subdistrict'] ?? null, $in['address']['district'] ?? null, $in['address']['postalCode'] ?? null,
            ]);
            json_response(['ok' => true]);
            break;
        case 'PUT':
        case 'PATCH':
            if (!$id) json_response(['error' => 'ID_REQUIRED'], 400);
            $in = json_input();
            // Fetch previous assigned_to
            $oldAssigned = null;
            try {
                $st = $pdo->prepare('SELECT assigned_to FROM customers WHERE id=?');
                $st->execute([$id]);
                $oldAssigned = $st->fetchColumn();
            } catch (Throwable $e) { $oldAssigned = null; }

            $assignedTo = $in['assignedTo'] ?? null;

            $stmt = $pdo->prepare('UPDATE customers SET first_name=COALESCE(?, first_name), last_name=COALESCE(?, last_name), phone=COALESCE(?, phone), email=COALESCE(?, email), province=COALESCE(?, province), company_id=COALESCE(?, company_id), assigned_to=COALESCE(?, assigned_to), date_assigned=COALESCE(?, date_assigned), date_registered=COALESCE(?, date_registered), follow_up_date=COALESCE(?, follow_up_date), ownership_expires=COALESCE(?, ownership_expires), lifecycle_status=COALESCE(?, lifecycle_status), behavioral_status=COALESCE(?, behavioral_status), grade=COALESCE(?, grade), total_purchases=COALESCE(?, total_purchases), total_calls=COALESCE(?, total_calls), facebook_name=COALESCE(?, facebook_name), line_id=COALESCE(?, line_id), street=COALESCE(?, street), subdistrict=COALESCE(?, subdistrict), district=COALESCE(?, district), postal_code=COALESCE(?, postal_code) WHERE id=?');
            $addr = $in['address'] ?? [];
            $stmt->execute([
                $in['firstName'] ?? null,
                $in['lastName'] ?? null,
                $in['phone'] ?? null,
                $in['email'] ?? null,
                $in['province'] ?? null,
                $in['companyId'] ?? null,
                $assignedTo,
                $in['dateAssigned'] ?? null,
                $in['dateRegistered'] ?? null,
                $in['followUpDate'] ?? null,
                $in['ownershipExpires'] ?? null,
                $in['lifecycleStatus'] ?? null,
                $in['behavioralStatus'] ?? null,
                $in['grade'] ?? null,
                $in['totalPurchases'] ?? null,
                $in['totalCalls'] ?? null,
                $in['facebookName'] ?? null,
                $in['lineId'] ?? null,
                $addr['street'] ?? null,
                $addr['subdistrict'] ?? null,
                $addr['district'] ?? null,
                $addr['postalCode'] ?? null,
                $id,
            ]);

            if (!empty($assignedTo) && (string)$assignedTo !== (string)$oldAssigned) {
                try {
                    $pdo->prepare('UPDATE customers SET date_assigned=COALESCE(date_assigned, NOW()) WHERE id=?')->execute([$id]);
                    $pdo->prepare('INSERT IGNORE INTO customer_assignment_history(customer_id, user_id, assigned_at) VALUES (?,?, NOW())')->execute([$id, $assignedTo]);
                } catch (Throwable $e) { /* ignore */ }
            }
            json_response(['ok' => true]);
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

function handle_products(PDO $pdo, ?string $id): void {
    switch (method()) {
        case 'GET':
            if ($id) {
                $stmt = $pdo->prepare('SELECT * FROM products WHERE id = ?');
                $stmt->execute([$id]);
                $row = $stmt->fetch();
                $row ? json_response($row) : json_response(['error' => 'NOT_FOUND'], 404);
            } else {
                $stmt = $pdo->query('SELECT * FROM products ORDER BY id DESC LIMIT 500');
                json_response($stmt->fetchAll());
            }
            break;
        case 'POST':
            $in = json_input();
            $stmt = $pdo->prepare('INSERT INTO products (sku, name, description, category, unit, cost, price, stock, company_id) VALUES (?,?,?,?,?,?,?,?,?)');
            $stmt->execute([
                $in['sku'] ?? '', $in['name'] ?? '', $in['description'] ?? null, $in['category'] ?? '', $in['unit'] ?? '',
                $in['cost'] ?? 0, $in['price'] ?? 0, $in['stock'] ?? 0, $in['companyId'] ?? null
            ]);
            json_response(['id' => $pdo->lastInsertId()]);
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

function handle_promotions(PDO $pdo, ?string $id): void {
    switch (method()) {
        case 'GET':
            if ($id) {
                // Get single promotion with items
                $stmt = $pdo->prepare('SELECT * FROM promotions WHERE id = ?');
                $stmt->execute([$id]);
                $promo = $stmt->fetch();
                if (!$promo) {
                    json_response(['error' => 'NOT_FOUND'], 404);
                    return;
                }
                // Fetch promotion items with product details
                $itemsStmt = $pdo->prepare('
                    SELECT pi.*, p.sku, p.name as product_name, p.price as product_price 
                    FROM promotion_items pi 
                    LEFT JOIN products p ON pi.product_id = p.id 
                    WHERE pi.promotion_id = ?
                ');
                $itemsStmt->execute([$id]);
                $promo['items'] = $itemsStmt->fetchAll();
                json_response($promo);
            } else {
                // Get all active promotions with items
                $stmt = $pdo->query('SELECT * FROM promotions WHERE active = 1 ORDER BY id DESC');
                $promos = $stmt->fetchAll();
                // Fetch items for each promotion
                foreach ($promos as &$promo) {
                    $itemsStmt = $pdo->prepare('
                        SELECT pi.*, p.sku, p.name as product_name, p.price as product_price 
                        FROM promotion_items pi 
                        LEFT JOIN products p ON pi.product_id = p.id 
                        WHERE pi.promotion_id = ?
                    ');
                    $itemsStmt->execute([$promo['id']]);
                    $promo['items'] = $itemsStmt->fetchAll();
                }
                json_response($promos);
            }
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

function handle_orders(PDO $pdo, ?string $id): void {
    switch (method()) {
        case 'GET':
            if ($id) {
                $o = get_order($pdo, $id);
                $o ? json_response($o) : json_response(['error' => 'NOT_FOUND'], 404);
            } else {
                $sql = 'SELECT o.id, o.customer_id, o.company_id, o.creator_id, o.order_date, o.delivery_date, o.total_amount, o.payment_method, o.payment_status, o.order_status,
                               GROUP_CONCAT(DISTINCT t.tracking_number ORDER BY t.id SEPARATOR ",") AS tracking_numbers,
                               o.amount_paid, o.cod_amount, o.slip_url, o.sales_channel
                        FROM orders o
                        LEFT JOIN order_tracking_numbers t ON t.order_id = o.id
                        GROUP BY o.id
                        ORDER BY o.order_date DESC
                        LIMIT 200';
                $stmt = $pdo->query($sql);
                json_response($stmt->fetchAll());
            }
            break;
        case 'POST':
            $in = json_input();
            error_log('Order creation request: ' . json_encode($in));
            $pdo->beginTransaction();
            try {
                $stmt = $pdo->prepare('INSERT INTO orders (id, customer_id, company_id, creator_id, order_date, delivery_date, street, subdistrict, district, province, postal_code, shipping_cost, bill_discount, total_amount, payment_method, payment_status, slip_url, amount_paid, cod_amount, order_status, notes, sales_channel, sales_channel_page_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
                $addr = $in['shippingAddress'] ?? [];
                $stmt->execute([
                    $in['id'], $in['customerId'], $in['companyId'], $in['creatorId'], $in['orderDate'], $in['deliveryDate'],
                    $addr['street'] ?? null, $addr['subdistrict'] ?? null, $addr['district'] ?? null, $addr['province'] ?? null, $addr['postalCode'] ?? null,
                    $in['shippingCost'] ?? 0, $in['billDiscount'] ?? 0, $in['totalAmount'] ?? 0,
                    $in['paymentMethod'] ?? null, $in['paymentStatus'] ?? null, $in['slipUrl'] ?? null, $in['amountPaid'] ?? null, $in['codAmount'] ?? null,
                    $in['orderStatus'] ?? null, $in['notes'] ?? null, $in['salesChannel'] ?? null, $in['salesChannelPageId'] ?? null,
                ]);

                if (!empty($in['items']) && is_array($in['items'])) {
                    $item = $pdo->prepare('INSERT INTO order_items (order_id, product_id, product_name, quantity, price_per_unit, discount, is_freebie, box_number) VALUES (?,?,?,?,?,?,?,?)');
                    foreach ($in['items'] as $it) {
                        $item->execute([
                            $in['id'], $it['productId'] ?? null, $it['productName'] ?? null, $it['quantity'] ?? 0,
                            $it['pricePerUnit'] ?? 0, $it['discount'] ?? 0, !empty($it['isFreebie']) ? 1 : 0, $it['boxNumber'] ?? null,
                        ]);
                    }
                }

                if (!empty($in['trackingNumbers']) && is_array($in['trackingNumbers'])) {
                    // Deduped set on insert
                    $seen = [];
                    $tk = $pdo->prepare('INSERT INTO order_tracking_numbers (order_id, tracking_number) VALUES (?,?)');
                    foreach ($in['trackingNumbers'] as $tnRaw) {
                        $tn = trim((string)$tnRaw);
                        if ($tn === '') continue;
                        // Auto-assign and record first-time assignment if customer has no owner
                        try {
                            $auto = $pdo->prepare('UPDATE customers SET assigned_to=?, date_assigned = COALESCE(date_assigned, NOW()) WHERE id=? AND (assigned_to IS NULL OR assigned_to=0)');
                            $auto->execute([$in['creatorId'] ?? null, $in['customerId'] ?? null]);
                            $hist = $pdo->prepare('INSERT IGNORE INTO customer_assignment_history(customer_id, user_id, assigned_at) VALUES (?,?, NOW())');
                            $hist->execute([$in['customerId'] ?? null, $in['creatorId'] ?? null]);
                        } catch (Throwable $e) { /* ignore */ }
                        if (isset($seen[$tn])) continue;
                        $seen[$tn] = true;
                        $tk->execute([$in['id'], $tn]);
                    }
                }
                $pdo->commit();
                error_log('Order created successfully: ' . $in['id']);
                json_response(['ok' => true, 'id' => $in['id']]);
            } catch (Throwable $e) {
                $pdo->rollBack();
                error_log('Order creation failed: ' . $e->getMessage());
                json_response(['error' => 'ORDER_CREATE_FAILED', 'message' => $e->getMessage()], 500);
            }
            break;
        case 'PUT':
        case 'PATCH':
            if (!$id) json_response(['error' => 'ID_REQUIRED'], 400);
            $in = json_input();
            // Normalize incoming values: treat empty strings as NULL so they won't overwrite existing values
            $orderStatus   = array_key_exists('orderStatus', $in) ? trim((string)$in['orderStatus']) : null; if ($orderStatus === '')   $orderStatus = null;
            $paymentStatus = array_key_exists('paymentStatus', $in) ? trim((string)$in['paymentStatus']) : null; if ($paymentStatus === '') $paymentStatus = null;
            $amountPaid    = array_key_exists('amountPaid', $in) ? $in['amountPaid'] : null; if ($amountPaid === '') $amountPaid = null;
            $codAmount     = array_key_exists('codAmount', $in) ? $in['codAmount'] : null; if ($codAmount === '') $codAmount = null;
            $notes         = array_key_exists('notes', $in) ? $in['notes'] : null; if ($notes === '') $notes = null;
            $salesChannel  = array_key_exists('salesChannel', $in) ? $in['salesChannel'] : null; if ($salesChannel === '') $salesChannel = null;

            $slipUrl = array_key_exists('slipUrl', $in) ? $in['slipUrl'] : null; if ($slipUrl === '') $slipUrl = null;
            // If slipUrl is a data URL image, persist to file and store path
            if (is_string($slipUrl) && strpos($slipUrl, 'data:image') === 0) {
                try {
                    if (preg_match('/^data:(image\/(png|jpeg|jpg|gif));base64,(.*)$/', $slipUrl, $m)) {
                        $ext = $m[2] === 'jpeg' ? 'jpg' : $m[2];
                        $data = base64_decode($m[3]);
                        if ($data !== false) {
                            $dir = __DIR__ . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'slips';
                            if (!is_dir($dir)) { @mkdir($dir, 0775, true); }
                            $fname = 'slip_' . preg_replace('/[^A-Za-z0-9_-]+/','', $id) . '_' . date('Ymd_His') . '.' . $ext;
                            $path = $dir . DIRECTORY_SEPARATOR . $fname;
                            if (file_put_contents($path, $data) !== false) {
                                // Store web-accessible path
                                $slipUrl = 'api/uploads/slips/' . $fname;
                            }
                        }
                    }
                } catch (Throwable $e) { /* ignore and leave slipUrl as-is */ }
            }

            $stmt = $pdo->prepare('UPDATE orders SET slip_url=COALESCE(?, slip_url), order_status=COALESCE(?, order_status), payment_status=COALESCE(?, payment_status), amount_paid=COALESCE(?, amount_paid), cod_amount=COALESCE(?, cod_amount), notes=COALESCE(?, notes), sales_channel=COALESCE(?, sales_channel) WHERE id=?');
            $stmt->execute([$slipUrl, $orderStatus, $paymentStatus, $amountPaid, $codAmount, $notes, $salesChannel, $id]);
            // If sale succeeded, move customer to Old3Months
            try {
                if ((isset($paymentStatus) && strcasecmp((string)$paymentStatus, 'Paid') === 0) ||
                    (isset($orderStatus) && strcasecmp((string)$orderStatus, 'Delivered') === 0)) {
                    $custStmt = $pdo->prepare('SELECT customer_id FROM orders WHERE id=?');
                    $custStmt->execute([$id]);
                    $customerId = $custStmt->fetchColumn();
                    if ($customerId) {
                        $upd = $pdo->prepare('UPDATE customers SET lifecycle_status=? WHERE id=?');
                        $upd->execute(['Old3Months', $customerId]);
                    }
                }
            } catch (Throwable $e) { /* ignore */ }

            // Grant sale quota (+90 cap, bonus=1) only when BOTH Paid and Delivered are satisfied
            try {
                $st = $pdo->prepare('SELECT payment_status, order_status, customer_id FROM orders WHERE id=?');
                $st->execute([$id]);
                $row = $st->fetch();
                if ($row) {
                    $ps = (string)$row['payment_status'];
                    $os = (string)$row['order_status'];
                    $customerId = (string)$row['customer_id'];
                    if (strcasecmp($ps, 'Paid') === 0 && strcasecmp($os, 'Delivered') === 0) {
                        // Update customer's ownership and bonus with clamp to now+90
                        $cst = $pdo->prepare('SELECT ownership_expires FROM customers WHERE id=?');
                        $cst->execute([$customerId]);
                        $cexp = $cst->fetchColumn();
                        $now = new DateTime();
                        $maxAllowed = (clone $now); $maxAllowed->add(new DateInterval('P90D'));
                        $currentExpiry = $cexp ? new DateTime($cexp) : clone $now;
                        $newExpiry = clone $currentExpiry; $newExpiry->add(new DateInterval('P90D'));
                        if ($newExpiry > $maxAllowed) { $newExpiry = $maxAllowed; }
                        $u = $pdo->prepare('UPDATE customers SET ownership_expires=?, has_sold_before=1, last_sale_date=?, follow_up_count=0, lifecycle_status=?, followup_bonus_remaining=1 WHERE id=?');
                        $u->execute([$newExpiry->format('Y-m-d H:i:s'), $now->format('Y-m-d H:i:s'), 'Old3Months', $customerId]);
                    }
                }
            } catch (Throwable $e) { /* ignore quota errors to not block order update */ }
            if (isset($in['trackingNumbers']) && is_array($in['trackingNumbers'])) {
                // Replace existing tracking numbers with provided set (deduped)
                $del = $pdo->prepare('DELETE FROM order_tracking_numbers WHERE order_id=?');
                $del->execute([$id]);
                $ins = $pdo->prepare('INSERT INTO order_tracking_numbers (order_id, tracking_number) VALUES (?, ?)');
                $seen = [];
                foreach ($in['trackingNumbers'] as $tnRaw) {
                    $tn = trim((string)$tnRaw);
                    if ($tn === '') continue;
                    if (isset($seen[$tn])) continue;
                    $seen[$tn] = true;
                    $ins->execute([$id, $tn]);
                }
            }
            json_response(['ok' => true]);
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

function handle_pages(PDO $pdo, ?string $id): void {
    switch (method()) {
        case 'GET':
            if ($id) {
                $stmt = $pdo->prepare('SELECT * FROM pages WHERE id = ?');
                $stmt->execute([$id]);
                $row = $stmt->fetch();
                $row ? json_response($row) : json_response(['error' => 'NOT_FOUND'], 404);
            } else {
                $companyId = $_GET['companyId'] ?? null;
                $sql = 'SELECT * FROM pages';
                $params = [];
                if ($companyId) { $sql .= ' WHERE company_id = ?'; $params[] = $companyId; }
                $sql .= ' ORDER BY id DESC LIMIT 500';
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                json_response($stmt->fetchAll());
            }
            break;
        case 'POST':
            $in = json_input();
            $stmt = $pdo->prepare('INSERT INTO pages (name, platform, url, company_id, active) VALUES (?,?,?,?,?)');
            $stmt->execute([$in['name'] ?? '', $in['platform'] ?? 'Facebook', $in['url'] ?? null, $in['companyId'] ?? null, !empty($in['active']) ? 1 : 1]);
            json_response(['id' => $pdo->lastInsertId()]);
            break;
        case 'PATCH':
            if (!$id) json_response(['error' => 'ID_REQUIRED'], 400);
            $in = json_input();
            $stmt = $pdo->prepare('UPDATE pages SET name=COALESCE(?, name), platform=COALESCE(?, platform), url=COALESCE(?, url), company_id=COALESCE(?, company_id), active=COALESCE(?, active) WHERE id=?');
            $stmt->execute([$in['name'] ?? null, $in['platform'] ?? null, $in['url'] ?? null, $in['companyId'] ?? null, isset($in['active']) ? (!empty($in['active']) ? 1 : 0) : null, $id]);
            json_response(['ok' => true]);
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

function handle_ad_spend(PDO $pdo, ?string $id): void {
    switch (method()) {
        case 'GET':
            $pageId = $_GET['pageId'] ?? null;
            $sql = 'SELECT * FROM ad_spend';
            $params = [];
            if ($pageId) { $sql .= ' WHERE page_id=?'; $params[] = $pageId; }
            $sql .= ' ORDER BY spend_date DESC, id DESC LIMIT 500';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            json_response($stmt->fetchAll());
            break;
        case 'POST':
            $in = json_input();
            $stmt = $pdo->prepare('INSERT INTO ad_spend (page_id, spend_date, amount, notes) VALUES (?,?,?,?)');
            $stmt->execute([$in['pageId'] ?? null, $in['date'] ?? date('Y-m-d'), $in['amount'] ?? 0, $in['notes'] ?? null]);
            json_response(['id' => $pdo->lastInsertId()]);
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}
function ensure_order_slips_table(PDO $pdo): void {
    $pdo->exec('CREATE TABLE IF NOT EXISTS order_slips (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id VARCHAR(32) NOT NULL,
        url VARCHAR(1024) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_order_slips_order (order_id),
        CONSTRAINT fk_order_slips_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
}

function handle_order_slips(PDO $pdo, ?string $id): void {
    ensure_order_slips_table($pdo);
    $baseDir = __DIR__ . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'slips';
    if (!is_dir($baseDir)) { @mkdir($baseDir, 0775, true); }

    switch (method()) {
        case 'GET':
            $orderId = $_GET['orderId'] ?? null;
            if (!$orderId) { json_response(['error' => 'ORDER_ID_REQUIRED'], 400); }
            $st = $pdo->prepare('SELECT id, url, created_at FROM order_slips WHERE order_id=? ORDER BY id DESC');
            $st->execute([$orderId]);
            json_response($st->fetchAll());
            break;
        case 'POST':
            $in = json_input();
            $orderId = $in['orderId'] ?? '';
            $content = $in['contentBase64'] ?? '';
            if ($orderId === '' || $content === '') { json_response(['error' => 'INVALID_INPUT'], 400); }
            $url = null;
            if (preg_match('/^data:(image\/(png|jpeg|jpg|gif));base64,(.*)$/', $content, $m)) {
                $ext = $m[2] === 'jpeg' ? 'jpg' : $m[2];
                $data = base64_decode($m[3]);
                if ($data !== false) {
                    $fname = 'slip_' . preg_replace('/[^A-Za-z0-9_-]+/','', $orderId) . '_' . date('Ymd_His') . '_' . substr(md5(uniqid('', true)),0,6) . '.' . $ext;
                    $path = $baseDir . DIRECTORY_SEPARATOR . $fname;
                    if (file_put_contents($path, $data) !== false) {
                        $url = 'api/uploads/slips/' . $fname;
                    }
                }
            }
            if (!$url) { json_response(['error' => 'DECODE_FAILED'], 400); }
            $st = $pdo->prepare('INSERT INTO order_slips (order_id, url) VALUES (?, ?)');
            $st->execute([$orderId, $url]);
            json_response(['ok' => true, 'id' => $pdo->lastInsertId(), 'url' => $url]);
            break;
        case 'DELETE':
            if (!$id) { json_response(['error' => 'ID_REQUIRED'], 400); }
            $st = $pdo->prepare('SELECT url FROM order_slips WHERE id=?');
            $st->execute([$id]);
            $row = $st->fetch();
            if (!$row) { json_response(['error' => 'NOT_FOUND'], 404); }
            $url = $row['url'];
            if ($url) {
                $prefix = 'api/uploads/slips/';
                if (strpos($url, $prefix) === 0) {
                    $fs = __DIR__ . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'slips' . DIRECTORY_SEPARATOR . substr($url, strlen($prefix));
                    if (file_exists($fs)) { @unlink($fs); }
                }
            }
            $pdo->prepare('DELETE FROM order_slips WHERE id=?')->execute([$id]);
            json_response(['ok' => true]);
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

function ensure_exports_table(PDO $pdo): void {
    $pdo->exec('CREATE TABLE IF NOT EXISTS exports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        file_path VARCHAR(1024) NOT NULL,
        orders_count INT NOT NULL,
        user_id INT NULL,
        exported_by VARCHAR(128) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        download_count INT NOT NULL DEFAULT 0,
        INDEX idx_exports_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
}

function cleanup_old_exports(PDO $pdo, string $dir): void {
    try {
        // Delete DB rows older than 30 days and remove files
        $stmt = $pdo->prepare('SELECT id, file_path FROM exports WHERE created_at < (NOW() - INTERVAL 30 DAY)');
        $stmt->execute();
        $rows = $stmt->fetchAll();
        foreach ($rows as $r) {
            $path = $r['file_path'] ?? '';
            if ($path && file_exists($path)) { @unlink($path); }
        }
        $pdo->exec('DELETE FROM exports WHERE created_at < (NOW() - INTERVAL 30 DAY)');
    } catch (Throwable $e) { /* ignore cleanup errors */ }
}

function handle_exports(PDO $pdo, ?string $id): void {
    $baseDir = __DIR__ . DIRECTORY_SEPARATOR . 'exports';
    if (!is_dir($baseDir)) { @mkdir($baseDir, 0775, true); }
    ensure_exports_table($pdo);
    cleanup_old_exports($pdo, $baseDir);

    switch (method()) {
        case 'GET':
            if ($id) {
                $download = isset($_GET['download']) && ($_GET['download'] === '1' || $_GET['download'] === 'true');
                $stmt = $pdo->prepare('SELECT * FROM exports WHERE id = ?');
                $stmt->execute([$id]);
                $row = $stmt->fetch();
                if (!$row) json_response(['error' => 'NOT_FOUND'], 404);
                if ($download) {
                    $path = $row['file_path'];
                    if (!file_exists($path)) json_response(['error' => 'FILE_MISSING'], 404);
                    try { $pdo->prepare('UPDATE exports SET download_count = download_count + 1 WHERE id = ?')->execute([$id]); } catch (Throwable $e) { /* ignore */ }
                    header('Content-Type: text/csv; charset=utf-8');
                    header('Content-Disposition: attachment; filename="' . basename($row['filename']) . '"');
                    header('Content-Length: ' . filesize($path));
                    readfile($path);
                    exit;
                }
                json_response($row);
            } else {
                // List last 30 days
                $stmt = $pdo->prepare('SELECT * FROM exports WHERE created_at >= (NOW() - INTERVAL 30 DAY) ORDER BY created_at DESC LIMIT 200');
                $stmt->execute();
                json_response($stmt->fetchAll());
            }
            break;
        case 'POST':
            $in = json_input();
            $filename = trim((string)($in['filename'] ?? ''));
            $contentB64 = (string)($in['contentBase64'] ?? '');
            $ordersCount = (int)($in['ordersCount'] ?? 0);
            $userId = isset($in['userId']) ? (int)$in['userId'] : null;
            $exportedBy = isset($in['exportedBy']) ? (string)$in['exportedBy'] : null;
            if ($filename === '' || $contentB64 === '' || $ordersCount <= 0) {
                json_response(['error' => 'INVALID_INPUT'], 400);
            }
            $safeName = preg_replace('/[^A-Za-z0-9_.-]+/', '_', $filename);
            $ts = date('Ymd_His');
            $path = $baseDir . DIRECTORY_SEPARATOR . $ts . '_' . $safeName;
            $data = base64_decode($contentB64);
            if ($data === false) json_response(['error' => 'DECODE_FAILED'], 400);
            if (file_put_contents($path, $data) === false) json_response(['error' => 'WRITE_FAILED'], 500);

            $stmt = $pdo->prepare('INSERT INTO exports (filename, file_path, orders_count, user_id, exported_by) VALUES (?,?,?,?,?)');
            $stmt->execute([$safeName, $path, $ordersCount, $userId, $exportedBy]);
            json_response(['ok' => true, 'id' => $pdo->lastInsertId()]);
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

function get_order(PDO $pdo, string $id): ?array {
    $stmt = $pdo->prepare('SELECT * FROM orders WHERE id=?');
    $stmt->execute([$id]);
    $o = $stmt->fetch();
    if (!$o) return null;
    $items = $pdo->prepare('SELECT * FROM order_items WHERE order_id=?');
    $items->execute([$id]);
    $o['items'] = $items->fetchAll();
    $tn = $pdo->prepare('SELECT tracking_number FROM order_tracking_numbers WHERE order_id=?');
    $tn->execute([$id]);
    $tnRows = $tn->fetchAll();
    $tnList = [];
    foreach ($tnRows as $r) { $tnList[] = $r['tracking_number']; }
    $o['trackingNumbers'] = $tnList;
    $bx = $pdo->prepare('SELECT box_number, cod_amount FROM order_boxes WHERE order_id=?');
    $bx->execute([$id]);
    $o['boxes'] = $bx->fetchAll();
    // Include slips if table exists
    try {
        $sl = $pdo->prepare('SELECT id, url, created_at FROM order_slips WHERE order_id=? ORDER BY id DESC');
        $sl->execute([$id]);
        $o['slips'] = $sl->fetchAll();
    } catch (Throwable $e) { /* ignore if table not present */ }
    return $o;
}

function handle_appointments(PDO $pdo, ?string $id): void {
    switch (method()) {
        case 'GET':
            if ($id) {
                $stmt = $pdo->prepare('SELECT * FROM appointments WHERE id = ?');
                $stmt->execute([$id]);
                $row = $stmt->fetch();
                $row ? json_response($row) : json_response(['error' => 'NOT_FOUND'], 404);
            } else {
                $cid = $_GET['customerId'] ?? null;
                $sql = 'SELECT * FROM appointments';
                $params = [];
                if ($cid) { $sql .= ' WHERE customer_id=?'; $params[] = $cid; }
                $sql .= ' ORDER BY date DESC';
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                json_response($stmt->fetchAll());
            }
            break;
        case 'POST':
            $in = json_input();
            $stmt = $pdo->prepare('INSERT INTO appointments (customer_id, date, title, status, notes) VALUES (?,?,?,?,?)');
            $stmt->execute([$in['customerId'] ?? null, $in['date'] ?? date('c'), $in['title'] ?? '', $in['status'] ?? 'รอดำเนินการ', $in['notes'] ?? null]);
            json_response(['id' => $pdo->lastInsertId()]);
            break;
        case 'PATCH':
            if (!$id) {
                json_response(['error' => 'MISSING_ID'], 400);
                return;
            }
            $in = json_input();
            $fields = [];
            $params = [];
            foreach (['customer_id' => 'customerId', 'date' => 'date', 'title' => 'title', 'status' => 'status', 'notes' => 'notes'] as $col => $key) {
                if (isset($in[$key])) {
                    $fields[] = "$col=?";
                    $params[] = $in[$key];
                }
            }
            if (!$fields) {
                json_response(['error' => 'NO_FIELDS_TO_UPDATE'], 400);
                return;
            }
            $params[] = $id;
            $sql = 'UPDATE appointments SET ' . implode(',', $fields) . ' WHERE id=?';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            json_response(['ok' => true]);
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

function handle_calls(PDO $pdo, ?string $id): void {
    switch (method()) {
        case 'GET':
            if ($id) {
                $stmt = $pdo->prepare('SELECT * FROM call_history WHERE id = ?');
                $stmt->execute([$id]);
                $row = $stmt->fetch();
                $row ? json_response($row) : json_response(['error' => 'NOT_FOUND'], 404);
            } else {
                $cid = $_GET['customerId'] ?? null;
                $sql = 'SELECT * FROM call_history';
                $params = [];
                if ($cid) { $sql .= ' WHERE customer_id=?'; $params[] = $cid; }
                $sql .= ' ORDER BY date DESC';
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                json_response($stmt->fetchAll());
            }
            break;
        case 'POST':
            $in = json_input();
            $stmt = $pdo->prepare('INSERT INTO call_history (customer_id, date, caller, status, result, crop_type, area_size, notes, duration) VALUES (?,?,?,?,?,?,?,?,?)');
            $stmt->execute([
                $in['customerId'] ?? null, $in['date'] ?? date('c'), $in['caller'] ?? '', $in['status'] ?? '', $in['result'] ?? '',
                $in['cropType'] ?? null, $in['areaSize'] ?? null, $in['notes'] ?? null, $in['duration'] ?? null
            ]);
            // Increment total_calls and mark lifecycle to Old on first call
            if (!empty($in['customerId'])) {
                try {
                    $pdo->prepare('UPDATE customers SET total_calls = COALESCE(total_calls,0) + 1 WHERE id=?')->execute([$in['customerId']]);
                    $pdo->prepare('UPDATE customers SET lifecycle_status=\'Old\' WHERE id=? AND COALESCE(total_calls,0) <= 1')->execute([$in['customerId']]);
                } catch (Throwable $e) { /* ignore */ }
            }
            json_response(['id' => $pdo->lastInsertId()]);
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

function handle_tags(PDO $pdo, ?string $id): void {
    switch (method()) {
        case 'GET':
            $stmt = $pdo->query('SELECT * FROM tags ORDER BY id');
            json_response($stmt->fetchAll());
        case 'POST':
            $in = json_input();
            $stmt = $pdo->prepare('INSERT INTO tags (name, type) VALUES (?, ?)');
            $stmt->execute([$in['name'] ?? '', $in['type'] ?? 'USER']);
            json_response(['id' => $pdo->lastInsertId()]);
        case 'DELETE':
            if (!$id) json_response(['error' => 'ID_REQUIRED'], 400);
            try {
                $stmt = $pdo->prepare('DELETE FROM tags WHERE id = ?');
                $stmt->execute([$id]);
                json_response(['ok' => true]);
            } catch (Throwable $e) {
                json_response(['error' => 'DELETE_FAILED', 'message' => $e->getMessage()], 500);
            }
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

function handle_customer_tags(PDO $pdo): void {
    switch (method()) {
        case 'GET':
            $customerId = $_GET['customerId'] ?? null;
            if ($customerId) {
                $stmt = $pdo->prepare('SELECT ct.customer_id, t.id, t.name, t.type FROM customer_tags ct JOIN tags t ON t.id=ct.tag_id WHERE ct.customer_id=? ORDER BY t.name');
                $stmt->execute([$customerId]);
                json_response($stmt->fetchAll());
            } else {
                $stmt = $pdo->query('SELECT ct.customer_id, t.id, t.name, t.type FROM customer_tags ct JOIN tags t ON t.id=ct.tag_id ORDER BY ct.customer_id, t.name');
                json_response($stmt->fetchAll());
            }
        case 'POST':
            $in = json_input();
            $stmt = $pdo->prepare('INSERT INTO customer_tags (customer_id, tag_id) VALUES (?, ?)');
            $stmt->execute([$in['customerId'] ?? '', $in['tagId'] ?? 0]);
            json_response(['ok' => true]);
        case 'DELETE':
            $customerId = $_GET['customerId'] ?? '';
            $tagId = $_GET['tagId'] ?? '';
            if ($customerId === '' || $tagId === '') json_response(['error' => 'MISSING_PARAMS'], 400);
            $stmt = $pdo->prepare('DELETE FROM customer_tags WHERE customer_id=? AND tag_id=?');
            $stmt->execute([$customerId, $tagId]);
            json_response(['ok' => true]);
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

function handle_activities(PDO $pdo, ?string $id): void {
    switch (method()) {
        case 'GET':
            if ($id) {
                $stmt = $pdo->prepare('SELECT * FROM activities WHERE id = ?');
                $stmt->execute([$id]);
                $row = $stmt->fetch();
                $row ? json_response($row) : json_response(['error' => 'NOT_FOUND'], 404);
            } else {
                $cid = $_GET['customerId'] ?? null;
                $sql = 'SELECT * FROM activities';
                $params = [];
                if ($cid) { $sql .= ' WHERE customer_id=?'; $params[] = $cid; }
                $sql .= ' ORDER BY timestamp DESC';
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                json_response($stmt->fetchAll());
            }
            break;
        case 'POST':
            $in = json_input();
            $stmt = $pdo->prepare('INSERT INTO activities (customer_id, timestamp, type, description, actor_name) VALUES (?,?,?,?,?)');
            $stmt->execute([
                $in['customerId'] ?? null,
                $in['timestamp'] ?? date('c'),
                $in['type'] ?? '',
                $in['description'] ?? '',
                $in['actorName'] ?? ''
            ]);
            json_response(['id' => $pdo->lastInsertId()]);
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

function handle_do_dashboard(PDO $pdo): void {
    if (method() !== 'GET') {
        json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
        return;
    }
    
    $userId = $_GET['userId'] ?? null;
    $companyId = $_GET['companyId'] ?? null;
    
    if (!$userId) {
        json_response(['error' => 'USER_ID_REQUIRED'], 400);
        return;
    }
    
    // Get current time
    $now = new DateTime();
    $twoDaysLater = clone $now;
    $twoDaysLater->modify('+2 days');
    $fiveDaysLater = clone $now;
    $fiveDaysLater->modify('+5 days');
    $today = $now->format('Y-m-d');
    
    // Get customers assigned to the user
    $sql = "SELECT c.*, 
                   (SELECT COUNT(*) FROM appointments a WHERE a.customer_id = c.id AND a.status != 'เสร็จสิ้น' AND a.date <= ?) as upcoming_appointments,
                   (SELECT COUNT(*) FROM activities act WHERE act.customer_id = c.id) as activity_count
            FROM customers c 
            WHERE c.assigned_to = ?";
    
    $params = [$twoDaysLater->format('Y-m-d H:i:s'), $userId];
    
    if ($companyId) {
        $sql .= " AND c.company_id = ?";
        $params[] = $companyId;
    }
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $customers = $stmt->fetchAll();
    
    // Filter customers for the Do dashboard
    $doCustomers = [];
    $counts = [
        'followUp' => 0,
        'expiring' => 0,
        'daily' => 0,
        'new' => 0
    ];
    
    foreach ($customers as $customer) {
        $includeCustomer = false;
        
        // Check for upcoming follow-ups (due within 2 days)
        if ($customer['upcoming_appointments'] > 0) {
            $includeCustomer = true;
            $counts['followUp']++;
        }
        // Check for expiring ownership (within 5 days)
        else if ($customer['ownership_expires'] && new DateTime($customer['ownership_expires']) <= $fiveDaysLater && new DateTime($customer['ownership_expires']) >= $now) {
            $includeCustomer = true;
            $counts['expiring']++;
        }
        // Check for daily distribution customers with no activity
        else if ($customer['lifecycle_status'] === 'ลูกค้าแจกรายวัน' && $customer['activity_count'] == 0) {
            $assignedDate = new DateTime($customer['date_assigned']);
            $assignedDate->setTime(0, 0, 0);
            $todayDate = new DateTime($today);
            if ($assignedDate->format('Y-m-d') === $todayDate->format('Y-m-d')) {
                $includeCustomer = true;
                $counts['daily']++;
            }
        }
        // Check for new customers with no activity
        else if ($customer['lifecycle_status'] === 'ลูกค้าใหม่' && $customer['activity_count'] == 0) {
            $includeCustomer = true;
            $counts['new']++;
        }
        
        if ($includeCustomer) {
            // Add tags to customer
            $tagStmt = $pdo->prepare('SELECT t.* FROM tags t JOIN customer_tags ct ON ct.tag_id=t.id WHERE ct.customer_id=?');
            $tagStmt->execute([$customer['id']]);
            $customer['tags'] = $tagStmt->fetchAll();
            
            $doCustomers[] = $customer;
        }
    }
    
    json_response([
        'customers' => $doCustomers,
        'counts' => $counts
    ]);
}
function handle_permissions(PDO $pdo): void {
    // Ensure table exists
    $pdo->exec('CREATE TABLE IF NOT EXISTS role_permissions (
        role VARCHAR(64) PRIMARY KEY,
        data TEXT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;');

    switch (method()) {
        case 'GET':
            $role = $_GET['role'] ?? '';
            if ($role === '') json_response(['error' => 'ROLE_REQUIRED'], 400);
            $stmt = $pdo->prepare('SELECT data FROM role_permissions WHERE role = ?');
            $stmt->execute([$role]);
            $row = $stmt->fetch();
            $data = null;
            if ($row && isset($row['data'])) {
                $decoded = json_decode($row['data'], true);
                $data = is_array($decoded) ? $decoded : null;
            }
            json_response(['role' => $role, 'data' => $data]);
        case 'PUT':
        case 'POST':
            $in = json_input();
            $role = $in['role'] ?? '';
            $data = $in['data'] ?? [];
            if ($role === '') json_response(['error' => 'ROLE_REQUIRED'], 400);
            $json = json_encode($data);
            $stmt = $pdo->prepare('INSERT INTO role_permissions(role, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data=VALUES(data)');
            $stmt->execute([$role, $json]);
            json_response(['ok' => true]);
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

// ==================== Companies Handler ====================
function handle_companies(PDO $pdo, ?string $id): void {
    switch (method()) {
        case 'GET':
            if ($id) {
                $stmt = $pdo->prepare('SELECT * FROM companies WHERE id = ?');
                $stmt->execute([$id]);
                $row = $stmt->fetch();
                $row ? json_response($row) : json_response(['error' => 'NOT_FOUND'], 404);
            } else {
                $stmt = $pdo->query('SELECT * FROM companies ORDER BY id ASC');
                json_response($stmt->fetchAll());
            }
            break;
        case 'POST':
            $in = json_input();
            $name = $in['name'] ?? '';
            if (!$name) json_response(['error' => 'NAME_REQUIRED'], 400);
            
            $address = $in['address'] ?? null;
            $phone = $in['phone'] ?? null;
            $email = $in['email'] ?? null;
            $taxId = $in['taxId'] ?? null;
            
            $stmt = $pdo->prepare('INSERT INTO companies (name, address, phone, email, tax_id) VALUES (?, ?, ?, ?, ?)');
            $stmt->execute([$name, $address, $phone, $email, $taxId]);
            json_response(['id' => $pdo->lastInsertId()]);
            break;
        case 'PATCH':
            if (!$id) json_response(['error' => 'ID_REQUIRED'], 400);
            $in = json_input();
            
            $updates = [];
            $params = [];
            if (isset($in['name'])) { $updates[] = 'name = ?'; $params[] = $in['name']; }
            if (isset($in['address'])) { $updates[] = 'address = ?'; $params[] = $in['address']; }
            if (isset($in['phone'])) { $updates[] = 'phone = ?'; $params[] = $in['phone']; }
            if (isset($in['email'])) { $updates[] = 'email = ?'; $params[] = $in['email']; }
            if (isset($in['taxId'])) { $updates[] = 'tax_id = ?'; $params[] = $in['taxId']; }
            
            if (empty($updates)) json_response(['ok' => true]);
            
            $params[] = $id;
            $sql = 'UPDATE companies SET ' . implode(', ', $updates) . ' WHERE id = ?';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            json_response(['ok' => true]);
            break;
        case 'DELETE':
            if (!$id) json_response(['error' => 'ID_REQUIRED'], 400);
            $stmt = $pdo->prepare('DELETE FROM companies WHERE id = ?');
            $stmt->execute([$id]);
            json_response(['ok' => true]);
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

// ==================== Warehouses Handler ====================
function handle_warehouses(PDO $pdo, ?string $id): void {
    switch (method()) {
        case 'GET':
            if ($id) {
                $stmt = $pdo->prepare('SELECT w.*, c.name as company_name FROM warehouses w LEFT JOIN companies c ON w.company_id = c.id WHERE w.id = ?');
                $stmt->execute([$id]);
                $row = $stmt->fetch();
                if ($row) {
                    $row['responsible_provinces'] = json_decode($row['responsible_provinces'] ?? '[]', true);
                    json_response($row);
                } else {
                    json_response(['error' => 'NOT_FOUND'], 404);
                }
            } else {
                $companyId = $_GET['companyId'] ?? null;
                $sql = 'SELECT w.*, c.name as company_name FROM warehouses w LEFT JOIN companies c ON w.company_id = c.id';
                $params = [];
                if ($companyId) { $sql .= ' WHERE w.company_id = ?'; $params[] = $companyId; }
                $sql .= ' ORDER BY w.id ASC';
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $rows = $stmt->fetchAll();
                foreach ($rows as &$row) {
                    $row['responsible_provinces'] = json_decode($row['responsible_provinces'] ?? '[]', true);
                }
                json_response($rows);
            }
            break;
        case 'POST':
            $in = json_input();
            $name = $in['name'] ?? '';
            $companyId = $in['companyId'] ?? null;
            $address = $in['address'] ?? '';
            $province = $in['province'] ?? '';
            $district = $in['district'] ?? '';
            $subdistrict = $in['subdistrict'] ?? '';
            $managerName = $in['managerName'] ?? '';
            
            if (!$name || !$companyId || !$address || !$province || !$district || !$subdistrict || !$managerName) {
                json_response(['error' => 'REQUIRED_FIELDS_MISSING'], 400);
            }
            
            $postalCode = $in['postalCode'] ?? null;
            $phone = $in['phone'] ?? null;
            $email = $in['email'] ?? null;
            $managerPhone = $in['managerPhone'] ?? null;
            $responsibleProvinces = json_encode($in['responsibleProvinces'] ?? []);
            $isActive = isset($in['isActive']) ? ($in['isActive'] ? 1 : 0) : 1;
            
            $stmt = $pdo->prepare('INSERT INTO warehouses (name, company_id, address, province, district, subdistrict, postal_code, phone, email, manager_name, manager_phone, responsible_provinces, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            $stmt->execute([$name, $companyId, $address, $province, $district, $subdistrict, $postalCode, $phone, $email, $managerName, $managerPhone, $responsibleProvinces, $isActive]);
            json_response(['id' => $pdo->lastInsertId()]);
            break;
        case 'PATCH':
            if (!$id) json_response(['error' => 'ID_REQUIRED'], 400);
            $in = json_input();
            
            $updates = [];
            $params = [];
            if (isset($in['name'])) { $updates[] = 'name = ?'; $params[] = $in['name']; }
            if (isset($in['companyId'])) { $updates[] = 'company_id = ?'; $params[] = $in['companyId']; }
            if (isset($in['address'])) { $updates[] = 'address = ?'; $params[] = $in['address']; }
            if (isset($in['province'])) { $updates[] = 'province = ?'; $params[] = $in['province']; }
            if (isset($in['district'])) { $updates[] = 'district = ?'; $params[] = $in['district']; }
            if (isset($in['subdistrict'])) { $updates[] = 'subdistrict = ?'; $params[] = $in['subdistrict']; }
            if (isset($in['postalCode'])) { $updates[] = 'postal_code = ?'; $params[] = $in['postalCode']; }
            if (isset($in['phone'])) { $updates[] = 'phone = ?'; $params[] = $in['phone']; }
            if (isset($in['email'])) { $updates[] = 'email = ?'; $params[] = $in['email']; }
            if (isset($in['managerName'])) { $updates[] = 'manager_name = ?'; $params[] = $in['managerName']; }
            if (isset($in['managerPhone'])) { $updates[] = 'manager_phone = ?'; $params[] = $in['managerPhone']; }
            if (isset($in['responsibleProvinces'])) { $updates[] = 'responsible_provinces = ?'; $params[] = json_encode($in['responsibleProvinces']); }
            if (isset($in['isActive'])) { $updates[] = 'is_active = ?'; $params[] = $in['isActive'] ? 1 : 0; }
            
            if (empty($updates)) json_response(['ok' => true]);
            
            $params[] = $id;
            $sql = 'UPDATE warehouses SET ' . implode(', ', $updates) . ' WHERE id = ?';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            json_response(['ok' => true]);
            break;
        case 'DELETE':
            if (!$id) json_response(['error' => 'ID_REQUIRED'], 400);
            $stmt = $pdo->prepare('DELETE FROM warehouses WHERE id = ?');
            $stmt->execute([$id]);
            json_response(['ok' => true]);
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}


