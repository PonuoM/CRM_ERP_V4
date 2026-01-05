<?php
require_once __DIR__ . '/../config.php';

try {
    $pdo = db_connect();
    
    $sql = "CREATE TABLE IF NOT EXISTS `marketing_user_product` (
      `id` int(11) NOT NULL AUTO_INCREMENT,
      `user_id` int(11) NOT NULL,
      `product_id` int(11) NOT NULL,
      `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
      PRIMARY KEY (`id`),
      KEY `user_id` (`user_id`),
      KEY `product_id` (`product_id`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;";
    
    $pdo->exec($sql);
    echo "Table marketing_user_product created successfully.";
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
