<?php
/**
 * Basket Integrity Cron — ตาข่ายรับลูกค้าที่หลุดออกนอกระบบถัง
 *
 * ตั้งใจให้รันรายวัน ปลอดภัยกับ production
 *
 * ทำอะไร (Pass 2 — reconcileOrphanedBaskets)
 *   เก็บกวาดลูกค้าที่ระบบมองไม่เห็น 4 อาการ:
 *     1. current_basket_key เป็น NULL
 *     2. current_basket_key เป็นค่าที่ไม่ตรงกับ basket_config.id ใด (เช่นเก็บ key แทน id)
 *     3. มีเจ้าของ แต่ถังอยู่ฝั่ง distribution -> เจ้าของมองไม่เห็นบน Dashboard
 *     4. ไม่มีเจ้าของ แต่ถังอยู่ฝั่ง dashboard_v2 -> เอาไปแจกต่อไม่ได้
 *   ลูกค้าที่เจ้าของ inactive/resigned จะถูกข้ามและรายงานไว้ ไม่ย้ายให้
 *   เพราะการปลดเจ้าของเป็นการตัดสินใจเชิงธุรกิจ ไม่ใช่หน้าที่ cron
 *
 * ไม่ทำอะไร (Pass 1 — aging)
 *   ปิดไว้โดยตั้งใจ ดูเหตุผลเต็มในคอมเมนต์ก่อนบล็อก try ข้างล่าง
 *   งาน aging ตัวจริงคือ monthly_transfer_web.php (cron วันที่ 1 เวลา 01:00)
 *
 * ประวัติ: ไฟล์นี้เขียนไว้ตั้งแต่ ก.พ. 2569 แต่ไม่เคยถูกตั้ง cron บน host เลย
 * (basket_transition_log มี aging_timeout = 0 แถวจากทั้งหมด 2 ล้านแถว) ตอนหยิบ
 * มาใช้จริง 28 ส.ค. 2569 จึงพบว่า Pass 1 ยังทำงานไม่ครบ -- ย้ายถังเป็นแต่ลืม
 * ปลดเจ้าของ เลยเก็บไว้แต่ปิดสวิตช์
 *
 * Usage:
 * - Dry run: /api/cron/basket_aging_cron.php?key=basket_aging_2026_secret&dryrun=1
 * - Execute: /api/cron/basket_aging_cron.php?key=basket_aging_2026_secret&dryrun=0
 * - เปิด aging (อ่านคำเตือนก่อน): เติม &aging=1
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

header('Content-Type: text/plain; charset=utf-8');

// Security check
$expectedKey = 'basket_aging_2026_secret';
$providedKey = $_GET['key'] ?? '';

if ($providedKey !== $expectedKey) {
    http_response_code(403);
    die("Access denied. Invalid key.");
}

$dryRun = !isset($_GET['dryrun']) || $_GET['dryrun'] !== '0';

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/cron_logger.php';
require_once __DIR__ . '/../Services/BasketRoutingServiceV2.php';

$logger = new CronLogger('basket_aging_cron');
$logger->logStart();

echo "=====================================================\n";
echo "Basket Integrity Cron (ตาข่ายรับถัง)\n";
echo "Date: " . date('Y-m-d H:i:s') . "\n";
echo "Mode: " . ($dryRun ? "DRY RUN (Preview Only)" : "LIVE EXECUTION") . "\n";
echo "=====================================================\n\n";

// config.php ตั้ง max_execution_time = 120 ไว้ ต้องปลดหลัง require
// บน Linux เวลารอ DB ไม่ถูกนับ จึงไม่เคยมีใครเจอปัญหา แต่กันไว้ไม่เสียหาย
set_time_limit(0);
ignore_user_abort(true);

// ─────────────────────────────────────────────────────────────
// Pass 1 (aging) ปิดไว้โดยตั้งใจ — ต้องส่ง &aging=1 ถึงจะทำงาน
//
// processAgingCustomers() ย้ายถังอย่างเดียว "ไม่ปลดเจ้าของ" ซึ่งไม่ครบตามกติกา
// ธุรกิจ: ถังที่หมดเวลาถือครองเกือบทั้งหมดตั้ง on_fail_basket_key ไปฝั่ง
// distribution ซึ่งแปลว่า "ยึดคืนไปแจกใหม่" การย้ายถังโดยคงเจ้าของไว้จึงได้
// ลูกค้าที่มีเจ้าของแต่จมอยู่ในถังกองกลาง เจ้าของมองไม่เห็นบน Dashboard
//
// dry run 28 ส.ค. 2569: ผู้เข้าเกณฑ์ 26,025 ราย "มีเจ้าของทุกคน" จะย้ายจริง
// 14,238 ราย -- แล้ว Pass 2 ก็จะดึงกลับฝั่ง Dashboard ตีปิงปองกันทุกคืน
//
// งาน aging ตัวจริงคือ monthly_transfer_web.php (cron วันที่ 1 เวลา 01:00)
// ซึ่งทำถูกต้องอยู่แล้ว: ปลายทาง Dashboard เก็บ assigned_to ไว้, ปลายทาง
// distribution เซ็ต assigned_to = NULL (1 ส.ค. 2569 ปลดเจ้าของ 111,417 ราย)
//
// อย่าเปิด Pass 1 จนกว่าจะเติมตรรกะปลดเจ้าของให้ครบและตัดสินใจแล้วว่าจะให้
// มันแทน monthly_transfer_web หรือไม่ -- เปิดพร้อมกันสองตัวคือทำงานทับกัน
// ─────────────────────────────────────────────────────────────
$runAging = ($_GET['aging'] ?? '0') === '1';

try {
    $pdo = db_connect();

    $router = new BasketRoutingServiceV2($pdo);
    $results = $runAging
        ? $router->processAgingCustomers($dryRun)
        : ['processed' => 0, 'moved' => 0, 'errors' => 0, 'details' => []];

    if (!$runAging) {
        echo "PASS 1 (aging) ถูกข้าม — ปิดไว้โดยตั้งใจ ดูเหตุผลในคอมเมนต์หัวไฟล์\n";
        echo "งาน aging ตัวจริงคือ monthly_transfer_web.php (วันที่ 1 เวลา 01:00)\n";
        echo "ถ้าจำเป็นต้องรันจริง ๆ ให้เติม &aging=1 และอ่านคำเตือนก่อน\n\n";
    }

    echo "=====================================================\n";
    echo "SUMMARY\n";
    echo "=====================================================\n";
    echo "Processed: {$results['processed']}\n";
    echo "Moved:     {$results['moved']}\n";
    echo "Errors:    {$results['errors']}\n";
    echo "=====================================================\n\n";
    
    if (!empty($results['details'])) {
        echo "Details:\n";
        foreach ($results['details'] as $i => $detail) {
            $num = $i + 1;
            if (isset($detail['error'])) {
                echo "[{$num}] Customer #{$detail['customer_id']}: ERROR - {$detail['error']}\n";
            } else {
                $action = $dryRun ? "WOULD MOVE" : "MOVED";
                echo "[{$num}] Customer #{$detail['customer_id']}: {$action} from {$detail['from']} to {$detail['to']}\n";
            }
        }
    }
    
    // -----------------------------------------------------------------
    // Pass 2: เก็บกวาดลูกค้าที่หลุดออกนอกระบบถัง
    //
    // Pass แรกวนจาก basket_config แล้วยิง WHERE current_basket_key = ? ทีละถัง
    // ลูกค้าที่ถังเป็น NULL หรือเป็นค่าที่ไม่ตรงกับ id ไหนเลย จึงไม่เคยถูกแตะ
    // เลยสักครั้งนับจากวันที่ถูกสร้าง pass นี้คือตาข่ายรับของพวกนั้น
    // -----------------------------------------------------------------
    $recon = $router->reconcileOrphanedBaskets($dryRun);

    echo "=====================================================\n";
    echo "PASS 2 - RECONCILE ORPHANED BASKETS\n";
    echo "=====================================================\n";
    echo "Checked:  {$recon['processed']}\n";
    echo "Moved:    {$recon['moved']}\n";
    echo "Skipped:  {$recon['skipped']}\n";
    echo "Errors:   {$recon['errors']}\n";
    echo "=====================================================\n\n";

    if (!empty($recon['details'])) {
        $byReason = [];
        foreach ($recon['details'] as $d) {
            $key = $d['reason'] ?? ($d['error'] ?? 'unknown');
            $byReason[$key] = ($byReason[$key] ?? 0) + 1;
        }
        echo "Breakdown:\n";
        foreach ($byReason as $reason => $count) {
            echo "  - {$reason}: {$count}\n";
        }
        echo "\n";
    }

    if ($dryRun) {
        echo "\nDRY RUN COMPLETE - No changes made\n";
        echo "To execute: add &dryrun=0 to URL\n";
        $logger->log("DRY RUN: Processed={$results['processed']}, Would move={$results['moved']}, Orphans would move={$recon['moved']}");
    } else {
        $logger->log("EXECUTED: Processed={$results['processed']}, Moved={$results['moved']}, Errors={$results['errors']}, Orphans moved={$recon['moved']}, Orphan errors={$recon['errors']}");
    }

    $logger->logEnd($results['processed'] > 0 || $recon['processed'] > 0);
    
} catch (PDOException $e) {
    $logger->logError($e->getMessage());
    echo "Database error: " . $e->getMessage() . "\n";
    exit(1);
} catch (Exception $e) {
    $logger->logError($e->getMessage());
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}
