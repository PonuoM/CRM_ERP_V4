<?php

ini_set('display_errors', 0);
error_reporting(E_ALL);
function log_error($msg) {
    file_put_contents(__DIR__ . '/error.log', date('[Y-m-d H:i:s] ') . $msg . "\n", FILE_APPEND);
}
set_exception_handler(function($e) {
    log_error("Uncaught Exception: " . $e->getMessage() . " in " . $e->getFile() . ":" . $e->getLine());
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
    exit;
});
set_error_handler(function($errno, $errstr, $errfile, $errline) {
    log_error("Error ($errno): $errstr in $errfile:$errline");
    return false; // let normal error handler continue
});

require_once __DIR__ . '/../config.php';

cors();
log_error("Request started");
try {
    $pdo = db_connect();
} catch (Exception $e) {
    log_error("DB Connect failed: " . $e->getMessage());
    throw $e;
}

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

function normalize_payment_method($val) {
    $v = strtolower(trim((string)$val));
    if (in_array($v, ['cod', 'c.o.d', 'cash_on_delivery', 'เก็บเงินปลายทาง'])) return 'COD';
    if (in_array($v, ['transfer', 'bank_transfer', 'โอน', 'โอนเงิน'])) return 'Transfer';
    return 'COD'; // Default
}

function normalize_payment_status($val) {
    $v = strtolower(trim((string)$val));
    if (in_array($v, ['paid', 'ชำระแล้ว'])) return 'Paid';
    if (in_array($v, ['unpaid', 'ยังไม่ชำระ'])) return 'Unpaid';
    return 'Unpaid';
}

function determine_lifecycle_status($caretaker_id, $date_reg) {
    if (!$caretaker_id) return 'Lead'; // New Lead
    // Simplified logic: if caretaker exists, assume Customer or Lead based on logic, but default to Customer if buying?
    // App.tsx: determineLifecycleStatusForImport... Logic is complex. 
    // Defaulting to 'Customer' if buying (Import Sales), or 'Lead' if just import.
    // For Sales Import, they are buying, so likely 'Customer'.
    return 'Customer'; 
}

function calculate_grade($purchases) {
    $p = (float)$purchases;
    if ($p >= 100000) return 'Platinum';
    if ($p >= 50000) return 'Gold';
    if ($p >= 10000) return 'Silver';
    return 'Standard';
}

$input = json_input();
if (!isset($input['rows']) || !is_array($input['rows'])) {
    json_response(['error' => 'INVALID_INPUT', 'message' => 'Missing rows array'], 400);
}

$rows = $input['rows'];
$summary = [
    'totalRows' => count($rows),
    'createdCustomers' => 0,
    'updatedCustomers' => 0, // We generally don't update in import unless specified
    'createdOrders' => 0,
    'notes' => []
];

// 1. Group Rows
$grouped = []; // orderId => { rows: [], firstIndex: int }
$currentAutoOrderId = null;
$currentAutoGroupCriteria = null;

foreach ($rows as $index => $row) {
    $rawOrderId = sanitize_value($row['orderNumber'] ?? null);
    
    if ($rawOrderId) {
        $orderId = $rawOrderId;
        $currentAutoOrderId = null;
        $currentAutoGroupCriteria = null;
    } else {
        $rowPhone = sanitize_value($row['customerPhone'] ?? null);
        $rowDate = sanitize_value($row['saleDate'] ?? null);

        if ($currentAutoOrderId && $currentAutoGroupCriteria && 
            $currentAutoGroupCriteria['phone'] === $rowPhone && 
            $currentAutoGroupCriteria['date'] === $rowDate) {
            $orderId = $currentAutoOrderId;
        } else {
            $ts = $rowDate ? strtotime($rowDate) : time();
            $datePart = date('Ymd', $ts);
            $seq = str_pad((string)($index + 1), 6, '0', STR_PAD_LEFT);
            $orderId = "{$datePart}-{$seq}EXTERNAL";
            
            $currentAutoOrderId = $orderId;
            $currentAutoGroupCriteria = ['phone' => $rowPhone, 'date' => $rowDate];
        }
    }
    
    if (!isset($grouped[$orderId])) {
        $grouped[$orderId] = ['rows' => [], 'firstIndex' => $index];
    }
    $grouped[$orderId]['rows'][] = $row;
}

// Pre-fetch all products
$products = [];
$stmt = $pdo->prepare("SELECT * FROM products WHERE company_id = ?");
$stmt->execute([$user['company_id']]);
while ($p = $stmt->fetch()) {
    $products[] = $p;
}

// 2. Process Groups
foreach ($grouped as $orderId => $group) {
    $orderRows = $group['rows'];
    $first = $orderRows[0];
    
    // --- Step A: Customer ---
    $customerNameStr = (string)sanitize_value($first['customerName'] ?? '');
    $customerFirstName = sanitize_value($first['customerFirstName'] ?? null) ?: (explode(' ', $customerNameStr)[0] ?? 'Customer');
    $customerLastName = sanitize_value($first['customerLastName'] ?? null) ?: (implode(' ', array_slice(explode(' ', $customerNameStr), 1)) ?? '');
    
    $rawPhone = sanitize_value($first['customerPhone'] ?? null);
    $phone = normalize_phone($rawPhone);
    
    if (!$phone) {
        $summary['notes'][] = "Order $orderId: Skipped due to missing phone.";
        continue;
    }
    
    // Resolve Customer ID
    $customerRefId = sanitize_value($first['customerId'] ?? null);
    if (!$customerRefId) {
        // Try to find existing
        // Search by phone
        $stmt = $pdo->prepare("SELECT customer_id, customer_ref_id, first_name FROM customers WHERE phone = ? AND company_id = ?");
        $stmt->execute([$phone, $user['company_id']]);
        $existing = $stmt->fetch();
        
        if ($existing) {
            $customerRefId = $existing['customer_ref_id'];
            $customerPk = $existing['customer_id'];
        } else {
            // Generate New ID
            $customerRefId = "CUS-{$phone}-{$user['company_id']}";
            // Check collision
            $chk = $pdo->prepare("SELECT COUNT(*) FROM customers WHERE customer_ref_id = ?");
            $chk->execute([$customerRefId]);
            if ($chk->fetchColumn() > 0) {
                 $suffix = 1;
                 while (true) {
                     $tryId = "CUS{$suffix}-{$phone}-{$user['company_id']}";
                     $chk->execute([$tryId]);
                     if ($chk->fetchColumn() == 0) {
                         $customerRefId = $tryId;
                         break;
                     }
                     $suffix++;
                     if ($suffix > 20) { $customerRefId .= "-".time(); break; }
                 }
            }
        }
    }
    
    // Ensure Customer Exists
    // Check again
    $stmt = $pdo->prepare("SELECT * FROM customers WHERE customer_ref_id = ? AND company_id = ?");
    $stmt->execute([$customerRefId, $user['company_id']]);
    $existingCustomer = $stmt->fetch();
    
    $customerPk = null;
    
    if (!$existingCustomer) {
        // Create
        try {
            $insertSql = "INSERT INTO customers (
                customer_ref_id, first_name, last_name, phone, email, 
                street, subdistrict, district, province, postal_code,
                company_id, assigned_to, date_registered, 
                lifecycle_status, behavioral_status, grade, total_purchases
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
            
            $assignedTo = $user['id']; 
            
            $spId = sanitize_value($first['salespersonId'] ?? null);
            $resolvedAssignedTo = $assignedTo;
            if ($spId) {
                $uStmt = $pdo->prepare("SELECT id FROM users WHERE (username = ? OR id = ?) AND company_id = ?");
                $uStmt->execute([$spId, $spId, $user['company_id']]);
                $foundU = $uStmt->fetch();
                if ($foundU) $resolvedAssignedTo = $foundU['id'];
            }
            
            $now = date('Y-m-d H:i:s');
            // address parts
            $addr = sanitize_value($first['address'] ?? null);
            $sub = sanitize_value($first['subdistrict'] ?? null);
            $dist = sanitize_value($first['district'] ?? null);
            $prov = sanitize_value($first['province'] ?? null);
            $zip = sanitize_value($first['postalCode'] ?? null);
            $email = sanitize_value($first['customerEmail'] ?? null);
            
            $stmtIns = $pdo->prepare($insertSql);
            $stmtIns->execute([
                $customerRefId, $customerFirstName, $customerLastName, $phone, $email,
                $addr, $sub, $dist, $prov, $zip,
                $user['company_id'], $resolvedAssignedTo, $now,
                'Customer', 'Cold', 'Standard', 0
            ]);
            $customerPk = $pdo->lastInsertId();
            $summary['createdCustomers']++;
        } catch (Exception $e) {
            $summary['notes'][] = "Order $orderId: Failed to create customer $customerRefId: " . $e->getMessage();
            continue;
        }
    } else {
        $customerPk = $existingCustomer['customer_id'];
    }
    
    // --- Step B: Check Order ---
    $stmt = $pdo->prepare("SELECT id FROM orders WHERE id = ? AND company_id = ?");
    $stmt->execute([$orderId, $user['company_id']]);
    if ($stmt->fetch()) {
        $summary['notes'][] = "Order $orderId: Already exists, skipped.";
        continue;
    }
    
    // --- Step C: Order Logic ---
    $orderDate = sanitize_value($first['saleDate'] ?? null) ?: date('Y-m-d H:i:s');
    // Ensure ISO format
    $orderDate = date('Y-m-d H:i:s', strtotime($orderDate));
    
    $totalAmount = 0;
    $items = [];
    
    foreach ($orderRows as $idx => $row) {
        $sku = sanitize_value($row['productCode'] ?? null);
        $pName = sanitize_value($row['productName'] ?? null) ?: ($sku ?: "Item " . ($idx+1));
        $qty = floatval($row['quantity'] ?? 1);
        $price = floatval($row['unitPrice'] ?? 0);
        $discount = floatval($row['discount'] ?? 0);
        
        // Find product
        $prodId = null;
        if ($sku) {
            foreach ($products as $p) {
                if (strcasecmp($p['sku'], $sku) === 0) {
                    $prodId = $p['id'];
                    break;
                }
            }
        }
        // Fallback
        if (!$prodId) {
            $fallbackSku = "UNKNOWN-PRODUCT-COMPANY{$user['company_id']}";
            foreach ($products as $p) {
                if ($p['sku'] === $fallbackSku) {
                    $prodId = $p['id'];
                    break;
                }
            }
        }
        
        $linesTotal = ($price * $qty) - $discount;
        $totalAmount += $linesTotal;
        
        $items[] = [
            'product_id' => $prodId,
            'product_name' => $pName,
            'quantity' => $qty,
            'price_per_unit' => $price,
            'discount' => $discount,
            'net_total' => $linesTotal
        ];
    }
    
    $paymentMethod = normalize_payment_method($first['paymentMethod'] ?? '');
    $paymentStatus = normalize_payment_status($first['paymentStatus'] ?? '');
    
    $shippingCost = 0; // Import default
    // If imports have shipping cost, add it? App.tsx hardcoded 0.
    
    // Insert Order
    try {
        $pdo->beginTransaction();
        
        $sql = "INSERT INTO orders (
            id, customer_id, company_id, creator_id,
            order_date, delivery_date, 
            recipient_first_name, recipient_last_name, 
            street, subdistrict, district, province, postal_code,
            total_amount, payment_method, payment_status, 
            order_status, shipping_cost
        ) VALUES (
            ?, ?, ?, ?,
            ?, ?,
            ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?
        )";
        
        $creatorId = $user['id']; // Or mapped salesperson
        $recipFirst = sanitize_value($first['recipientFirstName'] ?? null) ?: $customerFirstName;
        $recipLast = sanitize_value($first['recipientLastName'] ?? null) ?: $customerLastName;
        
        $addr = sanitize_value($first['address'] ?? null);
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            $orderId, $customerPk, $user['company_id'], $creatorId,
            $orderDate, $orderDate, // delivery = order date default
            $recipFirst, $recipLast,
            $addr, sanitize_value($first['subdistrict'] ?? null), sanitize_value($first['district'] ?? null), sanitize_value($first['province'] ?? null), sanitize_value($first['postalCode'] ?? null),
            $totalAmount, $paymentMethod, $paymentStatus,
            'Pending', $shippingCost
        ]);
        
        // Items
        $itemSql = "INSERT INTO order_items (
            order_id, parent_order_id, creator_id, 
            product_id, product_name, quantity, price_per_unit, discount, net_total, 
            box_number
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        $stmtItem = $pdo->prepare($itemSql);
        
        foreach ($items as $item) {
             // Defaulting to box 1 for imports
             $boxNum = 1;
             
             $stmtItem->execute([
                 $orderId, $orderId, $creatorId,
                 $item['product_id'], $item['product_name'], 
                 $item['quantity'], $item['price_per_unit'], $item['discount'], $item['net_total'],
                 $boxNum
             ]);
        }
        
        $pdo->commit();
        $summary['createdOrders']++;
        
    } catch (Exception $e) {
        $pdo->rollBack();
        $summary['notes'][] = "Order $orderId: Insert failed: " . $e->getMessage();
    }
}

json_response($summary);
