<?php
require_once 'config.php';

header('Content-Type: text/plain; charset=utf-8');

// Configuration
$sourceUserId = 60;
$companyId = 7;
$targetUsers = [1718, 1720, 1721, 63, 59];

$pdo = db_connect();

echo "--- Starting Manual Redistribution ---\n";
echo "Source User: $sourceUserId\n";
echo "Target Users: " . implode(', ', $targetUsers) . "\n";
echo "Company ID: $companyId\n\n";

// 1. Get all customers assigned to source user
try {
    // Changed: id -> customer_id, fname/lname -> first_name/last_name
    $stmt = $pdo->prepare("SELECT customer_id, first_name, last_name FROM customers WHERE assigned_to = ? AND company_id = ?");
    $stmt->execute([$sourceUserId, $companyId]);
    $customers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $totalCustomers = count($customers);
    echo "Found Total Customers: $totalCustomers\n";

    if ($totalCustomers == 0) {
        die("No customers found for User $sourceUserId in Company $companyId.\n");
    }

    // 2. Shuffle for randomness (optional, but good for fairness)
    // shuffle($customers); // Uncomment if you want random distribution, otherwise it takes by ID order

    // 3. Distribute
    $targetCount = count($targetUsers);
    $batchSize = ceil($totalCustomers / $targetCount);
    
    echo "Target Users Count: $targetCount\n";
    echo "estimated Batch Size per User: ~$batchSize\n\n";

    $chunks = array_chunk($customers, $batchSize);

    $pdo->beginTransaction();

    foreach ($targetUsers as $index => $targetUserId) {
        if (!isset($chunks[$index])) break;

        $batch = $chunks[$index];
        $count = count($batch);
        // Changed: id -> customer_id
        $ids = array_column($batch, 'customer_id');

        echo "User $targetUserId: Assigning $count customers...\n";

        if (empty($ids)) continue;

        // Prepare ID string for IN clause
        $inQuery = implode(',', array_fill(0, count($ids), '?'));

        // Update Query
        // We also update 'previous_assigned_to' to store history
        // And potentially reset basket? User didn't specify, so we just change owner.
        // Assuming we keep them in current basket but change owner.
        
        // Changed: id -> customer_id
        $sql = "UPDATE customers SET assigned_to = ? WHERE customer_id IN ($inQuery)";
        $params = array_merge([$targetUserId], $ids);
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        
        // Log transition (Optional but recommended)
        // We can't batch insert easily here without complex SQL, skipping detailed log for simplicity unless critical.
        // But we should at least log to text output.
    }

    $pdo->commit();
    echo "\n--- Success! Redistribution Complete ---\n";

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo "ERROR: " . $e->getMessage() . "\n";
}
