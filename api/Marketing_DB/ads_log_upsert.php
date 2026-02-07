<?php
require_once __DIR__ . '/../config.php';

cors();

$json = file_get_contents('php://input');
$data = json_decode($json, true);

if (!$data) {
    json_response(['success' => false, 'error' => 'Invalid JSON data'], 400);
    exit;
}

// Support both single record and batch (array of records)
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
        // Validate required fields
        if (empty($record['page_id']) || empty($record['user_id']) || empty($record['date'])) {
            $errors[] = "Record #{$i}: Missing required fields (page_id, user_id, date)";
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

        // Skip entirely empty records
        if ($adsCost === null && $impressions === null && $reach === null && $clicks === null) {
            $skipped++;
            continue;
        }

        // UPSERT: INSERT ... ON DUPLICATE KEY UPDATE
        // Unique key: (page_id, date) — only 1 record per page per day
        // On INSERT: user_id = the person creating the record (original recorder)
        // On UPDATE: user_id stays the same, edited_by tracks who made the edit
        $stmt = $pdo->prepare("
            INSERT INTO marketing_ads_log (page_id, user_id, date, ads_cost, impressions, reach, clicks)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                ads_cost = VALUES(ads_cost),
                impressions = VALUES(impressions),
                reach = VALUES(reach),
                clicks = VALUES(clicks),
                edited_by = ?,
                edited_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
        ");

        $userId = intval($record['user_id']);

        $stmt->execute([
            intval($record['page_id']),
            $userId,
            $record['date'],
            $adsCost,
            $impressions,
            $reach,
            $clicks,
            $userId, // edited_by (only used on UPDATE, not INSERT)
        ]);

        // rowCount: 1 = inserted, 2 = updated (MySQL behavior for ON DUPLICATE KEY UPDATE)
        $rowCount = $stmt->rowCount();
        if ($rowCount === 1) {
            $inserted++;
        } elseif ($rowCount === 2) {
            $updated++;
        } else {
            // 0 = no change (same values)
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
    error_log("Error in ads_log_upsert.php: " . $e->getMessage());
    json_response([
        'success' => false,
        'error' => $e->getMessage(),
        'message' => 'Failed to upsert ads log'
    ], 500);
}
