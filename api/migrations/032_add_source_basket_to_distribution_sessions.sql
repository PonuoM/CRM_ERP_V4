-- 032_add_source_basket_to_distribution_sessions.sql

ALTER TABLE distribution_sessions ADD COLUMN source_basket VARCHAR(255) DEFAULT NULL;
