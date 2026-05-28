<?php
require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../Services/CustomerStatsHelper.php';

cors();

$pdo = db_connect();

$companyId = null;

// Allow running from CLI (Cron) without auth
if (php_sapi_name() === 'cli') {
    // If passed via arg: php recalculate_all_grades.php 1
    global $argv;
    if (isset($argv[1])) {
        $companyId = (int)$argv[1];
    } else {
        echo "Error: company_id is required. Usage: php recalculate_all_grades.php <company_id>\n";
        exit(1);
    }
} else {
    // Normal Web API request
    validate_auth($pdo);
    $user = get_authenticated_user($pdo);
    if (!$user) {
        json_response(['error' => 'UNAUTHORIZED', 'message' => 'Not authenticated'], 401);
    }
    $companyId = (int)$user['company_id'];
}

// Increase limits for processing many records
set_time_limit(0);
ini_set('memory_limit', '512M');

try {
    // 1. Load settings to build the bulk SQL condition
    $stmt = $pdo->prepare("SELECT calc_mode, time_range_type, fixed_start_date, fixed_end_date, relative_days FROM customer_grades_settings WHERE company_id = ?");
    $stmt->execute([$companyId]);
    $settings = $stmt->fetch(PDO::FETCH_ASSOC) ?: ['calc_mode' => 'all'];

    $mode = $settings['calc_mode'] ?? 'all';
    $sqlCondition = "";
    $timeParams = [];

    if ($mode !== 'all') {
        $timeRangeType = $settings['time_range_type'] ?? 'fixed';
        if ($timeRangeType === 'fixed') {
            $startDate = $settings['fixed_start_date'] ?? '1970-01-01';
            $endDate = !empty($settings['fixed_end_date']) ? $settings['fixed_end_date'] . ' 23:59:59' : '2099-12-31 23:59:59';
            $dateCondition = " BETWEEN ? AND ? ";
            $timeParams[] = $startDate;
            $timeParams[] = $endDate;
        } else {
            $days = (int)($settings['relative_days'] ?? 365);
            $dateCondition = " >= DATE_SUB(CURDATE(), INTERVAL ? DAY) ";
            $timeParams[] = $days;
        }
        $dateField = ($mode === 'delivery_date') ? 'delivery_date' : 'order_date';
        $statusCondition = ($mode === 'delivery_date') ? "order_status = 'Delivered'" : "order_status != 'Cancelled'";
        $sqlCondition = " AND {$statusCondition} AND {$dateField} {$dateCondition}";
    } else {
        $sqlCondition = " AND order_status != 'Cancelled'";
    }

    // 2. Get all customer IDs for the company
    $stmt = $pdo->prepare("SELECT customer_id FROM customers WHERE company_id = ?");
    $stmt->execute([$companyId]);
    $customers = $stmt->fetchAll(PDO::FETCH_COLUMN);

    $totalProcessed = 0;
    $updatedGrades = 0;
    $chunkSize = 1000;
    $customerChunks = array_chunk($customers, $chunkSize);

    // Warm up the grade cache
    calculate_customer_grade($pdo, 0, $companyId);

    $pdo->beginTransaction();

    foreach ($customerChunks as $chunk) {
        $inPlaceholders = str_repeat('?,', count($chunk) - 1) . '?';
        
        // 3. Bulk fetch totals
        $query = "SELECT customer_id, SUM(total_amount) AS grade_total 
                  FROM orders 
                  WHERE customer_id IN ($inPlaceholders) {$sqlCondition} 
                  GROUP BY customer_id";
                  
        $params = array_merge($chunk, $timeParams);
        $sumStmt = $pdo->prepare($query);
        $sumStmt->execute($params);
        $totalsData = $sumStmt->fetchAll(PDO::FETCH_KEY_PAIR); // Returns [customer_id => grade_total]

        // 4. Determine grades for each customer and build CASE update
        $cases = [];
        $updateParams = [];
        foreach ($chunk as $customerId) {
            $gradeTotal = isset($totalsData[$customerId]) ? (float)$totalsData[$customerId] : 0;
            $newGrade = calculate_customer_grade($pdo, $gradeTotal, $companyId);
            
            $cases[] = "WHEN ? THEN ?";
            $updateParams[] = $customerId;
            $updateParams[] = $newGrade;
            
            $totalProcessed++;
            $updatedGrades++;
        }

        // 5. Bulk update
        if (!empty($cases)) {
            $caseSql = implode(' ', $cases);
            $updateSql = "UPDATE customers SET grade = CASE customer_id {$caseSql} END WHERE customer_id IN ($inPlaceholders)";
            
            // Merge params: [id1, grade1, id2, grade2...] + [id1, id2...]
            $finalParams = array_merge($updateParams, $chunk);
            $updateStmt = $pdo->prepare($updateSql);
            $updateStmt->execute($finalParams);
        }
    }

    $pdo->commit();

    if (php_sapi_name() === 'cli') {
        echo "Success: Processed {$totalProcessed} customers. Updated grades for {$updatedGrades} customers.\n";
    } else {
        json_response([
            'status' => 'success',
            'message' => "อัปเดตเกรดลูกค้าสำเร็จ {$totalProcessed} รายการ",
            'processed' => $totalProcessed
        ]);
    }

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Recalculate All Grades Error: " . $e->getMessage());
    
    if (php_sapi_name() === 'cli') {
        echo "Error: " . $e->getMessage() . "\n";
        exit(1);
    } else {
        json_response(['error' => 'SERVER_ERROR', 'message' => 'เกิดข้อผิดพลาดในการคำนวณเกรด: ' . $e->getMessage()], 500);
    }
}
