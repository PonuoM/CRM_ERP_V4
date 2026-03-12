<?php
// Read total_assigned_result.md and output as clean JSON
$content = file_get_contents(__DIR__ . '/total_assigned_result.md');
// Write to a PHP file for view_file
file_put_contents(__DIR__ . '/total_assigned_clean.php', "<?php\n// Result output:\n/*\n" . $content . "\n*/\n");
echo "Created total_assigned_clean.php\n";
