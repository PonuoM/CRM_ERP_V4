CREATE TABLE customer_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    customer_id VARCHAR(32) NOT NULL, -- varchar(32) เหมือน customers.id
    bucket_type VARCHAR(16), -- varchar(16) เหมือน customers.bucket_type
    lifecycle_status ENUM('New','Old','FollowUp','Old3Months','DailyDis...'), -- เหมือน customers.lifecycle_status
    assigned_to INT(11), -- int(11) เหมือน customers.assigned_to
    action_type ENUM('create', 'update', 'delete') DEFAULT 'update',
    old_values JSON,
    new_values JSON,
    changed_fields JSON,
    created_by INT(11), -- สมมติว่าเป็น int(11) (อ้างอิง users)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- ไม่มี FK constraint เพื่อให้ retention ข้อมูลได้ดีกว่า
    INDEX idx_customer_id (customer_id),
    INDEX idx_created_at (created_at),
    INDEX idx_assigned_to (assigned_to)
);
