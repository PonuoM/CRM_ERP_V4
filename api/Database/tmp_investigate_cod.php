<?php
$conn = new mysqli();
$conn->options(MYSQLI_OPT_CONNECT_TIMEOUT, 5);
$conn->real_connect('202.183.192.218', 'primacom_bloguser', 'pJnL53Wkhju2LaGPytw8', 'primacom_mini_erp');
$conn->set_charset("utf8mb4");
if ($conn->connect_error) die("Connection failed: " . $conn->connect_error . "\n");

echo "=== ORDER BOXES for 260308-00348pppj1 ===\n";
$r = $conn->query("SELECT * FROM order_boxes WHERE order_id = '260308-00348pppj1'");
if (!$r) echo "ERR: ".$conn->error."\n";
else {
    if ($r->num_rows == 0) echo "  (none with parent order_id)\n";
    while ($row = $r->fetch_assoc()) { foreach($row as $k=>$v) echo "  $k: $v\n"; echo "\n"; }
}

echo "\n=== ORDER BOXES for sub-orders ===\n";
$r = $conn->query("SELECT * FROM order_boxes WHERE order_id LIKE '260308-00348pppj1%'");
if (!$r) echo "ERR: ".$conn->error."\n";
else {
    if ($r->num_rows == 0) echo "  (none)\n";
    while ($row = $r->fetch_assoc()) { foreach($row as $k=>$v) echo "  $k: $v\n"; echo "\n"; }
}

echo "\n=== ALL RELATED ORDERS (select only safe cols) ===\n";
$r = $conn->query("SELECT id, customer_id, total_amount, shipping_cost, bill_discount, cod_amount, payment_method, payment_status, order_status, created_at FROM orders WHERE id = '260308-00348pppj1'");
if (!$r) echo "ERR: ".$conn->error."\n";
else {
    while ($row = $r->fetch_assoc()) { foreach($row as $k=>$v) echo "  $k: $v\n"; echo "\n"; }
}

echo "\n=== HOW COD PAGE CALCULATES ORDER COD (check cod logic) ===\n";
echo "  Order total_amount: 7400.00\n";
echo "  Payment method: PayAfter\n";
echo "  Order items net_total sum: 7400.00 (box1) + 0 (freebie) + 0 (box2 freebie)\n";
echo "  Tracking 508821 -> box 1 -> sub-order 260308-00348pppj1-1\n";

echo "\n=== CHECK ORDER_ITEMS TOTALS PER BOX ===\n";
$r = $conn->query("SELECT box_number, SUM(CASE WHEN is_freebie = 0 THEN net_total ELSE 0 END) as box_total, SUM(net_total) as box_total_all, COUNT(*) as items FROM order_items WHERE parent_order_id = '260308-00348pppj1' GROUP BY box_number");
if (!$r) echo "ERR: ".$conn->error."\n";
else {
    while ($row = $r->fetch_assoc()) { foreach($row as $k=>$v) echo "  $k: $v\n"; echo "\n"; }
}

echo "\n=== CHECK: what generates '8190' value? ===\n";
echo "  Let's check if 8190 = 790 * 10 + 790*1 + shipping?\n";
echo "  790 * 10 = 7900 (before discount)\n";
echo "  790 * 10 - 500 discount = 7400 (net_total of main item)\n";
echo "  790 * 10 + 790 * 1 = 8690 (if counting freebie at full price)\n";
echo "  790 * 11 - 500 = 8190! <-- THIS IS IT!\n";
echo "  The COD page is likely calculating: qty * price - discount for ALL items including freebies\n";

echo "\n=== VERIFY: order_items details ===\n";
$r = $conn->query("SELECT id, order_id, product_id, quantity, price_per_unit, discount, net_total, is_freebie, box_number FROM order_items WHERE parent_order_id = '260308-00348pppj1' ORDER BY id");
if (!$r) echo "ERR: ".$conn->error."\n";
else {
    while ($row = $r->fetch_assoc()) { foreach($row as $k=>$v) echo "  $k: $v\n"; echo "\n"; }
}

$conn->close();
echo "\nDone.\n";
