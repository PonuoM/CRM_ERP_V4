-- Migration: Add voicecall_conversation_id to order_audio_resolutions
ALTER TABLE `order_audio_resolutions` 
ADD COLUMN `voicecall_conversation_id` BIGINT NULL DEFAULT NULL AFTER `order_id`;

-- Add index to speed up webhook updates
CREATE INDEX `idx_voicecall_conversation_id` ON `order_audio_resolutions` (`voicecall_conversation_id`);
