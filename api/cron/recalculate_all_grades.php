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

// ป้องกันไม่ให้เรียกผ่าน Web Browser โดยตรง (เว้นแต่จะใส่ Token หรือผ่าน CLI)
if (php_sapi_name() !== 'cli') {
    die("This script can only be run from the command line.");
}

$pdo = db_connect();

echo "Starting Full Grade Recalculation...\n";
echo "====================================\n";

try {
    // 1. ดึง Customer ทั้งหมดในระบบ (หรือจะแบ่ง Batch ก็ได้ ถ้าระบบใหญ่มาก)
    $stmt = $pdo->query("SELECT customer_id, company_id, first_name, last_name, grade FROM customers");
    $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $total = count($customers);
    echo "Found $total customers to process.\n\n";

    $updatedCount = 0;
    
    foreach ($customers as $index => $customer) {
        $cid = (int)$customer['customer_id'];
        $companyId = (int)$customer['company_id'];
        $oldGrade = $customer['grade'];
        
        // ฟังก์ชันนี้จะจัดการคำนวณยอดตาม Time Range และอัปเดต Grade ลง DB ให้เรียบร้อย
        recalculate_customer_stats_safe($pdo, $cid);
        
        // ถ้าต้องการดูว่าเกรดเปลี่ยนไปเป็นอะไร (ตัวแปรอาจจะไม่ถูกส่งกลับมาจากฟังก์ชัน แต่เราตรวจได้)
        // หรือจะพิมพ์ Progress ออกมาเฉยๆ ก็ได้
        if (($index + 1) % 100 === 0) {
            echo "Processed " . ($index + 1) . " / $total customers...\n";
        }
        
        $updatedCount++;
    }

    echo "====================================\n";
    echo "Recalculation Complete!\n";
    echo "Successfully updated $updatedCount customers.\n";

} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    file_put_contents(__DIR__ . '/../../logs/cron_error.log', date('Y-m-d H:i:s') . ' [recalc_grades] ' . $e->getMessage() . "\n", FILE_APPEND);
}
