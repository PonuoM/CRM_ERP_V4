<?php
require_once 'config.php';

try {
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS stock_transactions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            document_number VARCHAR(50) NOT NULL UNIQUE,
            type ENUM('receive', 'adjustment') NOT NULL,
            transaction_date DATETIME NOT NULL,
            proof_image VARCHAR(255),
            notes TEXT,
            created_by INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS stock_transaction_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            transaction_id INT NOT NULL,
            product_id INT NOT NULL,
            warehouse_id INT NOT NULL,
            lot_id INT NULL,
            quantity DECIMAL(10, 2) NOT NULL,
            adjustment_type ENUM('add', 'reduce', 'receive') NOT NULL,
            remarks VARCHAR(255),
            FOREIGN KEY (transaction_id) REFERENCES stock_transactions(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");
    echo "Tables created successfully.";
} catch (PDOException $e) {
    die("DB Error: " . $e->getMessage());
}
