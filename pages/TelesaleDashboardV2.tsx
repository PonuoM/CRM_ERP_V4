/**
 * TelesaleDashboardV2 - Basket-based customer management dashboard
 * 
 * NEW V2 Features:
 * - Tab navigation by BasketType (Upsell, NewCustomer, Month1_2, Month3, LastChance, Archive)
 * - Region filtering (เหนือ, อีสาน, กลาง, ใต้, ตะวันตก)
 * - Based on last_order_date instead of ownership_expires
 */

import React, { useState, useMemo, useEffect, useDeferredValue, useTransition, useCallback } from "react";
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
    lastCallResult?: string;
}> = ({ hasLastCall, callCount, hasAppointment, daysUntilAppointment, lastCallResult }) => {
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
            <td className="px-4 py-3">
                <StatusDisplay
                    hasLastCall={callCount > 0}
                    callCount={callCount}
                    hasAppointment={hasAppointment}
                    daysUntilAppointment={daysUntilAppointment}
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
    const [searchTerm, setSearchTerm] = useState("");
    const [activeSearchTerm, setActiveSearchTerm] = useState(""); // Only updates on Enter/button click
    const [isPending, startTransition] = useTransition();

    // Handle search on Enter key or button click
    const handleSearch = () => {
        // Clear all filters when searching to avoid missing results
        if (searchTerm.trim()) {
            setSelectedRegions([]);
            setSelectedTagIds([]);
            setFilterByAppointment(false);
            setFilterByOverdueAppointment(false);
            setHideContactedDays(null);
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

    // Upcoming Appointments Panel toggle
    const [isAppointmentPanelOpen, setIsAppointmentPanelOpen] = useState(false);

    // Appointment Filter (show only customers with upcoming appointments)
    const [filterByAppointment, setFilterByAppointment] = useState(false);

    // Overdue Appointment Filter (show only customers with overdue appointments)
    const [filterByOverdueAppointment, setFilterByOverdueAppointment] = useState(false);

    // Hide Contacted Filter - hide customers called within X days (null = disabled)
    const [hideContactedDays, setHideContactedDays] = useState<number | null>(null);
    const [isHideContactedDropdownOpen, setIsHideContactedDropdownOpen] = useState(false);

    // Advanced Settings Panel toggle
    const [isAdvancedSettingsOpen, setIsAdvancedSettingsOpen] = useState(false);

    // Sort by upcoming birthday
    const [sortByBirthday, setSortByBirthday] = useState(false);

    // Check if any filters are active (including search)
    const hasActiveFilters = selectedRegions.length > 0 || selectedTagIds.length > 0 || filterByAppointment || filterByOverdueAppointment || hideContactedDays !== null || activeSearchTerm || sortByBirthday;

    // Clear all filters (including search)
    const clearAllFilters = () => {
        setSelectedRegions([]);
        setSelectedTagIds([]);
        setFilterByAppointment(false);
        setFilterByOverdueAppointment(false);
        setHideContactedDays(null);
        setSearchTerm("");
        setActiveSearchTerm("");
        setSortByBirthday(false);
    };

    // Reset page when filter/basket changes
    useEffect(() => {
        setCurrentPage(1);
    }, [activeBasketKey, selectedRegions, searchTerm, quickFilter, filterByAppointment, filterByOverdueAppointment, hideContactedDays]);

    // Optimize Call History Lookup - Only include calls by CURRENT USER after date_assigned
    // caller field stores full name: "firstName lastName"
    const currentUserFullName = `${user.firstName} ${user.lastName}`;

    const lastCallMap = useMemo(() => {
        const map = new Map<string, CallHistory>();
        if (!calls) return map;

        // Debug: log first few calls and user name
        console.log('[DashboardV2] currentUserFullName:', currentUserFullName);
        console.log('[DashboardV2] Total calls:', calls.length);
        console.log('[DashboardV2] Sample call callers:', calls.slice(0, 3).map(c => c.caller));

        let matchCount = 0;
        let skippedDueToCallerMismatch = 0;

        calls.forEach(call => {
            if (!call.customerId) return;
            const customerId = String(call.customerId);

            // Only include calls made by the current user (compare by full name)
            // NOTE: Removed dateAssigned check - we count ALL calls by this user regardless of assignment date
            // This fixes the issue where customer was re-assigned and old calls weren't counted
            const callerId = call.caller ? String(call.caller).trim() : '';
            if (callerId !== currentUserFullName) {
                skippedDueToCallerMismatch++;
                return;
            }

            matchCount++;

            // Use 'date' field per types.ts definition
            const callDate = new Date(call.date || Date.now());
            const existing = map.get(customerId);
            const existingDate = existing ? new Date(existing.date || 0) : null;

            if (!existing || (existingDate && callDate > existingDate)) {
                map.set(customerId, call);
            }
        });

        console.log('[DashboardV2] lastCallMap size:', map.size,
            'matched:', matchCount,
            'skippedCaller:', skippedDueToCallerMismatch);

        // Debug specific customer 16065
        const testCustomerId = '16065';
        const testCall = map.get(testCustomerId);
        console.log('[DashboardV2] Debug customer 16065:',
            'inMap:', map.has(testCustomerId),
            'lastCall:', testCall?.date);

        return map;
    }, [calls, currentUserFullName]);

    // Track customers with upcoming appointments and days until appointment
    // PRIORITY: Store UPCOMING (daysUntil >= 0) appointments over overdue ones
    // This ensures that filter "นัดหมายใกล้ถึง" shows customers who have ANY upcoming appointment
    // Track customers with upcoming appointments and days until appointment
    // PRIORITY: Store UPCOMING (daysUntil >= 0) appointments over overdue ones
    // This ensures that filter "นัดหมายใกล้ถึง" shows customers who have ANY upcoming appointment
    const appointmentInfoMap = useMemo(() => {
        const map = new Map<string, { hasAppointment: boolean; daysUntil?: number; hasUpcoming?: boolean; hasOverdue?: boolean }>();

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
                    hasOverdue: !isUpcoming
                });
            }
        });

        return map;
    }, [localCustomers]);


    // Count ALL calls by current user for each customer (no date_assigned filter)
    const callCountMap = useMemo(() => {
        const map = new Map<string, number>();
        if (!calls) return map;

        // caller field stores full name: "firstName lastName"
        const currentUserFullName = `${user.firstName} ${user.lastName}`;

        calls.forEach(call => {
            if (!call.customerId) return;
            const customerId = String(call.customerId);

            // Only count calls made by the current user (compare by full name)
            const callerId = call.caller ? String(call.caller).trim() : '';
            if (callerId !== currentUserFullName) return;

            map.set(customerId, (map.get(customerId) || 0) + 1);
        });
        return map;
    }, [calls, user.firstName, user.lastName]);

    // Load customers: Fetch from API to get lastCallNote and other joined fields
    // Fallback to propsCustomers if API fails
    useEffect(() => {
        if (!user?.id) return;

        const fetchCustomers = async () => {
            try {
                console.log('[DashboardV2] Fetching customers from API...');
                const response = await listCustomers({
                    companyId: user.companyId,
                    assignedTo: user.id,
                    pageSize: 10000
                });

                // listCustomers returns { total, data } object
                const customers = response?.data || [];
                console.log('[DashboardV2] API returned', customers.length, 'customers');

                if (customers.length > 0) {
                    const mapped = customers.map((r: any) => mapCustomerFromApi(r));
                    console.log('[DashboardV2] First customer lastCallNote:', mapped[0]?.lastCallNote);
                    setLocalCustomers(mapped);
                } else if (propsCustomers && propsCustomers.length > 0) {
                    // Fallback to propsCustomers if API returns empty
                    console.log('[DashboardV2] Falling back to propsCustomers');
                    const myCustomers = propsCustomers.filter(c => c.assignedTo === Number(user.id));
                    setLocalCustomers(myCustomers);
                }
            } catch (err) {
                console.error('[DashboardV2] Failed to fetch customers:', err);
                // Fallback to propsCustomers on error
                if (propsCustomers && propsCustomers.length > 0) {
                    console.log('[DashboardV2] Error fallback to propsCustomers');
                    const myCustomers = propsCustomers.filter(c => c.assignedTo === Number(user.id));
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
            filterByAppointment ||
            filterByOverdueAppointment ||
            (hideContactedDays !== null) ||
            deferredSelectedRegions.length > 0 ||
            deferredSelectedTagIds.length > 0 ||
            (deferredQuickFilter && deferredQuickFilter !== "all");

        // No filter active = no highlights needed (clean look)
        if (!hasActiveFilter) return matches;

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

            // Apply Quick Filter
            if (deferredQuickFilter && deferredQuickFilter !== "all") {
                filtered = filtered.filter(c => {
                    const hasCalled = lastCallMap.has(String(c.id));
                    if (deferredQuickFilter === "uncontacted") return !hasCalled;
                    if (deferredQuickFilter === "contacted") return hasCalled;
                    if (deferredQuickFilter === "highGrade") {
                        return c.grade === CustomerGrade.APlus || c.grade === CustomerGrade.A || c.grade === CustomerGrade.B;
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
            if (filterByAppointment) {
                filtered = filtered.filter(c => {
                    const appointmentInfo = appointmentInfoMap.get(String(c.id));
                    return appointmentInfo?.hasUpcoming === true;
                });
            }

            // Apply Overdue Appointment Filter
            if (filterByOverdueAppointment) {
                filtered = filtered.filter(c => {
                    const appointmentInfo = appointmentInfoMap.get(String(c.id));
                    return appointmentInfo?.hasOverdue === true;
                });
            }

            // Apply Hide Contacted Filter
            if (hideContactedDays !== null) {
                if (hideContactedDays === -1) {
                    filtered = filtered.filter(c => !lastCallMap.has(String(c.id)));
                } else {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const cutoffDate = new Date(today);
                    cutoffDate.setDate(cutoffDate.getDate() - hideContactedDays);

                    filtered = filtered.filter(c => {
                        const lastCall = lastCallMap.get(String(c.id));
                        if (!lastCall) return true;
                        const lastCallDate = new Date(lastCall.date);
                        lastCallDate.setHours(0, 0, 0, 0);
                        return lastCallDate < cutoffDate;
                    });
                }
            }

            // If any customers remain after filtering, this basket has matches
            if (filtered.length > 0) {
                matches.add(basketKey);
            }
        });

        return matches;
    }, [basketGroups, activeSearchTerm, filterByAppointment, filterByOverdueAppointment, hideContactedDays, deferredSelectedRegions, deferredSelectedTagIds, deferredQuickFilter, lastCallMap, appointmentInfoMap]);

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

        // Apply Quick Filter (use deferred value to prevent UI blocking)
        if (deferredQuickFilter !== "all") {
            customers = customers.filter(c => {
                const hasCalled = lastCallMap.has(String(c.id));

                if (deferredQuickFilter === "uncontacted") return !hasCalled;
                if (deferredQuickFilter === "contacted") return hasCalled;
                if (deferredQuickFilter === "highGrade") {
                    return c.grade === CustomerGrade.APlus || c.grade === CustomerGrade.A || c.grade === CustomerGrade.B;
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

        // Apply Appointment Filter - show only customers with UPCOMING appointments
        // Use hasUpcoming flag which correctly identifies customers with ANY upcoming appointment
        if (filterByAppointment) {
            customers = customers.filter(c => {
                const appointmentInfo = appointmentInfoMap.get(String(c.id));
                // Include if customer has ANY upcoming appointment (even if also has overdue)
                return appointmentInfo?.hasUpcoming === true;
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

        // Apply Hide Contacted Filter - hide customers called within X days
        if (hideContactedDays !== null) {
            if (hideContactedDays === -1) {
                // Hide ALL customers who have been contacted
                customers = customers.filter(c => {
                    const lastCall = lastCallMap.get(String(c.id));
                    return !lastCall; // Only show customers with no calls
                });
            } else {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const cutoffDate = new Date(today);
                cutoffDate.setDate(cutoffDate.getDate() - hideContactedDays);

                customers = customers.filter(c => {
                    const lastCall = lastCallMap.get(String(c.id));
                    if (!lastCall) return true; // No call = show

                    const lastCallDate = new Date(lastCall.date);
                    lastCallDate.setHours(0, 0, 0, 0);

                    // Hide if called within the cutoff period
                    return lastCallDate < cutoffDate;
                });
            }
        }

        // Sort
        customers = [...customers].sort((a, b) => {
            // If filtering by appointments, sort by appointment date (earliest first)
            if (filterByAppointment) {
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
    }, [basketGroups, activeBasketKey, deferredSelectedRegions, activeSearchTerm, sortBy, deferredQuickFilter, lastCallMap, deferredSelectedTagIds, filterByAppointment, filterByOverdueAppointment, appointmentInfoMap, hideContactedDays, sortByBirthday]);

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

                    {/* Upcoming Appointments Button */}
                    <UpcomingAppointmentsPanel
                        appointments={appointments || []}
                        customers={localCustomers}
                        basketGroups={basketGroups}
                        tabConfigs={tabConfigs}
                        onViewCustomer={onViewCustomer}
                        isOpen={isAppointmentPanelOpen}
                        onToggle={() => setIsAppointmentPanelOpen(!isAppointmentPanelOpen)}
                        isFilterActive={filterByAppointment}
                        onFilterToggle={() => {
                            // Mutual exclusivity: clear overdue when selecting upcoming
                            if (!filterByAppointment) {
                                setFilterByOverdueAppointment(false);
                            }
                            setFilterByAppointment(!filterByAppointment);
                        }}
                    />

                    {/* Overdue Appointments Filter Button */}
                    <button
                        onClick={() => {
                            // Mutual exclusivity: clear upcoming when selecting overdue
                            if (!filterByOverdueAppointment) {
                                setFilterByAppointment(false);
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

                    {/* Hide Contacted Filter Button */}
                    <div className="relative">
                        <button
                            onClick={() => {
                                // Toggle dropdown open/close
                                setIsHideContactedDropdownOpen(!isHideContactedDropdownOpen);
                            }}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all border ${hideContactedDays !== null
                                ? "bg-orange-100 border-orange-400 text-orange-700"
                                : "bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200"
                                }`}
                        >
                            <Phone size={18} />
                            <span className="font-medium">ซ่อนที่โทรแล้ว</span>
                            {hideContactedDays !== null && (
                                <span className="text-xs bg-orange-600 text-white px-2 py-0.5 rounded-full">
                                    {hideContactedDays === -1 ? "ทั้งหมด" : hideContactedDays === 0 ? "วันนี้" : `${hideContactedDays} วัน`}
                                </span>
                            )}
                            <ChevronDown size={16} className={`transition-transform ${isHideContactedDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Day Selection Dropdown */}
                        {isHideContactedDropdownOpen && (
                            <div className="absolute left-0 top-full mt-2 bg-white rounded-xl border border-gray-200 shadow-xl z-50 p-2 min-w-[180px]">
                                <div className="text-xs text-gray-500 px-2 py-1 mb-1">ซ่อนที่โทรภายใน (กดซ้ำเพื่อยกเลิก)</div>
                                {[
                                    { value: -1, label: "ซ่อนทั้งหมด (เคยโทร)" },
                                    { value: 0, label: "วันนี้" },
                                    { value: 1, label: "1 วัน" },
                                    { value: 3, label: "3 วัน" },
                                    { value: 7, label: "7 วัน" },
                                    { value: 14, label: "14 วัน" },
                                    { value: 30, label: "30 วัน" },
                                ].map(option => (
                                    <button
                                        key={option.value}
                                        onClick={() => {
                                            // Toggle: click = select, click again = deselect
                                            if (hideContactedDays === option.value) {
                                                setHideContactedDays(null); // Deselect
                                            } else {
                                                setHideContactedDays(option.value); // Select
                                            }
                                            // Dropdown stays open
                                        }}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${hideContactedDays === option.value
                                            ? "bg-orange-100 text-orange-700 font-medium"
                                            : "hover:bg-gray-100 text-gray-700"
                                            }`}
                                    >
                                        <span>{option.label}</span>
                                        {hideContactedDays === option.value && (
                                            <span className="text-orange-600">✓</span>
                                        )}
                                    </button>
                                ))}
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
                                    {selectedRegions.length + selectedTagIds.length}
                                </span>
                            )}
                            <ChevronDown size={16} className={`transition-transform ${isAdvancedSettingsOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Advanced Settings Dropdown */}
                        {isAdvancedSettingsOpen && (
                            <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl border border-gray-200 shadow-xl z-50 p-4 min-w-[300px]">
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
                            onClick={clearAllFilters}
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
