<?php
/**
 * CustomerStatsHelper — Single Source of Truth for customer statistics.
 *
 * This file is the ONLY place where customer stat recalculation logic lives.
 * Both the event-driven API (index.php) and the batch maintenance script
 * (update_stats_v2.php) share this code so calculations never diverge.
 *
 * @since 2026-05-13
 */

/**
 * Recalculate order-related customer stats from the orders table.
 * Called event-driven whenever an order is created, updated, or cancelled.
 *
 * Updates: total_purchases, order_count, first_order_date, last_order_date,
 *          grade, has_sold_before, is_new_customer, is_repeat_customer.
 *
 * @param PDO $pdo        Database connection
 * @param int $customerId The customer_id (PK) in the customers table
 */

function calculate_grade_purchases_amount(PDO $pdo, int $customerId, int $companyId, float $actualTotal): float
{
    static $settingsCache = [];
    
    if (!isset($settingsCache[$companyId])) {
        try {
            $stmt = $pdo->prepare("SELECT calc_mode, time_range_type, fixed_start_date, fixed_end_date, relative_days FROM customer_grades_settings WHERE company_id = ?");
            $stmt->execute([$companyId]);
            $settingsCache[$companyId] = $stmt->fetch(PDO::FETCH_ASSOC) ?: ['calc_mode' => 'all'];
        } catch (Exception $e) {
            $settingsCache[$companyId] = ['calc_mode' => 'all'];
        }
    }
    
    $settings = $settingsCache[$companyId];
    $mode = $settings['calc_mode'] ?? 'all';
    
    if ($mode === 'all') {
        return $actualTotal;
    }
    
    $timeRangeType = $settings['time_range_type'] ?? 'fixed';
    
    $dateCondition = "";
    $params = [$customerId];
    
    if ($timeRangeType === 'fixed') {
        $startDate = $settings['fixed_start_date'] ?? '1970-01-01';
        $endDate = $settings['fixed_end_date'] ? $settings['fixed_end_date'] . ' 23:59:59' : '2099-12-31 23:59:59';
        $dateCondition = " BETWEEN ? AND ? ";
        $params[] = $startDate;
        $params[] = $endDate;
    } else {
        $days = (int)($settings['relative_days'] ?? 365);
        $dateCondition = " >= DATE_SUB(CURDATE(), INTERVAL ? DAY) ";
        $params[] = $days;
    }
    
    $dateField = ($mode === 'delivery_date') ? 'delivery_date' : 'order_date';
    $statusCondition = ($mode === 'delivery_date') ? "order_status = 'Delivered'" : "order_status != 'Cancelled'";
    
    $sql = "SELECT SUM(total_amount) FROM orders WHERE customer_id = ? AND {$statusCondition} AND {$dateField} {$dateCondition}";
    
    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        return (float)$stmt->fetchColumn();
    } catch (Exception $e) {
        return $actualTotal;
    }
}

function recalculate_customer_stats_safe(PDO $pdo, int $customerId): void
{
    try {

        // 1. Aggregate order stats
        $stmt = $pdo->prepare("
            SELECT
                COUNT(*)          AS actual_order_count,
                SUM(total_amount) AS actual_total,
                MIN(order_date)   AS actual_first_date,
                MAX(order_date)   AS actual_last_date
            FROM orders
            WHERE customer_id = ? AND order_status != 'Cancelled'
        ");
        $stmt->execute([$customerId]);
        $stats = $stmt->fetch(PDO::FETCH_ASSOC);

        $actualTotal = floatval($stats['actual_total'] ?? 0);
        $orderCount  = (int) ($stats['actual_order_count'] ?? 0);

        // 1.5 Get company_id for the customer
        $cStmt = $pdo->prepare("SELECT company_id FROM customers WHERE customer_id = ?");
        $cStmt->execute([$customerId]);
        $companyId = (int)$cStmt->fetchColumn() ?: 1;

        // 2. Calculate grade based on grade purchases (filtered by config)
        $gradeTotal = calculate_grade_purchases_amount($pdo, $customerId, $companyId, $actualTotal);
        $newGrade = calculate_customer_grade($pdo, $gradeTotal, $companyId);

        // 3. Derived boolean flags
        $hasSoldBefore    = $orderCount > 0 ? 1 : 0;
        $isNewCustomer    = $orderCount === 0 ? 1 : 0;
        $isRepeatCustomer = $orderCount > 1 ? 1 : 0;

        // 4. Update — last_order_date is capped at NOW() to prevent future dates
        $update = $pdo->prepare("
            UPDATE customers SET
                total_purchases     = ?,
                order_count         = ?,
                first_order_date    = ?,
                last_order_date     = CASE WHEN ? > NOW() THEN NOW() ELSE ? END,
                grade               = ?,
                has_sold_before     = ?,
                is_new_customer     = ?,
                is_repeat_customer  = ?
            WHERE customer_id = ?
        ");

        $lastDate = $stats['actual_last_date'];
        $update->execute([
            $actualTotal,
            $orderCount,
            $stats['actual_first_date'],
            $lastDate,
            $lastDate,
            $newGrade,
            $hasSoldBefore,
            $isNewCustomer,
            $isRepeatCustomer,
            $customerId,
        ]);

        error_log("Recalculated stats for customer {$customerId}: total={$actualTotal}, grade={$newGrade}, last_order={$lastDate}");
    } catch (Throwable $e) {
        error_log('Failed to recalculate customer stats for ID ' . $customerId . ': ' . $e->getMessage());
    }
}

/**
 * Recalculate FULL customer stats including calls and appointments.
 * Designed for batch maintenance scripts that rebuild everything.
 *
 * Updates everything that recalculate_customer_stats_safe() does, PLUS:
 *         total_calls, follow_up_count, last_follow_up_date.
 *
 * @param PDO $pdo        Database connection
 * @param int $customerId The customer_id (PK) in the customers table
 */
function recalculate_customer_full_stats(PDO $pdo, int $customerId): void
{
    try {
        // 1. Aggregate order stats
        $stmt = $pdo->prepare("
            SELECT
                COUNT(*)          AS actual_order_count,
                SUM(total_amount) AS actual_total,
                MIN(order_date)   AS actual_first_date,
                MAX(order_date)   AS actual_last_date
            FROM orders
            WHERE customer_id = ? AND order_status != 'Cancelled'
        ");
        $stmt->execute([$customerId]);
        $orderStats = $stmt->fetch(PDO::FETCH_ASSOC);

        // 2. Call history (REMOVED: User requested to stop updating total_calls)
        // 3. Appointments (REMOVED: User requested to stop updating follow_up_count, last_follow_up_date)

        // 3.5 Get company_id
        $cStmt = $pdo->prepare("SELECT company_id FROM customers WHERE customer_id = ?");
        $cStmt->execute([$customerId]);
        $companyId = (int)$cStmt->fetchColumn() ?: 1;

        // 4. Derived values
        $actualTotal      = floatval($orderStats['actual_total'] ?? 0);
        $orderCount       = (int) ($orderStats['actual_order_count'] ?? 0);
        $gradeTotal       = calculate_grade_purchases_amount($pdo, $customerId, $companyId, $actualTotal);
        $newGrade         = calculate_customer_grade($pdo, $gradeTotal, $companyId);
        $lastDate         = $orderStats['actual_last_date'];

        // 5. Update everything at once
        $update = $pdo->prepare("
            UPDATE customers SET
                total_purchases     = ?,
                order_count         = ?,
                first_order_date    = ?,
                last_order_date     = CASE WHEN ? > NOW() THEN NOW() ELSE ? END,
                grade               = ?
            WHERE customer_id = ?
        ");

        $update->execute([
            $actualTotal,
            $orderCount,
            $orderStats['actual_first_date'],
            $lastDate,
            $lastDate,
            $newGrade,
            $customerId,
        ]);
    } catch (Throwable $e) {
        error_log('Failed to recalculate full stats for ID ' . $customerId . ': ' . $e->getMessage());
        throw $e; // Re-throw so batch caller can count errors
    }
}

/**
 * Calculate customer grade from total purchase amount dynamically from DB config.
 */
function calculate_customer_grade(PDO $pdo, float $totalPurchases, int $companyId = 1): string
{
    static $configs = [];

    if (!isset($configs[$companyId])) {
        try {
            $stmt = $pdo->prepare("SELECT grade_name, min_order_amount FROM customer_grades_config WHERE company_id = ? ORDER BY min_order_amount DESC");
            $stmt->execute([$companyId]);
            $configs[$companyId] = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            $configs[$companyId] = [];
        }
    }

    $grades = $configs[$companyId];

    // Default fallback if no config exists
    if (empty($grades)) {
        if ($totalPurchases >= 100000) return 'A+';
        if ($totalPurchases >= 80000) return 'A';
        if ($totalPurchases >= 50000) return 'B';
        if ($totalPurchases >= 30000) return 'C';
        return 'D';
    }

    foreach ($grades as $g) {
        if ($totalPurchases >= (float)$g['min_order_amount']) {
            return $g['grade_name'];
        }
    }

    // Fallback if it falls below all minimums (though usually the lowest min is 0)
    $last = end($grades);
    return $last ? $last['grade_name'] : 'D';
}
