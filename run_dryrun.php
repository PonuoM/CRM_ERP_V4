<?php
$_GET['company'] = '1';
$_GET['dryrun'] = '1';
$_GET['key'] = 'basket_transfer_2026_secret';

ob_start();
require __DIR__ . '/api/cron/monthly_transfer_web.php';
$out = ob_get_clean();

if (strpos($out, '238858') !== false) {
    echo "CUSTOMER 238858 IS IN DRYRUN!\n";
    // extract line with 238858
    $lines = explode("\n", $out);
    foreach($lines as $line) {
        if (strpos($line, '238858') !== false) {
            echo $line . "\n";
        }
    }
} else {
    echo "CUSTOMER 238858 IS NOT IN DRYRUN OUTPUT!\n";
}
