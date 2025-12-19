ALTER TABLE orders MODIFY COLUMN payment_method ENUM('COD', 'Transfer', 'PayAfter', 'Claim', 'FreeGift') DEFAULT NULL;
