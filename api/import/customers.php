
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

$rows = $input['rows'];
$summary = [
    'totalRows' => count($rows),
    'createdCustomers' => 0,
    'updatedCustomers' => 0,
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
            lifecycle_status, behavioral_status, grade, total_purchases
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

        $assignedTo = sanitize_value($row['caretakerId'] ?? null); 
        if (!$assignedTo) {
             // 
        } else {
             if (!is_numeric($assignedTo)) $assignedTo = null; 
        }
        $bucketType = $assignedTo ? 'assigned' : 'ready';

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
            $nowStr, // date_assigned
            $nowStr, // date_registered
            $expireDate, // ownership_expires
            'New', // lifecycle_status (forced)
            $behave, $grade, $purchases
        ]);
        
        $summary['createdCustomers']++;

    } catch (Exception $e) {
        $summary['notes'][] = "Row $rowNum: Failed to create customer $customerId: " . $e->getMessage();
    }
}

json_response($summary);
