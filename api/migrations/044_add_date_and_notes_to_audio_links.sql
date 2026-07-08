ALTER TABLE `order_audio_links`
ADD COLUMN `audio_date` DATETIME NULL AFTER `audio_url`,
ADD COLUMN `notes` TEXT NULL AFTER `audio_date`;

ALTER TABLE `orders`
ADD COLUMN `admin_resolution_notes` TEXT NULL;
