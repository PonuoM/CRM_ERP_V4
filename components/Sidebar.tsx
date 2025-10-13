import React, { useState } from 'react';
import { User as UserType, UserRole } from '../types';
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
} from 'lucide-react';

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

const HOME_GROUP = 'Home';
const SALES_OVERVIEW = 'Sales Overview';
const CALLS_OVERVIEW = 'Calls Overview';
const DATA_MGMT = 'Data Management';
const INVENTORY_MGMT = 'Inventory Management';

const Sidebar: React.FC<SidebarProps> = ({ user, activePage, setActivePage, isCollapsed, setIsCollapsed, onLogout, permissions }) => {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ [HOME_GROUP]: true });

  const canView = (key: string) => {
    const perm = permissions?.[key];
    if (perm && perm.view === false) return false;
    return true;
  };

  const t = (s: string): string => {
    switch (s) {
      case 'Home': return 'หน้าหลัก';
      case 'Data Management': return 'จัดการข้อมูล';
      case 'Inventory Management': return 'จัดการสินค้าและคลัง';
      case 'Dashboard': return 'แดชบอร์ด';
      case 'Sales Overview': return 'ภาพรวมการขาย';
      case 'Calls Overview': return 'ภาพรวมการโทร';
      case 'Marketing': return 'การตลาด';
      case 'Users': return 'ผู้ใช้งาน';
      case 'Permissions': return 'สิทธิ์การใช้งาน';
      case 'Products': return 'สินค้า';
      case 'Teams': return 'ทีม';
      case 'Team': return 'ทีม';
      case 'Pages': return 'เพจ';
      case 'Tags': return 'แท็ก';
      case 'Orders': return 'คำสั่งซื้อ';
      case 'Customers': return 'ลูกค้า';
      case 'Manage Orders': return 'จัดการคำสั่งซื้อ';
      case 'Debt': return 'ติดตามหนี้';
      case 'Reports': return 'รายงาน';
      case 'Bulk Tracking': return 'บันทึกเลขพัสดุ';
      case 'Share': return 'แชร์';
      case 'Settings': return 'การตั้งค่า';
      case 'Search': return 'ค้นหา';
      case 'Data': return '??????';
      case 'Call History': return '?????????????';
      case 'Companies': return 'บริษัท';
      case 'Warehouses': return 'คลังสินค้า';
      case 'Warehouse Stock': return 'สต็อกคลังสินค้า';
      case 'Lot Tracking': return 'ติดตาม Lot';
      default: return s;
    }
  };

  const homeChildren: NavItem[] = [
    ...(canView('home.dashboard') ? [{ icon: LayoutDashboard, label: 'แดชบอร์ด' }] as NavItem[] : []),
    ...(canView('home.sales_overview') ? [{ icon: LayoutDashboard, label: SALES_OVERVIEW }] as NavItem[] : []),
    ...(canView('home.calls_overview') ? [{ icon: Phone, label: CALLS_OVERVIEW }] as NavItem[] : []),
  ];
  const homeGroup: NavItem = {
    icon: Home,
    label: HOME_GROUP,
    children: homeChildren,
  };

  const dataChildren: NavItem[] = [
    ...(canView('data.users') ? [{ icon: Users, label: 'Users' }] as NavItem[] : []),
    ...(canView('data.permissions') ? [{ icon: Settings, label: 'Permissions' }] as NavItem[] : []),
    ...(canView('data.teams') ? [{ icon: Briefcase, label: 'Teams' }] as NavItem[] : []),
    ...(canView('data.pages') ? [{ icon: Share2, label: 'Pages' }] as NavItem[] : []),
    ...(canView('data.tags') ? [{ icon: FileText, label: 'Tags' }] as NavItem[] : []),
    ...(canView('data.companies') ? [{ icon: Briefcase, label: 'Companies' }] as NavItem[] : []),
  ];
  const dataGroup: NavItem = {
    icon: Database,
    label: DATA_MGMT,
    children: dataChildren,
  };

  const inventoryChildren: NavItem[] = [
    ...(canView('inventory.products') ? [{ icon: Package, label: 'Products' }] as NavItem[] : []),
    ...(canView('inventory.warehouses') ? [{ icon: Database, label: 'Warehouses' }] as NavItem[] : []),
    ...(canView('inventory.stock') ? [{ icon: Database, label: 'Warehouse Stock' }] as NavItem[] : []),
    ...(canView('inventory.lot') ? [{ icon: FileText, label: 'Lot Tracking' }] as NavItem[] : []),
  ];
  const inventoryGroup: NavItem = {
    icon: Package,
    label: INVENTORY_MGMT,
    children: inventoryChildren,
  };

  const getNavItems = (): NavItem[] => {
    switch (user.role) {
      case UserRole.Marketing:
        return [homeGroup, { icon: BarChart2, label: 'Marketing' }];
      case UserRole.SuperAdmin:
        return [
          homeGroup,
          dataGroup,
          inventoryGroup,
          { icon: Share2, label: 'Share' },
          { icon: Settings, label: 'Settings' },
          { icon: Search, label: 'Search' },
          { icon: Database, label: 'Data' },
          { icon: Phone, label: 'Dtac Onecall' },
        ];
      case UserRole.AdminControl:
        return [
          homeGroup,
          { icon: Share2, label: 'Share' },
          { icon: Settings, label: 'Settings' },
          { icon: Search, label: 'Search' },
          { icon: Database, label: 'Data' },
          { icon: Phone, label: 'Dtac Onecall' },
        ];
      case UserRole.Admin:
        return [
          homeGroup,
          ...(canView('nav.orders') ? [{ icon: ShoppingCart, label: 'Orders' }] as NavItem[] : []),
          ...(canView('nav.search') ? [{ icon: Search, label: 'Search' }] as NavItem[] : []),
          { icon: Phone, label: 'Dtac Onecall' },
        ];
      case UserRole.Telesale:
      case UserRole.Supervisor:
        return [
          homeGroup,
          ...(canView('nav.customers') ? [{ icon: Users, label: 'Customers' }] as NavItem[] : []),
          ...(canView('nav.orders') ? [{ icon: ShoppingCart, label: 'Orders' }] as NavItem[] : []),
          ...(canView('nav.search') ? [{ icon: Search, label: 'Search' }] as NavItem[] : []),
          { icon: Phone, label: 'Dtac Onecall' },
          ...(user.role === UserRole.Supervisor ? [{ icon: Briefcase, label: 'Team' }] : []),
        ];
      case UserRole.Backoffice:
        return [
          homeGroup,
          ...(canView('nav.manage_orders') ? [{ icon: ShoppingCart, label: 'Manage Orders' }] as NavItem[] : []),
          ...(canView('nav.debt') ? [{ icon: FileText, label: 'Debt' }] as NavItem[] : []),
          ...(canView('nav.search') ? [{ icon: Search, label: 'Search' }] as NavItem[] : []),
          ...(canView('nav.reports') ? [{ icon: BarChart2, label: 'Reports' }] as NavItem[] : []),
          ...(canView('nav.bulk_tracking') ? [{ icon: FileUp, label: 'Bulk Tracking' }] as NavItem[] : []),
          { icon: Phone, label: 'Dtac Onecall' },
        ];
      default:
        return [homeGroup];
    }
  };

  const navItems = getNavItems();

  const renderNavItem = (item: NavItem) => {
    const isGroup = Array.isArray(item.children);
    const isOpen = !!openGroups[item.label];
    const isActive = activePage === item.label || item.children?.some(c => c.label === activePage);

    if (isGroup) {
      return (
        <div key={item.label}>
          <button
            onClick={() => {
              // Close all other groups and open only this one
              const newOpenState: Record<string, boolean> = {};
              newOpenState[item.label] = !openGroups[item.label];
              setOpenGroups(newOpenState);
              
              // Set active page to this main menu to highlight it
              setActivePage(item.label);
            }}
            className={`w-full flex items-center py-2.5 text-sm font-medium rounded-lg transition-colors text-left justify-start ${
              isCollapsed ? 'px-3' : 'px-4'
            } ${isActive ? 'bg-[#2E7D32] text-white shadow' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
            title={isCollapsed ? t(item.label) : ''}
          >
            <item.icon className={`w-5 h-5 flex-shrink-0 ${!isCollapsed ? 'mr-3' : ''}`} />
            {!isCollapsed && (
              <>
                <span className="truncate flex-1">{t(item.label)}</span>
                <ChevronDown className={`w-4 h-4 transition-transform duration-300 ease-in-out ${isOpen ? 'rotate-180' : ''}`} />
              </>
            )}
          </button>
          {!isCollapsed && (
            <div 
              className={`overflow-hidden transition-all duration-300 ease-in-out ${
                isOpen ? 'max-h-96 opacity-100 mt-1' : 'max-h-0 opacity-0'
              }`}
            >
              <div className="ml-2 space-y-1">
                {item.children!.map(child => (
                  <button
                    key={child.label}
                    onClick={() => setActivePage(child.label)}
                    className={`w-full flex items-center py-2 text-sm rounded-md text-left justify-start transition-colors ${
                      activePage === child.label ? 'bg-green-50 text-green-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    } ${isCollapsed ? 'px-3' : 'pl-10 pr-3'}`}
                    title={isCollapsed ? t(child.label) : ''}
                  >
                    <child.icon className={`w-4 h-4 flex-shrink-0 ${!isCollapsed ? 'mr-2' : ''}`} />
                    {!isCollapsed && <span className="truncate">{t(child.label)}</span>}
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
              ${isCollapsed ? 'px-3' : 'px-4'}
              ${activePage === item.label ? 'bg-[#2E7D32] text-white shadow' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
        title={isCollapsed ? t(item.label) : ''}
      >
        <item.icon className={`w-5 h-5 flex-shrink-0 ${!isCollapsed ? 'mr-3' : ''}`} />
        {!isCollapsed && <span className="truncate">{t(item.label)}</span>}
      </button>
    );
  };

  return (
    <div className={`bg-[#FFFFFF] text-gray-700 flex flex-col transition-all duration-300 ease-in-out border-r border-gray-200 ${isCollapsed ? 'w-20' : 'w-64'}`}>
      <div className="flex items-center justify-between h-16 border-b border-gray-200 flex-shrink-0 px-4">
        <h1 className={`text-2xl font-bold text-[#2E7D32] transition-opacity duration-300 ${isCollapsed ? '' : 'tracking-wider'}`}>{isCollapsed ? 'E' : 'ERP'}</h1>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>
      <div className="text-xs text-gray-400 uppercase tracking-wider px-4 mt-6 mb-2">{isCollapsed ? '' : 'เมนู'}</div>
      <nav className="flex-1 px-4 py-2 space-y-1">
        {navItems.map(renderNavItem)}
      </nav>
      <div className="px-4 py-4 border-t border-gray-200 mt-auto">
        <div className={`flex items-center mb-4 ${isCollapsed ? 'justify-center' : ''}`}>
          {!isCollapsed && (
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-600 mr-3">
              {user.firstName.charAt(0)}
            </div>
          )}
          {!isCollapsed && (
            <div>
              <p className="font-semibold text-sm text-gray-800">{`${user.firstName} ${user.lastName}`}</p>
              <p className="text-xs text-gray-500">{user.role}</p>
            </div>
          )}
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center p-2.5 text-sm font-medium rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 text-left"
        >
          <LogOut className={`w-5 h-5 flex-shrink-0 ${isCollapsed ? '' : 'mr-3'}`} />
          {!isCollapsed && 'ออกจากระบบ'}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
