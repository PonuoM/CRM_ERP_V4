// Standalone DB connect
function getDbConnection() {
    $host = 'localhost';
    $db   = 'mini_erp'; 
    $user = 'root';
    $pass = '12345678'; 
    $charset = 'utf8mb4';
    try {
        return new PDO("mysql:host=$host;dbname=$db;charset=$charset", $user, $pass);
    } catch (\PDOException $e) {
        return new PDO("mysql:host=$host;dbname=$db;charset=$charset", 'root', '');
    }
}

try {
    $pdo = getDbConnection();
    
    echo "--- Triggers on Appointments ---\n";
    $stmt = $pdo->query("SHOW TRIGGERS LIKE 'appointments'");
    $triggers = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if ($triggers) {
        foreach ($triggers as $t) {
            echo "Trigger: {$t['Trigger']}\nEvent: {$t['Event']}\nStatement: {$t['Statement']}\n\n";
        }
    } else {
        echo "No triggers found on appointments.\n";
    }

    echo "\n--- Triggers on Call History ---\n";
    $stmt = $pdo->query("SHOW TRIGGERS LIKE 'call_history'");
    $triggers = $stmt->fetchAll(PDO::FETCH_ASSOC);
     if ($triggers) {
        foreach ($triggers as $t) {
            echo "Trigger: {$t['Trigger']}\nEvent: {$t['Event']}\nStatement: {$t['Statement']}\n\n";
        }
    } else {
        echo "No triggers found on call_history.\n";
    }
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
