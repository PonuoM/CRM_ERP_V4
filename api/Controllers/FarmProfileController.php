<?php
// api/Controllers/FarmProfileController.php
//
// จัดการข้อมูล "สวนของลูกค้า" — ทะเบียนพืช + ชุดข้อมูลสวน (customer_plots)
// ดูที่มาและเหตุผลของโครงสร้างได้ที่ api/migrations/088_customer_farm_profile.sql
//
// endpoint (ผ่าน api/index.php):
//   GET    crops?q=ทุเ            ค้นพืชสำหรับ combobox (ค้นทั้งชื่อจริงและชื่อพ้อง)
//   POST   crops                  เพิ่มพืชใหม่ (status=pending) — ใช้งานได้ทันที
//   GET    crops?action=pending   คิวตรวจของ admin
//   POST   crops?action=review    admin: อนุมัติ / รวมกับพืชอื่น / ทิ้ง
//   GET    customer_plots?customerId=123
//   PUT    customer_plots?customerId=123   บันทึกทั้งชุด (แทนที่ของเดิมทั้งหมด)

require_once __DIR__ . '/../Services/CropNormalizer.php';

class FarmProfileController
{
    // ───────────────────────── ทะเบียนพืช ─────────────────────────

    /**
     * ค้นพืชสำหรับ combobox
     * ค้นจากทั้ง crops.name และ crop_aliases.alias_norm — พิมพ์ "ลำใย" ต้องเจอ "ลำไย"
     * ถ้าไม่เจอเลย จะแนบ suggest (near-match) กลับไป เพื่อถามผู้ใช้ก่อนยอมให้สร้างใหม่
     */
    public static function searchCrops(PDO $pdo): void
    {
        $q = isset($_GET['q']) ? CropNormalizer::clean($_GET['q']) : '';
        $limit = isset($_GET['limit']) ? max(1, min(50, (int)$_GET['limit'])) : 20;

        if ($q === '') {
            // ไม่ได้พิมพ์อะไร -> คืนพืชที่ใช้บ่อยที่สุด ให้เลือกได้เลยโดยไม่ต้องพิมพ์
            $stmt = $pdo->prepare(
                "SELECT crop_id, name, category, default_unit, status, usage_count
                   FROM crops
                  WHERE status <> 'merged'
               ORDER BY usage_count DESC, name ASC
                  LIMIT ?");
            $stmt->bindValue(1, $limit, PDO::PARAM_INT);
            $stmt->execute();
            json_response(array('items' => $stmt->fetchAll(PDO::FETCH_ASSOC), 'suggest' => null));
            return;
        }

        // ลำดับผลลัพธ์สำคัญมาก — ฐานข้อมูลมีพืช pending ที่เป็นคำสะกดผิดปนอยู่ 877 รายการ
        // ถ้าเรียงด้วยความ "ตรงกับที่พิมพ์" อย่างเดียว ตัวขยะจะขึ้นก่อนตัวจริง
        // เช่นพิมพ์ "ทุเรยน" แล้วได้ "ทุเรยน มะพร้ายว" (ใช้ 1 ครั้ง) มาก่อน "ทุเรียน" (ใช้ 30,887 ครั้ง)
        // จึงต้องให้ approved มาก่อน pending เสมอ แล้วค่อยดูความตรงและความถี่
        $like = '%' . $q . '%';
        $stmt = $pdo->prepare(
            "SELECT c.crop_id, c.name, c.category, c.default_unit, c.status, c.usage_count,
                    CASE WHEN c.status = 'approved' THEN 0 ELSE 1 END AS rank_status,
                    MIN(CASE WHEN c.name = ? THEN 0
                             WHEN c.name LIKE ? THEN 1
                             ELSE 2 END) AS rank_hint
               FROM crops c
          LEFT JOIN crop_aliases a ON a.crop_id = c.crop_id
              WHERE c.status <> 'merged'
                AND (c.name LIKE ? OR c.name_norm LIKE ? OR a.alias_norm LIKE ?)
           GROUP BY c.crop_id, c.name, c.category, c.default_unit, c.status, c.usage_count
           ORDER BY rank_status ASC, rank_hint ASC, c.usage_count DESC, c.name ASC
              LIMIT ?");
        $stmt->bindValue(1, $q);
        $stmt->bindValue(2, $q . '%');
        $stmt->bindValue(3, $like);
        $stmt->bindValue(4, $like);
        $stmt->bindValue(5, $like);
        $stmt->bindValue(6, $limit, PDO::PARAM_INT);
        $stmt->execute();
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // ไม่เจอ -> เสนอตัวใกล้เคียงก่อน (ด่านกันพิมพ์ผิดที่สำคัญที่สุด)
        $suggest = null;
        if (count($items) === 0) {
            $guess = CropNormalizer::fuzzyMatch($q);
            if ($guess !== null && ($guess[2] === 'exact' || $guess[2] === 'high' || $guess[2] === 'medium')) {
                $s = $pdo->prepare(
                    "SELECT crop_id, name, category, default_unit, status
                       FROM crops WHERE name_norm = ? LIMIT 1");
                $s->execute(array(CropNormalizer::clean($guess[0])));
                $row = $s->fetch(PDO::FETCH_ASSOC);
                if ($row) { $row['confidence'] = $guess[2]; $suggest = $row; }
            }
        }
        json_response(array('items' => $items, 'suggest' => $suggest));
    }

    /**
     * เพิ่มพืชใหม่ — สร้างเป็น pending แต่ใช้งานได้ทันที ไม่ต้องรออนุมัติ
     *
     * กันซ้ำ 3 ชั้น:
     *   1) normalize ข้อความก่อน (ตัด tab/วรรค, แก้ เเ->แ, ยุบสระซ้ำ)
     *   2) ถ้า normalize แล้วตรงกับ alias ที่มีอยู่ -> คืนพืชตัวนั้นเลย ไม่สร้างใหม่
     *   3) UNIQUE(name_norm) + ON DUPLICATE KEY -> ต่อให้ 2 คนกดพร้อมกันก็ได้ record เดียว
     *
     * ส่ง force=true มาเมื่อผู้ใช้ยืนยันแล้วว่าไม่ใช่ตัวที่ระบบเสนอ
     */
    public static function createCrop(PDO $pdo): void
    {
        $in   = json_input();
        $raw  = isset($in['name']) ? (string)$in['name'] : '';
        $name = CropNormalizer::clean($raw);
        $force = !empty($in['force']);
        $userId = isset($in['userId']) ? (int)$in['userId'] : null;

        if ($name === '' || mb_strlen($name, 'UTF-8') > 64) {
            json_response(array('error' => 'VALIDATION_FAILED', 'message' => 'ชื่อพืชต้องมี 1-64 ตัวอักษร'), 400);
            return;
        }
        if (CropNormalizer::isJunk($name)) {
            json_response(array('error' => 'NOT_A_CROP', 'message' => 'ข้อความนี้ไม่ใช่ชื่อพืช'), 400);
            return;
        }

        // ชั้น 2: ตรงกับพืช/ชื่อพ้องที่มีอยู่แล้วหรือไม่
        $exist = $pdo->prepare(
            "SELECT c.crop_id, c.name, c.category, c.default_unit, c.status
               FROM crops c
          LEFT JOIN crop_aliases a ON a.crop_id = c.crop_id
              WHERE c.name_norm = ? OR a.alias_norm = ?
              LIMIT 1");
        $exist->execute(array($name, $name));
        $found = $exist->fetch(PDO::FETCH_ASSOC);
        if ($found) {
            json_response(array('crop' => $found, 'created' => false, 'reason' => 'มีอยู่แล้ว'));
            return;
        }

        // ยังไม่ยืนยัน -> เสนอตัวใกล้เคียงก่อน
        if (!$force) {
            $guess = CropNormalizer::fuzzyMatch($name);
            if ($guess !== null && ($guess[2] === 'exact' || $guess[2] === 'high')) {
                $s = $pdo->prepare("SELECT crop_id, name, category, default_unit, status
                                      FROM crops WHERE name_norm = ? LIMIT 1");
                $s->execute(array(CropNormalizer::clean($guess[0])));
                $row = $s->fetch(PDO::FETCH_ASSOC);
                if ($row) {
                    json_response(array('created' => false, 'needsConfirm' => true, 'suggest' => $row,
                                        'message' => 'หมายถึง "' . $row['name'] . '" หรือไม่?'));
                    return;
                }
            }
        }

        // ชั้น 3: เขียนแบบกันซ้ำที่ระดับ DB
        $meta = CropNormalizer::cropMeta($name);
        $cat  = $meta ? $meta[0] : 'อื่นๆ';
        $unit = $meta ? $meta[1] : 'ไร่';
        $ins = $pdo->prepare(
            "INSERT INTO crops (name, name_norm, category, default_unit, status, usage_count, created_by)
             VALUES (?,?,?,?, 'pending', 0, ?)
             ON DUPLICATE KEY UPDATE crop_id = LAST_INSERT_ID(crop_id)");
        $ins->execute(array($name, $name, $cat, $unit, $userId));
        $cropId = (int)$pdo->lastInsertId();

        $s = $pdo->prepare("SELECT crop_id, name, category, default_unit, status FROM crops WHERE crop_id = ?");
        $s->execute(array($cropId));
        json_response(array('crop' => $s->fetch(PDO::FETCH_ASSOC), 'created' => true));
    }

    /** คิวตรวจของ admin — เรียงตามความถี่ ตัวที่ใช้บ่อยลอยขึ้นบน */
    public static function pendingCrops(PDO $pdo): void
    {
        $limit = isset($_GET['limit']) ? max(1, min(200, (int)$_GET['limit'])) : 50;
        $stmt = $pdo->prepare(
            "SELECT crop_id, name, category, default_unit, usage_count, created_at
               FROM crops WHERE status = 'pending'
           ORDER BY usage_count DESC, created_at ASC
              LIMIT ?");
        $stmt->bindValue(1, $limit, PDO::PARAM_INT);
        $stmt->execute();
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // แนบตัวใกล้เคียงให้ admin กดรวมได้ในคลิกเดียว
        foreach ($items as &$it) {
            $g = CropNormalizer::fuzzyMatch($it['name']);
            $it['suggest'] = ($g !== null) ? array('name' => $g[0], 'confidence' => $g[2]) : null;
        }
        unset($it);

        $total = (int)$pdo->query("SELECT COUNT(*) FROM crops WHERE status = 'pending'")->fetchColumn();
        json_response(array('items' => $items, 'total' => $total));
    }

    /**
     * admin ตัดสินพืช pending
     *   approve : ยกระดับเป็นพืชมาตรฐาน (ตั้ง category/unit ให้ถูก)
     *   merge   : รวมกับพืชที่มีอยู่ — สร้าง alias + ย้าย customer_plots ให้ในคำสั่งเดียว
     *   discard : ทิ้ง (ชุดที่อ้างถึงจะกลายเป็นชุดไม่มีพืช ไม่ได้ลบชุดทิ้ง)
     */
    public static function reviewCrop(PDO $pdo): void
    {
        $in     = json_input();
        $cropId = isset($in['cropId']) ? (int)$in['cropId'] : 0;
        $act    = isset($in['action']) ? (string)$in['action'] : '';
        if ($cropId <= 0 || !in_array($act, array('approve', 'merge', 'discard'), true)) {
            json_response(array('error' => 'VALIDATION_FAILED'), 400);
            return;
        }

        $pdo->beginTransaction();
        try {
            if ($act === 'approve') {
                $cat  = isset($in['category']) ? (string)$in['category'] : 'อื่นๆ';
                $unit = (isset($in['defaultUnit']) && $in['defaultUnit'] === 'ต้น') ? 'ต้น' : 'ไร่';
                $u = $pdo->prepare("UPDATE crops SET status='approved', category=?, default_unit=? WHERE crop_id=?");
                $u->execute(array($cat, $unit, $cropId));

            } elseif ($act === 'merge') {
                $into = isset($in['mergeInto']) ? (int)$in['mergeInto'] : 0;
                if ($into <= 0 || $into === $cropId) throw new Exception('ต้องระบุพืชปลายทางที่จะรวมเข้า');

                // ชื่อเดิมกลายเป็นชื่อพ้องของพืชปลายทาง — คราวหน้าพิมพ์แบบนี้จะเจอตัวที่ถูกเลย
                $nameRow = $pdo->prepare("SELECT name_norm FROM crops WHERE crop_id=?");
                $nameRow->execute(array($cropId));
                $nn = $nameRow->fetchColumn();
                if ($nn) {
                    $a = $pdo->prepare("INSERT INTO crop_aliases (alias_norm, crop_id, source) VALUES (?,?, 'admin')
                                        ON DUPLICATE KEY UPDATE crop_id = VALUES(crop_id)");
                    $a->execute(array($nn, $into));
                }
                $pdo->prepare("UPDATE customer_plots SET crop_id=? WHERE crop_id=?")->execute(array($into, $cropId));
                $pdo->prepare("UPDATE crops SET status='merged', merged_into=? WHERE crop_id=?")->execute(array($into, $cropId));

            } else { // discard
                $pdo->prepare("UPDATE customer_plots SET crop_id=NULL WHERE crop_id=?")->execute(array($cropId));
                $pdo->prepare("DELETE FROM crop_aliases WHERE crop_id=?")->execute(array($cropId));
                $pdo->prepare("DELETE FROM crops WHERE crop_id=?")->execute(array($cropId));
            }

            // usage_count ต้องตรงเสมอ เพราะใช้เรียงคิว
            $pdo->exec(
                "UPDATE crops c
                 LEFT JOIN (SELECT crop_id, COUNT(*) n FROM customer_plots
                             WHERE crop_id IS NOT NULL AND is_active=1 GROUP BY crop_id) p
                        ON p.crop_id = c.crop_id
                    SET c.usage_count = COALESCE(p.n, 0)");
            $pdo->commit();
            json_response(array('ok' => true));
        } catch (Exception $e) {
            $pdo->rollBack();
            json_response(array('error' => 'REVIEW_FAILED', 'message' => $e->getMessage()), 400);
        }
    }

    // ───────────────────────── ชุดข้อมูลสวน ─────────────────────────

    /** อ่านชุดข้อมูลสวนของลูกค้า 1 ราย */
    public static function getPlots(PDO $pdo): void
    {
        $cid = self::resolveCustomerId($pdo, isset($_GET['customerId']) ? $_GET['customerId'] : null);
        if ($cid === null) { json_response(array('error' => 'CUSTOMER_NOT_FOUND'), 404); return; }

        $stmt = $pdo->prepare(
            "SELECT p.plot_id, p.crop_id, c.name AS crop_name, c.category, c.default_unit,
                    p.size_value, p.size_unit, p.size_bucket, p.is_home_garden, p.note,
                    p.source, p.updated_at
               FROM customer_plots p
          LEFT JOIN crops c ON c.crop_id = p.crop_id
              WHERE p.customer_id = ? AND p.is_active = 1
           ORDER BY p.plot_id ASC");
        $stmt->execute(array($cid));
        json_response(array('customerId' => $cid, 'plots' => $stmt->fetchAll(PDO::FETCH_ASSOC)));
    }

    /**
     * บันทึกชุดข้อมูลสวนทั้งหมดของลูกค้า (แทนที่ของเดิม)
     * ส่งมาทั้งชุดเสมอ — ง่ายกว่าและกันสถานะเพี้ยนเวลาผู้ใช้ลบชุดกลางๆ ออก
     *
     * body: { customerId, callId?, userId?, plots: [ {cropId?, cropName?, sizeValue?, sizeUnit?, isHomeGarden?, note?} ] }
     */
    public static function savePlots(PDO $pdo): void
    {
        $in  = json_input();
        $cid = self::resolveCustomerId($pdo, isset($in['customerId']) ? $in['customerId'] : null);
        if ($cid === null) { json_response(array('error' => 'CUSTOMER_NOT_FOUND'), 404); return; }

        $plots  = isset($in['plots']) && is_array($in['plots']) ? $in['plots'] : array();
        $callId = isset($in['callId']) ? (int)$in['callId'] : null;
        $userId = isset($in['userId']) ? (int)$in['userId'] : null;

        if (count($plots) > 20) {
            json_response(array('error' => 'TOO_MANY_PLOTS', 'message' => 'เก็บได้สูงสุด 20 ชุดต่อลูกค้า'), 400);
            return;
        }

        // เตรียมข้อมูลขาเข้าให้อยู่ในรูปเทียบได้ก่อน แล้วเทียบกับของเดิม
        // ถ้าเหมือนเดิมทุกอย่างให้จบเลย ไม่ต้องเขียนอะไร
        //
        // จำเป็นเพราะ modal บันทึกการโทรจะส่งข้อมูลสวนมาด้วยทุกครั้งที่ลงสาย
        // ถ้าเขียนใหม่ทุกครั้ง ตารางจะโตตามจำนวน "สาย" แทนที่จะโตตาม "ข้อมูลที่เปลี่ยนจริง"
        // (โทรลูกค้าเดิม 10 ครั้งโดยไม่แก้อะไร = แถวตาย 10 ชุด)
        $incoming = array();
        foreach ($plots as $p) {
            $cropId = isset($p['cropId']) && $p['cropId'] ? (int)$p['cropId'] : null;
            if ($cropId === null && !empty($p['cropName'])) {
                $cropId = self::resolveOrCreateCrop($pdo, $p['cropName'], $userId);
            }
            $isHome = !empty($p['isHomeGarden']) ? 1 : 0;
            $unit   = isset($p['sizeUnit']) ? (string)$p['sizeUnit'] : null;
            $val    = (isset($p['sizeValue']) && $p['sizeValue'] !== '' && $p['sizeValue'] !== null)
                        ? (float)$p['sizeValue'] : null;
            if (!in_array($unit, array('ไร่', 'ต้น', 'งาน', 'ตร.ว.'), true)) $unit = null;
            if ($val !== null && $val <= 0) $val = null;
            if ($val === null) $unit = null;

            // is_home_garden กับ ขนาด เป็นอิสระต่อกัน — อย่าล้างขนาดทิ้ง
            // "ปลูกรอบๆบ้านที่ว่าง 1 ไร่" เป็นทั้งปลูกกินเอง และ 1 ไร่ ทั้งคู่จริง

            $note = isset($p['note']) ? mb_substr(trim((string)$p['note']), 0, 255, 'UTF-8') : null;
            if ($note === '') $note = null;

            if ($cropId === null && $val === null && !$isHome && $note === null) continue;
            $incoming[] = array($cropId, $val, $unit, $isHome, $note);
        }

        $cur = $pdo->prepare(
            "SELECT crop_id, size_value, size_unit, is_home_garden, note
               FROM customer_plots WHERE customer_id = ? AND is_active = 1 ORDER BY plot_id ASC");
        $cur->execute(array($cid));
        $existing = array();
        foreach ($cur->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $existing[] = array(
                $r['crop_id'] !== null ? (int)$r['crop_id'] : null,
                $r['size_value'] !== null ? (float)$r['size_value'] : null,
                $r['size_unit'],
                (int)$r['is_home_garden'],
                $r['note'],
            );
        }
        if ($incoming === $existing) {
            json_response(array('ok' => true, 'customerId' => $cid,
                                'saved' => count($existing), 'unchanged' => true));
            return;
        }

        $pdo->beginTransaction();
        try {
            // ปิดของเดิมทั้งหมด (ไม่ลบจริง เผื่อต้องย้อนดู)
            $pdo->prepare("UPDATE customer_plots SET is_active = 0 WHERE customer_id = ? AND is_active = 1")
                ->execute(array($cid));

            $ins = $pdo->prepare(
                "INSERT INTO customer_plots
                   (customer_id, crop_id, size_value, size_unit, size_bucket,
                    is_home_garden, note, source, source_call_id, created_by)
                 VALUES (?,?,?,?,?,?,?, 'manual', ?, ?)");

            $saved = 0;
            foreach ($incoming as $row) {
                list($cropId, $val, $unit, $isHome, $note) = $row;
                $ins->execute(array(
                    $cid, $cropId, $val, $unit, CropNormalizer::sizeBucket($val, $unit),
                    $isHome, $note, $callId, $userId
                ));
                $saved++;
            }

            $pdo->exec(
                "UPDATE crops c
                 LEFT JOIN (SELECT crop_id, COUNT(*) n FROM customer_plots
                             WHERE crop_id IS NOT NULL AND is_active=1 GROUP BY crop_id) p
                        ON p.crop_id = c.crop_id
                    SET c.usage_count = COALESCE(p.n, 0)");

            $pdo->commit();
            json_response(array('ok' => true, 'customerId' => $cid, 'saved' => $saved));
        } catch (Exception $e) {
            $pdo->rollBack();
            json_response(array('error' => 'SAVE_FAILED', 'message' => $e->getMessage()), 400);
        }
    }

    // ───────────────────────── ตัวช่วย ─────────────────────────

    /** customers ถูกอ้างด้วย customer_id หรือ customer_ref_id แล้วแต่ที่เรียก — รองรับทั้งคู่ */
    private static function resolveCustomerId(PDO $pdo, $raw): ?int
    {
        if ($raw === null || $raw === '') return null;
        $stmt = $pdo->prepare(
            "SELECT customer_id FROM customers
              WHERE customer_ref_id = ? OR customer_id = ? LIMIT 1");
        $stmt->execute(array((string)$raw, is_numeric($raw) ? (int)$raw : 0));
        $id = $stmt->fetchColumn();
        return $id ? (int)$id : null;
    }

    /** หา crop_id จากชื่อ ถ้าไม่มีให้สร้างเป็น pending (ไม่บล็อกการบันทึก) — เปิด public ให้ disposition มือถือ reuse */
    public static function resolveOrCreateCrop(PDO $pdo, $rawName, $userId): ?int
    {
        $name = CropNormalizer::clean($rawName);
        if ($name === '' || CropNormalizer::isJunk($name)) return null;

        $s = $pdo->prepare(
            "SELECT c.crop_id FROM crops c
          LEFT JOIN crop_aliases a ON a.crop_id = c.crop_id
              WHERE c.name_norm = ? OR a.alias_norm = ? LIMIT 1");
        $s->execute(array($name, $name));
        $id = $s->fetchColumn();
        if ($id) return (int)$id;

        // แก้คำสะกดผิดที่มั่นใจให้อัตโนมัติ ก่อนตัดสินใจสร้างใหม่
        $fix = CropNormalizer::autoCorrect($name);
        if ($fix !== null) {
            $s2 = $pdo->prepare("SELECT crop_id FROM crops WHERE name_norm = ? LIMIT 1");
            $s2->execute(array(CropNormalizer::clean($fix)));
            $id2 = $s2->fetchColumn();
            if ($id2) {
                $a = $pdo->prepare("INSERT INTO crop_aliases (alias_norm, crop_id, source) VALUES (?,?, 'auto')
                                    ON DUPLICATE KEY UPDATE crop_id = VALUES(crop_id)");
                $a->execute(array($name, (int)$id2));
                return (int)$id2;
            }
        }

        $meta = CropNormalizer::cropMeta($name);
        $ins = $pdo->prepare(
            "INSERT INTO crops (name, name_norm, category, default_unit, status, created_by)
             VALUES (?,?,?,?, 'pending', ?)
             ON DUPLICATE KEY UPDATE crop_id = LAST_INSERT_ID(crop_id)");
        $ins->execute(array($name, $name, $meta ? $meta[0] : 'อื่นๆ', $meta ? $meta[1] : 'ไร่', $userId));
        return (int)$pdo->lastInsertId();
    }
}
