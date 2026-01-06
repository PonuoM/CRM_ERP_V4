import React, { useState, useMemo, useRef, useEffect } from 'react';
import { User, Customer, CustomerLifecycleStatus, CustomerBehavioralStatus, ModalType, Tag, CustomerGrade, Appointment, Activity, ActivityType, CallHistory, Order } from '../types';
import CustomerTable from '../components/CustomerTable';
import { ListTodo, Users, Search, ChevronDown, Calendar, PlusCircle, Filter, Check, Clock, ShoppingCart, UserPlus, Star, X, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';

import { db } from '../db/db';
import { syncCustomers } from '../services/syncService';
import { listCustomers } from '../services/api';
import { mapCustomerFromApi } from '../utils/customerMapper';
import { SyncProgressModal, SyncProgress } from '../components/SyncProgressModal';
import usePersistentState from "@/utils/usePersistentState";

// Module-level flag to prevent auto-sync from triggering twice (React Strict Mode double-mount)
let hasTriggeredAutoSync = false;

interface TelesaleDashboardProps {
  user: User;
  customers: Customer[];
  appointments?: Appointment[];
  activities?: Activity[];
  calls?: CallHistory[];
  orders?: Order[];
  onViewCustomer: (customer: Customer) => void;
  openModal: (type: ModalType, data: any) => void;
  systemTags: Tag[];
  setActivePage?: (page: string) => void;
  onUpsellClick?: (customer: Customer) => void;
  onChangeOwner?: (customerId: string, newOwnerId: number) => Promise<void> | void;
  allUsers?: User[];
}

type SubMenu = 'do' | 'expiring' | 'updates' | 'all';

const DateFilterButton: React.FC<{ label: string, value: string, activeValue: string, onClick: (value: string) => void }> = ({ label, value, activeValue, onClick }) => (
  <button
    onClick={() => onClick(value)}
    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeValue === value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
  >
    {label}
  </button>
);

const FilterDropdown: React.FC<{ title: string; options: { id: string | number, name: string }[]; selected: (string | number)[]; onSelect: (id: string | number) => void; }> = ({ title, options, selected, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef} style={{ minWidth: '120px' }}>
      <button onClick={() => setIsOpen(!isOpen)} className="flex items-center justify-between w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 text-sm">
        <span>{title} {selected.length > 0 ? `(${selected.length})` : ''}</span>
        <ChevronDown size={14} />
      </button>
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
          {options.map(opt => (
            <div key={opt.id} className="flex items-center p-2 hover:bg-gray-100">
              <input
                type="checkbox"
                id={`filter-${title}-${opt.id}`}
                checked={selected.includes(opt.id)}
                onChange={() => onSelect(opt.id)}
                className="h-3 w-3 rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <label htmlFor={`filter-${title}-${opt.id}`} className="ml-2 text-xs text-gray-700">{opt.name}</label>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const formatThaiDateTime = (date: Date | undefined | null) => {
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    dateStyle: 'medium',
    timeStyle: 'short'
  });
};

// Helper function to calculate days until expiration
const getDaysUntilExpiration = (expireDate: string) => {
  const now = new Date();
  const expiry = new Date(expireDate);
  const diff = expiry.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

// Helper function to check if a customer has any activity
const hasActivity = (customer: Customer, activities: Activity[]) => {
  return activities.some(activity => {
    // Match by string comparison (customer.id is string, activity.customerId may be string or number)
    return String(activity.customerId) === String(customer.id) ||
      String(activity.customerId) === String(customer.pk);
  });
};

// Helper function to check if customer is in Do dashboard
const isInDoDashboard = (customer: Customer, appointments: Appointment[] = [], activities: Activity[] = [], now: Date) => {
  // Check for upcoming follow-ups (due within 2 days)
  const upcomingAppointments = appointments.filter(appt => {
    // Match by string comparison (customer.id is string, appt.customerId may be string or number)
    const matches = String(appt.customerId) === String(customer.id) ||
      String(appt.customerId) === String(customer.pk);
    return matches &&
      appt.status !== 'เสร็จสิ้น' &&
      new Date(appt.date) <= new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  });

  if (upcomingAppointments.length > 0) return true;

  // Check for expiring ownership (within 5 days)
  if (customer.ownershipExpires) {
    const daysUntilExpiry = getDaysUntilExpiration(customer.ownershipExpires);
    if (daysUntilExpiry <= 5 && daysUntilExpiry >= 0) return true;
  }

  if (upcomingAppointments.length > 0) return true;

  // Check for expiring ownership (within 5 days)
  if (customer.ownershipExpires) {
    const daysUntilExpiry = getDaysUntilExpiration(customer.ownershipExpires);
    if (daysUntilExpiry <= 5 && daysUntilExpiry >= 0) return true;
  }

  // Check for daily distribution customers with no activity
  if (customer.lifecycleStatus === CustomerLifecycleStatus.DailyDistribution && !hasActivity(customer, activities)) {
    const assignedDate = new Date(customer.dateAssigned);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    assignedDate.setHours(0, 0, 0, 0);
    if (assignedDate.getTime() === today.getTime()) return true;
  }

  // Check for new customers with no activity
  if (customer.lifecycleStatus === CustomerLifecycleStatus.New && !hasActivity(customer, activities)) {
    return true;
  }

  return false;
};

// Helper function to get reason why customer is in Do dashboard
const getDoReason = (customer: Customer, appointments: Appointment[] = [], activities: Activity[] = [], now: Date): string => {
  // Check for upcoming follow-ups (due within 2 days)
  const upcomingAppointments = appointments.filter(appt => {
    // Match by string comparison (customer.id is string, appt.customerId may be string or number)
    const matches = String(appt.customerId) === String(customer.id) ||
      String(appt.customerId) === String(customer.pk);
    return matches &&
      appt.status !== 'เสร็จสิ้น' &&
      new Date(appt.date) <= new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  });

  if (upcomingAppointments.length > 0) {
    const nextAppointment = upcomingAppointments[0];
    const appointmentDate = new Date(nextAppointment.date);
    const daysUntil = Math.ceil((appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return `มีนัดหมายใน ${daysUntil} วัน (${appointmentDate.toLocaleDateString('th-TH')})`;
  }

  // Check for expiring ownership (within 5 days)
  if (customer.ownershipExpires) {
    const daysUntilExpiry = getDaysUntilExpiration(customer.ownershipExpires);
    if (daysUntilExpiry <= 5 && daysUntilExpiry >= 0) {
      return `สิทธิ์ครอบครองจะหมดอายุใน ${daysUntilExpiry} วัน`;
    }
  }

  // Check for daily distribution customers with no activity
  if (customer.lifecycleStatus === CustomerLifecycleStatus.DailyDistribution && !hasActivity(customer, activities)) {
    const assignedDate = new Date(customer.dateAssigned);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    assignedDate.setHours(0, 0, 0, 0);
    if (assignedDate.getTime() === today.getTime()) {
      return 'ลูกค้าแจกรายวันที่ได้รับวันนี้ ยังไม่มีกิจกรรม';
    }
  }

  // Check for new customers with no activity
  if (customer.lifecycleStatus === CustomerLifecycleStatus.New && !hasActivity(customer, activities)) {
    return 'ลูกค้าใหม่ที่ยังไม่มีกิจกรรม';
  }

  return '';
};

const SUB_MENU_VALUES: SubMenu[] = ['do', 'expiring', 'updates', 'all'];
const ORDER_UPDATE_LOOKBACK_DAYS = 3;

const TelesaleDashboard: React.FC<TelesaleDashboardProps> = (props) => {
  const { user, customers, appointments, activities, calls, orders, onViewCustomer, openModal, systemTags, setActivePage, onUpsellClick, onChangeOwner, allUsers } = props;

  // Create a unique key for this user's filter state
  const filterStorageKey = `telesale_filters_${user.id}`;

  // Load saved filter state from localStorage
  const loadFilterState = () => {
    try {
      const saved = localStorage.getItem(filterStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        const savedSubMenu = SUB_MENU_VALUES.includes(parsed.activeSubMenu)
          ? (parsed.activeSubMenu as SubMenu)
          : 'do';
        return {
          activeSubMenu: savedSubMenu,
          activeDatePreset: parsed.activeDatePreset || 'all',
          dateRange: parsed.dateRange || { start: '', end: '' },
          searchTerm: parsed.searchTerm || '',
          appliedSearchTerm: parsed.appliedSearchTerm || '',
          selectedTagIds: parsed.selectedTagIds || [],
          selectedGrades: parsed.selectedGrades || [],
          selectedProvinces: parsed.selectedProvinces || [],
          selectedLifecycleStatuses: parsed.selectedLifecycleStatuses || [],
          selectedExpiryDays: parsed.selectedExpiryDays || null,
          sortBy: parsed.sortBy || "system",
          sortByExpiry: parsed.sortByExpiry || "",
          hideTodayCalls: parsed.hideTodayCalls || false,
          hideTodayCallsRangeEnabled: parsed.hideTodayCallsRangeEnabled || false,
          hideTodayCallsRange: parsed.hideTodayCallsRange || { start: "", end: "" },
        };
      }
    } catch (error) {
      console.warn('Failed to load filter state:', error);
    }
    return {
      activeSubMenu: 'do' as SubMenu,
      activeDatePreset: 'all',
      dateRange: { start: '', end: '' },
      searchTerm: '',
      appliedSearchTerm: '',
      selectedTagIds: [],
      selectedGrades: [],
      selectedProvinces: [],
      selectedLifecycleStatuses: [],
      selectedExpiryDays: null,
      sortBy: "system",
      sortByExpiry: "",
      hideTodayCalls: false,
      hideTodayCallsRangeEnabled: false,
      hideTodayCallsRange: { start: "", end: "" },
    };
  };

  const savedState = loadFilterState();

  const [activeSubMenu, setActiveSubMenu] = useState<SubMenu>(savedState.activeSubMenu);
  const [activeDatePreset, setActiveDatePreset] = useState(savedState.activeDatePreset);
  const [dateRange, setDateRange] = useState(savedState.dateRange);
  const [searchTerm, setSearchTerm] = useState(savedState.searchTerm);
  const [appliedSearchTerm, setAppliedSearchTerm] = useState(savedState.appliedSearchTerm);

  // Filter states
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(
    savedState.selectedTagIds,
  );
  const [selectedGrades, setSelectedGrades] = useState<CustomerGrade[]>(
    savedState.selectedGrades,
  );
  const [selectedProvinces, setSelectedProvinces] = useState<string[]>(
    savedState.selectedProvinces,
  );
  const [selectedLifecycleStatuses, setSelectedLifecycleStatuses] = useState<
    CustomerLifecycleStatus[]
  >(savedState.selectedLifecycleStatuses);
  const [selectedExpiryDays, setSelectedExpiryDays] = useState<number | null>(
    savedState.selectedExpiryDays,
  );

  // Advanced filters state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sortBy, setSortBy] = useState(savedState.sortBy || "system");
  const [sortByExpiry, setSortByExpiry] = useState(savedState.sortByExpiry || "");
  const [hideTodayCalls, setHideTodayCalls] = useState(
    savedState.hideTodayCalls ?? false,
  );
  const [hideTodayCallsRangeEnabled, setHideTodayCallsRangeEnabled] = useState(
    savedState.hideTodayCallsRangeEnabled ?? false,
  );
  const [hideTodayCallsRange, setHideTodayCallsRange] = useState(
    savedState.hideTodayCallsRange || { start: "", end: "" },
  );
  const advRef = useRef<HTMLDivElement | null>(null);

  // Server-side search state
  const [serverSearchResults, setServerSearchResults] = useState<Customer[] | null>(null);
  const [isServerSearching, setIsServerSearching] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [paginatedCustomers, setPaginatedCustomers] = useState<Customer[]>([]);



  // Tab state cache: preserve page and data per tab
  const [tabCache, setTabCache] = useState<Record<string, {
    page: number;
    data: Customer[];
    total: number;
  }>>({});



  // Click outside to collapse advanced filters
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!showAdvanced) return;
      const el = advRef.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) {
        setShowAdvanced(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showAdvanced]);
  // Local state for DB customers
  const [localCustomers, setLocalCustomers] = useState<Customer[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    message: '',
    progress: 0,
    totalCustomers: 0,
    syncedCustomers: 0,
    isComplete: false,
    isError: false,
  });

  // Lock to prevent double-syncing (especially in React Strict Mode)
  const syncLock = useRef(false);

  const handleSyncCustomers = async () => {
    if (syncLock.current || showSyncModal) return; // Also check if modal is already showing
    syncLock.current = true;

    setIsSyncing(true);
    setShowSyncModal(true);

    try {
      await syncCustomers(
        user.companyId || 1,
        (progress) => setSyncProgress(progress),
        Number(user.id) // Filter by user ID
      );

      // Reload local data
      const userId = Number(user.id);
      if (!isNaN(userId)) {
        const myCustomers = await db.customers.where('assignedTo').equals(userId).toArray();
        setLocalCustomers(myCustomers);
      }
    } catch (error) {
      console.error("Sync failed:", error);
    } finally {
      setIsSyncing(false);
      // Don't release lock immediately if you want to prevent rapid re-clicks? 
      // But for safety, release it.
      syncLock.current = false;
    }
  };

  // Import DB and Sync
  useEffect(() => {
    let active = true;
    const loadFromDB = async () => {
      // If we have props.customers, maybe use them? But App.tsx sends [], so rely on DB.
      // Load all customers assigned to this user
      if (!user || !user.id) return;

      try {
        // Check if this is Telesale or Supervisor role that needs daily sync
        const telesaleRoles = ['Telesale', 'Supervisor', 'TelesaleSupervisor', 'SupervisorTelesale'];
        const needsDailySync = telesaleRoles.some(role =>
          user.role?.toLowerCase().includes(role.toLowerCase())
        );

        if (needsDailySync && !hasTriggeredAutoSync) {
          // Check if we already synced today
          const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
          const lastSyncKey = `lastSyncDate_${user.id}`;
          const lastSyncDate = localStorage.getItem(lastSyncKey);

          if (lastSyncDate !== today) {
            // First login of the day - sync now!
            hasTriggeredAutoSync = true;
            console.log(`Daily sync: First login of the day for user ${user.id}. Syncing...`);
            await handleSyncCustomers();
            localStorage.setItem(lastSyncKey, today);
          } else {
            console.log(`Daily sync: Already synced today for user ${user.id}. Skipping.`);
          }
        }

        // Fallback: If DB is empty (regardless of role), sync
        const count = await db.customers.count();
        if (count === 0 && !hasTriggeredAutoSync) {
          hasTriggeredAutoSync = true;
          await handleSyncCustomers();
        }

        // Valid user ID check to prevent "Uncaught DataCloneError" if user.id is weird
        const userId = Number(user.id);
        if (!isNaN(userId) && active) {
          const myCustomers = await db.customers.where('assignedTo').equals(userId).toArray();
          setLocalCustomers(myCustomers);
        }
      } catch (error) {
        console.error("Failed to load local customers", error);
      }
    };
    loadFromDB();
    return () => { active = false; };
  }, [user.id, user.companyId, user.role]); // Added user.role to dependencies

  const userCustomers = useMemo(() => {
    // Merge props.customers (if any) with localCustomers, preferring local? 
    // App.tsx sends [], so just use localCustomers for dashboard.
    // Ensure uniqueness if needed, but for now just use localCustomers as the source of truth for dashboard.
    return localCustomers;
  }, [localCustomers]);

  const allAvailableTags = useMemo(
    () => [...systemTags, ...(user.customTags || [])],
    [systemTags, user.customTags],
  );

  const allProvinces = useMemo(
    () =>
      [...new Set(userCustomers.map((c) => c.province).filter(Boolean))].sort(),
    [userCustomers],
  );

  // Calculate Dashboard Counts
  const tabCounts = useMemo(() => {
    const safeAppointments = appointments || [];
    const safeCalls = calls || [];
    const safeOrders = orders || [];
    const safeActivities = activities || [];

    const counts = {
      do: 0, // This will combine followUp, daily, and new
      expiring: 0, // ownership expires in <= 5 days
      updates: 0,  // Customers with orders in last 7 days (no activity after)
      all: 0,      // Total customers (assigned to user)
    };

    // Set 'all' count
    counts.all = userCustomers.length;

    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoTime = sevenDaysAgo.getTime();

    // Helper to check if customer has ANY activity
    const hasAnyActivity = (c: Customer, since?: number) => {
      // Check calls
      const hasCall = safeCalls.some(ch => {
        const matches = String(ch.customerId) === String(c.id) || String(ch.customerId) === String(c.pk);
        if (!matches) return false;
        if (since) return new Date(ch.date).getTime() >= since;
        return true;
      });
      if (hasCall) return true;

      const hasActivityLog = safeActivities.some(act => {
        const matches = String(act.customerId) === String(c.id) || String(act.customerId) === String(c.pk);
        if (!matches) return false;
        if (since) return new Date(act.timestamp).getTime() >= since;
        return true;
      });
      if (hasActivityLog) return true;

      // Check orders
      const hasOrder = safeOrders.some(o => {
        const matches = String(o.customerId) === String(c.id) || String(o.customerId) === String(c.pk);
        if (!matches) return false;
        if (since && o.orderDate) return new Date(o.orderDate).getTime() >= since;
        return true;
      });
      if (hasOrder) return true;

      return false;
    };

    userCustomers.forEach((customer) => {
      // 1) Pending appointments (Do)
      const hasPendingAppt = safeAppointments.some(
        (appt) => {
          const matches = String(appt.customerId) === String(customer.id) ||
            String(appt.customerId) === String(customer.pk);
          return matches &&
            appt.status !== 'เสร็จสิ้น' &&
            new Date(appt.date) <= new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000) &&
            new Date(appt.date) >= new Date(now.getTime() - 24 * 60 * 60 * 1000);
        },
      );
      if (hasPendingAppt) {
        counts.do++;
      }

      // 2) Expiring ownership
      if (customer.ownershipExpires) {
        const daysUntilExpiry = getDaysUntilExpiration(customer.ownershipExpires);
        if (daysUntilExpiry <= 5 && daysUntilExpiry >= 0) {
          counts.expiring++;
        }
      }

      // 3) New or Daily with no activity since assigned (Do)
      const isDaily = customer.lifecycleStatus === CustomerLifecycleStatus.DailyDistribution;
      const isNew = customer.lifecycleStatus === CustomerLifecycleStatus.New;

      if (isDaily || isNew) {
        const assignedTime = new Date(customer.dateAssigned).getTime();
        if (!hasAnyActivity(customer, assignedTime)) {
          counts.do++;
        }
      }

      // 4) Updates (Orders in last 7 days created by OTHERS)
      // Only count updates if not already in 'do' from daily/new or appointments
      if (!hasPendingAppt && !(isDaily || isNew && !hasAnyActivity(customer, new Date(customer.dateAssigned).getTime()))) {
        const recentOrders = safeOrders.filter(o => {
          const matches = String(o.customerId) === String(customer.id) || String(o.customerId) === String(customer.pk);
          if (!matches) return false;
          if (!o.orderDate) return false;

          if (o.creatorId && customer.assignedTo) {
            if (String(o.creatorId) === String(customer.assignedTo)) {
              return false; // Same person, skip
            }
          }

          const oDate = new Date(o.orderDate).getTime();
          return oDate >= sevenDaysAgoTime;
        });

        if (recentOrders.length > 0) {
          const latestOrderTime = Math.max(...recentOrders.map(o => new Date(o.orderDate!).getTime()));
          if (!hasAnyActivity(customer, latestOrderTime + 1000)) {
            counts.updates++;
          }
        }
      }
    });

    return counts;
  }, [userCustomers, appointments, calls, orders, activities]);

  const filteredCustomers = useMemo(() => {
    const safeAppointments = appointments || [];
    const safeActivities = activities || [];
    const safeCalls = calls || [];
    const safeOrders = orders || [];

    // Prioritize server-side search results
    if (serverSearchResults !== null) {
      return serverSearchResults;
    }

    let baseFiltered;
    const now = new Date();
    const nowTime = now.getTime();

    // =========== OPTIMIZATION: Pre-calculate activity indices ===========
    // Instead of O(N*M) nested loops, build Maps once (O(M)) then do O(1) lookups

    // Build: customerId -> latestCallTime
    const callTimeMap = new Map<string, number>();
    for (const ch of safeCalls) {
      const cid = String(ch.customerId);
      const time = new Date(ch.date).getTime();
      const existing = callTimeMap.get(cid) || 0;
      if (time > existing) callTimeMap.set(cid, time);
    }

    // Build: customerId -> latestActivityTime
    const activityTimeMap = new Map<string, number>();
    for (const act of safeActivities) {
      const cid = String(act.customerId);
      const time = new Date(act.timestamp).getTime();
      const existing = activityTimeMap.get(cid) || 0;
      if (time > existing) activityTimeMap.set(cid, time);
    }

    // Build: customerId -> latestOrderTime
    const orderTimeMap = new Map<string, number>();
    for (const o of safeOrders) {
      if (!o.orderDate) continue;
      const cid = String(o.customerId);
      const time = new Date(o.orderDate).getTime();
      const existing = orderTimeMap.get(cid) || 0;
      if (time > existing) orderTimeMap.set(cid, time);
    }

    // Build: customerId -> list of upcoming appointments
    const upcomingAppointmentMap = new Map<string, typeof safeAppointments>();
    const twoDaysFromNow = nowTime + 2 * 24 * 60 * 60 * 1000;
    const oneDayAgo = nowTime - 24 * 60 * 60 * 1000;
    for (const appt of safeAppointments) {
      if (appt.status === 'เสร็จสิ้น') continue;
      const apptTime = new Date(appt.date).getTime();
      if (apptTime > twoDaysFromNow || apptTime < oneDayAgo) continue;
      const cid = String(appt.customerId);
      if (!upcomingAppointmentMap.has(cid)) upcomingAppointmentMap.set(cid, []);
      upcomingAppointmentMap.get(cid)!.push(appt);
    }

    // O(1) lookup function
    const hasAnyActivitySince = (customerId: string, since: number): boolean => {
      const callTime = callTimeMap.get(customerId) || 0;
      if (callTime >= since) return true;
      const actTime = activityTimeMap.get(customerId) || 0;
      if (actTime >= since) return true;
      const orderTime = orderTimeMap.get(customerId) || 0;
      if (orderTime >= since) return true;
      return false;
    };

    const hasAnyActivityEver = (customerId: string): boolean => {
      return callTimeMap.has(customerId) || activityTimeMap.has(customerId) || orderTimeMap.has(customerId);
    };
    // =========== END OPTIMIZATION ===========

    switch (activeSubMenu) {
      case 'do':
        baseFiltered = userCustomers.filter((c) => {
          const cid = String(c.id || c.pk);
          // O(1) lookup for upcoming appointments
          const upcomingAppts = upcomingAppointmentMap.get(cid);
          if (upcomingAppts && upcomingAppts.length > 0) return true;

          const isDaily = c.lifecycleStatus === CustomerLifecycleStatus.DailyDistribution;
          const isNew = c.lifecycleStatus === CustomerLifecycleStatus.New;
          if (isDaily || isNew) {
            const assignedTime = new Date(c.dateAssigned).getTime();
            // O(1) activity check
            if (hasAnyActivitySince(cid, assignedTime)) return false;
            return true;
          }
          return false;
        }).map((c) => {
          // Add detailed doReason for each customer in Do
          const cid = String(c.id || c.pk);
          const upcomingAppts = upcomingAppointmentMap.get(cid);

          if (upcomingAppts && upcomingAppts.length > 0) {
            const nextAppt = upcomingAppts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
            const apptDate = new Date(nextAppt.date);
            const daysUntil = Math.ceil((apptDate.getTime() - nowTime) / (1000 * 60 * 60 * 24));

            if (daysUntil <= 0) {
              return { ...c, doReason: `📅 นัดหมายวันนี้ (${apptDate.toLocaleDateString('th-TH')})` };
            } else if (daysUntil === 1) {
              return { ...c, doReason: `📅 นัดหมายพรุ่งนี้ (${apptDate.toLocaleDateString('th-TH')})` };
            } else {
              return { ...c, doReason: `📅 มีนัดหมายอีก ${daysUntil} วัน (${apptDate.toLocaleDateString('th-TH')})` };
            }
          }

          const isDaily = c.lifecycleStatus === CustomerLifecycleStatus.DailyDistribution;
          const isNew = c.lifecycleStatus === CustomerLifecycleStatus.New;
          const assignedDate = new Date(c.dateAssigned);
          const daysSinceAssigned = Math.floor((nowTime - assignedDate.getTime()) / (1000 * 60 * 60 * 24));

          if (isDaily) {
            if (daysSinceAssigned === 0) {
              return { ...c, doReason: '🆕 ลูกค้าแจกใหม่วันนี้ - ยังไม่มีกิจกรรม' };
            } else if (daysSinceAssigned === 1) {
              return { ...c, doReason: '⏰ ลูกค้าแจกใหม่เมื่อวาน - ยังไม่มีการโทร' };
            } else {
              return { ...c, doReason: `⚠️ ลูกค้าแจกใหม่ ${daysSinceAssigned} วันที่แล้ว - ยังไม่มีการติดต่อ` };
            }
          }

          if (isNew) {
            if (daysSinceAssigned === 0) {
              return { ...c, doReason: '🆕 ลูกค้าใหม่วันนี้ - รอการติดต่อ' };
            } else if (daysSinceAssigned === 1) {
              return { ...c, doReason: '⏰ ลูกค้าใหม่เมื่อวาน - ยังไม่มีการโทร' };
            } else {
              return { ...c, doReason: `⚠️ ลูกค้าใหม่ ${daysSinceAssigned} วันที่แล้ว - ยังไม่มีกิจกรรม` };
            }
          }

          return c;
        });
        break;

      case 'expiring':
        baseFiltered = userCustomers.filter(c => {
          if (!c.ownershipExpires) return false;
          const daysUntil = getDaysUntilExpiration(c.ownershipExpires);
          return daysUntil <= 5 && daysUntil >= 0;
        });
        break;

      case 'updates':
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sevenDaysAgoTime = sevenDaysAgo.getTime();

        // OPTIMIZATION: Pre-filter orders by date first
        const recentOrdersMap = new Map<string, number>(); // customerId -> latestOrderTime
        for (const o of safeOrders) {
          if (!o.orderDate) continue;
          const oTime = new Date(o.orderDate).getTime();
          if (oTime < sevenDaysAgoTime) continue;
          const cid = String(o.customerId);
          const existing = recentOrdersMap.get(cid) || 0;
          if (oTime > existing) recentOrdersMap.set(cid, oTime);
        }

        baseFiltered = userCustomers.filter(c => {
          if (c.dateRegistered) {
            const registeredDate = new Date(c.dateRegistered).getTime();
            if (registeredDate >= sevenDaysAgoTime) return false;
          }
          const cid = String(c.id || c.pk);
          const latestOrderTime = recentOrdersMap.get(cid);
          if (!latestOrderTime) return false; // No recent orders
          // O(1) activity check
          if (hasAnyActivitySince(cid, latestOrderTime + 1000)) return false;
          return true;
        }).map(c => ({ ...c, doReason: 'มีคำสั่งซื้อใหม่' } as Customer));
        break;

      case 'all':
      default:
        // OPTIMIZATION: Create a map for latest calls to avoid O(N*M) filtering
        // Pre-process calls: Group by customerId and find latest
        const latestCallMap = new Map<number | string, any>();

        // Sort calls once (descending)
        const sortedCalls = [...safeCalls].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        // Populate map with the first (latest) call for each customer
        for (const call of sortedCalls) {
          if (!latestCallMap.has(call.customerId)) {
            latestCallMap.set(String(call.customerId), call);
          }
        }

        baseFiltered = userCustomers.map(c => {
          const id = String(c.id || c.pk);
          // O(1) Lookup
          const latestCall = latestCallMap.get(id);

          const lastCallNote = latestCall?.notes && latestCall.notes.trim().length > 0
            ? latestCall.notes
            : undefined;
          // Optimization: Don't spread if no change needed, but here we add property
          // To avoid new object creation if unnecessary?
          if (lastCallNote || latestCall) {
            return { ...c, lastCallNote } as Customer;
          }
          return c;
        });
    }

    // Advanced Filters
    let filtered = baseFiltered;

    // Filter by Date Range (assigned date)
    if (dateRange.start || dateRange.end) {
      filtered = filtered.filter(c => {
        if (!c.dateAssigned) return false;
        const assignedDate = new Date(c.dateAssigned);
        assignedDate.setHours(0, 0, 0, 0);

        let start = dateRange.start ? new Date(dateRange.start) : null;
        let end = dateRange.end ? new Date(dateRange.end) : null;
        if (start) start.setHours(0, 0, 0, 0);
        if (end) end.setHours(23, 59, 59, 999);

        if (start && assignedDate < start) return false;
        if (end && assignedDate > end) return false;
        return true;
      });
    }

    // Filter by Search Term (Name/Phone)
    if (appliedSearchTerm) {
      const term = appliedSearchTerm.toLowerCase();
      filtered = filtered.filter(c =>
        (c.firstName?.toLowerCase().includes(term)) ||
        (c.lastName?.toLowerCase().includes(term)) ||
        (c.phone?.includes(term))
      );
    }

    // Filter by Tags
    if (selectedTagIds.length > 0) {
      filtered = filtered.filter(c =>
        c.tags?.some(t => selectedTagIds.includes(t.id))
      );
    }

    // Filter by Grade
    if (selectedGrades.length > 0) {
      filtered = filtered.filter(c => selectedGrades.includes(c.grade));
    }

    // Filter by Province
    if (selectedProvinces.length > 0) {
      filtered = filtered.filter(c => selectedProvinces.includes(c.province));
    }

    // Filter by Lifecycle Status
    if (selectedLifecycleStatuses.length > 0) {
      filtered = filtered.filter(c => selectedLifecycleStatuses.includes(c.lifecycleStatus));
    }

    // Filter by Expiry
    if (selectedExpiryDays !== null) {
      filtered = filtered.filter(c => {
        if (!c.ownershipExpires) return false;
        const days = getDaysUntilExpiration(c.ownershipExpires);
        return days <= selectedExpiryDays && days >= 0;
      });
    }

    // Hide Today Calls
    if (hideTodayCalls) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayStartTime = todayStart.getTime();
      filtered = filtered.filter(c => {
        const cid = String(c.id || c.pk);
        return !hasAnyActivitySince(cid, todayStartTime);
      });
    }

    // Hide Calls Range
    if (hideTodayCallsRangeEnabled && hideTodayCallsRange.start && hideTodayCallsRange.end) {
      const start = new Date(hideTodayCallsRange.start).getTime();
      const end = new Date(hideTodayCallsRange.end).getTime() + 86400000;

      // OPTIMIZATION: Pre-calculate activity set for the range
      // Instead of filtering inside the customer loop
      const activeCustomerIds = new Set<string>();

      for (const ch of safeCalls) {
        const time = new Date(ch.date).getTime();
        if (time >= start && time < end) {
          activeCustomerIds.add(String(ch.customerId));
        }
      }
      for (const o of safeOrders) {
        if (!o.orderDate) continue;
        const time = new Date(o.orderDate).getTime();
        if (time >= start && time < end) {
          activeCustomerIds.add(String(o.customerId));
        }
      }

      filtered = filtered.filter(c => {
        const id = String(c.id || c.pk);
        return !activeCustomerIds.has(id); // If active, exclude (so return false)
      });
    }


    // Apply sorting
    filtered.sort((a, b) => {
      if (sortByExpiry) {
        const aExp = a.ownershipExpires ? getDaysUntilExpiration(a.ownershipExpires) : 9999;
        const bExp = b.ownershipExpires ? getDaysUntilExpiration(b.ownershipExpires) : 9999;
        const diff = aExp - bExp;
        if (diff !== 0) return sortByExpiry === 'asc' ? diff : -diff;
      }
      if (sortBy === 'name') return (a.firstName || '').localeCompare(b.firstName || '');
      if (sortBy === 'name-desc') return (b.firstName || '').localeCompare(a.firstName || '');
      if (sortBy === 'date-assigned') return new Date(a.dateAssigned).getTime() - new Date(b.dateAssigned).getTime();
      if (sortBy === 'date-assigned-desc') return new Date(b.dateAssigned).getTime() - new Date(a.dateAssigned).getTime();
      return 0;
    });

    return filtered;
  }, [userCustomers, activeSubMenu, appointments, activities, calls, orders, dateRange, appliedSearchTerm, selectedTagIds, selectedGrades, selectedProvinces, selectedLifecycleStatuses, selectedExpiryDays, sortBy, sortByExpiry, hideTodayCalls, hideTodayCallsRangeEnabled, hideTodayCallsRange]);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    activeDatePreset,
    dateRange,
    appliedSearchTerm,
    selectedTagIds,
    selectedGrades,
    selectedProvinces,
    selectedLifecycleStatuses,
    selectedExpiryDays,
    sortBy,
    sortByExpiry,
    hideTodayCalls,
    hideTodayCallsRangeEnabled,
    hideTodayCallsRange
  ]);

  const [persistentTabPages, setPersistentTabPages] = usePersistentState<Record<string, number>>(
    `telesale_tab_pages_v2_${user.id}`,
    {}
  );

  // Viewed Customers Tracking (Daily Reset)
  const todayStr = new Date().toISOString().split('T')[0];
  const [viewedCustomerIds, setViewedCustomerIds] = usePersistentState<string[]>(
    `viewed_customers_${user.id}_${todayStr}`,
    []
  );

  const handleViewCustomerWrapped = (customer: Customer) => {
    // Add to viewed list if not present
    const id = String(customer.id || customer.pk);
    if (!viewedCustomerIds.includes(id)) {
      setViewedCustomerIds(prev => [...prev, id]);
    }
    // Call original handler
    onViewCustomer(customer);
  };

  // Use refs to access latest state in effect without triggering re-runs
  const tabCacheRef = useRef(tabCache);
  const persistentTabPagesRef = useRef(persistentTabPages);

  // Update refs whenever dependencies change
  useEffect(() => {
    tabCacheRef.current = tabCache;
    persistentTabPagesRef.current = persistentTabPages;
  }, [tabCache, persistentTabPages]);

  // Restore page number when switching tabs
  // Runs ONLY when activeSubMenu changes
  useEffect(() => {
    // 1. Try memory cache (if valid)
    const cached = tabCacheRef.current[activeSubMenu];
    if (cached && cached.page) {
      setCurrentPage(cached.page);
      return;
    }

    // 2. Try persistent storage
    const savedPage = persistentTabPagesRef.current[activeSubMenu];
    if (savedPage && savedPage > 0) {
      setCurrentPage(savedPage);
    } else {
      // 3. Default
      setCurrentPage(1);
    }
  }, [activeSubMenu]);

  // Save page to persistence when changed
  useEffect(() => {
    setPersistentTabPages(prev => ({
      ...prev,
      [activeSubMenu]: currentPage
    }));
  }, [currentPage, activeSubMenu, setPersistentTabPages]);

  // Client-side pagination effect
  useEffect(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;

    // Safety check in case filteredCustomers is not ready, though useMemo should prevent this
    const data = filteredCustomers || [];
    const sliced = data.slice(start, end);

    setPaginatedCustomers(sliced);
    setTotalCustomers(data.length);
    setIsLoadingCustomers(false);
  }, [filteredCustomers, currentPage, pageSize]);

  // Save filter state to localStorage whenever it changes
  useEffect(() => {
    const filterState = {
      activeSubMenu,
      activeDatePreset,
      dateRange,
      searchTerm,
      appliedSearchTerm,
      selectedTagIds,
      selectedGrades,
      selectedProvinces,
      selectedLifecycleStatuses,
      selectedExpiryDays,
      sortBy,
      sortByExpiry,
      hideTodayCalls,
      hideTodayCallsRangeEnabled,
      hideTodayCallsRange,
    };
    try {
      localStorage.setItem(filterStorageKey, JSON.stringify(filterState));
    } catch (error) {
      console.warn('Failed to save filter state:', error);
    }
  }, [activeSubMenu, activeDatePreset, dateRange, searchTerm, appliedSearchTerm, selectedTagIds, selectedGrades, selectedProvinces, selectedLifecycleStatuses, selectedExpiryDays, sortBy, sortByExpiry, hideTodayCalls, hideTodayCallsRangeEnabled, hideTodayCallsRange, filterStorageKey]);

  const handleDatePresetClick = (preset: string) => {
    setActiveDatePreset(preset);
    setDateRange({ start: '', end: '' });
  };

  const handleClearAllFilters = () => {
    setSearchTerm('');
    setAppliedSearchTerm('');
    setServerSearchResults(null);
    setSelectedTagIds([]);
    setSelectedGrades([]);
    setSelectedProvinces([]);
    setSelectedLifecycleStatuses([]);
    setSelectedExpiryDays(null);
    setActiveDatePreset('all');
    setDateRange({ start: '', end: '' });
    setSortBy("system");
    setSortByExpiry("");
    setHideTodayCalls(false);
    setHideTodayCallsRangeEnabled(false);
    setHideTodayCallsRange({ start: "", end: "" });

    // Clear localStorage as well
    try {
      localStorage.removeItem(filterStorageKey);
    } catch (error) {
      console.warn('Failed to clear filter state:', error);
    }
  };

  const handleServerSearch = async () => {
    // Shared logic: Update applied term
    setAppliedSearchTerm(searchTerm.trim());

    if (!searchTerm.trim()) {
      setServerSearchResults(null);
      return;
    }

    // Only search on Server if tab is 'all'
    if (activeSubMenu !== 'all') {
      setServerSearchResults(null); // Clear server results to ensure local filter takes over
      return;
    }

    setIsServerSearching(true);

    try {
      // Search via API
      const res = await listCustomers({
        q: searchTerm.trim(),
        assignedTo: Number(user.id),
        companyId: user.companyId,
        pageSize: 100
      });

      // Map API result to Customer object
      const mapped = (res.data || []).map(c => mapCustomerFromApi(c));
      setServerSearchResults(mapped);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      // If failed, maybe empty?
      setServerSearchResults([]);
      alert("เกิดข้อผิดพลาดในการค้นหาจาก Server");
    } finally {
      setIsServerSearching(false);
    }
  };

  const handleDateRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDateRange(prev => {
      const newRange = { ...prev, [name]: value };
      if (newRange.start && newRange.end) {
        setActiveDatePreset('range');
      }
      return newRange;
    });
  };

  const handleFilterSelect = (setter: React.Dispatch<React.SetStateAction<any[]>>, selected: any[], value: any) => {
    if (selected.includes(value)) {
      setter(selected.filter(item => item !== value));
    } else {
      setter([...selected, value]);
    }
  };

  const menuItems = [
    {
      id: 'do',
      label: 'สิ่งที่ต้องทำ (Do)',
      icon: ListTodo,
      count: tabCounts.do, // ✅ จาก server
    },
    {
      id: 'expiring',
      label: 'ใกล้หมด',
      icon: Clock,
      count: tabCounts.expiring, // ✅ จาก server
    },
    {
      id: 'updates',
      label: 'ลูกค้ามีออเดอร์ใหม่',
      icon: ShoppingCart,
      count: tabCounts.updates, // ✅ จาก server
    },
    { id: 'all', label: 'ลูกค้าทั้งหมด', icon: Users, count: tabCounts.all }, // ✅ จาก server
  ];

  const lifecycleStatusOptions = [
    { id: CustomerLifecycleStatus.New, name: 'ลูกค้าใหม่' },
    { id: CustomerLifecycleStatus.Old, name: 'ลูกค้าเก่า' },
    { id: CustomerLifecycleStatus.Old3Months, name: 'ลูกค้าเก่า 3 เดือน' },
    { id: CustomerLifecycleStatus.DailyDistribution, name: 'ลูกค้าแจกรายวัน' },
    { id: CustomerLifecycleStatus.FollowUp, name: 'ลูกค้าติดตาม' },
  ];

  const datePresets = [
    { label: 'ทั้งหมด', value: 'all' },
    { label: 'วันนี้', value: 'today' },
    { label: 'เมื่อวาน', value: 'yesterday' },
    { label: '7 วัน', value: '7days' },
    { label: '30 วัน', value: '30days' },
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800">จัดการลูกค้า</h2>
        <div className="flex">
          <button
            onClick={handleSyncCustomers}
            disabled={isSyncing}
            className={`mr-3 bg-blue-100 text-blue-700 font-semibold text-sm rounded-md py-2 px-4 flex items-center hover:bg-blue-200 shadow-sm ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <RotateCcw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'กำลังซิงค์...' : 'ซิงค์ข้อมูล'}
          </button>
          <button onClick={() => setActivePage ? setActivePage('CreateOrder') : openModal('createOrder', undefined)} className="bg-green-100 text-green-700 font-semibold text-sm rounded-md py-2 px-4 flex items-center hover:bg-green-200 shadow-sm">
            <PlusCircle className="w-4 h-4 mr-2" />
            สร้างคำสั่งซื้อ
          </button>
        </div>

      </div>

      <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
        {menuItems.map(item => (
          <button
            key={item.id}
            onClick={() => {
              setActiveSubMenu(item.id as SubMenu);
              setServerSearchResults(null); // Clear server results when switching tabs
              // Do NOT reset to 1 here immediately, let the useEffect handle restoration
              // But if we want clicking the tab explicitly to reset if already active? 
              // Usually clicking a tab switches to it. restoration logic handles it.
              // To support "switching to tab restores last page", we remove explicit reset here.
            }}
            className={`flex-shrink-0 flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${activeSubMenu === item.id
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            <item.icon size={16} />
            <span>{item.label}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs ${activeSubMenu === item.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
              }`}>{item.count}</span>
          </button>
        ))}
      </div>

      {/* Advanced Filters Toggle + Panel (wrapped for click-away) */}
      <div ref={advRef}>
        <div className="bg-white p-3 rounded-lg shadow mb-3">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="ค้นหาชื่อ หรือเบอร์โทร..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleServerSearch();
                }}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-2 self-end md:self-auto">
              <button
                onClick={handleServerSearch}
                disabled={isServerSearching}
                className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border bg-blue-50 text-blue-700 hover:bg-blue-100 ${isServerSearching ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isServerSearching ? 'กำลังค้นหา...' : 'ค้นหา'}
              </button>
              <button onClick={() => setShowAdvanced(v => !v)} className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border hover:bg-gray-50">
                {showAdvanced ? 'ซ่อนตัวกรอง' : 'ตัวกรองขั้นสูง'}
              </button>
              {(appliedSearchTerm || selectedTagIds.length > 0 || selectedGrades.length > 0 || selectedProvinces.length > 0 || selectedLifecycleStatuses.length > 0 || selectedExpiryDays !== null || activeDatePreset !== 'all' || (dateRange.start || dateRange.end) || sortBy !== "system" || sortByExpiry !== "" || hideTodayCalls || hideTodayCallsRangeEnabled) && (
                <button onClick={handleClearAllFilters} className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border hover:bg-gray-50 text-gray-600">
                  ล้างตัวกรอง
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Advanced Filters Panel */}
        <div className={`bg-white p-4 rounded-lg shadow mb-6 ${showAdvanced ? 'block' : 'hidden'}`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* ช่องค้นหา */}


            {/* ตัวกรองแถวแรก */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">เกรด</label>
              <select
                value={selectedGrades.length > 0 ? selectedGrades[0] : ""}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedGrades([e.target.value as CustomerGrade]);
                  } else {
                    setSelectedGrades([]);
                  }
                }}
                className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">ทั้งหมด</option>
                {Object.values(CustomerGrade).map((grade) => (
                  <option key={grade} value={grade}>{grade}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">จังหวัด</label>
              <select
                value={selectedProvinces.length > 0 ? selectedProvinces[0] : ""}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedProvinces([e.target.value]);
                  } else {
                    setSelectedProvinces([]);
                  }
                }}
                className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">ทั้งหมด</option>
                {allProvinces.map((province) => (
                  <option key={province} value={province}>{province}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">ประเภทลูกค้า</label>
              <select
                value={selectedLifecycleStatuses.length > 0 ? selectedLifecycleStatuses[0] : ""}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedLifecycleStatuses([e.target.value as CustomerLifecycleStatus]);
                  } else {
                    setSelectedLifecycleStatuses([]);
                  }
                }}
                className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">ทั้งหมด</option>
                {lifecycleStatusOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
            </div>

            {/* ตัวกรองแถวที่สอง */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">เรียงตามระบบ</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="system">ค่าเริ่มต้น</option>
                <option value="name">ชื่อลูกค้า (A-Z)</option>
                <option value="name-desc">ชื่อลูกค้า (Z-A)</option>
                <option value="date-assigned">วันที่ได้รับมอบหมาย (เก่า-ใหม่)</option>
                <option value="date-assigned-desc">วันที่ได้รับมอบหมาย (ใหม่-เก่า)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">เรียงตามวันที่คงเหลือ</label>
              <select
                value={sortByExpiry}
                onChange={(e) => setSortByExpiry(e.target.value)}
                className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">ไม่เรียง</option>
                <option value="desc">จากมากไปน้อย</option>
                <option value="asc">จากน้อยไปมาก</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">เวลาที่เหลือ</label>
              <select
                value={selectedExpiryDays ? selectedExpiryDays : ""}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedExpiryDays(Number(e.target.value));
                  } else {
                    setSelectedExpiryDays(null);
                  }
                }}
                className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">ทั้งหมด</option>
                <option value="10">ต่ำกว่า 10 วัน</option>
                <option value="20">ต่ำกว่า 20 วัน</option>
                <option value="30">ต่ำกว่า 30 วัน</option>
                <option value="60">ต่ำกว่า 60 วัน</option>
                <option value="90">ต่ำกว่า 90 วัน</option>
              </select>
            </div>

            {/* ตัวกรองแถวที่สาม */}
            <div className="md:col-span-3">
              <div className="flex items-center space-x-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="hideTodayCalls"
                    checked={hideTodayCalls}
                    onChange={(e) => setHideTodayCalls(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="hideTodayCalls" className="ml-2 text-sm text-gray-700">
                    ซ่อนวันที่โทรวันนี้
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="hideTodayCallsRangeEnabled"
                    checked={hideTodayCallsRangeEnabled}
                    onChange={(e) => setHideTodayCallsRangeEnabled(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="hideTodayCallsRangeEnabled" className="ml-2 text-sm text-gray-700">
                    ซ่อนวันที่โทรวันนี้ (ช่วงเวลา)
                  </label>
                </div>

                {hideTodayCallsRangeEnabled && (
                  <div className="flex items-center space-x-2">
                    <input
                      type="date"
                      value={hideTodayCallsRange.start}
                      onChange={(e) => setHideTodayCallsRange(prev => ({ ...prev, start: e.target.value }))}
                      className="p-1 border border-gray-300 rounded-md text-sm"
                    />
                    <span className="text-gray-500 text-sm">ถึง</span>
                    <input
                      type="date"
                      value={hideTodayCallsRange.end}
                      onChange={(e) => setHideTodayCallsRange(prev => ({ ...prev, end: e.target.value }))}
                      className="p-1 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Date Filter Section */}
          <div className="mt-4 pt-4 border-t">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center mr-4">
                <Calendar size={16} className="text-gray-500 mr-2" />
                <span className="text-sm font-medium text-gray-700">วันที่ได้รับ:</span>
              </div>
              {datePresets.map(preset => (
                <DateFilterButton
                  key={preset.value}
                  label={preset.label}
                  value={preset.value}
                  activeValue={activeDatePreset}
                  onClick={handleDatePresetClick}
                />
              ))}
              <div className="flex items-center gap-2 ml-auto">
                <input
                  type="date"
                  name="start"
                  value={dateRange.start}
                  onChange={handleDateRangeChange}
                  className="p-1 border border-gray-300 rounded-md text-sm"
                />
                <span className="text-gray-500 text-sm">ถึง</span>
                <input
                  type="date"
                  name="end"
                  value={dateRange.end}
                  onChange={handleDateRangeChange}
                  className="p-1 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Loading indicator */}
      {
        isLoadingCustomers && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">กำลังโหลดข้อมูล...</span>
          </div>
        )
      }

      {/* Customer Table */}
      {
        !isLoadingCustomers && (
          <>
            {/* Changed from filteredCustomers to paginatedCustomers */}
            <CustomerTable
              customers={paginatedCustomers}
              onViewCustomer={handleViewCustomerWrapped}
              viewedCustomerIds={viewedCustomerIds}
              openModal={openModal}
              showCallNotes={activeSubMenu === 'all'}
              hideGrade={true}
              totalCount={totalCustomers}
              controlledPage={currentPage}
              controlledPageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
              pageSizeOptions={[50, 100, 200, 500]}
              storageKey={`telesale:${user.id}`}
              currentUserId={user.id}
              onUpsellClick={onUpsellClick}
              onChangeOwner={onChangeOwner}
              allUsers={allUsers}
              currentUser={user}
            />
          </>
        )
      }
      <SyncProgressModal
        isOpen={showSyncModal}
        progress={syncProgress}
        onClose={() => setShowSyncModal(false)}
      />
    </div >
  );
};

export default TelesaleDashboard;

