<?php
require_once __DIR__ . '/../config.php';

cors();

$json = file_get_contents('php://input');
$data = json_decode($json, true);

if (!$data) {
    json_response(['success' => false, 'error' => 'Invalid JSON data'], 400);
    exit;
}

// Support both single record and batch
$records = isset($data['records']) ? $data['records'] : [$data];

if (empty($records)) {
    json_response(['success' => false, 'error' => 'No records provided'], 400);
    exit;
}

try {
    $pdo = db_connect();

    $inserted = 0;
    $updated = 0;
    $skipped = 0;
    $errors = [];

    foreach ($records as $i => $record) {
        // Require either ads_group or product_id, plus user_id and date
        $hasAdsGroup = !empty($record['ads_group']);
        $hasProductId = !empty($record['product_id']);

        if (!$hasAdsGroup && !$hasProductId) {
            $errors[] = "Record #{$i}: Missing required field (ads_group or product_id)";
            continue;
        }
        if (empty($record['user_id']) || empty($record['date'])) {
            $errors[] = "Record #{$i}: Missing required fields (user_id, date)";
            continue;
        }

        $adsCost = isset($record['ads_cost']) && $record['ads_cost'] !== '' && $record['ads_cost'] !== null
            ? floatval($record['ads_cost']) : null;
        $impressions = isset($record['impressions']) && $record['impressions'] !== '' && $record['impressions'] !== null
            ? intval($record['impressions']) : null;
        $reach = isset($record['reach']) && $record['reach'] !== '' && $record['reach'] !== null
            ? intval($record['reach']) : null;
        $clicks = isset($record['clicks']) && $record['clicks'] !== '' && $record['clicks'] !== null
            ? intval($record['clicks']) : null;

        if ($adsCost === null && $impressions === null && $reach === null && $clicks === null) {
            $skipped++;
            continue;
        }

        if ($hasAdsGroup) {
            // UPSERT by ads_group + date
            $stmt = $pdo->prepare("
                INSERT INTO marketing_product_ads_log (ads_group, product_id, user_id, date, ads_cost, impressions, reach, clicks)
                VALUES (?, NULL, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    user_id = VALUES(user_id),
                    ads_cost = VALUES(ads_cost),
                    impressions = VALUES(impressions),
                    reach = VALUES(reach),
                    clicks = VALUES(clicks),
                    updated_at = CURRENT_TIMESTAMP
            ");

            $stmt->execute([
                $record['ads_group'],
                intval($record['user_id']),
                $record['date'],
                $adsCost,
                $impressions,
                $reach,
                $clicks,
            ]);
        } else {
            // Legacy: UPSERT by product_id + date
            $stmt = $pdo->prepare("
                INSERT INTO marketing_product_ads_log (product_id, user_id, date, ads_cost, impressions, reach, clicks)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    user_id = VALUES(user_id),
                    ads_cost = VALUES(ads_cost),
                    impressions = VALUES(impressions),
                    reach = VALUES(reach),
                    clicks = VALUES(clicks),
                    updated_at = CURRENT_TIMESTAMP
            ");

            $stmt->execute([
                intval($record['product_id']),
                intval($record['user_id']),
                $record['date'],
                $adsCost,
                $impressions,
                $reach,
                $clicks,
            ]);
        }

        $rowCount = $stmt->rowCount();
        if ($rowCount === 1) {
            $inserted++;
        } else {
            $updated++;
        }
    }

    json_response([
        'success' => true,
        'message' => "Upsert completed: {$inserted} inserted, {$updated} updated, {$skipped} skipped",
        'data' => [
            'inserted' => $inserted,
            'updated' => $updated,
            'skipped' => $skipped,
            'errors' => $errors,
        ]
    ]);

} catch (Exception $e) {
    error_log("Error in product_ads_log_upsert.php: " . $e->getMessage());
    json_response([
        'success' => false,
        'error' => $e->getMessage(),
        'message' => 'Failed to upsert product ads log'
    ], 500);
}
