<?php
$file = __DIR__ . '/debug_reconcile.txt';
if (file_put_contents($file, "Test Write " . date('Y-m-d H:i:s') . "\n", FILE_APPEND)) {
    echo "Write success to $file";
} else {
    echo "Write failed to $file";
    print_r(error_get_last());
}
?>
