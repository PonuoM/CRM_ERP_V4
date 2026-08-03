ALTER TABLE customers
ADD COLUMN original_source VARCHAR(100) DEFAULT NULL AFTER current_basket_key;

-- Insert customized Marketplace Baskets
INSERT INTO basket_config (
    basket_key, basket_name, target_page, display_order, is_active, company_id,
    on_sale_basket_key, on_fail_basket_key, fail_after_days,
    hold_days_before_redistribute, linked_basket_key, 
    extend_days_per_appointment, max_extend_appointments
) VALUES 
(
    'marketplace_dis', 'Marketplace', 'distribution', 98, 1, 1,
    'personal_1_2m', NULL, NULL,
    30, 'marketplace_dash',
    0, NULL
),
(
    'marketplace_dash', 'Marketplace', 'dashboard_v2', 99, 1, 1,
    'personal_1_2m', 'marketplace_dis', 29,
    0, 'marketplace_dis',
    30, 2
);
