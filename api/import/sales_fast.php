<?php
/**
 * FAST Sales Import - Optimized for Large Files
 * Uses batch operations and prepared statements caching
 */

ini_set('display_errors', 0);
ini_set('max_execution_time', 600); // 10 minutes
ini_set('memory_limit', '512M');
error_reporting(E_ALL);

require_once __DIR__ . '/../config.php';

cors();

try {
    $pdo = db_connect();
    $pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);
} catch (Exception $e) {
    json_response(['error' => 'DB_ERROR', 'message' => $e->getMessage()], 500);
}

validate_auth($pdo);
$user = get_authenticated_user($pdo);
if (!$user) {
    json_response(['error' => 'UNAUTHORIZED'], 401);
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
    // Handle +66 or 66 prefix (Thai country code)
    if (strlen($digits) > 10 && strpos($digits, '66') === 0) {
        $digits = '0' . substr($digits, 2);
    }
    // Add leading 0 for 9-digit Thai mobile numbers (starting with 6, 8, or 9)
    if (strlen($digits) === 9 && preg_match('/^[689]/', $digits)) {
        $digits = '0' . $digits;
    }
    return $digits ?: null;
}

function normalize_payment_method($val) {
    $v = strtolower(trim((string)$val));
    if (in_array($v, ['cod', 'c.o.d', 'cash_on_delivery', 'เก็บเงินปลายทาง'])) return 'COD';
    if (in_array($v, ['transfer', 'bank_transfer', 'โอน', 'โอนเงิน'])) return 'Transfer';
    return 'COD';
}

$input = json_input();
if (!isset($input['rows']) || !is_array($input['rows'])) {
    json_response(['error' => 'INVALID_INPUT', 'message' => 'Missing rows array'], 400);
}

$rows = $input['rows'];
$totalRows = count($rows);

$summary = [
    'totalRows' => $totalRows,
    'createdCustomers' => 0,
    'updatedCustomers' => 0,
    'createdOrders' => 0,
    'updatedOrders' => 0,
    'waitingBasket' => 0,
    'caretakerConflicts' => 0,
    'notes' => []
];

// ========================================
// STEP 1: Pre-validate all salespersonIds (FAST)
// ========================================
$allSpIds = [];
foreach ($rows as $i => $row) {
    $spId = sanitize_value($row['salespersonId'] ?? null);
    if (!$spId) {
        json_response(['error' => 'VALIDATION_ERROR', 'message' => "แถวที่ " . ($i+2) . ": กรุณาระบุรหัสพนักงานขาย"], 400);
    }
    $allSpIds[$spId] = true;
}

// Batch fetch all salespersons
$spPlaceholders = implode(',', array_fill(0, count($allSpIds), '?'));
$spIds = array_keys($allSpIds);
$stmt = $pdo->prepare("SELECT id, username, role FROM users WHERE (username IN ($spPlaceholders) OR id IN ($spPlaceholders)) AND company_id = ?");
$params = array_merge($spIds, $spIds, [$user['company_id']]);
$stmt->execute($params);
$validSp = [];
while ($u = $stmt->fetch()) {
    $validSp[$u['username']] = $u;
    $validSp[$u['id']] = $u;
}

foreach ($spIds as $spId) {
    if (!isset($validSp[$spId])) {
        json_response(['error' => 'VALIDATION_ERROR', 'message' => "ไม่พบรหัสพนักงาน '$spId'"], 400);
    }
}

// ========================================
// STEP 2: Pre-fetch all products
// ========================================
$products = [];
$stmt = $pdo->prepare("SELECT id, sku FROM products WHERE company_id = ?");
$stmt->execute([$user['company_id']]);
while ($p = $stmt->fetch()) {
    $products[strtolower($p['sku'])] = $p['id'];
}

// ========================================
// STEP 3: Group rows by order
// ========================================
$grouped = [];
$currentAutoId = null;
$currentCriteria = null;

foreach ($rows as $idx => $row) {
    $rawOrderId = sanitize_value($row['orderNumber'] ?? null);
    
    if ($rawOrderId) {
        $orderId = $rawOrderId;
        $currentAutoId = null;
    } else {
        $phone = normalize_phone($row['customerPhone'] ?? null);
        $rawDate = sanitize_value($row['saleDate'] ?? null);
        $normDate = date('Ymd');
        if ($rawDate) {
            $ts = strtotime(str_replace('/', '-', $rawDate));
            if ($ts) $normDate = date('Ymd', $ts);
        }
        
        if ($currentAutoId && $currentCriteria && 
            $currentCriteria['phone'] === $phone && 
            $currentCriteria['date'] === $normDate) {
            $orderId = $currentAutoId;
        } else {
            $orderId = "{$normDate}-" . str_pad($idx+1, 6, '0', STR_PAD_LEFT) . "EXT";
            $currentAutoId = $orderId;
            $currentCriteria = ['phone' => $phone, 'date' => $normDate];
        }
    }
    
    if (!isset($grouped[$orderId])) {
        $grouped[$orderId] = ['rows' => [], 'idx' => $idx];
    }
    $grouped[$orderId]['rows'][] = $row;
}

// ========================================
// STEP 4: Pre-fetch existing orders (batch)
// ========================================
$orderIds = array_keys($grouped);
$existingOrders = [];
if (count($orderIds) > 0) {
    $chunks = array_chunk($orderIds, 500);
    foreach ($chunks as $chunk) {
        $placeholders = implode(',', array_fill(0, count($chunk), '?'));
        $stmt = $pdo->prepare("SELECT id FROM orders WHERE id IN ($placeholders) AND company_id = ?");
        $stmt->execute(array_merge($chunk, [$user['company_id']]));
        while ($o = $stmt->fetch()) {
            $existingOrders[$o['id']] = true;
        }
    }
}

// ========================================
// STEP 5: Pre-fetch existing customers by phone (batch)
// Uses FUZZY matching: search both 9-digit and 10-digit formats
// ========================================
$allPhones = [];
$phoneVariants = []; // Maps normalized phone -> [variant1, variant2]

foreach ($grouped as $orderId => $group) {
    if (isset($existingOrders[$orderId])) continue;
    $phone = normalize_phone($group['rows'][0]['customerPhone'] ?? null);
    if ($phone) {
        $allPhones[$phone] = true;
        
        // Generate phone variants for fuzzy matching
        $variants = [$phone];
        // If 10 digits starting with 0, also search without leading 0
        if (strlen($phone) === 10 && $phone[0] === '0') {
            $variants[] = substr($phone, 1); // 9-digit version
        }
        // If 9 digits starting with 6,8,9, also search with leading 0
        if (strlen($phone) === 9 && preg_match('/^[689]/', $phone)) {
            $variants[] = '0' . $phone; // 10-digit version
        }
        $phoneVariants[$phone] = $variants;
    }
}

$existingCustomers = [];
if (count($allPhones) > 0) {
    // Collect all phone variants to search
    $allSearchPhones = [];
    foreach ($phoneVariants as $originalPhone => $variants) {
        foreach ($variants as $v) {
            $allSearchPhones[$v] = $originalPhone; // Map variant -> original
        }
    }
    
    $chunks = array_chunk(array_keys($allSearchPhones), 500);
    foreach ($chunks as $chunk) {
        $placeholders = implode(',', array_fill(0, count($chunk), '?'));
        $stmt = $pdo->prepare("SELECT customer_id, phone, assigned_to FROM customers WHERE phone IN ($placeholders) AND company_id = ?");
        $stmt->execute(array_merge($chunk, [$user['company_id']]));
        while ($c = $stmt->fetch()) {
            // Store by the DB phone
            $existingCustomers[$c['phone']] = $c;
            // Also store by original phone from CSV (for quick lookup later)
            if (isset($allSearchPhones[$c['phone']])) {
                $originalPhone = $allSearchPhones[$c['phone']];
                if (!isset($existingCustomers[$originalPhone])) {
                    $existingCustomers[$originalPhone] = $c;
                }
            }
        }
    }
}

// ========================================
// STEP 6: Process in single transaction (FAST)
// ========================================
$pdo->beginTransaction();

try {
    $nowStr = date('Y-m-d H:i:s');
    $expireDate = date('Y-m-d H:i:s', strtotime('+90 days'));
    
    // Prepare statements once
    $stmtInsCustomer = $pdo->prepare("INSERT INTO customers (
        customer_ref_id, first_name, last_name, phone, email, 
        street, subdistrict, district, province, postal_code,
        company_id, assigned_to, date_assigned, date_registered, ownership_expires,
        lifecycle_status, behavioral_status, grade, total_purchases
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'New', 'Cold', 'Standard', 0)");
    
    $stmtInsOrder = $pdo->prepare("INSERT INTO orders (
        id, customer_id, company_id, creator_id,
        order_date, delivery_date, 
        recipient_first_name, recipient_last_name, 
        street, subdistrict, district, province, postal_code,
        total_amount, payment_method, payment_status, 
        order_status, shipping_cost, customer_type
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Approved', 'Delivered', 0, 'New Customer')");
    
    $stmtInsItem = $pdo->prepare("INSERT INTO order_items (
        order_id, parent_order_id, creator_id, 
        product_id, product_name, quantity, price_per_unit, discount, net_total, box_number
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)");
    
    $stmtInsBox = $pdo->prepare("INSERT INTO order_boxes (
        order_id, sub_order_id, box_number, cod_amount, collection_amount, collected_amount
    ) VALUES (?, ?, 1, ?, ?, ?)");
    
    foreach ($grouped as $orderId => $group) {
        // Skip existing orders
        if (isset($existingOrders[$orderId])) {
            continue;
        }
        
        $first = $group['rows'][0];
        $phone = normalize_phone($first['customerPhone'] ?? null);
        if (!$phone) continue;
        
        // Get salesperson
        $spId = sanitize_value($first['salespersonId'] ?? null);
        $sp = $validSp[$spId];
        $creatorId = $sp['id'];
        
        // Customer
        $customerPk = null;
        if (isset($existingCustomers[$phone])) {
            $customerPk = $existingCustomers[$phone]['customer_id'];
        } else {
            // Create customer
            $firstName = sanitize_value($first['customerFirstName'] ?? null) ?: 'Customer';
            $lastName = sanitize_value($first['customerLastName'] ?? null) ?: '';
            $refId = "CUS-{$phone}-{$user['company_id']}";
            
            $stmtInsCustomer->execute([
                $refId, $firstName, $lastName, $phone, sanitize_value($first['customerEmail'] ?? null),
                sanitize_value($first['address'] ?? null),
                sanitize_value($first['subdistrict'] ?? null),
                sanitize_value($first['district'] ?? null),
                sanitize_value($first['province'] ?? null),
                sanitize_value($first['postalCode'] ?? null),
                $user['company_id'], null, $nowStr, $nowStr, null
            ]);
            $customerPk = $pdo->lastInsertId();
            $existingCustomers[$phone] = ['customer_id' => $customerPk];
            $summary['createdCustomers']++;
            $summary['waitingBasket']++;
        }
        
        // Calculate total
        $totalAmount = 0;
        $items = [];
        foreach ($group['rows'] as $row) {
            $sku = sanitize_value($row['productCode'] ?? null);
            if ($sku) $sku = preg_replace('/-[0-9]+$/', '', $sku);
            
            $pName = sanitize_value($row['productName'] ?? null) ?: ($sku ?: 'Item');
            $qty = floatval($row['quantity'] ?? 1);
            $price = floatval($row['unitPrice'] ?? 0);
            $discount = floatval($row['discount'] ?? 0);
            $lineTotal = floatval($row['totalAmount'] ?? 0) ?: ($price * $qty - $discount);
            
            $prodId = $sku ? ($products[strtolower($sku)] ?? null) : null;
            
            $items[] = [$prodId, $pName, $qty, $price, $discount, $lineTotal];
            $totalAmount += $lineTotal;
        }
        
        // Parse date
        $rawDate = sanitize_value($first['saleDate'] ?? null);
        $orderDate = $nowStr;
        if ($rawDate) {
            $ts = strtotime(str_replace('/', '-', $rawDate));
            if ($ts) $orderDate = date('Y-m-d H:i:s', $ts);
        }
        
        $paymentMethod = normalize_payment_method($first['paymentMethod'] ?? '');
        $firstName = sanitize_value($first['customerFirstName'] ?? null) ?: 'Customer';
        $lastName = sanitize_value($first['customerLastName'] ?? null) ?: '';
        
        // Insert order
        $stmtInsOrder->execute([
            $orderId, $customerPk, $user['company_id'], $creatorId,
            $orderDate, $orderDate,
            $firstName, $lastName,
            sanitize_value($first['address'] ?? null),
            sanitize_value($first['subdistrict'] ?? null),
            sanitize_value($first['district'] ?? null),
            sanitize_value($first['province'] ?? null),
            sanitize_value($first['postalCode'] ?? null),
            $totalAmount, $paymentMethod
        ]);
        
        // Insert items
        $subOrderId = $orderId . '-1';
        foreach ($items as $item) {
            $stmtInsItem->execute([
                $subOrderId, $orderId, $creatorId,
                $item[0], $item[1], $item[2], $item[3], $item[4], $item[5]
            ]);
        }
        
        // Insert box
        $stmtInsBox->execute([$orderId, $subOrderId, $totalAmount, $totalAmount, $totalAmount]);
        
        $summary['createdOrders']++;
    }
    
    $pdo->commit();
    
} catch (Exception $e) {
    $pdo->rollBack();
    json_response(['error' => 'IMPORT_FAILED', 'message' => $e->getMessage()], 500);
}

json_response($summary);
