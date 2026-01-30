CREATE TABLE IF NOT EXISTS system_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    action VARCHAR(50) NOT NULL COMMENT 'Action type e.g. manual_round_reset',
    description TEXT NULL COMMENT 'Details about the action',
    user_id INT NULL COMMENT 'Who performed the action',
    company_id INT NOT NULL DEFAULT 1 COMMENT 'Company context',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_company_action (company_id, action),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
