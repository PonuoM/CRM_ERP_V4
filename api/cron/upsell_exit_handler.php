<?php
/**
 * Cron Job: Upsell Exit Logic
 * 
 * เงื่อนไขการทำงาน:
 * 1. Order ถูกสร้างภายใน 1-7 วันที่ผ่านมา
 * 2. Order เปลี่ยนจาก Pending → Picking (หรือสถานะอื่นที่ไม่ใช่ Pending/Cancelled)
 * 3. Order สร้างโดย Role ที่ไม่ใช่ 6 และ 7 (Telesale)
 * 4. ลูกค้าไม่มีเจ้าของ (assigned_to IS NULL)
 * 
 * ผลลัพธ์: ย้ายลูกค้าไปถัง 52 (ลูกค้าใหม่ Distribution)
 * 
 * วิธีใช้:
 * - Dry Run: php upsell_exit_handler.php --dry-run
 * - Run จริง: php upsell_exit_handler.php
 * 
 * Cron (ทุก 5 นาที):
 * /5 * * * * /usr/local/bin/php /home/primacom/domains/prima49.com/public_html/mini_erp/api/cron/upsell_exit_handler.php
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/cron_logger.php';

$logger = new CronLogger('upsell_exit_handler');
$logger->logStart();

$dryRun = in_array('--dry-run', $argv ?? []) || isset($_GET['dry_run']);

$pdo = db_connect();
// Process all companies - no company filter

$results = [
    'mode' => $dryRun ? '🔍 DRY-RUN (ไม่อัพเดทจริง)' : '✅ EXECUTE',
    'customers_to_move' => [],
    'moved_count' => 0
];

try {
    // ===========================================
    // Query ที่ถูกต้อง:
    // - Order สร้างภายใน 7 วันที่ผ่านมา
    // - Order สถานะ = Picking (เพิ่งเปลี่ยนจาก Pending)
    // - Order สร้างโดย Role ไม่ใช่ 6, 7
    // - ลูกค้าไม่มีเจ้าของ
    // - ยังไม่ได้อยู่ในถัง 52
    // ===========================================
    
    $exitSql = "
        SELECT DISTINCT 
            c.customer_id, 
            c.first_name,
            c.last_name,
            c.phone,
            c.current_basket_key,
            o.order_status, 
            o.id as order_id,
            o.order_date,
            u.role_id as creator_role,
            DATEDIFF(NOW(), o.order_date) as days_ago
        FROM customers c
        INNER JOIN orders o ON (o.customer_id = c.customer_id OR o.customer_id = c.customer_ref_id)
        INNER JOIN users u ON o.creator_id = u.id
        WHERE 1=1
          -- ลูกค้าไม่มีเจ้าของ
          AND (c.assigned_to IS NULL OR c.assigned_to = 0)
          -- Order สร้างภายใน 7 วันที่ผ่านมา
          AND o.order_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          -- Order Creator ไม่ใช่ Telesale (role 6, 7)
          AND u.role_id NOT IN (6, 7)
          -- Order สถานะ = Picking (เพิ่งเปลี่ยนจาก Pending)
          AND o.order_status = 'Picking'
          -- ยังไม่ได้อยู่ในถัง 52 แล้ว
          -- เป้าหมาย: ลูกค้าที่อยู่ในถัง 53 (Upsell Virtual) จะย้ายไป 52 (ลูกค้าใหม่)
          -- หรือลูกค้าที่ไม่มี basket (จาก Order ที่ลูกค้าใหม่ถูกสร้างโดย Admin)
          AND (c.current_basket_key = 53 OR c.current_basket_key IS NULL OR c.current_basket_key = 0)
        ORDER BY o.order_date DESC
    ";
    
    $stmt = $pdo->query($exitSql);
    $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Preview data
    foreach ($customers as $customer) {
        $results['customers_to_move'][] = [
            'customer_id' => $customer['customer_id'],
            'name' => trim($customer['first_name'] . ' ' . $customer['last_name']),
            'phone' => $customer['phone'],
            'current_basket' => $customer['current_basket_key'],
            'order_id' => $customer['order_id'],
            'order_status' => $customer['order_status'],
            'order_date' => $customer['order_date'],
            'days_ago' => $customer['days_ago'],
            'creator_role' => $customer['creator_role'],
            'action' => 'ย้ายไปถัง 52 (ลูกค้าใหม่)'
        ];
    }
    
    // Execute if NOT dry-run
    if (!$dryRun && count($customers) > 0) {
        $pdo->beginTransaction();
        
        foreach ($customers as $customer) {
            $customerId = $customer['customer_id'];
            $orderId = $customer['order_id'];
            $orderStatus = $customer['order_status'];
            $oldBasket = $customer['current_basket_key'];
            
            $updateStmt = $pdo->prepare("
                UPDATE customers SET 
                    current_basket_key = 52,
                    basket_entered_date = NOW()
                WHERE customer_id = ?
                  AND (assigned_to IS NULL OR assigned_to = 0)
            ");
            $updateStmt->execute([$customerId]);
            
            if ($updateStmt->rowCount() > 0) {
                $logStmt = $pdo->prepare("
                    INSERT INTO basket_transition_log 
                    (customer_id, from_basket_key, to_basket_key, transition_type, notes, created_at)
                    VALUES (?, ?, 52, 'upsell_exit', ?, NOW())
                ");
                $logStmt->execute([
                    $customerId, 
                    $oldBasket, 
                    "Order #$orderId Picking (from Upsell Virtual) - moved to New Customer via cron"
                ]);
                
                $results['moved_count']++;
            }
        }
        
        $pdo->commit();
    }

    // Output
    $output = [
        'success' => true,
        'mode' => $results['mode'],
        'total_found' => count($results['customers_to_move']),
        'moved_count' => $dryRun ? 0 : $results['moved_count'],
        'criteria' => [
            'order_created_within' => '7 days',
            'order_status' => 'Picking',
            'creator_role' => 'NOT IN (6, 7)',
            'customer_assigned_to' => 'NULL',
            'destination_basket' => 52
        ],
        'customers' => $results['customers_to_move'],
        'timestamp' => date('Y-m-d H:i:s')
    ];
    
    if ($dryRun) {
        $output['message'] = "🔍 DRY-RUN: พบ " . count($results['customers_to_move']) . " คนที่ตรงเงื่อนไข";
        $output['hint'] = "รันโดยไม่มี --dry-run เพื่ออัพเดทจริง";
        $logger->log("DRY RUN: Found " . count($results['customers_to_move']) . " customers");
        $logger->logEnd(count($results['customers_to_move']) > 0); // Only log if found customers
    } else {
        $output['message'] = "✅ ย้าย " . $results['moved_count'] . " คนไปถัง 52 เรียบร้อย";
        $logger->log("EXECUTED: Moved " . $results['moved_count'] . " customers to basket 52");
        $logger->logEnd($results['moved_count'] > 0); // Only log if moved customers
    }
    
    echo json_encode($output, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    $logger->logError($e->getMessage());
    $logger->logEnd();
    if (!$dryRun && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'timestamp' => date('Y-m-d H:i:s')
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit(1);
}
