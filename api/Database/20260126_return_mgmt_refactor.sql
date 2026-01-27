ALTER TABLE order_boxes
ADD COLUMN return_status VARCHAR(50) COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT 'Status for return process' AFTER status,
ADD COLUMN return_note TEXT COLLATE utf8mb4_unicode_ci NULL COMMENT 'Note for return process' AFTER return_status,
ADD COLUMN return_created_at DATETIME NULL DEFAULT NULL AFTER return_note;

-- Migrate data from order_returns to order_boxes
-- We match on sub_order_id.
UPDATE order_boxes ob
JOIN order_returns orr ON ob.sub_order_id = orr.sub_order_id
SET ob.return_status = orr.status,
    ob.return_note = orr.note,
    ob.return_created_at = orr.created_at;
