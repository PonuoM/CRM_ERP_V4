<?php
/**
 * ChallengeFlagService — ตัวสแกน "กล่องรอตรวจ"
 *
 * หน้าที่เดียว: อ่าน call_history หาลูกค้าที่เข้าเกณฑ์ แล้วเขียนธงลง challenge_flags
 * **ห้ามแตะตาราง customers เด็ดขาด** การย้ายถัง/บล็อคเป็นการกระทำของ sup เท่านั้น
 * ถ้าวันหนึ่งมีคนอยากให้ไฟล์นี้ย้ายเองอัตโนมัติ ให้ไปคุยกันใหม่ก่อน อย่าแอบเพิ่ม
 *
 * เกณฑ์ทั้งหมดอ่านจาก basket_config.flag_* (ดู migration 093) แก้ผ่านหน้าเว็บได้
 * ไม่ต้องแก้ไฟล์นี้
 */

class ChallengeFlagService
{
    /** ขนาดก้อนตอนยิง IN (...) / INSERT หลายแถว กันพารามิเตอร์ล้น */
    const CHUNK = 300;

    /**
     * อ่านเกณฑ์ที่เปิดใช้อยู่ทั้งหมด
     *
     * basket_config เป็นตารางกลาง ใช้ company_id = 1 เสมอสำหรับทุกบริษัท
     * (ดูคอมเมนต์ "SHARED: Always use company 1" ใน basket_config.php)
     */
    public static function loadRules(PDO $pdo): array
    {
        $sql = "SELECT id, basket_key, basket_name, flag_results, flag_min_hits,
                       flag_min_agents, flag_confirm_agents, flag_lookback_days
                  FROM basket_config
                 WHERE company_id = 1
                   AND flag_is_active = 1
                   AND flag_results IS NOT NULL
                   AND TRIM(flag_results) <> ''
                 ORDER BY display_order ASC, id ASC";

        $rules = [];
        foreach ($pdo->query($sql)->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $results = array_values(array_filter(array_map('trim', explode(',', $row['flag_results'])), function ($r) {
                return $r !== '';
            }));
            if (empty($results)) {
                continue;
            }

            $rules[] = [
                'basket_id'      => (int) $row['id'],
                'basket_key'     => $row['basket_key'],
                'basket_name'    => $row['basket_name'],
                'results'        => $results,
                'min_hits'       => max(1, (int) ($row['flag_min_hits'] ?: 1)),
                'min_agents'     => max(1, (int) ($row['flag_min_agents'] ?: 1)),
                // ถ้าไม่ตั้งไว้ ให้ถือว่าทุกแถวที่ขึ้นกล่องคือ "ยืนยันแล้ว"
                'confirm_agents' => max(1, (int) ($row['flag_confirm_agents'] ?: ($row['flag_min_agents'] ?: 1))),
                'lookback_days'  => $row['flag_lookback_days'] !== null ? (int) $row['flag_lookback_days'] : null,
            ];
        }

        return $rules;
    }

    /**
     * สแกนทุกเกณฑ์แล้วอัปเดตธง
     *
     * @param int|null $companyId  จำกัดเฉพาะบริษัทเดียว (null = ทุกบริษัท)
     * @param bool     $dryRun     true = นับอย่างเดียว ไม่เขียนอะไรลง DB เลย
     * @return array   สรุปผลรายถัง สำหรับให้ endpoint ส่งกลับเป็น JSON
     */
    public static function scan(PDO $pdo, ?int $companyId = null, bool $dryRun = false): array
    {
        $scanStartedAt = date('Y-m-d H:i:s');
        $rules = self::loadRules($pdo);
        $summary = [];

        foreach ($rules as $rule) {
            $candidates = self::findCandidates($pdo, $rule, $companyId);

            $counts = ['confirmed' => 0, 'review' => 0];
            foreach ($candidates as $c) {
                $counts[$c['confidence']]++;
            }

            $written = ['new' => 0, 'updated' => 0, 'reopened' => 0, 'held' => 0, 'expired' => 0];
            if (!$dryRun) {
                $written = self::persist($pdo, $rule, $candidates, $scanStartedAt, $companyId);
            }

            $summary[] = [
                'basket_key'     => $rule['basket_key'],
                'basket_name'    => $rule['basket_name'],
                'rule'           => sprintf(
                    '%s · %d ครั้ง / %d คน / %s',
                    implode(', ', $rule['results']),
                    $rule['min_hits'],
                    $rule['min_agents'],
                    $rule['lookback_days'] === null ? 'ไม่จำกัดช่วงเวลา' : $rule['lookback_days'] . ' วัน'
                ),
                'candidates'     => count($candidates),
                'confirmed'      => $counts['confirmed'],
                'review'         => $counts['review'],
                'written'        => $written,
            ];
        }

        return [
            'scanned_at' => $scanStartedAt,
            'dry_run'    => $dryRun,
            'company_id' => $companyId,
            'baskets'    => $summary,
        ];
    }

    /**
     * หาลูกค้าที่เข้าเกณฑ์ของถังหนึ่ง พร้อมหลักฐานว่าใครบันทึกบ้าง
     */
    private static function findCandidates(PDO $pdo, array $rule, ?int $companyId): array
    {
        $ph = implode(',', array_fill(0, count($rule['results']), '?'));

        // ผลการโทรถูกบันทึกลงได้ทั้ง result และ status แล้วแต่หน้าจอที่ใช้บันทึก
        // (เช่น 'ไม่รับสาย' โผล่ทั้งสองคอลัมน์) จึงต้องจับทั้งคู่ ไม่งั้นนับขาด
        $matchSql = "(ch.result IN ($ph) OR ch.status IN ($ph))";
        $matchParams = array_merge($rule['results'], $rule['results']);

        $dateSql = '';
        $dateParams = [];
        if ($rule['lookback_days'] !== null) {
            $dateSql = " AND ch.date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)";
            $dateParams[] = $rule['lookback_days'];
        }

        $companySql = '';
        $companyParams = [];
        if ($companyId !== null) {
            $companySql = " AND c.company_id = ?";
            $companyParams[] = $companyId;
        }

        // เงื่อนไขที่ตัดออกตั้งแต่ต้นทาง:
        //   - ลูกค้าที่ถูกบล็อคแล้ว ไม่ต้องเตือนซ้ำ (ครอบคลุมเกณฑ์ 'ห้ามติดต่อ' ด้วย)
        //   - ลูกค้าที่นั่งอยู่ในถังปลายทางอยู่แล้ว แปลว่ามีคนจัดการไปแล้ว
        // current_basket_key เป็น varchar ที่เก็บ "เลข id ของถัง" (ไม่ใช่ basket_key)
        // — กับดักเดิมของระบบนี้ ดูคอมเมนต์ใน basket_config.php:handleBasketCustomers
        $sql = "
            SELECT c.company_id,
                   ch.customer_id,
                   c.assigned_to,
                   COUNT(*)                      AS hits,
                   COUNT(DISTINCT ch.caller_id)  AS agents,
                   MIN(ch.date)                  AS first_hit_at,
                   MAX(ch.date)                  AS last_hit_at
              FROM call_history ch
              JOIN customers c ON c.customer_id = ch.customer_id
             WHERE ch.caller_id IS NOT NULL
               AND {$matchSql}
               {$dateSql}
               {$companySql}
               AND COALESCE(c.is_blocked, 0) = 0
               AND (c.current_basket_key IS NULL OR c.current_basket_key <> ?)
             GROUP BY ch.customer_id, c.company_id, c.assigned_to
            HAVING hits >= ? AND agents >= ?
        ";

        $params = array_merge(
            $matchParams,
            $dateParams,
            $companyParams,
            [(string) $rule['basket_id'], $rule['min_hits'], $rule['min_agents']]
        );

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($rows)) {
            return [];
        }

        $candidates = [];
        foreach ($rows as $r) {
            $agents = (int) $r['agents'];
            $candidates[(int) $r['customer_id']] = [
                'company_id'   => (int) $r['company_id'],
                'customer_id'  => (int) $r['customer_id'],
                'assigned_to'  => $r['assigned_to'] !== null ? (int) $r['assigned_to'] : null,
                'hits'         => (int) $r['hits'],
                'agents'       => $agents,
                'first_hit_at' => $r['first_hit_at'],
                'last_hit_at'  => $r['last_hit_at'],
                'confidence'   => $agents >= $rule['confirm_agents'] ? 'confirmed' : 'review',
                'reason'       => $rule['results'][0],
                'evidence'     => [],
            ];
        }

        self::attachEvidence($pdo, $rule, $candidates, $matchParams, $dateParams);

        return array_values($candidates);
    }

    /**
     * แปะรายชื่อคนที่บันทึก + จำนวนครั้ง + ครั้งล่าสุด ลงในผู้เข้าข่ายแต่ละราย
     *
     * ทำเป็น query แยกก้อนละหลายร้อยคน แทนที่จะยิงรายลูกค้า เพราะกล่องนี้มีได้เป็นพันแถว
     * หน้าเว็บจะได้แสดง "ฝ้าย·มิ้น·เบียร์" ได้เลยโดยไม่ต้อง query ซ้ำทีละแถว
     */
    private static function attachEvidence(PDO $pdo, array $rule, array &$candidates, array $matchParams, array $dateParams): void
    {
        $ph = implode(',', array_fill(0, count($rule['results']), '?'));
        $dateSql = empty($dateParams) ? '' : " AND ch.date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)";

        foreach (array_chunk(array_keys($candidates), self::CHUNK) as $chunk) {
            $idPh = implode(',', array_fill(0, count($chunk), '?'));

            // last_result = ผลการโทรของสายล่าสุดของคนนั้น เลือกฝั่งที่ "ตรงเกณฑ์" จริง ๆ
            // เพราะบางแถวมี status='ไม่รับสาย' แต่ result เป็นอย่างอื่น ถ้าหยิบ result มาดื้อ ๆ
            // sup จะเห็นสาเหตุที่ไม่ใช่ตัวที่ทำให้ติดธง
            $sql = "
                SELECT ch.customer_id,
                       ch.caller_id,
                       COALESCE(
                           NULLIF(TRIM(CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,''))), ''),
                           NULLIF(ch.caller, ''),
                           CONCAT('user#', ch.caller_id)
                       ) AS caller_name,
                       COUNT(*)      AS n,
                       MAX(ch.date)  AS last_at,
                       SUBSTRING_INDEX(
                           GROUP_CONCAT(
                               CASE WHEN ch.result IN ($ph) THEN ch.result ELSE ch.status END
                               ORDER BY ch.date DESC SEPARATOR '||'
                           ), '||', 1
                       ) AS last_result
                  FROM call_history ch
                  LEFT JOIN users u ON u.id = ch.caller_id
                 WHERE ch.customer_id IN ($idPh)
                   AND ch.caller_id IS NOT NULL
                   AND (ch.result IN ($ph) OR ch.status IN ($ph))
                   {$dateSql}
                 GROUP BY ch.customer_id, ch.caller_id, caller_name
                 ORDER BY ch.customer_id, n DESC, last_at DESC
            ";

            $stmt = $pdo->prepare($sql);
            // ลำดับพารามิเตอร์ต้องไล่ตามตำแหน่งที่ ? โผล่ใน SQL: CASE ใน SELECT มาก่อน WHERE
            $stmt->execute(array_merge($rule['results'], $chunk, $matchParams, $dateParams));

            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $cid = (int) $row['customer_id'];
                if (!isset($candidates[$cid])) {
                    continue;
                }
                $candidates[$cid]['evidence'][] = [
                    'caller_id'   => (int) $row['caller_id'],
                    'caller_name' => $row['caller_name'],
                    'count'       => (int) $row['n'],
                    'last_at'     => $row['last_at'],
                    'last_result' => $row['last_result'],
                ];
            }
        }
    }

    /**
     * เขียนธงลงตาราง
     *
     * การตัดสินสถานะทำใน PHP ทั้งหมด ไม่ยัดลง ON DUPLICATE KEY UPDATE เพราะใน MySQL
     * การ assign ใน ON DUPLICATE ไล่จากซ้ายไปขวา — เขียน CASE ที่อ้าง hit_count เดิม
     * หลังบรรทัดที่เพิ่งทับ hit_count ไปแล้ว จะได้ค่าใหม่มาเทียบ แล้วเงื่อนไขจะเพี้ยนเงียบ ๆ
     */
    private static function persist(PDO $pdo, array $rule, array $candidates, string $scanStartedAt, ?int $companyId): array
    {
        $stats = ['new' => 0, 'updated' => 0, 'reopened' => 0, 'held' => 0, 'expired' => 0];

        foreach (array_chunk($candidates, self::CHUNK) as $chunk) {
            $ids = array_column($chunk, 'customer_id');
            $idPh = implode(',', array_fill(0, count($ids), '?'));

            $existingStmt = $pdo->prepare("
                SELECT customer_id, status, hit_count, reviewed_hit_count
                  FROM challenge_flags
                 WHERE rule_basket_key = ? AND customer_id IN ($idPh)
            ");
            $existingStmt->execute(array_merge([$rule['basket_key']], $ids));

            $existing = [];
            foreach ($existingStmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $existing[(int) $row['customer_id']] = $row;
            }

            $values = [];
            $params = [];

            foreach ($chunk as $cand) {
                $prev = $existing[$cand['customer_id']] ?? null;

                if ($prev === null) {
                    $status = 'pending';
                    $stats['new']++;
                } elseif (in_array($prev['status'], ['pending', 'expired'], true)) {
                    $status = 'pending';
                    $stats['updated']++;
                } else {
                    // sup ตัดสินใจไปแล้ว (moved/dismissed) — ปลุกใหม่เฉพาะเมื่อมีสายเพิ่ม
                    // หลังจากวันที่ตัดสินใจ ไม่ใช่เด้งกลับมาทุกคืน
                    $baseline = $prev['reviewed_hit_count'] !== null
                        ? (int) $prev['reviewed_hit_count']
                        : (int) $prev['hit_count'];

                    if ($cand['hits'] > $baseline) {
                        $status = 'pending';
                        $stats['reopened']++;
                    } else {
                        $status = $prev['status'];
                        $stats['held']++;
                    }
                }

                // เก็บสาเหตุที่ "คนล่าสุดบันทึก" ไม่ใช่ตัวแรกในเกณฑ์ — สำคัญกับถังที่นับหลายผล
                // รวมกัน (ฝากสั่ง/รับแทน นับทั้ง 'คนอื่นรับสายแทน' และ 'ฝากส่งไม่ได้ใช้เอง')
                // sup จะได้เห็นตรงกับโน้ตที่เปิดอ่าน
                $reason = $rule['results'][0];
                $latestAt = null;
                foreach ($cand['evidence'] as $ev) {
                    if (($latestAt === null || $ev['last_at'] > $latestAt) && !empty($ev['last_result'])) {
                        $latestAt = $ev['last_at'];
                        $reason = $ev['last_result'];
                    }
                }

                $values[] = '(?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())';
                array_push(
                    $params,
                    $cand['company_id'],
                    $cand['customer_id'],
                    $rule['basket_key'],
                    $reason,
                    $cand['hits'],
                    $cand['agents'],
                    $cand['first_hit_at'],
                    $cand['last_hit_at'],
                    $cand['confidence'],
                    json_encode($cand['evidence'], JSON_UNESCAPED_UNICODE),
                    $cand['assigned_to'],
                    $status,
                    $scanStartedAt
                );
            }

            $sql = "
                INSERT INTO challenge_flags
                    (company_id, customer_id, rule_basket_key, reason, hit_count, agent_count,
                     first_hit_at, last_hit_at, confidence, evidence_json, assigned_to_at_flag,
                     status, last_scan_at, created_at)
                VALUES " . implode(',', $values) . "
                ON DUPLICATE KEY UPDATE
                    company_id          = VALUES(company_id),
                    reason              = VALUES(reason),
                    hit_count           = VALUES(hit_count),
                    agent_count         = VALUES(agent_count),
                    first_hit_at        = VALUES(first_hit_at),
                    last_hit_at         = VALUES(last_hit_at),
                    confidence          = VALUES(confidence),
                    evidence_json       = VALUES(evidence_json),
                    assigned_to_at_flag = VALUES(assigned_to_at_flag),
                    status              = VALUES(status),
                    last_scan_at        = VALUES(last_scan_at),
                    updated_at          = NOW()
            ";

            $pdo->prepare($sql)->execute($params);
        }

        // แถว pending ที่ไม่ถูกแตะในรอบนี้ = หลุดเงื่อนไขไปแล้ว (ช่วงเวลานับเลื่อน หรือถูก
        // ย้าย/บล็อคด้วยวิธีอื่น) ปิดเป็น expired แทนที่จะลบ จะได้ยังตามประวัติได้
        $expireSql = "
            UPDATE challenge_flags
               SET status = 'expired', updated_at = NOW()
             WHERE rule_basket_key = ?
               AND status = 'pending'
               AND (last_scan_at IS NULL OR last_scan_at < ?)
        ";
        $expireParams = [$rule['basket_key'], $scanStartedAt];

        if ($companyId !== null) {
            $expireSql .= " AND company_id = ?";
            $expireParams[] = $companyId;
        }

        $expireStmt = $pdo->prepare($expireSql);
        $expireStmt->execute($expireParams);
        $stats['expired'] = $expireStmt->rowCount();

        return $stats;
    }
}
