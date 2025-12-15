<?php
require_once dirname(__DIR__) . "/config.php";

echo "<h2>Fixing Suspense Schema (Allow NULL order_id)</h2>";

try {
    $pdo = db_connect();
    
    // Check current column definition
    $stmt = $pdo->query("DESCRIBE statement_reconcile_logs order_id");
    $col = $stmt->fetch(PDO::FETCH_ASSOC);
    echo "<p>Current State: Type={$col['Type']}, Null={$col['Null']}</p>";

    if ($col['Null'] === 'NO') {
        echo "<p>Modifying order_id to allow NULL...</p>";
        // Modify column to be NULLABLE
        // Note: order_id is VARCHAR(32) based on previous reading
        $pdo->exec("ALTER TABLE statement_reconcile_logs MODIFY order_id VARCHAR(32) NULL");
        echo "<p style='color:green'>Success: order_id is now NULLABLE.</p>";
    } else {
        echo "<p style='color:blue'>Info: order_id is already NULLABLE.</p>";
    }

} catch (PDOException $e) {
    echo "<p style='color:red'>Error: " . $e->getMessage() . "</p>";
}
?>
