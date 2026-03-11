<?php
$conn = new mysqli();
$conn->options(MYSQLI_OPT_CONNECT_TIMEOUT, 5);
$conn->real_connect('202.183.192.218', 'primacom_bloguser', 'pJnL53Wkhju2LaGPytw8', 'primacom_mini_erp');
$conn->set_charset("utf8mb4");
if ($conn->connect_error) die("Connection failed: " . $conn->connect_error);

$oid = '260308-00348pppj1';

echo "=== BEFORE FIX ===\n";
$r = $conn->query("SELECT id, order_id, sub_order_id, box_number, cod_amount, collection_amount, collected_amount FROM order_boxes WHERE order_id = '$oid'");
while ($row = $r->fetch_assoc()) { foreach($row as $k=>$v) echo "$k: $v | "; echo "\n"; }

// Calculate correct amount per box (non-freebie items only)
echo "\n=== CORRECT AMOUNTS PER BOX ===\n";
$r = $conn->query("SELECT box_number, SUM(CASE WHEN is_freebie = 0 THEN (quantity * price_per_unit - discount) ELSE 0 END) as correct_amount FROM order_items WHERE parent_order_id = '$oid' GROUP BY box_number");
$correctAmounts = [];
while ($row = $r->fetch_assoc()) {
    $correctAmounts[$row['box_number']] = $row['correct_amount'];
    echo "box_number: {$row['box_number']} => correct_amount: {$row['correct_amount']}\n";
}

// Apply fix - update order_boxes with correct amounts
echo "\n=== APPLYING FIX ===\n";

// Need to disable triggers temporarily to update
$conn->query("SET @DISABLE_TRIGGERS = 1");

foreach ($correctAmounts as $boxNum => $correctAmt) {
    $sql = "UPDATE order_boxes SET cod_amount = $correctAmt, collection_amount = $correctAmt WHERE order_id = '$oid' AND box_number = $boxNum";
    echo "SQL: $sql\n";
    $result = $conn->query($sql);
    if (!$result) {
        echo "ERROR: " . $conn->error . "\n";
    } else {
        echo "OK - affected rows: " . $conn->affected_rows . "\n";
    }
}

echo "\n=== AFTER FIX ===\n";
$r = $conn->query("SELECT id, order_id, sub_order_id, box_number, cod_amount, collection_amount, collected_amount FROM order_boxes WHERE order_id = '$oid'");
while ($row = $r->fetch_assoc()) { foreach($row as $k=>$v) echo "$k: $v | "; echo "\n"; }

// Also check for other PayAfter/Transfer orders that might have the same bug
echo "\n=== CHECK OTHER AFFECTED ORDERS (PayAfter with freebie causing mismatch) ===\n";
$sql = "SELECT ob.order_id, ob.box_number, ob.cod_amount as box_cod, ob.collection_amount as box_collection, o.total_amount as order_total,
        (SELECT SUM(CASE WHEN oi2.is_freebie = 0 THEN (oi2.quantity * oi2.price_per_unit - oi2.discount) ELSE 0 END) FROM order_items oi2 WHERE oi2.parent_order_id = ob.order_id AND oi2.box_number = ob.box_number) as correct_box_amt
    FROM order_boxes ob 
    JOIN orders o ON o.id = ob.order_id
    WHERE o.payment_method IN ('PayAfter', 'Transfer')
    HAVING box_cod != correct_box_amt AND correct_box_amt IS NOT NULL AND correct_box_amt > 0
    LIMIT 20";
$r = $conn->query($sql);
if (!$r) echo "ERROR: " . $conn->error . "\n";
else {
    $count = 0;
    while ($row = $r->fetch_assoc()) {
        $count++;
        echo "  {$row['order_id']} box#{$row['box_number']}: box_cod={$row['box_cod']} correct={$row['correct_box_amt']} order_total={$row['order_total']}\n";
    }
    echo "  Found: $count mismatched orders\n";
}

$conn->close();
echo "\nDone.\n";
