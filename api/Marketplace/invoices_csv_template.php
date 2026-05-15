<?php
header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename=invoices_template.csv');

// Output BOM for Excel compatibility with UTF-8
echo "\xEF\xBB\xBF";

$output = fopen('php://output', 'w');

// Header row
// 1. เดือน/ปี (YYYY-MM)
// 2. แพลตฟอร์ม
// 3. ชื่อร้านค้า (ถ้ามี)
// 4. ยอดเก็บได้ (Total Sales)
// 5. ยอดรับจริง (Actual Amount)
// 6. ลิงก์รูปภาพ (Optional URL)
fputcsv($output, [
    'เดือน/ปี (YYYY-MM)',
    'แพลตฟอร์ม',
    'ชื่อร้านค้า',
    'ยอดเก็บได้',
    'ยอดรับจริง',
    'ลิงก์สลิป (URL)'
]);

// Example rows
fputcsv($output, ['2026-05', 'Shopee', 'Shopee Shop 1', '10000.50', '9500.00', 'https://example.com/slip1.jpg']);
fputcsv($output, ['2026-05', 'Lazada', 'Lazada Shop 1', '5000.00', '4800.00', '']);
fputcsv($output, ['2026-04', 'TikTok Shop', '', '12000.00', '11200.00', '']);

fclose($output);
