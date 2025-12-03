#!/usr/bin/env bash
set -euo pipefail

# Required env: DB_NAME, DB_USER, DB_PASS
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"

: "${DB_NAME:?DB_NAME is required}"
: "${DB_USER:?DB_USER is required}"
: "${DB_PASS:?DB_PASS is required}"

mysql -h "$DB_HOST" -P "$DB_PORT" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" <<'SQL'
-- Move expired customers into waiting
UPDATE customers
SET is_in_waiting_basket = 1,
    waiting_basket_start_date = NOW(),
    lifecycle_status = 'FollowUp'
WHERE COALESCE(is_blocked,0) = 0
  AND COALESCE(is_in_waiting_basket,0) = 0
  AND ownership_expires IS NOT NULL
  AND ownership_expires <= NOW();

-- Release customers that have been waiting for >= 30 days back to ready
UPDATE customers
SET is_in_waiting_basket = 0,
    waiting_basket_start_date = NULL,
    ownership_expires = DATE_ADD(NOW(), INTERVAL 30 DAY),
    lifecycle_status = 'DailyDistribution',
    follow_up_count = 0,
    followup_bonus_remaining = 1,
    assigned_to = NULL
WHERE COALESCE(is_in_waiting_basket,0) = 1
  AND waiting_basket_start_date IS NOT NULL
  AND TIMESTAMPDIFF(DAY, waiting_basket_start_date, NOW()) >= 30
  AND COALESCE(is_blocked,0) = 0;
SQL

