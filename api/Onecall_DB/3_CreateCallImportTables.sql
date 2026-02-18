-- Create call_import_batches table
CREATE TABLE IF NOT EXISTS call_import_batches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    file_name VARCHAR(255) NOT NULL,
    total_rows INT NOT NULL DEFAULT 0,
    matched_rows INT NOT NULL DEFAULT 0,
    duplicate_rows INT NOT NULL DEFAULT 0,
    company_id INT NULL,
    created_by INT NULL,
    start_date DATE NULL,
    end_date DATE NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_cib_company (company_id),
    INDEX idx_cib_created (created_at)
);

-- Create call_import_logs table
CREATE TABLE IF NOT EXISTS call_import_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    batch_id INT NOT NULL,
    record_id VARCHAR(32) NOT NULL,
    business_group_name VARCHAR(255) NULL,
    call_date DATE NULL,
    call_origination VARCHAR(32) NULL,
    display_number VARCHAR(32) NULL,
    call_termination VARCHAR(32) NULL,
    status TINYINT NULL DEFAULT 0,
    start_time TIME NULL,
    ringing_duration VARCHAR(16) NULL,
    answered_time VARCHAR(16) NULL,
    terminated_time VARCHAR(16) NULL,
    terminated_reason VARCHAR(8) NULL,
    reason_change VARCHAR(8) NULL,
    final_number VARCHAR(32) NULL,
    duration VARCHAR(16) NULL,
    rec_type TINYINT NULL,
    charging_group VARCHAR(128) NULL,
    agent_phone VARCHAR(32) NULL,
    matched_user_id INT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_record_id (record_id),
    INDEX idx_cil_batch (batch_id),
    INDEX idx_cil_call_date (call_date),
    INDEX idx_cil_agent_phone (agent_phone),
    FOREIGN KEY (batch_id) REFERENCES call_import_batches(id) ON DELETE CASCADE
);
