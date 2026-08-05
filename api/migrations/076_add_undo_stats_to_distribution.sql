ALTER TABLE `distribution_sessions` 
ADD COLUMN `undo_success_count` INT NULL DEFAULT NULL AFTER `session_status`,
ADD COLUMN `undo_skipped_count` INT NULL DEFAULT NULL AFTER `undo_success_count`;

ALTER TABLE `distribution_session_details`
ADD COLUMN `undo_status` VARCHAR(20) NULL DEFAULT NULL COMMENT 'pending, undone, skipped' AFTER `previous_lifecycle_status`;
