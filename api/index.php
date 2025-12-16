<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/Services/ShippingSyncService.php';

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
$action = $parts[2] ?? null;

if ($resource === 'notifications' && $action === null && $id !== null) {
    $action = $id;
    $id = null;
}

if ($resource === '' || $resource === 'health') {
    json_response(['ok' => true, 'status' => 'healthy']);
}

if (!in_array($resource, ['', 'health', 'auth', 'uploads'])) {
    validate_auth($pdo);
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
    case 'roles':
        require_once __DIR__ . '/roles.php';
        handle_roles($pdo, $id, $action);
        break;
    case 'user_permissions':
        handle_user_permissions($pdo, $id, $action);
        break;
    case 'permissions':
        handle_permissions($pdo);
        break;
        case 'users':
            $subAction = $parts[3] ?? null;
            handle_users($pdo, $id, $action, $subAction);
            break;
        case 'customer_blocks':
            handle_customer_blocks($pdo, $id);
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
    case 'accounting_orders_sent':
        require_once __DIR__ . '/Accounting/sent_orders.php';
        handle_sent_orders($pdo);
        break;
    case 'accounting_orders_approved':
        require_once __DIR__ . '/Accounting/approved_orders.php';
        handle_approved_orders($pdo);
        break;

    case 'accounting_statement_report':
        require_once __DIR__ . '/Accounting/statement_report.php';
        handle_statement_report($pdo);
        break;

    case 'accounting_dashboard_stats':
        require_once __DIR__ . '/Accounting/dashboard_stats.php';
        handle_dashboard_stats($pdo);
        break;

    case 'accounting_outstanding_orders':
        require_once __DIR__ . '/Accounting/outstanding_orders.php';
        handle_outstanding_orders($pdo);
        break;

    case 'accounting_update_order_status':
        require_once __DIR__ . '/Orders/update_order_status.php';
        handle_update_order_status($pdo);
        break;
    case 'accounting_revenue_recognition':
        require_once __DIR__ . '/Accounting/get_revenue_recognition.php';
        handle_revenue_recognition($pdo);
        break;
    case 'upsell':
        handle_upsell($pdo, $id, $action);
        break;
    case 'user_pancake_mappings':
        handle_user_pancake_mappings($pdo, $id);
        break;
    case 'pages':
        handle_pages($pdo, $id);
        break;
    case 'platforms':
        handle_platforms($pdo, $id);
        break;
    case 'bank_accounts':
        handle_bank_accounts($pdo, $id);
        break;
    case 'warehouses':
        handle_warehouses($pdo, $id);
        break;
    case 'suppliers':
        handle_suppliers($pdo, $id);
        break;
    case 'purchases':
        handle_purchases($pdo, $id, $action);
        break;
    case 'warehouse_stocks':
        handle_warehouse_stocks($pdo, $id);
        break;
    case 'product_lots':
        handle_product_lots($pdo, $id);
        break;
    case 'stock_movements':
        handle_stock_movements($pdo, $id);
        break;
    case 'allocations':
        handle_allocations($pdo, $id, $action);
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
    case 'Statement_DB':
        // Safe inclusion of Statement_DB scripts
        $script = basename($id);
        if (file_exists(__DIR__ . '/Statement_DB/' . $script)) {
             require __DIR__ . '/Statement_DB/' . $script;
        } else {
             http_response_code(404);
             echo json_encode(['error' => 'Not Found', 'script' => $script]);
        }
        break;
    case 'cod_documents':
        handle_cod_documents($pdo, $id);
        break;
    case 'cod_records':
        handle_cod_records($pdo, $id);
        break;
    case 'activities':
        handle_activities($pdo, $id);
        break;
    case 'customer_logs':
        handle_customer_logs($pdo, $id);
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
    case 'uploads':
        // Handle static file serving for uploads (e.g., slips)
        if ($id === 'slips' && $action !== null) {
            handle_serve_slip_file($action);
        } else {
            json_response(['error' => 'NOT_FOUND'], 404);
        }
        break;
    case 'ownership':
        require_once __DIR__ . '/ownership_handler.php';
        handle_ownership($pdo, $id);
        break;
    case 'update_customer_order_tracking.php':
        // Bridge to legacy script without changing frontend path
        require_once __DIR__ . '/update_customer_order_tracking.php';
        break;
    case 'user_login_history':
        handle_user_login_history($pdo, $id);
        break;
    case 'attendance':
        handle_attendance($pdo, $id, $action);
        break;
    case 'call_overview':
        handle_call_overview($pdo);
        break;
    case 'import_google_sheet':
        require_once __DIR__ . '/GoogleSheet/import.php';
        // import.php handles GET/POST internally
        exit;
        break;
    case 'notifications':
        // handled separately below to support nested actions like settings/get
        break;
    default:
        json_response(['ok' => false, 'error' => 'NOT_FOUND', 'path' => $parts], 404);
}

function ensure_user_pancake_mapping_table(PDO $pdo): void {
    $pdo->exec('CREATE TABLE IF NOT EXISTS user_pancake_mapping (
        id INT AUTO_INCREMENT PRIMARY KEY,
        id_user INT NOT NULL,
        id_panake VARCHAR(191) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_user (id_user),
        UNIQUE KEY uniq_panake (id_panake),
        KEY idx_user (id_user),
        KEY idx_panake (id_panake),
        CONSTRAINT fk_upm_user FOREIGN KEY (id_user) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
}

function handle_user_pancake_mappings(PDO $pdo, ?string $id): void {
    ensure_user_pancake_mapping_table($pdo);
    switch (method()) {
        case 'GET':
            if ($id) {
                $stmt = $pdo->prepare('SELECT * FROM user_pancake_mapping WHERE id = ?');
                $stmt->execute([$id]);
                $row = $stmt->fetch();
                $row ? json_response($row) : json_response(['error' => 'NOT_FOUND'], 404);
            } else {
                $stmt = $pdo->query('SELECT * FROM user_pancake_mapping ORDER BY created_at DESC');
                json_response($stmt->fetchAll());
            }
            break;
        case 'POST':
            $in = json_input();
            $idUser = isset($in['id_user']) ? (int)$in['id_user'] : null;
            $idPanake = isset($in['id_panake']) ? (string)$in['id_panake'] : null;
            if (!$idUser || $idPanake === null || $idPanake === '') {
                json_response(['error' => 'VALIDATION_FAILED', 'message' => 'id_user and id_panake are required'], 400);
            }
            try {
                $sql = 'INSERT INTO user_pancake_mapping (id_user, id_panake) VALUES (?, ?) 
                        ON DUPLICATE KEY UPDATE id_panake = VALUES(id_panake), created_at = NOW()';
                $stmt = $pdo->prepare($sql);
                $stmt->execute([$idUser, $idPanake]);
                $sel = $pdo->prepare('SELECT * FROM user_pancake_mapping WHERE id_user = ?');
                $sel->execute([$idUser]);
                json_response($sel->fetch(), 201);
            } catch (Throwable $e) {
                json_response(['error' => 'UPSERT_FAILED', 'message' => $e->getMessage()], 409);
            }
            break;
        case 'PUT':
        case 'PATCH':
            if (!$id) json_response(['error' => 'ID_REQUIRED'], 400);
            $in = json_input();
            $fields = [];
            $params = [];
            if (array_key_exists('id_user', $in)) { $fields[] = 'id_user = ?'; $params[] = (int)$in['id_user']; }
            if (array_key_exists('id_panake', $in)) { $fields[] = 'id_panake = ?'; $params[] = (string)$in['id_panake']; }
            if (empty($fields)) json_response(['ok' => true]);
            $sql = 'UPDATE user_pancake_mapping SET ' . implode(', ', $fields) . ', created_at = created_at WHERE id = ?';
            $params[] = (int)$id;
            try {
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                json_response(['ok' => true]);
            } catch (Throwable $e) {
                json_response(['error' => 'UPDATE_FAILED', 'message' => $e->getMessage()], 409);
            }
            break;
        case 'DELETE':
            if (!$id) json_response(['error' => 'ID_REQUIRED'], 400);
            $stmt = $pdo->prepare('DELETE FROM user_pancake_mapping WHERE id = ?');
            $stmt->execute([(int)$id]);
            json_response(['ok' => true]);
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
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

        // Check if user status is active
        $stmt = $pdo->prepare('SELECT id, username, password, first_name, last_name, email, phone, role, company_id, team_id, supervisor_id, status FROM users WHERE username=? LIMIT 1');
        $stmt->execute([$username]);
        $u = $stmt->fetch();
        if (!$u) json_response(['ok' => false, 'error' => 'INVALID_CREDENTIALS'], 401);

        // Check if user is active
        if ($u['status'] !== 'active') {
            json_response(['ok' => false, 'error' => 'ACCOUNT_INACTIVE', 'message' => 'Your account is not active'], 401);
        }

        // Demo: plaintext password match (replace with hashing in production)
        if (!hash_equals((string)$u['password'], (string)$password)) {
            json_response(['ok' => false, 'error' => 'INVALID_CREDENTIALS'], 401);
        }

        // Update last login and increment login count
        try {
            $updateStmt = $pdo->prepare('UPDATE users SET last_login = NOW(), login_count = login_count + 1 WHERE id = ?');
            $updateStmt->execute([$u['id']]);

            // Generate Access Token
            $token = bin2hex(random_bytes(32));
            $expires = date('Y-m-d H:i:s', strtotime('+30 days'));
            $pdo->prepare('INSERT INTO user_tokens (user_id, token, expires_at) VALUES (?, ?, ?)')->execute([$u['id'], $token, $expires]);

            // Optionally record work login when explicitly requested
            $workLogin = isset($in['workLogin']) ? (bool)$in['workLogin'] : false;
            if ($workLogin) {
                $today = (new DateTime('now'))->format('Y-m-d');
                // Prevent duplicate login history rows for the same user/date
                $existsStmt = $pdo->prepare('SELECT id, login_time FROM user_login_history WHERE user_id = ? AND login_time >= ? AND login_time < DATE_ADD(?, INTERVAL 1 DAY) ORDER BY login_time ASC LIMIT 1');
                $existsStmt->execute([$u['id'], $today, $today]);
                $existing = $existsStmt->fetch();
                if ($existing) {
                    $loginHistoryId = (int)$existing['id'];
                    $loginHistoryTime = $existing['login_time'];
                } else {
                    $ipAddress = $_SERVER['REMOTE_ADDR'] ?? null;
                    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? null;
                    $loginStmt = $pdo->prepare('INSERT INTO user_login_history (user_id, login_time, ip_address, user_agent) VALUES (?, NOW(), ?, ?)');
                    $loginStmt->execute([$u['id'], $ipAddress, $userAgent]);
                    $loginHistoryId = (int)$pdo->lastInsertId();
                    $loginHistoryTime = null;
                }

                // Keep daily attendance in sync when a login history already exists
                try {
                    $pdo->prepare('CALL sp_upsert_user_daily_attendance(?, ?)')->execute([$u['id'], $today]);
                } catch (Throwable $e) {
                    // Non-fatal: attendance will recompute on next check-in/list call
                }
            }
        } catch (Throwable $e) {
            // Log error but don't fail login
            error_log('Failed to update login info: ' . $e->getMessage());
        }

        unset($u['password']);
        $resp = ['ok' => true, 'user' => $u, 'token' => $token];
        if (isset($loginHistoryId)) {
            $resp['loginHistoryId'] = $loginHistoryId;
            if (isset($loginHistoryTime)) {
                $resp['loginTime'] = $loginHistoryTime;
            }
        }
        json_response($resp);
    }
    json_response(['error' => 'NOT_FOUND'], 404);
}

function handle_users(PDO $pdo, ?string $id, ?string $action = null, ?string $subAction = null): void {
    if ($id && $action === 'permissions') {
        handle_user_permissions($pdo, $id, $subAction);
        return;
    }

    switch (method()) {
        case 'GET':
            if ($id) {
                $stmt = $pdo->prepare('SELECT id, username, first_name, last_name, email, phone, role, company_id, team_id, supervisor_id, status, created_at, updated_at, last_login, login_count FROM users WHERE id = ?');
                $stmt->execute([$id]);
                $row = $stmt->fetch();
                if ($row) {
                    // Load customTags for this user
                    $tagsStmt = $pdo->prepare('SELECT t.* FROM tags t JOIN user_tags ut ON t.id = ut.tag_id WHERE ut.user_id = ? AND t.type = ?');
                    $tagsStmt->execute([$id, 'USER']);
                    $row['customTags'] = $tagsStmt->fetchAll();
                    json_response($row);
                } else {
                    json_response(['error' => 'NOT_FOUND'], 404);
                }
            } else {
                $companyId = $_GET['companyId'] ?? null;
                $status = $_GET['status'] ?? null;
                $sql = 'SELECT id, username, first_name, last_name, email, phone, role, company_id, team_id, supervisor_id, status, created_at, updated_at, last_login, login_count FROM users';
                $params = [];
                $conditions = [];

                if ($companyId) {
                    $conditions[] = 'company_id = ?';
                    $params[] = $companyId;
                }

                if ($status) {
                    $conditions[] = 'status = ?';
                    $params[] = $status;
                }

                if (!empty($conditions)) {
                    $sql .= ' WHERE ' . implode(' AND ', $conditions);
                }

                $sql .= ' ORDER BY id';
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $users = $stmt->fetchAll();
                
                // Load customTags for each user
                foreach ($users as &$user) {
                    $tagsStmt = $pdo->prepare('SELECT t.* FROM tags t JOIN user_tags ut ON t.id = ut.tag_id WHERE ut.user_id = ? AND t.type = ?');
                    $tagsStmt->execute([$user['id'], 'USER']);
                    $user['customTags'] = $tagsStmt->fetchAll();
                }
                unset($user);
                
                json_response($users);
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
            $status = $in['status'] ?? 'active';

            if ($username === '' || $first === '' || $last === '' || $role === '' || !$companyId) {
                json_response(['error' => 'VALIDATION_FAILED', 'message' => 'username, firstName, lastName, role, companyId are required'], 400);
            }
            try {
                $stmt = $pdo->prepare('INSERT INTO users(username, password, first_name, last_name, email, phone, role, company_id, team_id, supervisor_id, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?, NOW(), NOW())');
                $stmt->execute([$username, $password, $first, $last, $email, $phone, $role, $companyId, $teamId, $supervisorId, $status]);
                $newId = (int)$pdo->lastInsertId();
                $get = $pdo->prepare('SELECT id, username, first_name, last_name, email, phone, role, company_id, team_id, supervisor_id, status, created_at, updated_at, last_login, login_count FROM users WHERE id = ?');
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
                'status' => 'status',
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
            // Always update updated_at timestamp
            $fields[] = "updated_at = NOW()";
            $params[] = $id;
            try {
                $sql = 'UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = ?';
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $get = $pdo->prepare('SELECT id, username, first_name, last_name, email, phone, role, company_id, team_id, supervisor_id, status, created_at, updated_at, last_login, login_count FROM users WHERE id = ?');
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
                // Instead of deleting, mark as resigned
                $stmt = $pdo->prepare('UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?');
                $stmt->execute(['resigned', $id]);
                json_response(['ok' => true]);
            } catch (Throwable $e) {
                json_response(['error' => 'UPDATE_FAILED', 'message' => $e->getMessage()], 409);
            }
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

function handle_customers(PDO $pdo, ?string $id): void {
    switch (method()) {
        case 'GET':
            try {
                if ($id) {
                    $stmt = $pdo->prepare('SELECT * FROM customers WHERE customer_id = ?');
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
                    $source = isset($_GET['source']) ? strtolower(trim((string)$_GET['source'])) : null; // new_sale | waiting_return | stock
                    $freshDays = isset($_GET['freshDays']) ? (int)$_GET['freshDays'] : 7; // for new_sale freshness window

                    if ($bucket === 'NewForMe') {
                        if (!$userId) json_response(['error' => 'USER_ID_REQUIRED'], 400);
                        $sql = 'SELECT c.*
                                FROM customers c
                                JOIN users u ON u.id = ?
                                WHERE c.assigned_to = ?
                                  AND EXISTS (SELECT 1 FROM customer_assignment_history h WHERE h.customer_id=c.customer_id AND h.user_id=?)
                                  AND NOT EXISTS (
                                       SELECT 1 FROM call_history ch
                                       WHERE ch.customer_id=c.customer_id AND ch.caller = CONCAT(u.first_name, " ", u.last_name)
                                  )';
                        $params = [$userId, $userId, $userId];
                        if ($companyId) { $sql .= ' AND c.company_id = ?'; $params[] = $companyId; }
                        if ($q !== '') {
                            $sql .= ' AND (c.first_name LIKE ? OR c.last_name LIKE ? OR c.phone LIKE ? OR c.customer_id LIKE ?)';
                            $params[] = "%$q%"; $params[] = "%$q%"; $params[] = "%$q%"; $params[] = "%$q%";
                        }
                        $sql .= ' ORDER BY c.date_assigned DESC LIMIT 200';
                        $stmt = $pdo->prepare($sql);
                        $stmt->execute($params);
                        $customers = $stmt->fetchAll();

                        // Add tags to each customer
                        foreach ($customers as &$customer) {
                            $tagsStmt = $pdo->prepare('SELECT t.* FROM tags t JOIN customer_tags ct ON ct.tag_id=t.id WHERE ct.customer_id=?');
                            $tagsStmt->execute([$customer['customer_id']]); // Use customer_id
                            $customer['tags'] = $tagsStmt->fetchAll();
                        }

                        json_response($customers);
                    } elseif (in_array($source, ['new_sale','waiting_return','stock'], true)) {
                        // Source-specific pools
                        $params = [];
                        if ($source === 'new_sale') {
                            $sql = "SELECT DISTINCT c.*\n"
                                 . "FROM customers c\n"
                                 . "JOIN orders o ON o.customer_id = c.customer_id\n"
                                 . "LEFT JOIN users u ON u.id = o.creator_id\n"
                                 . "WHERE COALESCE(c.is_blocked,0) = 0\n"
                                 . "  AND (u.role = 'Admin Page' OR o.sales_channel IS NOT NULL OR o.sales_channel_page_id IS NOT NULL)\n"
                                 . "  AND (o.order_status IS NULL OR o.order_status <> 'Cancelled')\n"
                                 . "  AND TIMESTAMPDIFF(DAY, o.order_date, NOW()) <= ?";
                            $params[] = max(0, $freshDays);
                            if ($companyId) { $sql .= " AND c.company_id = ?"; $params[] = $companyId; }
                            if ($q !== '') {
                                $sql .= " AND (c.first_name LIKE ? OR c.last_name LIKE ? OR c.phone LIKE ? OR c.customer_id LIKE ?)";
                                $like = "%$q%"; $params[] = $like; $params[] = $like; $params[] = $like; $params[] = $like;
                            }
                            $sql .= " ORDER BY o.order_date DESC, c.date_assigned DESC LIMIT 200";
                        } elseif ($source === 'waiting_return') {
                            $sql = "SELECT c.* FROM customers c\n"
                                 . "WHERE COALESCE(c.is_blocked,0) = 0\n"
                                 . "  AND c.is_in_waiting_basket = 1\n"
                                 . "  AND c.waiting_basket_start_date IS NOT NULL\n"
                                 . "  AND TIMESTAMPDIFF(DAY, c.waiting_basket_start_date, NOW()) >= 30\n"
                                 . "  AND c.assigned_to IS NULL";
                            if ($companyId) { $sql .= " AND c.company_id = ?"; $params[] = $companyId; }
                            if ($q !== '') {
                                $sql .= " AND (c.first_name LIKE ? OR c.last_name LIKE ? OR c.phone LIKE ? OR c.customer_id LIKE ?)";
                                $like = "%$q%"; $params[] = $like; $params[] = $like; $params[] = $like; $params[] = $like;
                            }
                            $sql .= " ORDER BY c.waiting_basket_start_date ASC LIMIT 200";
                        } else { // stock
                            $sql = "SELECT c.* FROM customers c\n"
                                 . "WHERE COALESCE(c.is_blocked,0) = 0\n"
                                 . "  AND c.assigned_to IS NULL\n"
                                 . "  AND COALESCE(c.is_in_waiting_basket,0) = 0\n"
                                 . "  AND NOT EXISTS (\n"
                                 . "        SELECT 1 FROM orders o\n"
                                 . "        LEFT JOIN users u ON u.id = o.creator_id\n"
                                 . "        WHERE o.customer_id = c.customer_id\n"
                                 . "          AND (u.role = 'Admin Page' OR o.sales_channel IS NOT NULL OR o.sales_channel_page_id IS NOT NULL)\n"
                                 . "          AND (o.order_status IS NULL OR o.order_status <> 'Cancelled')\n"
                                 . "          AND TIMESTAMPDIFF(DAY, o.order_date, NOW()) <= ?\n"
                                 . "  )";
                            $params[] = max(0, $freshDays);
                            if ($companyId) { $sql .= " AND c.company_id = ?"; $params[] = $companyId; }
                            if ($q !== '') {
                                $sql .= " AND (c.first_name LIKE ? OR c.last_name LIKE ? OR c.phone LIKE ? OR c.customer_id LIKE ?)";
                                $like = "%$q%"; $params[] = $like; $params[] = $like; $params[] = $like; $params[] = $like;
                            }
                            $sql .= " ORDER BY c.date_assigned DESC LIMIT 200";
                        }

                        $stmt = $pdo->prepare($sql);
                        $stmt->execute($params);
                        $customers = $stmt->fetchAll();

                        // Add tags to each customer
                        foreach ($customers as &$customer) {
                            $tagsStmt = $pdo->prepare('SELECT t.* FROM tags t JOIN customer_tags ct ON ct.tag_id=t.id WHERE ct.customer_id=?');
                            $tagsStmt->execute([$customer['customer_id']]);
                            $customer['tags'] = $tagsStmt->fetchAll();
                        }

                        json_response($customers);
                    } else {
                        $sql = 'SELECT * FROM customers WHERE 1';
                        $params = [];
                        if ($q !== '') { $sql .= ' AND (first_name LIKE ? OR last_name LIKE ? OR phone LIKE ? OR customer_id LIKE ?)'; $params[] = "%$q%"; $params[] = "%$q%"; $params[] = "%$q%"; $params[] = "%$q%"; }
                        if ($companyId) { $sql .= ' AND company_id = ?'; $params[] = $companyId; }
                        $sql .= ' ORDER BY date_assigned DESC LIMIT 200';
                        $stmt = $pdo->prepare($sql);
                        $stmt->execute($params);
                        $customers = $stmt->fetchAll();

                        // Add tags to each customer
                        foreach ($customers as &$customer) {
                            $tagsStmt = $pdo->prepare('SELECT t.* FROM tags t JOIN customer_tags ct ON ct.tag_id=t.id WHERE ct.customer_id=?');
                            $tagsStmt->execute([$customer['customer_id']]);
                            $customer['tags'] = $tagsStmt->fetchAll();
                        }

                        json_response($customers);
                    }
                }
            } catch (Throwable $e) {
                json_response(['error' => 'QUERY_FAILED', 'message' => $e->getMessage()], 500);
            }
            break;
        case 'POST':
            $in = json_input();
            $phoneCandidate = trim($in['phone'] ?? '');
            $companyCandidate = $in['companyId'] ?? null;
            if ($phoneCandidate !== '' && $companyCandidate) {
                $dupStmt = $pdo->prepare('SELECT first_name, last_name FROM customers WHERE phone = ? AND company_id = ? LIMIT 1');
                $dupStmt->execute([$phoneCandidate, $companyCandidate]);
                $duplicate = $dupStmt->fetch();
                if ($duplicate) {
                    json_response([
                        'error' => 'DUPLICATE_PHONE',
                        'message' => "เบอร์โทรศัพท์ซ้ำกับลูกค้า {$duplicate['first_name']} {$duplicate['last_name']}",
                    ], 409);
                }
            }
            // Updated INSERT to use customer_ref_id and let customer_id be auto-increment
            error_log(json_encode([
                'action' => 'create_customer',
                'customerId' => $in['customerId'] ?? $in['id'] ?? null,
                'phone' => $in['phone'] ?? null,
                'backupPhone' => $in['backupPhone'] ?? null,
            ]));
            $stmt = $pdo->prepare('INSERT INTO customers (customer_ref_id, first_name, last_name, phone, backup_phone, email, province, company_id, assigned_to, date_assigned, date_registered, follow_up_date, ownership_expires, lifecycle_status, behavioral_status, grade, total_purchases, total_calls, facebook_name, line_id, street, subdistrict, district, postal_code) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
            $stmt->execute([
                $in['customerId'] ?? $in['id'], // This is the string ID (CUS-...)
                $in['firstName'] ?? '', 
                $in['lastName'] ?? '', 
                $in['phone'] ?? '', 
                $in['backupPhone'] ?? null,
                $in['email'] ?? null,
                $in['province'] ?? '', 
                $in['companyId'] ?? null, 
                $in['assignedTo'] ?? null,
                $in['dateAssigned'] ?? date('c'), 
                $in['dateRegistered'] ?? null, 
                $in['followUpDate'] ?? null, 
                $in['ownershipExpires'] ?? null,
                $in['lifecycleStatus'] ?? null, 
                $in['behavioralStatus'] ?? null, 
                $in['grade'] ?? null,
                $in['totalPurchases'] ?? 0, 
                $in['totalCalls'] ?? 0, 
                $in['facebookName'] ?? null, 
                $in['lineId'] ?? null,
                $in['address']['street'] ?? null, 
                $in['address']['subdistrict'] ?? null, 
                $in['address']['district'] ?? null, 
                $in['address']['postalCode'] ?? null,
            ]);
            $newPk = $pdo->lastInsertId();
            json_response(['ok' => true, 'id' => $newPk, 'customer_id' => $newPk]);
            break;
        case 'PUT':
        case 'PATCH':
            if (!$id) json_response(['error' => 'ID_REQUIRED'], 400);
            $in = json_input();
            error_log(json_encode([
                'action' => 'update_customer',
                'id' => $id,
                'phone' => $in['phone'] ?? null,
                'backupPhone' => $in['backupPhone'] ?? null,
            ]));
            
            // Fetch current data to check for phone/company changes
            $current = null;
            try {
                // Try to find by customer_id (PK) or customer_ref_id
                $st = $pdo->prepare('SELECT customer_id, phone, company_id, assigned_to FROM customers WHERE customer_id=? OR customer_ref_id=? LIMIT 1');
                $st->execute([$id, $id]);
                $current = $st->fetch();
                
                // If found, ensure we use the real PK for updates
                if ($current) {
                    $id = $current['customer_id'];
                }
            } catch (Throwable $e) { /* ignore */ }
            
            if (!$current) json_response(['error' => 'NOT_FOUND'], 404);

            $oldAssigned = $current['assigned_to'];
            $assignedTo = $in['assignedTo'] ?? null;

            // Calculate new customer_ref_id if phone changes
            $newCustomerRefId = null;
            if (isset($in['phone']) && $in['phone'] !== $current['phone']) {
                $newPhone = $in['phone'];
                $companyId = $in['companyId'] ?? $current['company_id'];
                $cleanedPhone = preg_replace('/\D/', '', $newPhone);
                if ($cleanedPhone === '') {
                    json_response(['error' => 'INVALID_PHONE', 'message' => 'Invalid phone number provided'], 400);
                }
                $duplicateStmt = $pdo->prepare('SELECT first_name, last_name FROM customers WHERE phone = ? AND company_id = ? AND customer_id <> ? LIMIT 1');
                $duplicateStmt->execute([$newPhone, $companyId, $id]);
                $duplicate = $duplicateStmt->fetch();
                if ($duplicate) {
                    json_response([
                        'error' => 'DUPLICATE_PHONE',
                        'message' => "เบอร์โทรศัพท์ซ้ำกับลูกค้า {$duplicate['first_name']} {$duplicate['last_name']}"
                    ], 409);
                }
                $companyPrefix = ((int)$companyId === 1) ? '' : "-$companyId";
                $newCustomerRefId = "CUS-$cleanedPhone$companyPrefix";
            }

            $pdo->beginTransaction();
            try {
                // Disable FK checks to allow updating PK/FKs
                $pdo->exec('SET FOREIGN_KEY_CHECKS=0');

                $updateFields = [
                    'first_name=COALESCE(?, first_name)',
                    'last_name=COALESCE(?, last_name)',
                    'phone=COALESCE(?, phone)',
                    'backup_phone=COALESCE(?, backup_phone)', // Added backup_phone
                    'email=COALESCE(?, email)',
                    'province=COALESCE(?, province)',
                    'company_id=COALESCE(?, company_id)',
                    'assigned_to=COALESCE(?, assigned_to)',
                    'date_assigned=COALESCE(?, date_assigned)',
                    'date_registered=COALESCE(?, date_registered)',
                    'follow_up_date=COALESCE(?, follow_up_date)',
                    'ownership_expires=COALESCE(?, ownership_expires)',
                    'lifecycle_status=COALESCE(?, lifecycle_status)',
                    'behavioral_status=COALESCE(?, behavioral_status)',
                    'grade=COALESCE(?, grade)',
                    'total_purchases=COALESCE(?, total_purchases)',
                    'total_calls=COALESCE(?, total_calls)',
                    'facebook_name=COALESCE(?, facebook_name)',
                    'line_id=COALESCE(?, line_id)',
                    'street=COALESCE(?, street)',
                    'subdistrict=COALESCE(?, subdistrict)',
                    'district=COALESCE(?, district)',
                    'postal_code=COALESCE(?, postal_code)',
                    'is_in_waiting_basket=COALESCE(?, is_in_waiting_basket)',
                    'waiting_basket_start_date=COALESCE(?, waiting_basket_start_date)',
                    'is_blocked=COALESCE(?, is_blocked)'
                ];

                $params = [
                    $in['firstName'] ?? null,
                    $in['lastName'] ?? null,
                    $in['phone'] ?? null,
                    $in['backupPhone'] ?? null,
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
                    $in['address']['street'] ?? null,
                    $in['address']['subdistrict'] ?? null,
                    $in['address']['district'] ?? null,
                    $in['address']['postalCode'] ?? null,
                    array_key_exists('is_in_waiting_basket', $in) ? (int)$in['is_in_waiting_basket'] : null,
                    $in['waiting_basket_start_date'] ?? null,
                    array_key_exists('is_blocked', $in) ? (int)$in['is_blocked'] : null,
                ];

                if ($newCustomerRefId) {
                    $updateFields[] = 'customer_ref_id=?';
                    $params[] = $newCustomerRefId;
                }

                $params[] = $id; // WHERE customer_id = ?

                $sql = 'UPDATE customers SET ' . implode(', ', $updateFields) . ' WHERE customer_id=?';
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);

                // Removed updating related tables as customer_id (PK) does not change.
                // customer_ref_id is just a field in customers table now.

                // Normalize ownership history for new assignments
                // Use newCustomerRefId if changed, else id
                $targetId = $id;
                
                if (!empty($assignedTo) && (string)$assignedTo !== (string)$oldAssigned) {
                    $pdo->prepare('UPDATE customers SET date_assigned=COALESCE(date_assigned, NOW()) WHERE customer_id=?')->execute([$targetId]);
                    $pdo->prepare('INSERT IGNORE INTO customer_assignment_history(customer_id, user_id, assigned_at) VALUES (?,?, NOW())')->execute([$targetId, $assignedTo]);
                }

                // Post-update normalization
                $st2 = $pdo->prepare('SELECT assigned_to, is_in_waiting_basket, is_blocked FROM customers WHERE customer_id=?');
                $st2->execute([$targetId]);
                $row = $st2->fetch();
                if ($row) {
                    $assignedNow = $row['assigned_to'];
                    $waitingNow = (int)$row['is_in_waiting_basket'] === 1;
                    $blockedNow = (int)$row['is_blocked'] === 1;
                    if ($blockedNow) {
                        $pdo->prepare('UPDATE customers SET assigned_to=NULL, is_in_waiting_basket=0 WHERE customer_id=?')->execute([$targetId]);
                    } else if ($waitingNow && $assignedNow !== null) {
                        $pdo->prepare('UPDATE customers SET assigned_to=NULL WHERE customer_id=?')->execute([$targetId]);
                    }
                }

                $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
                $pdo->commit();
                $getUpdated = $pdo->prepare('SELECT *, customer_id as pk FROM customers WHERE customer_id = ?');
                $getUpdated->execute([$targetId]);
                $updatedRow = $getUpdated->fetch();
                
                if (!$updatedRow) {
                    // Fallback: try fetching by internal ID (PK) if customer_id fetch failed
                    // This can happen if the transaction view is not yet consistent or if customer_id changed
                    $getUpdatedByPk = $pdo->prepare('SELECT *, customer_id as pk FROM customers WHERE customer_id = ?');
                    $getUpdatedByPk->execute([$id]); // $id is the PK passed to the function
                    $updatedRow = $getUpdatedByPk->fetch();
                }

                if ($updatedRow) {
                    // Fetch tags for the updated customer to ensure complete object
                    $tagsStmt = $pdo->prepare('SELECT t.* FROM tags t JOIN customer_tags ct ON ct.tag_id=t.id WHERE ct.customer_id=?');
                    $tagsStmt->execute([$updatedRow['customer_id']]);
                    $updatedRow['tags'] = $tagsStmt->fetchAll();
                    
                    json_response($updatedRow);
                } else {
                    // Should not happen if update was successful, but return minimal data as fallback
                    json_response(['ok' => true, 'customerId' => $targetId, 'id' => $id]);
                }

            } catch (Throwable $e) {
                $pdo->rollBack();
                // Ensure FK checks are re-enabled even on error (though connection might close)
                try { $pdo->exec('SET FOREIGN_KEY_CHECKS=1'); } catch (Throwable $ex) {}
                json_response(['error' => 'UPDATE_FAILED', 'message' => $e->getMessage()], 500);
            }
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

function handle_products(PDO $pdo, ?string $id): void {
    switch (method()) {
        case 'GET':
            if ($id) {
                // Check if requesting total stock
                if (strpos($_SERVER['REQUEST_URI'], '/total_stock') !== false) {
                    $stmt = $pdo->prepare('
                        SELECT COALESCE(SUM(quantity), 0) as total_stock
                        FROM warehouse_stocks
                        WHERE product_id = ?
                    ');
                    $stmt->execute([$id]);
                    $result = $stmt->fetch();
                    json_response(['total_stock' => $result['total_stock']]);
                    return;
                }

                $stmt = $pdo->prepare('SELECT * FROM products WHERE id = ?');
                $stmt->execute([$id]);
                $row = $stmt->fetch();
                $row ? json_response($row) : json_response(['error' => 'NOT_FOUND'], 404);
            } else {
                $companyId = $_GET['companyId'] ?? null;
                $sql = 'SELECT * FROM products';
                $params = [];
                if ($companyId) {
                    $sql .= ' WHERE company_id = ?';
                    $params[] = $companyId;
                }
                $sql .= ' ORDER BY id DESC LIMIT 500';
                $stmt = $pdo->prepare($sql);
                if (!empty($params)) {
                    $stmt->execute($params);
                } else {
                    $stmt->execute();
                }
                json_response($stmt->fetchAll());
            }
            break;
        case 'POST':
            $in = json_input();
            $stmt = $pdo->prepare('INSERT INTO products (sku, name, description, category, unit, cost, price, stock, company_id, shop, status) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
            $stmt->execute([
                $in['sku'] ?? '', $in['name'] ?? '', $in['description'] ?? null, $in['category'] ?? '', $in['unit'] ?? '',
                $in['cost'] ?? 0, $in['price'] ?? 0, $in['stock'] ?? 0, $in['companyId'] ?? null, $in['shop'] ?? null, $in['status'] ?? 'Active'
            ]);
            json_response(['id' => $pdo->lastInsertId()]);
            break;
        case 'PATCH':
            if (!$id) json_response(['error' => 'ID_REQUIRED'], 400);
            $in = json_input();
            $fields = [];
            $params = [];
            $map = [
                'sku' => 'sku',
                'name' => 'name',
                'description' => 'description',
                'category' => 'category',
                'unit' => 'unit',
                'cost' => 'cost',
                'price' => 'price',
                'stock' => 'stock',
                'status' => 'status',
                'companyId' => 'company_id',
                'shop' => 'shop'
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
                $sql = 'UPDATE products SET ' . implode(', ', $fields) . ' WHERE id = ?';
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $get = $pdo->prepare('SELECT * FROM products WHERE id = ?');
                $get->execute([$id]);
                $row = $get->fetch();
                $row ? json_response($row) : json_response(['error' => 'NOT_FOUND'], 404);
            } catch (Throwable $e) {
                json_response(['error' => 'UPDATE_FAILED', 'message' => $e->getMessage()], 500);
            }
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
                // Get all promotions with items (both active and inactive)
                $companyId = $_GET['companyId'] ?? null;
                $sql = 'SELECT * FROM promotions';
                $params = [];
                if ($companyId) {
                    $sql .= ' WHERE company_id = ?';
                    $params[] = $companyId;
                }
                $sql .= ' ORDER BY id DESC';
                
                $stmt = $pdo->prepare($sql);
                if (!empty($params)) {
                    $stmt->execute($params);
                } else {
                    $stmt->execute();
                }
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
        case 'POST':
            $in = json_input();
            if (!$in || !is_array($in)) { $in = []; }

            $name = trim((string)($in['name'] ?? ''));
            $sku = trim((string)($in['sku'] ?? ''));
            $description = trim((string)($in['description'] ?? ''));
            $companyId = (int)($in['company_id'] ?? $in['companyId'] ?? 1);
            $active = (int)($in['active'] ?? 1);
            $startDate = $in['start_date'] ?? $in['startDate'] ?? null;
            $endDate = $in['end_date'] ?? $in['endDate'] ?? null;

            // Convert empty strings to null
            if ($startDate === '') $startDate = null;
            if ($endDate === '') $endDate = null;
            $items = $in['items'] ?? [];

            if ($name === '') {
                json_response(['error' => 'VALIDATION_FAILED', 'message' => 'name is required'], 400);
            }

            $pdo->beginTransaction();
            try {
                // Insert promotion
                $stmt = $pdo->prepare('INSERT INTO promotions (name, sku, description, company_id, active, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?)');
                $stmt->execute([$name, $sku, $description, $companyId, $active, $startDate, $endDate]);
                $promotionId = (int)$pdo->lastInsertId();

                // Insert promotion items
                if (!empty($items) && is_array($items)) {
                    $itemStmt = $pdo->prepare('INSERT INTO promotion_items (promotion_id, product_id, quantity, is_freebie, price_override) VALUES (?, ?, ?, ?, ?)');
                    foreach ($items as $item) {
                        $itemStmt->execute([
                            $promotionId,
                            (int)($item['product_id'] ?? $item['productId'] ?? 0),
                            (int)($item['quantity'] ?? 1),
                            (int)($item['is_freebie'] ?? $item['isFreebie'] ?? 0),
                            $item['price_override'] ?? $item['priceOverride'] ?? null
                        ]);
                    }
                }

                $pdo->commit();

                // Return the created promotion with items
                $stmt = $pdo->prepare('SELECT * FROM promotions WHERE id = ?');
                $stmt->execute([$promotionId]);
                $promo = $stmt->fetch();

                $itemsStmt = $pdo->prepare('
                    SELECT pi.*, p.sku, p.name as product_name, p.price as product_price
                    FROM promotion_items pi
                    LEFT JOIN products p ON pi.product_id = p.id
                    WHERE pi.promotion_id = ?
                ');
                $itemsStmt->execute([$promotionId]);
                $promo['items'] = $itemsStmt->fetchAll();

                json_response($promo, 201);
            } catch (Throwable $e) {
                $pdo->rollBack();
                json_response(['error' => 'CREATE_FAILED', 'message' => $e->getMessage()], 500);
            }
            break;
        case 'PUT':
        case 'PATCH':
            if (!$id) json_response(['error' => 'ID_REQUIRED'], 400);

            // Check if promotion is used in any orders
            $check = $pdo->prepare('SELECT COUNT(*) FROM order_items WHERE promotion_id = ?');
            $check->execute([$id]);
            if ($check->fetchColumn() > 0) {
                json_response(['error' => 'PROMOTION_IN_USE',
                    'message' => 'ไม่สามารถแก้ไขโปรโมชั่นที่มีการสั่งซื้อแล้ว กรุณาปิดใช้งานแทน'], 400);
                return;
            }

            $in = json_input();
            if (!$in || !is_array($in)) { $in = []; }

            $pdo->beginTransaction();
            try {
                // Update promotion
                $fields = [];
                $params = [];
                $map = [
                    'name' => 'name',
                    'sku' => 'sku',
                    'description' => 'description',
                    'company_id' => 'company_id',
                    'companyId' => 'company_id',
                    'active' => 'active',
                    'start_date' => 'start_date',
                    'startDate' => 'start_date',
                    'end_date' => 'end_date',
                    'endDate' => 'end_date'
                ];

                foreach ($map as $inKey => $col) {
                    if (array_key_exists($inKey, $in)) {
                        $value = $in[$inKey];
                        // Convert empty strings to null for date fields
                        if (($col === 'start_date' || $col === 'end_date') && $value === '') {
                            $value = null;
                        }
                        $fields[] = "$col = ?";
                        $params[] = $value;
                    }
                }

                if (!empty($fields)) {
                    $params[] = $id;
                    $stmt = $pdo->prepare('UPDATE promotions SET ' . implode(', ', $fields) . ' WHERE id = ?');
                    $stmt->execute($params);
                }

                // Update promotion items if provided
                if (isset($in['items']) && is_array($in['items'])) {
                    // Delete existing items
                    $pdo->prepare('DELETE FROM promotion_items WHERE promotion_id = ?')->execute([$id]);

                    // Insert new items
                    $itemStmt = $pdo->prepare('INSERT INTO promotion_items (promotion_id, product_id, quantity, is_freebie, price_override) VALUES (?, ?, ?, ?, ?)');
                    foreach ($in['items'] as $item) {
                        $itemStmt->execute([
                            $id,
                            (int)($item['product_id'] ?? $item['productId'] ?? 0),
                            (int)($item['quantity'] ?? 1),
                            (int)($item['is_freebie'] ?? $item['isFreebie'] ?? 0),
                            $item['price_override'] ?? $item['priceOverride'] ?? null
                        ]);
                    }
                }

                $pdo->commit();

                // Return updated promotion
                $stmt = $pdo->prepare('SELECT * FROM promotions WHERE id = ?');
                $stmt->execute([$id]);
                $promo = $stmt->fetch();

                $itemsStmt = $pdo->prepare('
                    SELECT pi.*, p.sku, p.name as product_name, p.price as product_price
                    FROM promotion_items pi
                    LEFT JOIN products p ON pi.product_id = p.id
                    WHERE pi.promotion_id = ?
                ');
                $itemsStmt->execute([$id]);
                $promo['items'] = $itemsStmt->fetchAll();

                json_response($promo);
            } catch (Throwable $e) {
                $pdo->rollBack();
                json_response(['error' => 'UPDATE_FAILED', 'message' => $e->getMessage()], 500);
            }
            break;
        case 'DELETE':
            if (!$id) json_response(['error' => 'ID_REQUIRED'], 400);

            // Check if promotion is used in any orders
            $check = $pdo->prepare('SELECT COUNT(*) FROM order_items WHERE promotion_id = ?');
            $check->execute([$id]);
            if ($check->fetchColumn() > 0) {
                json_response(['error' => 'PROMOTION_IN_USE',
                    'message' => 'ไม่สามารถลบโปรโมชั่นที่มีการสั่งซื้อแล้ว กรุณาปิดใช้งานแทน'], 400);
                return;
            }

            try {
                $stmt = $pdo->prepare('DELETE FROM promotions WHERE id = ?');
                $stmt->execute([$id]);
                json_response(['ok' => true]);
            } catch (Throwable $e) {
                json_response(['error' => 'DELETE_FAILED', 'message' => $e->getMessage()], 500);
            }
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

function format_decimal_quantity($qty): string {
    return number_format((float)$qty, 2, '.', '');
}

function ensure_warehouse_matches_company(PDO $pdo, int $warehouseId, ?int $companyId): void {
    if ($companyId === null) {
        return;
    }
    $stmt = $pdo->prepare('SELECT company_id FROM warehouses WHERE id = ?');
    $stmt->execute([$warehouseId]);
    $found = $stmt->fetchColumn();
    if ($found === false) {
        throw new RuntimeException('WAREHOUSE_NOT_FOUND');
    }
    if ((int)$found !== (int)$companyId) {
        throw new RuntimeException('WAREHOUSE_COMPANY_MISMATCH');
    }
}

function reserve_stock_for_allocation(PDO $pdo, int $warehouseId, int $productId, ?string $lotNumber, int $quantity): void {
    $sel = $pdo->prepare('SELECT id FROM warehouse_stocks WHERE warehouse_id=? AND product_id=? AND ((lot_number IS NULL AND ? IS NULL) OR lot_number = ?) LIMIT 1 FOR UPDATE');
    $sel->execute([$warehouseId, $productId, $lotNumber, $lotNumber]);
    $row = $sel->fetch(PDO::FETCH_ASSOC);
    if ($row) {
        $upd = $pdo->prepare('UPDATE warehouse_stocks SET reserved_quantity = GREATEST(0, reserved_quantity + ?) WHERE id=?');
        $upd->execute([$quantity, (int)$row['id']]);
    } else {
        $ins = $pdo->prepare('INSERT INTO warehouse_stocks (warehouse_id, product_id, lot_number, quantity, reserved_quantity) VALUES (?,?,?,?,?)');
        $ins->execute([$warehouseId, $productId, $lotNumber, 0, max(0, $quantity)]);
    }
}

function release_stock_for_allocation(PDO $pdo, int $warehouseId, int $productId, ?string $lotNumber, int $quantity): void {
    $stmt = $pdo->prepare('UPDATE warehouse_stocks SET reserved_quantity = GREATEST(0, reserved_quantity - ?) WHERE warehouse_id=? AND product_id=? AND ((lot_number IS NULL AND ? IS NULL) OR lot_number = ?) LIMIT 1');
    $stmt->execute([$quantity, $warehouseId, $productId, $lotNumber, $lotNumber]);
}

function release_single_allocation(PDO $pdo, array $allocationRow, string $statusOnRelease = 'PENDING'): ?array {
    $releasedQty = (int)$allocationRow['allocated_quantity'];
    $lotNumber = $allocationRow['lot_number'] !== null ? (string)$allocationRow['lot_number'] : null;
    $warehouseId = $allocationRow['warehouse_id'] !== null ? (int)$allocationRow['warehouse_id'] : null;

    if ($releasedQty > 0 && $lotNumber && $warehouseId) {
        $pdo->prepare('UPDATE product_lots SET quantity_remaining = quantity_remaining + ? WHERE lot_number = ? AND product_id = ? AND warehouse_id = ?')
            ->execute([format_decimal_quantity($releasedQty), $lotNumber, (int)$allocationRow['product_id'], $warehouseId]);
    }

    if ($releasedQty > 0 && $warehouseId) {
        release_stock_for_allocation($pdo, $warehouseId, (int)$allocationRow['product_id'], $lotNumber, $releasedQty);
    }

    // Reset allocation fields regardless of released quantity to keep state consistent
    $pdo->prepare('UPDATE order_item_allocations SET allocated_quantity = 0, lot_number = NULL, warehouse_id = NULL, status = ? WHERE id = ?')
        ->execute([$statusOnRelease, (int)$allocationRow['id']]);

    if ($releasedQty <= 0 && !$lotNumber) {
        return null;
    }

    return [
        'allocationId' => (int)$allocationRow['id'],
        'releasedQuantity' => $releasedQty,
        'lotNumber' => $lotNumber,
    ];
}

function allocate_allocation_fifo(PDO $pdo, array $allocationRow, int $warehouseId, ?int $desiredQuantity = null, ?string $preferredLot = null): array {
    $required = $desiredQuantity !== null ? max(0, (int)$desiredQuantity) : max(0, (int)$allocationRow['required_quantity']);
    if ($required <= 0) {
        return [];
    }

    if ((int)$allocationRow['allocated_quantity'] > 0 && !empty($allocationRow['lot_number'])) {
        release_single_allocation($pdo, $allocationRow);
    }

    if ($preferredLot !== null && $preferredLot !== '') {
        $lotStmt = $pdo->prepare('SELECT id, lot_number, quantity_remaining FROM product_lots WHERE product_id=? AND warehouse_id=? AND status = \'Active\' AND quantity_remaining > 0 AND lot_number = ? ORDER BY purchase_date ASC, id ASC FOR UPDATE');
        $lotStmt->execute([(int)$allocationRow['product_id'], $warehouseId, $preferredLot]);
    } else {
        $lotStmt = $pdo->prepare('SELECT id, lot_number, quantity_remaining FROM product_lots WHERE product_id=? AND warehouse_id=? AND status = \'Active\' AND quantity_remaining > 0 ORDER BY purchase_date ASC, id ASC FOR UPDATE');
        $lotStmt->execute([(int)$allocationRow['product_id'], $warehouseId]);
    }
    $lots = $lotStmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($lots as $lot) {
        if ((float)$lot['quantity_remaining'] + 1e-6 < $required) {
            continue;
        }
        $qtyDecimal = format_decimal_quantity($required);
        $updateLot = $pdo->prepare('UPDATE product_lots SET quantity_remaining = quantity_remaining - ? WHERE id = ? AND quantity_remaining >= ?');
        $updateLot->execute([$qtyDecimal, (int)$lot['id'], $qtyDecimal]);
        if ($updateLot->rowCount() === 0) {
            continue;
        }

        reserve_stock_for_allocation($pdo, $warehouseId, (int)$allocationRow['product_id'], (string)$lot['lot_number'], $required);

        $pdo->prepare('UPDATE order_item_allocations SET warehouse_id=?, lot_number=?, allocated_quantity=?, status=? WHERE id=?')
            ->execute([$warehouseId, (string)$lot['lot_number'], $required, 'ALLOCATED', (int)$allocationRow['id']]);

        return [
            'allocationId' => (int)$allocationRow['id'],
            'lotNumber' => (string)$lot['lot_number'],
            'allocatedQuantity' => $required,
        ];
    }

    return [];
}

function allocate_allocation_fifo_allow_negative(PDO $pdo, array $allocationRow, int $warehouseId, ?int $desiredQuantity = null, ?string $preferredLot = null): array {
    $required = $desiredQuantity !== null ? max(0, (int)$desiredQuantity) : max(0, (int)$allocationRow['required_quantity']);
    if ($required <= 0) {
        return [];
    }

    if ((int)$allocationRow['allocated_quantity'] > 0 && !empty($allocationRow['lot_number'])) {
        release_single_allocation($pdo, $allocationRow);
    }

    // Try to allocate with available stock first (FIFO)
    if ($preferredLot !== null && $preferredLot !== '') {
        $lotStmt = $pdo->prepare('SELECT id, lot_number, quantity_remaining FROM product_lots WHERE product_id=? AND warehouse_id=? AND status = \'Active\' AND quantity_remaining > 0 AND lot_number = ? ORDER BY purchase_date ASC, id ASC FOR UPDATE');
        $lotStmt->execute([(int)$allocationRow['product_id'], $warehouseId, $preferredLot]);
    } else {
        $lotStmt = $pdo->prepare('SELECT id, lot_number, quantity_remaining FROM product_lots WHERE product_id=? AND warehouse_id=? AND status = \'Active\' AND quantity_remaining > 0 ORDER BY purchase_date ASC, id ASC FOR UPDATE');
        $lotStmt->execute([(int)$allocationRow['product_id'], $warehouseId]);
    }
    $lots = $lotStmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Try to allocate with available stock
    foreach ($lots as $lot) {
        if ((float)$lot['quantity_remaining'] + 1e-6 < $required) {
            continue;
        }
        $qtyDecimal = format_decimal_quantity($required);
        $updateLot = $pdo->prepare('UPDATE product_lots SET quantity_remaining = quantity_remaining - ? WHERE id = ? AND quantity_remaining >= ?');
        $updateLot->execute([$qtyDecimal, (int)$lot['id'], $qtyDecimal]);
        if ($updateLot->rowCount() === 0) {
            continue;
        }

        reserve_stock_for_allocation($pdo, $warehouseId, (int)$allocationRow['product_id'], (string)$lot['lot_number'], $required);

        $pdo->prepare('UPDATE order_item_allocations SET warehouse_id=?, lot_number=?, allocated_quantity=?, status=? WHERE id=?')
            ->execute([$warehouseId, (string)$lot['lot_number'], $required, 'ALLOCATED', (int)$allocationRow['id']]);

        return [
            'allocationId' => (int)$allocationRow['id'],
            'lotNumber' => (string)$lot['lot_number'],
            'allocatedQuantity' => $required,
        ];
    }

    // If no sufficient stock, allow negative allocation (for companies not using warehouse system)
    // Use the first available lot or create a virtual allocation
    $lotForNegative = null;
    if ($preferredLot !== null && $preferredLot !== '') {
        $lotStmtNeg = $pdo->prepare('SELECT id, lot_number, quantity_remaining FROM product_lots WHERE product_id=? AND warehouse_id=? AND status = \'Active\' AND lot_number = ? ORDER BY purchase_date ASC, id ASC LIMIT 1');
        $lotStmtNeg->execute([(int)$allocationRow['product_id'], $warehouseId, $preferredLot]);
        $lotForNegative = $lotStmtNeg->fetch(PDO::FETCH_ASSOC);
    }
    
    if (!$lotForNegative) {
        $lotStmtNeg = $pdo->prepare('SELECT id, lot_number, quantity_remaining FROM product_lots WHERE product_id=? AND warehouse_id=? AND status = \'Active\' ORDER BY purchase_date ASC, id ASC LIMIT 1');
        $lotStmtNeg->execute([(int)$allocationRow['product_id'], $warehouseId]);
        $lotForNegative = $lotStmtNeg->fetch(PDO::FETCH_ASSOC);
    }

    $lotNumberToUse = $lotForNegative ? (string)$lotForNegative['lot_number'] : '__VIRTUAL__';
    
    // Update lot to negative if exists, otherwise just allocate without stock check
    if ($lotForNegative) {
        $qtyDecimal = format_decimal_quantity($required);
        $updateLotNeg = $pdo->prepare('UPDATE product_lots SET quantity_remaining = quantity_remaining - ? WHERE id = ?');
        $updateLotNeg->execute([$qtyDecimal, (int)$lotForNegative['id']]);
    }

    reserve_stock_for_allocation($pdo, $warehouseId, (int)$allocationRow['product_id'], $lotNumberToUse !== '__VIRTUAL__' ? $lotNumberToUse : null, $required);

    $pdo->prepare('UPDATE order_item_allocations SET warehouse_id=?, lot_number=?, allocated_quantity=?, status=? WHERE id=?')
        ->execute([$warehouseId, $lotNumberToUse !== '__VIRTUAL__' ? $lotNumberToUse : null, $required, 'ALLOCATED', (int)$allocationRow['id']]);

    return [
        'allocationId' => (int)$allocationRow['id'],
        'lotNumber' => $lotNumberToUse !== '__VIRTUAL__' ? $lotNumberToUse : null,
        'allocatedQuantity' => $required,
    ];
}

function auto_allocate_order(PDO $pdo, string $orderId, int $warehouseId, ?int $companyId = null): array {
    if ($warehouseId <= 0) {
        throw new RuntimeException('WAREHOUSE_REQUIRED');
    }

    ensure_warehouse_matches_company($pdo, $warehouseId, $companyId);

    $stmt = $pdo->prepare('SELECT * FROM order_item_allocations WHERE order_id=? AND status IN (\'PENDING\', \'ALLOCATED\') ORDER BY id FOR UPDATE');
    $stmt->execute([$orderId]);
    $allocations = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (!$allocations) {
        return [];
    }

    $allocated = [];
    $failures = [];
    foreach ($allocations as $allocation) {
        $required = (int)$allocation['required_quantity'];
        if ($required <= 0) {
            continue;
        }
        if (strcasecmp((string)$allocation['status'], 'ALLOCATED') === 0 &&
            (int)$allocation['allocated_quantity'] >= $required &&
            !empty($allocation['lot_number'])) {
            continue;
        }
        $result = allocate_allocation_fifo($pdo, $allocation, $warehouseId, $required);
        if ($result) {
            $allocated[] = $result;
        } else {
            $failures[] = [
                'allocationId' => (int)$allocation['id'],
                'productId' => (int)$allocation['product_id'],
                'required' => $required,
            ];
        }
    }

    if ($failures) {
        $messages = array_map(static function (array $row): string {
            return $row['productId'] . ':' . $row['required'];
        }, $failures);
        throw new RuntimeException('INSUFFICIENT_STOCK ' . implode(',', $messages));
    }

    return $allocated;
}

function release_order_allocations(PDO $pdo, string $orderId): array {
    $stmt = $pdo->prepare('SELECT * FROM order_item_allocations WHERE order_id=? AND allocated_quantity > 0 AND status IN (\'ALLOCATED\', \'PICKED\', \'SHIPPED\') ORDER BY id FOR UPDATE');
    $stmt->execute([$orderId]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if (!$rows) {
        return [];
    }
    $released = [];
    foreach ($rows as $row) {
        $info = release_single_allocation($pdo, $row, 'CANCELLED');
        if ($info) {
            $released[] = $info;
        }
    }
    return $released;
}

function calculate_order_item_net_total(array $item): float {
    $quantity = isset($item['quantity']) ? (int)$item['quantity'] : 0;
    $quantity = $quantity < 0 ? 0 : $quantity;
    $pricePerUnit = isset($item['pricePerUnit']) ? (float)$item['pricePerUnit'] : (float)($item['price_per_unit'] ?? 0);
    $pricePerUnit = $pricePerUnit < 0 ? 0.0 : $pricePerUnit;
    $discount = isset($item['discount']) ? (float)$item['discount'] : 0.0;
    $isFreebie = !empty($item['isFreebie']) || (!empty($item['is_freebie']) && (int)$item['is_freebie'] === 1);
    if ($isFreebie) { return 0.0; }
    $net = ($pricePerUnit * $quantity) - $discount;
    return $net > 0 ? $net : 0.0;
}

function handle_orders(PDO $pdo, ?string $id): void {
    // Handle sequence endpoint for order ID generation
    if ($id === 'sequence') {
        $datePrefix = $_GET['datePrefix'] ?? '';
        $companyId = isset($_GET['companyId']) ? (int)$_GET['companyId'] : 0;
        $period = $_GET['period'] ?? 'day';
        $monthPrefixParam = $_GET['monthPrefix'] ?? '';
        
        if (empty($datePrefix) || $companyId <= 0) {
            json_response(['error' => 'INVALID_PARAMS'], 400);
            return;
        }
        
        // Determine prefix key based on requested period
        if ($period === 'month') {
            $sequencePrefix = $monthPrefixParam !== ''
                ? preg_replace('/[^0-9]/', '', $monthPrefixParam)
                : substr($datePrefix, 0, 4);
            if (strlen($sequencePrefix) < 4) {
                json_response(['error' => 'INVALID_MONTH_PREFIX'], 400);
                return;
            }
        } else {
            if (strlen($datePrefix) < 6) {
                json_response(['error' => 'INVALID_DATE_PREFIX'], 400);
                return;
            }
            $sequencePrefix = substr($datePrefix, 0, 6);
        }
        
        try {
            $pdo->beginTransaction();
            // Insert row or atomically increase last_sequence
            $insert = $pdo->prepare('INSERT INTO order_sequences (company_id, period, prefix, last_sequence) VALUES (?,?,?,1)
                                     ON DUPLICATE KEY UPDATE last_sequence = last_sequence + 1, updated_at = NOW()');
            $insert->execute([$companyId, $period, $sequencePrefix]);
            
            $seqStmt = $pdo->prepare('SELECT last_sequence FROM order_sequences WHERE company_id=? AND period=? AND prefix=? FOR UPDATE');
            $seqStmt->execute([$companyId, $period, $sequencePrefix]);
            $nextSequence = (int)$seqStmt->fetchColumn();
            $pdo->commit();
            json_response(['sequence' => max(1, $nextSequence)]);
        } catch (Throwable $e) {
            $pdo->rollBack();
            error_log('Order sequence generation failed: ' . $e->getMessage());
            json_response(['error' => 'SEQUENCE_FAILED'], 500);
        }
        return;
    }
    
    switch (method()) {
        case 'GET':
            if ($id) {
                $o = get_order($pdo, $id);
                $o ? json_response($o) : json_response(['error' => 'NOT_FOUND'], 404);
            } else {
                $companyId = $_GET['companyId'] ?? null;
                
                $dbName = $pdo->query("SELECT DATABASE()")->fetchColumn();
                $ordersColumns = $pdo->query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = '$dbName' AND TABLE_NAME = 'orders'")->fetchAll(PDO::FETCH_COLUMN);
                $hasShippingProvider = in_array('shipping_provider', $ordersColumns);

                $selectCols = 'o.id, o.customer_id, o.company_id, o.creator_id, o.order_date, o.delivery_date, 
                               o.street, o.subdistrict, o.district, o.province, o.postal_code, o.recipient_first_name, o.recipient_last_name';
                if ($hasShippingProvider) {
                    $selectCols .= ', o.shipping_provider';
                }
                $selectCols .= ', o.shipping_cost, o.bill_discount, o.total_amount, o.payment_method, o.payment_status, o.order_status,
                               GROUP_CONCAT(DISTINCT t.tracking_number ORDER BY t.id SEPARATOR ",") AS tracking_numbers,
                               o.amount_paid, o.cod_amount, o.slip_url, o.sales_channel, o.sales_channel_page_id, o.warehouse_id,
                               o.bank_account_id, o.transfer_date,
                               MAX(CASE WHEN srl.confirmed_action = \'Confirmed\' THEN \'Confirmed\' ELSE NULL END) as reconcile_action';

                $sql = "SELECT $selectCols
                        FROM orders o
                        LEFT JOIN order_tracking_numbers t ON t.parent_order_id = o.id
                        LEFT JOIN statement_reconcile_logs srl ON (
                            srl.order_id COLLATE utf8mb4_unicode_ci = o.id 
                            OR srl.confirmed_order_id COLLATE utf8mb4_unicode_ci = o.id
                        )";
                
                $params = [];
                $whereConditions = [];
                
                // Filter out sub orders (orders with -1, -2, -3, etc. suffix)
                // Sub orders have pattern: mainOrderId-number (e.g., 251118-00001admin19z-1)
                // We exclude orders where id matches pattern: ends with - followed by digits
                // Use both REGEXP and LIKE for better compatibility
                $whereConditions[] = "o.id NOT REGEXP '^.+-[0-9]+$'";
                
                if ($companyId) {
                    $whereConditions[] = 'o.company_id = ?';
                    $params[] = $companyId;
                }
                
                if (!empty($whereConditions)) {
                    $sql .= ' WHERE ' . implode(' AND ', $whereConditions);
                }
                
                $sql .= ' GROUP BY o.id
                          ORDER BY o.order_date DESC
                          LIMIT 5000';
                
                $stmt = $pdo->prepare($sql);
                if (!empty($params)) {
                    $stmt->execute($params);
                } else {
                    $stmt->execute();
                }
                $orders = $stmt->fetchAll();
                
                // Fetch items for each order
                // Need to include items from sub orders (mainOrderId-1, mainOrderId-2, etc.)
                $orderIds = array_column($orders, 'id');
                $itemsMap = [];
                $slipsMap = [];
                $trackingMap = [];
                
                if (!empty($orderIds)) {
                    // Fetch items directly using parent_order_id to get ALL items regardless of box count
                    // This avoids the need to guess or query for max box numbers
                    try {
                        $parentPlaceholders = implode(',', array_fill(0, count($orderIds), '?'));
                        $itemSql = "SELECT oi.id, oi.order_id, oi.product_id, oi.product_name, oi.quantity, 
                                           oi.price_per_unit, oi.discount, oi.net_total, oi.is_freebie, oi.box_number, 
                                           oi.promotion_id, oi.parent_item_id, oi.is_promotion_parent,
                                           oi.creator_id, oi.parent_order_id,
                                           p.sku as product_sku
                                    FROM order_items oi
                                    LEFT JOIN products p ON oi.product_id = p.id
                                    WHERE oi.parent_order_id IN ($parentPlaceholders) OR oi.order_id IN ($parentPlaceholders)
                                    ORDER BY oi.order_id, oi.id";
                        
                        // Execute with orderIds for both parent_order_id and order_id placeholders
                        $itemStmt = $pdo->prepare($itemSql);
                        $params = array_merge($orderIds, $orderIds);
                        $itemStmt->execute($params);
                        $items = $itemStmt->fetchAll();
                    } catch (Throwable $e) {
                        error_log("Failed to fetch order items: " . $e->getMessage());
                        error_log("SQL: " . ($itemSql ?? 'N/A'));
                        error_log("Params count: " . count($params ?? []));
                        error_log("Placeholders count: " . (substr_count($parentPlaceholders ?? '', '?') * 2));
                        $items = [];
                    }
                    
                    // Map items to main order IDs
                    // Items from sub orders (mainOrderId-1, mainOrderId-2) should be mapped to main order (mainOrderId)
                    foreach ($items as $item) {
                        if (!isset($item['net_total']) || $item['net_total'] === null) {
                            $item['net_total'] = calculate_order_item_net_total($item);
                        }
                        $itemOrderId = $item['order_id'];
                        // Check if this is a sub order (ends with -number)
                        if (preg_match('/^(.+)-(\d+)$/', $itemOrderId, $matches)) {
                            $mainOrderId = $matches[1]; // Extract main order ID
                            // Map sub order items to main order
                            if (in_array($mainOrderId, $orderIds)) {
                                $itemsMap[$mainOrderId][] = $item;
                            }
                        } else {
                            // Direct mapping for main order items
                            $itemsMap[$itemOrderId][] = $item;
                        }
                    }

                    // Sort items by box_number for each order to ensure 1, 2, 3... 10 order
                    foreach ($itemsMap as &$orderItems) {
                        usort($orderItems, function($a, $b) {
                            $boxA = isset($a['box_number']) ? (int)$a['box_number'] : 0;
                            $boxB = isset($b['box_number']) ? (int)$b['box_number'] : 0;
                            
                            if ($boxA > 0 && $boxB > 0) {
                                return $boxA - $boxB;
                            }
                            
                            // Fallback to order_id suffix if box_number is 0/missing
                            $aSuffix = 0; $bSuffix = 0;
                            if (preg_match('/-(\d+)$/', $a['order_id'], $m)) $aSuffix = (int)$m[1];
                            if (preg_match('/-(\d+)$/', $b['order_id'], $m)) $bSuffix = (int)$m[1];
                            
                            if ($aSuffix !== $bSuffix) {
                                return $aSuffix - $bSuffix;
                            }
                            
                            return 0;
                        });
                    }
                    unset($orderItems);
                    
                    // Fetch slips from main orders (using same approach as items query)
                    $slipSql = "SELECT id, order_id, url, created_at, amount, bank_account_id, transfer_date, upload_by, upload_by_name 
                                FROM order_slips 
                                WHERE order_id IN ($parentPlaceholders)
                                ORDER BY created_at DESC";
                    
                    $slipStmt = $pdo->prepare($slipSql);
                    $slipStmt->execute($orderIds);
                    $slips = $slipStmt->fetchAll();
                    
                    // Map slips to main order IDs (similar to items)
                    foreach ($slips as $slip) {
                        $slipOrderId = $slip['order_id'];
                        // Check if this is a sub order (ends with -number)
                        if (preg_match('/^(.+)-(\d+)$/', $slipOrderId, $matches)) {
                            $mainOrderId = $matches[1]; // Extract main order ID
                            // Map sub order slips to main order
                            if (in_array($mainOrderId, $orderIds)) {
                                $slipsMap[$mainOrderId][] = $slip;
                            }
                        } else {
                            // Direct mapping for main order slips
                            $slipsMap[$slipOrderId][] = $slip;
                        }
                    }

                    // Fetch tracking entries grouped by parent order
                    $parentPlaceholders = implode(',', array_fill(0, count($orderIds), '?'));
                    $trackingSql = "SELECT parent_order_id, order_id, tracking_number, box_number
                                    FROM order_tracking_numbers
                                    WHERE parent_order_id IN ($parentPlaceholders)
                                    ORDER BY id";
                    $trackingStmt = $pdo->prepare($trackingSql);
                    $trackingStmt->execute($orderIds);
                    $trackingRows = $trackingStmt->fetchAll();
                    foreach ($trackingRows as $trackingRow) {
                        $parentId = $trackingRow['parent_order_id'] ?? null;
                        if ($parentId === null) continue;
                        if (!isset($trackingMap[$parentId])) {
                            $trackingMap[$parentId] = [];
                        }
                        $trackingMap[$parentId][] = [
                            'order_id' => $trackingRow['order_id'],
                            'parent_order_id' => $trackingRow['parent_order_id'],
                            'tracking_number' => $trackingRow['tracking_number'],
                            'box_number' => $trackingRow['box_number'],
                        ];
                    }
                    
                    // Fetch boxes from order_boxes for each main order
                    $boxesMap = [];
                    $boxesSql = "SELECT order_id, sub_order_id, box_number, cod_amount, collection_amount, collected_amount, waived_amount, payment_method, status
                                 FROM order_boxes
                                 WHERE order_id IN ($parentPlaceholders)
                                 ORDER BY order_id, box_number";
                    $boxesStmt = $pdo->prepare($boxesSql);
                    $boxesStmt->execute($orderIds);
                    $boxesRows = $boxesStmt->fetchAll();
                    foreach ($boxesRows as $boxRow) {
                        $orderId = $boxRow['order_id'] ?? null;
                        if ($orderId === null) continue;
                        if (!isset($boxesMap[$orderId])) {
                            $boxesMap[$orderId] = [];
                        }
                        $boxesMap[$orderId][] = [
                            'sub_order_id' => $boxRow['sub_order_id'] ?? null,
                            'box_number' => $boxRow['box_number'] ?? null,
                            'cod_amount' => $boxRow['cod_amount'] ?? null,
                            'collection_amount' => $boxRow['collection_amount'] ?? null,
                            'collected_amount' => $boxRow['collected_amount'] ?? null,
                            'waived_amount' => $boxRow['waived_amount'] ?? null,
                            'payment_method' => $boxRow['payment_method'] ?? null,
                            'status' => $boxRow['status'] ?? null,
                        ];
                    }
                }
                
                // Add items, slips, tracking details, and boxes to each order
                foreach ($orders as &$order) {
                    $order['items'] = $itemsMap[$order['id']] ?? [];
                    $order['slips'] = $slipsMap[$order['id']] ?? [];
                    $order['tracking_details'] = $trackingMap[$order['id']] ?? [];
                    $order['trackingDetails'] = $order['tracking_details'];
                    $order['boxes'] = $boxesMap[$order['id']] ?? [];
                }
                
                json_response($orders);
            }
            break;
        case 'POST':
            $in = json_input();
            error_log('Order creation request: ' . json_encode($in));
            $pdo->beginTransaction();
            try {
                // Validate creator_id exists in users table and is active
                $creatorId = $in['creatorId'] ?? null;
                if ($creatorId === null || $creatorId === '') {
                    $pdo->rollBack();
                    json_response(['error' => 'CREATOR_ID_REQUIRED', 'message' => 'Creator user ID is required'], 400);
                    return;
                }
                
                $creatorCheck = $pdo->prepare('SELECT id, status FROM users WHERE id = ?');
                $creatorCheck->execute([$creatorId]);
                $creatorData = $creatorCheck->fetch(PDO::FETCH_ASSOC);
                if (!$creatorData) {
                    $pdo->rollBack();
                    json_response(['error' => 'CREATOR_USER_NOT_FOUND', 'message' => 'Creator user not found: ' . $creatorId], 400);
                    return;
                }
                
                if ($creatorData['status'] !== 'active') {
                    $pdo->rollBack();
                    json_response(['error' => 'CREATOR_USER_INACTIVE', 'message' => 'Creator user is not active: ' . $creatorId], 400);
                    return;
                }
                

                // Check if bank_account_id and transfer_date columns exist
                $dbName = $pdo->query("SELECT DATABASE()")->fetchColumn();
                $existingColumns = $pdo->query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                                                WHERE TABLE_SCHEMA = '$dbName' AND TABLE_NAME = 'orders'")->fetchAll(PDO::FETCH_COLUMN);
                
                $hasBankAccountId = in_array('bank_account_id', $existingColumns);
                $hasTransferDate = in_array('transfer_date', $existingColumns);
                $hasShippingProvider = in_array('shipping_provider', $existingColumns);
                
                // Build INSERT query dynamically based on available columns
                $columns = ['id', 'customer_id', 'company_id', 'creator_id', 'order_date', 'delivery_date', 'street', 'subdistrict', 'district', 'province', 'postal_code', 'recipient_first_name', 'recipient_last_name'];
                if ($hasShippingProvider) {
                    $columns[] = 'shipping_provider';
                }
                $columns = array_merge($columns, ['shipping_cost', 'bill_discount', 'total_amount', 'payment_method', 'payment_status', 'slip_url', 'amount_paid', 'cod_amount', 'order_status', 'notes', 'sales_channel', 'sales_channel_page_id', 'warehouse_id']);
                $values = [];
                $placeholders = [];
                
                if ($hasBankAccountId) {
                    $columns[] = 'bank_account_id';
                }
                if ($hasTransferDate) {
                    $columns[] = 'transfer_date';
                }
                // Always add customer_type as it was added via migration
                $columns[] = 'customer_type';
                
                foreach ($columns as $col) {
                    $placeholders[] = '?';
                }
                
                $stmt = $pdo->prepare('INSERT INTO orders (' . implode(', ', $columns) . ') VALUES (' . implode(', ', $placeholders) . ')');
                $addr = $in['shippingAddress'] ?? [];
                $recipientFirstName = $addr['recipientFirstName'] ?? ($addr['recipient_first_name'] ?? null);
                $recipientLastName = $addr['recipientLastName'] ?? ($addr['recipient_last_name'] ?? null);
                
                // Normalize payment method: handle empty string, null, or undefined
                // Also normalize Thai values to match database enum ('COD','Transfer','PayAfter')
                $paymentMethod = $in['paymentMethod'] ?? null;
                if ($paymentMethod === '' || $paymentMethod === 'null' || $paymentMethod === 'undefined') {
                    $paymentMethod = null;
                } else if ($paymentMethod !== null) {
                    // Normalize payment method values to match database enum
                    // Database enum: 'COD', 'Transfer', 'PayAfter'
                    $paymentMethodStr = strval($paymentMethod);
                    if ($paymentMethodStr === 'COD' || $paymentMethodStr === 'cod' || $paymentMethodStr === 'C.O.D' || $paymentMethodStr === 'cash_on_delivery') {
                        $paymentMethod = 'COD';
                    } else if ($paymentMethodStr === 'Transfer' || $paymentMethodStr === 'transfer' || $paymentMethodStr === 'bank_transfer' || $paymentMethodStr === 'โอน') {
                        $paymentMethod = 'Transfer';
                    } else if ($paymentMethodStr === 'PayAfter' || $paymentMethodStr === 'pay_after' || $paymentMethodStr === 'pay-after' || 
                               $paymentMethodStr === 'หลังจากรับสินค้า' || $paymentMethodStr === 'รับสินค้าก่อน' || $paymentMethodStr === 'ผ่อนชำระ' || $paymentMethodStr === 'ผ่อน') {
                        $paymentMethod = 'PayAfter';
                    } else {
                        // If value doesn't match any known pattern, log warning and set to null
                        error_log('Warning: Unknown payment method value: ' . $paymentMethodStr);
                        $paymentMethod = null;
                    }
                }
                
                // Get main order ID and validate it doesn't have sub order suffix
                $mainOrderId = $in['id'];
                // Ensure main order ID doesn't have sub order suffix (e.g., -1, -2)
                if (preg_match('/^(.+)-(\d+)$/', $mainOrderId, $matches)) {
                    // If main order ID has suffix, use the base ID instead
                    $mainOrderId = $matches[1];
                    error_log("Warning: Main order ID had sub order suffix, using base ID: {$mainOrderId}");
                }
                $in['id'] = $mainOrderId;

                // Collect box numbers from items to ensure we cover all boxes
                $itemBoxNumbers = [];
                $maxItemBoxNumber = 1;
                if (!empty($in['items']) && is_array($in['items'])) {
                    foreach ($in['items'] as $it) {
                        $bn = isset($it['boxNumber']) ? (int)$it['boxNumber'] : (int)($it['box_number'] ?? 1);
                        $bn = $bn > 0 ? $bn : 1;
                        $itemBoxNumbers[] = $bn;
                        if ($bn > $maxItemBoxNumber) {
                            $maxItemBoxNumber = $bn;
                        }
                    }
                }

                // Normalize boxes payload (support codAmount / collectionAmount)
                $normalizedBoxes = [];
                if (!empty($in['boxes']) && is_array($in['boxes'])) {
                    foreach ($in['boxes'] as $box) {
                        $num = isset($box['boxNumber']) ? (int)$box['boxNumber'] : (int)($box['box_number'] ?? 0);
                        if ($num <= 0) { $num = 1; }
                        $amountRaw = $box['collectionAmount'] ?? $box['codAmount'] ?? $box['amount'] ?? $box['cod_amount'] ?? 0;
                        $amount = (float)$amountRaw;
                        if ($amount < 0) { $amount = 0.0; }
                        $normalizedBoxes[$num] = [
                            'box_number' => $num,
                            'collection_amount' => $amount,
                        ];
                    }
                }

                // Ensure at least one box exists
                $primaryAmount = isset($in['codAmount']) && $in['codAmount'] !== '' ? (float)$in['codAmount'] : (float)($in['totalAmount'] ?? 0);
                if (empty($normalizedBoxes)) {
                    $normalizedBoxes[1] = ['box_number' => 1, 'collection_amount' => $primaryAmount];
                }

                // Ensure boxes cover all item box numbers (fill missing with 0)
                $maxBoxNumber = max($maxItemBoxNumber, (!empty($normalizedBoxes) ? max(array_keys($normalizedBoxes)) : 1));
                for ($i = 1; $i <= $maxBoxNumber; $i++) {
                    if (!isset($normalizedBoxes[$i])) {
                        $normalizedBoxes[$i] = ['box_number' => $i, 'collection_amount' => 0.0];
                    }
                }
                ksort($normalizedBoxes);

                // Validate sequential numbering (1..N)
                $expectedSeq = 1;
                foreach ($normalizedBoxes as $num => $_) {
                    if ($num !== $expectedSeq) {
                        $pdo->rollBack();
                        json_response(['error' => 'INVALID_BOX_NUMBER', 'message' => 'boxNumber ต้องเรียงจาก 1 และห้ามข้ามเลข'], 400);
                        return;
                    }
                    $expectedSeq++;
                }

                $boxCount = count($normalizedBoxes);
                $totalAmount = isset($in['totalAmount']) ? (float)$in['totalAmount'] : 0.0;
                $boxTotal = array_reduce($normalizedBoxes, function($carry, $b) {
                    return $carry + (float)($b['collection_amount'] ?? 0);
                }, 0.0);

                $effectivePaymentMethod = $paymentMethod ?? 'COD';
                if ($effectivePaymentMethod === 'COD') {
                    $expectedCod = isset($in['codAmount']) && $in['codAmount'] !== '' ? (float)$in['codAmount'] : $totalAmount;
                    $expectedCod = max(0.0, $expectedCod);
                    if (abs($boxTotal - $expectedCod) > 0.01) {
                        $pdo->rollBack();
                        json_response(['error' => 'COD_BOX_TOTAL_MISMATCH', 'message' => 'ยอด COD ต่อกล่องรวมไม่ตรงกับยอด COD ทั้งหมด'], 400);
                        return;
                    }
                    $codAmountValue = $boxTotal;
                } else {
                    if ($boxCount !== 1 || $maxItemBoxNumber > 1) {
                        $pdo->rollBack();
                        json_response(['error' => 'NON_COD_SINGLE_BOX_ONLY', 'message' => 'ออเดอร์ที่ไม่ใช่ COD ต้องมี 1 กล่อง'], 400);
                        return;
                    }
                    // Force single box for non-COD with full amount
                    $normalizedBoxes = [1 => ['box_number' => 1, 'collection_amount' => $totalAmount]];
                    $boxCount = 1;
                    $boxTotal = $totalAmount;
                    $codAmountValue = null;
                }

                // Build per-box order IDs used only for order_items/order allocations
                $subOrderIds = [];
                for ($i = 1; $i <= $boxCount; $i++) {
                    $subOrderIds[] = "{$mainOrderId}-{$i}";
                }

                $shippingProvider = $in['shippingProvider'] ?? ($in['shipping_provider'] ?? null);
                if ($shippingProvider !== null && trim((string)$shippingProvider) === '') {
                    $shippingProvider = null;
                }

                $values = [
                    $mainOrderId, $in['customerId'], $in['companyId'], $in['creatorId'], $in['orderDate'], $in['deliveryDate'],
                    $addr['street'] ?? null, $addr['subdistrict'] ?? null, $addr['district'] ?? null, $addr['province'] ?? null, $addr['postalCode'] ?? null,
                    $recipientFirstName,
                    $recipientLastName,
                ];
                if ($hasShippingProvider) {
                    $values[] = $shippingProvider;
                }
                $values = array_merge($values, [
                    $in['shippingCost'] ?? 0, $in['billDiscount'] ?? 0, $in['totalAmount'] ?? 0,
                    $paymentMethod, $in['paymentStatus'] ?? null, $in['slipUrl'] ?? null, $in['amountPaid'] ?? null, $codAmountValue,
                    $in['orderStatus'] ?? null, $in['notes'] ?? null, $in['salesChannel'] ?? null, $in['salesChannelPageId'] ?? null, $in['warehouseId'] ?? null,
                ]);
                
                if ($hasBankAccountId) {
                    $values[] = isset($in['bankAccountId']) && $in['bankAccountId'] !== null && $in['bankAccountId'] !== '' ? (int)$in['bankAccountId'] : null;
                }
                if ($hasTransferDate) {
                    $values[] = isset($in['transferDate']) && $in['transferDate'] !== null && $in['transferDate'] !== '' ? $in['transferDate'] : null;
                }
                $values[] = $in['customerStatus'] ?? $in['customerType'] ?? null;

                try {
                    $stmt->execute($values);
                } catch (PDOException $e) {
                    // If duplicate entry error for main order, rollback and return error
                    if ($e->getCode() == 23000 && strpos($e->getMessage(), 'Duplicate entry') !== false) {
                        $pdo->rollBack();
                        json_response(['error' => 'DUPLICATE_ORDER', 'message' => 'Order ID already exists: ' . $mainOrderId], 400);
                        return;
                    }
                        }

                // Insert order_boxes for per-box COD/collection tracking
                $boxIns = $pdo->prepare('INSERT INTO order_boxes (order_id, sub_order_id, box_number, payment_method, collection_amount, cod_amount, collected_amount, waived_amount, status) VALUES (?,?,?,?,?,?,?,?,?)');
                foreach ($normalizedBoxes as $box) {
                    $boxNumber = (int)($box['box_number'] ?? 1);
                    $collectionAmount = (float)($box['collection_amount'] ?? 0.0);
                    $subOrderIdForBox = "{$mainOrderId}-{$boxNumber}";
                    $boxIns->execute([
                        $mainOrderId,
                        $subOrderIdForBox,
                        $boxNumber,
                        $paymentMethod ?? 'COD',
                        $collectionAmount,
                        $collectionAmount, // keep cod_amount in sync for compatibility
                        0.0,
                        0.0,
                        'PENDING',
                    ]);
                }

                if (!empty($in['items']) && is_array($in['items'])) {
                    // Two-phase insert to satisfy FK parent_item_id -> order_items(id)
                    $ins = $pdo->prepare('INSERT INTO order_items (order_id, parent_order_id, product_id, product_name, quantity, price_per_unit, discount, net_total, is_freebie, box_number, promotion_id, parent_item_id, is_promotion_parent, creator_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');

                    $computeNetValues = function(array $item): array {
                        $quantity = isset($item['quantity']) ? (int)$item['quantity'] : 0;
                        $quantity = $quantity < 0 ? 0 : $quantity;
                        $pricePerUnit = isset($item['pricePerUnit']) ? (float)$item['pricePerUnit'] : (float)($item['price_per_unit'] ?? 0.0);
                        $pricePerUnit = $pricePerUnit < 0 ? 0.0 : $pricePerUnit;
                        $discount = isset($item['discount']) ? (float)$item['discount'] : 0.0;
                        $isFreebie = (!empty($item['isFreebie']) || (!empty($item['is_freebie']) && (int)$item['is_freebie'] === 1)) ? 1 : 0;
                        $netTotal = calculate_order_item_net_total([
                            'quantity' => $quantity,
                            'pricePerUnit' => $pricePerUnit,
                            'discount' => $discount,
                            'isFreebie' => $isFreebie,
                        ]);
                        return [$quantity, $pricePerUnit, $discount, $netTotal, $isFreebie];
                    };

                    // Helper function to get order_id based on box_number (using synthesized per-box IDs)
                    $getOrderIdForBox = function($boxNumber) use ($mainOrderId, $subOrderIds) {
                        $boxNum = (int)$boxNumber;
                        if ($boxNum <= 0) {
                            return $subOrderIds[0] ?? "{$mainOrderId}-1";
                        }
                        if (isset($subOrderIds[$boxNum - 1])) {
                            return $subOrderIds[$boxNum - 1];
                        }
                        return "{$mainOrderId}-{$boxNum}";
                    };

                    $clientToDbParent = [];
                    $clientToDbItem = [];

                    // 1) Insert promotion parents first and map client item id -> DB id
                    foreach ($in['items'] as $it) {
                        $isParent = !empty($it['isPromotionParent']);
                        if ($isParent) {
                            $boxNumber = isset($it['boxNumber']) ? (int)$it['boxNumber'] : 1;
                            $orderIdForItem = $getOrderIdForBox($boxNumber);
                            [$quantity, $pricePerUnit, $discount, $netTotal, $isFreebie] = $computeNetValues($it);
                            $ins->execute([
                                $orderIdForItem, $mainOrderId,
                                $it['productId'] ?? null, $it['productName'] ?? null, $quantity,
                                $pricePerUnit, $discount, $netTotal, $isFreebie, $boxNumber,
                                $it['promotionId'] ?? null, null, 1, $creatorId,
                            ]);
                            $dbId = (int)$pdo->lastInsertId();
                            if (isset($it['id'])) {
                                $clientToDbParent[(string)$it['id']] = $dbId;
                                $clientToDbItem[(string)$it['id']] = $dbId;
                            }
                        }
                    }

                    // 2) Insert regular items (not parent, not child)
                    foreach ($in['items'] as $it) {
                        $isParent = !empty($it['isPromotionParent']);
                        $hasParent = isset($it['parentItemId']) && $it['parentItemId'] !== null && $it['parentItemId'] !== '';
                        if (!$isParent && !$hasParent) {
                            $boxNumber = isset($it['boxNumber']) ? (int)$it['boxNumber'] : 1;
                            $orderIdForItem = $getOrderIdForBox($boxNumber);
                            [$quantity, $pricePerUnit, $discount, $netTotal, $isFreebie] = $computeNetValues($it);
                            $ins->execute([
                                $orderIdForItem, $mainOrderId,
                                $it['productId'] ?? null, $it['productName'] ?? null, $quantity,
                                $pricePerUnit, $discount, $netTotal, $isFreebie, $boxNumber,
                                $it['promotionId'] ?? null, null, 0, $creatorId,
                            ]);
                            $dbId = (int)$pdo->lastInsertId();
                            if (isset($it['id'])) { $clientToDbItem[(string)$it['id']] = $dbId; }
                        }
                    }

                    // 3) Insert children with resolved parent_item_id (map client id -> DB id)
                    foreach ($in['items'] as $it) {
                        $isParent = !empty($it['isPromotionParent']);
                        $clientParent = $it['parentItemId'] ?? null;
                        if (!$isParent && ($clientParent !== null && $clientParent !== '')) {
                            $resolved = null;
                            if ($clientParent !== null && isset($clientToDbParent[(string)$clientParent])) {
                                $resolved = $clientToDbParent[(string)$clientParent];
                            }
                            $boxNumber = isset($it['boxNumber']) ? (int)$it['boxNumber'] : 1;
                            $orderIdForItem = $getOrderIdForBox($boxNumber);
                            [$quantity, $pricePerUnit, $discount, $netTotal, $isFreebie] = $computeNetValues($it);
                            $ins->execute([
                                $orderIdForItem, $mainOrderId,
                                $it['productId'] ?? null, $it['productName'] ?? null, $quantity,
                                $pricePerUnit, $discount, $netTotal, $isFreebie, $boxNumber,
                                $it['promotionId'] ?? null, $resolved, 0, $creatorId,
                            ]);
                            $dbId = (int)$pdo->lastInsertId();
                            if (isset($it['id'])) { $clientToDbItem[(string)$it['id']] = $dbId; }
                        }
                    }

                    // 4) Create allocation rows for backoffice (warehouse-agnostic at creation time)
                    $alloc = $pdo->prepare('INSERT INTO order_item_allocations (order_id, order_item_id, product_id, required_quantity, is_freebie, promotion_id, status, created_by) VALUES (?,?,?,?,?,?,?,?)');
                    foreach ($in['items'] as $it) {
                        $isParent = !empty($it['isPromotionParent']);
                        $productId = $it['productId'] ?? null;
                        if ($isParent) { continue; }
                        if (!$productId) { continue; }
                        $orderItemId = null;
                        if (isset($it['id']) && isset($clientToDbItem[(string)$it['id']])) {
                            $orderItemId = $clientToDbItem[(string)$it['id']];
                        }
                        // Allocations remain tied to the main order for warehouse processing
                        $alloc->execute([
                            $mainOrderId,
                            $orderItemId,
                            $productId,
                            max(0, (int)($it['quantity'] ?? 0)),
                            !empty($it['isFreebie']) ? 1 : 0,
                            $it['promotionId'] ?? null,
                            'PENDING',
                            $in['creatorId'] ?? null,
                        ]);
                    }
                }

                if (!empty($in['trackingEntries']) && is_array($in['trackingEntries'])) {
                    save_order_tracking_entries(
                        $pdo,
                        $mainOrderId,
                        $in['trackingEntries'],
                        false,
                        $in['creatorId'] ?? null,
                        $in['customerId'] ?? null
                    );
                } elseif (!empty($in['trackingNumbers']) && is_array($in['trackingNumbers'])) {
                    $legacyEntries = [];
                    foreach ($in['trackingNumbers'] as $tnRaw) {
                        $legacyEntries[] = ['trackingNumber' => $tnRaw];
                    }
                    save_order_tracking_entries(
                        $pdo,
                        $mainOrderId,
                        $legacyEntries,
                        false,
                        $in['creatorId'] ?? null,
                        $in['customerId'] ?? null
                    );
                }
                
                // Update customer total_purchases and grade after order creation
                try {
                    $customerId = $in['customerId'] ?? null;
                    $orderTotal = floatval($in['totalAmount'] ?? 0);
                    
                    if ($customerId && $orderTotal > 0) {
                        // Find customer by id (varchar) or customer_ref_id (varchar) or customer_id (int PK)
                        // orders.customer_id is varchar and references customers.id (varchar) or customers.customer_ref_id (varchar)
                        $customerCheck = $pdo->prepare('SELECT customer_id, total_purchases FROM customers WHERE id = ? OR customer_ref_id = ? OR customer_id = ? LIMIT 1');
                        $customerCheck->execute([$customerId, $customerId, $customerId]);
                        $customerData = $customerCheck->fetch(PDO::FETCH_ASSOC);
                        
                        if ($customerData) {
                            $customerPk = $customerData['customer_id']; // This is the int PK
                            $currentTotal = floatval($customerData['total_purchases'] ?? 0);
                            $newTotal = $currentTotal + $orderTotal;
                            
                            // Calculate new grade based on total purchases
                            // Grade thresholds: A >= 50000, B >= 10000, C >= 5000, D >= 2000, else D
                            $newGrade = 'D';
                            if ($newTotal >= 50000) {
                                $newGrade = 'A';
                            } else if ($newTotal >= 10000) {
                                $newGrade = 'B';
                            } else if ($newTotal >= 5000) {
                                $newGrade = 'C';
                            } else if ($newTotal >= 2000) {
                                $newGrade = 'D';
                            }
                            
                            // Update customer total_purchases and grade using customer_id (int PK)
                            $updateCustomer = $pdo->prepare('UPDATE customers SET total_purchases = ?, grade = ? WHERE customer_id = ?');
                            $updateCustomer->execute([$newTotal, $newGrade, $customerPk]);
                            
                            error_log("Updated customer {$customerPk}: total_purchases={$newTotal}, grade={$newGrade}");
                        } else {
                            error_log("Customer not found for ID: {$customerId}");
                        }
                    }
                } catch (Throwable $e) {
                    // Log error but don't fail the order creation
                    error_log('Failed to update customer total_purchases/grade: ' . $e->getMessage());
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
            $shippingProvider = array_key_exists('shippingProvider', $in) ? trim((string)$in['shippingProvider']) : (array_key_exists('shipping_provider', $in) ? trim((string)$in['shipping_provider']) : null); if ($shippingProvider === '') $shippingProvider = null;
            $totalAmount  = array_key_exists('total_amount', $in) ? $in['total_amount'] : (array_key_exists('totalAmount', $in) ? $in['totalAmount'] : null); if ($totalAmount === '') $totalAmount = null;
            $deliveryDate  = array_key_exists('deliveryDate', $in) ? $in['deliveryDate'] : (array_key_exists('delivery_date', $in) ? $in['delivery_date'] : null); if ($deliveryDate === '') $deliveryDate = null;
            $salesChannelPageId = array_key_exists('salesChannelPageId', $in) ? $in['salesChannelPageId'] : (array_key_exists('sales_channel_page_id', $in) ? $in['sales_channel_page_id'] : null); if ($salesChannelPageId === '') $salesChannelPageId = null;
            $street        = array_key_exists('street', $in) ? $in['street'] : null; if ($street === '') $street = null;
            $subdistrict   = array_key_exists('subdistrict', $in) ? $in['subdistrict'] : (array_key_exists('sub_district', $in) ? $in['sub_district'] : null); if ($subdistrict === '') $subdistrict = null;
            $district      = array_key_exists('district', $in) ? $in['district'] : null; if ($district === '') $district = null;
            $province      = array_key_exists('province', $in) ? $in['province'] : null; if ($province === '') $province = null;
            $postalCode    = array_key_exists('postal_code', $in) ? $in['postal_code'] : (array_key_exists('postalCode', $in) ? $in['postalCode'] : null); if ($postalCode === '') $postalCode = null;
            $recipientFirstName = array_key_exists('recipient_first_name', $in) ? $in['recipient_first_name'] : (array_key_exists('recipientFirstName', $in) ? $in['recipientFirstName'] : null); if ($recipientFirstName === '') $recipientFirstName = null;
            $recipientLastName  = array_key_exists('recipient_last_name', $in) ? $in['recipient_last_name'] : (array_key_exists('recipientLastName', $in) ? $in['recipientLastName'] : null); if ($recipientLastName === '') $recipientLastName = null;
            $customerType       = array_key_exists('customer_type', $in) ? $in['customer_type'] : (array_key_exists('customerType', $in) ? $in['customerType'] : null); if ($customerType === '') $customerType = null;

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

            $allocationSummary = [];
            $releaseSummary = [];

            $pdo->beginTransaction();
            try {
                $lockStmt = $pdo->prepare('SELECT order_status, payment_status, customer_id, warehouse_id, company_id, total_amount, payment_method, cod_amount, creator_id FROM orders WHERE id = ? FOR UPDATE');
                $lockStmt->execute([$id]);
                $existingOrder = $lockStmt->fetch(PDO::FETCH_ASSOC);
                if (!$existingOrder) {
                    $pdo->rollBack();
                    json_response(['error' => 'NOT_FOUND'], 404);
                }

                $previousStatus = (string)($existingOrder['order_status'] ?? '');
                $previousPayment = (string)($existingOrder['payment_status'] ?? '');
                $customerId = $existingOrder['customer_id'] ?? null;

                $dbName = $pdo->query("SELECT DATABASE()")->fetchColumn();
                $existingColumns = $pdo->query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = '$dbName' AND TABLE_NAME = 'orders'")->fetchAll(PDO::FETCH_COLUMN);
                $hasShippingProvider = in_array('shipping_provider', $existingColumns);

                $updateSql = 'UPDATE orders SET slip_url=COALESCE(?, slip_url), order_status=COALESCE(?, order_status), payment_status=COALESCE(?, payment_status), amount_paid=COALESCE(?, amount_paid), cod_amount=COALESCE(?, cod_amount), notes=COALESCE(?, notes), sales_channel=COALESCE(?, sales_channel), sales_channel_page_id=COALESCE(?, sales_channel_page_id), delivery_date=COALESCE(?, delivery_date), street=COALESCE(?, street), subdistrict=COALESCE(?, subdistrict), district=COALESCE(?, district), province=COALESCE(?, province), postal_code=COALESCE(?, postal_code), recipient_first_name=COALESCE(?, recipient_first_name), recipient_last_name=COALESCE(?, recipient_last_name), total_amount=COALESCE(?, total_amount), customer_type=COALESCE(?, customer_type)';
                $params = [$slipUrl, $orderStatus, $paymentStatus, $amountPaid, $codAmount, $notes, $salesChannel, $salesChannelPageId, $deliveryDate, $street, $subdistrict, $district, $province, $postalCode, $recipientFirstName, $recipientLastName, $totalAmount, $customerType];
                if ($hasShippingProvider) {
                    $updateSql .= ', shipping_provider=COALESCE(?, shipping_provider)';
                    $params[] = $shippingProvider;
                }
                $updateSql .= ' WHERE id=?';
                $params[] = $id;
                $stmt = $pdo->prepare($updateSql);
                $stmt->execute($params);

                $orderRowStmt = $pdo->prepare('SELECT order_status, payment_status, customer_id, warehouse_id, company_id, total_amount, payment_method, cod_amount FROM orders WHERE id=?');
                $orderRowStmt->execute([$id]);
                $updatedOrder = $orderRowStmt->fetch(PDO::FETCH_ASSOC);
                if (!$updatedOrder) {
                    throw new RuntimeException('ORDER_RELOAD_FAILED');
                }

                $newStatus = (string)($updatedOrder['order_status'] ?? $previousStatus);
                $newPaymentStatus = (string)($updatedOrder['payment_status'] ?? $previousPayment);
                $customerId = $updatedOrder['customer_id'] ?? $customerId;
                $warehouseIdForAllocation = $updatedOrder['warehouse_id'] !== null ? (int)$updatedOrder['warehouse_id'] : null;
                $companyIdForAllocation = $updatedOrder['company_id'] !== null ? (int)$updatedOrder['company_id'] : null;

                try {
                    if ((isset($paymentStatus) && strcasecmp((string)$paymentStatus, 'Paid') === 0) ||
                        (isset($orderStatus) && strcasecmp((string)$orderStatus, 'Delivered') === 0)) {
                        if ($customerId) {
                            // Find customer by customer_ref_id or customer_id, then update using customer_id (PK)
                            $findStmt = $pdo->prepare('SELECT customer_id FROM customers WHERE customer_ref_id = ? OR customer_id = ? LIMIT 1');
                            $findStmt->execute([$customerId, is_numeric($customerId) ? (int)$customerId : null]);
                            $customer = $findStmt->fetch();
                            if ($customer && $customer['customer_id']) {
                                $upd = $pdo->prepare('UPDATE customers SET lifecycle_status=? WHERE customer_id=?');
                                $upd->execute(['Old3Months', $customer['customer_id']]);
                            }
                        }
                    }
                } catch (Throwable $e) { /* ignore */ }

                try {
                    // If order status is Picking, grant sale quota (+90 days)
                    // Use delivery_date from order as the sale date, then add 90 days for ownership_expires
                    if ($customerId && strcasecmp($newStatus, 'Picking') === 0) {
                        // Get delivery_date from the order
                        $orderStmt = $pdo->prepare('SELECT delivery_date FROM orders WHERE id=?');
                        $orderStmt->execute([$id]);
                        $deliveryDateStr = $orderStmt->fetchColumn();
                        
                        if ($deliveryDateStr) {
                            $deliveryDate = new DateTime($deliveryDateStr);
                            // ownership_expires = delivery_date + 90 days
                            $newExpiry = clone $deliveryDate;
                            $newExpiry->add(new DateInterval('P90D'));
                            
                            // Ensure max 90 days from current date
                            $now = new DateTime();
                            $maxAllowed = (clone $now); $maxAllowed->add(new DateInterval('P90D'));
                            if ($newExpiry > $maxAllowed) { $newExpiry = $maxAllowed; }
                            
                            // Find customer by customer_ref_id or customer_id, then update using customer_id (PK)
                            $findStmt = $pdo->prepare('SELECT customer_id FROM customers WHERE customer_ref_id = ? OR customer_id = ? LIMIT 1');
                            $findStmt->execute([$customerId, is_numeric($customerId) ? (int)$customerId : null]);
                            $customer = $findStmt->fetch();
                            if ($customer && $customer['customer_id']) {
                                $u = $pdo->prepare('UPDATE customers SET ownership_expires=?, has_sold_before=1, last_sale_date=?, follow_up_count=0, lifecycle_status=?, followup_bonus_remaining=1 WHERE customer_id=?');
                                $u->execute([$newExpiry->format('Y-m-d H:i:s'), $deliveryDate->format('Y-m-d H:i:s'), 'Old3Months', $customer['customer_id']]);
                            }
                        }
                    }
                } catch (Throwable $e) { /* ignore quota errors to not block order update */ }

                $hasTrackingUpdate = false;
                if (isset($in['trackingEntries']) && is_array($in['trackingEntries']) && !empty($in['trackingEntries'])) {
                    save_order_tracking_entries($pdo, $id, $in['trackingEntries'], true);
                    $hasTrackingUpdate = true;
                } elseif (isset($in['trackingNumbers']) && is_array($in['trackingNumbers']) && !empty($in['trackingNumbers'])) {
                    $legacyEntries = [];
                    foreach ($in['trackingNumbers'] as $tnRaw) {
                        $tn = trim((string)$tnRaw);
                        if ($tn !== '') {
                            $legacyEntries[] = ['trackingNumber' => $tn];
                        }
                    }
                    if (!empty($legacyEntries)) {
                        save_order_tracking_entries($pdo, $id, $legacyEntries, true);
                        $hasTrackingUpdate = true;
                    }
                }

                // --- Auto-Sync with Google Sheet Shipping Data ---
                if ($hasTrackingUpdate) {
                    try {
                        $syncService = new ShippingSyncService($pdo);
                        // We need the tracking numbers to sync.
                        // Collect them from input or fetch from DB if needed.
                        // Here we iterate over what was just added/update.
                        $trackingsToSync = [];
                        
                        if (!empty($in['trackingEntries'])) {
                            foreach ($in['trackingEntries'] as $entry) {
                                if (!empty($entry['trackingNumber'])) $trackingsToSync[] = $entry['trackingNumber'];
                            }
                        } elseif (!empty($in['trackingNumbers'])) {
                             foreach ($in['trackingNumbers'] as $tn) {
                                if (!empty($tn)) $trackingsToSync[] = $tn;
                            }
                        }

                        foreach (array_unique($trackingsToSync) as $tn) {
                            $syncService->syncOrderFromSheet($tn);
                        }
                    } catch (Throwable $syncErr) {
                        error_log("Shipping Sync Failed for Order {$id}: " . $syncErr->getMessage());
                    }
                }
                // -------------------------------------------------
                
                // Auto-update order_status to Shipping when tracking is added and order is Picking or Preparing
                // Only if order_status is not explicitly set in the request
                if ($hasTrackingUpdate && $orderStatus === null) {
                    $currentStatus = strtoupper((string)($updatedOrder['order_status'] ?? $previousStatus));
                    // If order is Picking or Preparing, and has tracking, change to Shipping
                    if (($currentStatus === 'PICKING' || $currentStatus === 'PREPARING')) {
                        $autoShippingStmt = $pdo->prepare('UPDATE orders SET order_status = ? WHERE id = ?');
                        $autoShippingStmt->execute(['Shipping', $id]);
                        $newStatus = 'Shipping';
                        $updatedOrder['order_status'] = 'Shipping';
                        // Reload order to get updated status
                        $orderRowStmt->execute([$id]);
                        $updatedOrder = $orderRowStmt->fetch(PDO::FETCH_ASSOC);
                        if ($updatedOrder) {
                            $newStatus = (string)($updatedOrder['order_status'] ?? $newStatus);
                        }
                    }
                }

                if ($orderStatus !== null) {
                    $normalizedStatus = strtoupper($orderStatus);
                    if ($normalizedStatus === 'PICKING' && strcasecmp($previousStatus, 'Picking') !== 0) {
                        // Only auto-allocate if warehouse_id exists, otherwise skip (for companies not using warehouse system)
                        if ($warehouseIdForAllocation) {
                            try {
                                $allocationSummary = auto_allocate_order($pdo, $id, $warehouseIdForAllocation, $companyIdForAllocation);
                            } catch (Throwable $allocErr) {
                                // Log but don't fail the order status update if allocation fails
                                error_log('Auto-allocation failed for order ' . $id . ': ' . $allocErr->getMessage());
                            }
                        }
                        // If no warehouse_id, just update status without allocation (for companies not using warehouse system)
                    } elseif ($normalizedStatus === 'CANCELLED' && strcasecmp($previousStatus, 'Cancelled') !== 0) {
                        $releaseSummary = release_order_allocations($pdo, $id);
                    }
                }

                if (isset($in['boxes']) && is_array($in['boxes'])) {
                    $effectivePaymentMethod = $updatedOrder['payment_method'] ?? $existingOrder['payment_method'] ?? 'COD';
                    $orderTotal = isset($updatedOrder['total_amount']) ? (float)$updatedOrder['total_amount'] : (float)($existingOrder['total_amount'] ?? 0);
                    $codTarget = $codAmount !== null ? (float)$codAmount : (isset($updatedOrder['cod_amount']) ? (float)$updatedOrder['cod_amount'] : null);
                    if ($codTarget === null || $codTarget <= 0) {
                        $codTarget = $orderTotal;
                    }

                    $normalizedBoxes = [];
                    foreach ($in['boxes'] as $box) {
                        $num = isset($box['boxNumber']) ? (int)$box['boxNumber'] : (int)($box['box_number'] ?? 0);
                        if ($num <= 0) { $num = 1; }
                        $collectionAmount = (float)($box['collectionAmount'] ?? $box['codAmount'] ?? $box['cod_amount'] ?? 0);
                        if ($collectionAmount < 0) { $collectionAmount = 0.0; }
                        $collectedAmount = (float)($box['collectedAmount'] ?? $box['collected_amount'] ?? 0);
                        if ($collectedAmount < 0) { $collectedAmount = 0.0; }
                        $waivedAmount = (float)($box['waivedAmount'] ?? $box['waived_amount'] ?? 0);
                        if ($waivedAmount < 0) { $waivedAmount = 0.0; }
                        $normalizedBoxes[$num] = [
                            'box_number' => $num,
                            'collection_amount' => $collectionAmount,
                            'collected_amount' => $collectedAmount,
                            'waived_amount' => $waivedAmount,
                        ];
                    }

                    ksort($normalizedBoxes);
                    $expected = 1;
                    foreach ($normalizedBoxes as $num => $_) {
                        if ($num !== $expected) {
                            throw new RuntimeException('INVALID_BOX_NUMBER_SEQUENCE');
                        }
                        $expected++;
                    }

                    if ($effectivePaymentMethod !== 'COD') {
                        // Allow multiple boxes for non-COD, but force amount logic:
                        // Box 1 gets the total amount, others get 0
                        foreach ($normalizedBoxes as $num => &$boxData) {
                            if ($num === 1) {
                                $boxData['collection_amount'] = $totalAmount;
                            } else {
                                $boxData['collection_amount'] = 0.0;
                            }
                            $boxData['collected_amount'] = 0.0; // Paid via transfer usually means 0 to collect on delivery
                            $boxData['waived_amount'] = 0.0;
                        }
                        unset($boxData); // Break reference
                        
                        $boxCount = count($normalizedBoxes);
                        $boxTotal = $totalAmount;
                        $codTarget = null;
                    }

                    $boxSum = array_reduce($normalizedBoxes, function($carry, $b) {
                        return $carry + (float)($b['collection_amount'] ?? 0);
                    }, 0.0);

                    if ($effectivePaymentMethod === 'COD') {
                        if (abs($boxSum - $codTarget) > 0.01) {
                            throw new RuntimeException('COD_BOX_TOTAL_MISMATCH');
                        }
                    }

                    $selectBox = $pdo->prepare('SELECT id FROM order_boxes WHERE order_id=? AND box_number=? LIMIT 1');
                    $updateBox = $pdo->prepare('UPDATE order_boxes SET payment_method=?, collection_amount=?, cod_amount=?, collected_amount=?, waived_amount=?, sub_order_id=?, status=COALESCE(status, \'PENDING\') WHERE order_id=? AND box_number=?');
                    $insertBox = $pdo->prepare('INSERT INTO order_boxes (order_id, sub_order_id, box_number, payment_method, collection_amount, cod_amount, collected_amount, waived_amount, status) VALUES (?,?,?,?,?,?,?,?,\'PENDING\')');

                    $boxNumbers = array_keys($normalizedBoxes);
                    if (!empty($boxNumbers)) {
                        $ph = implode(',', array_fill(0, count($boxNumbers), '?'));
                        $delParams = array_merge([$id], $boxNumbers);
                        $del = $pdo->prepare("DELETE FROM order_boxes WHERE order_id=? AND box_number NOT IN ($ph)");
                        $del->execute($delParams);
                    }

                    foreach ($normalizedBoxes as $num => $box) {
                        $subOrderId = "{$id}-{$num}";
                        $selectBox->execute([$id, $num]);
                        $existingBoxId = $selectBox->fetchColumn();
                        if ($existingBoxId) {
                            $updateBox->execute([
                                $effectivePaymentMethod,
                                $box['collection_amount'],
                                $box['collection_amount'],
                                $box['collected_amount'],
                                $box['waived_amount'],
                                $subOrderId,
                                $id,
                                $num,
                            ]);
                        } else {
                            $insertBox->execute([
                                $id,
                                $subOrderId,
                                $num,
                                $effectivePaymentMethod,
                                $box['collection_amount'],
                                $box['collection_amount'],
                                $box['collected_amount'],
                                $box['waived_amount'],
                            ]);
                        }
                    }

                    if ($effectivePaymentMethod === 'COD') {
                        $updCodAmount = $pdo->prepare('UPDATE orders SET cod_amount=? WHERE id=?');
                        $updCodAmount->execute([$boxSum, $id]);
                    } else {
                        $updCodAmount = $pdo->prepare('UPDATE orders SET cod_amount=NULL WHERE id=?');
                        $updCodAmount->execute([$id]);
                    }
                }

                // Update items if provided (Delete all existing and re-create)
                if (isset($in['items']) && is_array($in['items'])) {
                    $itemCreatorId = $in['creatorId'] ?? $existingOrder['creator_id'] ?? null;

                    // 1. Clear old allocations and items to prevent duplicates/conflicts
                    // 1. Clear old allocations and items to prevent duplicates/conflicts (Check Main ID and Sub-IDs)
                    $pdo->prepare('DELETE FROM order_item_allocations WHERE order_id = ? OR order_id LIKE CONCAT(?, "-%")')->execute([$id, $id]);
                    $pdo->prepare('DELETE FROM order_items WHERE order_id = ? OR order_id LIKE CONCAT(?, "-%")')->execute([$id, $id]);

                    // 2. Prepare insert statement (same as POST)
                    $ins = $pdo->prepare('INSERT INTO order_items (order_id, parent_order_id, product_id, product_name, quantity, price_per_unit, discount, net_total, is_freebie, box_number, promotion_id, parent_item_id, is_promotion_parent, creator_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');

                    $computeNetValues = function(array $item): array {
                        $quantity = isset($item['quantity']) ? (int)$item['quantity'] : 0;
                        $quantity = $quantity < 0 ? 0 : $quantity;
                        $pricePerUnit = isset($item['pricePerUnit']) ? (float)$item['pricePerUnit'] : (float)($item['price_per_unit'] ?? 0.0);
                        $pricePerUnit = $pricePerUnit < 0 ? 0.0 : $pricePerUnit;
                        $discount = isset($item['discount']) ? (float)$item['discount'] : 0.0;
                        $isFreebie = (!empty($item['isFreebie']) || (!empty($item['is_freebie']) && (int)$item['is_freebie'] === 1)) ? 1 : 0;
                        $netTotal = calculate_order_item_net_total([
                            'quantity' => $quantity,
                            'pricePerUnit' => $pricePerUnit,
                            'discount' => $discount,
                            'isFreebie' => $isFreebie,
                        ]);
                        return [$quantity, $pricePerUnit, $discount, $netTotal, $isFreebie];
                    };

                    $getOrderIdForBox = function($boxNumber) use ($id) {
                         $boxNum = (int)$boxNumber;
                         if ($boxNum <= 0) return "{$id}-1";
                         return "{$id}-{$boxNum}";
                    };

                    $clientToDbParent = [];
                    $clientToDbItem = [];

                    // 3.1) Insert promotion parents
                    foreach ($in['items'] as $it) {
                        $isParent = !empty($it['isPromotionParent']);
                        if ($isParent) {
                            $boxNumber = isset($it['boxNumber']) ? (int)$it['boxNumber'] : 1;
                            $orderIdForItem = $getOrderIdForBox($boxNumber);
                            [$quantity, $pricePerUnit, $discount, $netTotal, $isFreebie] = $computeNetValues($it);
                            $ins->execute([
                                $orderIdForItem, $id,
                                $it['productId'] ?? null, $it['productName'] ?? null, $quantity,
                                $pricePerUnit, $discount, $netTotal, $isFreebie, $boxNumber,
                                $it['promotionId'] ?? null, null, 1, $itemCreatorId,
                            ]);
                            $dbId = (int)$pdo->lastInsertId();
                            if (isset($it['id'])) {
                                $clientToDbParent[(string)$it['id']] = $dbId;
                                $clientToDbItem[(string)$it['id']] = $dbId;
                            }
                        }
                    }

                    // 3.2) Insert regular items
                    foreach ($in['items'] as $it) {
                         $isParent = !empty($it['isPromotionParent']);
                         $hasParent = isset($it['parentItemId']) && $it['parentItemId'] !== null && $it['parentItemId'] !== '';
                         if (!$isParent && !$hasParent) {
                            $boxNumber = isset($it['boxNumber']) ? (int)$it['boxNumber'] : 1;
                            $orderIdForItem = $getOrderIdForBox($boxNumber);
                            [$quantity, $pricePerUnit, $discount, $netTotal, $isFreebie] = $computeNetValues($it);
                            $ins->execute([
                                $orderIdForItem, $id,
                                $it['productId'] ?? null, $it['productName'] ?? null, $quantity,
                                $pricePerUnit, $discount, $netTotal, $isFreebie, $boxNumber,
                                $it['promotionId'] ?? null, null, 0, $itemCreatorId,
                            ]);
                            $dbId = (int)$pdo->lastInsertId();
                            if (isset($it['id'])) { $clientToDbItem[(string)$it['id']] = $dbId; }
                         }
                    }

                    // 3.3) Insert children
                    foreach ($in['items'] as $it) {
                        $isParent = !empty($it['isPromotionParent']);
                        $clientParent = $it['parentItemId'] ?? null;
                        if (!$isParent && ($clientParent !== null && $clientParent !== '')) {
                            $resolved = null;
                            if ($clientParent !== null && isset($clientToDbParent[(string)$clientParent])) {
                                $resolved = $clientToDbParent[(string)$clientParent];
                            }
                            $boxNumber = isset($it['boxNumber']) ? (int)$it['boxNumber'] : 1;
                            $orderIdForItem = $getOrderIdForBox($boxNumber);
                            [$quantity, $pricePerUnit, $discount, $netTotal, $isFreebie] = $computeNetValues($it);
                            $ins->execute([
                                $orderIdForItem, $id,
                                $it['productId'] ?? null, $it['productName'] ?? null, $quantity,
                                $pricePerUnit, $discount, $netTotal, $isFreebie, $boxNumber,
                                $it['promotionId'] ?? null, $resolved, 0, $itemCreatorId,
                            ]);
                            $dbId = (int)$pdo->lastInsertId();
                            if (isset($it['id'])) { $clientToDbItem[(string)$it['id']] = $dbId; }
                        }
                    }

                    // 4) Re-create allocations (PENDING status)
                    // Note: This resets allocation status to PENDING. If you need to preserve fulfillment status, logic needs to be much more complex.
                    // For now, assuming editing order implies re-evaluating stock.
                    $alloc = $pdo->prepare('INSERT INTO order_item_allocations (order_id, order_item_id, product_id, required_quantity, is_freebie, promotion_id, status, created_by) VALUES (?,?,?,?,?,?,?,?)');
                    foreach ($in['items'] as $it) {
                        $isParent = !empty($it['isPromotionParent']);
                        $productId = $it['productId'] ?? null;
                        if ($isParent) { continue; }
                        if (!$productId) { continue; }
                        $orderItemId = null;
                        if (isset($it['id']) && isset($clientToDbItem[(string)$it['id']])) {
                            $orderItemId = $clientToDbItem[(string)$it['id']];
                        }
                        $alloc->execute([
                            $id,
                            $orderItemId,
                            $productId,
                            max(0, (int)($it['quantity'] ?? 0)),
                            !empty($it['isFreebie']) ? 1 : 0,
                            $it['promotionId'] ?? null,
                            'PENDING',
                            $itemCreatorId,
                        ]);
                    }
                }

                $pdo->commit();

                $response = ['ok' => true];
                if (!empty($allocationSummary)) {
                    $response['autoAllocated'] = $allocationSummary;
                }
                if (!empty($releaseSummary)) {
                    $response['released'] = $releaseSummary;
                }
                json_response($response);
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                $msg = $e->getMessage();
                $statusCode = 500;
                if ($msg === 'WAREHOUSE_REQUIRED' || $msg === 'WAREHOUSE_NOT_FOUND' || $msg === 'WAREHOUSE_COMPANY_MISMATCH') {
                    $statusCode = 400;
                } elseif (str_starts_with($msg, 'INSUFFICIENT_STOCK')) {
                    $statusCode = 409;
                } elseif ($msg === 'ORDER_RELOAD_FAILED') {
                    $statusCode = 500;
                } elseif (in_array($msg, ['INVALID_BOX_NUMBER_SEQUENCE', 'NON_COD_SINGLE_BOX_ONLY', 'COD_BOX_TOTAL_MISMATCH'])) {
                    $statusCode = 400;
                }
                json_response(['error' => 'ORDER_UPDATE_FAILED', 'message' => $msg], $statusCode);
            }
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

// Stock allocation API: backoffice assigns warehouse/lot for each order item allocation
function handle_allocations(PDO $pdo, ?string $id, ?string $action): void {
    switch (method()) {
        case 'GET':
            // GET /allocations?order_id=...&status=PENDING
            $orderId = $_GET['order_id'] ?? null;
            $status = $_GET['status'] ?? null;
            $sql = 'SELECT a.*, p.name AS product_name, w.name AS warehouse_name
                    FROM order_item_allocations a
                    LEFT JOIN products p ON p.id = a.product_id
                    LEFT JOIN warehouses w ON w.id = a.warehouse_id
                    WHERE 1=1';
            $params = [];
            if ($orderId) { $sql .= ' AND a.order_id = ?'; $params[] = $orderId; }
            if ($status) { $sql .= ' AND a.status = ?'; $params[] = $status; }
            $sql .= ' ORDER BY a.order_id, a.product_id, a.id';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            json_response($stmt->fetchAll());
            break;
        case 'PUT':
        case 'POST':
            // Update an allocation row: { warehouseId, lotNumber, allocatedQuantity, status }
            if (!$id) { json_response(['error' => 'MISSING_ID'], 400); }
            $in = json_input();
            $warehouseId = $in['warehouseId'] ?? null;
            $lotNumber = $in['lotNumber'] ?? null;
            $allocatedQty = array_key_exists('allocatedQuantity', $in) ? (int)$in['allocatedQuantity'] : null;
            $status = $in['status'] ?? null;

            $pdo->beginTransaction();
            try {
                $allocStmt = $pdo->prepare('SELECT * FROM order_item_allocations WHERE id=? FOR UPDATE');
                $allocStmt->execute([$id]);
                $allocation = $allocStmt->fetch(PDO::FETCH_ASSOC);
                if (!$allocation) {
                    $pdo->rollBack();
                    json_response(['error' => 'NOT_FOUND'], 404);
                }

                $requestedStatus = $status !== null ? strtoupper($status) : null;
                $effectiveWarehouseId = $warehouseId !== null ? (int)$warehouseId : ($allocation['warehouse_id'] !== null ? (int)$allocation['warehouse_id'] : null);

                if ($requestedStatus === 'CANCELLED') {
                    $releasedInfo = release_single_allocation($pdo, $allocation, 'CANCELLED');
                    $pdo->commit();
                    json_response(['ok' => true, 'released' => $releasedInfo]);
                }

                if ($requestedStatus === 'ALLOCATED') {
                    if ($effectiveWarehouseId === null) {
                        throw new RuntimeException('WAREHOUSE_REQUIRED');
                    }
                    $desiredQty = $allocatedQty !== null ? max(0, $allocatedQty) : (int)$allocation['required_quantity'];
                    if ($desiredQty <= 0) {
                        throw new RuntimeException('INVALID_ALLOCATED_QUANTITY');
                    }
                    $preferredLot = ($lotNumber !== null && $lotNumber !== '') ? (string)$lotNumber : null;
                    
                    // Check if allowNegativeStock is set in request body
                    $allowNegativeStock = isset($in['allowNegativeStock']) && $in['allowNegativeStock'] === true;
                    
                    if ($allowNegativeStock) {
                        $allocationResult = allocate_allocation_fifo_allow_negative($pdo, $allocation, $effectiveWarehouseId, $desiredQty, $preferredLot);
                    } else {
                        $allocationResult = allocate_allocation_fifo($pdo, $allocation, $effectiveWarehouseId, $desiredQty, $preferredLot);
                        if (!$allocationResult) {
                            throw new RuntimeException('INSUFFICIENT_STOCK');
                        }
                    }
                    
                    $pdo->commit();
                    json_response(['ok' => true, 'autoAllocated' => $allocationResult]);
                }

                $set = []; $params = [];
                if ($warehouseId !== null) { $set[] = 'warehouse_id=?'; $params[] = $warehouseId; }
                if ($lotNumber !== null) { $set[] = 'lot_number=?'; $params[] = $lotNumber; }
                if ($allocatedQty !== null) { $set[] = 'allocated_quantity=?'; $params[] = max(0, $allocatedQty); }
                if ($status !== null) { $set[] = 'status=?'; $params[] = $status; }
                if (!$set) {
                    $pdo->rollBack();
                    json_response(['error' => 'NO_FIELDS'], 400);
                }
                $params[] = $id;
                $sql = 'UPDATE order_item_allocations SET '.implode(',', $set).' WHERE id=?';
                $upd = $pdo->prepare($sql);
                $upd->execute($params);

                $pdo->commit();
                json_response(['ok' => true]);
            } catch (Throwable $e) {
                $pdo->rollBack();
                $msg = $e->getMessage();
                $code = 500;
                if ($msg === 'WAREHOUSE_REQUIRED' || $msg === 'INVALID_ALLOCATED_QUANTITY') {
                    $code = 400;
                } elseif (str_starts_with($msg, 'INSUFFICIENT_STOCK')) {
                    $code = 409;
                }
                json_response(['error' => 'UPDATE_FAILED', 'message' => $msg], $code);
            }
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

function handle_pages(PDO $pdo, ?string $id): void {
    try {
        switch (method()) {
            case 'GET':
                if ($id) {
                    $stmt = $pdo->prepare('SELECT * FROM pages WHERE id = ?');
                    $stmt->execute([$id]);
                    $row = $stmt->fetch();
                    $row ? json_response($row) : json_response(['error' => 'NOT_FOUND'], 404);
                } else {
                    $companyId = $_GET['companyId'] ?? null;
                    $pageType = $_GET['page_type'] ?? null;
                    $checkPancakeShow = isset($_GET['CheckPancakeShow']) && $_GET['CheckPancakeShow'] == '1';

                    $sql = 'SELECT p.*, (SELECT COUNT(*) FROM marketing_user_page WHERE page_id = p.id) as marketing_user_count FROM pages p WHERE still_in_list = 1';
                    $params = [];
                    if ($companyId) { $sql .= ' AND company_id = ?'; $params[] = $companyId; }
                    if ($pageType) { $sql .= ' AND page_type = ?'; $params[] = $pageType; }
                    if (isset($_GET['active'])) { $sql .= ' AND active = ?'; $params[] = $_GET['active']; }

                    // CheckPancakeShow logic
                    if ($checkPancakeShow && $companyId) {
                        try {
                            $envStmt = $pdo->prepare("SELECT value FROM env WHERE `key` = 'PANCAKE_SHOW_IN_CREATE_ORDER' AND company_id = ?");
                            $envStmt->execute([$companyId]);
                            $envVal = $envStmt->fetchColumn();
                            
                            // If env value is not '1', exclude pancake pages
                            if ($envVal != '1') {
                                $sql .= " AND (page_type IS NULL OR page_type != 'pancake')";
                            }
                        } catch (Throwable $e) {
                            // If env table issue, exclude by default
                            $sql .= " AND (page_type IS NULL OR page_type != 'pancake')";
                        }
                    }

                    $sql .= ' ORDER BY id DESC LIMIT 500';
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute($params);
                    json_response($stmt->fetchAll());
                }
                break;
            case 'POST':
                $in = json_input();
                $stmt = $pdo->prepare('INSERT INTO pages (name, platform, url, company_id, active) VALUES (?,?,?,?,?)');
                // default active = 1 if missing
                $active = isset($in['active']) ? (!empty($in['active']) ? 1 : 0) : 1;
                $stmt->execute([$in['name'] ?? '', $in['platform'] ?? 'Facebook', $in['url'] ?? null, $in['companyId'] ?? null, $active]);
                json_response(['id' => $pdo->lastInsertId()]);
                break;
            case 'PATCH':
                if (!$id) json_response(['error' => 'ID_REQUIRED'], 400);
                $in = json_input();
                $stmt = $pdo->prepare('UPDATE pages SET name=COALESCE(?, name), platform=COALESCE(?, platform), url=COALESCE(?, url), company_id=COALESCE(?, company_id), active=COALESCE(?, active) WHERE id=?');
                $stmt->execute([
                    $in['name'] ?? null,
                    $in['platform'] ?? null,
                    $in['url'] ?? null,
                    $in['companyId'] ?? null,
                    isset($in['active']) ? (!empty($in['active']) ? 1 : 0) : null,
                    $id
                ]);
                json_response(['ok' => true]);
                break;
            default:
                json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
        }
    } catch (Throwable $e) {
        json_response(['error' => 'PAGES_FAILED', 'message' => $e->getMessage()], 500);
    }
}

function handle_bank_accounts(PDO $pdo, ?string $id): void {
    try {
        $companyId = $_GET['companyId'] ?? null;
        if (!$companyId && method() !== 'GET') {
            // For POST, PATCH, DELETE, get companyId from request body
            $in = json_input();
            $companyId = $in['companyId'] ?? null;
        }
        
        switch (method()) {
            case 'GET':
                if ($id) {
                    $sql = 'SELECT * FROM bank_account WHERE id = ? AND deleted_at IS NULL';
                    $params = [$id];
                    if ($companyId) {
                        $sql .= ' AND company_id = ?';
                        $params[] = $companyId;
                    }
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute($params);
                    $row = $stmt->fetch();
                    $row ? json_response($row) : json_response(['error' => 'NOT_FOUND'], 404);
                } else {
                    $activeOnly = isset($_GET['active']) && $_GET['active'] === 'true';
                    $sql = 'SELECT * FROM bank_account WHERE deleted_at IS NULL';
                    $params = [];
                    $conditions = [];
                    if ($companyId) {
                        $conditions[] = 'company_id = ?';
                        $params[] = $companyId;
                    }
                    if ($activeOnly) {
                        $conditions[] = 'is_active = 1';
                    }
                    if ($conditions) {
                        $sql .= ' AND ' . implode(' AND ', $conditions);
                    }
                    $sql .= ' ORDER BY bank ASC, bank_number ASC';
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute($params);
                    json_response($stmt->fetchAll());
                }
                break;
            case 'POST':
                $in = json_input();
                if (!$companyId) {
                    $companyId = $in['companyId'] ?? null;
                }
                if (!$companyId) {
                    json_response(['error' => 'COMPANY_ID_REQUIRED'], 400);
                    return;
                }
                $stmt = $pdo->prepare('INSERT INTO bank_account (bank, bank_number, company_id, is_active) VALUES (?,?,?,?)');
                $active = isset($in['isActive']) ? (!empty($in['isActive']) ? 1 : 0) : 1;
                $stmt->execute([
                    $in['bank'] ?? '',
                    $in['bankNumber'] ?? '',
                    $companyId,
                    $active
                ]);
                json_response(['id' => $pdo->lastInsertId()]);
                break;
            case 'PATCH':
                if (!$id) json_response(['error' => 'ID_REQUIRED'], 400);
                $in = json_input();
                // Verify company_id matches if provided
                if ($companyId) {
                    $checkStmt = $pdo->prepare('SELECT company_id FROM bank_account WHERE id = ? AND deleted_at IS NULL');
                    $checkStmt->execute([$id]);
                    $bankCompanyId = $checkStmt->fetchColumn();
                    if ($bankCompanyId != $companyId) {
                        json_response(['error' => 'FORBIDDEN'], 403);
                        return;
                    }
                }
                $set = [];
                $params = [];
                if (isset($in['bank'])) { $set[] = 'bank = ?'; $params[] = $in['bank']; }
                if (isset($in['bankNumber'])) { $set[] = 'bank_number = ?'; $params[] = $in['bankNumber']; }
                if (isset($in['isActive'])) { $set[] = 'is_active = ?'; $params[] = !empty($in['isActive']) ? 1 : 0; }
                if (!$set) json_response(['error' => 'NO_FIELDS'], 400);
                $params[] = $id;
                $sql = 'UPDATE bank_account SET '.implode(', ', $set).' WHERE id = ? AND deleted_at IS NULL';
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                json_response(['ok' => true]);
                break;
            case 'DELETE':
                if (!$id) json_response(['error' => 'ID_REQUIRED'], 400);
                // Verify company_id matches if provided
                if ($companyId) {
                    $checkStmt = $pdo->prepare('SELECT company_id FROM bank_account WHERE id = ? AND deleted_at IS NULL');
                    $checkStmt->execute([$id]);
                    $bankCompanyId = $checkStmt->fetchColumn();
                    if ($bankCompanyId != $companyId) {
                        json_response(['error' => 'FORBIDDEN'], 403);
                        return;
                    }
                }
                // Soft delete
                $stmt = $pdo->prepare('UPDATE bank_account SET deleted_at = NOW() WHERE id = ?');
                $stmt->execute([$id]);
                json_response(['ok' => true]);
                break;
            default:
                json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
        }
    } catch (Exception $e) {
        error_log("Bank accounts handler error: " . $e->getMessage());
        json_response(['error' => 'INTERNAL_ERROR', 'message' => $e->getMessage()], 500);
    }
}

function handle_platforms(PDO $pdo, ?string $id): void {
    try {
        $companyId = $_GET['companyId'] ?? null;
        if (!$companyId && method() !== 'GET') {
            // For POST, PATCH, DELETE, get companyId from request body
            $in = json_input();
            $companyId = $in['companyId'] ?? null;
        }

        // Optional role-based visibility filter (Super Admin sees all)
        $userRole = isset($_GET['userRole']) ? trim((string)$_GET['userRole']) : null;
        if ($userRole === '') {
            $userRole = null;
        }
        
        switch (method()) {
            case 'GET':
                if ($id) {
                    $sql = 'SELECT * FROM platforms WHERE id = ?';
                    $params = [$id];
                    if ($companyId) {
                        $sql .= ' AND company_id = ?';
                        $params[] = $companyId;
                    }
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute($params);
                    $row = $stmt->fetch();
                    $row ? json_response($row) : json_response(['error' => 'NOT_FOUND'], 404);
                } else {
                    $activeOnly = isset($_GET['active']) && $_GET['active'] === 'true';
                    $sql = 'SELECT * FROM platforms';
                    $params = [];
                    $conditions = [];
                    if ($companyId) {
                        $conditions[] = 'company_id = ?';
                        $params[] = $companyId;
                    }
                    if ($activeOnly) {
                        $conditions[] = 'active = 1';
                    }
                    // If not Super Admin, restrict to platforms where role_show JSON contains this role
                    if ($userRole && $userRole !== 'Super Admin') {
                        $conditions[] = '(JSON_VALID(role_show) AND JSON_CONTAINS(role_show, JSON_QUOTE(?), \'$\'))';
                        $params[] = $userRole;
                    }
                    if ($conditions) {
                        $sql .= ' WHERE ' . implode(' AND ', $conditions);
                    }
                    $sql .= ' ORDER BY sort_order ASC, id ASC';
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute($params);
                    json_response($stmt->fetchAll());
                }
                break;
            case 'POST':
                $in = json_input();
                if (!$companyId) {
                    $companyId = $in['companyId'] ?? null;
                }
                if (!$companyId) {
                    json_response(['error' => 'COMPANY_ID_REQUIRED'], 400);
                    return;
                }
                $stmt = $pdo->prepare('INSERT INTO platforms (name, display_name, description, company_id, active, sort_order, show_pages_from, role_show) VALUES (?,?,?,?,?,?,?,?)');
                $active = isset($in['active']) ? (!empty($in['active']) ? 1 : 0) : 1;
                $sortOrder = isset($in['sortOrder']) ? (int)$in['sortOrder'] : 0;
                $showPagesFrom = isset($in['showPagesFrom']) ? (trim($in['showPagesFrom']) ?: null) : null;
                $roleShow = isset($in['roleShow']) ? $in['roleShow'] : null;
                if (is_array($roleShow)) {
                    $roleShow = json_encode(array_values($roleShow));
                } else {
                    $roleShow = null;
                }
                $stmt->execute([
                    $in['name'] ?? '',
                    $in['displayName'] ?? $in['name'] ?? '',
                    $in['description'] ?? null,
                    $companyId,
                    $active,
                    $sortOrder,
                    $showPagesFrom,
                    $roleShow
                ]);
                json_response(['id' => $pdo->lastInsertId()]);
                break;
            case 'PATCH':
                if (!$id) json_response(['error' => 'ID_REQUIRED'], 400);
                $in = json_input();
                // Verify company_id matches if provided
                if ($companyId) {
                    $checkStmt = $pdo->prepare('SELECT company_id FROM platforms WHERE id = ?');
                    $checkStmt->execute([$id]);
                    $platformCompanyId = $checkStmt->fetchColumn();
                    if ($platformCompanyId != $companyId) {
                        json_response(['error' => 'FORBIDDEN'], 403);
                        return;
                    }
                }
                $set = [];
                $params = [];
                if (isset($in['name'])) { $set[] = 'name = ?'; $params[] = $in['name']; }
                if (isset($in['displayName'])) { $set[] = 'display_name = ?'; $params[] = $in['displayName']; }
                if (isset($in['description'])) { $set[] = 'description = ?'; $params[] = $in['description']; }
                if (isset($in['active'])) { $set[] = 'active = ?'; $params[] = !empty($in['active']) ? 1 : 0; }
                if (isset($in['sortOrder'])) { $set[] = 'sort_order = ?'; $params[] = (int)$in['sortOrder']; }
                if (isset($in['showPagesFrom'])) { $set[] = 'show_pages_from = ?'; $params[] = trim($in['showPagesFrom']) ?: null; }
                if (array_key_exists('roleShow', $in)) {
                    $set[] = 'role_show = ?';
                    $value = $in['roleShow'];
                    if (is_array($value)) {
                        $params[] = json_encode(array_values($value));
                    } else {
                        $params[] = null;
                    }
                }
                if (!$set) json_response(['error' => 'NO_FIELDS'], 400);
                $params[] = $id;
                $sql = 'UPDATE platforms SET '.implode(', ', $set).' WHERE id = ?';
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                json_response(['ok' => true]);
                break;
            case 'DELETE':
                if (!$id) json_response(['error' => 'ID_REQUIRED'], 400);
                // Verify company_id matches if provided
                if ($companyId) {
                    $checkStmt = $pdo->prepare('SELECT company_id FROM platforms WHERE id = ?');
                    $checkStmt->execute([$id]);
                    $platformCompanyId = $checkStmt->fetchColumn();
                    if ($platformCompanyId != $companyId) {
                        json_response(['error' => 'FORBIDDEN'], 403);
                        return;
                    }
                }
                // Soft delete by setting active = 0 instead of actually deleting
                $stmt = $pdo->prepare('UPDATE platforms SET active = 0 WHERE id = ?');
                $stmt->execute([$id]);
                json_response(['ok' => true]);
                break;
            default:
                json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
        }
    } catch (Throwable $e) {
        json_response(['error' => 'PLATFORMS_FAILED', 'message' => $e->getMessage()], 500);
    }
}

// Customer blocks API
function handle_customer_blocks(PDO $pdo, ?string $id): void {
    switch (method()) {
        case 'GET':
            $customerId = $_GET['customerId'] ?? null;
            if ($id) {
                $stmt = $pdo->prepare('SELECT * FROM customer_blocks WHERE id = ?');
                $stmt->execute([(int)$id]);
                $row = $stmt->fetch();
                $row ? json_response($row) : json_response(['error' => 'NOT_FOUND'], 404);
            } else if ($customerId) {
                $stmt = $pdo->prepare('SELECT * FROM customer_blocks WHERE customer_id = ? ORDER BY blocked_at DESC');
                $stmt->execute([$customerId]);
                json_response($stmt->fetchAll());
            } else {
                $stmt = $pdo->query('SELECT * FROM customer_blocks WHERE active = 1 ORDER BY blocked_at DESC');
                json_response($stmt->fetchAll());
            }
            break;
        case 'POST':
            $in = json_input();
            $customerId = $in['customerId'] ?? '';
            $reason = trim((string)($in['reason'] ?? ''));
            $blockedBy = (int)($in['blockedBy'] ?? 0);
            if ($customerId === '' || strlen($reason) < 5 || !$blockedBy) {
                json_response(['error' => 'VALIDATION_FAILED', 'message' => 'customerId, reason(>=5), blockedBy required'], 400);
            }
            try {
                $stmt = $pdo->prepare('INSERT INTO customer_blocks (customer_id, reason, blocked_by, blocked_at, active) VALUES (?, ?, ?, NOW(), 1)');
                $stmt->execute([$customerId, $reason, $blockedBy]);
                // Remove assignment and flag as blocked
                try {
                    // Try to find customer by customer_ref_id or customer_id, then update using customer_id (PK)
                    $findStmt = $pdo->prepare('SELECT customer_id FROM customers WHERE customer_ref_id = ? OR customer_id = ? LIMIT 1');
                    $findStmt->execute([$customerId, is_numeric($customerId) ? (int)$customerId : null]);
                    $customer = $findStmt->fetch();
                    if ($customer && $customer['customer_id']) {
                        $pdo->prepare('UPDATE customers SET assigned_to = NULL, is_blocked = 1 WHERE customer_id = ?')->execute([$customer['customer_id']]);
                    }
                } catch (Throwable $e) { /* ignore */ }
                json_response(['ok' => true], 201);
            } catch (Throwable $e) {
                json_response(['error' => 'INSERT_FAILED', 'message' => $e->getMessage()], 409);
            }
            break;
        case 'PATCH':
            if (!$id) json_response(['error' => 'ID_REQUIRED'], 400);
            $in = json_input();
            $active = array_key_exists('active', $in) ? (int)!!$in['active'] : null;
            $unblockedBy = (int)($in['unblockedBy'] ?? 0);
            $fields = [];$params = [];
            if ($active !== null) { $fields[] = 'active = ?'; $params[] = $active; }
            if ($unblockedBy) { $fields[] = 'unblocked_by = ?'; $params[] = $unblockedBy; $fields[] = 'unblocked_at = NOW()'; }
            if (empty($fields)) json_response(['ok' => true]);
            $params[] = (int)$id;
            try {
                $pdo->prepare('UPDATE customer_blocks SET '.implode(', ', $fields).' WHERE id = ?')->execute($params);
                if ($active === 0) {
                    // clear block flag on customer
                    try {
                        $cidStmt = $pdo->prepare('SELECT customer_id FROM customer_blocks WHERE id=?');
                        $cidStmt->execute([(int)$id]);
                        $cid = $cidStmt->fetchColumn();
                        if ($cid) {
                            // Find customer by customer_ref_id (from customer_blocks) or customer_id, then update using customer_id (PK)
                            $findStmt = $pdo->prepare('SELECT customer_id FROM customers WHERE customer_ref_id = ? OR customer_id = ? LIMIT 1');
                            $findStmt->execute([$cid, is_numeric($cid) ? (int)$cid : null]);
                            $customer = $findStmt->fetch();
                            if ($customer && $customer['customer_id']) {
                                $pdo->prepare('UPDATE customers SET is_blocked = 0 WHERE customer_id = ?')->execute([$customer['customer_id']]);
                            }
                        }
                    } catch (Throwable $e) { /* ignore */ }
                }
                json_response(['ok' => true]);
            } catch (Throwable $e) {
                json_response(['error' => 'UPDATE_FAILED', 'message' => $e->getMessage()], 409);
            }
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
    // Check if table exists
    $tableExists = $pdo->query("SELECT COUNT(*) FROM information_schema.tables 
                                WHERE table_schema = DATABASE() AND table_name = 'order_slips'")->fetchColumn();
    
    if ($tableExists == 0) {
        $pdo->exec('CREATE TABLE order_slips (
            id INT AUTO_INCREMENT PRIMARY KEY,
            order_id VARCHAR(32) NOT NULL,
            url VARCHAR(1024) NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_order_slips_order (order_id),
            CONSTRAINT fk_order_slips_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
    }
    
    // Check if columns exist and add them if needed
    $dbName = $pdo->query("SELECT DATABASE()")->fetchColumn();
    $columnCheck = $pdo->query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                                WHERE TABLE_SCHEMA = '$dbName' AND TABLE_NAME = 'order_slips'")->fetchAll(PDO::FETCH_COLUMN);
    $columns = $columnCheck ?: [];
    
    if (!in_array('amount', $columns)) {
        try {
            $pdo->exec('ALTER TABLE order_slips ADD COLUMN amount DECIMAL(12,2) NULL AFTER order_id');
            $columns[] = 'amount';
        } catch (Exception $e) {
            // Column may already exist, ignore
        }
    } else {
        // Ensure amount can store decimals for partial payments
        try {
            $pdo->exec('ALTER TABLE order_slips MODIFY amount DECIMAL(12,2) NULL');
        } catch (Exception $e) {
            // ignore if cannot alter (permission or already correct)
        }
    }
    if (!in_array('bank_account_id', $columns)) {
        try {
            $pdo->exec('ALTER TABLE order_slips ADD COLUMN bank_account_id INT NULL AFTER amount');
            $columns[] = 'bank_account_id';
        } catch (Exception $e) {
            // Column may already exist, ignore
        }
    }
    if (!in_array('transfer_date', $columns)) {
        try {
            $pdo->exec('ALTER TABLE order_slips ADD COLUMN transfer_date DATETIME NULL AFTER bank_account_id');
            $columns[] = 'transfer_date';
        } catch (Exception $e) {
            // Column may already exist, ignore
        }
    }
    if (!in_array('upload_by', $columns)) {
        try {
            $pdo->exec('ALTER TABLE order_slips ADD COLUMN upload_by INT NULL AFTER url');
            $columns[] = 'upload_by';
        } catch (Exception $e) {
            // Column may already exist, ignore
        }
    }
    if (!in_array('upload_by_name', $columns)) {
        try {
            $pdo->exec('ALTER TABLE order_slips ADD COLUMN upload_by_name VARCHAR(255) NULL AFTER upload_by');
            $columns[] = 'upload_by_name';
        } catch (Exception $e) {
            // Column may already exist, ignore
        }
    }
    
    // Add index for bank_account_id if it doesn't exist
    if (in_array('bank_account_id', $columns)) {
        $indexCheck = $pdo->query("SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
                                    WHERE TABLE_SCHEMA = '$dbName' AND TABLE_NAME = 'order_slips' 
                                    AND INDEX_NAME = 'idx_order_slips_bank_account_id'")->fetchColumn();
        if ($indexCheck == 0) {
            try {
                $pdo->exec('ALTER TABLE order_slips ADD INDEX idx_order_slips_bank_account_id (bank_account_id)');
            } catch (Exception $e) {
                // Index may already exist, ignore
            }
        }
        
        // Add foreign key constraint if it doesn't exist
        $constraintCheck = $pdo->query("SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
                                        WHERE TABLE_SCHEMA = '$dbName' AND TABLE_NAME = 'order_slips' 
                                        AND CONSTRAINT_NAME = 'fk_order_slips_bank_account_id'")->fetchColumn();
        if ($constraintCheck == 0) {
            try {
                $pdo->exec('ALTER TABLE order_slips ADD CONSTRAINT fk_order_slips_bank_account_id 
                           FOREIGN KEY (bank_account_id) REFERENCES bank_account(id) ON DELETE SET NULL');
            } catch (Exception $e) {
                // Foreign key may fail if bank_account table doesn't exist, ignore
            }
        }
    }
}

function ensure_cod_schema(PDO $pdo): void {
    try {
        $dbName = $pdo->query("SELECT DATABASE()")->fetchColumn();
    } catch (Throwable $e) {
        return;
    }

    // 1) cod_documents table
    try {
        $tableExists = $pdo->query("SELECT COUNT(*) FROM information_schema.tables 
                                    WHERE table_schema = '$dbName' AND table_name = 'cod_documents'")->fetchColumn();
        if ((int)$tableExists === 0) {
            $pdo->exec("CREATE TABLE cod_documents (
                id INT AUTO_INCREMENT PRIMARY KEY,
                document_number VARCHAR(64) NOT NULL,
                document_datetime DATETIME NOT NULL,
                bank_account_id INT NULL,
                matched_statement_log_id INT NULL,
                company_id INT NOT NULL,
                total_input_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
                total_order_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
                status VARCHAR(32) NOT NULL DEFAULT 'pending',
                notes TEXT NULL,
                created_by INT NULL,
                verified_by INT NULL,
                verified_at DATETIME NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_cod_document_company_number (company_id, document_number),
                KEY idx_cod_documents_company (company_id),
                KEY idx_cod_documents_datetime (document_datetime),
                KEY idx_cod_documents_status (status),
                KEY idx_cod_documents_statement (matched_statement_log_id),
                CONSTRAINT fk_cod_documents_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
                CONSTRAINT fk_cod_documents_bank FOREIGN KEY (bank_account_id) REFERENCES bank_account(id) ON DELETE SET NULL,
                CONSTRAINT fk_cod_documents_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
                CONSTRAINT fk_cod_documents_statement FOREIGN KEY (matched_statement_log_id) REFERENCES statement_logs(id) ON DELETE SET NULL,
                CONSTRAINT fk_cod_documents_verified_by FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        }
    } catch (Throwable $e) { /* ignore */ }

    // Ensure additional COD document columns exist for verification
    $docColumns = [];
    try {
        $docColumnRows = $pdo->query("SELECT column_name, column_type, data_type FROM information_schema.columns 
                                      WHERE table_schema = '$dbName' AND table_name = 'cod_documents'")
            ->fetchAll(PDO::FETCH_ASSOC);
        foreach ($docColumnRows as $col) {
            $docColumns[strtolower($col['column_name'])] = $col;
        }
    } catch (Throwable $e) { /* ignore */ }

    if (!isset($docColumns['matched_statement_log_id'])) {
        try { $pdo->exec("ALTER TABLE cod_documents ADD COLUMN matched_statement_log_id INT NULL AFTER bank_account_id"); } catch (Throwable $e) { /* ignore */ }
    }
    if (!isset($docColumns['status'])) {
        try { $pdo->exec("ALTER TABLE cod_documents ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'pending' AFTER total_order_amount"); } catch (Throwable $e) { /* ignore */ }
    }
    if (!isset($docColumns['verified_by'])) {
        try { $pdo->exec("ALTER TABLE cod_documents ADD COLUMN verified_by INT NULL AFTER created_by"); } catch (Throwable $e) { /* ignore */ }
    }
    if (!isset($docColumns['verified_at'])) {
        try { $pdo->exec("ALTER TABLE cod_documents ADD COLUMN verified_at DATETIME NULL AFTER verified_by"); } catch (Throwable $e) { /* ignore */ }
    }
    try {
        $idx = $pdo->query("SELECT COUNT(*) FROM information_schema.statistics 
                            WHERE table_schema = '$dbName' AND table_name = 'cod_documents' AND index_name = 'idx_cod_documents_status'")->fetchColumn();
        if ((int)$idx === 0) {
            $pdo->exec("ALTER TABLE cod_documents ADD INDEX idx_cod_documents_status (status)");
        }
    } catch (Throwable $e) { /* ignore */ }
    try {
        $idx = $pdo->query("SELECT COUNT(*) FROM information_schema.statistics 
                            WHERE table_schema = '$dbName' AND table_name = 'cod_documents' AND index_name = 'idx_cod_documents_statement'")->fetchColumn();
        if ((int)$idx === 0) {
            $pdo->exec("ALTER TABLE cod_documents ADD INDEX idx_cod_documents_statement (matched_statement_log_id)");
        }
    } catch (Throwable $e) { /* ignore */ }
    try {
        $pdo->exec("ALTER TABLE cod_documents ADD CONSTRAINT fk_cod_documents_statement FOREIGN KEY (matched_statement_log_id) REFERENCES statement_logs(id) ON DELETE SET NULL");
    } catch (Throwable $e) { /* ignore */ }
    try {
        $pdo->exec("ALTER TABLE cod_documents ADD CONSTRAINT fk_cod_documents_verified_by FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL");
    } catch (Throwable $e) { /* ignore */ }

    // 2) Ensure cod_records columns exist
    $columns = [];
    try {
        $columnRows = $pdo->query("SELECT column_name, column_type, data_type FROM information_schema.columns 
                                   WHERE table_schema = '$dbName' AND table_name = 'cod_records'")
            ->fetchAll(PDO::FETCH_ASSOC);
        foreach ($columnRows as $col) {
            $columns[strtolower($col['column_name'])] = $col;
        }
    } catch (Throwable $e) { /* ignore */ }

    // document_id
    if (!isset($columns['document_id'])) {
        try { $pdo->exec("ALTER TABLE cod_records ADD COLUMN document_id INT NULL AFTER id"); } catch (Throwable $e) { /* ignore */ }
    }
    try {
        $idx = $pdo->query("SELECT COUNT(*) FROM information_schema.statistics 
                            WHERE table_schema = '$dbName' AND table_name = 'cod_records' AND index_name = 'idx_cod_records_document'")->fetchColumn();
        if ((int)$idx === 0) {
            $pdo->exec("ALTER TABLE cod_records ADD INDEX idx_cod_records_document (document_id)");
        }
    } catch (Throwable $e) { /* ignore */ }
    try {
        $fkExists = $pdo->query("SELECT COUNT(*) FROM information_schema.table_constraints 
                                 WHERE table_schema = '$dbName' AND table_name = 'cod_records' AND constraint_name = 'fk_cod_records_document'")->fetchColumn();
        if ((int)$fkExists === 0) {
            $pdo->exec("ALTER TABLE cod_records 
                ADD CONSTRAINT fk_cod_records_document FOREIGN KEY (document_id) REFERENCES cod_documents(id) ON DELETE SET NULL");
        }
    } catch (Throwable $e) { /* ignore */ }

    // order_id
    if (!isset($columns['order_id'])) {
        try { $pdo->exec("ALTER TABLE cod_records ADD COLUMN order_id VARCHAR(32) NULL AFTER tracking_number"); } catch (Throwable $e) { /* ignore */ }
    }
    try {
        $idx = $pdo->query("SELECT COUNT(*) FROM information_schema.statistics 
                            WHERE table_schema = '$dbName' AND table_name = 'cod_records' AND index_name = 'idx_cod_records_order'")->fetchColumn();
        if ((int)$idx === 0) {
            $pdo->exec("ALTER TABLE cod_records ADD INDEX idx_cod_records_order (order_id)");
        }
    } catch (Throwable $e) { /* ignore */ }

    // order_amount
    if (!isset($columns['order_amount'])) {
        try { $pdo->exec("ALTER TABLE cod_records ADD COLUMN order_amount DECIMAL(12,2) NULL DEFAULT 0.00 AFTER cod_amount"); } catch (Throwable $e) { /* ignore */ }
    }

    // status should accept new values; relax to VARCHAR
    try {
        $statusCol = $columns['status'] ?? null;
        $isVarchar = $statusCol && strtolower($statusCol['data_type']) === 'varchar';
        $supportsMatched = $statusCol && isset($statusCol['column_type']) && stripos($statusCol['column_type'], 'matched') !== false;
        if (!$isVarchar || !$supportsMatched) {
            $pdo->exec("ALTER TABLE cod_records MODIFY status VARCHAR(32) NOT NULL DEFAULT 'pending'");
        }
    } catch (Throwable $e) { /* ignore */ }
}

function handle_order_slips(PDO $pdo, ?string $id): void {
    ensure_order_slips_table($pdo);
    $baseDir = __DIR__ . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'slips';
    if (!is_dir($baseDir)) { @mkdir($baseDir, 0775, true); }

    switch (method()) {
        case 'GET':
            $orderId = $_GET['orderId'] ?? null;
            if (!$orderId) { json_response(['error' => 'ORDER_ID_REQUIRED'], 400); }
            $st = $pdo->prepare('SELECT id, url, created_at, upload_by, upload_by_name, amount, bank_account_id, transfer_date FROM order_slips WHERE order_id=? ORDER BY id DESC');
            $st->execute([$orderId]);
            json_response($st->fetchAll());
            break;
        case 'POST':
            $in = json_input();
            $orderId = $in['orderId'] ?? '';
            $content = $in['contentBase64'] ?? '';
            $bankAccountId = isset($in['bankAccountId']) ? (int)$in['bankAccountId'] : null;
            $transferDate = $in['transferDate'] ?? null;
            $amount = isset($in['amount']) && $in['amount'] !== '' ? (float)$in['amount'] : null;
            $uploadedBy = $in['uploadedBy'] ?? $in['uploadBy'] ?? $in['upload_by'] ?? null;
            $uploadedByName = $in['uploadedByName'] ?? $in['uploadByName'] ?? $in['upload_by_name'] ?? null;
            
            if ($orderId === '' || $content === '') { json_response(['error' => 'INVALID_INPUT'], 400); }
            $url = null;
            // Handle both data URL format (data:image/...) and raw base64
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
            } else if (preg_match('/^[A-Za-z0-9+\/]+=*$/', $content)) {
                // Raw base64 string (without data URL prefix)
                $data = base64_decode($content);
                if ($data !== false) {
                    // Try to detect image type from data
                    $finfo = finfo_open(FILEINFO_MIME_TYPE);
                    $mimeType = finfo_buffer($finfo, $data);
                    finfo_close($finfo);
                    $ext = 'jpg'; // default
                    if (strpos($mimeType, 'png') !== false) $ext = 'png';
                    else if (strpos($mimeType, 'jpeg') !== false || strpos($mimeType, 'jpg') !== false) $ext = 'jpg';
                    else if (strpos($mimeType, 'gif') !== false) $ext = 'gif';
                    
                    $fname = 'slip_' . preg_replace('/[^A-Za-z0-9_-]+/','', $orderId) . '_' . date('Ymd_His') . '_' . substr(md5(uniqid('', true)),0,6) . '.' . $ext;
                    $path = $baseDir . DIRECTORY_SEPARATOR . $fname;
                    if (file_put_contents($path, $data) !== false) {
                        $url = 'api/uploads/slips/' . $fname;
                    }
                }
            }
            if (!$url) { json_response(['error' => 'DECODE_FAILED'], 400); }
            
            // Build INSERT query dynamically based on available columns
            $columns = ['order_id', 'url'];
            $values = [$orderId, $url];
            $placeholders = ['?', '?'];
            
            // Check if columns exist
            $dbName = $pdo->query("SELECT DATABASE()")->fetchColumn();
            $existingColumns = $pdo->query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                                            WHERE TABLE_SCHEMA = '$dbName' AND TABLE_NAME = 'order_slips'")->fetchAll(PDO::FETCH_COLUMN);
            
            if (in_array('amount', $existingColumns) && $amount !== null) {
                $columns[] = 'amount';
                $values[] = $amount;
                $placeholders[] = '?';
            }
            if (in_array('bank_account_id', $existingColumns) && $bankAccountId !== null) {
                $columns[] = 'bank_account_id';
                $values[] = $bankAccountId;
                $placeholders[] = '?';
            }
            if (in_array('transfer_date', $existingColumns) && $transferDate !== null) {
                $columns[] = 'transfer_date';
                $values[] = $transferDate;
                $placeholders[] = '?';
            }
            
            if (in_array('upload_by', $existingColumns) && $uploadedBy !== null && $uploadedBy !== '') {
                $columns[] = 'upload_by';
                $values[] = $uploadedBy;
                $placeholders[] = '?';
            }
            if (in_array('upload_by_name', $existingColumns) && $uploadedByName !== null && $uploadedByName !== '') {
                $columns[] = 'upload_by_name';
                $values[] = $uploadedByName;
                $placeholders[] = '?';
            }
            
            $sql = 'INSERT INTO order_slips (' . implode(', ', $columns) . ') VALUES (' . implode(', ', $placeholders) . ')';
            $st = $pdo->prepare($sql);
            $st->execute($values);
            json_response([
                'ok' => true,
                'id' => $pdo->lastInsertId(),
                'url' => $url,
                'uploaded_by' => $uploadedBy,
                'uploaded_by_name' => $uploadedByName,
                'amount' => $amount,
                'bank_account_id' => $bankAccountId,
                'transfer_date' => $transferDate,
                'created_at' => date('Y-m-d H:i:s'),
            ]);
            break;
        case 'PATCH':
            if (!$id) { json_response(['error' => 'ID_REQUIRED'], 400); }
            $in = json_input();
            
            // Check if slip exists
            $checkStmt = $pdo->prepare('SELECT id FROM order_slips WHERE id=?');
            $checkStmt->execute([$id]);
            if (!$checkStmt->fetch()) {
                json_response(['error' => 'NOT_FOUND'], 404);
            }
            
            // Build UPDATE query dynamically based on provided fields
            $set = [];
            $params = [];
            
            // Check which columns exist in the table
            $dbName = $pdo->query("SELECT DATABASE()")->fetchColumn();
            $existingColumns = $pdo->query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
                                            WHERE TABLE_SCHEMA = '$dbName' AND TABLE_NAME = 'order_slips'")->fetchAll(PDO::FETCH_COLUMN);
            
            if (isset($in['amount']) && in_array('amount', $existingColumns)) {
                $set[] = 'amount = ?';
                $params[] = $in['amount'] !== null && $in['amount'] !== '' ? (float)$in['amount'] : null;
            }
            if (isset($in['bankAccountId']) && in_array('bank_account_id', $existingColumns)) {
                $set[] = 'bank_account_id = ?';
                $params[] = $in['bankAccountId'] !== null && $in['bankAccountId'] !== '' ? (int)$in['bankAccountId'] : null;
            }
            if (isset($in['transferDate']) && in_array('transfer_date', $existingColumns)) {
                $set[] = 'transfer_date = ?';
                $params[] = $in['transferDate'] !== null && $in['transferDate'] !== '' ? $in['transferDate'] : null;
            }
            
            if (empty($set)) {
                json_response(['ok' => true]); // Nothing to update
            }
            
            $params[] = $id; // Add ID for WHERE clause
            $sql = 'UPDATE order_slips SET ' . implode(', ', $set) . ' WHERE id = ?';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            
            json_response(['ok' => true]);
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

function handle_serve_slip_file(string $filename): void {
    // Security: only allow alphanumeric, dash, underscore, and dot in filename
    if (!preg_match('/^[a-zA-Z0-9._-]+$/', $filename)) {
        http_response_code(400);
        echo 'Invalid filename';
        exit;
    }
    
    $baseDir = __DIR__ . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'slips';
    $filePath = $baseDir . DIRECTORY_SEPARATOR . $filename;
    
    // Check if file exists and is within the uploads/slips directory
    if (!file_exists($filePath) || !is_file($filePath)) {
        http_response_code(404);
        echo 'File not found';
        exit;
    }
    
    // Ensure the file is within the allowed directory (prevent directory traversal)
    $realBaseDir = realpath($baseDir);
    $realFilePath = realpath($filePath);
    if (!$realBaseDir || !$realFilePath || strpos($realFilePath, $realBaseDir) !== 0) {
        http_response_code(403);
        echo 'Access denied';
        exit;
    }
    
    // Determine content type based on file extension
    $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    $mimeTypes = [
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'gif' => 'image/gif',
        'webp' => 'image/webp',
    ];
    $contentType = $mimeTypes[$ext] ?? 'application/octet-stream';
    
    // Set headers and serve file
    header('Content-Type: ' . $contentType);
    header('Content-Length: ' . filesize($filePath));
    header('Cache-Control: public, max-age=31536000, immutable');
    readfile($filePath);
    exit;
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

function save_order_tracking_entries(PDO $pdo, string $parentOrderId, array $entries, bool $replaceExisting = false, ?int $creatorId = null, ?string $customerId = null): void {
    if ($replaceExisting) {
        $del = $pdo->prepare('DELETE FROM order_tracking_numbers WHERE parent_order_id=?');
        $del->execute([$parentOrderId]);
    }

    // Check if order has boxes - if yes, auto-assign box_number to tracking entries without box_number
    $boxCount = 0;
    try {
        $boxStmt = $pdo->prepare('SELECT COUNT(*) FROM order_boxes WHERE order_id = ?');
        $boxStmt->execute([$parentOrderId]);
        $boxCount = (int)$boxStmt->fetchColumn();
    } catch (Throwable $e) {
        // If order_boxes table doesn't exist or error, ignore
    }

    $normalized = [];
    $mainTrackingIndex = 0; // Index for tracking without box_number to prevent overwriting
    $autoBoxIndex = 1; // Auto-assign box number starting from 1
    
    foreach ($entries as $entry) {
        $trackingRaw = $entry['trackingNumber'] ?? ($entry['tracking_number'] ?? null);
        $tn = trim((string)$trackingRaw);
        if ($tn === '') {
            continue;
        }

        $boxRaw = $entry['boxNumber'] ?? ($entry['box_number'] ?? null);
        $boxNumber = null;
        if ($boxRaw !== null && $boxRaw !== '') {
            $boxNumber = max(1, (int)$boxRaw);
        }

        $entryOrderId = trim((string)($entry['orderId'] ?? ($entry['order_id'] ?? '')));
        if ($boxNumber === null && $entryOrderId !== '') {
            if (preg_match('/^' . preg_quote($parentOrderId, '/') . '\-(\d+)$/', $entryOrderId, $m)) {
                $boxNumber = (int)$m[1];
            }
        }
        
        // Auto-assign box_number if order has boxes and tracking doesn't have box_number
        if ($boxNumber === null && $boxCount > 0) {
            // If order has multiple boxes, assign box_number sequentially (1, 2, 3, ...)
            if ($boxCount > 1) {
                if ($autoBoxIndex <= $boxCount) {
                    $boxNumber = $autoBoxIndex;
                    $autoBoxIndex++;
                }
                // If tracking count exceeds box count, leave box_number as null for extra tracking
            } else {
                // Single box, assign box_number = 1
                $boxNumber = 1;
            }
        }

        // Use box_number as key if available, otherwise use index to prevent overwriting
        // This allows multiple tracking numbers without box_number to be stored
        if ($boxNumber !== null) {
            $boxKey = 'box_' . $boxNumber;
        } else {
            // Use tracking number + index as key to prevent overwriting when multiple tracking without box_number
            $boxKey = 'main_' . $mainTrackingIndex . '_' . $tn;
            $mainTrackingIndex++;
        }
        
        $normalized[$boxKey] = [
            'tracking_number' => $tn,
            'box_number' => $boxNumber,
        ];
    }

    if (empty($normalized)) {
        return;
    }

    $ins = $pdo->prepare('INSERT INTO order_tracking_numbers (order_id, parent_order_id, box_number, tracking_number) VALUES (?,?,?,?)');
    foreach ($normalized as $data) {
        $boxNumber = $data['box_number'];
        // order_id should be sub-order ID (parentOrderId-boxNumber) if box_number exists, otherwise use parentOrderId
        // This allows tracking to be linked to specific boxes
        $subOrderId = $boxNumber !== null ? "{$parentOrderId}-{$boxNumber}" : $parentOrderId;
        $ins->execute([$subOrderId, $parentOrderId, $boxNumber, $data['tracking_number']]);
    }

    if ($creatorId !== null && $customerId !== null) {
        try {
            // Find customer by customer_ref_id or customer_id, then update using customer_id (PK)
            $findStmt = $pdo->prepare('SELECT customer_id FROM customers WHERE customer_ref_id = ? OR customer_id = ? LIMIT 1');
            $findStmt->execute([$customerId, is_numeric($customerId) ? (int)$customerId : null]);
            $customer = $findStmt->fetch();
            if ($customer && $customer['customer_id']) {
                $auto = $pdo->prepare('UPDATE customers SET assigned_to=?, date_assigned = COALESCE(date_assigned, NOW()) WHERE customer_id=? AND (assigned_to IS NULL OR assigned_to=0)');
                $auto->execute([$creatorId, $customer['customer_id']]);
                $hist = $pdo->prepare('INSERT IGNORE INTO customer_assignment_history(customer_id, user_id, assigned_at) VALUES (?,?, NOW())');
                $hist->execute([$customer['customer_id'], $creatorId]);
            }
        } catch (Throwable $e) { /* ignore auto-assign failures */ }
    }
}

function get_order(PDO $pdo, string $id): ?array {
    // Select all columns including bank_account_id and transfer_date
    // Check if this is a main order (not a sub order)
    $isSubOrder = preg_match('/^(.+)-(\d+)$/', $id, $matches);
    $mainOrderId = $isSubOrder ? $matches[1] : $id;
    
    // Always fetch main order record (not sub order)
    $stmt = $pdo->prepare('SELECT o.*, MAX(CASE WHEN srl.confirmed_action = \'Confirmed\' THEN \'Confirmed\' ELSE NULL END) as reconcile_action 
                           FROM orders o 
                           LEFT JOIN statement_reconcile_logs srl ON (
                               srl.order_id COLLATE utf8mb4_unicode_ci = o.id 
                               OR srl.confirmed_order_id COLLATE utf8mb4_unicode_ci = o.id
                           )
                           WHERE o.id=?
                           GROUP BY o.id');
    $stmt->execute([$mainOrderId]);
    $o = $stmt->fetch();
    if (!$o) return null;
    
    // Fetch customer phone if available
    if (!empty($o['customer_id'])) {
        try {
            $custStmt = $pdo->prepare('SELECT phone, backup_phone FROM customers WHERE customer_id = ? OR customer_ref_id = ? LIMIT 1');
            $custStmt->execute([$o['customer_id'], $o['customer_id']]);
            $cust = $custStmt->fetch();
            if ($cust) {
                $o['customer_phone'] = $cust['phone'];
                $o['customer_backup_phone'] = $cust['backup_phone'];
            }
        } catch (Throwable $e) { /* ignore */ }
    }
    
    // Fetch items from main order and all sub orders
    // Use parent_order_id to find all items for this order group
    $items = $pdo->prepare("SELECT oi.*, oi.creator_id, oi.parent_order_id FROM order_items oi WHERE oi.parent_order_id = ? OR oi.order_id = ? ORDER BY oi.order_id, oi.id");
    $items->execute([$mainOrderId, $mainOrderId]);
    $allItems = $items->fetchAll();
    foreach ($allItems as &$itemRow) {
        if (!isset($itemRow['net_total']) || $itemRow['net_total'] === null) {
            $itemRow['net_total'] = calculate_order_item_net_total($itemRow);
        }
    }
    unset($itemRow);

    // Build list of order IDs for slips query (slips don't have parent_order_id)
    // Increased limit to 50 to cover most cases
    $allOrderIds = [$mainOrderId];
    for ($i = 1; $i <= 50; $i++) {
        $allOrderIds[] = "{$mainOrderId}-{$i}";
    }
    $placeholders = implode(',', array_fill(0, count($allOrderIds), '?'));
    
    // Filter items: if this is a sub order request, only return items for that sub order
    // Otherwise, return all items from main order and sub orders
    if ($isSubOrder) {
        $o['items'] = array_filter($allItems, function($item) use ($id) {
            return $item['order_id'] === $id;
        });
    } else {
        $o['items'] = $allItems;
    }
    
    // Fetch tracking numbers per box (parent order)
    $tn = $pdo->prepare("SELECT order_id, tracking_number, box_number FROM order_tracking_numbers WHERE parent_order_id=? ORDER BY id");
    $tn->execute([$mainOrderId]);
    $tnRows = $tn->fetchAll();
    $tnList = [];
    $trackingDetails = [];
    foreach ($tnRows as $r) {
        $tnList[] = $r['tracking_number'];
        $trackingDetails[] = [
            'order_id' => $r['order_id'],
            'tracking_number' => $r['tracking_number'],
            'box_number' => $r['box_number'],
        ];
    }
    $o['trackingDetails'] = $trackingDetails;
    $o['tracking_details'] = $trackingDetails;
    $o['trackingNumbers'] = array_values(array_unique($tnList));
    
    // Fetch boxes from main order
    $bx = $pdo->prepare('SELECT box_number, cod_amount, collection_amount, collected_amount, waived_amount, payment_method, status, sub_order_id FROM order_boxes WHERE order_id=? ORDER BY box_number');
    $bx->execute([$mainOrderId]);
    $o['boxes'] = $bx->fetchAll();
    
    // Include slips from main order and all sub orders
    try {
        $sl = $pdo->prepare("SELECT id, order_id, url, created_at, amount, bank_account_id, transfer_date, upload_by, upload_by_name FROM order_slips WHERE order_id IN ($placeholders) ORDER BY id DESC");
        $sl->execute($allOrderIds);
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
                    // Find customer by customer_ref_id or customer_id, then update using customer_id (PK)
                    $findStmt = $pdo->prepare('SELECT customer_id FROM customers WHERE customer_ref_id = ? OR customer_id = ? LIMIT 1');
                    $findStmt->execute([$in['customerId'], is_numeric($in['customerId']) ? (int)$in['customerId'] : null]);
                    $customer = $findStmt->fetch();
                    if ($customer && $customer['customer_id']) {
                        $pdo->prepare('UPDATE customers SET total_calls = COALESCE(total_calls,0) + 1 WHERE customer_id=?')->execute([$customer['customer_id']]);
                        $pdo->prepare('UPDATE customers SET lifecycle_status=\'Old\' WHERE customer_id=? AND COALESCE(total_calls,0) <= 1')->execute([$customer['customer_id']]);
                    }
                } catch (Throwable $e) { /* ignore */ }
            }
            json_response(['id' => $pdo->lastInsertId()]);
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

function handle_cod_documents(PDO $pdo, ?string $id): void {
    // Auto-migrate minimal COD schema so the feature works without manual SQL
    ensure_cod_schema($pdo);

    switch (method()) {
        case 'GET':
            $companyId = $_GET['companyId'] ?? null;
            $includeItems = isset($_GET['includeItems']) && $_GET['includeItems'] === 'true';
            if ($id) {
                $sql = 'SELECT cd.*, b.bank, b.bank_number 
                        FROM cod_documents cd 
                        LEFT JOIN bank_account b ON b.id = cd.bank_account_id
                        WHERE cd.id = ?';
                $params = [$id];
                if ($companyId) {
                    $sql .= ' AND cd.company_id = ?';
                    $params[] = $companyId;
                }
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $doc = $stmt->fetch();
                if (!$doc) {
                    json_response(['error' => 'NOT_FOUND'], 404);
                }
                if ($includeItems) {
                    $itemsStmt = $pdo->prepare('SELECT * FROM cod_records WHERE document_id = ? ORDER BY id');
                    $itemsStmt->execute([$doc['id']]);
                    $doc['items'] = $itemsStmt->fetchAll();
                }
                json_response($doc);
            } else {
                $params = [];
                $sql = 'SELECT cd.*, b.bank, b.bank_number 
                        FROM cod_documents cd 
                        LEFT JOIN bank_account b ON b.id = cd.bank_account_id
                        WHERE 1=1';
                if ($companyId) {
                    $sql .= ' AND cd.company_id = ?';
                    $params[] = $companyId;
                }
                $sql .= ' ORDER BY cd.document_datetime DESC, cd.id DESC';
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                json_response($stmt->fetchAll());
            }
            break;
        case 'POST':
            $in = json_input();
            $documentNumber = trim((string)($in['document_number'] ?? ''));
            $documentDatetimeRaw = $in['document_datetime'] ?? null;
            $companyId = $in['company_id'] ?? null;
            $bankAccountId = $in['bank_account_id'] ?? null;
            $notes = $in['notes'] ?? null;
            $createdBy = $in['created_by'] ?? null;
            $items = isset($in['items']) && is_array($in['items']) ? $in['items'] : [];

            if ($documentNumber === '' || !$companyId) {
                json_response(['error' => 'VALIDATION_FAILED', 'message' => 'document_number and company_id are required'], 400);
            }
            if (empty($items)) {
                json_response(['error' => 'VALIDATION_FAILED', 'message' => 'items are required'], 400);
            }

            $documentDatetime = $documentDatetimeRaw ? date('Y-m-d H:i:s', strtotime((string)$documentDatetimeRaw)) : date('Y-m-d H:i:s');

            $totalInput = 0.0;
            $totalOrder = 0.0;
            foreach ($items as $it) {
                $totalInput += (float)($it['cod_amount'] ?? 0);
                $totalOrder += (float)($it['order_amount'] ?? 0);
            }

            try {
                $pdo->beginTransaction();
                $docStmt = $pdo->prepare('INSERT INTO cod_documents (document_number, document_datetime, bank_account_id, company_id, total_input_amount, total_order_amount, notes, created_by) VALUES (?,?,?,?,?,?,?,?)');
                $docStmt->execute([
                    $documentNumber,
                    $documentDatetime,
                    $bankAccountId ?: null,
                    $companyId,
                    $totalInput,
                    $totalOrder,
                    $notes,
                    $createdBy ?: null,
                ]);
                $docId = (int)$pdo->lastInsertId();

                $itemStmt = $pdo->prepare('INSERT INTO cod_records (document_id, tracking_number, order_id, cod_amount, order_amount, received_amount, difference, status, company_id, created_by) VALUES (?,?,?,?,?,?,?,?,?,?)');

                foreach ($items as $it) {
                    $trackingNumber = trim((string)($it['tracking_number'] ?? ''));
                    if ($trackingNumber === '') {
                        continue;
                    }
                    $orderId = isset($it['order_id']) ? trim((string)$it['order_id']) : null;
                    $codAmount = (float)($it['cod_amount'] ?? 0);
                    $orderAmount = (float)($it['order_amount'] ?? ($it['received_amount'] ?? 0));
                    $difference = $codAmount - $orderAmount;
                    $status = $it['status'] ?? null;
                    if ($status === null) {
                        if ($orderId && $orderAmount > 0) {
                            $status = abs($difference) < 0.01 ? 'matched' : 'unmatched';
                        } else {
                            $status = 'pending';
                        }
                    }
                    $itemStmt->execute([
                        $docId,
                        $trackingNumber,
                        $orderId ?: null,
                        $codAmount,
                        $orderAmount,
                        $orderAmount,
                        $difference,
                        $status,
                        $companyId,
                        $createdBy ?: null,
                    ]);
                }

                $pdo->commit();
                json_response(['id' => $docId]);
            } catch (Throwable $e) {
                $pdo->rollBack();
                $code = 500;
                if (strpos($e->getMessage(), 'uniq_cod_document_company_number') !== false) {
                    $code = 409;
                }
                json_response(['error' => 'CREATE_FAILED', 'message' => $e->getMessage()], $code);
            }
            break;
        case 'PATCH':
            if (!$id) {
                json_response(['error' => 'ID_REQUIRED'], 400);
            }
            $in = json_input();
            $docStmt = $pdo->prepare('SELECT * FROM cod_documents WHERE id = ?');
            $docStmt->execute([$id]);
            $doc = $docStmt->fetch(PDO::FETCH_ASSOC);
            if (!$doc) {
                json_response(['error' => 'NOT_FOUND'], 404);
            }

            $updates = [];
            $params = [];
            $statementProvided = false;
            $statementId = $in['matched_statement_log_id'] ?? $in['statement_log_id'] ?? $in['statementLogId'] ?? null;
            if ($statementId !== null) {
                $statementProvided = true;
                if ($statementId !== '') {
                    $statementId = (int)$statementId;
                    $stmtInfo = $pdo->prepare("
                        SELECT sl.id, sb.company_id
                        FROM statement_logs sl
                        INNER JOIN statement_batchs sb ON sb.id = sl.batch_id
                        WHERE sl.id = ?
                    ");
                    $stmtInfo->execute([$statementId]);
                    $stmtRow = $stmtInfo->fetch(PDO::FETCH_ASSOC);
                    if (!$stmtRow) {
                        json_response(['error' => 'STATEMENT_NOT_FOUND'], 404);
                    }
                    if ((int)$stmtRow['company_id'] !== (int)$doc['company_id']) {
                        json_response(['error' => 'STATEMENT_COMPANY_MISMATCH'], 400);
                    }
                } else {
                    $statementId = null;
                }
                $updates[] = 'matched_statement_log_id = ?';
                $params[] = $statementId;
            }

            $statusProvided = array_key_exists('status', $in);
            if ($statusProvided) {
                $updates[] = 'status = ?';
                $params[] = (string)$in['status'];
            } elseif ($statementProvided) {
                $updates[] = 'status = ?';
                $params[] = $statementId ? 'verified' : 'pending';
            }

            if (array_key_exists('verified_by', $in) || array_key_exists('verifiedBy', $in) || array_key_exists('user_id', $in)) {
                $verifier = $in['verified_by'] ?? $in['verifiedBy'] ?? $in['user_id'] ?? null;
                $updates[] = 'verified_by = ?';
                $params[] = $verifier ? (int)$verifier : null;
            }

            $verifiedAtProvided = array_key_exists('verified_at', $in) || array_key_exists('verifiedAt', $in);
            if ($verifiedAtProvided) {
                $raw = $in['verified_at'] ?? $in['verifiedAt'];
                $verifiedAt = $raw ? date('Y-m-d H:i:s', strtotime((string)$raw)) : null;
                $updates[] = 'verified_at = ?';
                $params[] = $verifiedAt;
            } elseif ($statementProvided && $statementId) {
                $updates[] = 'verified_at = ?';
                $params[] = date('Y-m-d H:i:s');
            }

            if (empty($updates)) {
                json_response(['ok' => true]);
            }

            $updates[] = 'updated_at = NOW()';
            $params[] = $id;
            $sql = 'UPDATE cod_documents SET ' . implode(', ', $updates) . ' WHERE id = ?';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            json_response(['ok' => true]);
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

function handle_cod_records(PDO $pdo, ?string $id): void {
    // Ensure schema before any operation (covers direct cod_records API use)
    ensure_cod_schema($pdo);

    switch (method()) {
        case 'GET':
            if ($id) {
                $stmt = $pdo->prepare('SELECT * FROM cod_records WHERE id = ?');
                $stmt->execute([$id]);
                $row = $stmt->fetch();
                $row ? json_response($row) : json_response(['error' => 'NOT_FOUND'], 404);
            } else {
                $companyId = $_GET['companyId'] ?? null;
                $trackingNumber = $_GET['trackingNumber'] ?? null;
                $status = $_GET['status'] ?? null;
                $sql = 'SELECT * FROM cod_records WHERE 1=1';
                $params = [];
                if ($companyId) { $sql .= ' AND company_id = ?'; $params[] = $companyId; }
                if ($trackingNumber) { $sql .= ' AND tracking_number LIKE ?'; $params[] = '%' . $trackingNumber . '%'; }
                if ($status) { $sql .= ' AND status = ?'; $params[] = $status; }
                $sql .= ' ORDER BY created_at DESC';
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                json_response($stmt->fetchAll());
            }
            break;
        case 'POST':
            $in = json_input();
            $trackingNumber = $in['tracking_number'] ?? '';
            $orderId = $in['order_id'] ?? ($in['orderId'] ?? null);
            $deliveryStartDate = $in['delivery_start_date'] ?? null;
            $deliveryEndDate = $in['delivery_end_date'] ?? null;
            $codAmount = isset($in['cod_amount']) ? (float)$in['cod_amount'] : 0;
            $orderAmount = isset($in['order_amount']) ? (float)$in['order_amount'] : null;
            $receivedAmount = isset($in['received_amount']) ? (float)$in['received_amount'] : 0;
            if ($orderAmount === null) {
                $orderAmount = $receivedAmount;
            }
            $companyId = $in['company_id'] ?? null;
            $createdBy = $in['created_by'] ?? null;
            $documentId = $in['document_id'] ?? null;
            
            if (!$trackingNumber || !$companyId) {
                json_response(['error' => 'VALIDATION_FAILED', 'message' => 'tracking_number and company_id are required'], 400);
            }
            
            $difference = $codAmount - ($orderAmount ?? 0);
            $status = 'pending';
            if ($orderId && $orderAmount !== null && $orderAmount > 0) {
                $status = abs($difference) < 0.01 ? 'matched' : 'unmatched';
            } elseif ($receivedAmount === 0) {
                $status = 'missing';
            } elseif ($receivedAmount === $codAmount) {
                $status = 'received';
            } elseif ($receivedAmount > 0) {
                $status = 'partial';
            }
            
            $stmt = $pdo->prepare('INSERT INTO cod_records (tracking_number, order_id, delivery_start_date, delivery_end_date, cod_amount, order_amount, received_amount, difference, status, company_id, created_by, document_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
            $stmt->execute([
                $trackingNumber,
                $orderId ?: null,
                $deliveryStartDate,
                $deliveryEndDate,
                $codAmount,
                $orderAmount,
                $orderAmount ?? $receivedAmount,
                $difference,
                $status,
                $companyId,
                $createdBy,
                $documentId ?: null,
            ]);
            json_response(['id' => $pdo->lastInsertId()]);
            break;
        case 'PATCH':
            if (!$id) json_response(['error' => 'ID_REQUIRED'], 400);
            $in = json_input();
            $updates = [];
            $params = [];
            
            if (isset($in['order_id'])) {
                $updates[] = 'order_id = ?';
                $params[] = $in['order_id'] !== '' ? $in['order_id'] : null;
            }
            if (isset($in['order_amount'])) {
                $updates[] = 'order_amount = ?';
                $params[] = (float)$in['order_amount'];
            }
            if (isset($in['received_amount'])) {
                $receivedAmount = (float)$in['received_amount'];
                $updates[] = 'received_amount = ?';
                $params[] = $receivedAmount;
                
                // Recalculate difference and status
                $stmt = $pdo->prepare('SELECT cod_amount, order_amount FROM cod_records WHERE id = ?');
                $stmt->execute([$id]);
                $row = $stmt->fetch();
                if ($row) {
                    $codAmount = (float)$row['cod_amount'];
                    $orderAmount = isset($row['order_amount']) ? (float)$row['order_amount'] : $receivedAmount;
                    $difference = $codAmount - ($orderAmount ?? $receivedAmount);
                    $status = 'pending';
                    if ($receivedAmount === 0) {
                        $status = 'missing';
                    } elseif ($receivedAmount === $codAmount) {
                        $status = 'received';
                    } elseif ($receivedAmount > 0) {
                        $status = 'partial';
                    }
                    
                    $updates[] = 'difference = ?';
                    $params[] = $difference;
                    $updates[] = 'status = ?';
                    $params[] = $status;
                }
            }

            if (isset($in['order_amount']) && !isset($in['received_amount'])) {
                $stmt = $pdo->prepare('SELECT cod_amount, received_amount, order_id FROM cod_records WHERE id = ?');
                $stmt->execute([$id]);
                $row = $stmt->fetch();
                if ($row) {
                    $codAmount = (float)$row['cod_amount'];
                    $receivedAmount = isset($row['received_amount']) ? (float)$row['received_amount'] : (float)$in['order_amount'];
                    $difference = $codAmount - (float)$in['order_amount'];
                    $status = 'pending';
                    if (!empty($row['order_id'])) {
                        $status = abs($difference) < 0.01 ? 'matched' : 'unmatched';
                    } elseif ($receivedAmount === 0) {
                        $status = 'missing';
                    } elseif ($receivedAmount === $codAmount) {
                        $status = 'received';
                    } elseif ($receivedAmount > 0) {
                        $status = 'partial';
                    }
                    $updates[] = 'difference = ?';
                    $params[] = $difference;
                    $updates[] = 'status = ?';
                    $params[] = $status;
                }
            }
            
            if (isset($in['status'])) {
                $updates[] = 'status = ?';
                $params[] = $in['status'];
            }
            
            if (empty($updates)) {
                json_response(['ok' => true]);
            }
            
            $params[] = $id;
            $sql = 'UPDATE cod_records SET ' . implode(', ', $updates) . ' WHERE id = ?';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            json_response(['ok' => true]);
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

function handle_tags(PDO $pdo, ?string $id): void {
    switch (method()) {
        case 'GET':
            $type = isset($_GET['type']) ? strtoupper((string)$_GET['type']) : null;
            $userId = isset($_GET['userId']) ? (int)$_GET['userId'] : null;

            // Filter by type and owner when requested
            if ($type === 'SYSTEM') {
                $stmt = $pdo->prepare('SELECT * FROM tags WHERE type = ? ORDER BY id');
                $stmt->execute(['SYSTEM']);
                json_response($stmt->fetchAll());
                break;
            }

            if ($type === 'USER' && $userId) {
                $stmt = $pdo->prepare('SELECT t.* FROM tags t JOIN user_tags ut ON ut.tag_id = t.id WHERE t.type = ? AND ut.user_id = ? ORDER BY t.id');
                $stmt->execute(['USER', $userId]);
                json_response($stmt->fetchAll());
                break;
            }

            // Fallback: return all tags (used by admin screens)
            $stmt = $pdo->query('SELECT * FROM tags ORDER BY id');
            json_response($stmt->fetchAll());
            break;
        case 'POST':
            $in = json_input();
            $tagType = strtoupper($in['type'] ?? 'USER');
            $userId = $in['userId'] ?? null;
            $name = trim((string)($in['name'] ?? ''));
            $color = $in['color'] ?? null;

            if ($name === '') {
                json_response(['error' => 'VALIDATION_FAILED', 'message' => 'Name is required'], 400);
            }
            
            // If creating a USER tag, check limit (10 tags per user)
            if ($tagType === 'USER' && $userId) {
                $countStmt = $pdo->prepare('SELECT COUNT(*) FROM user_tags WHERE user_id = ?');
                $countStmt->execute([$userId]);
                $tagCount = (int)$countStmt->fetchColumn();
                if ($tagCount >= 10) {
                    json_response(['error' => 'TAG_LIMIT_REACHED', 'message' => 'User has reached the maximum limit of 10 tags'], 400);
                    return;
                }
            }

            // Check for existing tag with the same name/type
            $existingStmt = $pdo->prepare('SELECT id FROM tags WHERE name = ? AND type = ? LIMIT 1');
            $existingStmt->execute([$name, $tagType]);
            $existingId = (int)$existingStmt->fetchColumn();

            if ($existingId) {
                // If USER tag, ensure link exists
                if ($tagType === 'USER' && $userId) {
                    $linkCheck = $pdo->prepare('SELECT 1 FROM user_tags WHERE user_id = ? AND tag_id = ?');
                    $linkCheck->execute([$userId, $existingId]);
                    if (!$linkCheck->fetchColumn()) {
                        // Re-check quota before linking
                        $countStmt = $pdo->prepare('SELECT COUNT(*) FROM user_tags WHERE user_id = ?');
                        $countStmt->execute([$userId]);
                        $tagCount = (int)$countStmt->fetchColumn();
                        if ($tagCount >= 10) {
                            json_response(['error' => 'TAG_LIMIT_REACHED', 'message' => 'User has reached the maximum limit of 10 tags'], 400);
                            return;
                        }

                        $linkStmt = $pdo->prepare('INSERT INTO user_tags (user_id, tag_id) VALUES (?, ?)');
                        $linkStmt->execute([$userId, $existingId]);
                    }
                }
                json_response(['id' => $existingId, 'existing' => true]);
                break;
            }
            
            $stmt = $pdo->prepare('INSERT INTO tags (name, type, color) VALUES (?, ?, ?)');
            $stmt->execute([
                $name, 
                $tagType,
                $color ?? null
            ]);
            $tagId = (int)$pdo->lastInsertId();
            
            // If creating a USER tag, link it to the user in user_tags table
            if ($tagType === 'USER' && $userId) {
                try {
                    $linkStmt = $pdo->prepare('INSERT INTO user_tags (user_id, tag_id) VALUES (?, ?)');
                    $linkStmt->execute([$userId, $tagId]);
                } catch (Throwable $e) {
                    // If linking fails, delete the tag we just created
                    $pdo->prepare('DELETE FROM tags WHERE id = ?')->execute([$tagId]);
                    json_response(['error' => 'LINK_FAILED', 'message' => $e->getMessage()], 500);
                    return;
                }
            }
            
            json_response(['id' => $tagId]);
            break;
        case 'PUT':
        case 'PATCH':
            if (!$id) json_response(['error' => 'ID_REQUIRED'], 400);
            try {
                $in = json_input();
                $updates = [];
                $params = [];
                
                if (isset($in['name'])) {
                    $updates[] = 'name = ?';
                    $params[] = $in['name'];
                }
                if (isset($in['color'])) {
                    $updates[] = 'color = ?';
                    $params[] = $in['color'];
                }
                
                if (empty($updates)) {
                    json_response(['error' => 'NO_UPDATES'], 400);
                    return;
                }
                
                $params[] = $id;
                $stmt = $pdo->prepare('UPDATE tags SET ' . implode(', ', $updates) . ' WHERE id = ?');
                $stmt->execute($params);
                json_response(['ok' => true]);
            } catch (Throwable $e) {
                json_response(['error' => 'UPDATE_FAILED', 'message' => $e->getMessage()], 500);
            }
            break;
        case 'DELETE':
            if (!$id) json_response(['error' => 'ID_REQUIRED'], 400);
            $tagId = (int)$id;
            if ($tagId <= 0) json_response(['error' => 'INVALID_ID'], 400);
            try {
                $pdo->beginTransaction();

                // First check if tag exists
                $checkStmt = $pdo->prepare('SELECT id, name, type FROM tags WHERE id = ?');
                $checkStmt->execute([$tagId]);
                $tag = $checkStmt->fetch(PDO::FETCH_ASSOC);
                
                if (!$tag) {
                    $pdo->rollBack();
                    json_response(['error' => 'NOT_FOUND'], 404);
                    return;
                }

                // Clean up tag references manually (in case foreign key cascade doesn't work)
                // This ensures data is cleaned up even if CASCADE constraints are missing
                $customerTagsStmt = $pdo->prepare('DELETE FROM customer_tags WHERE tag_id = ?');
                $customerTagsStmt->execute([$tagId]);
                $customerTagsDeleted = $customerTagsStmt->rowCount();
                
                $userTagsStmt = $pdo->prepare('DELETE FROM user_tags WHERE tag_id = ?');
                $userTagsStmt->execute([$tagId]);
                $userTagsDeleted = $userTagsStmt->rowCount();

                // Finally delete the tag itself
                // Foreign key CASCADE should handle the above, but we do it manually to be sure
                $stmt = $pdo->prepare('DELETE FROM tags WHERE id = ?');
                $stmt->execute([$tagId]);
                
                $deletedRows = $stmt->rowCount();

                if ($deletedRows === 0) {
                    $pdo->rollBack();
                    json_response(['error' => 'DELETE_FAILED', 'message' => 'Tag could not be deleted'], 500);
                    return;
                }

                $pdo->commit();
                json_response([
                    'ok' => true,
                    'deleted' => [
                        'tag' => true,
                        'customer_tags' => $customerTagsDeleted,
                        'user_tags' => $userTagsDeleted
                    ]
                ]);
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) {
                    $pdo->rollBack();
                }
                error_log("Tag deletion failed for tag_id=$tagId: " . $e->getMessage());
                json_response(['error' => 'DELETE_FAILED', 'message' => $e->getMessage()], 500);
            }
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

function handle_customer_tags(PDO $pdo): void {
    switch (method()) {
        case 'GET':
            try {
                $customerId = $_GET['customerId'] ?? null;
                if ($customerId) {
                    $stmt = $pdo->prepare('SELECT ct.customer_id, t.id, t.name, t.type, t.color FROM customer_tags ct JOIN tags t ON t.id=ct.tag_id WHERE ct.customer_id=? ORDER BY t.name');
                    $stmt->execute([$customerId]);
                    json_response($stmt->fetchAll());
                } else {
                    $stmt = $pdo->query('SELECT ct.customer_id, t.id, t.name, t.type, t.color FROM customer_tags ct JOIN tags t ON t.id=ct.tag_id ORDER BY ct.customer_id, t.name');
                    json_response($stmt->fetchAll());
                }
            } catch (Throwable $e) {
                json_response(['error' => 'QUERY_FAILED', 'message' => $e->getMessage()], 500);
            }
            break;
        case 'POST':
            try {
                $in = json_input();
                $stmt = $pdo->prepare('INSERT INTO customer_tags (customer_id, tag_id) VALUES (?, ?)');
                $stmt->execute([$in['customerId'] ?? '', $in['tagId'] ?? 0]);
                json_response(['ok' => true]);
            } catch (Throwable $e) {
                json_response(['error' => 'INSERT_FAILED', 'message' => $e->getMessage()], 500);
            }
            break;
        case 'DELETE':
            try {
                $customerId = $_GET['customerId'] ?? '';
                $tagId = $_GET['tagId'] ?? '';
                if ($customerId === '' || $tagId === '') json_response(['error' => 'MISSING_PARAMS'], 400);
                $stmt = $pdo->prepare('DELETE FROM customer_tags WHERE customer_id=? AND tag_id=?');
                $stmt->execute([$customerId, $tagId]);
                json_response(['ok' => true]);
            } catch (Throwable $e) {
                json_response(['error' => 'DELETE_FAILED', 'message' => $e->getMessage()], 500);
            }
            break;
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
                $sql = 'SELECT a.* FROM activities a';
                $params = [];
                if ($cid) {
                    // ถ้าเป็นตัวเลข ให้ query ด้วย customer_id โดยตรง
                    // ถ้าเป็น string ให้ join กับ customers เพื่อหา customer_id จาก customer_ref_id
                    if (is_numeric($cid)) {
                        $sql .= ' WHERE a.customer_id=?';
                        $params[] = (int)$cid;
                    } else {
                        // หา customer_id จาก customer_ref_id
                        $findStmt = $pdo->prepare('SELECT customer_id FROM customers WHERE customer_ref_id = ? OR customer_id = ? LIMIT 1');
                        $findStmt->execute([$cid, is_numeric($cid) ? (int)$cid : null]);
                        $customer = $findStmt->fetch();
                        if ($customer && $customer['customer_id']) {
                            $sql .= ' WHERE a.customer_id=?';
                            $params[] = (int)$customer['customer_id'];
                        } else {
                            // ถ้าหาไม่เจอ ให้ return empty array
                            json_response([]);
                            return;
                        }
                    }
                }
                $sql .= ' ORDER BY a.timestamp DESC';
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

function handle_customer_logs(PDO $pdo, ?string $id): void {
    if (method() !== 'GET') {
        json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
        return;
    }

    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
    if ($limit <= 0) {
        $limit = 50;
    } elseif ($limit > 200) {
        $limit = 200;
    }

    if ($id) {
        $stmt = $pdo->prepare(
            'SELECT cl.*, CONCAT(u.first_name, " ", u.last_name) AS created_by_name
             FROM customer_logs cl
             LEFT JOIN users u ON cl.created_by = u.id
             WHERE cl.id = ?'
        );
        $stmt->execute([$id]);
        $row = $stmt->fetch();
        $row ? json_response($row) : json_response(['error' => 'NOT_FOUND'], 404);
        return;
    }

    $customerId = $_GET['customerId'] ?? null;
    $params = [];
    $sql = 'SELECT cl.*, CONCAT(u.first_name, " ", u.last_name) AS created_by_name
            FROM customer_logs cl
            LEFT JOIN users u ON cl.created_by = u.id';
    if ($customerId) {
        $sql .= ' WHERE cl.customer_id = ?';
        $params[] = $customerId;
    }
    $sql .= ' ORDER BY cl.created_at DESC LIMIT ' . $limit;
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    json_response($stmt->fetchAll());
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
                   (SELECT COUNT(*) FROM appointments a WHERE a.customer_id = c.customer_id AND a.status != 'เสร็จสิ้น' AND a.date <= ?) as upcoming_appointments,
                   (SELECT COUNT(*) FROM activities act WHERE act.customer_id = c.customer_id) as activity_count
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


function handle_suppliers(PDO $pdo, ?string $id): void {
    switch (method()) {
        case 'GET':
            if ($id) {
                $stmt = $pdo->prepare('SELECT * FROM suppliers WHERE id = ?');
                $stmt->execute([$id]);
                $row = $stmt->fetch();
                $row ? json_response($row) : json_response(['error' => 'NOT_FOUND'], 404);
            } else {
                $companyId = $_GET['companyId'] ?? null;
                $sql = 'SELECT * FROM suppliers';
                $params = [];
                if ($companyId) { $sql .= ' WHERE company_id = ?'; $params[] = $companyId; }
                $sql .= ' ORDER BY id DESC';
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                json_response($stmt->fetchAll());
            }
            break;
        case 'POST':
            $in = json_input();
            $code = trim((string)($in['code'] ?? ''));
            $name = trim((string)($in['name'] ?? ''));
            $companyId = $in['companyId'] ?? null;
            if ($code === '' || $name === '' || !$companyId) {
                json_response(['error' => 'VALIDATION_FAILED', 'message' => 'code, name, companyId are required'], 400);
            }
            $contactPerson = $in['contactPerson'] ?? null;
            $phone = $in['phone'] ?? null;
            $email = $in['email'] ?? null;
            $address = $in['address'] ?? null;
            $province = $in['province'] ?? null;
            $taxId = $in['taxId'] ?? null;
            $paymentTerms = $in['paymentTerms'] ?? null;
            $creditLimit = $in['creditLimit'] ?? null;
            $isActive = isset($in['isActive']) ? ($in['isActive'] ? 1 : 0) : 1;
            $notes = $in['notes'] ?? null;
            $stmt = $pdo->prepare('INSERT INTO suppliers (code, name, contact_person, phone, email, address, province, tax_id, payment_terms, credit_limit, company_id, is_active, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
            $stmt->execute([$code, $name, $contactPerson, $phone, $email, $address, $province, $taxId, $paymentTerms, $creditLimit, $companyId, $isActive, $notes]);
            json_response(['id' => $pdo->lastInsertId()], 201);
            break;
        case 'PATCH':
            if (!$id) json_response(['error' => 'ID_REQUIRED'], 400);
            $in = json_input();
            $updates = [];
            $params = [];
            $map = [
                'code' => 'code',
                'name' => 'name',
                'contactPerson' => 'contact_person',
                'phone' => 'phone',
                'email' => 'email',
                'address' => 'address',
                'province' => 'province',
                'taxId' => 'tax_id',
                'paymentTerms' => 'payment_terms',
                'creditLimit' => 'credit_limit',
                'companyId' => 'company_id',
                'notes' => 'notes',
            ];
            foreach ($map as $inKey => $col) {
                if (array_key_exists($inKey, $in)) {
                    $updates[] = "$col = ?";
                    $params[] = $in[$inKey];
                }
            }
            if (isset($in['isActive'])) { $updates[] = 'is_active = ?'; $params[] = $in['isActive'] ? 1 : 0; }
            if (empty($updates)) json_response(['ok' => true]);
            $params[] = $id;
            $sql = 'UPDATE suppliers SET ' . implode(', ', $updates) . ' WHERE id = ?';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            json_response(['ok' => true]);
            break;
        case 'DELETE':
            if (!$id) json_response(['error' => 'ID_REQUIRED'], 400);
            $stmt = $pdo->prepare('DELETE FROM suppliers WHERE id = ?');
            $stmt->execute([$id]);
            json_response(['ok' => true]);
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

function handle_purchases(PDO $pdo, ?string $id, ?string $action = null): void {
    if ($action === 'receive' && method() === 'POST') {
        if (!$id) json_response(['error' => 'ID_REQUIRED'], 400);
        $in = json_input();
        $receivedDate = $in['receivedDate'] ?? date('Y-m-d');
        $items = is_array($in['items'] ?? null) ? $in['items'] : [];
        if (empty($items)) json_response(['error' => 'NO_ITEMS'], 400);
        // Load purchase
        $pstmt = $pdo->prepare('SELECT * FROM purchases WHERE id = ?');
        $pstmt->execute([$id]);
        $purchase = $pstmt->fetch();
        if (!$purchase) json_response(['error' => 'NOT_FOUND'], 404);
        $warehouseId = (int)$purchase['warehouse_id'];
        $supplierId = (int)$purchase['supplier_id'];
        $purchaseDate = $purchase['purchase_date'];

        try {
            $pdo->beginTransaction();
            foreach ($items as $it) {
                $productId = (int)($it['productId'] ?? 0);
                $qty = (float)($it['quantity'] ?? 0);
                $lotNumber = trim((string)($it['lotNumber'] ?? ''));
                $expiryDate = $it['expiryDate'] ?? null;
                $unitCostOverride = isset($it['unitCost']) ? (float)$it['unitCost'] : null;
                if ($productId <= 0 || $qty <= 0 || $lotNumber === '') {
                    throw new RuntimeException('INVALID_ITEM');
                }
                // Fetch unit cost from purchase_items if not provided
                $uc = $unitCostOverride;
                if ($uc === null) {
                    $ucstmt = $pdo->prepare('SELECT unit_cost FROM purchase_items WHERE purchase_id = ? AND product_id = ? LIMIT 1');
                    $ucstmt->execute([$id, $productId]);
                    $row = $ucstmt->fetch();
                    $uc = $row ? (float)$row['unit_cost'] : 0.0;
                }

                // Upsert product_lots
                $lotIns = $pdo->prepare('INSERT INTO product_lots (lot_number, product_id, warehouse_id, purchase_date, expiry_date, quantity_received, quantity_remaining, unit_cost, supplier_id, status, notes) VALUES (?,?,?,?,?,?,?,?,?,"Active", NULL) ON DUPLICATE KEY UPDATE quantity_received = quantity_received + VALUES(quantity_received), quantity_remaining = quantity_remaining + VALUES(quantity_remaining), unit_cost = VALUES(unit_cost), expiry_date = COALESCE(VALUES(expiry_date), expiry_date)');
                $lotIns->execute([$lotNumber, $productId, $warehouseId, $purchaseDate ?: date('Y-m-d'), $expiryDate, $qty, $qty, $uc, $supplierId]);

                // Upsert warehouse_stocks by warehouse/product/lot
                $sel = $pdo->prepare('SELECT id, quantity FROM warehouse_stocks WHERE warehouse_id = ? AND product_id = ? AND lot_number = ? LIMIT 1');
                $sel->execute([$warehouseId, $productId, $lotNumber]);
                $ws = $sel->fetch();
                if ($ws) {
                    $upd = $pdo->prepare('UPDATE warehouse_stocks SET quantity = quantity + ?, expiry_date = COALESCE(?, expiry_date), purchase_price = COALESCE(?, purchase_price) WHERE id = ?');
                    $upd->execute([(int)$qty, $expiryDate, $uc, $ws['id']]);
                } else {
                    $ins = $pdo->prepare('INSERT INTO warehouse_stocks (warehouse_id, product_id, lot_number, quantity, reserved_quantity, expiry_date, purchase_price, created_at) VALUES (?, ?, ?, ?, 0, ?, ?, NOW())');
                    $ins->execute([$warehouseId, $productId, $lotNumber, (int)$qty, $expiryDate, $uc]);
                }

                // Stock movement (IN)
                $mv = $pdo->prepare('INSERT INTO stock_movements (warehouse_id, product_id, movement_type, quantity, lot_number, reference_type, reference_id, reason, created_by, created_at) VALUES (?, ?, "IN", ?, ?, "PURCHASE", ?, "Receive", ?, NOW())');
                $mv->execute([$warehouseId, $productId, (int)$qty, $lotNumber, $id, 1]);

                // Update purchase_items received
                if (isset($it['purchaseItemId'])) {
                    $piId = (int)$it['purchaseItemId'];
                    if ($piId > 0) {
                        $pu = $pdo->prepare('UPDATE purchase_items SET received_quantity = received_quantity + ? WHERE id = ?');
                        $pu->execute([$qty, $piId]);
                    }
                } else {
                    $pu = $pdo->prepare('UPDATE purchase_items SET received_quantity = received_quantity + ?, lot_number = COALESCE(?, lot_number) WHERE purchase_id = ? AND product_id = ?');
                    $pu->execute([$qty, $lotNumber, $id, $productId]);
                }
            }

            // Update purchase header
            $pdo->prepare('UPDATE purchases SET received_date = ?, status = (SELECT CASE WHEN SUM(quantity) > SUM(received_quantity) THEN "Partial" ELSE "Received" END FROM purchase_items WHERE purchase_id = ?) WHERE id = ?')
                ->execute([$receivedDate, $id, $id]);

            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            json_response(['error' => 'RECEIVE_FAILED', 'message' => $e->getMessage()], 400);
        }

        // Return updated purchase with items
        $get = $pdo->prepare('SELECT * FROM purchases WHERE id = ?');
        $get->execute([$id]);
        $p = $get->fetch();
        $itemsStmt = $pdo->prepare('SELECT * FROM purchase_items WHERE purchase_id = ?');
        $itemsStmt->execute([$id]);
        $p['items'] = $itemsStmt->fetchAll();
        json_response($p);
        return;
    }

    switch (method()) {
        case 'GET':
            if ($id) {
                $stmt = $pdo->prepare('SELECT * FROM purchases WHERE id = ?');
                $stmt->execute([$id]);
                $row = $stmt->fetch();
                if (!$row) json_response(['error' => 'NOT_FOUND'], 404);
                $items = $pdo->prepare('SELECT * FROM purchase_items WHERE purchase_id = ?');
                $items->execute([$id]);
                $row['items'] = $items->fetchAll();
                json_response($row);
            } else {
                $params = [];
                $sql = 'SELECT p.* FROM purchases p';
                $w = [];
                if (isset($_GET['companyId'])) { $w[] = 'p.company_id = ?'; $params[] = $_GET['companyId']; }
                if (isset($_GET['supplierId'])) { $w[] = 'p.supplier_id = ?'; $params[] = $_GET['supplierId']; }
                if (isset($_GET['warehouseId'])) { $w[] = 'p.warehouse_id = ?'; $params[] = $_GET['warehouseId']; }
                if (isset($_GET['status'])) { $w[] = 'p.status = ?'; $params[] = $_GET['status']; }
                if ($w) { $sql .= ' WHERE ' . implode(' AND ', $w); }
                $sql .= ' ORDER BY p.id DESC';
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $rows = $stmt->fetchAll();
                json_response($rows);
            }
            break;
        case 'POST':
            $in = json_input();
            $purchaseNumber = $in['purchaseNumber'] ?? '';
            $supplierId = $in['supplierId'] ?? null;
            $warehouseId = $in['warehouseId'] ?? null;
            $companyId = $in['companyId'] ?? null;
            $purchaseDate = $in['purchaseDate'] ?? date('Y-m-d');
            $expectedDate = $in['expectedDeliveryDate'] ?? null;
            $notes = $in['notes'] ?? null;
            $items = is_array($in['items'] ?? null) ? $in['items'] : [];
            if (!$purchaseNumber || !$supplierId || !$warehouseId || !$companyId || empty($items)) {
                json_response(['error' => 'VALIDATION_FAILED', 'message' => 'purchaseNumber, supplierId, warehouseId, companyId, items required'], 400);
            }
            try {
                $pdo->beginTransaction();
                $ins = $pdo->prepare('INSERT INTO purchases (purchase_number, supplier_id, warehouse_id, company_id, purchase_date, expected_delivery_date, status, payment_status, payment_method, notes, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
                $ins->execute([$purchaseNumber, $supplierId, $warehouseId, $companyId, $purchaseDate, $expectedDate, 'Ordered', 'Unpaid', null, $notes, null]);
                $pid = (int)$pdo->lastInsertId();
                $total = 0.0;
                $pi = $pdo->prepare('INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_cost, notes) VALUES (?,?,?,?,?)');
                foreach ($items as $it) {
                    $prod = (int)($it['productId'] ?? 0);
                    $qty = (float)($it['quantity'] ?? 0);
                    $uc = (float)($it['unitCost'] ?? 0);
                    $note = $it['notes'] ?? null;
                    if ($prod <= 0 || $qty <= 0) throw new RuntimeException('INVALID_ITEM');
                    $pi->execute([$pid, $prod, $qty, $uc, $note]);
                    $total += ($qty * $uc);
                }
                $upd = $pdo->prepare('UPDATE purchases SET total_amount = ? WHERE id = ?');
                $upd->execute([$total, $pid]);
                $pdo->commit();
                json_response(['id' => $pid], 201);
            } catch (Throwable $e) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                json_response(['error' => 'CREATE_FAILED', 'message' => $e->getMessage()], 500);
            }
            break;
        case 'PATCH':
            if (!$id) json_response(['error' => 'ID_REQUIRED'], 400);
            $in = json_input();
            $updates = [];
            $params = [];
            $map = [
                'purchaseNumber' => 'purchase_number',
                'supplierId' => 'supplier_id',
                'warehouseId' => 'warehouse_id',
                'companyId' => 'company_id',
                'purchaseDate' => 'purchase_date',
                'expectedDeliveryDate' => 'expected_delivery_date',
                'receivedDate' => 'received_date',
                'totalAmount' => 'total_amount',
                'status' => 'status',
                'paymentStatus' => 'payment_status',
                'paymentMethod' => 'payment_method',
                'notes' => 'notes',
            ];
            foreach ($map as $inKey => $col) {
                if (array_key_exists($inKey, $in)) { $updates[] = "$col = ?"; $params[] = $in[$inKey]; }
            }
            if (empty($updates)) json_response(['ok' => true]);
            $params[] = $id;
            $sql = 'UPDATE purchases SET ' . implode(', ', $updates) . ' WHERE id = ?';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            json_response(['ok' => true]);
            break;
        case 'DELETE':
            if (!$id) json_response(['error' => 'ID_REQUIRED'], 400);
            $stmt = $pdo->prepare('DELETE FROM purchases WHERE id = ?');
            $stmt->execute([$id]);
            json_response(['ok' => true]);
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

function handle_warehouse_stocks(PDO $pdo, ?string $id): void {
    if (method() === 'GET') {
        if ($id) {
            $stmt = $pdo->prepare('SELECT * FROM warehouse_stocks WHERE id = ?');
            $stmt->execute([$id]);
            $row = $stmt->fetch();
            $row ? json_response($row) : json_response(['error' => 'NOT_FOUND'], 404);
            return;
        }
        $params = [];
        $w = [];
        $sql = 'SELECT ws.* FROM warehouse_stocks ws';
        if (isset($_GET['warehouseId'])) { $w[] = 'ws.warehouse_id = ?'; $params[] = $_GET['warehouseId']; }
        if (isset($_GET['productId'])) { $w[] = 'ws.product_id = ?'; $params[] = $_GET['productId']; }
        if (isset($_GET['lotNumber'])) { $w[] = 'ws.lot_number = ?'; $params[] = $_GET['lotNumber']; }
        if ($w) { $sql .= ' WHERE ' . implode(' AND ', $w); }
        $sql .= ' ORDER BY ws.warehouse_id, ws.product_id, ws.lot_number';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        json_response($stmt->fetchAll());
    } else {
        json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

function handle_product_lots(PDO $pdo, ?string $id): void {
    if (method() === 'GET') {
        if ($id) {
            $stmt = $pdo->prepare('SELECT * FROM product_lots WHERE id = ?');
            $stmt->execute([$id]);
            $row = $stmt->fetch();
            $row ? json_response($row) : json_response(['error' => 'NOT_FOUND'], 404);
            return;
        }
        $params = [];
        $w = [];
        $sql = 'SELECT * FROM product_lots';
        if (isset($_GET['warehouseId'])) { $w[] = 'warehouse_id = ?'; $params[] = $_GET['warehouseId']; }
        if (isset($_GET['productId'])) { $w[] = 'product_id = ?'; $params[] = $_GET['productId']; }
        if (isset($_GET['status'])) { $w[] = 'status = ?'; $params[] = $_GET['status']; }
        if (isset($_GET['lotNumber'])) { $w[] = 'lot_number = ?'; $params[] = $_GET['lotNumber']; }
        if ($w) { $sql .= ' WHERE ' . implode(' AND ', $w); }
        $sql .= ' ORDER BY purchase_date DESC, id DESC';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        json_response($stmt->fetchAll());
    } elseif (method() === 'POST') {
        // Create new product lot
        $in = json_input();

        // Validate required fields
        if (empty($in['lot_number']) || empty($in['product_id']) || empty($in['warehouse_id']) || empty($in['quantity_received'])) {
            json_response(['error' => 'Missing required fields: lot_number, product_id, warehouse_id, quantity_received'], 400);
            return;
        }

        // Check if lot number already exists for this product
        $checkStmt = $pdo->prepare('SELECT id FROM product_lots WHERE lot_number = ? AND product_id = ?');
        $checkStmt->execute([$in['lot_number'], $in['product_id']]);
        if ($checkStmt->fetch()) {
            json_response(['error' => 'Lot number already exists for this product'], 409);
            return;
        }

        // Insert new lot
        $stmt = $pdo->prepare('
            INSERT INTO product_lots (
                lot_number, product_id, warehouse_id, purchase_date, expiry_date,
                quantity_received, quantity_remaining, unit_cost, status, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ');

        $stmt->execute([
            $in['lot_number'],
            $in['product_id'],
            $in['warehouse_id'],
            $in['purchase_date'] ?? date('Y-m-d'),
            $in['expiry_date'] ?? null,
            $in['quantity_received'],
            $in['quantity_received'], // Initial remaining quantity is the same as received
            $in['unit_cost'] ?? 0,
            $in['status'] ?? 'Active',
            $in['notes'] ?? null
        ]);

        // Update warehouse stock
        $updateStockStmt = $pdo->prepare('
            INSERT INTO warehouse_stocks (warehouse_id, product_id, lot_number, quantity, expiry_date, purchase_price, selling_price)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            quantity = quantity + VALUES(quantity),
            expiry_date = VALUES(expiry_date),
            purchase_price = VALUES(purchase_price)
        ');

        $updateStockStmt->execute([
            $in['warehouse_id'],
            $in['product_id'],
            $in['lot_number'],
            $in['quantity_received'],
            $in['expiry_date'] ?? null,
            $in['unit_cost'] ?? 0,
            0 // selling_price - would need to get from product table
        ]);

        // Create stock movement record
        $movementStmt = $pdo->prepare('
            INSERT INTO stock_movements (
                warehouse_id, product_id, lot_number, movement_type, quantity,
                reference_type, reference_id, notes, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ');

        $movementStmt->execute([
            $in['warehouse_id'],
            $in['product_id'],
            $in['lot_number'],
            'IN',
            $in['quantity_received'],
            'LOT',
            $pdo->lastInsertId(),
            $in['notes'] ?? 'Initial stock in'
        ]);

        json_response(['id' => $pdo->lastInsertId()], 201);
    } elseif (method() === 'PUT' && $id) {
        // Update existing product lot
        $in = json_input();

        // Get current lot data
        $currentStmt = $pdo->prepare('SELECT * FROM product_lots WHERE id = ?');
        $currentStmt->execute([$id]);
        $current = $currentStmt->fetch();

        if (!$current) {
            json_response(['error' => 'Lot not found'], 404);
            return;
        }

        // Build update query
        $updateFields = [];
        $updateValues = [];

        if (isset($in['expiry_date'])) {
            $updateFields[] = 'expiry_date = ?';
            $updateValues[] = $in['expiry_date'];
        }

        if (isset($in['unit_cost'])) {
            $updateFields[] = 'unit_cost = ?';
            $updateValues[] = $in['unit_cost'];
        }

        if (isset($in['status'])) {
            $updateFields[] = 'status = ?';
            $updateValues[] = $in['status'];
        }

        if (isset($in['notes'])) {
            $updateFields[] = 'notes = ?';
            $updateValues[] = $in['notes'];
        }

        if (empty($updateFields)) {
            json_response(['error' => 'No fields to update'], 400);
            return;
        }

        $updateFields[] = 'updated_at = NOW()';
        $updateValues[] = $id;

        $updateSql = 'UPDATE product_lots SET ' . implode(', ', $updateFields) . ' WHERE id = ?';
        $updateStmt = $pdo->prepare($updateSql);
        $updateStmt->execute($updateValues);

        json_response(['success' => true]);
    } elseif (method() === 'DELETE' && $id) {
        // Delete product lot
        $stmt = $pdo->prepare('SELECT * FROM product_lots WHERE id = ?');
        $stmt->execute([$id]);
        $lot = $stmt->fetch();

        if (!$lot) {
            json_response(['error' => 'Lot not found'], 404);
            return;
        }

        // Check if lot has been used (quantity remaining < quantity received)
        if ($lot['quantity_remaining'] < $lot['quantity_received']) {
            json_response(['error' => 'Cannot delete lot that has been used'], 409);
            return;
        }

        // Delete the lot
        $deleteStmt = $pdo->prepare('DELETE FROM product_lots WHERE id = ?');
        $deleteStmt->execute([$id]);

        // Update warehouse stock
        $updateStockStmt = $pdo->prepare('
            UPDATE warehouse_stocks
            SET quantity = quantity - ?
            WHERE warehouse_id = ? AND product_id = ? AND lot_number = ?
        ');

        $updateStockStmt->execute([
            $lot['quantity_remaining'],
            $lot['warehouse_id'],
            $lot['product_id'],
            $lot['lot_number']
        ]);

        // Create stock movement record
        $movementStmt = $pdo->prepare('
            INSERT INTO stock_movements (
                warehouse_id, product_id, lot_number, movement_type, quantity,
                reference_type, reference_id, notes, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ');

        $movementStmt->execute([
            $lot['warehouse_id'],
            $lot['product_id'],
            $lot['lot_number'],
            'OUT',
            $lot['quantity_remaining'],
            'LOT',
            $id,
            'Lot deletion'
        ]);

        json_response(['success' => true]);
    } else {
        json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

function handle_stock_movements(PDO $pdo, ?string $id): void {
    if (method() === 'GET') {
        if ($id) {
            $stmt = $pdo->prepare('SELECT * FROM stock_movements WHERE id = ?');
            $stmt->execute([$id]);
            $row = $stmt->fetch();
            $row ? json_response($row) : json_response(['error' => 'NOT_FOUND'], 404);
            return;
        }
        $params = [];
        $w = [];
        $sql = 'SELECT * FROM stock_movements';
        if (isset($_GET['warehouseId'])) { $w[] = 'warehouse_id = ?'; $params[] = $_GET['warehouseId']; }
        if (isset($_GET['productId'])) { $w[] = 'product_id = ?'; $params[] = $_GET['productId']; }
        if (isset($_GET['lotNumber'])) { $w[] = 'lot_number = ?'; $params[] = $_GET['lotNumber']; }
        if (isset($_GET['type'])) { $w[] = 'movement_type = ?'; $params[] = $_GET['type']; }
        if ($w) { $sql .= ' WHERE ' . implode(' AND ', $w); }
        $sql .= ' ORDER BY created_at DESC, id DESC';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        json_response($stmt->fetchAll());
    } else {
        json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

function handle_user_login_history(PDO $pdo, ?string $id): void {
    switch (method()) {
        case 'GET':
            if ($id) {
                // Get specific login history record
                $stmt = $pdo->prepare('SELECT * FROM user_login_history WHERE id = ?');
                $stmt->execute([$id]);
                $row = $stmt->fetch();
                $row ? json_response($row) : json_response(['error' => 'NOT_FOUND'], 404);
            } else {
                // Get login history with filters
                $userId = $_GET['userId'] ?? null;
                $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
                $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;

                $sql = 'SELECT h.*, u.username, u.first_name, u.last_name
                        FROM user_login_history h
                        JOIN users u ON h.user_id = u.id';
                $params = [];
                $conditions = [];

                if ($userId) {
                    $conditions[] = 'h.user_id = ?';
                    $params[] = $userId;
                }

                if (!empty($conditions)) {
                    $sql .= ' WHERE ' . implode(' AND ', $conditions);
                }

                $sql .= ' ORDER BY h.login_time DESC LIMIT ? OFFSET ?';
                $params[] = $limit;
                $params[] = $offset;

                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                json_response($stmt->fetchAll());
            }
            break;
        case 'POST':
            // Record logout time
            $in = json_input();
            $historyId = $in['historyId'] ?? null;
            if (!$historyId) json_response(['error' => 'HISTORY_ID_REQUIRED'], 400);

            try {
                $stmt = $pdo->prepare('SELECT login_time FROM user_login_history WHERE id = ? AND logout_time IS NULL');
                $stmt->execute([$historyId]);
                $record = $stmt->fetch();

                if (!$record) {
                    json_response(['error' => 'INVALID_HISTORY_ID'], 404);
                }

                $loginTime = new DateTime($record['login_time']);
                $logoutTime = new DateTime();
                $duration = $logoutTime->getTimestamp() - $loginTime->getTimestamp();

                $updateStmt = $pdo->prepare('UPDATE user_login_history SET logout_time = NOW(), session_duration = ? WHERE id = ?');
                $updateStmt->execute([$duration, $historyId]);

                json_response(['ok' => true]);
            } catch (Throwable $e) {
                json_response(['error' => 'UPDATE_FAILED', 'message' => $e->getMessage()], 500);
            }
            break;
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}


function handle_attendance(PDO $pdo, ?string $id, ?string $action): void {
    switch (method()) {
        case 'GET':
            // Parameters
            $userId = isset($_GET['userId']) ? (int)$_GET['userId'] : null;
            $companyId = isset($_GET['companyId']) ? (int)$_GET['companyId'] : null;
            $date = $_GET['date'] ?? null;         // yyyy-mm-dd
            $start = $_GET['start'] ?? null;       // yyyy-mm-dd
            $end = $_GET['end'] ?? null;           // yyyy-mm-dd
            $roleOnly = $_GET['roleOnly'] ?? 'telesale'; // telesale|all

            // On-demand recompute to include ongoing sessions (COALESCE(logout_time, NOW()))
            try {
                if ($date) {
                    $stmt = $pdo->prepare('CALL sp_compute_daily_attendance(?)');
                    $stmt->execute([$date]);
                }
            } catch (Throwable $e) {
                json_response(['error' => 'ATTENDANCE_SP_MISSING', 'message' => $e->getMessage()], 500);
            }

            // Choose view/source
            $isKpis = ($id === 'kpis' || $action === 'kpis');
            $base = $isKpis ? 'v_user_daily_kpis' : 'v_user_daily_attendance';
            $sql = "SELECT * FROM {$base} WHERE 1";
            $params = [];

            if ($userId) { $sql .= ' AND user_id = ?'; $params[] = $userId; }
            if ($date) { $sql .= ' AND work_date = ?'; $params[] = $date; }
            if ($start && $end) { $sql .= ' AND work_date BETWEEN ? AND ?'; $params[] = $start; $params[] = $end; }
            if ($roleOnly !== 'all') { $sql .= " AND role IN ('Telesale','Supervisor Telesale')"; }
            if ($companyId) { $sql .= ' AND user_id IN (SELECT id FROM users WHERE company_id = ?)'; $params[] = $companyId; }

            $sql .= ' ORDER BY work_date DESC, user_id';
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            json_response($stmt->fetchAll());

        case 'POST':
            // Sub-actions: /attendance/check_in
            if ($id === 'check_in') {
                $in = json_input();
                $userId = isset($in['userId']) ? (int)$in['userId'] : null;
                if (!$userId) { json_response(['error' => 'USER_ID_REQUIRED'], 400); }
                // Guard: ensure user is active and allowed to track attendance
                $uStmt = $pdo->prepare("SELECT role, status FROM users WHERE id = ?");
                $uStmt->execute([$userId]);
                $user = $uStmt->fetch();
                if (!$user) { json_response(['error' => 'NOT_FOUND'], 404); }
                if ($user['status'] !== 'active') {
                    json_response(['error' => 'FORBIDDEN_ROLE'], 403);
                }
                $allowedRoles = [
                    'Admin Page',
                    'Telesale',
                    'Supervisor Telesale',
                    'Backoffice',
                    'Admin Control',
                    'Super Admin',
                    'Marketing',
                ];
                if (!in_array($user['role'], $allowedRoles, true)) {
                    json_response(['error' => 'FORBIDDEN_ROLE'], 403);
                }

                $today = (new DateTime('now'))->format('Y-m-d');

                // If there is already a login record today, return it to avoid duplicates
                $exists = $pdo->prepare('SELECT id, login_time FROM user_login_history WHERE user_id = ? AND login_time >= ? AND login_time < DATE_ADD(?, INTERVAL 1 DAY) ORDER BY login_time ASC LIMIT 1');
                $exists->execute([$userId, $today, $today]);
                $row = $exists->fetch();
                if ($row) {
                    // Recompute attendance for today and return current attendance row
                    try { $pdo->prepare('CALL sp_upsert_user_daily_attendance(?, ?)')->execute([$userId, $today]); } catch (Throwable $e) {}
                    $att = $pdo->prepare('SELECT * FROM v_user_daily_attendance WHERE user_id = ? AND work_date = ?');
                    $att->execute([$userId, $today]);
                    json_response(['ok' => true, 'already' => true, 'loginHistoryId' => (int)$row['id'], 'loginTime' => $row['login_time'], 'attendance' => $att->fetch() ?: null]);
                }

                // Create a new login history row (explicit work check-in)
                $ip = $_SERVER['REMOTE_ADDR'] ?? null;
                $ua = $_SERVER['HTTP_USER_AGENT'] ?? null;
                $ins = $pdo->prepare('INSERT INTO user_login_history (user_id, login_time, ip_address, user_agent) VALUES (?, NOW(), ?, ?)');
                $ins->execute([$userId, $ip, $ua]);
                $hid = (int)$pdo->lastInsertId();
                // Compute attendance for today
                try { $pdo->prepare('CALL sp_upsert_user_daily_attendance(?, ?)')->execute([$userId, $today]); } catch (Throwable $e) {}
                $att = $pdo->prepare('SELECT * FROM v_user_daily_attendance WHERE user_id = ? AND work_date = ?');
                $att->execute([$userId, $today]);
                json_response(['ok' => true, 'loginHistoryId' => $hid, 'attendance' => $att->fetch() ?: null]);
            }
            json_response(['error' => 'NOT_FOUND'], 404);
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}




function handle_call_overview(PDO $pdo): void {
    if (method() !== 'GET') { json_response(['error' => 'METHOD_NOT_ALLOWED'], 405); }

    $month = $_GET['month'] ?? null; // YYYY-MM
    $userId = isset($_GET['userId']) ? (int)$_GET['userId'] : null;
    $companyId = isset($_GET['companyId']) ? (int)$_GET['companyId'] : null;

    $sql = 'SELECT * FROM v_telesale_call_overview_monthly WHERE 1';
    $params = [];
    if ($month) { $sql .= ' AND month_key = ?'; $params[] = $month; }
    if ($userId) { $sql .= ' AND user_id = ?'; $params[] = $userId; }
    if ($companyId) { $sql .= ' AND user_id IN (SELECT id FROM users WHERE company_id = ?)'; $params[] = $companyId; }
    $sql .= ' ORDER BY month_key DESC, user_id';

    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        json_response($stmt->fetchAll());
    } catch (Throwable $e) {
        json_response(['error' => 'QUERY_FAILED', 'message' => $e->getMessage()], 500);
    }
}

// =============================================
// Notification API Endpoints
// =============================================

// Get notifications for user
function handle_get_notifications(PDO $pdo): void {
    if (method() !== 'POST') { json_response(['error' => 'METHOD_NOT_ALLOWED'], 405); }
    
    $data = json_decode(file_get_contents('php://input'), true);
    $userId = $data['userId'] ?? null;
    $userRole = $data['userRole'] ?? null;
    $limit = $data['limit'] ?? 50;
    $includeRead = !empty($data['includeRead']);
    
    if (!$userId || !$userRole) {
        json_response(['error' => 'MISSING_PARAMETERS'], 400);
    }
    
    try {
        // Get notifications for user based on role
        $sql = '
            SELECT DISTINCT n.*,
                   COALESCE(nrs.read_at IS NOT NULL, FALSE) AS is_read_by_user
            FROM notifications n
            LEFT JOIN notification_roles nr ON n.id = nr.notification_id
            LEFT JOIN notification_users nu ON n.id = nu.notification_id
            LEFT JOIN notification_read_status nrs ON n.id = nrs.notification_id AND nrs.user_id = ?
            WHERE (nr.role = ? OR nu.user_id = ?)';
        if (!$includeRead) {
            $sql .= '
              AND nrs.read_at IS NULL';
        }
        $sql .= '
            ORDER BY n.timestamp DESC
            LIMIT ?';

        $params = [$userId, $userRole, $userId, $limit];
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $notifications = $stmt->fetchAll();
        
        json_response(['success' => true, 'notifications' => $notifications]);
    } catch (Throwable $e) {
        json_response(['error' => 'QUERY_FAILED', 'message' => $e->getMessage()], 500);
    }
}

// Get notification count by category for user
function handle_get_notification_count(PDO $pdo): void {
    if (method() !== 'POST') { json_response(['error' => 'METHOD_NOT_ALLOWED'], 405); }
    
    $data = json_decode(file_get_contents('php://input'), true);
    $userId = $data['userId'] ?? null;
    $userRole = $data['userRole'] ?? null;
    
    if (!$userId || !$userRole) {
        json_response(['error' => 'MISSING_PARAMETERS'], 400);
    }
    
    try {
        // Get notification counts by category
        $stmt = $pdo->prepare('
            SELECT n.category, COUNT(*) as count
            FROM notifications n
            LEFT JOIN notification_roles nr ON n.id = nr.notification_id
            LEFT JOIN notification_users nu ON n.id = nu.notification_id
            LEFT JOIN notification_read_status nrs ON n.id = nrs.notification_id AND nrs.user_id = ?
            WHERE (nr.role = ? OR nu.user_id = ?)
              AND nrs.read_at IS NULL
            GROUP BY n.category
        ');
        $stmt->execute([$userId, $userRole, $userId]);
        $counts = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);
        
        json_response(['success' => true, 'counts' => $counts]);
    } catch (Throwable $e) {
        json_response(['error' => 'QUERY_FAILED', 'message' => $e->getMessage()], 500);
    }
}

// Mark notification as read
function handle_mark_notification_as_read(PDO $pdo): void {
    if (method() !== 'POST') { json_response(['error' => 'METHOD_NOT_ALLOWED'], 405); }
    
    $data = json_decode(file_get_contents('php://input'), true);
    $notificationId = $data['notificationId'] ?? null;
    $userId = $data['userId'] ?? null;
    
    if (!$notificationId || !$userId) {
        json_response(['error' => 'MISSING_PARAMETERS'], 400);
    }
    
    try {
        // Check if notification exists and user has access
        $stmt = $pdo->prepare('
            SELECT n.id
            FROM notifications n
            LEFT JOIN notification_roles nr ON n.id = nr.notification_id
            LEFT JOIN notification_users nu ON n.id = nu.notification_id
            WHERE n.id = ? AND (nr.role IN (SELECT role FROM users WHERE id = ?) OR nu.user_id = ?)
        ');
        $stmt->execute([$notificationId, $userId, $userId]);
        
        if (!$stmt->fetch()) {
            json_response(['error' => 'NOT_FOUND_OR_NO_ACCESS'], 404);
        }
        
        // Mark as read
        $stmt = $pdo->prepare('
            INSERT INTO notification_read_status (notification_id, user_id, read_at)
            VALUES (?, ?, NOW())
            ON DUPLICATE KEY UPDATE read_at = NOW()
        ');
        $stmt->execute([$notificationId, $userId]);
        
        json_response(['success' => true]);
    } catch (Throwable $e) {
        json_response(['error' => 'QUERY_FAILED', 'message' => $e->getMessage()], 500);
    }
}

// Mark all notifications as read for user
function handle_mark_all_notifications_as_read(PDO $pdo): void {
    if (method() !== 'POST') { json_response(['error' => 'METHOD_NOT_ALLOWED'], 405); }
    
    $data = json_decode(file_get_contents('php://input'), true);
    $userId = $data['userId'] ?? null;
    $userRole = $data['userRole'] ?? null;
    
    if (!$userId || !$userRole) {
        json_response(['error' => 'MISSING_PARAMETERS'], 400);
    }
    
    try {
        // Get all unread notifications for user
        $stmt = $pdo->prepare('
            SELECT n.id
            FROM notifications n
            LEFT JOIN notification_roles nr ON n.id = nr.notification_id
            LEFT JOIN notification_users nu ON n.id = nu.notification_id
            LEFT JOIN notification_read_status nrs ON n.id = nrs.notification_id AND nrs.user_id = ?
            WHERE (nr.role = ? OR nu.user_id = ?)
              AND nrs.read_at IS NULL
        ');
        $stmt->execute([$userId, $userRole, $userId]);
        $notificationIds = $stmt->fetchAll(PDO::FETCH_COLUMN);
        
        // Mark all as read
        if (!empty($notificationIds)) {
            $valuePlaceholders = [];
            $params = [];
            foreach ($notificationIds as $notificationId) {
                $valuePlaceholders[] = '(?, ?, NOW())';
                $params[] = $notificationId;
                $params[] = $userId;
            }

            $sql = "
                INSERT INTO notification_read_status (notification_id, user_id, read_at)
                VALUES " . implode(',', $valuePlaceholders) . "
                ON DUPLICATE KEY UPDATE read_at = NOW()
            ";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
        }
        
        json_response(['success' => true, 'count' => count($notificationIds)]);
    } catch (Throwable $e) {
        json_response(['error' => 'QUERY_FAILED', 'message' => $e->getMessage()], 500);
    }
}

// Create new notification
function handle_create_notification(PDO $pdo): void {
    if (method() !== 'POST') { json_response(['error' => 'METHOD_NOT_ALLOWED'], 405); }
    
    $data = json_decode(file_get_contents('php://input'), true);
    $notification = $data['notification'] ?? null;
    
    if (!$notification) {
        json_response(['error' => 'MISSING_NOTIFICATION'], 400);
    }
    
    try {
        // Generate unique ID if not provided
        $id = $notification['id'] ?? 'notif_' . uniqid();
        
        // Insert notification
        $stmt = $pdo->prepare('
            INSERT INTO notifications (
                id, type, category, title, message, priority,
                related_id, page_id, page_name, platform,
                previous_value, current_value, percentage_change,
                action_url, action_text, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ');
        $stmt->execute([
            $id,
            $notification['type'],
            $notification['category'],
            $notification['title'],
            $notification['message'],
            $notification['priority'],
            $notification['relatedId'] ?? null,
            $notification['pageId'] ?? null,
            $notification['pageName'] ?? null,
            $notification['platform'] ?? null,
            $notification['metrics']['previousValue'] ?? null,
            $notification['metrics']['currentValue'] ?? null,
            $notification['metrics']['percentageChange'] ?? null,
            $notification['actionUrl'] ?? null,
            $notification['actionText'] ?? null,
            $notification['metadata'] ? json_encode($notification['metadata']) : null
        ]);
        
        // Add roles
        if (!empty($notification['forRoles'])) {
            $stmt = $pdo->prepare('INSERT INTO notification_roles (notification_id, role) VALUES (?, ?)');
            foreach ($notification['forRoles'] as $role) {
                $stmt->execute([$id, $role]);
            }
        }
        
        // Add specific users
        if (!empty($notification['userId'])) {
            $stmt = $pdo->prepare('INSERT INTO notification_users (notification_id, user_id) VALUES (?, ?)');
            $stmt->execute([$id, $notification['userId']]);
        }
        
        // Get the created notification
        $stmt = $pdo->prepare('SELECT * FROM notifications WHERE id = ?');
        $stmt->execute([$id]);
        $createdNotification = $stmt->fetch();
        
        json_response(['success' => true, 'notification' => $createdNotification]);
    } catch (Throwable $e) {
        json_response(['error' => 'QUERY_FAILED', 'message' => $e->getMessage()], 500);
    }
}

// Get notification settings for user
function handle_get_notification_settings(PDO $pdo): void {
    if (method() !== 'POST') { json_response(['error' => 'METHOD_NOT_ALLOWED'], 405); }
    
    $data = json_decode(file_get_contents('php://input'), true);
    $userId = $data['userId'] ?? null;
    
    if (!$userId) {
        json_response(['error' => 'MISSING_USER_ID'], 400);
    }
    
    try {
        $stmt = $pdo->prepare('SELECT * FROM notification_settings WHERE user_id = ?');
        $stmt->execute([$userId]);
        $settings = $stmt->fetchAll();
        
        json_response(['success' => true, 'settings' => $settings]);
    } catch (Throwable $e) {
        json_response(['error' => 'QUERY_FAILED', 'message' => $e->getMessage()], 500);
    }
}

// Update notification settings
function handle_update_notification_settings(PDO $pdo): void {
    if (method() !== 'POST') { json_response(['error' => 'METHOD_NOT_ALLOWED'], 405); }
    
    $data = json_decode(file_get_contents('php://input'), true);
    $settings = $data['settings'] ?? null;
    
    if (!$settings || !isset($settings['userId']) || !isset($settings['notificationType'])) {
        json_response(['error' => 'MISSING_PARAMETERS'], 400);
    }
    
    try {
        $stmt = $pdo->prepare('
            INSERT INTO notification_settings (
                user_id, notification_type, in_app_enabled, email_enabled, 
                sms_enabled, business_hours_only
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                in_app_enabled = VALUES(in_app_enabled),
                email_enabled = VALUES(email_enabled),
                sms_enabled = VALUES(sms_enabled),
                business_hours_only = VALUES(business_hours_only),
                updated_at = NOW()
        ');
        $stmt->execute([
            $settings['userId'],
            $settings['notificationType'],
            $settings['inAppEnabled'] ?? true,
            $settings['emailEnabled'] ?? false,
            $settings['smsEnabled'] ?? false,
            $settings['businessHoursOnly'] ?? false
        ]);
        
        // Get the updated setting
        $stmt = $pdo->prepare('
            SELECT * FROM notification_settings 
            WHERE user_id = ? AND notification_type = ?
        ');
        $stmt->execute([$settings['userId'], $settings['notificationType']]);
        $updatedSetting = $stmt->fetch();
        
        json_response(['success' => true, 'setting' => $updatedSetting]);
    } catch (Throwable $e) {
        json_response(['error' => 'QUERY_FAILED', 'message' => $e->getMessage()], 500);
    }
}

// Main router for notifications
if ($resource === 'notifications') {
    switch ($action) {
        case 'get':
            handle_get_notifications($pdo);
            break;
        case 'count':
            handle_get_notification_count($pdo);
            break;
        case 'markAsRead':
            handle_mark_notification_as_read($pdo);
            break;
        case 'markAllAsRead':
            handle_mark_all_notifications_as_read($pdo);
            break;
        case 'create':
            handle_create_notification($pdo);
            break;
        case 'settings':
            if ($parts[3] === 'get') {
                handle_get_notification_settings($pdo);
            } elseif ($parts[3] === 'update') {
                handle_update_notification_settings($pdo);
            } else {
                json_response(['error' => 'INVALID_ACTION'], 400);
            }
            break;
        default:
            json_response(['error' => 'INVALID_ACTION'], 400);
    }
}

// Handle POST requests for notifications (for backward compatibility)
if (method() === 'POST' && isset($_POST['action'])) {
    switch ($_POST['action']) {
        case 'getNotifications':
            handle_get_notifications($pdo);
            break;
        case 'getNotificationCount':
            handle_get_notification_count($pdo);
            break;
        case 'markNotificationAsRead':
            handle_mark_notification_as_read($pdo);
            break;
        case 'markAllNotificationsAsRead':
            handle_mark_all_notifications_as_read($pdo);
            break;
        case 'createNotification':
            handle_create_notification($pdo);
            break;
        case 'getNotificationSettings':
            handle_get_notification_settings($pdo);
            break;
        case 'updateNotificationSettings':
            handle_update_notification_settings($pdo);
            break;
    }
}

/**
 * Handle upsell endpoints
 * GET /api/upsell/check?customerId=xxx - Check if customer has orders eligible for upsell
 * GET /api/upsell/orders?customerId=xxx - Get orders eligible for upsell
 * POST /api/upsell/items - Add new items to existing order (upsell)
 */
function handle_upsell(PDO $pdo, ?string $id, ?string $action): void {
    $method = $_SERVER['REQUEST_METHOD'];
    
    switch ($method) {
        case 'GET':
            if ($id === 'check') {
                // Check if customer has orders eligible for upsell
                $customerId = $_GET['customerId'] ?? null;
                $requesterId = isset($_GET['userId']) ? (int)$_GET['userId'] : null;
                if (!$customerId) {
                    json_response(['error' => 'CUSTOMER_ID_REQUIRED'], 400);
                    return;
                }

                // Find orders that are eligible for upsell:
                // 1. order_status = 'Pending'
                // 2. order_date is within the last 24 hours
                // 3. No upsell items exist yet (no order_items with creator_id != order.creator_id)
                $excludeCreatorClause = '';
                $params = [$customerId];
                if ($requesterId !== null) {
                    // Do not surface upsell for orders created by the same requester
                    $excludeCreatorClause = " AND (o.creator_id IS NULL OR o.creator_id != ?)";
                    $params[] = $requesterId;
                }

                $stmt = $pdo->prepare("
                    SELECT COUNT(*) as eligible_count
                    FROM orders o
                    WHERE o.customer_id = ?
                    AND o.order_status = 'Pending'
                    AND o.order_date >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                    {$excludeCreatorClause}
                    AND NOT EXISTS (
                        SELECT 1
                        FROM order_items oi
                        WHERE oi.parent_order_id = o.id
                        AND oi.creator_id != o.creator_id
                    )
                ");
                $stmt->execute($params);
                $result = $stmt->fetch(PDO::FETCH_ASSOC);
                
                json_response([
                    'hasEligibleOrders' => ($result['eligible_count'] ?? 0) > 0,
                    'eligibleCount' => (int)($result['eligible_count'] ?? 0)
                ]);
            } else if ($id === 'orders') {
                // Get orders eligible for upsell for a customer
                $customerId = $_GET['customerId'] ?? null;
                $requesterId = isset($_GET['userId']) ? (int)$_GET['userId'] : null;
                if (!$customerId) {
                    json_response(['error' => 'CUSTOMER_ID_REQUIRED'], 400);
                    return;
                }

                // Get orders that are eligible for upsell
                // 1. order_status = 'Pending'
                // 2. order_date is within the last 24 hours
                // 3. No upsell items exist yet (no order_items with creator_id != order.creator_id)
                $excludeCreatorClause = '';
                $params = [$customerId];
                if ($requesterId !== null) {
                    // Do not surface upsell for orders created by the same requester
                    $excludeCreatorClause = " AND (o.creator_id IS NULL OR o.creator_id != ?)";
                    $params[] = $requesterId;
                }

                $stmt = $pdo->prepare("
                    SELECT o.id, o.order_date, o.delivery_date, o.order_status, o.total_amount, o.creator_id,
                           o.sales_channel_page_id, o.sales_channel, o.payment_method, o.payment_status,
                           o.street, o.subdistrict, o.district, o.province, o.postal_code,
                           o.recipient_first_name, o.recipient_last_name,
                           COUNT(oi.id) as item_count
                    FROM orders o
                    LEFT JOIN order_items oi ON oi.parent_order_id = o.id
                    WHERE o.customer_id = ?
                    AND o.order_status = 'Pending'
                    AND o.order_date >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                    {$excludeCreatorClause}
                    AND NOT EXISTS (
                        SELECT 1
                        FROM order_items oi2
                        WHERE oi2.parent_order_id = o.id
                        AND oi2.creator_id != o.creator_id
                    )
                    GROUP BY o.id
                    ORDER BY o.order_date DESC
                ");
                $stmt->execute($params);
                $orders = $stmt->fetchAll(PDO::FETCH_ASSOC);
                
                // For each order, fetch items with creator_id
                foreach ($orders as &$order) {
                    $orderId = $order['id'];
                    $itemStmt = $pdo->prepare("
                        SELECT oi.id, oi.order_id, oi.product_id, oi.product_name, oi.quantity,
                               oi.price_per_unit, oi.discount, oi.net_total, oi.is_freebie, oi.box_number,
                               oi.promotion_id, oi.parent_item_id, oi.is_promotion_parent,
                               oi.creator_id, oi.parent_order_id,
                               p.sku as product_sku
                        FROM order_items oi
                        LEFT JOIN products p ON oi.product_id = p.id
                        WHERE oi.parent_order_id = ?
                        ORDER BY oi.id
                    ");
                    $itemStmt->execute([$orderId]);
                    $order['items'] = $itemStmt->fetchAll(PDO::FETCH_ASSOC);
                    foreach ($order['items'] as &$orderItem) {
                        if (!isset($orderItem['net_total']) || $orderItem['net_total'] === null) {
                            $orderItem['net_total'] = calculate_order_item_net_total($orderItem);
                        }
                    }
                    unset($orderItem);
                }
                
                json_response($orders);
            } else {
                json_response(['error' => 'INVALID_ENDPOINT'], 404);
            }
            break;
            
        case 'POST':
            if ($id === 'items') {
                // Add new items to existing order (upsell)
                $in = json_input();
                
                $orderId = $in['orderId'] ?? null;
                $creatorId = $in['creatorId'] ?? null;
                $items = $in['items'] ?? [];
                
                if (!$orderId || !$creatorId || empty($items)) {
                    json_response(['error' => 'MISSING_REQUIRED_FIELDS', 'message' => 'orderId, creatorId, and items are required'], 400);
                    return;
                }
                
                // Validate order exists and is eligible for upsell
                $orderCheck = $pdo->prepare("
                    SELECT id, customer_id, order_status, order_date, creator_id, total_amount, payment_method, cod_amount
                    FROM orders
                    WHERE id = ?
                ");
                $orderCheck->execute([$orderId]);
                $order = $orderCheck->fetch(PDO::FETCH_ASSOC);
                
                if (!$order) {
                    json_response(['error' => 'ORDER_NOT_FOUND'], 404);
                    return;
                }
                
                // Check if order is eligible for upsell
                if ($order['order_status'] !== 'Pending') {
                    json_response(['error' => 'ORDER_NOT_ELIGIBLE', 'message' => 'Order status must be Pending'], 400);
                    return;
                }

                // Prevent upsell on orders created by the same requester
                $orderCreatorId = isset($order['creator_id']) ? (int)$order['creator_id'] : null;
                if ($orderCreatorId !== null && (int)$creatorId === $orderCreatorId) {
                    json_response(['error' => 'ORDER_NOT_ELIGIBLE', 'message' => 'Upsell is not allowed on orders you created'], 400);
                    return;
                }

                // Check if order is within 24 hours
                $timeCheck = $pdo->prepare("
                    SELECT COUNT(*) as is_eligible
                    FROM orders
                    WHERE id = ?
                    AND order_date >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                ");
                $timeCheck->execute([$orderId]);
                $timeResult = $timeCheck->fetch(PDO::FETCH_ASSOC);
                
                if (!$timeResult || $timeResult['is_eligible'] == 0) {
                    json_response(['error' => 'ORDER_EXPIRED', 'message' => 'Order is older than 24 hours'], 400);
                    return;
                }
                
                // Validate creator_id exists and get creator name
                $creatorCheck = $pdo->prepare('SELECT id, status, first_name, last_name FROM users WHERE id = ?');
                $creatorCheck->execute([$creatorId]);
                $creatorData = $creatorCheck->fetch(PDO::FETCH_ASSOC);
                if (!$creatorData || $creatorData['status'] !== 'active') {
                    json_response(['error' => 'INVALID_CREATOR', 'message' => 'Creator user not found or inactive'], 400);
                    return;
                }
                $creatorName = trim(($creatorData['first_name'] ?? '') . ' ' . ($creatorData['last_name'] ?? ''));
                
                $pdo->beginTransaction();
                try {
                    $insertedItems = [];
                    // Initialize with existing total amount
                    $newTotalAmount = isset($order['total_amount']) ? (float)$order['total_amount'] : 0.0;
                    // Track additional net total per box for order_boxes
                    $boxNetAdditions = [];

                    // Helper to validate that a parent_item_id actually exists to satisfy FK
                    $parentCheckStmt = $pdo->prepare('SELECT id FROM order_items WHERE id = ? LIMIT 1');
                    
                    // Get max box_number for this order
                    $boxStmt = $pdo->prepare("SELECT COALESCE(MAX(box_number), 0) as max_box FROM order_items WHERE parent_order_id = ?");
                    $boxStmt->execute([$orderId]);
                    $boxResult = $boxStmt->fetch(PDO::FETCH_ASSOC);
                    $currentBoxNumber = (int)($boxResult['max_box'] ?? 0);
                    
                    foreach ($items as $item) {
                        $productId = $item['productId'] ?? null;
                        $productName = $item['productName'] ?? '';
                        $quantity = max(0, (int)($item['quantity'] ?? 1));
                        $pricePerUnit = isset($item['pricePerUnit']) ? (float)$item['pricePerUnit'] : (float)($item['price_per_unit'] ?? 0);
                        $pricePerUnit = $pricePerUnit < 0 ? 0.0 : $pricePerUnit;
                        $discount = (float)($item['discount'] ?? 0);
                        $isFreebie = isset($item['isFreebie']) && $item['isFreebie'] ? 1 : 0;
                        $promotionId = $item['promotionId'] ?? null;

                        // Resolve parentItemId only if it points to an existing order_items.id
                        $parentItemId = null;
                        if (array_key_exists('parentItemId', $item) && $item['parentItemId'] !== null && $item['parentItemId'] !== '') {
                            $candidateParent = $item['parentItemId'];
                            if (is_numeric($candidateParent)) {
                                $candidateParent = (int)$candidateParent;
                                if ($candidateParent > 0) {
                                    $parentCheckStmt->execute([$candidateParent]);
                                    if ($parentCheckStmt->fetchColumn()) {
                                        $parentItemId = $candidateParent;
                                    }
                                }
                            }
                        }

                        $isPromotionParent = isset($item['isPromotionParent']) && $item['isPromotionParent'] ? 1 : 0;
                        $netTotal = calculate_order_item_net_total([
                            'quantity' => $quantity,
                            'pricePerUnit' => $pricePerUnit,
                            'discount' => $discount,
                            'isFreebie' => $isFreebie,
                        ]);
                        
                        // Determine box_number (increment if needed)
                        $boxNumber = $item['boxNumber'] ?? ($currentBoxNumber + 1);
                        if ($boxNumber > $currentBoxNumber) {
                            $currentBoxNumber = $boxNumber;
                        }
                        
                        // Generate order_id (sub order ID)
                        $subOrderId = "{$orderId}-{$boxNumber}";
                        
                        // Insert order item with creator_id
                        $itemStmt = $pdo->prepare("
                            INSERT INTO order_items (
                                order_id, parent_order_id, product_id, product_name, quantity,
                                price_per_unit, discount, net_total, is_freebie, box_number,
                                promotion_id, parent_item_id, is_promotion_parent, creator_id
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ");
                        
                        $itemStmt->execute([
                            $subOrderId,
                            $orderId,
                            $productId,
                            $productName,
                            $quantity,
                            $pricePerUnit,
                            $discount,
                            $netTotal,
                            $isFreebie,
                            $boxNumber,
                            $promotionId,
                            $parentItemId,
                            $isPromotionParent,
                            $creatorId
                        ]);
                        
                        $itemId = $pdo->lastInsertId();
                        
                        $newTotalAmount += $netTotal;

                        // Accumulate net total per box for order_boxes
                        if (!isset($boxNetAdditions[$boxNumber])) {
                            $boxNetAdditions[$boxNumber] = 0.0;
                        }
                        $boxNetAdditions[$boxNumber] += $netTotal;
                        
                        $insertedItems[] = [
                            'id' => $itemId,
                            'order_id' => $subOrderId,
                            'parent_order_id' => $orderId,
                            'product_id' => $productId,
                            'product_name' => $productName,
                            'quantity' => $quantity,
                            'price_per_unit' => $pricePerUnit,
                            'discount' => $discount,
                            'net_total' => $netTotal,
                            'is_freebie' => $isFreebie,
                            'box_number' => $boxNumber,
                            'promotion_id' => $promotionId,
                            'parent_item_id' => $parentItemId,
                            'is_promotion_parent' => $isPromotionParent,
                            'creator_id' => $creatorId
                        ];
                    }
                    
                    // Update order total_amount
                    $updateFields = ["total_amount = ?"];
                    $updateParams = [$newTotalAmount];

                    // If payment method is COD, also update cod_amount
                    if (($order['payment_method'] ?? '') === 'COD') {
                        $updateFields[] = "cod_amount = ?";
                        $updateParams[] = $newTotalAmount;
                    }
                    
                    $updateParams[] = $orderId;
                    $updateOrderStmt = $pdo->prepare("UPDATE orders SET " . implode(', ', $updateFields) . " WHERE id = ?");
                    $updateOrderStmt->execute($updateParams);

                    // Maintain per-box COD/collection amounts in order_boxes for COD orders
                    if (($order['payment_method'] ?? '') === 'COD' && !empty($boxNetAdditions)) {
                        $selectBox = $pdo->prepare('SELECT collection_amount, cod_amount FROM order_boxes WHERE order_id=? AND box_number=? LIMIT 1');
                        $updateBox = $pdo->prepare('UPDATE order_boxes SET collection_amount=?, cod_amount=? WHERE order_id=? AND box_number=?');
                        $insertBox = $pdo->prepare('INSERT INTO order_boxes (order_id, sub_order_id, box_number, payment_method, collection_amount, cod_amount, collected_amount, waived_amount, status) VALUES (?,?,?,?,?,?,?,?,?)');
                        $paymentMethod = $order['payment_method'] ?? 'COD';

                        foreach ($boxNetAdditions as $boxNumber => $addedNet) {
                            $boxNum = (int)$boxNumber;
                            if ($boxNum <= 0) {
                                $boxNum = 1;
                            }
                            $subOrderIdForBox = "{$orderId}-{$boxNum}";

                            $selectBox->execute([$orderId, $boxNum]);
                            $existing = $selectBox->fetch(PDO::FETCH_ASSOC);
                            if ($existing) {
                                $existingCollection = isset($existing['collection_amount']) ? (float)$existing['collection_amount'] : 0.0;
                                $existingCod = isset($existing['cod_amount']) ? (float)$existing['cod_amount'] : 0.0;
                                $newCollection = $existingCollection + $addedNet;
                                $newCod = $existingCod + $addedNet;
                                $updateBox->execute([$newCollection, $newCod, $orderId, $boxNum]);
                            } else {
                                $collectionAmount = (float)$addedNet;
                                $codAmount = (float)$addedNet;
                                $insertBox->execute([
                                    $orderId,
                                    $subOrderIdForBox,
                                    $boxNum,
                                    $paymentMethod,
                                    $collectionAmount,
                                    $codAmount,
                                    0.0,
                                    0.0,
                                    'PENDING',
                                ]);
                            }
                        }
                    }
                    
                    // Create activity log for successful upsell
                    $activityStmt = $pdo->prepare('INSERT INTO activities (customer_id, timestamp, type, description, actor_name) VALUES (?, NOW(), ?, ?, ?)');
                    $itemCount = count($items);
                    $activityDescription = "เพิ่มรายการสินค้าในออเดอร์ {$orderId} (Upsell) - เพิ่ม {$itemCount} รายการ";
                    $activityStmt->execute([
                        $order['customer_id'],
                        'order_status_changed', // ActivityType.OrderStatusChanged
                        $activityDescription,
                        $creatorName ?: 'System'
                    ]);
                    
                    $pdo->commit();
                    
                    json_response([
                        'success' => true,
                        'orderId' => $orderId,
                        'newTotalAmount' => $newTotalAmount,
                        'items' => $insertedItems
                    ], 201);
                    
                } catch (Throwable $e) {
                    $pdo->rollBack();
                    error_log('Upsell error: ' . $e->getMessage());
                    json_response(['error' => 'UPSELL_FAILED', 'message' => $e->getMessage()], 500);
                }
            } else {
                json_response(['error' => 'INVALID_ENDPOINT'], 404);
            }
            break;
            
        default:
            json_response(['error' => 'METHOD_NOT_ALLOWED'], 405);
    }
}

// ==================== User Permission Overrides Handler ====================
function handle_user_permissions(PDO $pdo, ?string $userId, ?string $action): void {
    if (!$userId) {
        json_response(['error' => 'USER_ID_REQUIRED'], 400);
    }
    
    // GET /api/user_permissions/{userId}/effective - Get effective permissions (Role + Overrides)
    if (method() === 'GET' && $action === 'effective') {
        // Get role permissions
        // FIX: Join by role_id first, fallback to role name (for legacy/mixed support)
        // Use COALESCE to prioritize role_id, prevent multiple matches
        $stmt = $pdo->prepare('
            SELECT rp.data as role_permissions, r.code as role_code
            FROM users u
            LEFT JOIN roles r ON (
                (u.role_id IS NOT NULL AND r.id = u.role_id) OR
                (u.role_id IS NULL AND (r.name = u.role OR r.code = u.role))
            )
            LEFT JOIN role_permissions rp ON rp.role = r.code
            WHERE u.id = ?
            LIMIT 1
        ');
        $stmt->execute([$userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        
        $rolePermissions = $row && $row['role_permissions'] 
            ? json_decode($row['role_permissions'], true) 
            : [];
        
        // Get user overrides
        $stmt = $pdo->prepare('
            SELECT permission_key, permission_value 
            FROM user_permission_overrides 
            WHERE user_id = ?
        ');
        $stmt->execute([$userId]);
        $overrides = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Merge: Override ทับ Role Permission
        // Normalize Role Data: Check if it's new structure (with keys 'permissions', 'menu_order') or legacy (direct map)
        $basePermissions = [];
        $menuOrder = [];
        
        if (isset($rolePermissions['permissions']) && is_array($rolePermissions['permissions'])) {
            $basePermissions = $rolePermissions['permissions'];
            $menuOrder = $rolePermissions['menu_order'] ?? [];
        } else {
            $basePermissions = $rolePermissions; // Legacy structure
            // Optional: Default menu order (empty implies default system order)
        }

        $effectivePermissions = $basePermissions;
        foreach ($overrides as $override) {
            $key = $override['permission_key'];
            $value = json_decode($override['permission_value'], true);
            $effectivePermissions[$key] = $value;
        }
        
        json_response([
            'permissions' => $effectivePermissions,
            'menu_order' => $menuOrder,
            'roleCode' => $row['role_code'] ?? null
        ]);
    }
    
    // GET /api/user_permissions/{userId}/overrides - Get user overrides only
    if (method() === 'GET' && $action === 'overrides') {
        $stmt = $pdo->prepare('
            SELECT id, permission_key, permission_value, notes, created_by, created_at, updated_at
            FROM user_permission_overrides 
            WHERE user_id = ?
            ORDER BY permission_key
        ');
        $stmt->execute([$userId]);
        $overrides = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Decode JSON values
        foreach ($overrides as &$override) {
            $override['permission_value'] = json_decode($override['permission_value'], true);
        }
        unset($override);
        
        json_response(['overrides' => $overrides]);
    }
    
    // POST /api/user_permissions/{userId}/overrides - Add/Update override
    if (method() === 'POST' && $action === 'overrides') {
        $input = json_input();
        $permissionKey = $input['permission_key'] ?? '';
        $permissionValue = $input['permission_value'] ?? [];
        $notes = $input['notes'] ?? null;
        
        if (!$permissionKey) {
            json_response(['error' => 'PERMISSION_KEY_REQUIRED'], 400);
        }
        
        $stmt = $pdo->prepare('
            INSERT INTO user_permission_overrides 
            (user_id, permission_key, permission_value, notes, created_by) 
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                permission_value = VALUES(permission_value),
                notes = VALUES(notes),
                updated_at = CURRENT_TIMESTAMP
        ');
        $stmt->execute([
            $userId,
            $permissionKey,
            json_encode($permissionValue),
            $notes,
            $_SESSION['user_id'] ?? null
        ]);
        
        json_response(['message' => 'Override saved successfully']);
    }
    
    // DELETE /api/user_permissions/{userId}/overrides?key={key} - Delete override
    if (method() === 'DELETE' && $action === 'overrides') {
        $permissionKey = $_GET['key'] ?? '';
        
        if (!$permissionKey) {
            json_response(['error' => 'PERMISSION_KEY_REQUIRED'], 400);
        }
        
        $stmt = $pdo->prepare('
            DELETE FROM user_permission_overrides 
            WHERE user_id = ? AND permission_key = ?
        ');
        $stmt->execute([$userId, $permissionKey]);
        
        json_response(['message' => 'Override deleted successfully']);
    }
    
    json_response(['error' => 'NOT_FOUND'], 404);
}

?>
