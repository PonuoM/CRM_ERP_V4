<?php
$file = 'c:\AppServ\www\CRM_ERP_V4\mini_erp (25).sql';
$handle = fopen($file, "r");
if ($handle) {
    echo "Reading file...\n";
    $lineNum = 0;
    while (($line = fgets($handle)) !== false) {
        $lineNum++;
        if (strpos($line, 'CREATE TABLE `customers`') !== false || strpos($line, 'CREATE TABLE customers') !== false) {
            echo "Found at line: $lineNum\n";
            echo $line;
            // Read next few lines to see columns
            for ($i = 0; $i < 20; $i++) {
                echo fgets($handle);
            }
            break;
        }
    }
    fclose($handle);
} else {
    echo "Error opening file";
}
?>
