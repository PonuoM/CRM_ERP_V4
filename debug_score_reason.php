<?php
// Standalone debugger
header('Content-Type: text/plain');

function getDb() {
    $host = 'localhost';
    $db   = 'mini_erp'; 
    $user = 'root';
    $pass = '12345678'; // Standard AppServ default
    $charset = 'utf8mb4';

    $dsn = "mysql:host=$host;dbname=$db;charset=$charset";
    try {
        return new PDO($dsn, $user, $pass);
    } catch (\PDOException $e) {
        // Try without password
        try {
             return new PDO("mysql:host=$host;dbname=$db;charset=$charset", 'root', '');
        } catch (\PDOException $ex) {
             die("DB Connection failed: " . $ex->getMessage());
        }
    }
}

require_once 'api/Services/ScoringService.php';

try {
    $pdo = getDb();
    echo "Connected to DB\n";
    $scoringService = new ScoringService();
    
    // Valid phone from screenshot
    $phone = '0352145521'; 
    
    $stmt = $pdo->prepare("SELECT * FROM customers WHERE phone = ?");
    $stmt->execute([$phone]);
    $customer = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$customer) {
        echo "Customer not found!\n";
        exit;
    }
    
    echo "Server Time: " . date("Y-m-d H:i:s") . "\n";
    echo "Customer: {$customer['first_name']} {$customer['last_name']} ({$customer['phone']})\n";
    echo "Last Follow Up from DB: " . ($customer['last_follow_up_date'] ?? 'NULL') . "\n";
    
    // Mock appointments 
    $appts = [];
    
    $result = $scoringService->calculateLocalScore($customer, $appts);
    
    echo "Calculated Score: {$result['score']}\n";
    echo "Reasons:\n";
    print_r($result['reasons']);
    
    if (!empty($customer['last_follow_up_date'])) {
        $now = new DateTime();
        $lastCall = new DateTime($customer['last_follow_up_date']);
        $diff = $now->diff($lastCall);
        
        echo "\n--- Debug Info ---\n";
        echo "Now object: " . $now->format('Y-m-d H:i:s') . "\n";
        echo "LastCall object: " . $lastCall->format('Y-m-d H:i:s') . "\n";
        echo "Diff Days: " . $diff->days . "\n";
        echo "Diff Invert: " . $diff->invert . "\n"; 
        
        // Test logic
        if ($diff->days < 1 && $diff->invert === 1) {
            echo "Logic Triggered: Called Today\n";
        } else {
            echo "Logic NOT Triggered\n";
        }
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
