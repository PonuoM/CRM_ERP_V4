<?php
$url = 'http://localhost/api/basket_config.php?companyId=1&target_page=dashboard_v2';
$response = file_get_contents($url);

if ($response === false) {
    echo "API call failed\n";
    exit;
}

$data = json_decode($response, true);

if ($data === null) {
    echo "JSON decode failed\n";
    exit;
}

echo "=== Basket Config API Response ===\n";
echo "Total configs: " . count($data) . "\n\n";

foreach ($data as $config) {
    echo "ID: {$config['id']} - {$config['basket_key']} ({$config['basket_name']})\n";
    echo "  linked_basket_key: " . ($config['linked_basket_key'] ?: 'NULL') . "\n";
    echo "  display_order: {$config['display_order']}\n";
    echo "\n";
}
?>

