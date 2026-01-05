<?php
$files = [
    'c:/AppServ/www/CRM_ERP_V4/api/debug_check.log',
    'c:/AppServ/www/CRM_ERP_V4/api/debug_counts.log'
];

foreach ($files as $file) {
    if (file_exists($file)) {
        echo "--- File: " . basename($file) . " (Last 10 lines) ---\n";
        $lines = file($file);
        $last = array_slice($lines, -10);
        foreach ($last as $l) {
            echo $l;
        }
        echo "\n\n";
    } else {
        echo "File not found: $file\n";
    }
}
