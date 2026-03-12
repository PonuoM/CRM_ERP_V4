<?php
/**
 * Customer Retention — Fixed: once lost = always lost (monotonic decrease)
 * 
 * Logic: สิ้น ก.พ. = ต้องอยู่กับ telesale เดิมทั้ง ม.ค. AND ก.พ.
 * ถ้าหลุดไป ม.ค. แม้กลับมา ก.พ. ก็ไม่นับ
 */

$conn = new mysqli('202.183.192.218', 'primacom_bloguser', 'pJnL53Wkhju2LaGPytw8', 'primacom_mini_erp');
$conn->set_charset("utf8mb4");
if ($conn->connect_error) die("Connection failed");

function run_retention($conn, $company_id, &$output) {
    $r = $conn->query("SELECT id, first_name, role_id FROM users WHERE role_id IN (6,7) AND company_id = {$company_id} AND status = 'active'");
    $telesale = [];
    while ($row = $r->fetch_assoc()) $telesale[$row['id']] = $row;
    $ids = array_keys($telesale);
    $ids_str = implode(',', $ids);
    
    // Dec Cohort (90-day: Oct 2 - Dec 31)
    $dec_cohort = [];
    foreach ($ids as $uid) $dec_cohort[$uid] = [];
    $r = $conn->query("SELECT creator_id, customer_id FROM orders 
        WHERE company_id = {$company_id} AND creator_id IN ($ids_str) AND order_status != 'Cancelled'
        AND order_date >= '2025-10-02' AND order_date <= '2025-12-31 23:59:59'
        GROUP BY creator_id, customer_id");
    while ($row = $r->fetch_assoc()) $dec_cohort[(int)$row['creator_id']][(int)$row['customer_id']] = true;
    
    $all_dec = [];
    foreach ($ids as $uid) foreach (array_keys($dec_cohort[$uid]) as $cid) $all_dec[$cid] = true;
    $all_dec_ids = array_keys($all_dec);
    $chunks = array_chunk($all_dec_ids, 5000);
    
    // Current assigned_to
    $now_assign = [];
    foreach ($chunks as $chunk) {
        $cids = implode(',', $chunk);
        $r = $conn->query("SELECT customer_id, assigned_to FROM customers WHERE customer_id IN ($cids)");
        if ($r) while ($row = $r->fetch_assoc()) $now_assign[(int)$row['customer_id']] = (int)$row['assigned_to'];
    }
    
    // End of Feb = earliest Mar BTL record's old
    $feb_assign = $now_assign;
    foreach ($chunks as $chunk) {
        $cids = implode(',', $chunk);
        $r = $conn->query("SELECT b.customer_id, b.assigned_to_old FROM basket_transition_log b
            INNER JOIN (SELECT customer_id, MIN(created_at) as min_date FROM basket_transition_log 
                WHERE created_at >= '2026-03-01' AND customer_id IN ($cids) GROUP BY customer_id
            ) m ON b.customer_id = m.customer_id AND b.created_at = m.min_date");
        if ($r) while ($row = $r->fetch_assoc()) {
            $feb_assign[(int)$row['customer_id']] = $row['assigned_to_old'] !== null ? (int)$row['assigned_to_old'] : 0;
        }
    }
    
    // End of Jan = earliest Feb BTL record's old
    $jan_assign = $feb_assign;
    foreach ($chunks as $chunk) {
        $cids = implode(',', $chunk);
        $r = $conn->query("SELECT b.customer_id, b.assigned_to_old FROM basket_transition_log b
            INNER JOIN (SELECT customer_id, MIN(created_at) as min_date FROM basket_transition_log 
                WHERE created_at >= '2026-02-01' AND created_at < '2026-03-01' AND customer_id IN ($cids) GROUP BY customer_id
            ) m ON b.customer_id = m.customer_id AND b.created_at = m.min_date");
        if ($r) while ($row = $r->fetch_assoc()) {
            $jan_assign[(int)$row['customer_id']] = $row['assigned_to_old'] !== null ? (int)$row['assigned_to_old'] : 0;
        }
    }
    
    // === Retention: monotonic (once lost = always lost) ===
    $output[] = "\n========== Company {$company_id} ==========";
    
    foreach ([6, 7] as $role) {
        $rname = $role == 6 ? 'Supervisor' : 'Telesale';
        $output[] = "\n--- Role {$role} ({$rname}) ---";
        $output[] = "| ชื่อ | ฐาน ธ.ค. | สิ้น ม.ค. | สิ้น ก.พ. | ปัจจุบัน | หลุด(ก.พ.) | Ret. |";
        
        $total = ['dec' => 0, 'jan' => 0, 'feb' => 0, 'now' => 0];
        $sorted = [];
        foreach ($ids as $uid) { if ($telesale[$uid]['role_id'] == $role && count($dec_cohort[$uid]) > 0) $sorted[$uid] = count($dec_cohort[$uid]); }
        arsort($sorted);
        
        foreach (array_keys($sorted) as $uid) {
            $custs = array_keys($dec_cohort[$uid]);
            $n = count($custs);
            $jan = 0; $feb = 0; $now = 0;
            foreach ($custs as $cid) {
                $jan_ok = isset($jan_assign[$cid]) && $jan_assign[$cid] == $uid;
                $feb_ok = isset($feb_assign[$cid]) && $feb_assign[$cid] == $uid;
                $now_ok = isset($now_assign[$cid]) && $now_assign[$cid] == $uid;
                
                if ($jan_ok) $jan++;
                // ก.พ. ต้องอยู่ทั้ง ม.ค. AND ก.พ. (once lost = always lost)
                if ($jan_ok && $feb_ok) $feb++;
                // ปัจจุบัน ต้องอยู่ทุก checkpoint
                if ($jan_ok && $feb_ok && $now_ok) $now++;
            }
            $lost = $n - $feb; $pct = round(($feb / $n) * 100, 1);
            $output[] = "| {$telesale[$uid]['first_name']} | {$n} | {$jan} | {$feb} | {$now} | ▼{$lost} | {$pct}% |";
            $total['dec'] += $n; $total['jan'] += $jan; $total['feb'] += $feb; $total['now'] += $now;
        }
        $gl = $total['dec'] - $total['feb'];
        $gp = $total['dec'] > 0 ? round(($total['feb']/$total['dec'])*100,1) : 0;
        $output[] = "| **Total R{$role}** | **{$total['dec']}** | **{$total['jan']}** | **{$total['feb']}** | **{$total['now']}** | **▼{$gl}** | **{$gp}%** |";
    }
    
    // Grand
    $grand = ['dec' => 0, 'jan' => 0, 'feb' => 0, 'now' => 0];
    foreach ($ids as $uid) { foreach (array_keys($dec_cohort[$uid]) as $cid) {
        $grand['dec']++;
        $j = isset($jan_assign[$cid]) && $jan_assign[$cid] == $uid;
        $f = isset($feb_assign[$cid]) && $feb_assign[$cid] == $uid;
        $nw = isset($now_assign[$cid]) && $now_assign[$cid] == $uid;
        if ($j) $grand['jan']++;
        if ($j && $f) $grand['feb']++;
        if ($j && $f && $nw) $grand['now']++;
    }}
    $gl = $grand['dec'] - $grand['feb']; $gp = $grand['dec'] > 0 ? round(($grand['feb']/$grand['dec'])*100,1) : 0;
    $output[] = "\n| **GRAND TOTAL** | **{$grand['dec']}** | **{$grand['jan']}** | **{$grand['feb']}** | **{$grand['now']}** | **▼{$gl}** | **{$gp}%** |";
    
    // Loss flows
    $output[] = "\nTop losses (สิ้น ก.พ.):";
    $flows = [];
    foreach ($ids as $uid) { foreach (array_keys($dec_cohort[$uid]) as $cid) {
        $feb_owner = $feb_assign[$cid] ?? 0;
        $j = isset($jan_assign[$cid]) && $jan_assign[$cid] == $uid;
        $f = isset($feb_assign[$cid]) && $feb_assign[$cid] == $uid;
        if (!($j && $f)) { // lost
            $to = $feb_owner == 0 ? 'ไม่มีเจ้าของ' : (isset($telesale[$feb_owner]) ? $telesale[$feb_owner]['first_name'] : "other#{$feb_owner}");
            $flows["{$telesale[$uid]['first_name']} → {$to}"] = ($flows["{$telesale[$uid]['first_name']} → {$to}"] ?? 0) + 1;
        }
    }}
    arsort($flows);
    foreach (array_slice($flows, 0, 10, true) as $f => $c) $output[] = "  {$f}: {$c}";
}

$out = [];
run_retention($conn, 1, $out);
run_retention($conn, 2, $out);
$conn->close();

$text = implode("\n", $out);
file_put_contents(__DIR__ . '/retention_fixed.php', "<?php\n/*\n{$text}\n*/\n");
echo "Done!\n";
