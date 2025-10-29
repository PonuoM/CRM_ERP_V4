-- =============================================
-- Notification System Tables for CRM/ERP System
-- Created: 2025-10-27
-- Purpose: Role-based notification system
-- =============================================

-- 1. Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(50) PRIMARY KEY,
  type ENUM(
    'system_maintenance', 'system_update',
    'new_customer_assigned', 'customer_ownership_expiring', 'customer_follow_up_due', 'customer_grade_changed',
    'new_order_created', 'order_status_changed', 'order_cancelled', 'order_payment_pending',
    'payment_verification_required', 'payment_overdue', 'payment_verified',
    'stock_low', 'stock_out', 'new_stock_received',
    'new_promotion_created', 'promotion_expiring', 'campaign_performance',
    'team_target_achieved', 'team_member_performance', 'new_team_member',
    'daily_report_ready', 'weekly_report_ready', 'monthly_report_ready',
    'page_engagement_drop', 'page_reach_increase', 'unanswered_messages', 'weekly_page_report',
    'high_performing_post', 'low_performing_post', 'scheduled_post_reminder', 'facebook_policy_alert',
    'new_customer_from_page', 'customer_inquiry_from_page', 'customer_complaint_from_page', 'customer_review_from_page',
    'pancake_api_connection_issue', 'page_data_sync_success', 'page_data_sync_failure', 'environment_variable_change'
  ) NOT NULL,
  category ENUM(
    'system', 'sales', 'customer', 'order', 'payment', 'inventory', 'marketing', 'report', 'team', 'page_performance', 'content_management', 'customer_interaction'
  ) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_read BOOLEAN DEFAULT FALSE,
  priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
  related_id VARCHAR(50), -- e.g., order ID or customer ID
  page_id INT NULL, -- For page-related notifications
  page_name VARCHAR(255) NULL, -- Name of related page
  platform VARCHAR(50) NULL, -- Facebook, TikTok, etc.
  previous_value DECIMAL(10,2) NULL, -- For performance notifications
  current_value DECIMAL(10,2) NULL, -- For performance notifications
  percentage_change DECIMAL(5,2) NULL, -- For performance notifications
  action_url VARCHAR(255) NULL, -- URL to navigate when clicked
  action_text VARCHAR(100) NULL, -- Text for action button
  metadata JSON NULL, -- Additional data
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_timestamp (timestamp),
  INDEX idx_is_read (is_read),
  INDEX idx_type (type),
  INDEX idx_category (category),
  INDEX idx_priority (priority),
  INDEX idx_related_id (related_id),
  INDEX idx_page_id (page_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Notification Roles table
CREATE TABLE IF NOT EXISTS notification_roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  notification_id VARCHAR(50) NOT NULL,
  role ENUM('Admin Page', 'Telesale', 'Supervisor Telesale', 'Backoffice', 'Admin Control', 'Super Admin', 'Marketing') NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
  UNIQUE KEY unique_notification_role (notification_id, role),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Notification Users table (for user-specific notifications)
CREATE TABLE IF NOT EXISTS notification_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  notification_id VARCHAR(50) NOT NULL,
  user_id INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_notification_user (notification_id, user_id),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Notification Settings table (for user notification preferences)
CREATE TABLE IF NOT EXISTS notification_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  notification_type VARCHAR(50) NOT NULL,
  in_app_enabled BOOLEAN DEFAULT TRUE,
  email_enabled BOOLEAN DEFAULT FALSE,
  sms_enabled BOOLEAN DEFAULT FALSE,
  business_hours_only BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_notification_type (user_id, notification_type),
  INDEX idx_user_id (user_id),
  INDEX idx_notification_type (notification_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Notification Read Status table (to track read status per user)
CREATE TABLE IF NOT EXISTS notification_read_status (
  id INT AUTO_INCREMENT PRIMARY KEY,
  notification_id VARCHAR(50) NOT NULL,
  user_id INT NOT NULL,
  read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_notification_user_read (notification_id, user_id),
  INDEX idx_user_id (user_id),
  INDEX idx_read_at (read_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- Sample Data for Testing
-- =============================================

-- Sample Notifications
INSERT INTO notifications (id, type, category, title, message, priority, related_id, page_id, page_name, platform, action_url, action_text) VALUES
('notif_001', 'page_engagement_drop', 'page_performance', 'การมีส่วนร่วมลดลง', 'เพจ "ABC Shop" มีการมีส่วนร่วมลดลง 15% ในช่วง 7 วันที่ผ่านมา', 'medium', NULL, 123, 'ABC Shop', 'Facebook', '/pages/123/stats', 'ดูสถิติ'),
('notif_002', 'customer_inquiry_from_page', 'customer_interaction', 'มีคำถามจากลูกค้า', 'มีคำถามใหม่จากลูกค้าในเพจ "XYZ Store" ที่ยังไม่ได้ตอบกลับ', 'high', NULL, 456, 'XYZ Store', 'Facebook', '/pages/456/messages', 'ตอบกลับ'),
('notif_003', 'page_data_sync_success', 'system', 'อัปเดตข้อมูลเพจสำเร็จ', 'อัปเดตข้อมูลเพจสำเร็จ: 10 เพจ (เพิ่ม 2, อัปเดต 8)', 'low', NULL, NULL, NULL, NULL, '/pages', 'ดูรายละเอียด'),
('notif_004', 'new_order_created', 'order', 'มีคำสั่งซื้อใหม่', 'มีคำสั่งซื้อใหม่ #ORD-12345 จากลูกค้า สมชาย ใจดี', 'medium', 'ORD-12345', NULL, NULL, NULL, '/orders/ORD-12345', 'ดูรายละเอียด'),
('notif_005', 'payment_verification_required', 'payment', 'ต้องการตรวจสอบการชำระเงิน', 'คำสั่งซื้อ #ORD-12346 ต้องการตรวจสอบการชำระเงิน', 'high', 'ORD-12346', NULL, NULL, NULL, '/orders/ORD-12346', 'ตรวจสอบ');

-- Sample Notification Roles
INSERT INTO notification_roles (notification_id, role) VALUES
('notif_001', 'Admin Page'),
('notif_002', 'Admin Page'),
('notif_003', 'Admin Page'),
('notif_004', 'Telesale'),
('notif_004', 'Backoffice'),
('notif_005', 'Backoffice');

-- Sample Notification Users (for user-specific notifications)
INSERT INTO notification_users (notification_id, user_id) VALUES
('notif_001', 1), -- Admin user with ID 1
('notif_002', 1), -- Admin user with ID 1
('notif_004', 2), -- Telesale user with ID 2
('notif_005', 3); -- Backoffice user with ID 3

-- Sample Notification Settings
INSERT INTO notification_settings (user_id, notification_type, in_app_enabled, email_enabled, business_hours_only) VALUES
(1, 'page_engagement_drop', TRUE, TRUE, FALSE),
(1, 'customer_inquiry_from_page', TRUE, TRUE, TRUE),
(1, 'page_data_sync_success', TRUE, FALSE, FALSE),
(2, 'new_order_created', TRUE, TRUE, FALSE),
(3, 'payment_verification_required', TRUE, TRUE, TRUE);

-- =============================================
-- Views for Common Queries
-- =============================================

-- View for notifications by role
CREATE OR REPLACE VIEW notifications_by_role AS
SELECT 
  n.*,
  nr.role
FROM notifications n
JOIN notification_roles nr ON n.id = nr.notification_id
WHERE n.is_read = FALSE
ORDER BY n.timestamp DESC;

-- View for user notifications (role-based + user-specific)
CREATE OR REPLACE VIEW user_notifications AS
SELECT 
  n.*,
  nr.role,
  nu.user_id,
  COALESCE(nrs.read_at IS NOT NULL, FALSE) AS is_read_by_user
FROM notifications n
LEFT JOIN notification_roles nr ON n.id = nr.notification_id
LEFT JOIN notification_users nu ON n.id = nu.notification_id
LEFT JOIN notification_read_status nrs ON n.id = nrs.notification_id
WHERE (nr.role IS NOT NULL OR nu.user_id IS NOT NULL)
ORDER BY n.timestamp DESC;

-- =============================================
-- Stored Procedures for Common Operations
-- =============================================

DELIMITER //

-- Procedure to create a new notification
CREATE PROCEDURE CreateNotification(
  IN p_id VARCHAR(50),
  IN p_type VARCHAR(100),
  IN p_category VARCHAR(50),
  IN p_title VARCHAR(255),
  IN p_message TEXT,
  IN p_priority VARCHAR(10),
  IN p_related_id VARCHAR(50),
  IN p_page_id INT,
  IN p_page_name VARCHAR(255),
  IN p_platform VARCHAR(50),
  IN p_action_url VARCHAR(255),
  IN p_action_text VARCHAR(100)
)
BEGIN
  INSERT INTO notifications (
    id, type, category, title, message, priority, 
    related_id, page_id, page_name, platform, 
    action_url, action_text
  ) VALUES (
    p_id, p_type, p_category, p_title, p_message, p_priority,
    p_related_id, p_page_id, p_page_name, p_platform,
    p_action_url, p_action_text
  );
END //

-- Procedure to add role to notification
CREATE PROCEDURE AddNotificationRole(
  IN p_notification_id VARCHAR(50),
  IN p_role VARCHAR(50)
)
BEGIN
  INSERT INTO notification_roles (notification_id, role)
  VALUES (p_notification_id, p_role)
  ON DUPLICATE KEY UPDATE notification_id = notification_id;
END //

-- Procedure to add user to notification
CREATE PROCEDURE AddNotificationUser(
  IN p_notification_id VARCHAR(50),
  IN p_user_id INT
)
BEGIN
  INSERT INTO notification_users (notification_id, user_id)
  VALUES (p_notification_id, p_user_id)
  ON DUPLICATE KEY UPDATE notification_id = notification_id;
END //

-- Procedure to mark notification as read by user
CREATE PROCEDURE MarkNotificationAsRead(
  IN p_notification_id VARCHAR(50),
  IN p_user_id INT
)
BEGIN
  INSERT INTO notification_read_status (notification_id, user_id)
  VALUES (p_notification_id, p_user_id)
  ON DUPLICATE KEY UPDATE read_at = CURRENT_TIMESTAMP;
END //

-- Procedure to get notifications for user
CREATE PROCEDURE GetUserNotifications(
  IN p_user_id INT,
  IN p_user_role VARCHAR(50),
  IN p_limit INT
)
BEGIN
  SELECT DISTINCT n.*
  FROM notifications n
  LEFT JOIN notification_roles nr ON n.id = nr.notification_id
  LEFT JOIN notification_users nu ON n.id = nu.notification_id
  LEFT JOIN notification_read_status nrs ON n.id = nrs.notification_id AND nrs.user_id = p_user_id
  WHERE (nr.role = p_user_role OR nu.user_id = p_user_id)
    AND nrs.read_at IS NULL
  ORDER BY n.timestamp DESC
  LIMIT p_limit;
END //

DELIMITER ;

-- =============================================
-- Triggers for Automatic Updates
-- =============================================

-- Trigger to update updated_at timestamp
DELIMITER //
CREATE TRIGGER notifications_before_update 
BEFORE UPDATE ON notifications
FOR EACH ROW
BEGIN
  SET NEW.updated_at = CURRENT_TIMESTAMP;
END //
DELIMITER ;

-- Trigger to update updated_at timestamp in notification_settings
DELIMITER //
CREATE TRIGGER notification_settings_before_update 
BEFORE UPDATE ON notification_settings
FOR EACH ROW
BEGIN
  SET NEW.updated_at = CURRENT_TIMESTAMP;
END //
DELIMITER ;

-- =============================================
-- End of Notification System Schema
-- =============================================