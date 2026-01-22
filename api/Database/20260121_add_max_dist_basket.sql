-- Add 'on_max_dist_basket_key' to basket_config
ALTER TABLE `basket_config` 
ADD COLUMN `on_max_dist_basket_key` VARCHAR(50) NULL DEFAULT NULL AFTER `max_distribution_count`;

-- Update existing records manually if needed (not strictly required as NULL works as 'no override')
