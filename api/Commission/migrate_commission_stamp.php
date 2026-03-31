<?php
/**
 * Migration: Create commission_stamp_batches & commission_stamp_orders tables
 * Auto-run via ensure pattern
 */
require_once __DIR__ . "/../config.php";

header('Content-Type: application/json; charset=utf-8');

try {
    $pdo = db_connect();

    // commission_stamp_batches
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS commission_stamp_batches (
            id INT AUTO_INCREMENT PRIMARY KEY,
            company_id INT NOT NULL,
            name VARCHAR(255) NOT NULL,
            order_count INT DEFAULT 0,
            total_commission DECIMAL(12,2) DEFAULT 0.00,
            created_by INT DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            note TEXT DEFAULT NULL,
            for_month INT DEFAULT NULL,
            for_year INT DEFAULT NULL,
            INDEX idx_csb_company (company_id),
            INDEX idx_csb_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    // Alter table to add columns if they don't exist for existing dbs
    $checkColsResult = $pdo->query("SHOW COLUMNS FROM commission_stamp_batches LIKE 'for_month'");
    if ($checkColsResult->rowCount() === 0) {
        $pdo->exec("ALTER TABLE commission_stamp_batches ADD COLUMN for_month INT DEFAULT NULL, ADD COLUMN for_year INT DEFAULT NULL");
    }

    // commission_stamp_orders
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS commission_stamp_orders (
            id INT AUTO_INCREMENT PRIMARY KEY,
            batch_id INT NOT NULL,
            order_id VARCHAR(50) NOT NULL,
            user_id INT DEFAULT NULL,
            commission_amount DECIMAL(12,2) DEFAULT NULL,
            note TEXT DEFAULT NULL,
            stamped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            stamped_by INT DEFAULT NULL,
            UNIQUE KEY uq_batch_order_user (batch_id, order_id, user_id),
            INDEX idx_cso_order (order_id),
            INDEX idx_cso_user (user_id),
            CONSTRAINT fk_cso_batch FOREIGN KEY (batch_id) REFERENCES commission_stamp_batches(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    echo json_encode(['ok' => true, 'message' => 'Migration completed']);
} catch (Exception $e) {
    echo json_encode(['ok' => false, 'error' => $e->getMessage()]);
}
