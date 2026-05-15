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

        // 2. Calculate grade based on total purchases
        $newGrade = calculate_customer_grade($actualTotal);

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

        // 4. Derived values
        $actualTotal      = floatval($orderStats['actual_total'] ?? 0);
        $orderCount       = (int) ($orderStats['actual_order_count'] ?? 0);
        $newGrade         = calculate_customer_grade($actualTotal);
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
 * Calculate customer grade from total purchase amount.
 *
 * Grade thresholds:
 *   A  >= 50,000
 *   B  >= 10,000
 *   C  >=  5,000
 *   D  <   5,000
 */
function calculate_customer_grade(float $totalPurchases): string
{
    if ($totalPurchases >= 50000) return 'A';
    if ($totalPurchases >= 10000) return 'B';
    if ($totalPurchases >= 5000)  return 'C';
    return 'D';
}
