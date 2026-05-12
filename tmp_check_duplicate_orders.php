<?php
header('Content-Type: text/plain; charset=utf-8');
$conn = new mysqli('202.183.192.218', 'primacom_bloguser', 'pJnL53Wkhju2LaGPytw8', 'primacom_mini_erp');
$conn->set_charset("utf8mb4");

/*
 * แนวทางตรวจสอบ duplicate:
 * เนื่องจากเลข order เปลี่ยนได้ จะใช้ "ลายเซ็น" ของออเดอร์แทน:
 *   signature = customer_id + date(order_date) + total_amount + items_signature
 * โดย items_signature = hash ของ (product_id, quantity, price_per_unit) ทั้งหมดเรียง
 * ถ้าซ้ำกัน 2+ ครั้ง = น่าจะเป็น duplicate
 *
 * เทียบ 3 ระดับความเข้ม:
 *   L1 (loose):  customer + date + total_amount เท่ากัน
 *   L2 (medium): + products+quantity ทั้งหมดเหมือนกัน (item_sig)
 *   L3 (strict): L2 + ห่างกันไม่เกิน 2 ชั่วโมง (น่าจะ import ซ้ำ)
 */

function buildItemSig($conn, $orderId) {
    $sql = "SELECT product_id, quantity, price_per_unit FROM order_items
            WHERE parent_order_id = '" . $conn->real_escape_string($orderId) . "'
            ORDER BY product_id, quantity, price_per_unit";
    $res = $conn->query($sql);
    $parts = [];
    while ($r = $res->fetch_assoc()) {
        $parts[] = $r['product_id'].':'.$r['quantity'].':'.$r['price_per_unit'];
    }
    return md5(implode('|', $parts));
}

function analyzeYear($conn, $year) {
    $start = "$year-01-01 00:00:00";
    $end   = ($year+1) . "-01-01 00:00:00";

    echo "\n==================== ปี $year ====================\n";

    // นับ orders รวม
    $res = $conn->query("
        SELECT COUNT(*) AS total_orders, COUNT(DISTINCT customer_id) AS unique_customers
        FROM orders
        WHERE order_date >= '$start' AND order_date < '$end'
          AND order_status != 'Cancelled'
    ");
    $stat = $res->fetch_assoc();
    echo "Total orders (non-Cancelled): {$stat['total_orders']} | Unique customers: {$stat['unique_customers']}\n";

    // L1: customer+date+total_amount ซ้ำ (loose)
    $sql = "
        SELECT customer_id, DATE(order_date) AS d, total_amount, COUNT(*) AS cnt
        FROM orders
        WHERE order_date >= '$start' AND order_date < '$end'
          AND order_status != 'Cancelled'
          AND customer_id IS NOT NULL
          AND total_amount > 0
        GROUP BY customer_id, DATE(order_date), total_amount
        HAVING COUNT(*) >= 2
    ";
    $res = $conn->query($sql);
    $groups_l1 = 0; $extra_orders_l1 = 0; $extra_amount_l1 = 0;
    while ($r = $res->fetch_assoc()) {
        $groups_l1++;
        $extra_orders_l1 += $r['cnt'] - 1;
        $extra_amount_l1 += $r['total_amount'] * ($r['cnt'] - 1);
    }
    echo "\n[L1 loose] customer+date+amount ซ้ำกัน ≥ 2 ครั้ง:\n";
    echo "  จำนวนกลุ่มที่ซ้ำ: $groups_l1\n";
    echo "  ออเดอร์ส่วนเกิน (ถ้าทุกตัวเป็น dup): $extra_orders_l1 ออเดอร์\n";
    echo "  ยอดเงินส่วนเกิน: " . number_format($extra_amount_l1, 2) . " บาท\n";

    // L2: เพิ่ม items signature ตรงกันด้วย
    $sql = "
        SELECT customer_id, DATE(order_date) AS d, total_amount,
               GROUP_CONCAT(id ORDER BY order_date) AS order_ids,
               COUNT(*) AS cnt
        FROM orders
        WHERE order_date >= '$start' AND order_date < '$end'
          AND order_status != 'Cancelled'
          AND customer_id IS NOT NULL
          AND total_amount > 0
        GROUP BY customer_id, DATE(order_date), total_amount
        HAVING COUNT(*) >= 2
    ";
    $res = $conn->query($sql);

    $l2_groups = 0; $l2_extra_orders = 0; $l2_extra_amount = 0;
    $l3_groups = 0; $l3_extra_orders = 0; $l3_extra_amount = 0;
    $samples_l2 = [];
    $samples_l3 = [];

    while ($r = $res->fetch_assoc()) {
        $oids = explode(',', $r['order_ids']);
        // ดึง item sig + เวลา ของแต่ละ order
        $sigs = [];
        $times = [];
        foreach ($oids as $oid) {
            $sigs[$oid] = buildItemSig($conn, $oid);
            $q = $conn->query("SELECT order_date FROM orders WHERE id = '" . $conn->real_escape_string($oid) . "' LIMIT 1");
            $row = $q->fetch_assoc();
            $times[$oid] = strtotime($row['order_date']);
        }
        // กลุ่มย่อยตาม sig
        $by_sig = [];
        foreach ($sigs as $oid => $sig) $by_sig[$sig][] = $oid;
        foreach ($by_sig as $sig => $list) {
            if (count($list) < 2) continue;
            $l2_groups++;
            $l2_extra_orders += count($list) - 1;
            $l2_extra_amount += $r['total_amount'] * (count($list) - 1);
            if (count($samples_l2) < 5) {
                $samples_l2[] = [
                    'customer_id' => $r['customer_id'],
                    'date' => $r['d'],
                    'amount' => $r['total_amount'],
                    'orders' => $list,
                ];
            }
            // L3: ห่างกันไม่เกิน 2 ชั่วโมง
            sort($list);
            $tlist = array_map(function($o) use ($times) { return $times[$o]; }, $list);
            sort($tlist);
            $max_gap = $tlist[count($tlist)-1] - $tlist[0];
            if ($max_gap <= 2*3600) {
                $l3_groups++;
                $l3_extra_orders += count($list) - 1;
                $l3_extra_amount += $r['total_amount'] * (count($list) - 1);
                if (count($samples_l3) < 5) {
                    $samples_l3[] = [
                        'customer_id' => $r['customer_id'],
                        'date' => $r['d'],
                        'amount' => $r['total_amount'],
                        'orders' => $list,
                        'gap_seconds' => $max_gap,
                    ];
                }
            }
        }
    }

    echo "\n[L2 medium] L1 + items+qty+price ตรงกันทั้งหมด:\n";
    echo "  จำนวนกลุ่มที่ซ้ำ: $l2_groups\n";
    echo "  ออเดอร์ส่วนเกิน: $l2_extra_orders\n";
    echo "  ยอดเงินส่วนเกิน: " . number_format($l2_extra_amount, 2) . " บาท\n";

    echo "\n[L3 strict] L2 + ห่างกันไม่เกิน 2 ชม. (น่าจะ import ซ้ำ):\n";
    echo "  จำนวนกลุ่มที่ซ้ำ: $l3_groups\n";
    echo "  ออเดอร์ส่วนเกิน: $l3_extra_orders\n";
    echo "  ยอดเงินส่วนเกิน: " . number_format($l3_extra_amount, 2) . " บาท\n";

    echo "\n--- ตัวอย่าง L2 (สูงสุด 5 กลุ่ม) ---\n";
    foreach ($samples_l2 as $s) {
        $names = $conn->query("SELECT CONCAT(first_name,' ',last_name) AS n, phone FROM customers WHERE customer_id={$s['customer_id']}")->fetch_assoc();
        echo "  customer #{$s['customer_id']} ({$names['n']}, {$names['phone']}) วันที่ {$s['date']} ยอด {$s['amount']}\n";
        foreach ($s['orders'] as $oid) {
            $q = $conn->query("SELECT id, order_date, order_status, creator_id FROM orders WHERE id='" . $conn->real_escape_string($oid) . "'");
            $row = $q->fetch_assoc();
            echo "    - $oid | {$row['order_date']} | {$row['order_status']} | creator_id={$row['creator_id']}\n";
        }
    }

    echo "\n--- ตัวอย่าง L3 strict (สูงสุด 5 กลุ่ม) ---\n";
    foreach ($samples_l3 as $s) {
        $names = $conn->query("SELECT CONCAT(first_name,' ',last_name) AS n FROM customers WHERE customer_id={$s['customer_id']}")->fetch_assoc();
        $gap_min = round($s['gap_seconds']/60, 1);
        echo "  customer #{$s['customer_id']} ({$names['n']}) {$s['date']} ยอด {$s['amount']} | gap={$gap_min} นาที\n";
        foreach ($s['orders'] as $oid) {
            $q = $conn->query("SELECT id, order_date, order_status, creator_id FROM orders WHERE id='" . $conn->real_escape_string($oid) . "'");
            $row = $q->fetch_assoc();
            echo "    - $oid | {$row['order_date']} | {$row['order_status']} | creator={$row['creator_id']}\n";
        }
    }

    return [
        'total' => $stat['total_orders'],
        'l1_groups' => $groups_l1, 'l1_extra_orders' => $extra_orders_l1, 'l1_extra_amount' => $extra_amount_l1,
        'l2_groups' => $l2_groups, 'l2_extra_orders' => $l2_extra_orders, 'l2_extra_amount' => $l2_extra_amount,
        'l3_groups' => $l3_groups, 'l3_extra_orders' => $l3_extra_orders, 'l3_extra_amount' => $l3_extra_amount,
    ];
}

$res2025 = analyzeYear($conn, 2025);
$res2026 = analyzeYear($conn, 2026);

echo "\n\n==================== สรุปเปรียบเทียบ ====================\n";
printf("%-30s | %15s | %15s\n", "เกณฑ์", "ปี 2025", "ปี 2026");
echo str_repeat("-", 70) . "\n";
printf("%-30s | %15s | %15s\n", "Total Orders", number_format($res2025['total']), number_format($res2026['total']));
printf("%-30s | %15s | %15s\n", "L1 ซ้ำ (กลุ่ม)", number_format($res2025['l1_groups']), number_format($res2026['l1_groups']));
printf("%-30s | %15s | %15s\n", "L1 % of total",
    sprintf('%.2f%%', $res2025['l1_extra_orders']/max(1,$res2025['total'])*100),
    sprintf('%.2f%%', $res2026['l1_extra_orders']/max(1,$res2026['total'])*100));
printf("%-30s | %15s | %15s\n", "L2 ซ้ำ (กลุ่ม)", number_format($res2025['l2_groups']), number_format($res2026['l2_groups']));
printf("%-30s | %15s | %15s\n", "L2 ออเดอร์เกิน", number_format($res2025['l2_extra_orders']), number_format($res2026['l2_extra_orders']));
printf("%-30s | %15s | %15s\n", "L2 ยอดเงินเกิน", number_format($res2025['l2_extra_amount'],2), number_format($res2026['l2_extra_amount'],2));
printf("%-30s | %15s | %15s\n", "L3 strict (กลุ่ม)", number_format($res2025['l3_groups']), number_format($res2026['l3_groups']));
printf("%-30s | %15s | %15s\n", "L3 ออเดอร์เกิน", number_format($res2025['l3_extra_orders']), number_format($res2026['l3_extra_orders']));
printf("%-30s | %15s | %15s\n", "L3 ยอดเงินเกิน", number_format($res2025['l3_extra_amount'],2), number_format($res2026['l3_extra_amount'],2));

$conn->close();
