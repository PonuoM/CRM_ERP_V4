<?php
/**
 * Batch Merge Duplicate Customers
 * Uses mysqli + remote host to bypass local SQLSTATE 2054 issue
 * Processes 50 groups per batch with transaction isolation per group
 */
set_time_limit(300); // 5 minutes max

// Direct connection to remote server
$conn = new mysqli('202.183.192.218', 'primacom_bloguser', 'pJnL53Wkhju2LaGPytw8', 'primacom_mini_erp');
if ($conn->connect_error) {
    die("Database Connection Error: " . $conn->connect_error);
}
$conn->set_charset("utf8mb4");

$csvFile = __DIR__ . '/../../duplicate_customers_REMAINING_833.csv';
$progressFile = __DIR__ . '/merge_progress.json';
$batchSize = 50;

if (!file_exists($csvFile)) {
    die("CSV file not found.");
}

// 1. Load progress
$lastProcessedGroup = 0;
if (file_exists($progressFile)) {
    $progressData = json_decode(file_get_contents($progressFile), true);
    if (isset($progressData['last_processed_group'])) {
        $lastProcessedGroup = (int)$progressData['last_processed_group'];
    }
}

// 2. Read CSV and group by "Group ID"
$groups = [];
if (($handle = fopen($csvFile, "r")) !== FALSE) {
    $header = fgetcsv($handle); // skip header
    while (($data = fgetcsv($handle)) !== FALSE) {
        $groupId = (int)$data[0];
        $customerId = (int)$data[9]; // Column index 9 is "รหัส Customer ID"
        
        if ($groupId > $lastProcessedGroup) {
            if (!isset($groups[$groupId])) {
                $groups[$groupId] = [];
            }
            $groups[$groupId][] = $customerId;
        }
    }
    fclose($handle);
}

ksort($groups);

$totalGroupsRemaining = count($groups);

if (empty($groups)) {
    echo "<h1>✅ All groups have been processed!</h1>";
    echo "<p>Last processed group: {$lastProcessedGroup}</p>";
    exit;
}

// 3. Take the next 50 groups
$groupsToProcess = array_slice($groups, 0, $batchSize, true);
$firstGroup = array_key_first($groupsToProcess);
$lastGroup = array_key_last($groupsToProcess);

echo "<html><head><title>Batch Merge</title><style>
body { font-family: 'Segoe UI', sans-serif; margin: 30px; background: #1a1a2e; color: #eee; }
h1 { color: #e94560; } h3 { color: #0fbcf9; }
.ok { color: #0f0; } .fail { color: #f00; } .skip { color: #f9ca24; }
.summary { margin-top:20px; padding:20px; background:#16213e; border-radius:10px; border:1px solid #e94560; }
</style></head><body>";

echo "<h1>🔄 Batch Merge Tool</h1>";
echo "<p>Progress: Group {$firstGroup} → {$lastGroup} | Remaining: {$totalGroupsRemaining} groups</p>";

// If the user hasn't triggered "Run", show preview
if (!isset($_POST['run_batch']) && !isset($_GET['run'])) {
    echo "<h3>Next " . count($groupsToProcess) . " groups to process:</h3>";
    echo "<pre>" . print_r($groupsToProcess, true) . "</pre>";
    echo "<form method='POST'><button type='submit' name='run_batch' value='1' style='padding:15px 40px; background:#e94560; color:white; font-size:18px; border:none; border-radius:8px; cursor:pointer; font-weight:bold;'>🚀 RUN BATCH NOW</button></form>";
    exit;
}

echo "<hr><h3>Execution Log:</h3><ul>";

// 4. Process each group
$successCount = 0;
$failCount = 0;
$skipCount = 0;

foreach ($groupsToProcess as $groupId => $customerIds) {
    if (count($customerIds) < 2) {
        echo "<li class='skip'>Group {$groupId}: Skipped (less than 2 customers)</li>";
        $skipCount++;
        file_put_contents($progressFile, json_encode(['last_processed_group' => $groupId]));
        continue;
    }

    $idList = implode(',', array_map('intval', $customerIds));
    
    // Query database for full customer records
    $result = $conn->query("
        SELECT customer_id, phone, backup_phone, assigned_to, 
               total_purchases, total_calls, order_count, has_sold_before, last_sale_date 
        FROM customers 
        WHERE customer_id IN ($idList)
    ");
    
    $customers = [];
    while ($row = $result->fetch_assoc()) {
        $customers[] = $row;
    }

    if (count($customers) < 2) {
        echo "<li class='skip'>Group {$groupId}: Skipped (Not enough customers found in DB - might be deleted or merged already)</li>";
        $skipCount++;
        file_put_contents($progressFile, json_encode(['last_processed_group' => $groupId]));
        continue;
    }

    // Determine Primary
    $primary = null;
    $secondaries = [];
    $sellers = [];
    $nonSellers = [];

    foreach ($customers as $c) {
        if ($c['has_sold_before'] == 1 && !empty($c['last_sale_date'])) {
            $sellers[] = $c;
        } else {
            $nonSellers[] = $c;
        }
    }

    if (count($sellers) == 0) {
        usort($nonSellers, function($a, $b) { return $a['customer_id'] <=> $b['customer_id']; });
        $primary = $nonSellers[0];
        $secondaries = array_slice($nonSellers, 1);
    } else if (count($sellers) == 1) {
        $primary = $sellers[0];
        $secondaries = $nonSellers;
    } else {
        usort($sellers, function($a, $b) {
            $dateA = strtotime($a['last_sale_date']);
            $dateB = strtotime($b['last_sale_date']);
            if ($dateA == $dateB) {
                return $a['customer_id'] <=> $b['customer_id'];
            }
            return $dateA <=> $dateB;
        });
        $primary = $sellers[0];
        $secondaries = array_merge(array_slice($sellers, 1), $nonSellers);
    }

    $sumPurchases = (float)$primary['total_purchases'];
    $sumCalls = (int)$primary['total_calls'];
    $sumOrders = (int)$primary['order_count'];
    $allSecondaryPhones = [];

    // BEGIN TRANSACTION
    $conn->begin_transaction();
    $mergeOk = true;
    $errorMsg = '';

    foreach ($secondaries as $sec) {
        $allSecondaryPhones[] = $sec['phone'];
        if (!empty($sec['backup_phone'])) {
            $sp = array_map('trim', explode(',', $sec['backup_phone']));
            $allSecondaryPhones = array_merge($allSecondaryPhones, $sp);
        }
        $sumPurchases += (float)$sec['total_purchases'];
        $sumCalls += (int)$sec['total_calls'];
        $sumOrders += (int)$sec['order_count'];

        $pId = (int)$primary['customer_id'];
        $sId = (int)$sec['customer_id'];

        // Update related tables
        $queries = [
            "UPDATE orders SET customer_id = $pId WHERE customer_id = $sId",
            "UPDATE call_history SET customer_id = $pId WHERE customer_id = $sId",
            "UPDATE appointments SET customer_id = $pId WHERE customer_id = $sId",
            "UPDATE activities SET customer_id = $pId WHERE customer_id = $sId",
            "UPDATE customer_address SET customer_id = $pId WHERE customer_id = $sId",
            "UPDATE customer_assignment_history SET customer_id = $pId WHERE customer_id = $sId",
            "UPDATE customer_audit_log SET customer_id = $pId WHERE customer_id = $sId",
            "UPDATE customer_logs SET customer_id = $pId WHERE customer_id = $sId",
            "UPDATE customer_blocks SET customer_id = $pId WHERE customer_id = $sId",
            "UPDATE basket_transition_log SET customer_id = $pId WHERE customer_id = $sId",
            "UPDATE basket_return_log SET customer_id = $pId WHERE customer_id = $sId",
            "UPDATE IGNORE customer_tags SET customer_id = $pId WHERE customer_id = $sId",
            "DELETE FROM customer_tags WHERE customer_id = $sId",
            "DELETE FROM customers WHERE customer_id = $sId",
        ];

        foreach ($queries as $sql) {
            if (!$conn->query($sql)) {
                $mergeOk = false;
                $errorMsg = $conn->error . " [SQL: $sql]";
                break 2; // break out of both loops
            }
        }
    }

    if ($mergeOk) {
        // Combine phones
        $existingBackup = $primary['backup_phone'] ? array_map('trim', explode(',', $primary['backup_phone'])) : [];
        $finalBackupPhones = array_unique(array_filter(array_merge($existingBackup, $allSecondaryPhones)));
        $newBackupPhoneString = $conn->real_escape_string(implode(',', $finalBackupPhones));

        // Update primary customer
        $updateSql = "UPDATE customers SET backup_phone = '$newBackupPhoneString', total_purchases = $sumPurchases, total_calls = $sumCalls, order_count = $sumOrders WHERE customer_id = " . (int)$primary['customer_id'];
        
        if (!$conn->query($updateSql)) {
            $mergeOk = false;
            $errorMsg = $conn->error;
        }
    }

    if ($mergeOk) {
        $conn->commit();
        echo "<li class='ok'>✅ Group {$groupId} Merged (Primary: {$primary['customer_id']}, Merged " . count($secondaries) . " secondary)</li>";
        $successCount++;
    } else {
        $conn->rollback();
        echo "<li class='fail'>❌ Group {$groupId} FAILED: " . htmlspecialchars($errorMsg) . "</li>";
        $failCount++;
    }

    // Micro-delay to prevent DB lock/CPU spike
    usleep(50000); // 0.05 seconds
    
    // Update progress after each group
    file_put_contents($progressFile, json_encode(['last_processed_group' => $groupId]));
    
    // Flush output
    if (ob_get_level()) ob_flush();
    flush();
}

echo "</ul>";

echo "<div class='summary'>";
echo "<h3>📊 Batch Complete!</h3>";
echo "<p>✅ Success: <strong>{$successCount}</strong> | ❌ Failed: <strong>{$failCount}</strong> | ⏭️ Skipped: <strong>{$skipCount}</strong></p>";
echo "<p>Last processed group: <strong>" . $groupId . "</strong></p>";

$remainingAfter = $totalGroupsRemaining - count($groupsToProcess);
if ($remainingAfter > 0) {
    echo "<p>📋 Remaining groups: <strong>{$remainingAfter}</strong></p>";
    echo "<a href='?run=1' style='display:inline-block; margin-top:15px; padding:15px 40px; background:#0fbcf9; color:#1a1a2e; font-size:18px; border:none; border-radius:8px; cursor:pointer; font-weight:bold; text-decoration:none;'>▶️ Process Next Batch</a>";
} else {
    echo "<p style='color:#0f0; font-size:20px;'>🎉 All groups have been processed!</p>";
}
echo "</div>";

echo "</body></html>";

$conn->close();
?>
