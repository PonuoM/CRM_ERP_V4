<?php
// Ultra minimal test script
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

header('Content-Type: text/html; charset=utf-8');
echo "Step 1: Script is running<br>\n";

// Test config include
try {
    echo "Step 2: About to include config.php<br>\n";
    require_once __DIR__ . '/../config.php';
    echo "Step 3: Config loaded successfully<br>\n";
} catch (Exception $e) {
    echo "Step 2 Error: " . $e->getMessage() . "<br>\n";
}

// Test db connection
try {
    echo "Step 4: About to connect to database<br>\n";
    $pdo = db_connect();
    echo "Step 5: Database connected successfully<br>\n";
} catch (Exception $e) {
    echo "Step 4 Error: " . $e->getMessage() . "<br>\n";
}

// Test simple query
try {
    echo "Step 6: About to run test query<br>\n";
    $stmt = $pdo->query("SELECT 1 as test");
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    echo "Step 7: Query result: " . json_encode($result) . "<br>\n";
} catch (Exception $e) {
    echo "Step 6 Error: " . $e->getMessage() . "<br>\n";
}

echo "Step DONE: All steps completed<br>\n";
?>
