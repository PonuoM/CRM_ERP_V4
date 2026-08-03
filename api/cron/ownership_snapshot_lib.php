<?php
/**
 * Shared helpers for the ownership-snapshot cron and its backfill.
 *
 * @see snapshot_customer_ownership.php   (daily)
 * @see backfill_ownership_snapshots.php  (historical reverse-replay)
 */

/**
 * Returns a callable that normalises a raw basket key to the numeric basket_config.id.
 *
 * Both `customers.current_basket_key` and `basket_transition_log.from_basket_key` mix
 * the numeric id ('39') with the slug ('personal_1_2m'), and the log additionally carries
 * bulk-operation placeholders ('Multiple Baskets'). A snapshot must store one form, or the
 * same basket shows up as two segments in the report.
 *
 * @param bool $keepUnknown true  → an unrecognised value is kept verbatim (live data: better
 *                                 to surface an odd value than to silently lose the customer)
 *                          false → an unrecognised value becomes '' (replayed data: placeholders
 *                                 like 'Multiple Baskets' are not baskets at all)
 */
function ownership_basket_normaliser(PDO $pdo, bool $keepUnknown): callable
{
    $slugToId = [];
    foreach ($pdo->query("SELECT id, basket_key FROM basket_config")->fetchAll(PDO::FETCH_ASSOC) as $b) {
        if ($b['basket_key'] !== null && $b['basket_key'] !== '') {
            $slugToId[$b['basket_key']] = (string) (int) $b['id'];
        }
    }
    return function ($raw) use ($slugToId, $keepUnknown) {
        $v = trim((string) $raw);
        if ($v === '') return '';
        if (ctype_digit($v)) return $v;
        if (isset($slugToId[$v])) return $slugToId[$v];
        return $keepUnknown ? $v : '';
    };
}

/**
 * Bulk-insert per-customer month-end rows.
 *
 * Hundreds of thousands of rows go in per month-end, so they are batched into multi-row
 * INSERTs — one round trip per row over a remote connection would take hours.
 * Caller is responsible for clearing the date first.
 *
 * @param array $rows list of [customer_id, company_id, agent_id|null, basket_key]
 * @return int number of rows written
 */
function writeCustomerBasketSnapshots(PDO $pdo, string $snapshotDate, array $rows, int $batchSize = 500): int
{
    if (empty($rows)) return 0;

    $written = 0;
    foreach (array_chunk($rows, $batchSize) as $chunk) {
        $placeholders = implode(',', array_fill(0, count($chunk), '(?,?,?,?,?)'));
        $params = [];
        foreach ($chunk as $r) {
            $params[] = $snapshotDate;
            $params[] = $r[0];              // customer_id
            $params[] = $r[1];              // company_id
            $params[] = $r[2];              // agent_id (nullable)
            $params[] = $r[3];              // basket_key
        }
        $stmt = $pdo->prepare(
            "INSERT INTO customer_basket_snapshots (snapshot_date, customer_id, company_id, agent_id, basket_key)
             VALUES {$placeholders}
             ON DUPLICATE KEY UPDATE company_id = VALUES(company_id),
                                     agent_id = VALUES(agent_id),
                                     basket_key = VALUES(basket_key)"
        );
        $stmt->execute($params);
        $written += count($chunk);
    }
    return $written;
}
