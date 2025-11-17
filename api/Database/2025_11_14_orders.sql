ALTER TABLE orders
  ADD COLUMN recipient_first_name VARCHAR(128) NULL AFTER postal_code,
  ADD COLUMN recipient_last_name VARCHAR(128) NULL AFTER recipient_first_name;

ALTER TABLE customer_address
  ADD COLUMN recipient_first_name VARCHAR(128) NULL AFTER address,
  ADD COLUMN recipient_last_name VARCHAR(128) NULL AFTER recipient_first_name;

ALTER TABLE customers
  ADD COLUMN recipient_first_name VARCHAR(128) NULL AFTER postal_code,
  ADD COLUMN recipient_last_name VARCHAR(128) NULL AFTER recipient_first_name;
