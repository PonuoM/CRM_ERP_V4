-- Migration: Alter env table to allow identical keys across different companies
-- Description: Drops the single unique constraint on `key` and replaces it with a composite unique constraint on `(company_id, key)`

ALTER TABLE `env` DROP INDEX `uniq_env_key`;
ALTER TABLE `env` ADD UNIQUE KEY `uniq_env_company_key` (`company_id`, `key`);
