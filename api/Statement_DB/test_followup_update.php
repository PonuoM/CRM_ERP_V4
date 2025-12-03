<?php
/**
 * Script สำหรับทดสอบการอัปเดต ownership_expires จากการติดตาม
 * 
 * Usage: php test_followup_update.php?customerId=100007
 */

header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");

if (php_sapi_name() === 'cli') {
    require_once __DIR__ . "/../config.php";
} else {
    require_once "../config.php";
}

$customerId = isset($_GET['customerId']) ? $_GET['customerId'] : '100007';

try {
    $pdo = db_connect();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // ดึงข้อมูลลูกค้าก่อนอัปเดต
    $stmt = $pdo->prepare('SELECT * FROM customers WHERE customer_ref_id = ? OR customer_id = ? LIMIT 1');
    $stmt->execute([$customerId, is_numeric($customerId) ? (int)$customerId : null]);
    $customerBefore = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$customerBefore) {
        echo json_encode([
            'ok' => false,
            'error' => 'Customer not found',
            'customerId' => $customerId
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        exit;
    }
    
    $now = new DateTime();
    $currentExpiry = $customerBefore['ownership_expires'] ? new DateTime($customerBefore['ownership_expires']) : null;
    $bonusRemaining = isset($customerBefore['followup_bonus_remaining']) ? (int)$customerBefore['followup_bonus_remaining'] : 1;
    
    // คำนวณวันหมดอายุใหม่
    $newExpiry = null;
    $maxAllowed = null;
    $wouldBeClamped = false;
    
    if ($bonusRemaining > 0 && $currentExpiry) {
        $newExpiry = clone $currentExpiry;
        $newExpiry->add(new DateInterval('P90D'));
        
        $maxAllowed = clone $now;
        $maxAllowed->add(new DateInterval('P90D'));
        
        if ($newExpiry > $maxAllowed) {
            $newExpiry = $maxAllowed;
            $wouldBeClamped = true;
        }
    }
    
    // ทำการอัปเดต
    $updateId = $customerBefore['customer_id'];
    $updateSuccess = false;
    $affectedRows = 0;
    
    if ($bonusRemaining > 0 && $currentExpiry && $newExpiry) {
        $willChange = ($newExpiry->format('Y-m-d H:i:s') !== $currentExpiry->format('Y-m-d H:i:s'));
        
        if ($willChange && $updateId) {
            $upd = $pdo->prepare('UPDATE customers SET ownership_expires = ?, follow_up_count = follow_up_count + 1, last_follow_up_date = ?, followup_bonus_remaining = GREATEST(followup_bonus_remaining - 1, 0) WHERE customer_id = ?');
            $updateSuccess = $upd->execute([$newExpiry->format('Y-m-d H:i:s'), $now->format('Y-m-d H:i:s'), $updateId]);
            $affectedRows = $upd->rowCount();
        }
    }
    
    // ดึงข้อมูลลูกค้าหลังอัปเดต
    $stmt = $pdo->prepare('SELECT * FROM customers WHERE customer_id = ?');
    $stmt->execute([$updateId]);
    $customerAfter = $stmt->fetch(PDO::FETCH_ASSOC);
    
    $result = [
        'ok' => true,
        'test' => [
            'customer_id' => $customerBefore['customer_id'],
            'customer_ref_id' => $customerBefore['customer_ref_id'],
            'update_id_used' => $updateId,
        ],
        'before' => [
            'ownership_expires' => $customerBefore['ownership_expires'],
            'followup_bonus_remaining' => $customerBefore['followup_bonus_remaining'],
            'follow_up_count' => $customerBefore['follow_up_count'] ?? 0,
        ],
        'calculation' => [
            'current_expiry' => $currentExpiry ? $currentExpiry->format('Y-m-d H:i:s') : null,
            'calculated_new_expiry' => $newExpiry ? $newExpiry->format('Y-m-d H:i:s') : null,
            'max_allowed' => $maxAllowed ? $maxAllowed->format('Y-m-d H:i:s') : null,
            'would_be_clamped' => $wouldBeClamped,
            'will_change' => $newExpiry && $currentExpiry ? ($newExpiry->format('Y-m-d H:i:s') !== $currentExpiry->format('Y-m-d H:i:s')) : false,
        ],
        'update_result' => [
            'success' => $updateSuccess,
            'affected_rows' => $affectedRows,
        ],
        'after' => [
            'ownership_expires' => $customerAfter['ownership_expires'] ?? null,
            'followup_bonus_remaining' => $customerAfter['followup_bonus_remaining'] ?? null,
            'follow_up_count' => $customerAfter['follow_up_count'] ?? 0,
        ],
        'verification' => [
            'expiry_changed' => $customerBefore['ownership_expires'] !== $customerAfter['ownership_expires'],
            'expected_new_expiry' => $newExpiry ? $newExpiry->format('Y-m-d H:i:s') : null,
            'actual_new_expiry' => $customerAfter['ownership_expires'] ?? null,
            'match' => $newExpiry && $customerAfter['ownership_expires'] ? ($newExpiry->format('Y-m-d H:i:s') === $customerAfter['ownership_expires']) : false,
        ]
    ];
    
    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => $e->getMessage(),
        'file' => basename($e->getFile()),
        'line' => $e->getLine(),
        'trace' => $e->getTraceAsString()
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
}

