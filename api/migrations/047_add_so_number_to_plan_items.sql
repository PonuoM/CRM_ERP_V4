-- 045: SO number per plan item (แพลนวันเดียวกันอาจมีหลาย SO หรือ SO เดียวกันซ้ำได้)
ALTER TABLE stock_arrival_plan_items
  ADD COLUMN so_number VARCHAR(64) NULL DEFAULT NULL AFTER product_id;
