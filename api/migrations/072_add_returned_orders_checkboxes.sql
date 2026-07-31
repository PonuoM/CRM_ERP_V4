ALTER TABLE order_audio_resolutions
ADD COLUMN is_new_order_created TINYINT(1) DEFAULT 0,
ADD COLUMN is_partially_returned TINYINT(1) DEFAULT 0;
