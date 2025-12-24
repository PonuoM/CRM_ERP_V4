<?php
require_once 'api/config.php';
try {
    $stmt = $pdo->query("SHOW TABLES LIKE 'stock_transactions'");
    if ($stmt->rowCount() > 0) {
        echo "Table 'stock_transactions' EXISTS in the live database.\n";
    } else {
        echo "Table 'stock_transactions' DOES NOT EXIST in the live database.\n";
    }
    
    $stmt2 = $pdo->query("SHOW TABLES LIKE 'stock_transaction_items'");
    if ($stmt2->rowCount() > 0) {
         echo "Table 'stock_transaction_items' EXISTS.\n";
    }
    
    $stmt3 = $pdo->query("SHOW TABLES LIKE 'stock_transaction_images'");
    if ($stmt3->rowCount() > 0) {
         echo "Table 'stock_transaction_images' EXISTS.\n";
    }
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage();
}
?>
