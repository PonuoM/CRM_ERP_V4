<?php
// อนุญาตให้รับ Request
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");

// นำเข้า config หลักของระบบ ERP เพื่อใช้เชื่อมต่อฐานข้อมูล
require_once __DIR__ . '/config.php';

// รับค่า JSON จาก Webhook
$jsonInput = file_get_contents('php://input');
$data = json_decode($jsonInput, true);

// ตรวจสอบว่ามีข้อมูลส่งมาหรือไม่
if (!$data || !isset($data['conversation_id'])) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Invalid JSON payload']);
    exit;
}

try {
    // ใช้ฟังก์ชัน db_connect() จากไฟล์ config.php
    $pdo = db_connect();

    // ค้นหาลูกค้า
    // ตัด 0 ข้างหน้า และตัวอักษรที่ไม่ใช่ตัวเลขออก เผื่อรูปแบบเบอร์ไม่ตรงกัน
    $callerPhone = preg_replace('/^0+/', '', preg_replace('/\D/', '', $data['caller_phone'] ?? ''));
    $receiverPhone = preg_replace('/^0+/', '', preg_replace('/\D/', '', $data['receiver_phone'] ?? ''));
    $searchPhone = !empty($callerPhone) ? $callerPhone : $receiverPhone;

    if (!empty($searchPhone)) {
        // ค้นหาว่าเบอร์ตรงกับลูกค้าคนไหน
        $stmt = $pdo->prepare("
            SELECT customer_id 
            FROM customers 
            WHERE phone LIKE ? OR backup_phone LIKE ? 
            LIMIT 1
        ");
        $stmt->execute(["%$searchPhone%", "%$searchPhone%"]);
        $customer = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($customer) {
            $customerId = $customer['customer_id'];
            $callDate = ($data['call_date'] ?? date('Y-m-d')) . ' ' . ($data['call_time'] ?? date('H:i:s'));
            
            // ดึงข้อมูลสรุป
            $execSummary = $data['summary']['executive_summary'] ?? '-';
            $sentiment = $data['summary']['customer_sentiment'] ?? '-';
            $complaint = $data['sales_and_issues']['complaint_or_reason'] ?? '';
            $outcome = $data['sales_and_issues']['sale_outcome'] ?? '';
            $issueCategory = $data['sales_and_issues']['issue_category'] ?? '';

            // จัดรูปแบบข้อความที่จะบันทึก
            $notes = "🎯 สรุปจาก Voicecall AI: " . $execSummary;
            if (!empty($complaint)) {
                $notes .= "\n⚠️ ปัญหา/เหตุผล: " . $complaint;
            }
            $notes .= "\n(อารมณ์ลูกค้า: {$sentiment})";

            // บันทึกข้อมูลประวัติการโทรลงตาราง call_history
            $insertStmt = $pdo->prepare("
                INSERT INTO call_history (customer_id, date, caller, caller_id, status, result, notes) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ");
            $insertStmt->execute([
                $customerId, 
                $callDate, 
                'Voicecall AI', 
                null, 
                $outcome, 
                $issueCategory, 
                $notes
            ]);

            // อัปเดตคอลัมน์แคชที่ Distribution V2 ใช้เรียงลำดับการแจก (ดู migration 087)
            // สายจาก Voicecall AI ที่มีสรุปบทสนทนากลับมา = คุยกับลูกค้าได้จริง จึงนับเป็น "โทรติด"
            // (status ที่ได้จาก AI เป็นคนละชุดคำกับที่เทเลกดในระบบ เทียบตรง ๆ ไม่ได้)
            try {
                $pdo->prepare(
                    'UPDATE customers
                        SET total_calls = COALESCE(total_calls,0) + 1,
                            last_call_date = ?,
                            last_talk_at = ?
                      WHERE customer_id = ?'
                )->execute([$callDate, $callDate, $customerId]);
            } catch (Throwable $e) {
                error_log('webhook_voicecall: update customer call cache failed - ' . $e->getMessage());
            }
        }
    }

    // ส่ง HTTP 200 OK กลับไปให้ Voicecall 
    http_response_code(200);
    echo json_encode(['status' => 'success']);

} catch (Exception $e) {
    // กรณีมี Error จากฐานข้อมูล
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'DB Error: ' . $e->getMessage()]);
}
