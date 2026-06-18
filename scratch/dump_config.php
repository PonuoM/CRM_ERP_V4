<?php
header('Content-Type: application/json');

require_once __DIR__ . '/../api/config.php';

echo json_encode([
    'DB_HOST' => $DB_HOST,
    'DB_PORT' => $DB_PORT,
    'DB_NAME' => $DB_NAME,
    'DB_USER' => $DB_USER,
    'DB_PASS' => $DB_PASS
]);
