<?php
header('Content-Type: application/json');

// Check if BasketRoutingServiceV2 exists and has debug code
$file = __DIR__ . '/Services/BasketRoutingServiceV2.php';
$content = file_get_contents($file);

$hasV2 = file_exists($file);
$hasDebug = strpos($content, '[BasketRoutingV2]') !== false;

// Check index.php for hooks
$indexFile = __DIR__ . '/index.php';
$indexContent = file_get_contents($indexFile);

$hasPatchHook = strpos($indexContent, 'basket_routing') !== false;
$hasPostHook = strpos($indexContent, 'basketRoutingDebug') !== false;

echo json_encode([
    'version' => 'v2_debug',
    'timestamp' => date('Y-m-d H:i:s'),
    'checks' => [
        'BasketRoutingServiceV2_exists' => $hasV2,
        'has_debug_logging' => $hasDebug,
        'index_has_basket_routing_response' => $hasPatchHook,
        'index_has_debug_var' => $hasPostHook
    ]
]);
