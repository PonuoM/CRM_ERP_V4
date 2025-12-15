<?php
// Test file to debug import_google_sheet endpoint
require_once __DIR__ . '/../config.php';

cors();

echo "Testing import_google_sheet endpoint\n\n";

// Show request info
echo "REQUEST_METHOD: " . ($_SERVER['REQUEST_METHOD'] ?? 'UNKNOWN') . "\n";
echo "REQUEST_URI: " . ($_SERVER['REQUEST_URI'] ?? 'UNKNOWN') . "\n";
echo "SCRIPT_NAME: " . ($_SERVER['SCRIPT_NAME'] ?? 'UNKNOWN') . "\n";

// Test route_path from index.php
function route_path(): array {
    $uri = $_SERVER['REQUEST_URI'] ?? '/';
    $scriptDir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/');
    $path = parse_url($uri, PHP_URL_PATH) ?: '/';
    if ($scriptDir && str_starts_with($path, $scriptDir)) {
        $path = substr($path, strlen($scriptDir));
    }
    $path = trim($path, '/');
    if (str_starts_with($path, 'api/')) {
        $path = substr($path, 4);
    } elseif ($path === 'api') {
        $path = '';
    }
    if (str_starts_with($path, 'index.php/')) {
        $path = substr($path, strlen('index.php/'));
    } elseif ($path === 'index.php') {
        $path = '';
    }
    return explode('/', $path);
}

$parts = route_path();
echo "\nParsed parts: " . json_encode($parts) . "\n";
echo "Resource: " . ($parts[0] ?? 'EMPTY') . "\n";

// Test if file exists
$importFile = __DIR__ . '/import.php';
echo "\n import.php exists: " . (file_exists($importFile) ? 'YES' : 'NO') . "\n";
echo "import.php path: $importFile\n";

// Try to call the actual endpoint
echo "\n--- Calling actual import.php ---\n";
require_once $importFile;
