<?php
// HARDCODED CONFIG FROM api/config.php
$DB_HOST = "127.0.0.1";
$DB_PORT = "3306";
$DB_NAME = "mini_erp";
$DB_USER = "root";
$DB_PASS = "12345678";

function db_connect_debug(): PDO
{
  global $DB_HOST, $DB_PORT, $DB_NAME, $DB_USER, $DB_PASS;
  $dsn = "mysql:host={$DB_HOST};port={$DB_PORT};dbname={$DB_NAME};charset=utf8mb4";
  $opts = [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  ];
  return new PDO($dsn, $DB_USER, $DB_PASS, $opts);
}

try {
    $pdo = db_connect_debug();
    echo "Connected to database: $DB_NAME\n\n";

    echo "--- Checking Company ID Distribution ---\n";
    $stmt = $pdo->query("SELECT company_id, COUNT(*) as count FROM customers GROUP BY company_id");
    $companies = $stmt->fetchAll();
    foreach ($companies as $c) {
        print_r($c);
    }

    echo "\n--- Checking Recent Records (by date_assigned) ---\n";
    $stmt = $pdo->query("SELECT customer_ref_id, date_assigned, assigned_to FROM customers WHERE assigned_to = 1655 ORDER BY customer_id DESC LIMIT 5");
    $rows = $stmt->fetchAll();
    foreach ($rows as $r) {
        print_r($r);
    }
    
    echo "\n--- Checking Customer ID Pattern ---\n";
    $stmt = $pdo->query("SELECT LEFT(customer_ref_id, 10) as prefix, COUNT(*) FROM customers GROUP BY LEFT(customer_ref_id, 10) LIMIT 10");
    $patterns = $stmt->fetchAll();
    foreach ($patterns as $p) {
        print_r($p);
    }

    echo "\n--- Checking Triggers on customers ---\n";
    $stmt = $pdo->query("SHOW TRIGGERS LIKE 'customers'");
    $triggers = $stmt->fetchAll();
    if (count($triggers) > 0) {
        foreach ($triggers as $t) {
            echo "Trigger: " . $t['Trigger'] . " Event: " . $t['Event'] . " Timing: " . $t['Timing'] . "\nStatement: " . $t['Statement'] . "\n\n";
        }
    } else {
        echo "No triggers found on customers table.\n";
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
