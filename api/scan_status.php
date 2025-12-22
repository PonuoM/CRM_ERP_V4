<?php
$files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator('.'));
foreach ($files as $file) {
    if ($file->isDir()) continue;
    $path = $file->getPathname();
    if (strpos($path, 'node_modules') !== false || strpos($path, '.git') !== false || strpos($path, 'vendor') !== false) continue;
    if (pathinfo($path, PATHINFO_EXTENSION) !== 'php') continue;
    
    $content = file_get_contents($path);
    if (strpos($content, 'lifecycle_status') !== false) {
        // echo "Found in $path\n";
        // Show lines with lifecycle_status
        $lines = explode("\n", $content);
        foreach ($lines as $i => $line) {
            if (strpos($line, 'lifecycle_status') !== false) {
                echo "File: $path | Line " . ($i+1) . ": " . trim($line) . "\n";
            }
        }
    }
}
