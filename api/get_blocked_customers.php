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
            JOIN customers c ON (cb.customer_id = c.customer_id OR cb.customer_id = c.customer_ref_id)
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
