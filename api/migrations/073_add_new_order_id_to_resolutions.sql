ALTER TABLE order_audio_resolutions
ADD COLUMN new_order_id VARCHAR(32) DEFAULT NULL AFTER is_partially_returned;
