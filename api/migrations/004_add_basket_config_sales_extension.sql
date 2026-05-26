ALTER TABLE `basket_config`
ADD COLUMN `extend_days_sales_amount_threshold` DECIMAL(12,2) DEFAULT NULL COMMENT 'ยอดขายขั้นต่ำที่จะได้รับการยืดเวลา',
ADD COLUMN `extend_days_sales_reward` INT DEFAULT NULL COMMENT 'จำนวนวันที่ยืดให้ถ้ายอดขายถึง';
