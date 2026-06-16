-- Migration 029: Set timeout for upsell basket and fix transition_type enum schema mismatch
-- Created: 2026-06-16

-- 1. Add 'picking_upsell_return_39' to the transition_type enum in basket_transition_log
ALTER TABLE basket_transition_log MODIFY COLUMN transition_type ENUM(
  'sale',
  'fail',
  'monthly_cron',
  'manual',
  'redistribute',
  'pending_admin_owned',
  'pending_admin_unowned',
  'picking_upsell_sold',
  'picking_upsell_not_sold',
  'picking_upsell_return_39',
  'picking_dist_to_pool',
  'picking_telesale_own',
  'picking_admin_to_upsell',
  'picking_telesale_from_dist',
  'picking_admin_no_owner',
  'aging_timeout',
  'upsell_by_others',
  'upsell_exit',
  'upsell_distribution',
  'distribute',
  'reclaim',
  'transfer'
) NOT NULL;

-- 2. Configure fail_after_days for the upsell basket (51) to 30 days
UPDATE basket_config SET fail_after_days = 30 WHERE basket_key = 'upsell';
