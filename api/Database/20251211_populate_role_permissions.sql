-- ============================================================================
-- Migration: Populate Initial Role Permissions
-- File: 20251211_populate_role_permissions.sql
-- Description: 
--   1. Updates `role_permissions` table for existing roles to match "legacy" hardcoded logic.
--   2. Ensures the Permission Editor UI reflects the actual capabilities of each role.
-- ============================================================================

-- 1. SUPER ADMIN & ADMIN CONTROL (All Permissions)
UPDATE `role_permissions`
SET `data` = JSON_OBJECT(
    'home.dashboard', JSON_OBJECT('view', true, 'use', true),
    'home.sales_overview', JSON_OBJECT('view', true, 'use', true),
    
    'calls.overview', JSON_OBJECT('view', true, 'use', true),
    'calls.details', JSON_OBJECT('view', true, 'use', true),
    'calls.dtac', JSON_OBJECT('view', true, 'use', true),
    
    'promo.active', JSON_OBJECT('view', true, 'use', true),
    'promo.history', JSON_OBJECT('view', true, 'use', true),
    'promo.create', JSON_OBJECT('view', true, 'use', true),
    
    'nav.orders', JSON_OBJECT('view', true, 'use', true),
    'nav.customers', JSON_OBJECT('view', true, 'use', true),
    'nav.manage_orders', JSON_OBJECT('view', true, 'use', true),
    'nav.search', JSON_OBJECT('view', true, 'use', true),
    'nav.debt', JSON_OBJECT('view', true, 'use', true),
    'nav.bulk_tracking', JSON_OBJECT('view', true, 'use', true),
    'nav.cod_management', JSON_OBJECT('view', true, 'use', true),
    
    'inventory.warehouses', JSON_OBJECT('view', true, 'use', true),
    'inventory.stock', JSON_OBJECT('view', true, 'use', true),
    'inventory.lot', JSON_OBJECT('view', true, 'use', true),
    'inventory.allocations', JSON_OBJECT('view', true, 'use', true),
    'inventory.promotions', JSON_OBJECT('view', true, 'use', true),
    
    'payment_slip.upload', JSON_OBJECT('view', true, 'use', true),
    'payment_slip.all', JSON_OBJECT('view', true, 'use', true),
    
    'nav.reports', JSON_OBJECT('view', true, 'use', true),
    'reports.reports', JSON_OBJECT('view', true, 'use', true),
    'reports.export_history', JSON_OBJECT('view', true, 'use', true),
    'reports.import_export', JSON_OBJECT('view', true, 'use', true),
    
    'nav.finance_approval', JSON_OBJECT('view', true, 'use', true),
    'nav.statement_management', JSON_OBJECT('view', true, 'use', true),
    
    'data.users', JSON_OBJECT('view', true, 'use', true),
    'data.products', JSON_OBJECT('view', true, 'use', true),
    'data.teams', JSON_OBJECT('view', true, 'use', true),
    'data.pages', JSON_OBJECT('view', true, 'use', true),
    'data.platforms', JSON_OBJECT('view', true, 'use', true),
    'data.bank_accounts', JSON_OBJECT('view', true, 'use', true),
    'data.tags', JSON_OBJECT('view', true, 'use', true),
    'data.companies', JSON_OBJECT('view', true, 'use', true),
    'data.roles', JSON_OBJECT('view', true, 'use', true),
    'system.settings', JSON_OBJECT('view', true, 'use', true)
)
WHERE `role` IN ('super_admin', 'admin_control');

-- 2. TELESALE & SUPERVISOR (Sales Focused)
UPDATE `role_permissions`
SET `data` = JSON_OBJECT(
    'home.dashboard', JSON_OBJECT('view', true, 'use', true),
    'nav.customers', JSON_OBJECT('view', true, 'use', true),
    'nav.orders', JSON_OBJECT('view', true, 'use', true),
    'nav.search', JSON_OBJECT('view', true, 'use', true),
    'payment_slip.upload', JSON_OBJECT('view', true, 'use', true),
    'payment_slip.all', JSON_OBJECT('view', true, 'use', true),
    'calls.overview', JSON_OBJECT('view', true, 'use', true),
    'calls.details', JSON_OBJECT('view', true, 'use', true)
)
WHERE `role` IN ('telesale', 'supervisor_telesale');

-- 3. BACKOFFICE (Operations)
UPDATE `role_permissions`
SET `data` = JSON_OBJECT(
    'home.dashboard', JSON_OBJECT('view', true, 'use', true),
    'nav.manage_orders', JSON_OBJECT('view', true, 'use', true),
    'nav.debt', JSON_OBJECT('view', true, 'use', true),
    'nav.search', JSON_OBJECT('view', true, 'use', true),
    'nav.bulk_tracking', JSON_OBJECT('view', true, 'use', true),
    'nav.cod_management', JSON_OBJECT('view', true, 'use', true),
    'nav.statement_management', JSON_OBJECT('view', true, 'use', true),
    
    'inventory.warehouses', JSON_OBJECT('view', true, 'use', true),
    'inventory.stock', JSON_OBJECT('view', true, 'use', true),
    'inventory.lot', JSON_OBJECT('view', true, 'use', true),
    'inventory.allocations', JSON_OBJECT('view', true, 'use', true),
    
    'nav.reports', JSON_OBJECT('view', true, 'use', true),
    'reports.reports', JSON_OBJECT('view', true, 'use', true),
    'reports.export_history', JSON_OBJECT('view', true, 'use', true),
    
    'payment_slip.all', JSON_OBJECT('view', true, 'use', true)
)
WHERE `role` = 'backoffice';

-- 4. FINANCE (Finance Only)
UPDATE `role_permissions`
SET `data` = JSON_OBJECT(
    'home.dashboard', JSON_OBJECT('view', true, 'use', false),
    'nav.finance_approval', JSON_OBJECT('view', true, 'use', true),
    'nav.search', JSON_OBJECT('view', true, 'use', true),
    'nav.statement_management', JSON_OBJECT('view', true, 'use', true)
)
WHERE `role` = 'finance';

-- 5. MARKETING (Marketing Tools)
UPDATE `role_permissions`
SET `data` = JSON_OBJECT(
    'home.dashboard', JSON_OBJECT('view', true, 'use', true),
    'home.sales_overview', JSON_OBJECT('view', true, 'use', true),
    'promo.active', JSON_OBJECT('view', true, 'use', true),
    'promo.history', JSON_OBJECT('view', true, 'use', true),
    'promo.create', JSON_OBJECT('view', true, 'use', true)
)
WHERE `role` = 'marketing';

-- 6. ADMIN PAGE (Page Manager)
UPDATE `role_permissions`
SET `data` = JSON_OBJECT(
    'home.dashboard', JSON_OBJECT('view', true, 'use', true),
    'nav.orders', JSON_OBJECT('view', true, 'use', true),
    'nav.search', JSON_OBJECT('view', true, 'use', true),
    'payment_slip.all', JSON_OBJECT('view', true, 'use', true)
)
WHERE `role` = 'admin_page';

