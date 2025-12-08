import React, { useState } from "react";
import { User as UserType, UserRole } from "../types";
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  Search,
  FileText,
  Briefcase,
  Settings,
  LogOut,
  Share2,
  Package,
  BarChart2,
  FileUp,
  UserPlus,
  Database,
  Menu,
  Home,
  ChevronDown,
  Phone,
  CheckCircle,
  DollarSign,
} from "lucide-react";
interface SidebarProps {
  user: UserType;
  activePage: string;
  setActivePage: (page: string) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  onLogout: () => void;
  permissions?: Record<string, { view?: boolean; use?: boolean }>;
}

type NavItem = { icon: React.ElementType; label: string; children?: NavItem[] };

const HOME_GROUP = "Home";
const SALES_OVERVIEW = "Sales Overview";
const CALLS_OVERVIEW = "Calls Overview";
const DATA_MGMT = "Data Management";
const INVENTORY_MGMT = "Inventory Management";
const REPORTS_MGMT = "Reports Management";
const PAGE_STATS = "Page Stats";
const PAGE_STATS_OVERVIEW = "Page Performance";
const PAGE_ENGAGEMENT_STATS = "Engagement Insights";
const CALL_MGMT = "Call Management";
const PROMO_MGMT = "Promotions";
const PAYMENT_SLIP_MGMT = "Slip Uploads";
const PAYMENT_SLIP_UPLOAD = "Slip Upload";
const PAYMENT_SLIP_ALL = "All Slips";


const Sidebar: React.FC<SidebarProps> = ({
  user,
  activePage,
  setActivePage,
  isCollapsed,
  setIsCollapsed,
  onLogout,
  permissions,
}) => {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    [HOME_GROUP]: true,
  });

  const canView = (key: string) => {
    const perm = permissions?.[key];
    if (perm && perm.view === false) return false;
    return true;
  };

  // Thai translations (UTF-8)
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
    Upload: "Upload",
    "All Slips": "สลิปทั้งหมด",
  };

  const t = (s: string): string => TH[s] ?? s;

  const homeChildren: NavItem[] = [
    ...(canView("home.dashboard")
      ? ([{ icon: LayoutDashboard, label: "Dashboard" }] as NavItem[])
      : []),
    ...(canView("home.sales_overview")
      ? ([{ icon: LayoutDashboard, label: SALES_OVERVIEW }] as NavItem[])
      : []),
  ];
  const homeGroup: NavItem = {
    icon: Home,
    label: HOME_GROUP,
    children: homeChildren,
  };

  // Call Management group (dropdown)
  const callChildren: NavItem[] = [
    ...(canView("calls.overview")
      ? ([{ icon: Phone, label: CALLS_OVERVIEW }] as NavItem[])
      : []),
    ...(canView("calls.details")
      ? ([{ icon: Phone, label: "Call Details" }] as NavItem[])
      : []),
    ...(canView("calls.dtac")
      ? ([{ icon: Phone, label: "Dtac Onecall" }] as NavItem[])
      : []),
  ];
  const callGroup: NavItem = {
    icon: Phone,
    label: CALL_MGMT,
    children: callChildren,
  };

  // Promotions Management group
  const promoChildren: NavItem[] = [
    ...(canView("promo.active")
      ? ([{ icon: BarChart2, label: "Active Promotions" }] as NavItem[])
      : []),
    ...(canView("promo.history")
      ? ([{ icon: FileText, label: "Promotion History" }] as NavItem[])
      : []),
    ...(canView("promo.create")
      ? ([{ icon: FileUp, label: "Create Promotion" }] as NavItem[])
      : []),
  ];
  const promoGroup: NavItem = {
    icon: BarChart2,
    label: PROMO_MGMT,
    children: promoChildren,
  };

  // Payment Slip Upload group
  const paymentSlipChildren: NavItem[] = [
    ...(canView("payment_slip.upload")
      ? ([{ icon: FileUp, label: PAYMENT_SLIP_UPLOAD }] as NavItem[])
      : []),
    ...(canView("payment_slip.all")
      ? ([{ icon: FileText, label: PAYMENT_SLIP_ALL }] as NavItem[])
      : []),

  ];
  const paymentSlipGroup: NavItem = {
    icon: FileUp,
    label: PAYMENT_SLIP_MGMT,
    children: paymentSlipChildren,
  };

  const allowDataItem = (key: string) => {
    if (user.role === UserRole.AdminControl) {
      return (
        key === "data.users" ||
        key === "data.products" ||
        key === "data.pages" ||
        key === "data.platforms" ||
        key === "data.bank_accounts" ||
        key === "data.tags"
      );
    }
    return true;
  };

  const dataChildren: NavItem[] = [
    ...(allowDataItem("data.users") && canView("data.users")
      ? ([{ icon: Users, label: "Users" }] as NavItem[])
      : []),
    ...(allowDataItem("data.products") && canView("data.products")
      ? ([{ icon: Package, label: "Products" }] as NavItem[])
      : []),
    ...(allowDataItem("data.permissions") && canView("data.permissions")
      ? ([{ icon: Settings, label: "Permissions" }] as NavItem[])
      : []),
    ...(allowDataItem("data.teams") && canView("data.teams")
      ? ([{ icon: Briefcase, label: "Teams" }] as NavItem[])
      : []),
    ...(allowDataItem("data.pages") && canView("data.pages")
      ? ([{ icon: Share2, label: "Pages" }] as NavItem[])
      : []),
    ...(allowDataItem("data.platforms") && canView("data.platforms")
      ? ([{ icon: Share2, label: "Platforms" }] as NavItem[])
      : []),
    ...(allowDataItem("data.bank_accounts") && canView("data.bank_accounts")
      ? ([{ icon: Database, label: "Bank Accounts" }] as NavItem[])
      : []),
    ...(allowDataItem("data.tags") && canView("data.tags")
      ? ([{ icon: FileText, label: "Tags" }] as NavItem[])
      : []),
    ...(allowDataItem("data.companies") && canView("data.companies")
      ? ([{ icon: Briefcase, label: "Companies" }] as NavItem[])
      : []),
  ];
  const dataGroup: NavItem = {
    icon: Database,
    label: DATA_MGMT,
    children: dataChildren,
  };

  const inventoryChildren: NavItem[] = [
    ...(canView("inventory.warehouses")
      ? ([{ icon: Database, label: "Warehouses" }] as NavItem[])
      : []),
    ...(canView("inventory.stock")
      ? ([{ icon: Database, label: "Warehouse Stock" }] as NavItem[])
      : []),
    ...(canView("inventory.lot")
      ? ([{ icon: FileText, label: "Lot Tracking" }] as NavItem[])
      : []),
    ...(canView("inventory.allocations")
      ? ([{ icon: FileText, label: "Warehouse Allocation" }] as NavItem[])
      : []),
    ...(canView("inventory.promotions")
      ? ([{ icon: BarChart2, label: "Active Promotions" }] as NavItem[])
      : []),
  ];
  const inventoryGroup: NavItem = {
    icon: Package,
    label: INVENTORY_MGMT,
    children: inventoryChildren,
  };

  const reportsChildren: NavItem[] = [
    ...(canView("reports.export_history")
      ? ([{ icon: FileUp, label: "Export History" }] as NavItem[])
      : []),
    ...(canView("reports.import_export")
      ? ([{ icon: FileUp, label: "Import Export" }] as NavItem[])
      : []),
    ...(canView("reports.reports")
      ? ([{ icon: BarChart2, label: "Reports" }] as NavItem[])
      : []),
  ];
  const reportsGroup: NavItem = {
    icon: BarChart2,
    label: REPORTS_MGMT,
    children: reportsChildren,
  };

  // Reports group for Backoffice
  const backofficeReportsChildren: NavItem[] = [
    ...(canView("nav.reports")
      ? ([{ icon: BarChart2, label: "Reports" }] as NavItem[])
      : []),
    ...(canView("reports.export_history")
      ? ([{ icon: FileUp, label: "Export History" }] as NavItem[])
      : []),
  ];
  const backofficeReportsGroup: NavItem = {
    icon: BarChart2,
    label: REPORTS_MGMT,
    children: backofficeReportsChildren,
  };

  // Customers group (dropdown)
  const customersGroup: NavItem = {
    icon: Users,
    label: "Customer Management",
    children: [
      { icon: Users, label: "Customers" },
      { icon: Users, label: "Manage Customers" },
      { icon: Share2, label: "Share" },
    ],
  };
  // Fixed customers submenu with clear labels that route correctly
  const customersGroupFixed = {
    icon: Users,
    label: "Customer Management",
    children: [
      { icon: Users, label: "Customers" },
      { icon: Users, label: "Manage Customers" },
      { icon: Share2, label: "Share" },
    ],
  } as NavItem;

  const getNavItems = (): NavItem[] => {
    switch (user.role) {
      case UserRole.Marketing:
        return [homeGroup, { icon: BarChart2, label: "Marketing" }];
      case UserRole.SuperAdmin:
        return [
          homeGroup,
          dataGroup,
          inventoryGroup,
          reportsGroup,
          {
            icon: BarChart2,
            label: PAGE_STATS,
            children: [
              { icon: FileText, label: PAGE_STATS_OVERVIEW },
              { icon: FileText, label: PAGE_ENGAGEMENT_STATS },
            ],
          },
          { icon: BarChart2, label: "Marketing" },
          customersGroupFixed,
          callGroup,
          paymentSlipGroup,
          { icon: Settings, label: "Settings" },
        ];
      case UserRole.AdminControl:
        return [
          homeGroup,
          dataGroup,
          inventoryGroup,
          reportsGroup,
          {
            icon: BarChart2,
            label: PAGE_STATS,
            children: [
              { icon: FileText, label: PAGE_STATS_OVERVIEW },
              { icon: FileText, label: PAGE_ENGAGEMENT_STATS },
            ],
          },
          customersGroupFixed,
          callGroup,
          paymentSlipGroup,
          { icon: Settings, label: "Settings" },
          { icon: BarChart2, label: "Marketing" },
        ];
      case UserRole.Admin:
        return [
          homeGroup,
          ...(canView("nav.orders")
            ? ([{ icon: ShoppingCart, label: "Orders" }] as NavItem[])
            : []),
          ...(canView("nav.search")
            ? ([{ icon: Search, label: "Search" }] as NavItem[])
            : []),
          paymentSlipGroup,
        ];
      case UserRole.Telesale:
      case UserRole.Supervisor: {
        const telesaleItems: NavItem[] = [
          homeGroup,
          ...(canView("nav.customers")
            ? ([{ icon: Users, label: "Customers" }] as NavItem[])
            : []),
          ...(canView("nav.orders")
            ? ([{ icon: ShoppingCart, label: "Orders" }] as NavItem[])
            : []),
          ...(canView("nav.search")
            ? ([{ icon: Search, label: "Search" }] as NavItem[])
            : []),
          paymentSlipGroup,
          callGroup,
        ];
        if (user.role === UserRole.Supervisor) {
          telesaleItems.push({ icon: Briefcase, label: "Team" });
        }
        return telesaleItems;
      }
      case UserRole.Backoffice:
        return [
          homeGroup,
          ...(canView("nav.manage_orders")
            ? ([{ icon: ShoppingCart, label: "Manage Orders" }] as NavItem[])
            : []),
          ...(canView("nav.debt")
            ? ([{ icon: FileText, label: "Debt" }] as NavItem[])
            : []),
          inventoryGroup,
          ...(canView("nav.search")
            ? ([{ icon: Search, label: "Search" }] as NavItem[])
            : []),
          ...(canView("nav.reports") || canView("reports.export_history")
            ? ([backofficeReportsGroup] as NavItem[])
            : []),
          ...(canView("nav.bulk_tracking")
            ? ([{ icon: FileUp, label: "Bulk Tracking" }] as NavItem[])
            : []),
          ...(canView("nav.cod_management")
            ? ([{ icon: FileText, label: "COD Management" }] as NavItem[])
            : []),
          ...(user.role === UserRole.Backoffice && canView("nav.statement_management")
            ? ([{ icon: FileText, label: "Statement Management" }] as NavItem[])
            : []),
          paymentSlipGroup,
        ];
      case UserRole.Finance:
        return [
          homeGroup,
          { icon: CheckCircle, label: "Finance Approval" },
          ...(canView("nav.search")
            ? ([{ icon: Search, label: "Search" }] as NavItem[])
            : []),
        ];
      default:
        return [homeGroup];
    }
  };

  const navItems = getNavItems();
  // Ensure 'Pancake User Mapping' appears under the single 'PAGE_STATS' group only
  try {
    const statsGroup = navItems.find(
      (it) => it.label === PAGE_STATS && Array.isArray((it as any).children),
    ) as any;
    if (statsGroup && Array.isArray(statsGroup.children)) {
      const exists = statsGroup.children.some(
        (c: any) => c && c.label === "Pancake User Mapping",
      );
      if (!exists) {
        statsGroup.children.push({
          icon: Users,
          label: "Pancake User Mapping",
        });
      }
    }
  } catch { }

  const renderNavItem = (item: NavItem) => {
    const isGroup = Array.isArray(item.children);
    const isOpen = !!openGroups[item.label];
    // Check if this group is active (either the group itself or any of its children)
    const isActive = isGroup
      ? item.children?.some((c) => c.label === activePage)
      : activePage === item.label;

    if (isGroup) {
      return (
        <div key={item.label}>
          <button
            onClick={() => {
              // Close all other groups and open only this one
              const newOpenState: Record<string, boolean> = {};
              newOpenState[item.label] = !openGroups[item.label];
              setOpenGroups(newOpenState);

              // Don't set active page to this main menu - only highlight it visually
              // setActivePage(item.label);
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
                    onClick={() => setActivePage(child.label)}
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
        key={item.label}
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
      <nav className="flex-1 px-4 py-2 space-y-1">
        {navItems.map(renderNavItem)}
      </nav>
      <div className="px-4 py-4 border-t border-gray-200 mt-auto">
        <div
          className={`flex items-center mb-4 ${isCollapsed ? "justify-center" : ""}`}
        >
          {!isCollapsed && (
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-600 mr-3">
              {user.firstName.charAt(0)}
            </div>
          )}
          {!isCollapsed && (
            <div>
              <p className="font-semibold text-sm text-gray-800">{`${user.firstName} ${user.lastName}`}</p>
              <p className="text-xs text-gray-500">
                {user.role === UserRole.AdminControl ? "Admin Company" : user.role}
              </p>
            </div>
          )}
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center p-2.5 text-sm font-medium rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 text-left"
        >
          <LogOut
            className={`w-5 h-5 flex-shrink-0 ${isCollapsed ? "" : "mr-3"}`}
          />
          {!isCollapsed && "ออกจากระบบ"}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
