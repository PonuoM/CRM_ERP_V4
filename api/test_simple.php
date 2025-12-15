<?php
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

echo "Starting debug...<br>";

try {
    $autoloadPath = __DIR__ . '/vendor/autoload.php';
    if (!file_exists($autoloadPath)) {
        throw new Exception("Autoload file not found at: $autoloadPath");
    }
    require_once $autoloadPath;
    echo "Autoload loaded.<br>";

    if (!class_exists('Google\Client')) {
        throw new Exception("Google\Client class not found!");
    }
    echo "Google\Client class exists.<br>";

    $client = new Google\Client();
    echo "Google Client instantiated.<br>";

    $credPath = __DIR__ . '/google-credentials.json';
    if (!file_exists($credPath)) {
        throw new Exception("Credentials file not found at: $credPath");
    }
    echo "Credentials found.<br>";

    $client->setAuthConfig($credPath);
    echo "AuthConfig set.<br>";
    
    echo "Test Complete - Success";
} catch (Throwable $e) {
    echo "Error: " . $e->getMessage() . "<br>";
    echo "Trace: " . $e->getTraceAsString();
}
