ALTER TABLE `onecall_batch` ADD `company_id` INT NOT NULL DEFAULT '1' AFTER `id`;
ALTER TABLE `onecall_batch` ADD INDEX `company_id` (`company_id`);
