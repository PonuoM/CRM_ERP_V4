<?php
header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename=Ads_Import_Template.csv');

// Output BOM for UTF-8 to ensure Excel reads it correctly
echo "\xEF\xBB\xBF";

$output = fopen('php://output', 'w');

// Header
fputcsv($output, ['Date (YYYY-MM-DD)', 'Store Name', 'Ads Cost', 'Impressions', 'Clicks']);

// Example rows
fputcsv($output, [date('Y-m-d'), 'Shopee Shop 1', '150.50', '2500', '120']);
fputcsv($output, [date('Y-m-d'), 'Lazada Shop A', '0', '0', '0']);

fclose($output);
?>
