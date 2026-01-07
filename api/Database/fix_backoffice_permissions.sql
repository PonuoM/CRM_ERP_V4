-- ============================================================================
-- Fix Backoffice Role Permissions
-- เอาเมนู Finance ออกจาก Backoffice (ไม่ควรมี)
-- ============================================================================

UPDATE `role_permissions`
SET `data` = '{
  "permissions": {
    "home.dashboard": {"view":true,"use":true},
    "nav.manage_orders": {"view":true,"use":true},
    "nav.search": {"view":true,"use":true},
    "nav.debt": {"view":true,"use":true},
    "nav.bulk_tracking": {"view":true,"use":true},
    "nav.cod_management": {"view":true,"use":true},
    "inventory.warehouses": {"view":true,"use":true},
    "inventory.stock": {"view":true,"use":true},
    "inventory.lot": {"view":true,"use":true},
    "inventory.allocations": {"view":true,"use":true},
    "payment_slip.all": {"view":true,"use":true},
    "reports.reports": {"view":true,"use":true},
    "reports.export_history": {"view":true,"use":true},
    "nav.statement_management": {"view":true,"use":true}
  },
  "menu_order": ["Home","Orders & Customers","Tracking & Transport","Inventory Management","Slip Management","Reports","Data Management","System"]
}'
WHERE `role` = 'Backoffice';

-- หรือถ้า role เป็น lowercase:
UPDATE `role_permissions`
SET `data` = '{
  "permissions": {
    "home.dashboard": {"view":true,"use":true},
    "nav.manage_orders": {"view":true,"use":true},
    "nav.search": {"view":true,"use":true},
    "nav.debt": {"view":true,"use":true},
    "nav.bulk_tracking": {"view":true,"use":true},
    "nav.cod_management": {"view":true,"use":true},
    "inventory.warehouses": {"view":true,"use":true},
    "inventory.stock": {"view":true,"use":true},
    "inventory.lot": {"view":true,"use":true},
    "inventory.allocations": {"view":true,"use":true},
    "payment_slip.all": {"view":true,"use":true},
    "reports.reports": {"view":true,"use":true},
    "reports.export_history": {"view":true,"use":true},
    "nav.statement_management": {"view":true,"use":true}
  },
  "menu_order": ["Home","Orders & Customers","Tracking & Transport","Inventory Management","Slip Management","Reports","Data Management","System"]
}'
WHERE `role` = 'backoffice';

-- ============================================================================
-- ตรวจสอบผลลัพธ์
-- ============================================================================
-- SELECT role, data FROM role_permissions WHERE role IN ('Backoffice', 'backoffice');
