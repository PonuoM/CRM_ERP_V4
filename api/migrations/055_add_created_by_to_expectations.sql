-- 049: Audit trail -- record WHO scheduled each expected-arrival entry
-- (plan creator = stock_arrival_plans.created_by, confirmer = expectations.confirmed_by มีอยู่แล้ว
--  ขาดแค่คนกำหนดวันคาดว่าจะเข้า)
ALTER TABLE stock_arrival_plan_expectations
  ADD COLUMN created_by INT NULL DEFAULT NULL AFTER note;
