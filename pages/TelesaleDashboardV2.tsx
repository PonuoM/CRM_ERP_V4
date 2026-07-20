/**
 * TelesaleDashboardV2 - Basket-based customer management dashboard
 * 
 * NEW V2 Features:
 * - Tab navigation by BasketType (Upsell, NewCustomer, Month1_2, Month3, LastChance, Archive)
 * - Region filtering (เหนือ, อีสาน, กลาง, ใต้, ตะวันตก)
 * - Based on last_order_date instead of ownership_expires
 */

import React, { useState, useMemo, useEffect, useDeferredValue, useTransition, useCallback, useRef } from "react";
import { User, Customer, CustomerGrade, ModalType, Tag, Activity, CallHistory, Order as OrderType, Appointment } from "@/types";
import CustomerTable from "@/components/CustomerTable";
import RegionFilter from "@/components/RegionFilter";
import FilterDropdown from "@/components/FilterDropdown";
import Spinner from "@/components/Spinner";
import { RefreshCw, Search, Filter, ChevronDown, ChevronLeft, ChevronRight, Phone, ShoppingCart, Plus, FileText, Eye, Calendar, X, Settings, RotateCcw, Cake } from "lucide-react";
import {
    filterCustomersByRegion,
} from "@/utils/basketUtils";
import { useBasketConfig, groupCustomersByDynamicBaskets, DynamicBasketConfig } from "@/hooks/useBasketConfig";
import { formatThaiDate, getDaysSince, formatRelativeTime } from "@/utils/dateUtils";
import { listCustomers, apiFetch, getBatchUpsellStatus } from "@/services/api";
import { mapCustomerFromApi } from "@/utils/customerMapper";
// NOTE: syncCustomers and db removed - Dashboard now uses propsCustomers directly
import usePersistentState from "@/utils/usePersistentState";
import DateRangePicker, { DateRange } from "@/components/DateRangePicker";

interface TelesaleDashboardV2Props {
    user: User;
    customers: Customer[];
    appointments?: Appointment[];
    activities?: Activity[];
    calls?: CallHistory[];
    orders?: OrderType[];
    onViewCustomer: (customer: Customer) => void;
    openModal: (type: ModalType, data: any) => void;
    systemTags: Tag[];
    setActivePage?: (page: string) => void;
    onChangeOwner?: (customerId: string, newOwnerId: number) => Promise<void> | void;
    allUsers?: User[];
    refreshTrigger?: number;
}

// Helper function to get contrasting text color (black or white)
const getContrastColor = (hexColor: string): string => {
    const color = hexColor.replace('#', '');
    const r = parseInt(color.substr(0, 2), 16);
    const g = parseInt(color.substr(2, 2), 16);
    const b = parseInt(color.substr(4, 2), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 128 ? '#000000' : '#FFFFFF';
};

const TagColumn: React.FC<{
    customer: Customer;
    openModal: (type: ModalType, data: any) => void;
    hasUpsell?: boolean;
    upsellDone?: boolean;
}> = ({ customer, openModal, hasUpsell, upsellDone }) => {
    const visibleTags = customer.tags ? customer.tags.slice(0, 2) : [];
    const hiddenCount = (customer.tags?.length || 0) - visibleTags.length;

    return (
        <div className="flex items-center flex-wrap gap-1">
            {/* Upsell Tag - Orange, pulsing */}
            {hasUpsell && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap bg-gradient-to-r from-red-500 to-orange-500 text-white animate-pulse">
                    🔥 Upsell
                </span>
            )}

            {/* Upsell Done Tag - Green */}
            {upsellDone && !hasUpsell && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap bg-green-100 text-green-800 border border-green-300">
                    ✓ Upsell
                </span>
            )}

            {visibleTags.map((tag) => {
                const tagColor = tag.color || '#9333EA';
                const bgColor = tagColor.startsWith('#') ? tagColor : `#${tagColor}`;
                const textColor = getContrastColor(bgColor);
                return (
                    <span
                        key={tag.id}
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={{ backgroundColor: bgColor, color: textColor }}
                    >
                        {tag.name}
                    </span>
                );
            })}
            {hiddenCount > 0 && (
                <span className="bg-gray-200 text-gray-700 text-[10px] font-medium px-1.5 py-0.5 rounded-full cursor-pointer" title={customer.tags?.slice(2).map(t => t.name).join(", ")}>
                    +{hiddenCount}
                </span>
            )}
            <button
                title="จัดการ TAG"
                onClick={() => openModal && openModal("manageTags", customer)}
                className="p-1 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600"
            >
                <Plus size={12} />
            </button>
        </div>
    );
};

const MemoizedTagColumn = React.memo(TagColumn);

// Status Display Component (plain text with details)
type ContactStatus = 'appointment' | 'contacted' | 'callback' | 'not_contacted';

const getContactStatus = (
    hasLastCall: boolean,
    hasAppointment?: boolean,
    lastCallResult?: string
): ContactStatus => {
    if (hasAppointment) return 'appointment';
    if (hasLastCall) {
        const result = (lastCallResult || '').toLowerCase();
        if (result.includes('โทรกลับ') || result.includes('ไม่รับสาย') || result.includes('ไม่ติด')) {
            return 'callback';
        }
        return 'contacted';
    }
    return 'not_contacted';
};

const StatusDisplay: React.FC<{
    hasLastCall: boolean;
    callCount: number;
    hasAppointment?: boolean;
    daysUntilAppointment?: number;
    appointmentDate?: string;
    lastCallResult?: string;
}> = ({ hasLastCall, callCount, hasAppointment, daysUntilAppointment, appointmentDate, lastCallResult }) => {
    const status = getContactStatus(hasLastCall, hasAppointment, lastCallResult);

    // Determine if appointment is overdue
    const isOverdue = status === 'appointment' && daysUntilAppointment !== undefined && daysUntilAppointment < 0;

    const statusConfig = {
        appointment: {
            label: isOverdue ? 'เลยนัดหมาย' : 'นัดเรียบร้อย',
            color: isOverdue ? 'text-red-600' : 'text-blue-600'
        },
        contacted: { label: 'โทรแล้ว', color: 'text-green-600' },
        callback: { label: 'รอติดต่อ', color: 'text-orange-600' },
        not_contacted: { label: 'ยังไม่โทร', color: 'text-gray-500' }
    };

    const { label, color } = statusConfig[status];

    // Detail text on second line
    let detail = '';
    if (status === 'appointment' && daysUntilAppointment !== undefined) {
        if (daysUntilAppointment < 0) detail = `เลย ${Math.abs(daysUntilAppointment)} วัน`;
        else if (daysUntilAppointment === 0) detail = 'วันนี้';
        else if (daysUntilAppointment === 1) detail = 'พรุ่งนี้';
        else detail = `อีก ${daysUntilAppointment} วัน`;
        
        if (appointmentDate) {
            const aptTime = new Date(appointmentDate.replace(' ', 'T')).toLocaleTimeString("th-TH", {
                hour: "2-digit",
                minute: "2-digit"
            });
            detail += ` (${aptTime} น.)`;
        }
    } else if (status === 'contacted' || status === 'callback') {
        // Show call count if available, otherwise just show status
        detail = callCount > 0 ? `${callCount} ครั้ง` : '';
    }

    return (
        <div className="text-sm">
            <div className={`font-medium ${color}`}>{label}</div>
            {detail && <div className={`text-xs ${isOverdue ? 'text-red-400' : 'text-gray-400'}`}>{detail}</div>}
        </div>
    );
};

// Upcoming Appointments Panel Component
interface AppointmentWithCustomer {
    appointment: Appointment;
    customer?: Customer;
    daysUntil: number;
    basketKey?: string;
    basketName?: string;
}

const UpcomingAppointmentsPanel: React.FC<{
    appointments: Appointment[];
    customers: Customer[];
    basketGroups: Map<string, Customer[]>;
    tabConfigs: Array<{ key: string; name: string }>;
    onViewCustomer: (customer: Customer) => void;
    isOpen: boolean;
    onToggle: () => void;
    isFilterActive?: boolean;
    onFilterToggle?: () => void;
}> = ({ appointments, customers, basketGroups, tabConfigs, onViewCustomer, isOpen, onToggle, isFilterActive = false, onFilterToggle }) => {
    // Create customer map for quick lookup
    const customerMap = useMemo(() => {
        const map = new Map<string, Customer>();
        customers.forEach(c => map.set(String(c.id), c));
        return map;
    }, [customers]);

    // Get upcoming appointments (not completed, today or future), sorted by date
    // ONLY include appointments for customers in our customerMap (assigned to current user)
    const upcomingAppointments = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Helper function to find which basket a customer belongs to
        const findCustomerBasket = (customerId: string): { key: string; name: string } | null => {
            for (const [basketKey, customersInBasket] of basketGroups.entries()) {
                if (customersInBasket.some(c => String(c.id) === customerId)) {
                    const tabConfig = tabConfigs.find(t => t.key === basketKey);
                    return tabConfig ? { key: basketKey, name: tabConfig.name } : { key: basketKey, name: basketKey };
                }
            }
            return null;
        };

        return appointments
            .filter(apt => {
                if (apt.status === 'เสร็จสิ้น') return false;
                // IMPORTANT: Only include if the customer is in our customerMap (assigned to current user)
                if (!customerMap.has(String(apt.customerId))) return false;
                const aptDate = new Date(apt.date);
                aptDate.setHours(0, 0, 0, 0);
                return aptDate >= today;
            })
            .map(apt => {
                const aptDate = new Date(apt.date);
                aptDate.setHours(0, 0, 0, 0);
                const daysUntil = Math.ceil((aptDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                const customer = customerMap.get(String(apt.customerId));
                const basket = customer ? findCustomerBasket(String(customer.id)) : null;

                return {
                    appointment: apt,
                    customer,
                    daysUntil,
                    basketKey: basket?.key,
                    basketName: basket?.name
                };
            })
            .sort((a, b) => a.daysUntil - b.daysUntil);
    }, [appointments, customerMap, basketGroups, tabConfigs]);

    const getDaysLabel = (days: number) => {
        if (days === 0) return <span className="text-red-600 font-semibold">วันนี้</span>;
        if (days === 1) return <span className="text-orange-600 font-semibold">พรุ่งนี้</span>;
        if (days <= 3) return <span className="text-yellow-600">อีก {days} วัน</span>;
        return <span className="text-gray-500">อีก {days} วัน</span>;
    };

    // Count appointments by basket
    const appointmentsByBasket = useMemo(() => {
        const counts = new Map<string, { count: number; name: string }>();
        upcomingAppointments.forEach(apt => {
            if (apt.basketKey) {
                const existing = counts.get(apt.basketKey) || { count: 0, name: apt.basketName || apt.basketKey };
                counts.set(apt.basketKey, { count: existing.count + 1, name: existing.name });
            }
        });
        return counts;
    }, [upcomingAppointments]);

    // Handle button click - toggle filter if onFilterToggle is provided
    const handleButtonClick = () => {
        if (onFilterToggle) {
            onFilterToggle();
        } else {
            onToggle();
        }
    };

    return (
        <div className="relative group">
            {/* Toggle/Filter Button */}
            <button
                onClick={handleButtonClick}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all border ${isFilterActive
                    ? "bg-green-100 border-green-400 text-green-700"
                    : "bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                    }`}
            >
                <Calendar size={18} />
                <span className="font-medium">นัดหมายใกล้ถึง</span>
                {isFilterActive && (
                    <span className="text-xs text-green-600 font-medium">(กำลังกรอง)</span>
                )}
            </button>



            {/* Panel Content - shows when isOpen is true */}
            {isOpen && !isFilterActive && (
                <div className="absolute left-0 top-full mt-2 bg-white rounded-2xl border border-gray-200 shadow-xl z-50 overflow-hidden max-h-[400px] overflow-y-auto min-w-[320px]">
                    {upcomingAppointments.length === 0 ? (
                        <div className="p-6 text-center text-gray-500">
                            <Calendar size={32} className="mx-auto mb-2 text-gray-300" />
                            <p>ไม่มีนัดหมายที่ใกล้ถึง</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {upcomingAppointments.map((item, idx) => (
                                <div
                                    key={item.appointment.id || idx}
                                    className="p-4 hover:bg-blue-50/50 cursor-pointer transition-colors"
                                    onClick={() => item.customer && onViewCustomer(item.customer)}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="font-medium text-gray-800">
                                                {item.customer?.firstName} {item.customer?.lastName}
                                            </div>
                                            <div className="text-sm text-gray-500 mt-0.5">
                                                {item.customer?.phone}
                                            </div>
                                            {item.appointment.title && (
                                                <div className="text-sm text-gray-600 mt-1">
                                                    📝 {item.appointment.title}
                                                </div>
                                            )}
                                            {item.basketName && (
                                                <div className="text-xs mt-1">
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                                                        📁 {item.basketName}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm">
                                                {getDaysLabel(item.daysUntil)}
                                            </div>
                                            <div className="text-xs text-gray-400 mt-0.5">
                                                {formatThaiDate(new Date(item.appointment.date))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};


const CustomerRow = React.memo(({
    customer,
    onViewCustomer,
    openModal,
    activeBasket,
    lastCall,
    hasAppointment,
    callCount,
    daysUntilAppointment,
    hasUpsell,
    upsellDone,
    showBirthday
}: {
    customer: Customer;
    onViewCustomer: (c: Customer) => void;
    openModal: (t: ModalType, d: any) => void;
    activeBasket: string;
    lastCall?: CallHistory;
    hasAppointment?: boolean;
    callCount: number;
    daysUntilAppointment?: number;
    hasUpsell?: boolean;
    upsellDone?: boolean;
    showBirthday?: boolean;
}) => {
    const daysSince = getDaysSince(customer.lastOrderDate);

    return (
        <tr
            className="hover:bg-blue-50/50 transition-colors"
        >
            <td className="px-4 py-3">
                <div>
                    <div className="font-medium text-gray-800">
                        {customer.firstName} {customer.lastName}
                    </div>
                    <div className="text-xs text-gray-500">
                        {customer.orderCount || 0} ออเดอร์ (฿{(customer.totalPurchases || 0).toLocaleString()})
                    </div>
                </div>
            </td>
            <td className="px-2 py-3 text-center">
                {customer.grade ? (
                    <span
                        className={`inline-flex items-center justify-center min-w-[26px] px-1.5 py-0.5 rounded text-xs font-bold ${
                            customer.grade === "A+" ? "bg-emerald-100 text-emerald-700" :
                            customer.grade === "A" ? "bg-green-100 text-green-700" :
                            customer.grade === "B" ? "bg-blue-100 text-blue-700" :
                            customer.grade === "C" ? "bg-yellow-100 text-yellow-700" :
                            customer.grade === "D" ? "bg-orange-100 text-orange-700" :
                            "bg-gray-100 text-gray-600"
                        }`}
                    >
                        {customer.grade}
                    </span>
                ) : (
                    <span className="text-xs text-gray-400">-</span>
                )}
            </td>
            <td className="px-4 py-3">
                <StatusDisplay
                    hasLastCall={callCount > 0}
                    callCount={callCount}
                    hasAppointment={hasAppointment}
                    daysUntilAppointment={daysUntilAppointment}
                    appointmentDate={(customer as any).next_appointment_date}
                    lastCallResult={(customer as any).last_call_result_by_owner}
                />
            </td>
            <td className="px-4 py-3">
                <span className="text-gray-700 flex items-center gap-1">
                    <Phone size={14} className="text-gray-400" />
                    {customer.phone}
                </span>
            </td>
            <td className="px-4 py-3 text-gray-600">{customer.province || "-"}</td>
            <td className="px-4 py-3 text-gray-600">
                {customer.dateAssigned ? formatThaiDate(new Date(customer.dateAssigned)) : "-"}
            </td>
            {showBirthday && (
                <td className="px-4 py-3">
                    {customer.birthDate ? (
                        <div className="flex items-center gap-1">
                            <Cake size={14} className="text-pink-400" />
                            <span className="text-gray-700">
                                {new Date(customer.birthDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                            </span>
                        </div>
                    ) : (
                        <span className="text-gray-400">-</span>
                    )}
                </td>
            )}
            <td className="px-4 py-3">
                {customer.lastOrderDate ? (
                    <div>
                        <div className="text-gray-700">{formatThaiDate(new Date(customer.lastOrderDate))}</div>
                        <div className="text-xs text-gray-400">{daysSince} วันก่อน</div>
                    </div>
                ) : (
                    <span className="text-gray-400">-</span>
                )}
            </td>
            <td className="px-4 py-3">
                <div className="max-w-[150px]">
                    {(customer as any).lastCallNote ? (
                        <p className="text-xs text-gray-700 truncate" title={(customer as any).lastCallNote}>
                            {(customer as any).lastCallNote}
                        </p>
                    ) : (
                        <span className="text-xs text-gray-400">-</span>
                    )}
                </div>
            </td>
            <td className="px-4 py-3">
                <MemoizedTagColumn customer={customer} openModal={openModal} hasUpsell={hasUpsell} upsellDone={upsellDone} />
            </td>
            <td className="px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onViewCustomer(customer);
                        }}
                        className="p-2 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                        title="ดูรายละเอียดลูกค้า"
                    >
                        <Eye size={16} />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            openModal("logCall", customer);
                        }}
                        className="p-2 rounded-lg bg-green-100 text-green-600 hover:bg-green-200 transition-colors"
                        title="บันทึกการโทร"
                    >
                        <Phone size={16} />
                    </button>
                </div>
            </td>
        </tr>
    );
});

const TelesaleDashboardV2: React.FC<TelesaleDashboardV2Props> = (props) => {
    const {
        user,
        customers: propsCustomers,
        appointments,
        activities,
        calls,
        orders,
        onViewCustomer,
        openModal,
        systemTags,

        refreshTrigger
    } = props;

    // State
    const [localCustomers, setLocalCustomers] = useState<Customer[]>([]);



    // Fetch dynamic basket configs from API
    const { configs: basketConfigs, loading: basketConfigLoading } = useBasketConfig(user.companyId, 'dashboard_v2');

    // Use basket_key string instead of enum for dynamic baskets
    const [activeBasketKey, setActiveBasketKey] = usePersistentState<string>(
        `telesale_v2_basket_${user.id}`,
        ''
    );
    const [selectedRegions, setSelectedRegions] = usePersistentState<string[]>(
        `telesale_v2_regions_${user.id}`,
        []
    );
    const deferredSelectedRegions = useDeferredValue(selectedRegions);
    const [selectedTagIds, setSelectedTagIds] = usePersistentState<number[]>(
        `telesale_v2_tags_${user.id}`,
        []
    );
    const deferredSelectedTagIds = useDeferredValue(selectedTagIds);
    const [selectedGrades, setSelectedGrades] = usePersistentState<string[]>(
        `telesale_v2_grades_${user.id}`,
        []
    );
    const deferredSelectedGrades = useDeferredValue(selectedGrades);
    const [searchTerm, setSearchTerm] = useState("");
    const [activeSearchTerm, setActiveSearchTerm] = useState(""); // Only updates on Enter/button click
    const [isPending, startTransition] = useTransition();

    // Handle search on Enter key or button click
    const handleSearch = () => {
        // Clear all filters when searching to avoid missing results
        if (searchTerm.trim()) {
            setSelectedRegions([]);
            setSelectedTagIds([]);
            setUpcomingAppointmentFilter("off");
            setFilterByOverdueAppointment(false);
            setHideContactedFilter("off");
        }
        setActiveSearchTerm(searchTerm);
    };

    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const [sortBy, setSortBy] = usePersistentState<"lastOrder" | "name" | "grade" | "dateAssignedNewest" | "dateAssignedOldest">(`telesale_v2_sortby_${user.id}`, "dateAssignedNewest");
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);



    // Pagination
    const [pageSize, setPageSize] = usePersistentState<number>(`telesale_v2_pagesize_${user.id}`, 50);
    const [currentPage, setCurrentPage] = useState(1);

    // Quick Filters
    type QuickFilter = "all" | "uncontacted" | "contacted" | "highGrade";
    const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
    const deferredQuickFilter = useDeferredValue(quickFilter);

    // Appointment Filter using DateRangePicker
    type UpcomingFilter = "off" | "all" | "1" | "3" | "7";
    const [upcomingAppointmentFilter, setUpcomingAppointmentFilter] = useState<UpcomingFilter>("off");
    const [isUpcomingDropdownOpen, setIsUpcomingDropdownOpen] = useState(false);
    const upcomingDropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (upcomingDropdownRef.current && !upcomingDropdownRef.current.contains(event.target as Node)) {
                setIsUpcomingDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Overdue Appointment Filter (show only customers with overdue appointments)
    const [filterByOverdueAppointment, setFilterByOverdueAppointment] = useState(false);

    // Hide Contacted Custom Dropdown Filter
    type HideContactedFilter = "off" | "all" | "1" | "3" | "7" | "custom";
    const [hideContactedFilter, setHideContactedFilter] = useState<HideContactedFilter>("off");
    const [hideContactedCustomRange, setHideContactedCustomRange] = useState<{start: string, end: string}>({ start: '', end: '' });
    
    // Local state for the inputs inside the dropdown before applying
    const [tempCustomRange, setTempCustomRange] = useState<{start: string, end: string}>({ start: '', end: '' });
    
    const [isHideContactedDropdownOpen, setIsHideContactedDropdownOpen] = useState(false);
    const hideContactedDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (hideContactedDropdownRef.current && !hideContactedDropdownRef.current.contains(event.target as Node)) {
                setIsHideContactedDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Advanced Settings Panel toggle
    const [isAdvancedSettingsOpen, setIsAdvancedSettingsOpen] = useState(false);

    // Sort by upcoming birthday
    const [sortByBirthday, setSortByBirthday] = useState(false);

    // Show Contacted Filter
    const [showContactedDateRange, setShowContactedDateRange] = useState<DateRange>({ start: '', end: '' });

    // Check if any filters are active (including search)
    const hasActiveFilters = selectedRegions.length > 0 || selectedTagIds.length > 0 || selectedGrades.length > 0 || upcomingAppointmentFilter !== "off" || filterByOverdueAppointment || hideContactedFilter !== "off" || activeSearchTerm || sortByBirthday || showContactedDateRange.start !== '' || showContactedDateRange.end !== '';

    // Clear all filters (including search)
    const clearAllFilters = () => {
        setSelectedRegions([]);
        setSelectedTagIds([]);
        setSelectedGrades([]);
        setUpcomingAppointmentFilter("off");
        setFilterByOverdueAppointment(false);
        setHideContactedFilter("off");
        setHideContactedCustomRange({ start: '', end: '' });
        setSearchTerm("");
        setActiveSearchTerm("");
        setSortByBirthday(false);
    };

    // Reset page when filter/basket changes
    useEffect(() => {
        setCurrentPage(1);
    }, [activeBasketKey, selectedRegions, selectedGrades, searchTerm, quickFilter, upcomingAppointmentFilter, filterByOverdueAppointment, hideContactedFilter, hideContactedCustomRange]);

    // Optimize Call History Lookup - Only include calls by CURRENT USER after date_assigned
    // caller field stores full name: "firstName lastName"
    const currentUserFullName = `${user.firstName} ${user.lastName || ''}`.trim();

    // Map customerId -> assignment day (local midnight, ms). Used to ignore raw call_history
    // rows made BEFORE the customer's current assignment (a previous ownership cycle), so the
    // frontend overlay stays consistent with the backend date_assigned cutoff and doesn't
    // re-introduce stale "already called" state. Compared at day granularity to match backend
    // DATE(ch.date) >= DATE(date_assigned).
    const assignedDayMap = useMemo(() => {
        const map = new Map<string, number>();
        localCustomers.forEach(c => {
            const da = (c as any).dateAssigned || (c as any).date_assigned;
            if (!da) return;
            const d = new Date(String(da).replace(' ', 'T'));
            if (isNaN(d.getTime())) return;
            d.setHours(0, 0, 0, 0);
            map.set(String(c.id), d.getTime());
        });
        return map;
    }, [localCustomers]);

    // True when a raw call_history row predates the customer's current assignment (skip it).
    const isBeforeAssignment = useCallback((customerId: string, callDate: Date): boolean => {
        const assignedDay = assignedDayMap.get(customerId);
        if (assignedDay === undefined) return false; // no known assignment date -> keep (matches backend COALESCE)
        const d = new Date(callDate.getTime());
        d.setHours(0, 0, 0, 0);
        return d.getTime() < assignedDay;
    }, [assignedDayMap]);

    const lastCallMap = useMemo(() => {
        const map = new Map<string, CallHistory>();

        // Step 1: Build from customer-attached data (complete, not affected by pagination)
        // Backend attach_call_status_to_customers provides: last_call_date_by_owner, call_count_by_owner, last_call_result_by_owner
        localCustomers.forEach(c => {
            const lastCallDate = (c as any).last_call_date_by_owner;
            if (lastCallDate) {
                const cid = String(c.id);
                map.set(cid, {
                    id: 0, // synthetic entry
                    customerId: cid,
                    date: lastCallDate,
                    caller: currentUserFullName,
                    status: '',
                    result: (c as any).last_call_result_by_owner || '',
                } as CallHistory);
            }
        });

        // Step 2: Overlay with actual call_history records (has more detail like notes)
        if (calls) {
            calls.forEach(call => {
                if (!call.customerId) return;
                const customerId = String(call.customerId);
                // Compare by callerId if available, fallback to name matching
                if (call.callerId != null) {
                    if (call.callerId !== user.id) return;
                } else {
                    const callerStr = call.caller ? String(call.caller).trim() : '';
                    if (callerStr !== currentUserFullName) return;
                }

                const callDate = new Date(String(call.date || Date.now()).replace(' ', 'T'));
                // Skip calls from before the current assignment (previous ownership cycle)
                if (isBeforeAssignment(customerId, callDate)) return;

                const existing = map.get(customerId);
                const existingDate = existing ? new Date(String(existing.date || 0).replace(' ', 'T')) : null;

                if (!existing || (existingDate && callDate > existingDate)) {
                    map.set(customerId, call);
                }
            });
        }

        console.log('[DashboardV2] lastCallMap size:', map.size, '(from customer data + call_history)');

        return map;
    }, [calls, currentUserFullName, localCustomers, isBeforeAssignment]);

    // Track customers with upcoming appointments and days until appointment
    // PRIORITY: Store UPCOMING (daysUntil >= 0) appointments over overdue ones
    // This ensures that filter "นัดหมายใกล้ถึง" shows customers who have ANY upcoming appointment
    // Track customers with upcoming appointments and days until appointment
    // PRIORITY: Store UPCOMING (daysUntil >= 0) appointments over overdue ones
    // This ensures that filter "นัดหมายใกล้ถึง" shows customers who have ANY upcoming appointment
    const appointmentInfoMap = useMemo(() => {
        const map = new Map<string, { hasAppointment: boolean; daysUntil?: number; hasUpcoming?: boolean; hasOverdue?: boolean; date?: Date }>();

        // Use joined data directly from customer object (Attached by API: attach_next_appointments_to_customers)
        localCustomers.forEach(c => {
            const nextAptDateStr = c.next_appointment_date;
            const nextAptStatus = c.next_appointment_status;

            if (nextAptDateStr && nextAptStatus !== 'เสร็จสิ้น') {
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const aptDate = new Date(nextAptDateStr);
                aptDate.setHours(0, 0, 0, 0);

                const daysUntil = Math.ceil((aptDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                const isUpcoming = daysUntil >= 0;

                // Since the API already prioritized upcoming vs overdue, we can trust this single record.
                map.set(String(c.id), {
                    hasAppointment: true,
                    daysUntil,
                    hasUpcoming: isUpcoming,
                    hasOverdue: !isUpcoming,
                    date: aptDate
                });
            }
        });

        return map;
    }, [localCustomers]);


    // Count ALL calls by current user for each customer
    const callCountMap = useMemo(() => {
        const map = new Map<string, number>();

        // Step 1: Use customer-attached data (complete, not affected by pagination)
        localCustomers.forEach(c => {
            const count = (c as any).call_count_by_owner;
            if (count && count > 0) {
                map.set(String(c.id), count);
            }
        });

        // Step 2: Supplement with call_history records (may have newer data)
        if (calls) {
            const tempMap = new Map<string, number>();
            calls.forEach(call => {
                if (!call.customerId) return;
                const customerId = String(call.customerId);
                // Compare by callerId if available, fallback to name matching
                if (call.callerId != null) {
                    if (call.callerId !== user.id) return;
                } else {
                    const callerStr = call.caller ? String(call.caller).trim() : '';
                    if (callerStr !== currentUserFullName) return;
                }
                const callDate = new Date(String(call.date || Date.now()).replace(' ', 'T'));
                // Skip calls from before the current assignment (previous ownership cycle)
                if (isBeforeAssignment(customerId, callDate)) return;
                tempMap.set(customerId, (tempMap.get(customerId) || 0) + 1);
            });
            // Use the higher count (customer-attached is authoritative, but call_history might be more recent)
            tempMap.forEach((count, cid) => {
                const existing = map.get(cid) || 0;
                if (count > existing) map.set(cid, count);
            });
        }
        return map;
    }, [calls, currentUserFullName, localCustomers, isBeforeAssignment]);

    // Load customers: Fetch from API to get lastCallNote and other joined fields
    // Fallback to propsCustomers if API fails
    useEffect(() => {
        if (!user?.id) return;

        const fetchCustomers = async () => {
            try {
                console.log('[DashboardV2] Fetching customers from API...');
                // Fetch in pages to avoid server OOM (production PHP memory limit ~20MB)
                const PAGE_SIZE = 500;
                let allCustomers: any[] = [];
                let currentPage = 1;
                let hasMore = true;
                while (hasMore) {
                    const response = await listCustomers({
                        companyId: user.companyId,
                        assignedTo: user.id,
                        page: currentPage,
                        pageSize: PAGE_SIZE
                    });
                    const pageData = response?.data || [];
                    allCustomers = allCustomers.concat(pageData);
                    const total = response?.total || 0;
                    hasMore = allCustomers.length < total && pageData.length === PAGE_SIZE;
                    currentPage++;
                }
                const response = { data: allCustomers, total: allCustomers.length };

                // listCustomers returns { total, data } object
                const customers = response?.data || [];
                console.log('[DashboardV2] API returned', customers.length, 'customers');

                if (customers.length > 0) {
                    // Blocked customers must never appear on the telesale dashboard
                    const mapped = customers.map((r: any) => mapCustomerFromApi(r)).filter(c => !c.isBlocked);
                    console.log('[DashboardV2] First customer lastCallNote:', mapped[0]?.lastCallNote);
                    setLocalCustomers(mapped);
                } else if (propsCustomers && propsCustomers.length > 0) {
                    // Fallback to propsCustomers if API returns empty
                    console.log('[DashboardV2] Falling back to propsCustomers');
                    const myCustomers = propsCustomers.filter(c => c.assignedTo === Number(user.id) && !c.isBlocked);
                    setLocalCustomers(myCustomers);
                }
            } catch (err) {
                console.error('[DashboardV2] Failed to fetch customers:', err);
                // Fallback to propsCustomers on error
                if (propsCustomers && propsCustomers.length > 0) {
                    console.log('[DashboardV2] Error fallback to propsCustomers');
                    const myCustomers = propsCustomers.filter(c => c.assignedTo === Number(user.id) && !c.isBlocked);
                    setLocalCustomers(myCustomers);
                }
            }
        };

        fetchCustomers();
    }, [user.id, user.companyId, refreshTrigger, propsCustomers]);



    // NOTE: Dashboard now fetches its own data if props are empty

    // Group customers by dynamic basket configs from API
    const basketGroups = useMemo(() => {
        if (basketConfigs.length === 0) return new Map<string, Customer[]>();
        return groupCustomersByDynamicBaskets(localCustomers, basketConfigs);
    }, [localCustomers, basketConfigs]);

    // ========== UNIFIED HIGHLIGHT LOGIC ==========
    // Simple: highlight tabs that have data matching ANY active filter
    // Uses the SAME logic as filteredCustomers for consistency
    const basketsWithMatches = useMemo(() => {
        const matches = new Set<string>();

        // Check if ANY filter is active
        const hasActiveFilter =
            activeSearchTerm ||
            (upcomingAppointmentFilter !== "off") ||
            filterByOverdueAppointment ||
            hideContactedFilter !== "off" ||
            deferredSelectedRegions.length > 0 ||
            deferredSelectedTagIds.length > 0 ||
            sortByBirthday ||
            (deferredQuickFilter && deferredQuickFilter !== "all");

        // No filter active = no highlights needed (clean look)
        if (!hasActiveFilter) return matches;

        // Helper to check if customer has birthday today
        const isBirthdayToday = (birthDate: string | undefined): boolean => {
            if (!birthDate) return false;
            const birth = new Date(birthDate);
            if (isNaN(birth.getTime())) return false;
            const today = new Date();
            return birth.getDate() === today.getDate() && birth.getMonth() === today.getMonth();
        };

        // Check each basket for matches using the SAME filter logic as filteredCustomers
        basketGroups.forEach((customers, basketKey) => {
            let filtered = [...customers];

            // Apply region filter
            if (deferredSelectedRegions.length > 0) {
                filtered = filterCustomersByRegion(filtered, deferredSelectedRegions);
            }

            // Apply Tag Filter
            if (deferredSelectedTagIds.length > 0) {
                filtered = filtered.filter(c =>
                    c.tags?.some(t => deferredSelectedTagIds.includes(t.id))
                );
            }

            // Apply Grade Filter
            if (deferredSelectedGrades.length > 0) {
                filtered = filtered.filter(c => deferredSelectedGrades.includes(c.grade));
            }

            // Apply Quick Filter
            if (deferredQuickFilter && deferredQuickFilter !== "all") {
                filtered = filtered.filter(c => {
                    const hasCalled = lastCallMap.has(String(c.id));
                    if (deferredQuickFilter === "uncontacted") return !hasCalled;
                    if (deferredQuickFilter === "contacted") return hasCalled;
                    if (deferredQuickFilter === "highGrade") {
                        return c.grade === "A+" || c.grade === "A" || c.grade === "B";
                    }
                    return true;
                });
            }

            // Apply search filter
            if (activeSearchTerm) {
                const lower = activeSearchTerm.toLowerCase().trim();
                filtered = filtered.filter(c => {
                    const firstName = c.firstName?.toLowerCase() || '';
                    const lastName = c.lastName?.toLowerCase() || '';
                    const fullName = `${firstName} ${lastName}`;
                    const fullNameNoSpace = `${firstName}${lastName}`;
                    const reverseName = `${lastName} ${firstName}`;
                    const reverseNameNoSpace = `${lastName}${firstName}`;

                    return firstName.includes(lower) ||
                        lastName.includes(lower) ||
                        fullName.includes(lower) ||
                        fullNameNoSpace.includes(lower) ||
                        reverseName.includes(lower) ||
                        reverseNameNoSpace.includes(lower) ||
                        c.phone?.includes(activeSearchTerm) ||
                        c.province?.toLowerCase().includes(lower);
                });
            }

            // Apply Appointment Filter
            if (upcomingAppointmentFilter !== "off") {
                filtered = filtered.filter(c => {
                    const appointmentInfo = appointmentInfoMap.get(String(c.id));
                    if (!appointmentInfo?.hasAppointment) return false;
                    
                    if (upcomingAppointmentFilter === "all") {
                        return appointmentInfo.hasUpcoming;
                    } else {
                        const maxDays = parseInt(upcomingAppointmentFilter, 10);
                        return appointmentInfo.hasUpcoming && appointmentInfo.daysUntil !== undefined && appointmentInfo.daysUntil <= maxDays;
                    }
                });
            }

            // Apply Overdue Appointment Filter
            if (filterByOverdueAppointment) {
                filtered = filtered.filter(c => {
                    const appointmentInfo = appointmentInfoMap.get(String(c.id));
                    return appointmentInfo?.hasOverdue === true;
                });
            }

            // Apply Show Contacted DateRange Filter
            if (showContactedDateRange.start || showContactedDateRange.end) {
                const s = showContactedDateRange.start ? new Date(showContactedDateRange.start) : null;
                const e = showContactedDateRange.end ? new Date(showContactedDateRange.end) : null;
                if (s) s.setHours(0, 0, 0, 0);
                if (e) e.setHours(23, 59, 59, 999);

                filtered = filtered.filter(c => {
                    const lastCall = lastCallMap.get(String(c.id));
                    if (!lastCall) return false;

                    const safeDateStr = String(lastCall.date).replace(' ', 'T');
                    const lastCallDate = new Date(safeDateStr);
                    const callTime = lastCallDate.getTime();
                    
                    if (s && e) {
                        return callTime >= s.getTime() && callTime <= e.getTime();
                    } else if (s) {
                        return callTime >= s.getTime();
                    } else if (e) {
                        return callTime <= e.getTime();
                    }
                    return true;
                });
            }

            // Apply Hide Contacted Filter
            if (hideContactedFilter !== "off") {
                const s = hideContactedFilter === 'custom' && hideContactedCustomRange.start ? new Date(hideContactedCustomRange.start) : null;
                const e = hideContactedFilter === 'custom' && hideContactedCustomRange.end ? new Date(hideContactedCustomRange.end) : null;
                if (s) s.setHours(0, 0, 0, 0);
                if (e) e.setHours(23, 59, 59, 999);

                filtered = filtered.filter(c => {
                    const lastCall = lastCallMap.get(String(c.id));
                    if (!lastCall) return true; // Keep if never called
                    
                    if (hideContactedFilter === "all") return false; // Hide all contacted
                    
                    const safeDateStr = String(lastCall.date).replace(' ', 'T');
                    const lastCallDate = new Date(safeDateStr);
                    const callTime = lastCallDate.getTime();
                    
                    if (hideContactedFilter === 'custom') {
                        if (s && e) {
                            if (callTime >= s.getTime() && callTime <= e.getTime()) return false;
                        } else if (s) {
                            if (callTime >= s.getTime()) return false;
                        } else if (e) {
                            if (callTime <= e.getTime()) return false;
                        }
                    } else {
                        const callDate = new Date(safeDateStr);
                        callDate.setHours(0, 0, 0, 0);
                        
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        
                        const daysSinceCall = Math.floor((today.getTime() - callDate.getTime()) / (1000 * 60 * 60 * 24));
                        const maxDays = parseInt(hideContactedFilter, 10);
                        
                        if (daysSinceCall <= maxDays) return false;
                    }
                    return true;
                });
            }

            // Apply Birthday Today Filter
            if (sortByBirthday) {
                filtered = filtered.filter(c => isBirthdayToday(c.birthDate));
            }

            // If any customers remain after filtering, this basket has matches
            if (filtered.length > 0) {
                matches.add(basketKey);
            }
        });

        return matches;
    }, [basketGroups, activeSearchTerm, upcomingAppointmentFilter, filterByOverdueAppointment, hideContactedFilter, hideContactedCustomRange, deferredSelectedRegions, deferredSelectedTagIds, deferredSelectedGrades, deferredQuickFilter, lastCallMap, appointmentInfoMap, sortByBirthday, showContactedDateRange]);

    // Count total overdue appointments for display (ONLY for current user's customers)
    const overdueAppointmentCount = useMemo(() => {
        if (!appointments || localCustomers.length === 0) return 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const validCustomerIds = new Set<string>();
        localCustomers.forEach(c => {
            validCustomerIds.add(String(c.id));
            if (c.pk) validCustomerIds.add(String(c.pk));
            if (c.customer_id) validCustomerIds.add(String(c.customer_id));
        });

        return appointments.filter(apt => {
            if (apt.status === 'เสร็จสิ้น') return false;
            if (!apt.customerId) return false;
            if (!validCustomerIds.has(String(apt.customerId))) return false;
            const aptDate = new Date(apt.date);
            aptDate.setHours(0, 0, 0, 0);
            return aptDate < today;
        }).length;
    }, [appointments, localCustomers]);

    // Set default active basket when configs load
    useEffect(() => {
        if (basketConfigs.length > 0 && !activeBasketKey) {
            setActiveBasketKey(basketConfigs[0].basket_key);
        }
    }, [basketConfigs, activeBasketKey, setActiveBasketKey]);

    // Build dynamic tab configs from DB
    const tabConfigs = useMemo(() => {
        return basketConfigs.map(config => ({
            key: config.basket_key,
            name: config.basket_name,
            count: (basketGroups.get(config.basket_key) || []).length,
            config
        }));
    }, [basketConfigs, basketGroups]);

    // Filter and sort customers for active tab
    // Tags Logic
    const allAvailableTags = useMemo(
        () => [...systemTags, ...(user.customTags || [])],
        [systemTags, user.customTags]
    );

    const relevantTags = useMemo(() => {
        const usedTagIds = new Set<number>();
        localCustomers.forEach((c) => {
            if (c.tags) {
                c.tags.forEach((t) => usedTagIds.add(t.id));
            }
        });
        return allAvailableTags.filter((tag) => usedTagIds.has(tag.id));
    }, [localCustomers, allAvailableTags]);

    const handleFilterSelect = (
        setter: React.Dispatch<React.SetStateAction<any[]>>,
        current: any[],
        id: any
    ) => {
        if (current.includes(id)) {
            setter(current.filter((item) => item !== id));
        } else {
            setter([...current, id]);
        }
    };

    // Filter Logic
    const filteredCustomers = useMemo(() => {
        let customers = basketGroups.get(activeBasketKey) || [];

        // Apply region filter
        if (deferredSelectedRegions.length > 0) {
            customers = filterCustomersByRegion(customers, deferredSelectedRegions);
        }

        // Apply Tag Filter
        if (deferredSelectedTagIds.length > 0) {
            customers = customers.filter(c =>
                c.tags?.some(t => deferredSelectedTagIds.includes(t.id))
            );
        }

        // Apply Grade Filter
        if (deferredSelectedGrades.length > 0) {
            customers = customers.filter(c => deferredSelectedGrades.includes(c.grade));
        }

        // Apply Quick Filter (use deferred value to prevent UI blocking)
        if (deferredQuickFilter !== "all") {
            customers = customers.filter(c => {
                const hasCalled = lastCallMap.has(String(c.id));

                if (deferredQuickFilter === "uncontacted") return !hasCalled;
                if (deferredQuickFilter === "contacted") return hasCalled;
                if (deferredQuickFilter === "highGrade") {
                    return c.grade === "A+" || c.grade === "A" || c.grade === "B";
                }
                return true;
            });
        }

        // Apply search filter - supports full name search (firstName + lastName)
        if (activeSearchTerm) {
            const lower = activeSearchTerm.toLowerCase().trim();
            customers = customers.filter(c => {
                const firstName = c.firstName?.toLowerCase() || '';
                const lastName = c.lastName?.toLowerCase() || '';
                // Full name combinations (with and without space)
                const fullName = `${firstName} ${lastName}`;
                const fullNameNoSpace = `${firstName}${lastName}`;
                const reverseName = `${lastName} ${firstName}`;
                const reverseNameNoSpace = `${lastName}${firstName}`;

                return firstName.includes(lower) ||
                    lastName.includes(lower) ||
                    fullName.includes(lower) ||
                    fullNameNoSpace.includes(lower) ||
                    reverseName.includes(lower) ||
                    reverseNameNoSpace.includes(lower) ||
                    c.phone?.includes(activeSearchTerm) ||
                    c.province?.toLowerCase().includes(lower);
            });
        }

        // Apply Appointment Filter
        if (upcomingAppointmentFilter !== "off") {
            customers = customers.filter(c => {
                const appointmentInfo = appointmentInfoMap.get(String(c.id));
                if (!appointmentInfo?.hasAppointment) return false;
                
                if (upcomingAppointmentFilter === "all") {
                    return appointmentInfo.hasUpcoming;
                } else {
                    const maxDays = parseInt(upcomingAppointmentFilter, 10);
                    return appointmentInfo.hasUpcoming && appointmentInfo.daysUntil !== undefined && appointmentInfo.daysUntil <= maxDays;
                }
            });
        }

        // Apply Overdue Appointment Filter - show only customers with overdue appointments
        // Use hasOverdue flag for accurate filtering
        if (filterByOverdueAppointment) {
            customers = customers.filter(c => {
                const appointmentInfo = appointmentInfoMap.get(String(c.id));
                // Include if customer has ANY overdue appointment
                return appointmentInfo?.hasOverdue === true;
            });
        }

        // Apply Show Contacted DateRange Filter
        if (showContactedDateRange.start || showContactedDateRange.end) {
            const s = showContactedDateRange.start ? new Date(showContactedDateRange.start) : null;
            const e = showContactedDateRange.end ? new Date(showContactedDateRange.end) : null;
            if (s) s.setHours(0, 0, 0, 0);
            if (e) e.setHours(23, 59, 59, 999);

            customers = customers.filter(c => {
                const lastCall = lastCallMap.get(String(c.id));
                if (!lastCall) return false;

                const safeDateStr = String(lastCall.date).replace(' ', 'T');
                const lastCallDate = new Date(safeDateStr);
                const callTime = lastCallDate.getTime();
                
                if (s && e) {
                    return callTime >= s.getTime() && callTime <= e.getTime();
                } else if (s) {
                    return callTime >= s.getTime();
                } else if (e) {
                    return callTime <= e.getTime();
                }
                return true;
            });
        }

        // Apply Birthday Today Filter - show only customers with birthdays today
        if (sortByBirthday) {
            const today = new Date();
            customers = customers.filter(c => {
                if (!c.birthDate) return false;
                const birth = new Date(c.birthDate);
                if (isNaN(birth.getTime())) return false;
                return birth.getDate() === today.getDate() && birth.getMonth() === today.getMonth();
            });
        }

        // Apply Hide Contacted Filter
        if (hideContactedFilter !== "off") {
            const s = hideContactedFilter === 'custom' && hideContactedCustomRange.start ? new Date(hideContactedCustomRange.start) : null;
            const e = hideContactedFilter === 'custom' && hideContactedCustomRange.end ? new Date(hideContactedCustomRange.end) : null;
            if (s) s.setHours(0, 0, 0, 0);
            if (e) e.setHours(23, 59, 59, 999);

            customers = customers.filter(c => {
                const lastCall = lastCallMap.get(String(c.id));
                if (!lastCall) return true; // Keep if never called
                
                if (hideContactedFilter === "all") return false; // Hide all contacted

                const safeDateStr = String(lastCall.date).replace(' ', 'T');
                const lastCallDate = new Date(safeDateStr);
                const callTime = lastCallDate.getTime();
                
                if (hideContactedFilter === 'custom') {
                    if (s && e) {
                        if (callTime >= s.getTime() && callTime <= e.getTime()) return false;
                    } else if (s) {
                        if (callTime >= s.getTime()) return false;
                    } else if (e) {
                        if (callTime <= e.getTime()) return false;
                    }
                } else {
                    const callDate = new Date(safeDateStr);
                    callDate.setHours(0, 0, 0, 0);
                    
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    
                    const daysSinceCall = Math.floor((today.getTime() - callDate.getTime()) / (1000 * 60 * 60 * 24));
                    const maxDays = parseInt(hideContactedFilter, 10);
                    
                    if (daysSinceCall <= maxDays) return false;
                }
                
                return true;
            });
        }

        // Sort
        customers = [...customers].sort((a, b) => {
            // If filtering by appointments, sort by appointment date (earliest first)
            if (upcomingAppointmentFilter !== "off") {
                const aInfo = appointmentInfoMap.get(String(a.id));
                const bInfo = appointmentInfoMap.get(String(b.id));
                const aDays = aInfo?.daysUntil ?? 9999;
                const bDays = bInfo?.daysUntil ?? 9999;
                return aDays - bDays; // Earliest appointment first
            }

            // Sort by upcoming birthday if enabled
            if (sortByBirthday) {
                const today = new Date();
                const currentYear = today.getFullYear();
                const todayDayOfYear = Math.floor((today.getTime() - new Date(currentYear, 0, 0).getTime()) / 86400000);

                const getDaysUntilBirthday = (birthDate: string | undefined): number => {
                    if (!birthDate) return 9999;
                    const birth = new Date(birthDate);
                    if (isNaN(birth.getTime())) return 9999;

                    // Calculate birthday this year
                    const birthdayThisYear = new Date(currentYear, birth.getMonth(), birth.getDate());
                    let birthdayDayOfYear = Math.floor((birthdayThisYear.getTime() - new Date(currentYear, 0, 0).getTime()) / 86400000);

                    // If birthday already passed this year, consider next year
                    if (birthdayDayOfYear < todayDayOfYear) {
                        birthdayDayOfYear += 365;
                    }
                    return birthdayDayOfYear - todayDayOfYear;
                };

                const aDays = getDaysUntilBirthday(a.birthDate);
                const bDays = getDaysUntilBirthday(b.birthDate);
                return aDays - bDays; // Nearest birthday first
            }

            switch (sortBy) {
                case "lastOrder":
                    const dateA = a.lastOrderDate ? new Date(a.lastOrderDate).getTime() : 0;
                    const dateB = b.lastOrderDate ? new Date(b.lastOrderDate).getTime() : 0;
                    return dateB - dateA; // Most recent first
                case "name":
                    return (a.firstName || "").localeCompare(b.firstName || "");
                case "grade":
                    const gradeOrder = { "A+": 0, "A": 1, "B": 2, "C": 3, "D": 4 };
                    return (gradeOrder[a.grade] ?? 5) - (gradeOrder[b.grade] ?? 5);
                case "dateAssignedNewest":
                    const assignedA = a.dateAssigned ? new Date(a.dateAssigned).getTime() : 0;
                    const assignedB = b.dateAssigned ? new Date(b.dateAssigned).getTime() : 0;
                    return assignedB - assignedA; // Newest first
                case "dateAssignedOldest":
                    const assignedA2 = a.dateAssigned ? new Date(a.dateAssigned).getTime() : Infinity;
                    const assignedB2 = b.dateAssigned ? new Date(b.dateAssigned).getTime() : Infinity;
                    return assignedA2 - assignedB2; // Oldest first
                default:
                    return 0;
            }
        });

        return customers;
    }, [basketGroups, activeBasketKey, deferredSelectedRegions, activeSearchTerm, sortBy, deferredQuickFilter, lastCallMap, deferredSelectedTagIds, deferredSelectedGrades, upcomingAppointmentFilter, filterByOverdueAppointment, appointmentInfoMap, hideContactedFilter, hideContactedCustomRange, sortByBirthday, showContactedDateRange]);

    // Manual sync - just refresh to get fresh data from API via App.tsx
    const handleManualSync = () => {
        // Trigger full page reload to get fresh data from API
        window.location.reload();
    };

    // Stats summary
    const totalCustomers = localCustomers.length;

    // Optimize Modal Opening (INP Fix)
    const handleOpenModal = useCallback((type: ModalType, data: any) => {
        startTransition(() => {
            openModal(type, data);
        });
    }, [openModal]);

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-6">

            {/* Basket Tabs - Dynamic from API */}
            <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 mb-6">
                {basketConfigLoading ? (
                    <div className="flex items-center gap-2 text-gray-400">
                        <RefreshCw size={18} className="animate-spin" />
                        <span>กำลังโหลดถัง...</span>
                    </div>
                ) : tabConfigs.length === 0 ? (
                    <div className="text-gray-500 text-center py-4">
                        <Settings size={24} className="mx-auto mb-2" />
                        <p>ยังไม่มีถังที่ตั้งค่า</p>
                        <p className="text-sm">กรุณาไปที่หน้า "ตั้งค่าถัง" เพื่อเพิ่มถัง</p>
                    </div>
                ) : (
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                        {tabConfigs.map(tab => {
                            const isActive = activeBasketKey === tab.key;
                            const hasMatches = basketsWithMatches.has(tab.key);

                            // Simple unified highlight: basket has data matching current filter
                            const showHighlight = hasMatches && !isActive;

                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveBasketKey(tab.key)}
                                    className={`relative px-3 py-1.5 rounded-xl font-medium text-xs whitespace-nowrap transition-all duration-200 border-2 ${isActive
                                        ? 'bg-blue-100 text-blue-700 border-blue-300 shadow-md scale-105'
                                        : showHighlight
                                            ? 'bg-green-100 text-green-700 border-green-400 shadow-md'
                                            : 'bg-white/50 text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                        }`}
                                >
                                    <span>{tab.name}</span>
                                    <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${isActive ? 'bg-white/70 text-gray-800'
                                        : showHighlight ? 'bg-green-600 text-white'
                                            : 'bg-gray-200 text-gray-600'
                                        }`}>
                                        {tab.count.toLocaleString()}
                                    </span>
                                    {showHighlight && (
                                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white" title="มีข้อมูลตรงกับ filter"></span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Search & Filters Row */}
            <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-4 mb-6">
                <div className="flex flex-wrap items-center gap-4">
                    {/* Customer Count */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 rounded-xl">
                        <span className="text-gray-600 text-sm">ลูกค้าทั้งหมด:</span>
                        <span className="font-bold text-gray-800">{totalCustomers.toLocaleString()}</span>
                    </div>
                    {/* Search - Expanded width */}
                    <div className="relative w-full max-w-[450px]">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="ค้นหาชื่อ, เบอร์โทร, จังหวัด... (กด Enter)"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={handleSearchKeyDown}
                            className="w-full pl-10 pr-16 py-2.5 rounded-xl border border-gray-200 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-sm"
                        />
                        <button
                            onClick={handleSearch}
                            className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors"
                        >
                            ค้นหา
                        </button>
                    </div>

                    {/* Upcoming Appointments Custom Dropdown */}
                    <div className="relative" ref={upcomingDropdownRef}>
                        <button
                            onClick={() => setIsUpcomingDropdownOpen(!isUpcomingDropdownOpen)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all ${
                                upcomingAppointmentFilter !== 'off'
                                ? "bg-blue-50 border-blue-300 text-blue-700"
                                : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
                            }`}
                        >
                            <Calendar size={18} />
                            <span className="font-medium">
                                {upcomingAppointmentFilter === '1' ? 'นัดหมายภายใน 1 วัน' :
                                 upcomingAppointmentFilter === '3' ? 'นัดหมายภายใน 3 วัน' :
                                 upcomingAppointmentFilter === '7' ? 'นัดหมายภายใน 7 วัน' :
                                 upcomingAppointmentFilter === 'all' ? 'นัดหมายใกล้ถึง (ทุกวัน)' :
                                 'นัดหมายใกล้ถึง (ไม่กรอง)'}
                            </span>
                            <ChevronDown size={16} className={upcomingAppointmentFilter !== 'off' ? "text-blue-500" : "text-gray-400"} />
                        </button>
                        
                        {isUpcomingDropdownOpen && (
                            <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                                <div className="py-1">
                                    {[
                                        { value: 'off', label: '❌ ปิดการกรอง (ดูทั้งหมด)' },
                                        { value: 'all', label: '📅 นัดหมายใกล้ถึง (ทุกวัน)' },
                                        { value: '1', label: '🕒 นัดหมายภายใน 1 วัน' },
                                        { value: '3', label: '🕒 นัดหมายภายใน 3 วัน' },
                                        { value: '7', label: '🕒 นัดหมายภายใน 7 วัน' }
                                    ].map((option) => (
                                        <button
                                            key={option.value}
                                            onClick={() => {
                                                setUpcomingAppointmentFilter(option.value as UpcomingFilter);
                                                setIsUpcomingDropdownOpen(false);
                                                if (option.value !== "off") {
                                                    setFilterByOverdueAppointment(false);
                                                }
                                            }}
                                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-gray-50 ${
                                                upcomingAppointmentFilter === option.value
                                                    ? 'bg-blue-50 text-blue-700 font-medium'
                                                    : 'text-gray-700'
                                            }`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Overdue Appointments Filter Button */}
                    <button
                        onClick={() => {
                            // Mutual exclusivity: clear upcoming when selecting overdue
                            if (!filterByOverdueAppointment) {
                                setUpcomingAppointmentFilter("off");
                            }
                            setFilterByOverdueAppointment(!filterByOverdueAppointment);
                        }}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all border ${filterByOverdueAppointment
                            ? "bg-red-100 border-red-400 text-red-700"
                            : "bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200"
                            }`}
                    >
                        <Calendar size={18} />
                        <span className="font-medium">เลยนัดหมาย ⚠</span>
                        {filterByOverdueAppointment && (
                            <span className="text-xs text-red-600 font-medium">(กำลังกรอง)</span>
                        )}
                    </button>

                    {/* Hide Contacted Filter */}
                    <div className="relative" ref={hideContactedDropdownRef}>
                        <button
                            onClick={() => {
                                setIsHideContactedDropdownOpen(!isHideContactedDropdownOpen);
                                // Initialize temp range when opening
                                if (!isHideContactedDropdownOpen) {
                                    setTempCustomRange(hideContactedCustomRange);
                                }
                            }}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all ${
                                hideContactedFilter !== 'off'
                                ? "bg-purple-50 border-purple-300 text-purple-700"
                                : "bg-white border-gray-200 text-gray-700 hover:border-gray-300"
                            }`}
                        >
                            <Phone size={18} />
                            <span className="font-medium">
                                {hideContactedFilter === '1' ? 'ซ่อนที่โทรแล้ววันนี้' :
                                 hideContactedFilter === '3' ? 'ซ่อนที่โทรแล้วใน 3 วัน' :
                                 hideContactedFilter === '7' ? 'ซ่อนที่โทรแล้วใน 7 วัน' :
                                 hideContactedFilter === 'all' ? 'ซ่อนที่โทรแล้วทั้งหมด' :
                                 hideContactedFilter === 'custom' ? 'ซ่อนที่โทร (กำหนดเอง)' :
                                 'ซ่อนที่โทรแล้ว (ไม่ซ่อน)'}
                            </span>
                            <ChevronDown size={16} className={hideContactedFilter !== 'off' ? "text-purple-500" : "text-gray-400"} />
                        </button>
                        
                        {isHideContactedDropdownOpen && (
                            <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                                <div className="py-1">
                                    {[
                                        { value: 'off', label: '❌ ไม่ซ่อน (แสดงทั้งหมด)' },
                                        { value: 'all', label: '📞 ซ่อนคนที่เคยโทรแล้ว' },
                                        { value: '1', label: '🕒 ซ่อนที่โทรแล้ววันนี้' },
                                        { value: '3', label: '🕒 ซ่อนที่โทรแล้วใน 3 วัน' },
                                        { value: '7', label: '🕒 ซ่อนที่โทรแล้วใน 7 วัน' }
                                    ].map((option) => (
                                        <button
                                            key={option.value}
                                            onClick={() => {
                                                setHideContactedFilter(option.value as HideContactedFilter);
                                                setHideContactedCustomRange({ start: '', end: '' });
                                                setIsHideContactedDropdownOpen(false);
                                            }}
                                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-gray-50 ${
                                                hideContactedFilter === option.value
                                                    ? 'bg-purple-50 text-purple-700 font-medium'
                                                    : 'text-gray-700'
                                            }`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                    
                                    <div className="border-t border-gray-100 mt-1 p-3">
                                        <div className="text-xs text-gray-500 font-medium mb-2 px-1">ระบุช่วงวันที่...</div>
                                        <div className="space-y-2">
                                            <div>
                                                <input 
                                                    type="date" 
                                                    className="w-full text-xs p-1.5 border border-gray-200 rounded-lg outline-none focus:border-purple-300" 
                                                    value={tempCustomRange.start}
                                                    onChange={(e) => setTempCustomRange(prev => ({ ...prev, start: e.target.value }))}
                                                />
                                            </div>
                                            <div className="text-center text-gray-300 text-xs">ถึง</div>
                                            <div>
                                                <input 
                                                    type="date" 
                                                    className="w-full text-xs p-1.5 border border-gray-200 rounded-lg outline-none focus:border-purple-300"
                                                    value={tempCustomRange.end}
                                                    onChange={(e) => setTempCustomRange(prev => ({ ...prev, end: e.target.value }))}
                                                />
                                            </div>
                                            <button 
                                                onClick={() => {
                                                    setHideContactedCustomRange(tempCustomRange);
                                                    setHideContactedFilter("custom");
                                                    setIsHideContactedDropdownOpen(false);
                                                }}
                                                className="w-full mt-2 bg-purple-500 hover:bg-purple-600 text-white text-xs font-medium py-1.5 rounded-lg transition-colors"
                                            >
                                                ตกลง
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sort by Upcoming Birthday Button */}
                    <button
                        onClick={() => setSortByBirthday(!sortByBirthday)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all border ${sortByBirthday
                            ? "bg-pink-100 border-pink-400 text-pink-700"
                            : "bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200"
                            }`}
                    >
                        <Cake size={18} />
                        <span className="font-medium">วันเกิดใกล้ถึง</span>
                        {sortByBirthday && (
                            <span className="text-xs text-pink-600 font-medium">(กำลังเรียง)</span>
                        )}
                    </button>

                    {/* Advanced Settings Button */}
                    <div className="relative">
                        <button
                            onClick={() => setIsAdvancedSettingsOpen(!isAdvancedSettingsOpen)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all ${hasActiveFilters
                                ? "bg-purple-50 border-purple-300 text-purple-700"
                                : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                                }`}
                        >
                            <Settings size={18} />
                            <span className="font-medium">ตั้งค่าขั้นสูง</span>
                            {hasActiveFilters && (
                                <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded-full">
                                    {selectedRegions.length + selectedTagIds.length + selectedGrades.length}
                                </span>
                            )}
                            <ChevronDown size={16} className={`transition-transform ${isAdvancedSettingsOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Advanced Settings Dropdown */}
                        {isAdvancedSettingsOpen && (
                            <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 bg-white rounded-2xl border border-gray-200 shadow-xl z-50 p-4 min-w-[300px] max-w-[90vw]">
                                <div className="space-y-4">
                                    {/* Region Filter */}
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-2 block">กรองตามภูมิภาค</label>
                                        <RegionFilter
                                            selectedRegions={selectedRegions}
                                            onRegionChange={setSelectedRegions}
                                        />
                                    </div>

                                    {/* Tag Filter */}
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-2 block">กรองตาม Tag</label>
                                        <FilterDropdown
                                            title="Tags"
                                            options={relevantTags}
                                            selected={selectedTagIds}
                                            onSelect={(id) => handleFilterSelect(setSelectedTagIds, selectedTagIds, id)}
                                        />
                                    </div>

                                    {/* Grade Filter */}
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-2 block">กรองตามเกรด</label>
                                        <div className="flex flex-wrap gap-1.5">
                                            {(["A+", "A", "B", "C", "D"] as const).map((g) => {
                                                const active = selectedGrades.includes(g);
                                                const colorMap: Record<string, string> = {
                                                    "A+": active ? "bg-emerald-500 text-white border-emerald-500" : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
                                                    "A": active ? "bg-green-500 text-white border-green-500" : "bg-green-50 text-green-700 border-green-200 hover:bg-green-100",
                                                    "B": active ? "bg-blue-500 text-white border-blue-500" : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100",
                                                    "C": active ? "bg-yellow-500 text-white border-yellow-500" : "bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100",
                                                    "D": active ? "bg-orange-500 text-white border-orange-500" : "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100",
                                                };
                                                return (
                                                    <button
                                                        key={g}
                                                        onClick={() => handleFilterSelect(setSelectedGrades, selectedGrades, g)}
                                                        className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${colorMap[g]}`}
                                                    >
                                                        {g}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Sort */}
                                    <div>
                                        <label className="text-sm font-medium text-gray-700 mb-2 block">เรียงตาม</label>
                                        <select
                                            value={sortBy}
                                            onChange={(e) => setSortBy(e.target.value as any)}
                                            className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-blue-300 focus:ring-2 focus:ring-blue-100 outline-none"
                                        >
                                            <option value="lastOrder">วันที่สั่งซื้อล่าสุด</option>
                                            <option value="dateAssignedNewest">วันที่ได้รับ ล่าสุด</option>
                                            <option value="dateAssignedOldest">วันที่ได้รับ เก่าสุด</option>
                                            <option value="name">ชื่อ-นามสกุล</option>
                                            <option value="grade">หมายเหตุล่าสุด</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Clear Filters Button - only show when filters are active */}
                    {hasActiveFilters && (
                        <button
                            onClick={() => {
                                clearAllFilters();
                                setShowContactedDateRange({ start: '', end: '' });
                            }}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-all"
                            title="ล้างตัวกรองทั้งหมด"
                        >
                            <RotateCcw size={16} />
                            <span className="font-medium">ล้างตัวกรอง</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Customer List */}
            <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden transform-gpu">
                <div className="p-4 border-b border-gray-100">
                    <h2 className="font-semibold text-gray-700">
                        {tabConfigs.find(t => t.key === activeBasketKey)?.name || 'ถัง'}
                        <span className="ml-2 text-gray-400 font-normal">
                            ({filteredCustomers.length.toLocaleString()} รายการ)
                        </span>
                    </h2>
                </div>

                {filteredCustomers.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        <ShoppingCart size={48} className="mx-auto mb-4 text-gray-300" />
                        <p>ไม่พบลูกค้าในตะกร้านี้</p>
                        {selectedRegions.length > 0 && (
                            <button
                                onClick={() => setSelectedRegions([])}
                                className="mt-2 text-blue-500 hover:text-blue-600 text-sm"
                            >
                                ล้างตัวกรองภูมิภาค
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ลูกค้า</th>
                                    <th className="px-2 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-12">เกรด</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">สถานะ</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">เบอร์โทร</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">จังหวัด</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">วันที่ได้รับ</th>
                                    {sortByBirthday && (
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-pink-600 uppercase tracking-wider">🎂 วันเกิด</th>
                                    )}
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">ซื้อล่าสุด</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">หมายเหตุล่าสุด</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider min-w-[200px]">TAG</th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">การดำเนินการ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredCustomers
                                    .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                                    .map((customer) => (
                                        <CustomerRow
                                            key={customer.id}
                                            customer={customer}
                                            onViewCustomer={onViewCustomer}
                                            openModal={handleOpenModal}
                                            activeBasket={activeBasketKey}
                                            lastCall={lastCallMap.get(String(customer.id))}
                                            hasAppointment={appointmentInfoMap.get(String(customer.id))?.hasAppointment}
                                            callCount={(customer as any).call_count_by_owner || 0}
                                            daysUntilAppointment={appointmentInfoMap.get(String(customer.id))?.daysUntil}
                                            showBirthday={sortByBirthday}
                                        />
                                    ))}
                            </tbody>
                        </table>

                        {/* Pagination Controls */}
                        {filteredCustomers.length > 0 && (
                            <div className="p-4 bg-gray-50 border-t flex flex-wrap items-center justify-between gap-4">
                                {/* Page Size Selector */}
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-500">แสดง:</span>
                                    {[100, 500, 1000].map((size) => (
                                        <button
                                            key={size}
                                            onClick={() => {
                                                setPageSize(size);
                                                setCurrentPage(1);
                                            }}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                                                ${pageSize === size
                                                    ? "bg-blue-500 text-white"
                                                    : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                                                }
                                            `}
                                        >
                                            {size}
                                        </button>
                                    ))}
                                </div>

                                {/* Page Info & Navigation */}
                                <div className="flex items-center gap-4">
                                    <span className="text-sm text-gray-500">
                                        หน้า {currentPage} / {Math.max(1, Math.ceil(filteredCustomers.length / pageSize))}
                                        <span className="ml-2 text-gray-400">
                                            (แสดง {Math.min((currentPage - 1) * pageSize + 1, filteredCustomers.length)}-{Math.min(currentPage * pageSize, filteredCustomers.length)} จาก {filteredCustomers.length.toLocaleString()})
                                        </span>
                                    </span>

                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage <= 1}
                                            className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            <ChevronLeft size={16} />
                                        </button>
                                        <button
                                            onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredCustomers.length / pageSize), p + 1))}
                                            disabled={currentPage >= Math.ceil(filteredCustomers.length / pageSize)}
                                            className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            <ChevronRight size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TelesaleDashboardV2;
