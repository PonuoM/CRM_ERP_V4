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
    }
    
    $pdo->commit();
    $duration = microtime(true) - $startTime;
    
    echo "Done! Inserted $totalRecords customers in " . round($duration, 2) . " seconds.\n";

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo "Error: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString();
}
