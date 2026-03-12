<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);

// Use API-local config (api/config.php)
$configPath = __DIR__ . '/config.php';
if (file_exists($configPath)) {
    include $configPath;
} else {
    header("Content-Type: application/json");
    echo json_encode(["success" => false, "error" => "Config file not found"]);
    exit;
}

if (!function_exists('cors') || !function_exists('db_connect') || !function_exists('json_response')) {
    header("Content-Type: application/json");
    echo json_encode(["success" => false, "error" => "Config loaded but helper functions missing"]);
    exit;
}

cors();

$action = $_GET['action'] ?? '';

// ─── Action: check_mismatched ───
// Find customers with is_blocked=1 but current_basket_key != 55
if ($action === 'check_mismatched') {
    try {
        $pdo = db_connect();
        $companyId = isset($_GET['company_id']) ? (int)$_GET['company_id'] : null;

        $sql = "SELECT c.customer_id, c.customer_ref_id, c.first_name, c.last_name, c.phone,
                       c.current_basket_key, bc.basket_name AS current_basket_name, bc.target_page
                FROM customers c
                LEFT JOIN basket_config bc ON c.current_basket_key = bc.id
                WHERE c.is_blocked = 1
                  AND (c.current_basket_key != 55 OR c.current_basket_key IS NULL)";
        if ($companyId) {
            $sql .= " AND c.company_id = :company_id";
        }
        $sql .= " ORDER BY c.first_name";

        $stmt = $pdo->prepare($sql);
        if ($companyId) {
            $stmt->bindValue(':company_id', $companyId, PDO::PARAM_INT);
        }
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        json_response(["success" => true, "data" => $rows, "count" => count($rows)]);
    } catch (Throwable $e) {
        json_response(["success" => false, "error" => $e->getMessage()], 500);
    }
    exit;
}

// ─── Action: fix_mismatched ───
// Move is_blocked=1 customers to basket 55
if ($action === 'fix_mismatched') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        json_response(["success" => false, "error" => "POST required"], 405);
        exit;
    }
    try {
        $pdo = db_connect();
        $input = json_decode(file_get_contents('php://input'), true);
        $customerIds = $input['customer_ids'] ?? [];
        if (empty($customerIds)) {
            json_response(["success" => false, "error" => "customer_ids required"], 400);
            exit;
        }

        $placeholders = implode(',', array_fill(0, count($customerIds), '?'));
        $stmt = $pdo->prepare("UPDATE customers SET current_basket_key = 55, basket_entered_date = NOW() WHERE customer_id IN ($placeholders) AND is_blocked = 1");
        $stmt->execute($customerIds);
        $affected = $stmt->rowCount();

        // Log transitions
        foreach ($customerIds as $cid) {
            try {
                $pdo->prepare('INSERT INTO basket_transition_log (customer_id, from_basket_key, to_basket_key, transition_type, notes, created_at) VALUES (?, NULL, 55, ?, ?, NOW())')
                    ->execute([$cid, 'sync_fix', 'Auto-fix: is_blocked=1 but not in basket 55']);
            } catch (Throwable $e) { /* ignore */ }
        }

        json_response(["success" => true, "affected" => $affected]);
    } catch (Throwable $e) {
        json_response(["success" => false, "error" => $e->getMessage()], 500);
    }
    exit;
}

// ─── Default: list blocked customers ───
try {
    $pdo = db_connect();
    $companyId = isset($_GET['company_id']) ? (int)$_GET['company_id'] : null;

    // Latest active block per customer in the blocked bucket
    $sql = "SELECT 
                c.customer_id AS id,
                c.customer_ref_id,
                c.first_name,
                c.last_name,
                c.phone,
                cb.id AS block_id,
                cb.reason,
                cb.blocked_at,
                cb.blocked_by,
                u.username AS blocker_username,
                CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS blocker_name
            FROM customer_blocks cb
            JOIN customers c ON (cb.customer_id = c.customer_ref_id OR cb.customer_id = c.customer_id)
            LEFT JOIN users u ON cb.blocked_by = u.id
            WHERE cb.active = 1
              AND (c.is_blocked = 1 OR c.bucket_type = 'blocked')";

    if ($companyId) {
        $sql .= " AND c.company_id = :company_id";
    }

    $sql .= " AND cb.id = (
                SELECT MAX(id) 
                FROM customer_blocks 
                WHERE customer_id = cb.customer_id AND active = 1
            )
            ORDER BY cb.blocked_at DESC";

    $stmt = $pdo->prepare($sql);
    if ($companyId) {
        $stmt->bindValue(':company_id', $companyId, PDO::PARAM_INT);
    }
    $stmt->execute();
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $result = array_map(function ($row) {
        $blockerName = trim((string)$row['blocker_name']);
        if ($blockerName === '') {
            $blockerName = $row['blocker_username'] ?? null;
        }

        return [
            'id' => isset($row['id']) ? (int)$row['id'] : null,
            'customer_ref_id' => $row['customer_ref_id'] ?? null,
            'fname' => $row['first_name'] ?? null,
            'lname' => $row['last_name'] ?? null,
            'phone' => $row['phone'] ?? null,
            'reason' => $row['reason'] ?? null,
            'block_at' => $row['blocked_at'] ?? null,
            'blocked_at' => $row['blocked_at'] ?? null,
            'block_id' => isset($row['block_id']) ? (int)$row['block_id'] : null,
            'blocked_by' => $row['blocked_by'] ?? null,
            'blocker_name' => $blockerName,
            'blocker_nickname' => $row['blocker_username'] ?? null,
        ];
    }, $rows ?: []);

    json_response(["success" => true, "data" => $result]);

} catch (Throwable $e) {
    json_response(["success" => false, "error" => $e->getMessage()], 500);
}
?>
