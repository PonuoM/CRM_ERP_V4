<?php
/**
 * เช็คว่าใบที่กำลังจะนำเข้า เคยคีย์เข้าระบบไปแล้วหรือยัง
 *
 * เรียกทันทีหลังอ่าน PDF เสร็จ (ก่อนผู้ใช้กรอกฟอร์ม) จะได้ไม่เสียเวลากรอกจนจบ
 * แล้วค่อยโดนเด้งตอนกดบันทึก
 *
 * เช็ค 2 ทาง:
 *   1) เลขเอกสารซ้ำ  -> เจอแน่นอนว่าเป็นใบเดียวกัน (DB มี unique index กันอยู่แล้ว)
 *   2) ไฟล์ซ้ำ (sha1) -> จับกรณีอัปไฟล์เดิมซ้ำ แม้เลขเอกสารจะพิมพ์ต่างไป
 *
 * GET params: kind=so|dn, doc_no, hash, user_id
 */
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once '../config.php';
require_once 'production_progress.php';

try {
    $pdo = db_connect();

    $kind  = ($_GET['kind'] ?? 'so') === 'dn' ? 'dn' : 'so';
    $docNo = trim($_GET['doc_no'] ?? '');
    $hash  = trim($_GET['hash'] ?? '');

    $isSo   = $kind === 'so';
    $table  = $isSo ? 'production_orders' : 'production_delivery_notes';
    $numCol = $isSo ? 'so_number' : 'dn_number';
    $dateCol = $isSo ? 'so_date' : 'issued_date';

    $cols = production_table_columns($pdo, $table);
    $hasHash = in_array('source_hash', $cols, true);
    $hasFile = in_array('source_file', $cols, true);

    $select = "SELECT t.id, t.`$numCol` AS doc_no, t.`$dateCol` AS doc_date, t.created_at,
                      f.name AS factory_name"
        . ($hasFile ? ", t.source_file" : "")
        . " FROM `$table` t
            LEFT JOIN production_factories f ON f.id = t.factory_id";

    $byNumber = null;
    if ($docNo !== '') {
        $stmt = $pdo->prepare("$select WHERE t.`$numCol` = ? LIMIT 1");
        $stmt->execute([$docNo]);
        $byNumber = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    // ไฟล์ซ้ำอาจมีได้หลายใบ (เช่นเคยคีย์ผิดแล้วคีย์ใหม่) จึงคืนเป็น list
    $byFile = [];
    if ($hash !== '' && $hasHash) {
        $stmt = $pdo->prepare("$select WHERE t.source_hash = ? ORDER BY t.id DESC LIMIT 5");
        $stmt->execute([$hash]);
        $byFile = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // ใบขนอ้างถึง SO ใบไหน -- บอกด้วยว่า SO นั้นมีในระบบหรือยัง
    $soRef = trim($_GET['so_ref'] ?? '');
    $reference = null;
    if ($soRef !== '') {
        $stmt = $pdo->prepare('SELECT o.id, o.so_number, o.factory_id, f.name AS factory_name
                               FROM production_orders o
                               LEFT JOIN production_factories f ON f.id = o.factory_id
                               WHERE o.so_number = ? LIMIT 1');
        $stmt->execute([$soRef]);
        $reference = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    echo json_encode([
        'success' => true,
        'data' => [
            'by_number' => $byNumber,
            'by_file' => $byFile,
            'reference' => $reference,
        ],
    ], JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
