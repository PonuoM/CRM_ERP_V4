<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

header('Content-Type: text/html; charset=utf-8');

echo "<h2>API Diagnostic Check</h2>";

// 1. Check Config
$configFile = __DIR__ . '/config.php';
if (!file_exists($configFile)) {
    die("<span style='color:red'>[ERROR] config.php is missing in " . __DIR__ . "</span>");
}
echo "[OK] config.php found.<br>";

require_once $configFile;
echo "[OK] config.php loaded.<br>";

// 2. Check Database Credentials
echo "<h3>Database Configuration</h3>";
echo "Host: " . htmlspecialchars($DB_HOST) . "<br>";
echo "DB Name: " . htmlspecialchars($DB_NAME) . "<br>";
echo "User: " . htmlspecialchars($DB_USER) . "<br>";
// Do not print password

// 3. Test Connection
echo "<h3>Connection Test</h3>";
try {
    $pdo = db_connect();
    echo "<span style='color:green'>[SUCCESS] Successfully connected to database.</span><br>";
    
    // Test simple query
    $stmt = $pdo->query("SELECT @@version");
    $ver = $stmt->fetchColumn();
    echo "MySQL Version: " . $ver . "<br>";
    
    // Check key tables
    $tables = ['orders', 'users', 'user_tokens'];
    foreach ($tables as $t) {
        try {
            $pdo->query("SELECT 1 FROM $t LIMIT 1");
            echo "[OK] Table '$t' exists.<br>";
        } catch (Exception $e) {
            echo "<span style='color:red'>[ERROR] Table '$t' check failed: " . $e->getMessage() . "</span><br>";
        }
    }

} catch (Throwable $e) {
    echo "<span style='color:red'>[FATAL] Database connection failed!</span><br>";
    echo "Error: " . htmlspecialchars($e->getMessage()) . "<br>";
    echo "Trace: <pre>" . htmlspecialchars($e->getTraceAsString()) . "</pre>";
}

// 4. Check Vendor/Deps
echo "<h3>Dependencies</h3>";
if (file_exists(__DIR__ . '/vendor/autoload.php')) {
    echo "[OK] vendor/autoload.php found.<br>";
} else {
    echo "[INFO] vendor/autoload.php NOT found (This is expected if using zipped vendor).<br>";
}

// Check if we can write logs
if (is_writable(__DIR__)) {
    echo "[OK] API directory is writable.<br>";
} else {
    echo "[WARN] API directory is NOT writable (logging might fail).<br>";
}
?>
