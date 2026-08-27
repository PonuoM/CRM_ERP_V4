<?php
// api/migrations/088_migrate_farm_profile.php
//
// 1) seed ทะเบียนพืชจากพจนานุกรมใน CropNormalizer (source of truth ที่เดียว)
// 2) ย้ายข้อมูลเก่าจาก call_history -> customer_plots
//
// ต้องรัน 088_customer_farm_profile.sql ก่อน
//
// **ไม่มีการแก้หรือลบข้อมูลเดิมแม้แต่แถวเดียว** — call_history.crop_type / area_size อยู่ครบ
// ทุกแถวที่สร้างติดธง source='migration' ถอยกลับได้ด้วย:
//     DELETE FROM customer_plots WHERE source='migration';
//
// กติกาที่ตกลงไว้ (25 ส.ค. 2569):
//   - พืชที่แปลงไม่ได้ -> ลอง fuzzy ก่อน ถ้าไม่ได้ให้สร้างเป็น crops(status='pending') ไม่ทิ้ง
//   - ขนาดคลุมเครือ ("เยอะ"/"ไม่เยอะ") -> ลง note ไม่ใช้กรอง
//   - ตัวเลขไม่มีหน่วย -> ลง note **ไม่เดาหน่วยให้**
//   - ใช้ข้อมูลทั้งหมด ไม่ตัดวันที่
//
// วิธีรัน:
//   php api/migrations/088_migrate_farm_profile.php --dry-run     ดูผลก่อน ไม่เขียนอะไร
//   php api/migrations/088_migrate_farm_profile.php --seed-only   seed พืชอย่างเดียว
//   php api/migrations/088_migrate_farm_profile.php --commit      เขียนจริง

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../Services/CropNormalizer.php';

mb_internal_encoding('UTF-8');
set_time_limit(0);
ini_set('memory_limit', '1024M');

$argvRaw   = isset($argv) ? $argv : array();
$isDry     = in_array('--dry-run', $argvRaw, true);
$seedOnly  = in_array('--seed-only', $argvRaw, true);
$isCommit  = in_array('--commit', $argvRaw, true);

if (!$isDry && !$isCommit && !$seedOnly) {
    fwrite(STDERR, "ต้องระบุโหมด: --dry-run | --seed-only | --commit\n");
    exit(1);
}
$write = ($isCommit || $seedOnly);

function say($s) { echo $s . "\n"; flush(); }
function hr()    { say(str_repeat('-', 62)); }
function cmpPendingDesc($a, $b) { return $b['count'] - $a['count']; }

$pdo = db_connect();
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

say('');
say('=== 088 ย้ายข้อมูลพืช/ขนาดสวน ===');
say('โหมด: ' . ($isDry ? 'DRY-RUN (ไม่เขียน)' : ($seedOnly ? 'SEED ONLY' : 'COMMIT (เขียนจริง)')));
hr();

// ═══════════════════════════════════════════════════════════
// ขั้นที่ 1 — seed ทะเบียนพืช + ชื่อพ้อง
// ═══════════════════════════════════════════════════════════
$canon = CropNormalizer::canon();
$alias = CropNormalizer::aliases();

$cropIdByName = array();   // ชื่อมาตรฐาน -> crop_id

// dry-run ต้องรันได้แม้ยังไม่ได้สร้างตาราง เพื่อให้ดูผลได้ก่อนแตะ production
$hasTables = (bool)$pdo->query("SHOW TABLES LIKE 'crops'")->fetch();
if (!$hasTables) {
    if ($write) {
        say('ยังไม่มีตาราง crops — ต้องรัน 088_customer_farm_profile.sql ก่อน');
        exit(1);
    }
    say('(ยังไม่มีตาราง — dry-run จะข้ามส่วนที่ต้องอ่าน/เขียน DB)');
}

if ($write) {
    $insCrop = $pdo->prepare(
        "INSERT INTO crops (name, name_norm, category, default_unit, status)
         VALUES (?,?,?,?, 'approved')
         ON DUPLICATE KEY UPDATE category=VALUES(category), default_unit=VALUES(default_unit),
                                 status='approved', name=VALUES(name)");
    foreach ($canon as $name => $meta) {
        $insCrop->execute(array($name, CropNormalizer::clean($name), $meta[0], $meta[1]));
    }
}
// อ่าน id กลับมา (ทั้งกรณีเพิ่งเขียน และกรณี dry-run ที่ตารางอาจ seed ไว้แล้ว)
if ($hasTables) {
    $rs = $pdo->query("SELECT crop_id, name_norm FROM crops");
    while ($r = $rs->fetch(PDO::FETCH_ASSOC)) { $cropIdByName[$r['name_norm']] = (int)$r['crop_id']; }
}
say('พืชมาตรฐาน (approved) : ' . number_format(count($canon)) . ' ชนิด'
    . ($write ? ' — seed แล้ว' : ' — (dry-run ไม่เขียน)'));

$aliasSeeded = 0;
if ($write) {
    $insAlias = $pdo->prepare(
        "INSERT INTO crop_aliases (alias_norm, crop_id, source) VALUES (?,?, 'migration')
         ON DUPLICATE KEY UPDATE crop_id=VALUES(crop_id)");
    foreach ($alias as $from => $to) {
        $fromNorm = CropNormalizer::clean($from);
        if ($fromNorm === '' || $fromNorm === CropNormalizer::clean($to)) continue; // ชี้หาตัวเอง ข้าม
        if (!isset($cropIdByName[CropNormalizer::clean($to)])) continue;
        $insAlias->execute(array($fromNorm, $cropIdByName[CropNormalizer::clean($to)]));
        $aliasSeeded++;
    }
}
say('ชื่อพ้อง              : ' . number_format($write ? $aliasSeeded : count($alias)) . ' รายการ');

if ($seedOnly) { hr(); say('seed เสร็จ (ไม่ได้ย้ายข้อมูลลูกค้า)'); exit(0); }

// ═══════════════════════════════════════════════════════════
// ขั้นที่ 2 — อ่าน call_history เอาค่าล่าสุดของแต่ละลูกค้า
// ═══════════════════════════════════════════════════════════
hr();
say('กำลังอ่าน call_history ...');

$sql = "SELECT customer_id, crop_type, area_size, id AS call_id
        FROM call_history
        WHERE customer_id IS NOT NULL AND (crop_type <> '' OR area_size <> '')
        ORDER BY customer_id, `date` DESC, id DESC";
$stmt = $pdo->prepare($sql);
$stmt->execute();

$latest = array();   // customer_id => array('crop'=>, 'area'=>, 'call'=>)
$readRows = 0;
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $cid = (int)$row['customer_id'];
    $readRows++;
    if (!isset($latest[$cid])) $latest[$cid] = array('crop' => '', 'area' => '', 'call' => null);

    // ต้อง cast เป็น string ก่อนเทียบ — คอลัมน์เป็น NULL ได้ และ (NULL !== '') คือ true ใน PHP
    // ถ้าไม่ cast ค่า NULL จะถูกบันทึกเป็น "ค่าล่าสุด" แล้วปิดทางไม่ให้สายเก่ากว่าเติมค่าจริง
    // ผลคือลูกค้าที่สายล่าสุดมีค่าเป็น NULL จะถูกล้างข้อมูลทิ้งเงียบๆ (~7,000 ราย)
    $ct = isset($row['crop_type']) ? trim((string)$row['crop_type']) : '';
    $as = isset($row['area_size']) ? trim((string)$row['area_size']) : '';

    if ($ct !== '' && $latest[$cid]['crop'] === '') {
        $latest[$cid]['crop'] = $ct;
        if ($latest[$cid]['call'] === null) $latest[$cid]['call'] = (int)$row['call_id'];
    }
    if ($as !== '' && $latest[$cid]['area'] === '') {
        $latest[$cid]['area'] = $as;
        if ($latest[$cid]['call'] === null) $latest[$cid]['call'] = (int)$row['call_id'];
    }
}
$stmt->closeCursor();
say('อ่าน ' . number_format($readRows) . ' แถว จาก ' . number_format(count($latest)) . ' ลูกค้า');

// ═══════════════════════════════════════════════════════════
// ขั้นที่ 3 — แปลงเป็นชุดข้อมูลสวน
// ═══════════════════════════════════════════════════════════
hr();
say('กำลังแปลงข้อมูล ...');

$pendingNew   = array();   // name_norm => array('name'=>, 'count'=>)
$autoFixed    = array();   // ข้อความผิด => ชื่อที่แก้ให้
$plotRows     = array();   // แถวที่จะเขียน
$statCust     = 0; $statMulti = 0; $statHome = 0; $statNoUse = 0;
$statWithCrop = 0; $statWithSize = 0; $statNote = 0; $statPending = 0;
$noteSrc      = array('vague' => 0, 'number_no_unit' => 0, 'unmatched' => 0);
// diagnostic: ดูว่าลูกค้าที่มีข้อความขนาดสวน ถูกแปลงเป็นตัวเลขได้กี่ราย
$diagArea     = array('มีข้อความ' => 0, 'แปลงเป็นตัวเลขได้' => 0, 'ปลูกกินเอง' => 0,
                      'คลุมเครือ' => 0, 'ไม่มีหน่วย' => 0, 'ไม่มีข้อมูล' => 0, 'แปลงไม่ได้' => 0);
$diagMap      = array('parsed' => 'แปลงเป็นตัวเลขได้', 'home_only' => 'ปลูกกินเอง',
                      'vague' => 'คลุมเครือ', 'number_no_unit' => 'ไม่มีหน่วย',
                      'no_info' => 'ไม่มีข้อมูล', 'unmatched' => 'แปลงไม่ได้');

foreach ($latest as $cid => $v) {
    $rawC = $v['crop'];
    $rawA = $v['area'];

    $pc = ($rawC !== '') ? CropNormalizer::parseCrops($rawC)
                         : array('status' => 'none', 'crops' => array());
    $pa = ($rawA !== '') ? CropNormalizer::parseArea($rawA)
                         : array('status' => 'none', 'items' => array(), 'is_home' => false);

    $crops = $pc['crops'];
    $isPendingCrop = false;

    // แปลงพืชไม่ได้ -> ลอง fuzzy -> ไม่ได้ค่อยเก็บเป็น pending (ไม่ทิ้ง)
    if (count($crops) === 0 && $pc['status'] === 'unmatched') {
        $nm = CropNormalizer::clean($rawC);
        $fixed = ($nm !== '') ? CropNormalizer::autoCorrect($nm) : null;
        if ($fixed !== null) {
            $crops = array($fixed);
            $autoFixed[$nm] = $fixed;
        } elseif ($nm !== '' && !CropNormalizer::isJunk($nm)) {
            $crops = array($nm);
            $isPendingCrop = true;
            $key = $nm;
            if (!isset($pendingNew[$key])) $pendingNew[$key] = array('name' => $nm, 'count' => 0);
            $pendingNew[$key]['count']++;
        }
    }

    if ($rawA !== '') {
        $diagArea['มีข้อความ']++;
        if (isset($diagMap[$pa['status']])) $diagArea[$diagMap[$pa['status']]]++;
    }

    $items  = $pa['items'];
    $isHome = !empty($pa['is_home']);
    $note   = null;

    if ($pa['status'] === 'vague') {
        $note = CropNormalizer::clean($rawA); $noteSrc['vague']++;
    } elseif ($pa['status'] === 'number_no_unit') {
        $note = CropNormalizer::clean($rawA); $noteSrc['number_no_unit']++;
        $items = array();                       // ไม่เดาหน่วย
    } elseif ($pa['status'] === 'unmatched') {
        $note = CropNormalizer::clean($rawA); $noteSrc['unmatched']++;
    }

    // ประกอบเป็นชุด: จับคู่พืช x ขนาด ตามลำดับเท่าที่จับคู่ได้
    //   "มัน ข้าวโพด" + "ม40ไร่/ขพ10กว่าไร่"  -> มัน 40 ไร่ / ข้าวโพด 10 ไร่
    //   พืช 3 ขนาด 2                           -> 2 ตัวแรกได้ขนาด ตัวที่ 3 ไม่ระบุ
    //   พืช 1 ขนาด 2 ("5ไร่ 10ไร่")            -> ใช้ขนาดแรก ที่เหลือทิ้ง (เดาไม่ได้ว่าของแปลงไหน)
    $sets = array();
    if (count($crops) > 0 && count($items) > 0) {
        $pair = min(count($crops), count($items));
        for ($i = 0; $i < $pair; $i++) {
            $sets[] = array($crops[$i], $items[$i]['unit'], $items[$i]['value']);
        }
        for ($i = $pair; $i < count($crops); $i++) {
            $sets[] = array($crops[$i], null, null);
        }
    } elseif (count($crops) > 0) {
        foreach ($crops as $cr) $sets[] = array($cr, null, null);
    } elseif (count($items) > 0) {
        foreach ($items as $it) $sets[] = array(null, $it['unit'], $it['value']);
    } elseif ($note !== null || $isHome) {
        $sets[] = array(null, null, null);      // ชุดที่มีแต่ note หรือธงกินเอง
    }

    if (count($sets) === 0) { $statNoUse++; continue; }

    $statCust++;
    if (count($sets) > 1) $statMulti++;
    if ($isHome) $statHome++;

    foreach ($sets as $i => $s) {
        list($cropName, $unit, $val) = $s;
        if ($cropName !== null) {
            $statWithCrop++;
            if ($isPendingCrop) $statPending++;
        }
        if ($unit !== null && $val > 0) $statWithSize++;
        elseif ($i === 0 && $note !== null) $statNote++;

        $plotRows[] = array(
            'customer_id'    => $cid,
            'crop_name'      => $cropName,
            'is_pending'     => $isPendingCrop,
            'size_value'     => ($unit !== null && $val > 0) ? round($val, 2) : null,
            'size_unit'      => ($unit !== null && $val > 0) ? $unit : null,
            'size_bucket'    => CropNormalizer::sizeBucket($val, $unit),
            'is_home_garden' => ($isHome && $i === 0) ? 1 : 0,
            'note'           => ($i === 0) ? $note : null,
            'source_call_id' => $v['call'],
        );
    }
}

say('');
say('ลูกค้าที่ได้โปรไฟล์   : ' . number_format($statCust));
say('  มีมากกว่า 1 ชุด     : ' . number_format($statMulti));
say('  ธงปลูกกินเอง        : ' . number_format($statHome));
say('จำนวนชุดที่จะสร้าง    : ' . number_format(count($plotRows)));
say('  ระบุพืชได้          : ' . number_format($statWithCrop) . ' (pending ' . number_format($statPending) . ')');
say('  มีตัวเลข+หน่วยครบ   : ' . number_format($statWithSize));
say('  มีแต่ note          : ' . number_format($statNote));
say('พืชที่ fuzzy แก้ให้    : ' . number_format(count($autoFixed)) . ' คำ');
say('พืชใหม่ที่ต้อง pending : ' . number_format(count($pendingNew)) . ' รายการ');
say('ข้ามไป (ไม่มีอะไรใช้ได้): ' . number_format($statNoUse));
say('');
say('ที่มาของ note — คลุมเครือ ' . number_format($noteSrc['vague'])
    . ' / ไม่มีหน่วย ' . number_format($noteSrc['number_no_unit'])
    . ' / อื่นๆ ' . number_format($noteSrc['unmatched']));
say('');
say('ตรวจสอบฝั่งขนาดสวน (นับหัวลูกค้า จากค่าล่าสุดของแต่ละราย):');
foreach ($diagArea as $k => $v) say('   ' . str_pad($k, 22) . number_format($v));

if ($isDry) {
    hr();
    say('ตัวอย่างพืช pending 15 อันดับแรก:');
    uasort($pendingNew, 'cmpPendingDesc');
    $i = 0;
    foreach ($pendingNew as $p) {
        say(sprintf('   %-34s %5s ราย', mb_substr($p['name'], 0, 32), number_format($p['count'])));
        if (++$i >= 15) break;
    }
    hr();
    say('DRY-RUN จบ — ไม่มีอะไรถูกเขียนลงฐานข้อมูล');
    say('ถ้าผลถูกต้องแล้ว รันซ้ำด้วย --commit');
    exit(0);
}

// ═══════════════════════════════════════════════════════════
// ขั้นที่ 4 — เขียนจริง
// ═══════════════════════════════════════════════════════════
hr();
say('กำลังเขียนลงฐานข้อมูล ...');

$pdo->beginTransaction();
try {
    // 4.1 พืชใหม่ที่เทเลเคยพิมพ์ แต่พจนานุกรมยังไม่รู้จัก -> pending
    $insPending = $pdo->prepare(
        "INSERT INTO crops (name, name_norm, category, default_unit, status, usage_count)
         VALUES (?,?, 'อื่นๆ', 'ไร่', 'pending', ?)
         ON DUPLICATE KEY UPDATE usage_count = usage_count + VALUES(usage_count)");
    foreach ($pendingNew as $p) {
        $insPending->execute(array($p['name'], CropNormalizer::clean($p['name']), $p['count']));
    }

    // 4.2 คำสะกดผิดที่ fuzzy แก้ให้ -> บันทึกเป็น alias เพื่อคราวหน้าไม่ต้องคำนวณซ้ำ
    $insAutoAlias = $pdo->prepare(
        "INSERT INTO crop_aliases (alias_norm, crop_id, source) VALUES (?,?, 'auto')
         ON DUPLICATE KEY UPDATE crop_id = VALUES(crop_id)");

    // โหลด id ทั้งหมดอีกรอบ (มี pending เพิ่มเข้ามาแล้ว)
    $cropIdByName = array();
    $rs = $pdo->query("SELECT crop_id, name_norm FROM crops");
    while ($r = $rs->fetch(PDO::FETCH_ASSOC)) { $cropIdByName[$r['name_norm']] = (int)$r['crop_id']; }

    foreach ($autoFixed as $wrong => $right) {
        $rn = CropNormalizer::clean($right);
        if (isset($cropIdByName[$rn])) {
            $insAutoAlias->execute(array(CropNormalizer::clean($wrong), $cropIdByName[$rn]));
        }
    }

    // 4.3 ล้างของรอบก่อน (ถ้าเคยรัน) แล้วเขียนใหม่ — รันซ้ำได้
    $del = $pdo->exec("DELETE FROM customer_plots WHERE source = 'migration'");
    if ($del > 0) say('  ลบของรอบก่อน ' . number_format($del) . ' แถว (รันซ้ำได้)');

    $ins = $pdo->prepare(
        "INSERT INTO customer_plots
           (customer_id, crop_id, size_value, size_unit, size_bucket,
            is_home_garden, note, source, source_call_id)
         VALUES (?,?,?,?,?,?,?, 'migration', ?)");

    $written = 0; $skipped = 0;
    foreach ($plotRows as $r) {
        $cropId = null;
        if ($r['crop_name'] !== null) {
            $nn = CropNormalizer::clean($r['crop_name']);
            $cropId = isset($cropIdByName[$nn]) ? $cropIdByName[$nn] : null;
            if ($cropId === null) { $skipped++; }
        }
        $ins->execute(array(
            $r['customer_id'], $cropId, $r['size_value'], $r['size_unit'], $r['size_bucket'],
            $r['is_home_garden'], $r['note'], $r['source_call_id'],
        ));
        $written++;
    }

    // 4.4 อัปเดต usage_count ให้ตรงกับการใช้งานจริง — ใช้เรียงคิวตรวจของ admin
    $pdo->exec(
        "UPDATE crops c
         LEFT JOIN (SELECT crop_id, COUNT(*) n FROM customer_plots
                    WHERE crop_id IS NOT NULL AND is_active = 1 GROUP BY crop_id) p
                ON p.crop_id = c.crop_id
         SET c.usage_count = COALESCE(p.n, 0)");

    $pdo->commit();
    say('  เขียน customer_plots : ' . number_format($written) . ' แถว');
    if ($skipped > 0) say('  หา crop_id ไม่เจอ    : ' . number_format($skipped) . ' แถว (เก็บเป็นชุดไม่มีพืช)');
    hr();
    say('เสร็จเรียบร้อย');
    say('ถอยกลับได้ด้วย: DELETE FROM customer_plots WHERE source = \'migration\';');
} catch (Exception $e) {
    $pdo->rollBack();
    say('');
    say('ล้มเหลว — rollback แล้ว ไม่มีอะไรเปลี่ยน');
    say('สาเหตุ: ' . $e->getMessage());
    exit(1);
}
