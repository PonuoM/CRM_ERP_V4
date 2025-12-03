<?php
/**
 * Script สำหรับตรวจสอบปัญหาการติดตามที่ไม่เพิ่มวันให้กับ ownership_expires
 * 
 * Usage: php debug_customer_followup.php?customerId=100007
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
    
    // ดึงข้อมูลลูกค้า
    $stmt = $pdo->prepare('SELECT * FROM customers WHERE id = ? OR customer_ref_id = ?');
    $stmt->execute([$customerId, $customerId]);
    $customer = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$customer) {
        echo json_encode([
            'ok' => false,
            'error' => 'Customer not found',
            'customerId' => $customerId
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        exit;
    }
    
    $now = new DateTime();
    $currentExpiry = $customer['ownership_expires'] ? new DateTime($customer['ownership_expires']) : null;
    $bonusRemaining = isset($customer['followup_bonus_remaining']) ? (int)$customer['followup_bonus_remaining'] : 1;
    
    // คำนวณวันหมดอายุใหม่ (ตาม logic ใน handleFollowUpQuota)
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
    
    // คำนวณวันคงเหลือ
    $daysRemaining = null;
    if ($currentExpiry) {
        $diff = $now->diff($currentExpiry);
        $daysRemaining = $currentExpiry > $now ? $diff->days : -$diff->days;
    }
    
    $daysToMaxAllowed = null;
    if ($maxAllowed) {
        $diff = $now->diff($maxAllowed);
        $daysToMaxAllowed = $maxAllowed > $now ? $diff->days : -$diff->days;
    }
    
    $result = [
        'ok' => true,
        'customer' => [
            'id' => $customer['id'],
            'customer_ref_id' => $customer['customer_ref_id'],
            'name' => ($customer['first_name'] ?? '') . ' ' . ($customer['last_name'] ?? ''),
        ],
        'current_state' => [
            'ownership_expires' => $customer['ownership_expires'],
            'days_remaining' => $daysRemaining,
            'followup_bonus_remaining' => $bonusRemaining,
            'follow_up_count' => $customer['follow_up_count'] ?? 0,
            'last_follow_up_date' => $customer['last_follow_up_date'] ?? null,
            'has_sold_before' => $customer['has_sold_before'] ?? 0,
            'last_sale_date' => $customer['last_sale_date'] ?? null,
        ],
        'analysis' => [
            'can_extend' => $bonusRemaining > 0,
            'reason_cannot_extend' => $bonusRemaining <= 0 ? 'โควต้าหมดแล้ว (followup_bonus_remaining = 0)' : null,
            'current_expiry_date' => $currentExpiry ? $currentExpiry->format('Y-m-d H:i:s') : null,
            'would_be_new_expiry' => $newExpiry ? $newExpiry->format('Y-m-d H:i:s') : null,
            'max_allowed_expiry' => $maxAllowed ? $maxAllowed->format('Y-m-d H:i:s') : null,
            'would_be_clamped' => $wouldBeClamped,
            'days_to_max_allowed' => $daysToMaxAllowed,
            'would_change' => $newExpiry && $currentExpiry && $newExpiry->format('Y-m-d H:i:s') !== $currentExpiry->format('Y-m-d H:i:s'),
        ],
        'diagnosis' => []
    ];
    
    // วินิจฉัยปัญหา
    if ($bonusRemaining <= 0) {
        $result['diagnosis'][] = '❌ โควต้าหมดแล้ว: followup_bonus_remaining = ' . $bonusRemaining . ' (ต้องเป็น > 0 ถึงจะเพิ่มวันได้)';
        $result['diagnosis'][] = '💡 วิธีแก้: ต้องปิดการขาย (Sale) เพื่อรีเซ็ต followup_bonus_remaining กลับเป็น 1';
    } else {
        $result['diagnosis'][] = '✅ โควต้ายังมี: followup_bonus_remaining = ' . $bonusRemaining;
    }
    
    if ($currentExpiry && $newExpiry) {
        if ($wouldBeClamped) {
            $result['diagnosis'][] = '⚠️ จะถูก Clamp: วันหมดอายุเดิม + 90 วัน เกิน 90 วันจากวันนี้';
            $result['diagnosis'][] = '   วันหมดอายุเดิม: ' . $currentExpiry->format('Y-m-d H:i:s');
            $result['diagnosis'][] = '   วันหมดอายุใหม่ (หลัง clamp): ' . $newExpiry->format('Y-m-d H:i:s');
            
            if ($newExpiry->format('Y-m-d H:i:s') === $currentExpiry->format('Y-m-d H:i:s')) {
                $result['diagnosis'][] = '❌ ปัญหา: วันหมดอายุใหม่เท่ากับวันเดิม (ไม่มีการเปลี่ยนแปลง)';
                $result['diagnosis'][] = '   สาเหตุ: วันหมดอายุเดิมอยู่ใกล้หรือเกิน 90 วันจากวันนี้แล้ว';
            } else {
                $result['diagnosis'][] = '✅ วันหมดอายุจะเปลี่ยนจาก ' . $currentExpiry->format('Y-m-d H:i:s') . ' เป็น ' . $newExpiry->format('Y-m-d H:i:s');
            }
        } else {
            $result['diagnosis'][] = '✅ ไม่ถูก Clamp: วันหมดอายุจะเพิ่ม 90 วัน';
            $result['diagnosis'][] = '   จาก: ' . $currentExpiry->format('Y-m-d H:i:s');
            $result['diagnosis'][] = '   เป็น: ' . $newExpiry->format('Y-m-d H:i:s');
        }
    }
    
    if (!$currentExpiry) {
        $result['diagnosis'][] = '❌ ไม่มี ownership_expires';
    }
    
    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => $e->getMessage(),
        'file' => basename($e->getFile()),
        'line' => $e->getLine(),
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
}

