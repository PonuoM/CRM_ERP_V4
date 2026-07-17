<?php
// Seed แคตตาล็อกแพลนรับสินค้าชุดแรก จากไฟล์ "รหัสสินค้า ชีวภัณฑ์ เทพมงคล.xlsx" (Sheet2, 2026-07-10)
// รันซ้ำได้ (idempotent): SKU ที่มีอยู่แล้วจะอัปเดตเฉพาะ format_code ไม่ทับชื่อเดิม
// Usage: php 050_seed_stock_arrival_products.php <host> <db> <user> <pass>

if ($argc < 5) {
    fwrite(STDERR, "Usage: php {$argv[0]} <host> <db> <user> <pass>\n");
    exit(1);
}

$conn = new mysqli($argv[1], $argv[3], $argv[4], $argv[2]);
if ($conn->connect_error) {
    fwrite(STDERR, "Connect failed: {$conn->connect_error}\n");
    exit(1);
}
$conn->set_charset('utf8mb4');

$rows = [
    ['PTTM500001', 'ซุปเปอร์ไตรโค ขนาด 500 กรัม', 'PN'],
    ['PTTM100001', 'ซุปเปอร์ไตรโค ขนาด 100 กรัม', 'PN'],
    ['LNTM01L002', 'ปุ๋ยเคมีน้ำ 4-24-24 ขนาด 1 ลิตร', 'PN'],
    ['PHTM500001', 'บิว-เมธามิค ขนาด 500 กรัม', 'PN'],
    ['PHTM100001', 'บิว-เมธามิค ขนาด 100 กรัม', 'PN'],
    ['LFTM01L001', 'แคลโบมิคพลัส ขนาด 1 ลิตร', 'LF'],
    ['LNTM01L001', 'ปุ๋ยเคมีน้ำ 21-3-3 ขนาด 1 ลิตร', 'PN'],
    ['LATM01L001', 'ปุ๋ยน้ำอะมิโนมิค ขนาด 1 ลิตร', 'PN'],
    ['LCTM500001', 'ไคโตซานมิค ขนาด 500 ซีซี', 'PN'],
    ['PBTM500001', 'ซุปเปอร์บีที ขนาด 500 กรัม', 'PN'],
    ['FR-TM001', 'เสื้อตราเทพมงคล คละสี', 'PN'],
    ['LSTM01L001', 'สารจับใบ ไฮมิค ขนาด 1 ลิตร', 'PN'],
    ['PITM150001', 'ซุปเปอร์ไบโอ ขนาด 150 กรัม', 'PN'],
    ['LSTM500001', 'สารจับใบ ไฮมิค ขนาด 500 ซีซี', 'PN'],
    ['LNTM01L003', 'ปุ๋ยเคมีน้ำ 13-13-13 ขนาด 1 ลิตร', 'TM'],
];

$stmt = $conn->prepare(
    "INSERT INTO stock_arrival_products (sku, name, format_code)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE format_code = VALUES(format_code)"
);

$inserted = 0;
$updated = 0;
foreach ($rows as [$sku, $name, $format]) {
    $stmt->bind_param('sss', $sku, $name, $format);
    $stmt->execute();
    if ($stmt->affected_rows === 1) $inserted++;
    elseif ($stmt->affected_rows === 2) $updated++;
}

echo "inserted: $inserted, updated(format_code): $updated\n";

$res = $conn->query("SELECT id, sku, name, format_code FROM stock_arrival_products ORDER BY id");
while ($row = $res->fetch_assoc()) {
    echo implode("\t", $row) . "\n";
}
$conn->close();
