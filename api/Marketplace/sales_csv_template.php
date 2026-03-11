<?php
header("Content-Type: text/csv; charset=utf-8");
header("Content-Disposition: attachment; filename=marketplace_import_template.csv");
header("Access-Control-Allow-Origin: *");

// UTF-8 BOM for Excel compatibility
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

$fp = fopen('php://output', 'w');
fputcsv($fp, $headers);

// Example row
fputcsv($fp, [
    'SKU001',
    'สินค้าตัวอย่าง',
    'PN',
    '',
    '100001',
    '582388639729943890',
    '1',
    '445',
    '46054',
    '46055',
    'จัดส่งแล้ว',
    'TikTok',
    'ชื่อร้านค้า',
    'คลัง 1',
    'THT71112EBP8X6Z',
    'จัดส่งแล้ว'
]);

fclose($fp);
exit;
?>
