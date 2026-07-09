-- 046: SO number belongs to the arrival-scheduler step, not the planner step
-- ตอนแพลนยังไม่รู้เลข SO (คนแพลนไม่รู้) -- คนกำหนดวันที่คาดว่าจะเข้าเป็นคนเปิด SO จริง จึงย้าย so_number ไปอยู่ที่ expectation แทน item
-- (so_number บน items ไม่มีข้อมูลจริงอยู่แล้ว ณ วันที่ migrate นี้ -- ตรวจสอบแล้วเป็น NULL ทั้งหมด)

ALTER TABLE stock_arrival_plan_items
  DROP COLUMN so_number;

ALTER TABLE stock_arrival_plan_expectations
  ADD COLUMN so_number VARCHAR(64) NULL DEFAULT NULL AFTER expected_date;
