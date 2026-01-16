/**
 * TelesaleDashboardV2 - Basket-based customer management dashboard
 * 
 * NEW V2 Features:
 * - Tab navigation by BasketType (Upsell, NewCustomer, Month1_2, Month3, LastChance, Archive)
 * - Region filtering (เหนือ, อีสาน, กลาง, ใต้, ตะวันตก)
 * - Based on last_order_date instead of ownership_expires
 */

import React, { useState, useMemo, useEffect, useRef, useDeferredValue, useTransition, useCallback } from "react";
import { User, Customer, CustomerGrade, BasketType, ModalType, Tag, Activity, CallHistory, Order as OrderType, Appointment } from "@/types";
import CustomerTable from "@/components/CustomerTable";
import BasketTabs from "@/components/BasketTabs";
import RegionFilter from "@/components/RegionFilter";
import FilterDropdown from "@/components/FilterDropdown";
import Spinner from "@/components/Spinner";
import { RefreshCw, Search, Filter, ChevronDown, ChevronLeft, ChevronRight, Phone, ShoppingCart, Plus, FileText, Calendar, X, Settings, RotateCcw } from "lucide-react";
import {
    determineBasketType,
    groupCustomersByBasket,
    filterCustomersByRegion,
    getBasketDisplayName,
    BASKET_CONFIG
} from "@/utils/basketUtils";
import { formatThaiDate, getDaysSince, formatRelativeTime } from "@/utils/dateUtils";
import { listCustomers, apiFetch } from "@/services/api";
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

const TagColumn: React.FC<{ customer: Customer; openModal: (type: ModalType, data: any) => void; }> = ({ customer, openModal }) => {
    const visibleTags = customer.tags ? customer.tags.slice(0, 2) : [];
    const hiddenCount = (customer.tags?.length || 0) - visibleTags.length;

    return (
        <div className="flex items-center flex-wrap gap-1">

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

    const statusConfig = {
        appointment: { label: 'นัดเรียบร้อย', color: 'text-blue-600' },
        contacted: { label: 'โทรแล้ว', color: 'text-green-600' },
        callback: { label: 'รอติดต่อ', color: 'text-orange-600' },
        not_contacted: { label: 'ยังไม่โทร', color: 'text-gray-500' }
    };

    const { label, color } = statusConfig[status];

    // Detail text on second line
    let detail = '';
    if (status === 'appointment' && daysUntilAppointment !== undefined) {
        if (daysUntilAppointment === 0) detail = 'วันนี้';
        else if (daysUntilAppointment === 1) detail = 'พรุ่งนี้';
        else detail = `อีก ${daysUntilAppointment} วัน`;
    } else if (status === 'contacted' || status === 'callback') {
        // Show call count if available, otherwise just show status
        detail = callCount > 0 ? `${callCount} ครั้ง` : '';
    }

    return (
        <div className="text-sm">
            <div className={`font-medium ${color}`}>{label}</div>
            {detail && <div className="text-xs text-gray-400">{detail}</div>}
        </div>
    );
};

// Upcoming Appointments Panel Component
interface AppointmentWithCustomer {
    appointment: Appointment;
    customer?: Customer;
    daysUntil: number;
}

const UpcomingAppointmentsPanel: React.FC<{
    appointments: Appointment[];
    customers: Customer[];
    onViewCustomer: (customer: Customer) => void;
    isOpen: boolean;
    onToggle: () => void;
    isFilterActive?: boolean;
    onFilterToggle?: () => void;
}> = ({ appointments, customers, onViewCustomer, isOpen, onToggle, isFilterActive = false, onFilterToggle }) => {
    // Create customer map for quick lookup
    const customerMap = useMemo(() => {
        const map = new Map<string, Customer>();
        customers.forEach(c => map.set(String(c.id), c));
        return map;
    }, [customers]);

    // Get upcoming appointments (not completed, today or future), sorted by date
    const upcomingAppointments = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return appointments
            .filter(apt => {
                if (apt.status === 'เสร็จสิ้น') return false;
                const aptDate = new Date(apt.date);
                aptDate.setHours(0, 0, 0, 0);
                return aptDate >= today;
            })
            .map(apt => {
                const aptDate = new Date(apt.date);
                aptDate.setHours(0, 0, 0, 0);
                const daysUntil = Math.ceil((aptDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                return {
                    appointment: apt,
                    customer: customerMap.get(String(apt.customerId)),
                    daysUntil
                };
            })
            .sort((a, b) => a.daysUntil - b.daysUntil);
    }, [appointments, customerMap]);

    const getDaysLabel = (days: number) => {
        if (days === 0) return <span className="text-red-600 font-semibold">วันนี้</span>;
        if (days === 1) return <span className="text-orange-600 font-semibold">พรุ่งนี้</span>;
        if (days <= 3) return <span className="text-yellow-600">อีก {days} วัน</span>;
        return <span className="text-gray-500">อีก {days} วัน</span>;
    };

    // Handle button click - toggle filter if onFilterToggle is provided
    const handleButtonClick = () => {
        if (onFilterToggle) {
            onFilterToggle();
        } else {
            onToggle();
        }
    };

    return (
        <div className="relative">
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
                {upcomingAppointments.length > 0 && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${isFilterActive
                        ? "bg-green-600 text-white"
                        : "bg-blue-600 text-white"
                        }`}>
                        {upcomingAppointments.length}
                    </span>
                )}
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
    daysUntilAppointment
}: {
    customer: Customer;
    onViewCustomer: (c: Customer) => void;
    openModal: (t: ModalType, d: any) => void;
    activeBasket: BasketType;
    lastCall?: CallHistory;
    hasAppointment?: boolean;
    callCount: number;
    daysUntilAppointment?: number;
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
                    hasLastCall={!!lastCall}
                    callCount={callCount}
                    hasAppointment={hasAppointment}
                    daysUntilAppointment={daysUntilAppointment}
                    lastCallResult={lastCall?.result}
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
                    {lastCall?.notes ? (
                        <p className="text-xs text-gray-700 truncate" title={lastCall.notes}>
                            {lastCall.notes}
                        </p>
                    ) : (
                        <span className="text-xs text-gray-400">-</span>
                    )}
                </div>
            </td>
            <td className="px-4 py-3">
                <MemoizedTagColumn customer={customer} openModal={openModal} />
            </td>
            <td className="px-4 py-3 text-center">
                <div className="flex items-center justify-center gap-2">
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
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onViewCustomer(customer);
                        }}
                        className="p-2 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                        title="ดูรายละเอียดลูกค้า"
                    >
                        <FileText size={16} />
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

    const [activeBasket, setActiveBasket] = usePersistentState<BasketType>(
        `telesale_v2_basket_${user.id}`,
        BasketType.Month1_2
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
        setActiveSearchTerm(searchTerm);
    };

    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const [sortBy, setSortBy] = useState<"lastOrder" | "name" | "grade" | "dateAssignedNewest" | "dateAssignedOldest">("lastOrder");
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

    // Hide Contacted Filter - hide customers called within X days (null = disabled)
    const [hideContactedDays, setHideContactedDays] = useState<number | null>(null);
    const [isHideContactedDropdownOpen, setIsHideContactedDropdownOpen] = useState(false);

    // Advanced Settings Panel toggle
    const [isAdvancedSettingsOpen, setIsAdvancedSettingsOpen] = useState(false);

    // Check if any filters are active
    const hasActiveFilters = selectedRegions.length > 0 || selectedTagIds.length > 0 || filterByAppointment || hideContactedDays !== null;

    // Clear all filters
    const clearAllFilters = () => {
        setSelectedRegions([]);
        setSelectedTagIds([]);
        setFilterByAppointment(false);
        setHideContactedDays(null);
    };

    // Reset page when filter/basket changes
    useEffect(() => {
        setCurrentPage(1);
    }, [activeBasket, selectedRegions, searchTerm, quickFilter, filterByAppointment, hideContactedDays]);

    // Optimize Call History Lookup
    const lastCallMap = useMemo(() => {
        const map = new Map<string, CallHistory>();
        if (!calls) return map;

        calls.forEach(call => {
            if (!call.customerId) return;
            // Use 'date' field per types.ts definition
            const callDate = new Date(call.date || Date.now());
            const existing = map.get(String(call.customerId));
            const existingDate = existing ? new Date(existing.date || 0) : null;

            if (!existing || (existingDate && callDate > existingDate)) {
                map.set(String(call.customerId), call);
            }
        });
        return map;
    }, [calls]);

    // Track customers with upcoming appointments and days until appointment
    const appointmentInfoMap = useMemo(() => {
        const map = new Map<string, { hasAppointment: boolean; daysUntil?: number }>();
        if (!appointments) return map;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        appointments.forEach(apt => {
            if (!apt.customerId) return;

            // Skip completed appointments
            if (apt.status === 'เสร็จสิ้น') return;

            const aptDate = new Date(apt.date);
            aptDate.setHours(0, 0, 0, 0);

            // Only include appointments that are today or in the future
            if (aptDate >= today) {
                const customerId = String(apt.customerId);
                const daysUntil = Math.ceil((aptDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                // Keep the closest appointment
                const existing = map.get(customerId);
                if (!existing || (existing.daysUntil !== undefined && daysUntil < existing.daysUntil)) {
                    map.set(customerId, { hasAppointment: true, daysUntil });
                }
            }
        });
        return map;
    }, [appointments]);

    // Count calls by current user after date_assigned for each customer
    const callCountMap = useMemo(() => {
        const map = new Map<string, number>();
        if (!calls) return map;

        // Create a map of customer dateAssigned for quick lookup
        const customerDateAssigned = new Map<string, Date>();
        localCustomers.forEach(c => {
            if (c.dateAssigned) {
                customerDateAssigned.set(String(c.id), new Date(c.dateAssigned));
            }
        });

        calls.forEach(call => {
            if (!call.customerId) return;
            const customerId = String(call.customerId);

            // Only count calls made by the current user
            if (Number(call.caller) !== user.id) return;

            // Only count calls after the customer was assigned to this user
            const dateAssigned = customerDateAssigned.get(customerId);
            if (dateAssigned) {
                const callDate = new Date(call.date);
                if (callDate < dateAssigned) return;
            }

            map.set(customerId, (map.get(customerId) || 0) + 1);
        });
        return map;
    }, [calls, localCustomers, user.id]);

    // Load customers: Use props if available, otherwise fetch directly from API
    useEffect(() => {
        if (!user?.id) return;

        // If props have customers, use them
        if (propsCustomers && propsCustomers.length > 0) {
            const myCustomers = propsCustomers.filter(c => c.assignedTo === Number(user.id));
            setLocalCustomers(myCustomers);
            return;
        }

        // Otherwise, fetch directly from API
        const fetchCustomers = async () => {
            try {
                const response = await listCustomers({
                    companyId: user.companyId,
                    assignedTo: user.id,
                    pageSize: 10000
                });

                // listCustomers returns { total, data } object
                const customers = response?.data || [];
                if (customers.length > 0) {
                    const mapped = customers.map((r: any) => mapCustomerFromApi(r));
                    setLocalCustomers(mapped);
                }
            } catch (err) {
                console.error('[DashboardV2] Failed to fetch customers:', err);
            }
        };

        fetchCustomers();
    }, [user.id, user.companyId, refreshTrigger, propsCustomers]);

    // NOTE: Dashboard now fetches its own data if props are empty

    // Group customers by basket type
    const basketGroups = useMemo(() => {
        return groupCustomersByBasket(localCustomers);
    }, [localCustomers]);

    // Tab counts - Dashboard V2 shows only 4 baskets
    // (LastChance and other baskets are for Distribution page)
    const tabConfigs = useMemo(() => [
        { type: BasketType.Upsell, count: basketGroups[BasketType.Upsell].length },
        { type: BasketType.NewCustomer, count: basketGroups[BasketType.NewCustomer].length },
        { type: BasketType.Month1_2, count: basketGroups[BasketType.Month1_2].length },
        { type: BasketType.Month3, count: basketGroups[BasketType.Month3].length },
    ], [basketGroups]);

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
        let customers = basketGroups[activeBasket] || [];

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

        // Apply search filter
        if (activeSearchTerm) {
            const lower = activeSearchTerm.toLowerCase();
            customers = customers.filter(c =>
                c.firstName?.toLowerCase().includes(lower) ||
                c.lastName?.toLowerCase().includes(lower) ||
                c.phone?.includes(activeSearchTerm) ||
                c.province?.toLowerCase().includes(lower)
            );
        }

        // Apply Appointment Filter - show only customers with upcoming appointments
        if (filterByAppointment) {
            customers = customers.filter(c => {
                const appointmentInfo = appointmentInfoMap.get(String(c.id));
                return appointmentInfo?.hasAppointment === true;
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
    }, [basketGroups, activeBasket, deferredSelectedRegions, activeSearchTerm, sortBy, deferredQuickFilter, lastCallMap, deferredSelectedTagIds, filterByAppointment, appointmentInfoMap, hideContactedDays]);

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
            {/* Header */}
            <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 mb-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">
                            แดชบอร์ด V2
                            <span className="ml-2 px-2 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-full">เบต้า</span>
                        </h1>
                        <p className="text-gray-500 mt-1">
                            ลูกค้าทั้งหมด: <span className="font-semibold text-gray-700">{totalCustomers.toLocaleString()}</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* Basket Tabs */}
            <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 mb-6">
                <BasketTabs
                    tabs={tabConfigs}
                    activeTab={activeBasket}
                    onTabChange={setActiveBasket}
                />
            </div>

            {/* Search & Filters Row */}
            <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-4 mb-6">
                <div className="flex flex-wrap items-center gap-4">
                    {/* Search - Now first and on the left */}
                    <div className="relative flex-1 min-w-[200px]">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="ค้นหาชื่อ, เบอร์โทร, จังหวัด... (กด Enter)"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={handleSearchKeyDown}
                            className="w-full pl-10 pr-20 py-2.5 rounded-xl border border-gray-200 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
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
                        onViewCustomer={onViewCustomer}
                        isOpen={isAppointmentPanelOpen}
                        onToggle={() => setIsAppointmentPanelOpen(!isAppointmentPanelOpen)}
                        isFilterActive={filterByAppointment}
                        onFilterToggle={() => setFilterByAppointment(!filterByAppointment)}
                    />

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
                        {getBasketDisplayName(activeBasket)}
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
                                            activeBasket={activeBasket}
                                            lastCall={lastCallMap.get(String(customer.id))}
                                            hasAppointment={appointmentInfoMap.get(String(customer.id))?.hasAppointment}
                                            callCount={callCountMap.get(String(customer.id)) || 0}
                                            daysUntilAppointment={appointmentInfoMap.get(String(customer.id))?.daysUntil}
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
