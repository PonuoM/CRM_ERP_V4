<?php
/**
 * สแกนกล่องรอตรวจ (Challenge Review Inbox)
 *
 * อ่าน call_history หาลูกค้าที่เข้าเกณฑ์ตาม basket_config.flag_* แล้วเขียนธงลง
 * challenge_flags — **ไม่แตะข้อมูลลูกค้าเลย** การย้ายถัง/บล็อคเป็นการกระทำของ sup เท่านั้น
 *
 * GET ?action=scan                  → สแกนจริง เขียนธง (ค่าตั้งต้น)
 * GET ?action=preview               → นับอย่างเดียว ไม่เขียนอะไรลง DB
 * GET ?companyId=5                  → จำกัดบริษัทเดียว (ไม่ใส่ = ทุกบริษัท)
 *
 * รันจาก CLI ก็ได้:
 *   php api/cron/challenge_flags_scan.php preview
 *   DB_HOST=202.183.192.218 php api/cron/challenge_flags_scan.php preview 5
 *
 * ตั้ง cron วันละครั้งตอนดึกก็พอ — ธงไม่ใช่ของที่ต้องสด ๆ ระดับนาที และ query
 * ต้องอ่าน call_history ทั้งตาราง (ไม่มี index บน result/status)
 */

$isCli = php_sapi_name() === 'cli';

if (!$isCli) {
    header('Content-Type: application/json; charset=utf-8');
}

define('SKIP_AUTH', true);
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../Services/ChallengeFlagService.php';

try {
    $action = $isCli
        ? ($argv[1] ?? 'scan')
        : ($_GET['action'] ?? 'scan');

    $companyId = $isCli
        ? (isset($argv[2]) && $argv[2] !== '' ? (int) $argv[2] : null)
        : (isset($_GET['companyId']) && $_GET['companyId'] !== '' ? (int) $_GET['companyId'] : null);

    $dryRun = ($action === 'preview');

    $pdo = db_connect();
    if (function_exists('set_audit_context')) {
        set_audit_context($pdo, 'cron/challenge_flags_scan');
    }

    $started = microtime(true);
    $result = ChallengeFlagService::scan($pdo, $companyId, $dryRun);
    $result['elapsed_sec'] = round(microtime(true) - $started, 2);
    $result['ok'] = true;

    if ($isCli) {
        echo ($dryRun ? "== พรีวิว (ไม่เขียน DB) ==\n" : "== สแกนและเขียนธง ==\n");
        echo "บริษัท: " . ($companyId === null ? 'ทุกบริษัท' : $companyId) . "\n";
        foreach ($result['baskets'] as $b) {
            printf(
                "\n[%s] %s\n  เกณฑ์: %s\n  เข้าข่าย %d ราย (ยืนยันแล้ว %d · รอตรวจ %d)\n",
                $b['basket_key'],
                $b['basket_name'],
                $b['rule'],
                $b['candidates'],
                $b['confirmed'],
                $b['review']
            );
            if (!$dryRun) {
                $w = $b['written'];
                printf(
                    "  เขียน: ใหม่ %d · อัปเดต %d · ปลุกกลับ %d · คงสถานะเดิม %d · หมดอายุ %d\n",
                    $w['new'], $w['updated'], $w['reopened'], $w['held'], $w['expired']
                );
            }
        }
        printf("\nใช้เวลา %.2f วินาที\n", $result['elapsed_sec']);
    } else {
        echo json_encode($result, JSON_UNESCAPED_UNICODE);
    }
} catch (Throwable $e) {
    $payload = ['ok' => false, 'error' => $e->getMessage()];
    if ($isCli) {
        fwrite(STDERR, "ล้มเหลว: " . $e->getMessage() . "\n");
        exit(1);
    }
    http_response_code(500);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
}
