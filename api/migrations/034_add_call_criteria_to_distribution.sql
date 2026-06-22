-- 034_add_call_criteria_to_distribution.sql
-- Description: Add min_call_minutes to track call thresholds during distribution

ALTER TABLE `distribution_sessions` 
ADD COLUMN `min_call_minutes` INT DEFAULT NULL AFTER `distribution_mode`;
