<?php
require_once __DIR__ . '/config.php';
$pdo = db_connect();
$stmt = $pdo->query("SHOW TRIGGERS");
while($r = $stmt->fetch()) {
    if (strpos($r['Table'], 'appointments') !== false || strpos($r['Statement'], 'lifecycle_status') !== false) {
        echo "Trigger: " . $r['Trigger'] . " on Table: " . $r['Table'] . "\n";
        echo "Event: " . $r['Event'] . " " . $r['Timing'] . "\n";
        echo "Statement:\n" . $r['Statement'] . "\n";
        echo "-------------------\n";
    }
}
