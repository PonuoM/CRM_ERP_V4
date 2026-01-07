<?php
require_once 'config.php';
$pdo = db_connect();
$stmt = $pdo->query("SELECT role, data FROM role_permissions WHERE role = 'backoffice'");
$r = $stmt->fetch(PDO::FETCH_ASSOC);
if ($r) {
    echo "Role: " . $r['role'] . "\n\n";
    echo "Raw Data:\n";
    echo $r['data'] . "\n\n";
    echo "Parsed:\n";
    print_r(json_decode($r['data'], true));
} else {
    echo "No backoffice permissions found!\n";
}
