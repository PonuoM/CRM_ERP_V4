
<?php

ini_set('display_errors', 0);
error_reporting(E_ALL);
function log_error($msg) {
    file_put_contents(__DIR__ . '/error.log', date('[Y-m-d H:i:s] ') . $msg . "\n", FILE_APPEND);
}
set_exception_handler(function($e) {
    log_error("Uncaught Exception (Customers): " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
    exit;
});

require_once __DIR__ . '/../config.php';

cors();
$pdo = db_connect();
validate_auth($pdo);

$user = get_authenticated_user($pdo);
if (!$user) {
    json_response(['error' => 'UNAUTHORIZED', 'message' => 'User not found'], 401);
}

// Helpers
function sanitize_value($val) {
    if ($val === null) return null;
    $val = trim((string)$val);
    return $val === '' ? null : $val;
}

function normalize_phone($phone) {
    if (!$phone) return null;
    $digits = preg_replace('/\D/', '', $phone);
    if (strlen($digits) > 10 && strpos($digits, '66') === 0) {
        $digits = '0' . substr($digits, 2);
    }
    return $digits ?: null;
}

$input = json_input();
if (!isset($input['rows']) || !is_array($input['rows'])) {
    json_response(['error' => 'INVALID_INPUT', 'message' => 'Missing rows array'], 400);
}

// Target basket: rows with no (valid) caretaker land in this distribution
// ("pool") basket; rows with a valid caretaker land in its linked dashboard
// basket instead, alongside setting assigned_to. Required so imported
// customers actually enter the routing system instead of current_basket_key
// staying NULL forever.
$basketKey = sanitize_value($input['basketKey'] ?? null);
if (!$basketKey) {
    json_response(['error' => 'INVALID_INPUT', 'message' => 'Missing basketKey'], 400);
}

$basketStmt = $pdo->prepare("SELECT id, basket_name FROM basket_config WHERE basket_key = ? AND target_page = 'distribution' AND company_id = 1");
$basketStmt->execute([$basketKey]);
$basketRow = $basketStmt->fetch(PDO::FETCH_ASSOC);
if (!$basketRow) {
    json_response(['error' => 'INVALID_BASKET', 'message' => "ไม่พบถังฝั่ง Distribution ที่ระบุ: $basketKey"], 400);
}
$poolBasketId = $basketRow['id'];
$poolBasketName = $basketRow['basket_name'];

// The Dashboard-side destination is chosen explicitly by the admin, not
// derived from linked_basket_key — several pairs share the same display name,
// and the admin may deliberately want a different Dashboard basket than the
// configured pair. Only required when the file actually has owner rows.
$assignedBasketKey = sanitize_value($input['assignedBasketKey'] ?? null);
$assignedBasketId = null;
$assignedBasketName = null;
if ($assignedBasketKey) {
    $assignedStmt = $pdo->prepare("SELECT id, basket_name FROM basket_config WHERE basket_key = ? AND target_page = 'dashboard_v2' AND company_id = 1");
    $assignedStmt->execute([$assignedBasketKey]);
    $assignedRow = $assignedStmt->fetch(PDO::FETCH_ASSOC);
    if (!$assignedRow) {
        json_response(['error' => 'INVALID_BASKET', 'message' => "ไม่พบถังฝั่ง Dashboard ที่ระบุ: $assignedBasketKey"], 400);
    }
    $assignedBasketId = $assignedRow['id'];
    $assignedBasketName = $assignedRow['basket_name'];
}

// Cache caretaker existence checks (one lookup per distinct caretakerId per request).
$caretakerCache = [];
function resolve_caretaker(PDO $pdo, array &$cache, $rawId, int $companyId): ?int {
    if (!$rawId || !is_numeric($rawId)) return null;
    $id = (int)$rawId;
    if (array_key_exists($id, $cache)) return $cache[$id];
    $stmt = $pdo->prepare("SELECT id FROM users WHERE id = ? AND company_id = ?");
    $stmt->execute([$id, $companyId]);
    $found = $stmt->fetchColumn();
    return $cache[$id] = ($found ? $id : null);
}

$rows = $input['rows'];
$summary = [
    'totalRows' => count($rows),
    'createdCustomers' => 0,
    'updatedCustomers' => 0,
    'assignedToOwner' => 0,
    'sentToPool' => 0,
    'poolBasketName' => $poolBasketName,
    'assignedBasketName' => $assignedBasketName,
    'notes' => []
];

foreach ($rows as $index => $row) {
    $rowNum = $index + 2;
    
    // Customer ID/Phone
    $customerId = sanitize_value($row['customerId'] ?? null);
    $rawPhone = sanitize_value($row['phone'] ?? null);
    $phone = normalize_phone($rawPhone);
    
    if (!$customerId) {
        if ($phone) {
            $customerId = "CUS-{$phone}-{$user['company_id']}"; 
        } else {
            $customerId = "CUS-IMP-" . time() . "-{$index}-{$user['company_id']}";
        }
    }

    $customerNameStr = (string)sanitize_value($row['customerName'] ?? '');
    $firstName = sanitize_value($row['firstName'] ?? null) ?: (explode(' ', $customerNameStr)[0] ?? null);
    $lastName = sanitize_value($row['lastName'] ?? null) ?: (implode(' ', array_slice(explode(' ', $customerNameStr), 1)) ?? null);

    if (!$firstName) {
        $summary['notes'][] = "Row $rowNum: Missing first name, skipped.";
        continue;
    }
    if (!$phone) {
        $summary['notes'][] = "Row $rowNum: Missing phone, skipped.";
        continue;
    }

    // Check Existence
    // Check by Ref ID OR Phone
    $stmt = $pdo->prepare("SELECT customer_id FROM customers WHERE (customer_ref_id = ? OR phone = ?) AND company_id = ?");
    $stmt->execute([$customerId, $phone, $user['company_id']]);
    if ($stmt->fetch()) {
        continue;
    }

    // Create
    try {
        $sql = "INSERT INTO customers (
            customer_ref_id, first_name, last_name, phone, email,
            street, subdistrict, district, province, postal_code,
            company_id, assigned_to, date_assigned, date_registered, ownership_expires,
            lifecycle_status, behavioral_status, grade, total_purchases,
            current_basket_key, basket_entered_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

        $rawCaretakerId = sanitize_value($row['caretakerId'] ?? null);
        $assignedTo = resolve_caretaker($pdo, $caretakerCache, $rawCaretakerId, $user['company_id']);
        if ($rawCaretakerId && !$assignedTo) {
            $summary['notes'][] = "แถวที่ $rowNum: ไม่พบรหัสผู้ดูแล '$rawCaretakerId' ในระบบ ถือว่าแถวนี้ไม่มีผู้ดูแล (เข้าถังฝั่ง Distribution แทน)";
        }
        // A row with a valid owner needs a Dashboard destination. The UI blocks
        // this, but guard here too so a direct API call can't land owned rows
        // in the pool basket by omitting assignedBasketKey.
        if ($assignedTo && !$assignedBasketId) {
            json_response([
                'error' => 'MISSING_ASSIGNED_BASKET',
                'message' => 'ไฟล์มีแถวที่ระบุผู้ดูแล แต่ไม่ได้เลือกถังฝั่ง Dashboard ปลายทาง (assignedBasketKey)'
            ], 400);
        }

        $targetBasketId = $assignedTo ? $assignedBasketId : $poolBasketId;
        if ($assignedTo) {
            $summary['assignedToOwner']++;
        } else {
            $summary['sentToPool']++;
        }

        // Dates
        $nowStr = date('Y-m-d H:i:s');
        $expireDate = date('Y-m-d H:i:s', strtotime('+90 days'));

        $email = sanitize_value($row['email'] ?? null);
        $addr = sanitize_value($row['address'] ?? null);
        $sub = sanitize_value($row['subdistrict'] ?? null);
        $dist = sanitize_value($row['district'] ?? null);
        $prov = sanitize_value($row['province'] ?? null);
        $zip = sanitize_value($row['postalCode'] ?? null);

        // Statuses
        $behave = sanitize_value($row['behavioralStatus'] ?? 'Cold');
        $grade = sanitize_value($row['grade'] ?? 'Standard');
        $purchases = floatval($row['totalPurchases'] ?? 0);

        $stmtIns = $pdo->prepare($sql);
        $stmtIns->execute([
            $customerId, $firstName, $lastName, $phone, $email,
            $addr, $sub, $dist, $prov, $zip,
            $user['company_id'], $assignedTo,
            $assignedTo ? $nowStr : null, // date_assigned — only meaningful once someone actually owns the row
            $nowStr, // date_registered
            $expireDate, // ownership_expires
            $assignedTo ? 'Assigned' : 'New', // lifecycle_status
            $behave, $grade, $purchases,
            $targetBasketId, $nowStr // current_basket_key, basket_entered_date
        ]);

        $summary['createdCustomers']++;

    } catch (Exception $e) {
        $summary['notes'][] = "Row $rowNum: Failed to create customer $customerId: " . $e->getMessage();
    }
}

json_response($summary);
