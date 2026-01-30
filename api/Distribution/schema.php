<?php
// api/Distribution/schema.php

function ensure_distribution_schema(PDO $pdo)
{
    try {
        $dbName = $pdo->query("SELECT DATABASE()")->fetchColumn();

        // 1. Ensure `customer_assign_check` table exists
        $tableExists = $pdo->query("SELECT COUNT(*) FROM information_schema.tables 
                                    WHERE table_schema = '$dbName' AND table_name = 'customer_assign_check'")->fetchColumn();

        if ($tableExists == 0) {
            $pdo->exec("CREATE TABLE customer_assign_check (
                id INT AUTO_INCREMENT PRIMARY KEY,
                customer_id INT NOT NULL,
                user_id INT NOT NULL,
                company_id INT NOT NULL DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_customer_check (customer_id, user_id),
                INDEX idx_user_check (user_id),
                CONSTRAINT fk_cac_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
                CONSTRAINT fk_cac_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
        }

        // 2. Ensure `current_round` column exists in `customers` table
        $colExists = $pdo->query("SELECT COUNT(*) FROM information_schema.columns 
                                  WHERE table_schema = '$dbName' AND table_name = 'customers' AND column_name = 'current_round'")->fetchColumn();

        if ($colExists == 0) {
            $pdo->exec("ALTER TABLE customers ADD COLUMN current_round INT NOT NULL DEFAULT 1 AFTER assigned_to");
        }

    } catch (PDOException $e) {
        // Log error but don't stop execution if possible, or re-throw if critical
        error_log("Distribution Schema Error: " . $e->getMessage());
    }
}
