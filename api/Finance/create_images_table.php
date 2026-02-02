<?php
require_once __DIR__ . '/../config.php';

try {
    $pdo = db_connect();
    $sql = "CREATE TABLE IF NOT EXISTS debt_collection_images (
        id INT AUTO_INCREMENT PRIMARY KEY,
        debt_collection_id INT NOT NULL,
        image_path VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX (debt_collection_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";

    $pdo->exec($sql);
    echo "Table 'debt_collection_images' created successfully.";
} catch (PDOException $e) {
    echo "Error creating table: " . $e->getMessage();
}
?>