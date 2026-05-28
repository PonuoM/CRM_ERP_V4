<?php
/**
 * Cron Job: Recalculate All Customer Grades
 * =========================================
 * สคริปต์นี้ใช้สำหรับตั้งเวลา (Cron Job) รันกวาดล้างและอัปเดตเกรดลูกค้าทุกคน
 * ให้เป็นปัจจุบันที่สุด โดยจะคำนวณตามเงื่อนไข (calc_mode, time_range) ของบริษัทนั้นๆ
 * 
 * วิธีการรันผ่าน Command Line (Cron):
 * php api/cron/recalculate_all_grades.php
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../Services/CustomerStatsHelper.php';

header('Content-Type: text/plain; charset=utf-8');

$SECRET_KEY = 'grade_recalc_2026_secret';
$isCli = (php_sapi_name() === 'cli');
$isDryRun = false;

// ตรวจสอบสิทธิ์การเข้าถึง (CLI ไม่ต้องใช้ Key, ถ้าเรียกผ่าน Web ต้องมี Key)
if ($isCli) {
    global $argv;
    $isDryRun = in_array('--dry-run', $argv ?? []);
} else {
    $inputKey = $_GET['key'] ?? '';
    if ($inputKey !== $SECRET_KEY) {
        http_response_code(403);
        die("Access Denied. Invalid key.\n");
    }
    $isDryRun = (isset($_GET['dryrun']) && $_GET['dryrun'] == '1');
}

$pdo = db_connect();

echo "Starting Full Grade Recalculation...\n";
if ($isDryRun) {
    echo ">> MODE: DRY RUN (No data will be changed) <<\n";
}
echo "====================================\n";

try {
    // 1. ดึง Customer ทั้งหมดในระบบ
    $stmt = $pdo->query("
        SELECT c.customer_id, c.company_id, c.first_name, c.last_name, c.grade,
               COALESCE((SELECT SUM(total_amount) FROM orders WHERE customer_id = c.customer_id AND order_status != 'Cancelled'), 0) as actual_total
        FROM customers c
    ");
    $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $total = count($customers);
    echo "Found $total customers to process.\n\n";

    $updatedCount = 0;
    $changedCount = 0;
    
    foreach ($customers as $index => $customer) {
        $cid = (int)$customer['customer_id'];
        $companyId = (int)$customer['company_id'];
        $oldGrade = $customer['grade'];
        $actualTotal = (float)$customer['actual_total'];
        
        if ($isDryRun) {
            // จำลองการคำนวณโดยไม่เซฟลง DB
            $gradeTotal = calculate_grade_purchases_amount($pdo, $cid, $companyId, $actualTotal);
            $newGrade = calculate_customer_grade($pdo, $gradeTotal, $companyId);
            
            if ($oldGrade !== $newGrade) {
                echo "[DRY-RUN] ID:$cid ({$customer['first_name']} {$customer['last_name']}) | Grade: $oldGrade -> $newGrade | CalcTotal: $gradeTotal\n";
                $changedCount++;
            }
        } else {
            // โหมดปกติ อัปเดตจริง
            recalculate_customer_stats_safe($pdo, $cid);
            
            // เช็คว่าต้องนับ Progress ไหม
            if (($index + 1) % 100 === 0) {
                echo "Processed " . ($index + 1) . " / $total customers...\n";
            }
            $updatedCount++;
        }
    }

    echo "====================================\n";
    if ($isDryRun) {
        echo "Dry Run Complete!\n";
        echo "Found $changedCount customers whose grades would change.\n";
    } else {
        echo "Recalculation Complete!\n";
        echo "Successfully updated $updatedCount customers.\n";
    }

} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    file_put_contents(__DIR__ . '/../../logs/cron_error.log', date('Y-m-d H:i:s') . ' [recalc_grades] ' . $e->getMessage() . "\n", FILE_APPEND);
}
