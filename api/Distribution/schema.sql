-- Create customer_assign_check table
CREATE TABLE IF NOT EXISTS customer_assign_check (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    user_id INT NOT NULL,
    company_id INT NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_customer_check (customer_id, user_id),
    INDEX idx_user_check (user_id),
    CONSTRAINT fk_cac_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE CASCADE,
    CONSTRAINT fk_cac_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Add current_round column to customers table if it doesn't exist
-- Note: MySQL 5.7+ supports IF NOT EXISTS for columns in some versions, but standard ALTER might fail if exists.
-- Please run this line only if the column does not exist.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS current_round INT NOT NULL DEFAULT 1 AFTER assigned_to;
