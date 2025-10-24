﻿import React, { useState, useMemo, useRef, useEffect } from 'react';
import { User, Customer, CustomerLifecycleStatus, ModalType, Tag, CustomerGrade, Appointment, Activity, ActivityType, CallHistory } from '../types';
import CustomerTable from '../components/CustomerTable';
import { ListTodo, Users, Search, ChevronDown, Calendar, PlusCircle, Filter, Check, Clock, UserPlus, Star, X } from 'lucide-react';

interface TelesaleDashboardProps {
  user: User;
  customers: Customer[];
  appointments?: Appointment[];
  activities?: Activity[];
  calls?: CallHistory[];
  onViewCustomer: (customer: Customer) => void;
  openModal: (type: ModalType, data: any) => void;
  systemTags: Tag[];
  setActivePage?: (page: string) => void;
}

type SubMenu = 'do' | 'expiring' | 'all';

const DateFilterButton: React.FC<{label: string, value: string, activeValue: string, onClick: (value: string) => void}> = ({ label, value, activeValue, onClick }) => (
    <button 
        onClick={() => onClick(value)}
        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeValue === value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
    >
        {label}
    </button>
);

const FilterDropdown: React.FC<{ title: string; options: {id: string | number, name: string}[]; selected: (string | number)[]; onSelect: (id: string | number) => void;}> = ({ title, options, selected, onSelect }) => {
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
        <div className="relative" ref={dropdownRef} style={{minWidth: '120px'}}>
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

// Helper function to calculate days until expiration
const getDaysUntilExpiration = (expireDate: string) => {
    const now = new Date();
    const expiry = new Date(expireDate);
    const diff = expiry.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

// Helper function to check if a customer has any activity
const hasActivity = (customer: Customer, activities: Activity[]) => {
    return activities.some(activity => activity.customerId === customer.id);
};

// Helper function to check if customer is in Do dashboard
const isInDoDashboard = (customer: Customer, appointments: Appointment[] = [], activities: Activity[] = [], now: Date) => {
    // Check for upcoming follow-ups (due within 2 days)
    const upcomingAppointments = appointments.filter(appt => 
        appt.customerId === customer.id && 
        appt.status !== 'เสร็จสิ้น' &&
        new Date(appt.date) <= new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)
    );
    
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
    const upcomingAppointments = appointments.filter(appt => 
        appt.customerId === customer.id && 
        appt.status !== 'เสร็จสิ้น' &&
        new Date(appt.date) <= new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)
    );
    
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

const TelesaleDashboard: React.FC<TelesaleDashboardProps> = (props) => {
  const { user, customers, appointments, activities, calls, onViewCustomer, openModal, systemTags, setActivePage } = props;
  
  // Create a unique key for this user's filter state
  const filterStorageKey = `telesale_filters_${user.id}`;
  
  // Load saved filter state from localStorage
  const loadFilterState = () => {
    try {
      const saved = localStorage.getItem(filterStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          activeSubMenu: parsed.activeSubMenu || 'do',
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
  const [sortBy, setSortBy] = useState("system");
  const [sortByExpiry, setSortByExpiry] = useState(""); // "desc" or "asc"
  const [hideTodayCalls, setHideTodayCalls] = useState(false);
  const [hideTodayCallsRangeEnabled, setHideTodayCallsRangeEnabled] = useState(false);
  const [hideTodayCallsRange, setHideTodayCallsRange] = useState({ start: "", end: "" });
  const advRef = useRef<HTMLDivElement | null>(null);

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

  const userCustomers = useMemo(() => {
    return customers.filter(c => c.assignedTo === user.id);
  }, [user.id, customers]);

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

  const allAvailableTags = useMemo(
    () => [...systemTags, ...user.customTags],
    [systemTags, user.customTags],
  );
  const allProvinces = useMemo(
    () =>
      [...new Set(userCustomers.map((c) => c.province).filter(Boolean))].sort(),
    [userCustomers],
  );

  // Calculate Do dashboard counts (new logic)
  const doCounts = useMemo(() => {
    const safeAppointments = appointments || [];
    const safeCalls = calls || [];

    const counts = {
      followUp: 0, // pending appointments
      expiring: 0, // ownership expires in <= 5 days
      daily: 0,    // DailyDistribution with no call since assigned
      new: 0,      // New with no call since assigned
    };

    userCustomers.forEach((customer) => {
      // 1) Pending appointments (not completed)
      const hasPendingAppt = safeAppointments.some(
        (appt) => appt.customerId === customer.id && appt.status !== 'เสร็จสิ้น',
      );
      if (hasPendingAppt) {
        counts.followUp++;
        return;
      }

      // 2) Expiring ownership (still counted separately)
      if (customer.ownershipExpires) {
        const daysUntilExpiry = getDaysUntilExpiration(customer.ownershipExpires);
        if (daysUntilExpiry <= 5 && daysUntilExpiry >= 0) {
          counts.expiring++;
          // Do not return here; this tab is separate and we don't double-count into Do
          // but since follow-up already returned above, this path is fine.
        }
      }

      // 3) New or Daily with no call since assigned
      const assignedAt = new Date(customer.dateAssigned).getTime();
      const hasCallSinceAssigned = safeCalls.some(
        (ch) => ch.customerId === customer.id && new Date(ch.date).getTime() >= assignedAt,
      );
      if (!hasCallSinceAssigned) {
        if (customer.lifecycleStatus === CustomerLifecycleStatus.DailyDistribution) {
          counts.daily++;
          return;
        }
        if (customer.lifecycleStatus === CustomerLifecycleStatus.New) {
          counts.new++;
          return;
        }
      }
    });

    return counts;
  }, [userCustomers, appointments, calls]);

  const filteredCustomers = useMemo(() => {
    // Handle case where appointments or activities might be undefined
    const safeAppointments = appointments || [];
    const safeActivities = activities || [];
    const safeCalls = calls || [];
    
    let baseFiltered;
    const now = new Date();
    
    switch (activeSubMenu) {
      case 'do':
        // New DO logic: show only
        // - Customers with pending follow-ups (appointments not completed)
        // - New or DailyDistribution customers with no call since assigned
        baseFiltered = userCustomers.filter((c) => {
          const hasPendingAppt = safeAppointments.some(
            (appt) => appt.customerId === c.id && appt.status !== 'เสร็จสิ้น',
          );
          if (hasPendingAppt) return true;

          const assignedAt = new Date(c.dateAssigned).getTime();
          const hasCallSinceAssigned = safeCalls.some(
            (ch) => ch.customerId === c.id && new Date(ch.date).getTime() >= assignedAt,
          );
          const isNewOrDaily =
            c.lifecycleStatus === CustomerLifecycleStatus.New ||
            c.lifecycleStatus === CustomerLifecycleStatus.DailyDistribution;
          return isNewOrDaily && !hasCallSinceAssigned;
        });
        break;
      case 'expiring':
        // Customers with ownership expiring within 5 days
        baseFiltered = userCustomers.filter(c => {
          if (!c.ownershipExpires) return false;
          const daysUntil = getDaysUntilExpiration(c.ownershipExpires);
          return daysUntil <= 5 && daysUntil >= 0;
        });
        break;
      case 'all':
      default:
        // For all customers, enrich with latest call note from call history (prefer notes over result)
        baseFiltered = userCustomers.map(c => {
          const latestCall = safeCalls
            .filter(ch => ch.customerId === c.id)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
          const lastCallNote = latestCall?.notes && latestCall.notes.trim().length > 0
            ? latestCall.notes
            : undefined;
          return { ...c, lastCallNote } as Customer;
        });
    }

    // Apply lifecycle status filter
    if (selectedLifecycleStatuses.length > 0) {
      baseFiltered = baseFiltered.filter(customer => 
        selectedLifecycleStatuses.includes(customer.lifecycleStatus)
      );
    }

    // Apply date filter
    let dateFiltered = baseFiltered;
    if (activeDatePreset !== 'all') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        dateFiltered = baseFiltered.filter(customer => {
            const assignedDate = new Date(customer.dateAssigned);
            assignedDate.setHours(0, 0, 0, 0);

            switch (activeDatePreset) {
                case 'today': return assignedDate.getTime() === today.getTime();
                case 'yesterday':
                    const yesterday = new Date(today);
                    yesterday.setDate(today.getDate() - 1);
                    return assignedDate.getTime() === yesterday.getTime();
                case '7days':
                    const sevenDaysAgo = new Date(today);
                    sevenDaysAgo.setDate(today.getDate() - 6);
                    return assignedDate >= sevenDaysAgo && assignedDate <= today;
                case '30days':
                    const thirtyDaysAgo = new Date(today);
                    thirtyDaysAgo.setDate(today.getDate() - 29);
                    return assignedDate >= thirtyDaysAgo && assignedDate <= today;
                case 'range':
                    if (!dateRange.start || !dateRange.end) return true;
                    const startDate = new Date(dateRange.start);
                    startDate.setHours(0, 0, 0, 0);
                    const endDate = new Date(dateRange.end);
                    endDate.setHours(0, 0, 0, 0);
                    return assignedDate >= startDate && assignedDate <= endDate;
                default: return true;
            }
        });
    }

    // Apply text, tag, grade, and province filters
    let filtered = dateFiltered.filter(customer => {
        const lowerSearchTerm = appliedSearchTerm.toLowerCase();
        const matchesSearch = appliedSearchTerm ? 
            (`${customer.firstName} ${customer.lastName}`.toLowerCase().includes(lowerSearchTerm) || customer.phone.includes(lowerSearchTerm)) 
            : true;

        const matchesTags = selectedTagIds.length > 0 ? 
            customer.tags.some(t => selectedTagIds.includes(t.id))
            : true;

        const matchesGrades = selectedGrades.length > 0 ?
            selectedGrades.includes(customer.grade)
            : true;

        const matchesProvinces = selectedProvinces.length > 0 ?
            selectedProvinces.includes(customer.province)
            : true;

        const matchesExpiryDays = selectedExpiryDays !== null ?
            (() => {
                if (!customer.ownershipExpires) return false;
                const daysUntilExpiry = getDaysUntilExpiration(customer.ownershipExpires);
                return daysUntilExpiry <= selectedExpiryDays && daysUntilExpiry >= 0;
            })()
            : true;

        return matchesSearch && matchesTags && matchesGrades && matchesProvinces && matchesExpiryDays;
    });

    // Apply hide today calls filters
    if (hideTodayCalls || hideTodayCallsRangeEnabled) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      filtered = filtered.filter(customer => {
        // Check if customer has any activity today
        const hasActivityToday = safeActivities.some(activity => {
          if (activity.customerId !== customer.id) return false;
          const activityDate = new Date(activity.timestamp);
          activityDate.setHours(0, 0, 0, 0);
          
          if (hideTodayCalls) {
            return activityDate.getTime() === today.getTime();
          }
          
          if (hideTodayCallsRangeEnabled && hideTodayCallsRange.start && hideTodayCallsRange.end) {
            const startDate = new Date(hideTodayCallsRange.start);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(hideTodayCallsRange.end);
            endDate.setHours(0, 0, 0, 0);
            return activityDate >= startDate && activityDate <= endDate;
          }
          
          return false;
        });
        
        // Return false if customer has activity today and we want to hide them
        return !hasActivityToday;
      });
    }

    // Apply sorting
    if (sortBy !== "system" || sortByExpiry !== "") {
      filtered = [...filtered].sort((a, b) => {
        // First apply expiry date sorting if specified
        if (sortByExpiry !== "" && a.ownershipExpires && b.ownershipExpires) {
          const daysA = getDaysUntilExpiration(a.ownershipExpires);
          const daysB = getDaysUntilExpiration(b.ownershipExpires);
          
          if (sortByExpiry === "desc") {
            return daysA - daysB; // More days remaining first
          } else {
            return daysB - daysA; // Fewer days remaining first
          }
        }
        
        // Then apply system sorting
        switch (sortBy) {
          case "name":
            return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
          case "name-desc":
            return `${b.firstName} ${b.lastName}`.localeCompare(`${a.firstName} ${a.lastName}`);
          case "date-assigned":
            return new Date(a.dateAssigned).getTime() - new Date(b.dateAssigned).getTime();
          case "date-assigned-desc":
            return new Date(b.dateAssigned).getTime() - new Date(a.dateAssigned).getTime();
          default:
            return 0; // Keep original order
        }
      });
    }

    return filtered;
  }, [activeSubMenu, userCustomers, appointments, activities, selectedLifecycleStatuses, activeDatePreset, dateRange, appliedSearchTerm, selectedTagIds, selectedGrades, selectedProvinces, selectedExpiryDays, sortBy, sortByExpiry, hideTodayCalls, hideTodayCallsRangeEnabled, hideTodayCallsRange]);
  
  const handleDatePresetClick = (preset: string) => {
    setActiveDatePreset(preset);
    setDateRange({ start: '', end: '' });
  };

  const handleClearAllFilters = () => {
    setSearchTerm('');
    setAppliedSearchTerm('');
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
      count: doCounts.followUp + doCounts.daily + doCounts.new,
    },
    {
      id: 'expiring',
      label: 'ใกล้หมด',
      icon: Clock,
      count: doCounts.expiring,
    },
    { id: 'all', label: 'ลูกค้าทั้งหมด', icon: Users, count: userCustomers.length },
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
        <button onClick={() => setActivePage ? setActivePage('สร้างคำสั่งซื้อ') : openModal('createOrder', undefined)} className="bg-green-100 text-green-700 font-semibold text-sm rounded-md py-2 px-4 flex items-center hover:bg-green-200 shadow-sm">
            <PlusCircle className="w-4 h-4 mr-2" />
            สร้างคำสั่งซื้อ
        </button>
      </div>
      
      <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
        {menuItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveSubMenu(item.id as SubMenu)}
            className={`flex-shrink-0 flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeSubMenu === item.id
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <item.icon size={16} />
            <span>{item.label}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeSubMenu === item.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
            }`}>{item.count}</span>
          </button>
        ))}
      </div>

      {/* Advanced Filters Toggle + Panel (wrapped for click-away) */}
      <div ref={advRef}>
        <div className="bg-white p-3 rounded-lg shadow mb-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setShowAdvanced(v => !v)} className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border hover:bg-gray-50">
              {showAdvanced ? 'ซ่อนตัวกรองขั้นสูง' : 'แสดงตัวกรองขั้นสูง'}
            </button>
            <button onClick={() => setAppliedSearchTerm(searchTerm)} className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border bg-blue-50 text-blue-700 hover:bg-blue-100">
              ค้นหา
            </button>
            {(appliedSearchTerm || selectedTagIds.length > 0 || selectedGrades.length > 0 || selectedProvinces.length > 0 || selectedLifecycleStatuses.length > 0 || selectedExpiryDays !== null || activeDatePreset !== 'all' || (dateRange.start || dateRange.end) || sortBy !== "system" || sortByExpiry !== "" || hideTodayCalls || hideTodayCallsRangeEnabled) && (
              <button onClick={handleClearAllFilters} className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border hover:bg-gray-50 text-gray-600">
                ล้างตัวกรอง
              </button>
            )}
          </div>
        </div>

        {/* Advanced Filters Panel */}
        <div className={`bg-white p-4 rounded-lg shadow mb-6 ${showAdvanced ? 'block' : 'hidden'}`}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* ช่องค้นหา */}
            <div className="md:col-span-3">
                <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="ค้นหาชื่อ หรือเบอร์โทร..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>
            </div>
            
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
                    <Calendar size={16} className="text-gray-500 mr-2"/>
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
      
      <CustomerTable 
        customers={filteredCustomers} 
        onViewCustomer={onViewCustomer} 
        openModal={openModal}
        showCallNotes={activeSubMenu === 'all'}
        hideGrade={true}
      />
    </div>
  );
};

export default TelesaleDashboard;
