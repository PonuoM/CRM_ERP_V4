<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);
set_time_limit(0); // Allow long execution

require_once __DIR__ . '/../config.php';

header('Content-Type: text/plain; charset=utf-8');

try {
    $pdo = db_connect();
    echo "Connected to database.\n";

    // Get a company ID (default to 1 if none found)
    $stmt = $pdo->query("SELECT id FROM companies LIMIT 1");
    $companyId = $stmt->fetchColumn() ?: 1;
    echo "Using Company ID: $companyId\n";

    $totalRecords = 300000;
    $batchSize = 1000;
    
    $fnames = ['Somchai', 'Somsak', 'Manee', 'Mana', 'Piti', 'Chujai', 'Suda', 'Wichai', 'Malee', 'Pranee'];
    $lnames = ['Dee', 'Rak', 'Jai', 'Munkong', 'Suksabai', 'Charoen', 'Mungme', 'Srisuk', 'Ngam', 'Pattana'];
    $provinces = ['Bangkok', 'Chiang Mai', 'Phuket', 'Khon Kaen', 'Chonburi', 'Songkhla', 'Nakhon Ratchasima'];
    
    echo "Starting generation of $totalRecords customers...\n";
    
    $pdo->beginTransaction();
    
    $startTime = microtime(true);
    
    for ($i = 0; $i < $totalRecords; $i += $batchSize) {
        $values = [];
        $params = [];
        
        $currentBatchSize = min($batchSize, $totalRecords - $i);
        
        for ($j = 0; $j < $currentBatchSize; $j++) {
            // customer_ref_id: "CUS-" + timestamp + global_index
            // Ensure uniqueness across batches by using ($i + $j)
            $refId = 'CUS-SEED-' . time() . '-' . ($i + $j);
            $fname = $fnames[array_rand($fnames)] . rand(100, 999);
            $lname = $lnames[array_rand($lnames)] . rand(100, 999);
            $phone = '08' . rand(10000000, 99999999);
            $province = $provinces[array_rand($provinces)];
            
            // Generate placeholder for prepared statement
            // Maps to: customer_ref_id, first_name, last_name, phone, province, company_id, lifecycle_status, date_assigned
            $values[] = "(?, ?, ?, ?, ?, ?, ?, NOW())";
            
            // Add values to params array
            $params[] = $refId;
            $params[] = $fname;
            $params[] = $lname;
            $params[] = $phone;
            $params[] = $province;
            $params[] = $companyId;
            $params[] = 'New'; // lifecycle_status
        }
        
        $sql = "INSERT INTO customers (customer_ref_id, first_name, last_name, phone, province, company_id, lifecycle_status, date_assigned) VALUES " . implode(',', $values);
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        
        if (($i + $currentBatchSize) % 10000 == 0) {
           echo "Inserted " . ($i + $currentBatchSize) . " records...\n";
           flush(); // Attempt to push output to browser
        }
        
        // --- Order Generation Logic ---
        // 1. Fetch backend IDs (customer_id) for the batch we just inserted
        // We can use the customer_ref_id range to find them efficiently
        // The refIds are 'CUS-SEED-' . time() . '-' . ($i) to ($i + currentBatchSize - 1)
        // Note: 'time()' might have changed if execution is slow, so we rely on the logic that strict uniqueness was handled by loop index
        // Ideally, we'd capture the inserted IDs via returning, but MySQL specific features vary.
        // Safer: SELECT customer_id FROM customers WHERE customer_ref_id IN (...) 
        
        $placeholders = implode(',', array_fill(0, count($params) / 7, '?')); // params has 7 fields per customer
        // Re-extract refIds from the params array
        $refIds = [];
        for ($k = 0; $k < count($params); $k += 7) {
            $refIds[] = $params[$k];
        }
        
        $inQuery = implode(',', array_fill(0, count($refIds), '?'));
        $stmtIds = $pdo->prepare("SELECT customer_id FROM customers WHERE customer_ref_id IN ($inQuery)");
        $stmtIds->execute($refIds);
        $customerIds = $stmtIds->fetchAll(PDO::FETCH_COLUMN);
        
        $orderValues = [];
        $orderParams = [];
        
        $paymentMethods = ['COD', 'Transfer'];
        $orderStatuses = ['Pending', 'Confirmed', 'Processing', 'Delivered', 'Cancelled'];
        
        foreach ($customerIds as $cid) {
            // 70% chance to have orders
            if (rand(1, 100) > 30) {
                $numOrders = rand(1, 5); // 1-5 orders per customer
                for ($o = 0; $o < $numOrders; $o++) {
                    // Generate Order ID: O-Timestamp-Random
                    $orderId = 'ORD-' . time() . '-' . $cid . '-' . $o . '-' . rand(100,999);
                    $total = rand(500, 5000);
                    $status = $orderStatuses[array_rand($orderStatuses)];
                    $pm = $paymentMethods[array_rand($paymentMethods)];
                    $date = date('Y-m-d H:i:s', strtotime('-' . rand(0, 365) . ' days'));
                    
                    // Fields: id, customer_id, company_id, order_date, total_amount, order_status, payment_method, payment_status, shipping_cost, delivery_date
                    $orderValues[] = "(?, ?, ?, ?, ?, ?, ?, ?, 0, ?)";
                    $orderParams[] = $orderId;
                    $orderParams[] = $cid;
                    $orderParams[] = $companyId;
                    $orderParams[] = $date;
                    $orderParams[] = $total;
                    $orderParams[] = $status;
                    $orderParams[] = $pm;
                    $orderParams[] = ($status === 'Delivered') ? 'Paid' : 'Unpaid';
                    $orderParams[] = date('Y-m-d H:i:s', strtotime($date . ' + 3 days'));
                }
            }
        }
        
        if (!empty($orderValues)) {
            $sqlOrder = "INSERT INTO orders (id, customer_id, company_id, order_date, total_amount, order_status, payment_method, payment_status, shipping_cost, delivery_date) VALUES " . implode(',', $orderValues);
            $stmtOrder = $pdo->prepare($sqlOrder);
            $stmtOrder->execute($orderParams);
        }
        // ------------------------------

        if (($i + $currentBatchSize) % 10000 == 0) {
            echo "Inserted and processed " . ($i + $currentBatchSize) . " records...\n";
            flush();
        }
    }
    
    $pdo->commit();
    $duration = microtime(true) - $startTime;
    
    echo "Done! Inserted $totalRecords customers and associated orders in " . round($duration, 2) . " seconds.\n";

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo "Error: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString();
}
