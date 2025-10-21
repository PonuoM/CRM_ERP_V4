import React, { useState, useMemo, useRef, useEffect } from 'react';
import { User, Customer, CustomerLifecycleStatus, ModalType, Tag, CustomerGrade, Appointment, Activity } from '../types';
import CustomerTable from '../components/CustomerTable';
import { ListTodo, Users, Search, ChevronDown, Calendar, PlusCircle, Filter, Check, Clock, UserPlus, Star, X } from 'lucide-react';

interface TelesaleDashboardProps {
  user: User;
  customers: Customer[];
  appointments?: Appointment[];
  activities?: Activity[];
  onViewCustomer: (customer: Customer) => void;
  openModal: (type: ModalType, data: any) => void;
  systemTags: Tag[];
  setActivePage?: (page: string) => void;
}

type SubMenu = 'do' | 'all';

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
  const { user, customers, appointments, activities, onViewCustomer, openModal, systemTags, setActivePage } = props;
  
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
          selectedTagIds: parsed.selectedTagIds || [],
          selectedGrades: parsed.selectedGrades || [],
          selectedProvinces: parsed.selectedProvinces || [],
          selectedLifecycleStatuses: parsed.selectedLifecycleStatuses || [],
          selectedExpiryDays: parsed.selectedExpiryDays || null,
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
      selectedTagIds: [],
      selectedGrades: [],
      selectedProvinces: [],
      selectedLifecycleStatuses: [],
      selectedExpiryDays: null,
    };
  };

  const savedState = loadFilterState();
  
  const [activeSubMenu, setActiveSubMenu] = useState<SubMenu>(savedState.activeSubMenu);
  const [activeDatePreset, setActiveDatePreset] = useState(savedState.activeDatePreset);
  const [dateRange, setDateRange] = useState(savedState.dateRange);
  const [searchTerm, setSearchTerm] = useState(savedState.searchTerm);

  // Filter states
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(savedState.selectedTagIds);
  const [selectedGrades, setSelectedGrades] = useState<CustomerGrade[]>(savedState.selectedGrades);
  const [selectedProvinces, setSelectedProvinces] = useState<string[]>(savedState.selectedProvinces);
  const [selectedLifecycleStatuses, setSelectedLifecycleStatuses] = useState<CustomerLifecycleStatus[]>(savedState.selectedLifecycleStatuses);
  const [selectedExpiryDays, setSelectedExpiryDays] = useState<number | null>(savedState.selectedExpiryDays);

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
      selectedTagIds,
      selectedGrades,
      selectedProvinces,
      selectedLifecycleStatuses,
      selectedExpiryDays,
    };
    
    try {
      localStorage.setItem(filterStorageKey, JSON.stringify(filterState));
    } catch (error) {
      console.warn('Failed to save filter state:', error);
    }
  }, [activeSubMenu, activeDatePreset, dateRange, searchTerm, selectedTagIds, selectedGrades, selectedProvinces, selectedLifecycleStatuses, selectedExpiryDays, filterStorageKey]);

  const allAvailableTags = useMemo(() => [...systemTags, ...user.customTags], [systemTags, user.customTags]);
  const allProvinces = useMemo(() => [...new Set(userCustomers.map(c => c.province).filter(Boolean))].sort(), [userCustomers]);

  // Calculate Do dashboard counts
  const doCounts = useMemo(() => {
    // Handle case where appointments or activities might be undefined
    const safeAppointments = appointments || [];
    const safeActivities = activities || [];
    
    const now = new Date();
    const counts = {
      followUp: 0,
      expiring: 0,
      daily: 0,
      new: 0
    };

    userCustomers.forEach(customer => {
      // Check for upcoming follow-ups (due within 2 days)
      const upcomingAppointments = safeAppointments.filter(appt => 
        appt.customerId === customer.id && 
        appt.status !== 'เสร็จสิ้น' &&
        new Date(appt.date) <= new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)
      );
      
      if (upcomingAppointments.length > 0) {
        counts.followUp++;
        return; // Customer is in follow-up category, no need to check other categories
      }
      
      // Check for expiring ownership (within 5 days)
      if (customer.ownershipExpires) {
        const daysUntilExpiry = getDaysUntilExpiration(customer.ownershipExpires);
        if (daysUntilExpiry <= 5 && daysUntilExpiry >= 0) {
          counts.expiring++;
          return;
        }
      }
      
      // Check for daily distribution customers with no activity
      if (customer.lifecycleStatus === CustomerLifecycleStatus.DailyDistribution && !hasActivity(customer, safeActivities)) {
        const assignedDate = new Date(customer.dateAssigned);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        assignedDate.setHours(0, 0, 0, 0);
        if (assignedDate.getTime() === today.getTime()) {
          counts.daily++;
          return;
        }
      }
      
      // Check for new customers with no activity
      if (customer.lifecycleStatus === CustomerLifecycleStatus.New && !hasActivity(customer, safeActivities)) {
        counts.new++;
        return;
      }
    });

    return counts;
  }, [userCustomers, appointments, activities]);

  const filteredCustomers = useMemo(() => {
    // Handle case where appointments or activities might be undefined
    const safeAppointments = appointments || [];
    const safeActivities = activities || [];
    
    let baseFiltered;
    const now = new Date();
    
    switch (activeSubMenu) {
      case 'do':
        // Filter customers that should appear in the Do dashboard
        baseFiltered = userCustomers.filter(c => isInDoDashboard(c, safeAppointments, safeActivities, now));
        // Add reason for each customer
        baseFiltered = baseFiltered.map(customer => ({
          ...customer,
          doReason: getDoReason(customer, safeAppointments, safeActivities, now)
        }));
        break;
      case 'all':
      default:
        baseFiltered = userCustomers;
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
    return dateFiltered.filter(customer => {
        const lowerSearchTerm = searchTerm.toLowerCase();
        const matchesSearch = searchTerm ? 
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

  }, [activeSubMenu, userCustomers, appointments, activities, selectedLifecycleStatuses, activeDatePreset, dateRange, searchTerm, selectedTagIds, selectedGrades, selectedProvinces, selectedExpiryDays]);
  
  const handleDatePresetClick = (preset: string) => {
    setActiveDatePreset(preset);
    setDateRange({ start: '', end: '' });
  };

  const handleClearAllFilters = () => {
    setSearchTerm('');
    setSelectedTagIds([]);
    setSelectedGrades([]);
    setSelectedProvinces([]);
    setSelectedLifecycleStatuses([]);
    setSelectedExpiryDays(null);
    setActiveDatePreset('all');
    setDateRange({ start: '', end: '' });
    
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
      count: doCounts.followUp + doCounts.expiring + doCounts.daily + doCounts.new,
      subCounts: doCounts
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
            {activeSubMenu === 'do' && item.subCounts && (
              <div className="flex space-x-1">
                <span className="px-1 py-0.5 bg-red-100 text-red-600 rounded text-xs">นัด: {item.subCounts.followUp}</span>
                <span className="px-1 py-0.5 bg-orange-100 text-orange-600 rounded text-xs">ใกล้หมด: {item.subCounts.expiring}</span>
                <span className="px-1 py-0.5 bg-blue-100 text-blue-600 rounded text-xs">แจกรายวัน: {item.subCounts.daily}</span>
                <span className="px-1 py-0.5 bg-green-100 text-green-600 rounded text-xs">ใหม่: {item.subCounts.new}</span>
              </div>
            )}
          </button>
        ))}
      </div>

      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-shrink-0" style={{minWidth: '200px'}}>
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="ค้นหาชื่อ หรือเบอร์โทร..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div className="flex-shrink-0">
                <FilterDropdown title="Tag" options={allAvailableTags} selected={selectedTagIds} onSelect={(id) => handleFilterSelect(setSelectedTagIds, selectedTagIds, id as number)} />
            </div>
            <div className="flex-shrink-0">
                <FilterDropdown title="เกรด" options={Object.values(CustomerGrade).map(g => ({id: g, name: g}))} selected={selectedGrades} onSelect={(id) => handleFilterSelect(setSelectedGrades, selectedGrades, id as CustomerGrade)} />
            </div>
            <div className="flex-shrink-0">
                <FilterDropdown title="จังหวัด" options={allProvinces.map(p => ({id: p, name: p}))} selected={selectedProvinces} onSelect={(id) => handleFilterSelect(setSelectedProvinces, selectedProvinces, id as string)} />
            </div>
            <div className="flex-shrink-0">
                <FilterDropdown title="ประเภท" options={lifecycleStatusOptions} selected={selectedLifecycleStatuses} onSelect={(id) => handleFilterSelect(setSelectedLifecycleStatuses, selectedLifecycleStatuses, id as CustomerLifecycleStatus)} />
            </div>
            <div className="flex-shrink-0">
                <FilterDropdown title="เวลาที่เหลือ" options={[
                    {id: 10, name: 'ต่ำกว่า 10 วัน'},
                    {id: 20, name: 'ต่ำกว่า 20 วัน'},
                    {id: 30, name: 'ต่ำกว่า 30 วัน'},
                    {id: 60, name: 'ต่ำกว่า 60 วัน'},
                    {id: 90, name: 'ต่ำกว่า 90 วัน'}
                ]} selected={selectedExpiryDays ? [selectedExpiryDays] : []} onSelect={(id) => setSelectedExpiryDays(selectedExpiryDays === id ? null : id as number)} />
            </div>
            <div className="flex-shrink-0">
                <button 
                    onClick={handleClearAllFilters}
                    className="flex items-center px-3 py-2 text-sm text-gray-600 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 hover:text-gray-800 transition-colors"
                >
                    <X size={14} className="mr-1" />
                    ล้าง
                </button>
            </div>
        </div>
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
      
      <CustomerTable 
        customers={filteredCustomers} 
        onViewCustomer={onViewCustomer} 
        openModal={openModal}
      />
    </div>
  );
};

export default TelesaleDashboard;