<?php
/**
 * Quota Usage Auto-Recorder
 * 
 * Standalone helper that can be required from index.php and quota.php.
 * Scans order_items for quota products and records quota_usage rows.
 * Uses INSERT IGNORE to skip duplicates (UNIQUE on order_id + quota_product_id).
 * 
 * Safe to call multiple times for the same order — idempotent.
 * Deletes existing usage first, then re-inserts (handles item edits).
 */

/**
 * @param PDO    $pdo       Database connection
 * @param string $orderId   The parent order ID (e.g. "ORD-20260319-001")
 * @param int    $companyId Company ID for quota product lookup
 * @param int    $userId    Fallback user ID for quota_usage.user_id
 * @return int   Number of quota_usage rows recorded
 */
function recordQuotaUsageForOrder(PDO $pdo, string $orderId, int $companyId, int $userId): int
{
    if (!$orderId || !$companyId || !$userId) {
        return 0;
    }

    try {
        // 1. Get all active quota products for this company
        $stmtQP = $pdo->prepare("
            SELECT qp.id AS quota_product_id, qp.product_id, qp.quota_cost
            FROM quota_products qp
            WHERE qp.company_id = :companyId AND qp.is_active = 1 AND qp.deleted_at IS NULL
        ");
        $stmtQP->execute([':companyId' => $companyId]);
        $quotaProducts = $stmtQP->fetchAll(PDO::FETCH_ASSOC);

        if (empty($quotaProducts)) {
            return 0;
        }

        // Build lookup: product_id → { quota_product_id, quota_cost }
        $qpLookup = [];
        foreach ($quotaProducts as $qp) {
            $qpLookup[intval($qp['product_id'])] = [
                'quota_product_id' => intval($qp['quota_product_id']),
                'quota_cost' => intval($qp['quota_cost'] ?? 1),
            ];
        }

        // 2. Get order items for this order
        $stmtItems = $pdo->prepare("
            SELECT oi.product_id, oi.quantity, oi.creator_id
            FROM order_items oi
            WHERE oi.parent_order_id = :orderId
        ");
        $stmtItems->execute([':orderId' => $orderId]);
        $items = $stmtItems->fetchAll(PDO::FETCH_ASSOC);

        // 3. Delete existing usage for this order (handles edits/re-creates)
        $pdo->prepare("DELETE FROM quota_usage WHERE order_id = :orderId")
            ->execute([':orderId' => $orderId]);

        // 4. Match items to quota products and record usage
        $recorded = 0;
        $stmtInsert = $pdo->prepare("
            INSERT IGNORE INTO quota_usage
                (quota_product_id, user_id, company_id, order_id, quantity_used)
            VALUES
                (:qpId, :userId, :companyId, :orderId, :qty)
        ");

        foreach ($items as $item) {
            $productId = intval($item['product_id']);
            if (!isset($qpLookup[$productId])) {
                continue;
            }

            $qpInfo = $qpLookup[$productId];
            $itemQty = intval($item['quantity'] ?? 1);
            $usageQty = $itemQty * $qpInfo['quota_cost'];

            // Use order item's creator_id if available, fallback to provided userId
            $effectiveUserId = intval($item['creator_id'] ?? 0) ?: $userId;

            $stmtInsert->execute([
                ':qpId' => $qpInfo['quota_product_id'],
                ':userId' => $effectiveUserId,
                ':companyId' => $companyId,
                ':orderId' => $orderId,
                ':qty' => $usageQty,
            ]);
            if ($stmtInsert->rowCount() > 0) {
                $recorded++;
            }
        }

        return $recorded;
    } catch (Throwable $e) {
        error_log("[recordQuotaUsageForOrder] Error for order=$orderId: " . $e->getMessage());
        return 0;
    }
}
