<?php
require_once __DIR__ . '/config.php';

$dirs = [
    'Address_DB', 'Bank_DB', 'Marketing_DB', 'Onecall_DB', 
    'Page_DB', 'Product_DB', 'Slip_DB', 'Statement_DB', 'User_DB'
];

foreach ($dirs as $dir) {
    $path = __DIR__ . '/' . $dir;
    if (!is_dir($path)) continue;
    
    $files = glob($path . '/*.php');
    foreach ($files as $file) {
        $content = file_get_contents($file);
        
        // Skip if already secured
        if (strpos($content, 'validate_auth(') !== false) {
            echo "Skipping " . basename($file) . " (already secured)\n";
            continue;
        }
        
        // Look for db_connect
        if (strpos($content, 'db_connect()') !== false) {
            // Replace $pdo = db_connect(); with $pdo = db_connect(); validate_auth($pdo);
            // Handle variations like $conn = db_connect();
            
            $pattern = '/(\$[a-zA-Z0-9_]+)\s*=\s*db_connect\(\);/';
            if (preg_match($pattern, $content, $matches)) {
                $varName = $matches[1]; // e.g. $pdo
                $replacement = "$0\n    validate_auth($varName);";
                $newContent = preg_replace($pattern, $replacement, $content);
                
                if ($newContent !== $content) {
                    file_put_contents($file, $newContent);
                    echo "Secured " . basename($file) . "\n";
                }
            } else {
                 echo "Warning: " . basename($file) . " uses db_connect but pattern mismatch\n";
            }
        } else {
            echo "Skipping " . basename($file) . " (no db_connect)\n";
        }
    }
}
