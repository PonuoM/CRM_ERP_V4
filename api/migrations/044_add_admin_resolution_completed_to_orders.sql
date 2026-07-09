ALTER TABLE orders ADD COLUMN admin_resolution_completed TINYINT(1) NOT NULL DEFAULT 0 AFTER admin_resolution_notes;
