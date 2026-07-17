-- 036_add_general_notes_to_price_announcements.sql
-- Free-form, multi-line general notes for the price-tier table (e.g. shirt redemption rules),
-- separate from per-tier notes and from the bill-discount block notes.

ALTER TABLE `price_announcements`
  ADD COLUMN `general_notes` TEXT NULL AFTER `title`;
