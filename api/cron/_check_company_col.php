<?php
require_once __DIR__ . '/../config.php';
$pdo = db_connect();
header('Content-Type: text/plain; charset=utf-8');

echo "=== users columns with company/branch ===\n";
$r = $pdo->query("SHOW COLUMNS FROM users");
while ($c = $r->fetch(PDO::FETCH_ASSOC)) {
    if (stripos($c['Field'], 'company') !== false || stripos($c['Field'], 'branch') !== false) {
        echo $c['Field'] . " | " . $c['Type'] . "\n";
    }
}

echo "\n=== orders columns with company/branch ===\n";
$r2 = $pdo->query("SHOW COLUMNS FROM orders");
while ($c2 = $r2->fetch(PDO::FETCH_ASSOC)) {
    if (stripos($c2['Field'], 'company') !== false || stripos($c2['Field'], 'branch') !== false) {
        echo $c2['Field'] . " | " . $c2['Type'] . "\n";
    }
}

echo "\n=== customers columns with company/branch ===\n";
$r3 = $pdo->query("SHOW COLUMNS FROM customers");
while ($c3 = $r3->fetch(PDO::FETCH_ASSOC)) {
    if (stripos($c3['Field'], 'company') !== false || stripos($c3['Field'], 'branch') !== false) {
        echo $c3['Field'] . " | " . $c3['Type'] . "\n";
    }
}
