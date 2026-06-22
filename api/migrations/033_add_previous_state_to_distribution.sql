-- 033_add_previous_state_to_distribution.sql

-- Add columns to distribution_session_details to act as a Rollback Journal for the Undo system
ALTER TABLE distribution_session_details 
ADD COLUMN previous_assigned_to INT NULL,
ADD COLUMN previous_basket_key VARCHAR(50) NULL,
ADD COLUMN previous_lifecycle_status VARCHAR(50) NULL;

-- Add a status column to distribution_sessions to track if a session was undone
ALTER TABLE distribution_sessions
ADD COLUMN session_status VARCHAR(50) DEFAULT 'completed' COMMENT 'completed, undo_partial, undo_full';
