<?php
require_once "api/config.php";
$pdo = db_connect();

echo "\n--- statement_logs ---\n";
try {
    $stmt = $pdo->query("DESCRIBE statement_logs");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as $r) {
        echo "{$r['Field']} ({$r['Type']})\n";
    }
} catch (Exception $e) { echo $e->getMessage(); }

echo "\n--- statement_reconcile_logs ---\n";
try {
    $stmt = $pdo->query("DESCRIBE statement_reconcile_logs");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($rows as $r) {
        echo "{$r['Field']} ({$r['Type']})\n";
    }
} catch (Exception $e) { echo $e->getMessage(); }
?>
