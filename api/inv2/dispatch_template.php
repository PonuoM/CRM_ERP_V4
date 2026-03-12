<?php
// Dispatch Template — Download CSV template with correct headers
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="dispatch_template.csv"');

// BOM for Excel to recognize UTF-8
echo "\xEF\xBB\xBF";

$headers = [
    'รหัสสินค้า',
    'ชื่อสินค้า',
    'รหัสรูปแบบ',
    'รูปแบบสินค้า',
    'หมายเลขออเดอร์ภายใน',
    'หมายเลขคำสั่งซื้อออนไลน์',
    'จำนวนสินค้าที่ส่งจริง',
    'ราคาสินค้าทั้งหมด',
    'วันที่สั่งซื้อ',
    'วันที่จัดส่ง',
    'สถานะคำสั่งซื้อ',
    'แพลตฟอร์ม',
    'ร้านค้า',
    'คลังส่งสินค้า',
    'หมายเลขพัสดุ',
    'สถานะ'
];

$out = fopen('php://output', 'w');
fputcsv($out, $headers);
// Example row
fputcsv($out, ['SKU001', 'ตัวอย่างสินค้า', 'PN', '', '100001', 'ONLINE-001', '1', '450', '2026-03-11', '2026-03-12', 'จัดส่งแล้ว', 'TikTok', 'ร้านตัวอย่าง', 'Center - กาญจนบุรี', 'TH000000001', 'จัดส่งแล้ว']);
fclose($out);
