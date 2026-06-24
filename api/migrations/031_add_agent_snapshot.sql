-- 031_add_agent_snapshot.sql

ALTER TABLE distribution_sessions ADD COLUMN agent_snapshot LONGTEXT DEFAULT NULL;
