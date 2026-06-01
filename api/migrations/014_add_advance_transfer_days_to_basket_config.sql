ALTER TABLE `basket_config`
ADD COLUMN `advance_transfer_days` INT DEFAULT NULL COMMENT 'จำนวนวันที่อนุญาตให้ดึงลูกค้าข้ามถังล่วงหน้า';
