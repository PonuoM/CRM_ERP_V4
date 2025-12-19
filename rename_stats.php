<?php
$files = [
    __DIR__ . '/api/customer/stats.php' => __DIR__ . '/api/customer/customer_stats.php',
    __DIR__ . '/api/Orders/stats.php' => __DIR__ . '/api/Orders/order_stats.php'
];

foreach ($files as $old => $new) {
    if (file_exists($old)) {
        if (rename($old, $new)) {
            echo "Renamed $old to $new\n";
        } else {
            echo "Failed to rename $old\n";
        }
    } else {
        echo "File not found: $old\n";
    }
}
