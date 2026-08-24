<?php
/**
 * เก็บไฟล์ PDF ของใบ SO/ใบขน (ใบจองสินค้า/ใบสั่งขายจาก e-acc) ไว้เป็นหลักฐาน
 *
 * รับไฟล์ตอนผู้ใช้นำเข้า PDF แล้วคืน path กลับไป ให้ฟอร์มส่งมาพร้อมตอนบันทึก SO/ใบขน
 * ไฟล์ที่อัปแล้วแต่ผู้ใช้กดยกเลิกจะค้างอยู่บนดิสก์ (ไฟล์ละ ~200KB) ยอมแลกกับความง่าย
 * ถ้าวันหนึ่งกินที่มาก ให้เขียน cron ลบไฟล์ที่ไม่มีแถวไหนใน DB อ้างถึงเกิน 30 วัน
 */
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once '../config.php';
require_once 'production_permission.php';

const MAX_PDF_BYTES = 15 * 1024 * 1024; // 15MB -- ใบจริงราว 200KB เผื่อใบยาว ๆ ไว้เยอะแล้ว

try {
    $pdo = db_connect();
    $userId = $_POST['user_id'] ?? null;
    production_require_manage($pdo, $userId);

    if (empty($_FILES['file']) || ($_FILES['file']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        throw new Exception('ไม่ได้รับไฟล์ หรืออัปโหลดไม่สำเร็จ');
    }

    $file = $_FILES['file'];
    if ((int)$file['size'] <= 0 || (int)$file['size'] > MAX_PDF_BYTES) {
        throw new Exception('ไฟล์ใหญ่เกิน 15MB หรือไฟล์ว่าง');
    }

    // ดูจากเนื้อไฟล์จริง ไม่เชื่อชื่อไฟล์หรือ mime ที่เบราว์เซอร์แจ้งมา
    $head = file_get_contents($file['tmp_name'], false, null, 0, 5);
    if (strpos((string)$head, '%PDF-') !== 0) {
        throw new Exception('รองรับเฉพาะไฟล์ PDF');
    }

    $subDir = date('Ym');
    $baseDir = __DIR__ . '/../uploads/production_docs';
    $dir = $baseDir . '/' . $subDir;
    if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
        throw new Exception('สร้างโฟลเดอร์เก็บไฟล์ไม่สำเร็จ');
    }

    // ชื่อไฟล์บนดิสก์สุ่มเสมอ -- ชื่อเดิมเก็บไว้ใน DB (source_file) เพื่อโชว์ให้คนอ่าน
    $name = bin2hex(random_bytes(12)) . '.pdf';
    $target = $dir . '/' . $name;
    if (!move_uploaded_file($file['tmp_name'], $target)) {
        throw new Exception('ย้ายไฟล์ไปที่เก็บไม่สำเร็จ');
    }
    @chmod($target, 0644);

    echo json_encode([
        'success' => true,
        'data' => [
            'path' => 'uploads/production_docs/' . $subDir . '/' . $name,
            'size' => (int)$file['size'],
            'original_name' => (string)$file['name'],
        ],
    ]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
