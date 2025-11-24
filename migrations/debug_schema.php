<?php
// Try to manually connect with different credentials if config.php fails or to override it
$credentials = [
    ['host' => 'localhost', 'user' => 'primacom_bloguser', 'pass' => 'pJnL53Wkhju2LaGPytw8', 'db' => 'primacom_test_mini_erp'],
    ['host' => 'localhost', 'user' => 'primacom_bloguser', 'pass' => 'MzBpsVmDmhg8afrxgaUg', 'db' => 'primacom_test_mini_erp'],
    ['host' => 'localhost', 'user' => 'root', 'pass' => '', 'db' => 'primacom_test_mini_erp'],
    ['host' => 'localhost', 'user' => 'root', 'pass' => '12345678', 'db' => 'primacom_test_mini_erp'],
];

$pdo = null;
foreach ($credentials as $cred) {
    try {
        $dsn = "mysql:host={$cred['host']};dbname={$cred['db']};charset=utf8mb4";
        $pdo = new PDO($dsn, $cred['user'], $cred['pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]);
        echo "Connected successfully with user: {$cred['user']}\n\n";
        break;
    } catch (Exception $e) {
        // continue
    }
}

if (!$pdo) {
    die("Could not connect to database with any known credentials.\n");
}

function printTableInfo($pdo, $tableName) {
    echo "--- Table: $tableName ---\n";
    try {
        $stmt = $pdo->query("SHOW CREATE TABLE `$tableName`");
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        echo $row['Create Table'] . "\n\n";
    } catch (Exception $e) {
        echo "Error showing create table: " . $e->getMessage() . "\n";
    }

    echo "--- Columns ---\n";
    try {
        $stmt = $pdo->query("DESCRIBE `$tableName`");
        $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($columns as $col) {
            echo "{$col['Field']} ({$col['Type']})\n";
        }
    } catch (Exception $e) {
        echo "Error describing table: " . $e->getMessage() . "\n";
    }
    echo "\n";
}

function printTriggers($pdo, $tableName) {
    echo "--- Triggers for $tableName ---\n";
    try {
        $stmt = $pdo->query("SHOW TRIGGERS LIKE '$tableName'");
        $triggers = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($triggers as $trig) {
            echo "Trigger: {$trig['Trigger']}\n";
            echo "Event: {$trig['Event']}\n";
            echo "Timing: {$trig['Timing']}\n";
            echo "Statement: {$trig['Statement']}\n\n";
        }
    } catch (Exception $e) {
        echo "Error showing triggers: " . $e->getMessage() . "\n";
    }
}

try {
    printTableInfo($pdo, 'customers');
    printTriggers($pdo, 'customers');
    
    printTableInfo($pdo, 'activities');
    printTriggers($pdo, 'activities');

} catch (Throwable $e) {
    echo "Fatal Error: " . $e->getMessage() . "\n";
}
