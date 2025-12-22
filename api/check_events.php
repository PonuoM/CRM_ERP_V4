<?php
require_once __DIR__ . '/config.php';
try {
    $stmt = $pdo->query("SELECT EVENT_NAME, EVENT_DEFINITION FROM INFORMATION_SCHEMA.EVENTS WHERE EVENT_SCHEMA = 'mini_erp'");
    print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
} catch (Exception $e) {
    echo $e->getMessage();
}
