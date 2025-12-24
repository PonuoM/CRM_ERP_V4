<?php
require_once '../config.php';

try {
    $sql = "CREATE TABLE IF NOT EXISTS stock_transaction_images (
        id INT AUTO_INCREMENT PRIMARY KEY,
        transaction_id INT NOT NULL,
        image_path VARCHAR(255) NOT NULL,
        FOREIGN KEY (transaction_id) REFERENCES stock_transactions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";

    $pdo->exec($sql);
    echo "Table 'stock_transaction_images' created successfully.";
} catch (PDOException $e) {
    echo "Error creating table: " . $e->getMessage();
}
?>
