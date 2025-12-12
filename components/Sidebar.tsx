import React, { useState, useEffect } from "react";
import { User as UserType, UserRole } from "../types";
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  Search,
  FileText,
  Briefcase,
  Settings,
  Share2,
  Package,
  BarChart2,
  FileUp,
  Database,
  Menu,
  Home,
  ChevronDown,
  Phone,
  CheckCircle,
  Key,
  ChevronRight,
  Layers,
  Truck,
  Pencil,
  Calendar,
} from "lucide-react";

interface SidebarProps {
  user: UserType;
  activePage: string;
  setActivePage: (page: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  onLogout: () => void;
  permissions?: Record<string, { view?: boolean; use?: boolean }> & { onChangePassword?: () => void };
  menuOrder?: string[];
}

type NavItem = {
  icon: React.ElementType;
  label: string;
  key?: string; // Permission key
  children?: NavItem[];
  allowRule?: (user: UserType) => boolean; // Optional code-level override
  group?: string; // For sorting
};

const Sidebar: React.FC<SidebarProps> = ({
  user,
  activePage,
  setActivePage,
  isCollapsed,
  setIsCollapsed,
  onLogout,
  permissions,
  menuOrder,
}) => {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    "Home": true,
  });
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  // Permission Check: Default to FALSE (Deny All) unless explicitly allowed
  const canView = (key?: string) => {
    if (!key) return true; // Items without key are always visible (unless parent hidden)
    const perm = permissions?.[key];
    // If permission exists, use its view value. If not, default to false (secure by default).
    // EXCEPTION: Super Admin always sees everything (optional, but good for safety)
    if (user.role === UserRole.SuperAdmin) return true;

    return !!perm?.view;
  };

  // Thai translations
  const TH: Record<string, string> = {
    Home: "หน้าแรก",
    "Data Management": "จัดการข้อมูล",
    "Inventory Management": "จัดการสินค้าคงคลัง",
    "Reports Management": "จัดการรายงาน",
    Dashboard: "แดชบอร์ด",
    "Sales Overview": "ภาพรวมการขาย",
    "Calls Overview": "ภาพรวมการโทร",
    "Call Management": "จัดการการโทร",
    Promotions: "โปรโมชั่น",
    Marketing: "การตลาด",
    Users: "ผู้ใช้งาน",
    Permissions: "สิทธิ์การใช้งาน",
    "Role Management": "จัดการ Roles",
    Products: "สินค้า",
    Teams: "ทีม",
    Team: "ทีม",
    Pages: "หน้า",
    Platforms: "แพลตฟอร์ม",
    "Bank Accounts": "จัดการธนาคาร",
    Tags: "แท็ก",
    Orders: "การสั่งซื้อ",
    Customers: "ลูกค้า",
    "Customer Management": "จัดการลูกค้า",
    "Manage Customers": "จัดการลูกค้า",
    "Manage Orders": "จัดการคำสั่งซื้อ",
    Debt: "การติดตามหนี้",
    Reports: "รายงาน",
    "Bulk Tracking": "การติดตามล็อตใหญ่",
    "Export History": "ประวัติการส่งออก",
    "Import Export": "นำเข้า/ส่งออก",
    Share: "แชร์",
    Settings: "การตั้งค่า",
    Search: "ค้นหา",
    Data: "ข้อมูล",
    "Call History": "ประวัติการโทร",
    Companies: "บริษัท",
    Warehouses: "คลังสินค้า",
    "Warehouse Stock": "สต็อกคลัง",
    "Lot Tracking": "การติดตามล็อต",
    "Warehouse Allocation": "การจัดสรรคลัง",
    "Call Details": "รายละเอียดการโทร",
    "Dtac Onecall": "Dtac Onecall",
    "Active Promotions": "โปรโมชั่นที่ใช้งาน",
    "Promotion History": "ประวัติโปรโมชั่น",
    "Create Promotion": "สร้างโปรโมชั่น",
    "Engagement Stats": "สถิติการมีส่วนร่วม",
    "Pancake User Mapping": "Pancake User Mapping",
    "Page Stats": "สถิติหน้า",
    "Page Performance": "ประสิทธิภาพหน้า",
    "Engagement Insights": "ข้อมูลเชิงลึกการมีส่วนร่วม",
    "Customer Pools": "กลุ่มลูกค้า",
    "Slip Uploads": "Upload สลิปโอนเงิน",
    "Slip Upload": "Upload",
    "All Slips": "สลิปทั้งหมด",
    "Finance Approval": "ตรวจสอบยอดเงิน",
    "Statement Management": "จัดการ Statement",
    "Orders & Customers": "คำสั่งซื้อและลูกค้า",
    "COD Management": "จัดการยอด COD",
    "Finance": "การเงิน",
    "Accounting Audit": "ตรวจสอบจากบัญชี",
    "Bank Account Audit": "ตรวจสอบบัญชีธนาคาร",
    "System": "ระบบ",
    "Tracking & Transport": "การติดตามและจัดการขนส่ง",
    "Change Password": "เปลี่ยนรหัสผ่าน",
    "Marketing Dashboard": "แดชบอร์ด (มาร์เก็ตติ้ง)",
    "Ads Input": "กรอกค่า Ads",
    "Ads History": "ประวัติการกรอก Ads",
    "Marketing User Management": "จัดการผู้ใช้การตลาด-เพจ",
  };

  const t = (s: string): string => TH[s] ?? s;

  // MASTER MENU DEFINITION
  const MASTER_MENU: NavItem[] = [
    {
      label: "Home",
      icon: Home,
      children: [
        { label: "Dashboard", icon: LayoutDashboard, key: "home.dashboard" },
        { label: "Sales Overview", icon: LayoutDashboard, key: "home.sales_overview" },
      ]
    },
    {
      label: "Call Management",
      icon: Phone,
      children: [
        { label: "Calls Overview", icon: Phone, key: "calls.overview" },
        { label: "Call Details", icon: Phone, key: "calls.details" },
        { label: "Dtac Onecall", icon: Phone, key: "calls.dtac" },
      ]
    },
    {
      label: "Promotions",
      icon: BarChart2,
      children: [
        { label: "Active Promotions", icon: BarChart2, key: "promo.active" },
        { label: "Promotion History", icon: FileText, key: "promo.history" },
        { label: "Create Promotion", icon: FileUp, key: "promo.create" },
      ]
    },
    // Independent Items (Not in Group) - mapped to top level if permissible
    {
      label: "Orders & Customers",
      icon: Users,
      children: [
        { label: "Orders", icon: ShoppingCart, key: "nav.orders" },
        { label: "Customers", icon: Users, key: "nav.customers" },
        { label: "Manage Orders", icon: ShoppingCart, key: "nav.manage_orders" },
        { label: "Search", icon: Search, key: "nav.search" },
      ]
    },
    {
      label: "Tracking & Transport",
      icon: Truck,
      children: [
        { label: "Debt", icon: FileText, key: "nav.debt" },
        { label: "Bulk Tracking", icon: FileUp, key: "nav.bulk_tracking" },
        { label: "COD Management", icon: FileText, key: "nav.cod_management" },
      ]
    },

    {
      label: "Inventory Management",
      icon: Package,
      children: [
        { label: "Warehouses", icon: Database, key: "inventory.warehouses" },
        { label: "Warehouse Stock", icon: Database, key: "inventory.stock" },
        { label: "Lot Tracking", icon: FileText, key: "inventory.lot" },
        { label: "Warehouse Allocation", icon: FileText, key: "inventory.allocations" },
        { label: "Active Promotions", icon: BarChart2, key: "inventory.promotions" }, // Reused label but distinct key
      ]
    },
    {
      label: "Slip Uploads",
      icon: FileUp,
      children: [
        { label: "Slip Upload", icon: FileUp, key: "payment_slip.upload" },
        { label: "All Slips", icon: FileText, key: "payment_slip.all" },
      ]
    },
    {
      label: "Reports Management",
      icon: BarChart2,
      children: [
        { label: "Reports", icon: BarChart2, key: "reports.reports" }, // Or nav.reports
        { label: "Export History", icon: FileUp, key: "reports.export_history" },
        { label: "Import Export", icon: FileUp, key: "reports.import_export" },
      ]
    },
    {
      label: "Finance",
      icon: CheckCircle,
      children: [
        { label: "Finance Approval", icon: CheckCircle, key: "nav.finance_approval" },
        { label: "Statement Management", icon: FileText, key: "nav.statement_management" },
      ]
    },
    {
      label: "Accounting Audit",
      icon: FileText,
      children: [
        { label: "Bank Account Audit", icon: FileText, key: "accounting.audit.bank" },
      ]
    },
    {
      label: "Data Management",
      icon: Database,
      children: [
        { label: "Users", icon: Users, key: "data.users" },
        { label: "Products", icon: Package, key: "data.products" },
        { label: "Pages", icon: Share2, key: "data.pages" },
        { label: "Platforms", icon: Share2, key: "data.platforms" },
        { label: "Bank Accounts", icon: Database, key: "data.bank_accounts" },
        { label: "Tags", icon: FileText, key: "data.tags" },
        { label: "Companies", icon: Briefcase, key: "data.companies" },
        { label: "Role Management", icon: Key, key: "data.roles" },
      ]
    },
    // Page Stats - Special Group for Marketing/Admins
    {
      label: "Page Stats",
      icon: BarChart2,
      children: [
        { label: "Page Performance", icon: FileText, key: "home.dashboard" }, // Using existing key for now or add specific
        { label: "Engagement Insights", icon: FileText, key: "home.dashboard" },
        { label: "Pancake User Mapping", icon: Users, key: "data.users" }
      ],
      // Allow if any child is visible or special logic
      allowRule: () => user.role === UserRole.SuperAdmin || user.role === UserRole.AdminControl || user.role === UserRole.Marketing
    },
    {
      label: "Marketing",
      icon: BarChart2,
      children: [
        { label: "Marketing Dashboard", icon: BarChart2, key: "marketing.dashboard" },
        { label: "Ads Input", icon: Pencil, key: "marketing.ads_input" },
        { label: "Ads History", icon: Calendar, key: "marketing.ads_history" },
        { label: "Marketing User Management", icon: Users, key: "marketing.user_management" },
      ]
    },
  ];

  // System menu for Change Password (always available if allowed)
  const systemMenu: NavItem = {
    label: "System",
    icon: Settings,
    children: [
      { label: "Change Password", icon: Key, key: "nav.change_password" }
    ]
  };

  const getNavItems = (): NavItem[] => {
    const items = MASTER_MENU.reduce<NavItem[]>((acc, item) => {
      // 1. Check Item Level Permission
      if (item.key && !canView(item.key)) {
        // If it's a direct item and denied, skip
        return acc;
      }

      // 2. Check AllowRule Override
      if (item.allowRule && !item.allowRule(user)) {
        return acc;
      }

      // 3. Handle Group/Children
      if (item.children) {
        const visibleChildren = item.children.filter(child => {
          if (child.key && !canView(child.key)) return false;
          // Additional check for legacy specific roles not having keys mapped yet? 
          // For now, rely on keys.
          return true;
        });

        if (visibleChildren.length > 0) {
          acc.push({
            ...item,
            children: visibleChildren
          });
        }
      } else {
        // No children, simple item
        acc.push(item);
      }

      return acc;
    }, []);

    // 4. Sort if menuOrder is provided
    if (menuOrder && menuOrder.length > 0) {
      return items.sort((a, b) => {
        const indexA = menuOrder.indexOf(a.label);
        const indexB = menuOrder.indexOf(b.label);

        // Items in order list come first, sorted by index
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        // Items in order list come before items not in list
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        // Both not in list? Keep original order (stable sort mostly)
        return 0;
      });
    }

    return items;
  };

  const navItems = getNavItems();

  const renderNavItem = (item: NavItem) => {
    const isGroup = Array.isArray(item.children) && item.children.length > 0;
    const key = item.label;
    const isOpen = !!openGroups[key];

    // Check if active page is this item or inside this group
    const isActive = isGroup
      ? item.children?.some((c) => c.label === activePage)
      : activePage === item.label;

    if (isGroup) {
      return (
        <div key={key}>
          <button
            onClick={() => {
              setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));
            }}
            className={`w-full flex items-center py-2.5 text-sm font-medium rounded-lg transition-colors text-left justify-start ${isCollapsed ? "px-3" : "px-4"
              } ${isActive ? "bg-[#2E7D32] text-white shadow" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"}`}
            title={isCollapsed ? t(item.label) : ""}
          >
            <item.icon
              className={`w-5 h-5 flex-shrink-0 ${!isCollapsed ? "mr-3" : ""}`}
            />
            {!isCollapsed && (
              <>
                <span className="truncate flex-1">{t(item.label)}</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-300 ease-in-out ${isOpen ? "rotate-180" : ""}`}
                />
              </>
            )}
          </button>
          {!isCollapsed && (
            <div
              className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? "max-h-96 opacity-100 mt-1" : "max-h-0 opacity-0"
                }`}
            >
              <div className="ml-2 space-y-1">
                {item.children!.map((child) => (
                  <button
                    key={child.label}
                    onClick={() => {
                      if (child.key && child.key.startsWith('promo.')) {
                        setActivePage(child.key);
                      } else {
                        setActivePage(child.label);
                      }
                    }}
                    className={`w-full flex items-center py-2 text-sm rounded-md text-left justify-start transition-colors ${activePage === child.label
                      ? "bg-green-50 text-green-700"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      } ${isCollapsed ? "px-3" : "pl-10 pr-3"}`}
                    title={isCollapsed ? t(child.label) : ""}
                  >
                    <child.icon
                      className={`w-4 h-4 flex-shrink-0 ${!isCollapsed ? "mr-2" : ""}`}
                    />
                    {!isCollapsed && (
                      <span className="truncate">{t(child.label)}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <button
        key={key}
        onClick={() => setActivePage(item.label)}
        className={`w-full flex items-center py-2.5 text-sm font-medium rounded-lg transition-colors text-left justify-start
              ${isCollapsed ? "px-3" : "px-4"}
              ${activePage === item.label ? "bg-[#2E7D32] text-white shadow" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"}`}
        title={isCollapsed ? t(item.label) : ""}
      >
        <item.icon
          className={`w-5 h-5 flex-shrink-0 ${!isCollapsed ? "mr-3" : ""}`}
        />
        {!isCollapsed && <span className="truncate">{t(item.label)}</span>}
      </button>
    );
  };

  return (
    <div
      className={`bg-[#FFFFFF] text-gray-700 flex flex-col transition-all duration-300 ease-in-out border-r border-gray-200 ${isCollapsed ? "w-20" : "w-64"}`}
    >
      <div className="flex items-center justify-between h-16 border-b border-gray-200 flex-shrink-0 px-4">
        <h1
          className={`text-2xl font-bold text-[#2E7D32] transition-opacity duration-300 ${isCollapsed ? "" : "tracking-wider"}`}
        >
          {isCollapsed ? "E" : "ERP"}
        </h1>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      <div className="text-xs text-gray-400 uppercase tracking-wider px-4 mt-2 mb-2">
        {isCollapsed ? "" : "หน้าหลัก"}
      </div>
      <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
        {navItems.map(renderNavItem)}
      </nav>
      <div className="border-t border-gray-200 mt-auto relative">
        <div className={`p-4 ${isCollapsed ? "items-center justify-center flex" : ""}`}>
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className={`flex items-center w-full hover:bg-gray-50 rounded-lg p-2 transition-colors ${isCollapsed ? "justify-center" : "space-x-3"
              }`}
          >
            <div className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center text-white font-bold flex-shrink-0">
              {user.firstName.charAt(0)}
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden text-left flex-1">
                <p className="font-semibold text-sm text-gray-800 truncate">{`${user.firstName} ${user.lastName}`}</p>
                <p className="text-xs text-gray-500 truncate">
                  {user.role === UserRole.AdminControl
                    ? "Admin Company"
                    : user.role}
                </p>
              </div>
            )}
            {!isCollapsed && (
              <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${isUserMenuOpen ? "rotate-90" : ""}`} />
            )}
          </button>

          {/* User Dropdown */}
          {!isCollapsed && isUserMenuOpen && (
            <div className="absolute bottom-full left-0 w-full mb-1 px-2">
              <div className="bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                <button
                  onClick={() => { permissions?.onChangePassword?.(); setIsUserMenuOpen(false); }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                >
                  <Key className="w-4 h-4" /> เปลี่ยนรหัสผ่าน
                </button>
                <button
                  onClick={onLogout}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  ออกจากระบบ
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
