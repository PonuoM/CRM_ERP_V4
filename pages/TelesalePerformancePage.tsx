import { useState, useEffect, useMemo } from 'react';
import resolveApiBasePath from '@/utils/apiBasePath';
import UniversalDateRangePicker from '@/components/UniversalDateRangePicker';
import useTeamEmployeeFilter from '../hooks/useTeamEmployeeFilter';

// ==========================================
// Interfaces
// ==========================================
interface DailyMetrics {
    totalCalls: number;
    connectedCalls: number;
    talkedCalls: number;
    missedCalls: number;
    totalMinutes: number;
    answerRate: number;
    workingHours: number;
    totalSales: number;
    upsellSales: number;
    cancelledSales: number;
    returnedSales: number;
    grossSales: number;
    totalOrders: number;
    upsellOrders: number;
    grossOrders: number;
    newCustOrders: number;
    newCustSales: number;
    coreCustOrders: number;
    coreCustSales: number;
    revivalCustOrders: number;
    revivalCustSales: number;
    bioSales: number;
    fertilizerSales: number;
    otherSales: number;
}
interface DailyRecord {
    userId: number;
    name: string;
    team: string;
    date: string;
    metrics: DailyMetrics;
}
interface DailyFilterUser {
    id: number;
    name: string;
    team: string;
}

interface Metrics {
    // Orders & Conversion
    totalOrders: number;
    conversionRate: number;

    // Sales
    totalSales: number;           // ยอดขายปกติ
    upsellOrders: number;
    upsellSales: number;
    combinedSales: number;        // ยอดขายรวม ★

    // Customers 3 months
    customers90Days: number;

    // AOV by category
    aovFertilizer: number;
    aovBio: number;

    // ลูกค้าใหม่ (38,46,47)
    newCustCount: number;
    newCustOrders: number;
    newCustSales: number;
    newCustRate: number;

    // ลูกค้าเก่า (39,40)
    coreCustCount: number;
    coreCustOrders: number;
    coreCustSales: number;
    coreCustRate: number;

    // ลูกค้าขุด (48,49,50)
    revivalCustCount: number;
    revivalCustOrders: number;
    revivalCustSales: number;
    revivalCustRate: number;

    // ตีกลับ (Returned)
    returnedOrders: number;
    returnedSales: number;

    // Target
    targetAmount: number;
    targetProgress: number;

    // Call metrics
    totalCalls: number;
    connectedCalls: number;
    talkedCalls: number;
    answeredCalls: number;
    missedCalls: number;
    inboundCalls: number;
    outboundCalls: number;
    answerRate: number;
    totalMinutes: number;
    avgMinutesPerCall: number;

    // Attendance
    workingDays: number;
    avgMinutesPerDay: number;
}

interface TelesaleDetail {
    userId: number;
    name: string;
    firstName: string;
    phone: string;
    metrics: Metrics;
}

interface RankingItem {
    userId: number;
    name: string;
    value: number;
    [key: string]: unknown;
}

interface TeamTotals {
    totalOrders: number;
    totalSales: number;
    upsellSales: number;
    combinedSales: number;
    totalCalls: number;
    connectedCalls: number;
    talkedCalls: number;
    answeredCalls: number;
    missedCalls: number;
    inboundCalls: number;
    totalMinutes: number;
    newCustCount: number;
    coreCustCount: number;
    revivalCustCount: number;
    newCustOrders: number;
    coreCustOrders: number;
    revivalCustOrders: number;
    conversionRate: number;
    returnedSales: number;
}

interface PerformanceData {
    period: { year: number; month: number };
    teamTotals: TeamTotals;
    telesaleCount: number;
    previousMonthSales?: number;
    rankings: {
        byConversion: RankingItem[];
        bySales: RankingItem[];
        byCoreRate: RankingItem[];
        byUpsell: RankingItem[];
    };
    telesaleDetails: TelesaleDetail[];
}

// ==========================================
// Utility Functions
// ==========================================
const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('th-TH').format(num);
};

const formatCurrency = (num: number): string => {
    return new Intl.NumberFormat('th-TH', {
        style: 'currency',
        currency: 'THB',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(num);
};

// Removed formatCurrencyShort - always show full numbers
const formatMoney = (num: number): string => {
    return `฿${formatNumber(Math.round(num))}`;
};

const THAI_MONTHS = [
    '', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

// ==========================================
// Sub-components
// ==========================================

// Ranking Card
function RankingCard({
    title,
    items,
    valuePrefix = '',
    valueSuffix = '',
    extraInfo,
    bgColor = 'bg-white'
}: {
    title: string;
    items: RankingItem[];
    valuePrefix?: string;
    valueSuffix?: string;
    extraInfo?: (item: RankingItem) => string;
    bgColor?: string;
}) {
    if (items.length === 0) return null;

    return (
        <div className={`${bgColor} rounded-xl shadow-sm border border-gray-200 overflow-hidden`}>
            <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
            </div>
            <div className="divide-y divide-gray-50">
                {items.slice(0, 5).map((item, idx) => (
                    <div key={item.userId} className="px-4 py-2 flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${idx === 0 ? 'bg-yellow-400 text-yellow-900' :
                            idx === 1 ? 'bg-gray-300 text-gray-700' :
                                idx === 2 ? 'bg-amber-600 text-white' :
                                    'bg-gray-100 text-gray-500'
                            }`}>{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-800 text-sm truncate">{item.name}</div>
                            {extraInfo && <div className="text-xs text-gray-500">{extraInfo(item)}</div>}
                        </div>
                        <div className="text-right font-bold text-gray-700">
                            {valuePrefix}{formatNumber(Math.round(item.value))}{valueSuffix}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Sortable Header Component
function SortableHeader({
    label,
    field,
    currentField,
    direction,
    onClick,
    tooltip,
    className = ''
}: {
    label: string;
    field: keyof Metrics;
    currentField: keyof Metrics;
    direction: 'asc' | 'desc';
    onClick: (field: keyof Metrics) => void;
    tooltip?: string;
    className?: string;
}) {
    const isActive = currentField === field;
    return (
        <th
            className={`px-2 py-2 text-center text-gray-600 font-medium cursor-pointer hover:bg-gray-100 whitespace-nowrap text-xs ${className}`}
            onClick={() => onClick(field)}
            title={tooltip}
        >
            <div className="flex items-center justify-center gap-1">
                <span>{label}</span>
                {isActive && (
                    <span className="text-blue-500">{direction === 'desc' ? '▼' : '▲'}</span>
                )}
            </div>
        </th>
    );
}

// ==========================================
// Main Component
// ==========================================
export default function TelesalePerformancePage({ users = [] }: { users?: any[] }) {
    const currentDate = new Date();
    const [year, setYear] = useState(currentDate.getFullYear());
    const [month, setMonth] = useState(currentDate.getMonth() + 1);
    const [data, setData] = useState<PerformanceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sortField, setSortField] = useState<keyof Metrics>('combinedSales');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    // View Mode for Daily
    const [dailyViewMode, setDailyViewMode] = useState<'old' | 'new'>('old');

    // Old Daily KPI State
    const [dailyDate, setDailyDate] = useState(() => {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    });
    const [oldDailyData, setOldDailyData] = useState<PerformanceData | null>(null);
    const [oldDailyLoading, setOldDailyLoading] = useState(false);

    // New Daily KPI State
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => {
        return new Date().toISOString().split('T')[0];
    });
    const [startTime, setStartTime] = useState('00:00');
    const [endTime, setEndTime] = useState('23:59');
    const [dailyRecords, setDailyRecords] = useState<DailyRecord[]>([]);
    const [dailyUsers, setDailyUsers] = useState<DailyFilterUser[]>([]);
    const [dailyLoading, setDailyLoading] = useState(false);
    
    // Filters
    const [selectedTeam, setSelectedTeam] = useState<string>('all');
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [showUserDropdown, setShowUserDropdown] = useState(false);

    // Column Visibility
    const [visibleCols, setVisibleCols] = useState({
        kpi_calls: true,
        kpi_minutes: true,
        kpi_connected: true,
        kpi_talked: true,
        kpi_missed: true,
        kpi_answerRate: true,
        kpi_workingHours: true,
        kpi_newCust: true,
        kpi_coreCust: true,
        kpi_revivalCust: true,
        kpi_upsell: true,
        kpi_totalOrders: true,
        kpi_totalSales: true,
        kpi_closeRate: true,
        
        sales_gross: true,
        sales_cancelled: true,
        sales_returned: true,
        sales_net: true,
        sales_bio: true,
        sales_fertilizer: true,
        sales_other: true,
    });

    // Target Modal State
    const [showTargetModal, setShowTargetModal] = useState(false);
    const [targetMonth, setTargetMonth] = useState(currentDate.getMonth() + 1);
    const [targetYear, setTargetYear] = useState(currentDate.getFullYear());
    const [targetTelesales, setTargetTelesales] = useState<{ user_id: number; first_name: string; last_name: string; target_amount: number }[]>([]);
    const [targetLoading, setTargetLoading] = useState(false);
    const [savingTarget, setSavingTarget] = useState<number | null>(null);

    // Fetch data with debounce to prevent excessive API calls
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const token = localStorage.getItem('authToken');
                const API_BASE = resolveApiBasePath();

                // Monthly data fetch
                const url = `${API_BASE}/User_DB/telesale_performance.php?year=${year}&month=${month}`;

                const response = await fetch(
                    url,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );

                if (!response.ok) {
                    throw new Error('Failed to fetch data');
                }

                const result = await response.json();
                if (result.success) {
                    setData(result.data);
                } else {
                    setError(result.message || 'Failed to load data');
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        };

        // Debounce: wait 500ms before fetching to avoid rapid API calls
        const debounceTimer = setTimeout(() => {
            fetchData();
        }, 500);

        // Cleanup: cancel previous timer if deps change before 500ms
        return () => clearTimeout(debounceTimer);
    }, [year, month]);

    // Fetch Old Daily KPI Data
    useEffect(() => {
        const fetchOldDailyData = async () => {
            setOldDailyLoading(true);
            try {
                const token = localStorage.getItem('authToken');
                const API_BASE = resolveApiBasePath();
                const url = `${API_BASE}/User_DB/telesale_performance.php?year=${year}&month=${month}&date=${dailyDate}`;

                const response = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        setOldDailyData(result.data);
                    }
                }
            } catch (err) {
                console.error('Error fetching old daily data:', err);
            } finally {
                setOldDailyLoading(false);
            }
        };

        const debounceTimer = setTimeout(() => {
            fetchOldDailyData();
        }, 500);

        return () => clearTimeout(debounceTimer);
    }, [dailyDate, year, month]);

    // Fetch New Daily KPI Data
    useEffect(() => {
        const fetchDailyData = async () => {
            setDailyLoading(true);
            try {
                const token = localStorage.getItem('authToken');
                const API_BASE = resolveApiBasePath();
                const url = `${API_BASE}/User_DB/telesale_daily_performance.php?start_date=${startDate}&end_date=${endDate}&start_time=${startTime}&end_time=${endTime}`;

                const response = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        setDailyRecords(result.data.dailyRecords);
                        setDailyUsers(result.data.users);
                    }
                }
            } catch (err) {
                console.error('Error fetching daily data:', err);
            } finally {
                setDailyLoading(false);
            }
        };

        const debounceTimer = setTimeout(() => {
            fetchDailyData();
        }, 500);

        return () => clearTimeout(debounceTimer);
    }, [startDate, endDate, startTime, endTime]);

    const { availableTeams, filteredUsers: filteredUserDropdown } = useTeamEmployeeFilter(users, selectedTeam);

    // Computed Daily Data
    const filteredDailyRecords = useMemo(() => {
        const validUserIds = filteredUserDropdown.map(u => u.id.toString());
        return dailyRecords.filter(r => {
            const matchUser = selectedUsers.length === 0 
                ? validUserIds.includes(r.userId.toString()) 
                : selectedUsers.includes(r.userId.toString());
            return matchUser;
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || a.name.localeCompare(b.name));
    }, [dailyRecords, selectedUsers, filteredUserDropdown]);

    const summaryDailyRecords = useMemo(() => {
        const summary = new Map<number, DailyRecord>();
        filteredDailyRecords.forEach(r => {
            if (!summary.has(r.userId)) {
                summary.set(r.userId, {
                    userId: r.userId,
                    name: r.name,
                    team: r.team,
                    date: 'สรุปรวม',
                    metrics: {
                        totalCalls: 0, connectedCalls: 0, talkedCalls: 0, missedCalls: 0, totalMinutes: 0, answerRate: 0,
                        totalSales: 0, upsellSales: 0, cancelledSales: 0, returnedSales: 0, grossSales: 0,
                        totalOrders: 0, upsellOrders: 0, grossOrders: 0,
                        newCustOrders: 0, newCustSales: 0, coreCustOrders: 0, coreCustSales: 0, revivalCustOrders: 0, revivalCustSales: 0,
                        bioSales: 0, fertilizerSales: 0, otherSales: 0,
                    }
                });
            }
            const s = summary.get(r.userId)!.metrics;
            const m = r.metrics;
            s.totalCalls += m.totalCalls;
            s.connectedCalls += m.connectedCalls;
            s.talkedCalls += m.talkedCalls;
            s.missedCalls += m.missedCalls;
            s.totalMinutes += m.totalMinutes;
            if (m.workingHours) {
                s.workingHours = (s.workingHours || 0) + m.workingHours;
            }
            s.totalSales += m.totalSales;
            s.upsellSales += m.upsellSales;
            s.cancelledSales += m.cancelledSales;
            s.returnedSales += m.returnedSales;
            s.grossSales += m.grossSales;
            s.totalOrders += m.totalOrders;
            s.upsellOrders += m.upsellOrders;
            s.grossOrders += m.grossOrders;
            s.newCustOrders += m.newCustOrders;
            s.newCustSales += m.newCustSales;
            s.coreCustOrders += m.coreCustOrders;
            s.coreCustSales += m.coreCustSales;
            s.revivalCustOrders += m.revivalCustOrders;
            s.revivalCustSales += m.revivalCustSales;
            s.bioSales += m.bioSales;
            s.fertilizerSales += m.fertilizerSales;
            s.otherSales += m.otherSales;
        });
        
        // Recalculate rates
        return Array.from(summary.values()).map(r => {
            r.metrics.answerRate = r.metrics.totalCalls > 0 ? (r.metrics.connectedCalls / r.metrics.totalCalls) * 100 : 0;
            return r;
        });
    }, [filteredDailyRecords]);



    // Sorted telesale details
    const sortedDetails = useMemo(() => {
        if (!data) return [];
        return [...data.telesaleDetails].sort((a, b) => {
            const aVal = a.metrics[sortField] ?? 0;
            const bVal = b.metrics[sortField] ?? 0;
            return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;
        });
    }, [data, sortField, sortDirection]);

    // Handle sort
    const handleSort = (field: keyof Metrics) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    // Generate year options
    const yearOptions = [];
    for (let y = currentDate.getFullYear(); y >= 2024; y--) {
        yearOptions.push(y);
    }

    // Fetch targets for modal
    const fetchTargets = async (m: number, y: number) => {
        setTargetLoading(true);
        try {
            const token = localStorage.getItem('authToken');
            const API_BASE = resolveApiBasePath();
            const response = await fetch(
                `${API_BASE}/User_DB/sales_targets.php?year=${y}&month=${m}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            const result = await response.json();
            if (result.success) {
                setTargetTelesales(result.telesales || []);
            }
        } catch (err) {
            console.error('Failed to fetch targets:', err);
        } finally {
            setTargetLoading(false);
        }
    };

    // Save a single target
    const saveTarget = async (userId: number, targetAmount: number) => {
        setSavingTarget(userId);
        try {
            const token = localStorage.getItem('authToken');
            const API_BASE = resolveApiBasePath();
            await fetch(`${API_BASE}/User_DB/sales_targets.php`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'save_one',
                    user_id: userId,
                    month: targetMonth,
                    year: targetYear,
                    target_amount: targetAmount
                })
            });
        } catch (err) {
            console.error('Failed to save target:', err);
        } finally {
            setSavingTarget(null);
        }
    };

    // Save all targets
    const saveAllTargets = async () => {
        setSavingTarget(-1);
        try {
            const token = localStorage.getItem('authToken');
            const API_BASE = resolveApiBasePath();
            await fetch(`${API_BASE}/User_DB/sales_targets.php`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'save_all',
                    month: targetMonth,
                    year: targetYear,
                    targets: targetTelesales.map(t => ({
                        user_id: t.user_id,
                        target_amount: t.target_amount
                    }))
                })
            });
            setShowTargetModal(false);
        } catch (err) {
            console.error('Failed to save all targets:', err);
        } finally {
            setSavingTarget(null);
        }
    };

    // Open modal and fetch targets
    const openTargetModal = () => {
        setTargetMonth(month);
        setTargetYear(year);
        setShowTargetModal(true);
        fetchTargets(month, year);
    };

    // Handle target month change
    const handleTargetMonthChange = (newMonth: number, newYear: number) => {
        setTargetMonth(newMonth);
        setTargetYear(newYear);
        fetchTargets(newMonth, newYear);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6">
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    <strong>Error:</strong> {error}
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-4 bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        📊 วิเคราะห์ประสิทธิภาพ Telesale
                    </h1>
                    <p className="text-gray-500 text-sm">
                        {THAI_MONTHS[month]} {year} • Telesale {data?.telesaleCount || 0} คน
                    </p>
                </div>

                {/* Period Selectors - Monthly Only */}
                <div className="flex gap-2 flex-wrap items-center">
                    <select
                        value={month}
                        onChange={(e) => setMonth(parseInt(e.target.value))}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                        {THAI_MONTHS.slice(1).map((name, idx) => (
                            <option key={idx + 1} value={idx + 1}>{name}</option>
                        ))}
                    </select>
                    <select
                        value={year}
                        onChange={(e) => setYear(parseInt(e.target.value))}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                        {yearOptions.map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                    <button
                        onClick={openTargetModal}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2 font-medium text-sm"
                    >
                        🎯 ตั้งเป้า
                    </button>
                </div>
            </div>

            {/* TEAM SALES HERO BANNER */}
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <div className="text-sm text-gray-500 mb-1">ยอดขายรวมทีม {THAI_MONTHS[month]}</div>
                        <div className="text-3xl font-bold text-gray-800 tracking-tight">
                            ฿{formatNumber(data?.teamTotals.combinedSales || 0)}
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                            ปกติ ฿{formatNumber(data?.teamTotals.totalSales || 0)} + Upsell ฿{formatNumber(data?.teamTotals.upsellSales || 0)} + ตีกลับ ฿{formatNumber(data?.teamTotals.returnedSales || 0)}
                        </div>
                        {/* Month comparison */}
                        {data?.previousMonthSales !== undefined && (
                            <div className="mt-2 flex items-center gap-2">
                                {(() => {
                                    const prev = data.previousMonthSales || 0;
                                    const curr = data.teamTotals.combinedSales || 0;
                                    const diff = curr - prev;
                                    const pct = prev > 0 ? ((diff / prev) * 100).toFixed(1) : '∞';
                                    const isUp = diff >= 0;
                                    return (
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${isUp ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {isUp ? '+' : ''}{pct}% vs เดือนก่อน
                                        </span>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                    <div className="flex gap-4 text-center">
                        <div className="px-4 py-2 bg-gray-50 rounded-lg border border-gray-100">
                            <div className="text-2xl font-bold text-gray-800">{formatNumber(data?.teamTotals.totalOrders || 0)}</div>
                            <div className="text-xs text-gray-500">ออเดอร์</div>
                        </div>
                        <div className="px-4 py-2 bg-gray-50 rounded-lg border border-gray-100">
                            <div className="text-2xl font-bold text-gray-800">{formatNumber(data?.teamTotals.totalCalls || 0)}</div>
                            <div className="text-xs text-gray-500">สายโทร</div>
                        </div>
                        <div className="px-4 py-2 bg-gray-50 rounded-lg border border-gray-100">
                            <div className="text-2xl font-bold text-gray-800">{data?.teamTotals.conversionRate || 0}%</div>
                            <div className="text-xs text-gray-500">ปิดการขาย</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Customer Segment Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* ลูกค้าใหม่ */}
                <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-gray-700">ลูกค้าใหม่</span>
                    </div>
                    <div className="flex justify-between items-end">
                        <div>
                            <div className="text-3xl font-bold text-gray-800">{formatNumber(data?.teamTotals.newCustCount || 0)}</div>
                            <div className="text-xs text-gray-500">ถือครอง</div>
                        </div>
                        <div className="text-right">
                            <div className="text-xl font-bold text-gray-600">{formatNumber(data?.teamTotals.newCustOrders || 0)}</div>
                            <div className="text-xs text-gray-500">ออเดอร์</div>
                        </div>
                    </div>
                </div>

                {/* ลูกค้าเก่า 3 เดือน */}
                <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-gray-700">ลูกค้าเก่า 3 เดือน</span>
                    </div>
                    <div className="flex justify-between items-end">
                        <div>
                            <div className="text-3xl font-bold text-gray-800">{formatNumber(data?.teamTotals.coreCustCount || 0)}</div>
                            <div className="text-xs text-gray-500">ถือครอง</div>
                        </div>
                        <div className="text-right">
                            <div className="text-xl font-bold text-gray-600">{formatNumber(data?.teamTotals.coreCustOrders || 0)}</div>
                            <div className="text-xs text-gray-500">ซื้อซ้ำ</div>
                        </div>
                    </div>
                </div>

                {/* ลูกค้าขุด */}
                <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-gray-700">ลูกค้าขุด</span>
                    </div>
                    <div className="flex justify-between items-end">
                        <div>
                            <div className="text-3xl font-bold text-gray-800">{formatNumber(data?.teamTotals.revivalCustCount || 0)}</div>
                            <div className="text-xs text-gray-500">ถือครอง</div>
                        </div>
                        <div className="text-right">
                            <div className="text-xl font-bold text-gray-600">{formatNumber(data?.teamTotals.revivalCustOrders || 0)}</div>
                            <div className="text-xs text-gray-500">กู้สำเร็จ</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Rankings Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <RankingCard
                    title="ยอดขายรวมสูงสุด"
                    items={data?.rankings.bySales || []}
                    valuePrefix="฿"
                    extraInfo={(item) => `Upsell: ฿${formatNumber(item.upsell as number)}`}
                />
                <RankingCard
                    title="อัตราปิดการขายสูงสุด"
                    items={data?.rankings.byConversion || []}
                    valueSuffix="%"
                    extraInfo={(item) => `${item.calls} สาย → ${item.orders} ออเดอร์`}
                />
                <RankingCard
                    title="ลูกค้าเก่าซื้อซ้ำสูงสุด"
                    items={data?.rankings.byCoreRate || []}
                    valueSuffix="%"
                    extraInfo={(item) => `${item.orders}/${item.count} ซื้อซ้ำ`}
                />
                <RankingCard
                    title="Upsell สูงสุด"
                    items={data?.rankings.byUpsell || []}
                    valuePrefix="฿"
                    extraInfo={(item) => `${item.orders} ออเดอร์`}
                    bgColor="bg-gray-50"
                />
            </div>

            {/* Detail Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="p-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-800">📋 รายละเอียด Telesale</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-gray-50 sticky top-0">
                            <tr>
                                <th className="px-2 py-2 text-left text-gray-600 font-medium whitespace-nowrap">#</th>
                                <th className="px-2 py-2 text-left text-gray-600 font-medium whitespace-nowrap sticky left-0 bg-gray-50 z-10">ชื่อ</th>
                                <SortableHeader label="ออเดอร์" field="totalOrders" currentField={sortField} direction={sortDirection} onClick={handleSort} />
                                <SortableHeader label="ปิดการขาย %" field="conversionRate" currentField={sortField} direction={sortDirection} onClick={handleSort} />
                                <SortableHeader label="ยอดขาย" field="totalSales" currentField={sortField} direction={sortDirection} onClick={handleSort} tooltip="ยอดขายปกติ (ไม่รวม Upsell)" />
                                <SortableHeader label="ลค.3เดือน" field="customers90Days" currentField={sortField} direction={sortDirection} onClick={handleSort} tooltip="ลูกค้า 3 เดือน (basket 39,40)" />
                                <SortableHeader label="ขายปุ๋ย/ออเดอร์" field="aovFertilizer" currentField={sortField} direction={sortDirection} onClick={handleSort} tooltip="เฉลี่ย/บิล สินค้าปุ๋ย" />
                                <SortableHeader label="ขายชีวภัณฑ์/ออเดอร์" field="aovBio" currentField={sortField} direction={sortDirection} onClick={handleSort} tooltip="เฉลี่ย/บิล สินค้าชีวภัณฑ์" />
                                {/* ลูกค้าใหม่ */}
                                <th className="px-2 py-2 text-center text-gray-600 font-medium whitespace-nowrap bg-gray-100 border-l-2 border-gray-300" colSpan={4}>
                                    ลูกค้าใหม่
                                </th>
                                {/* ลูกค้าเก่า */}
                                <th className="px-2 py-2 text-center text-gray-600 font-medium whitespace-nowrap bg-gray-100 border-l-2 border-gray-300" colSpan={4}>
                                    ลูกค้าเก่า
                                </th>
                                {/* ลูกค้าขุด */}
                                <th className="px-2 py-2 text-center text-gray-600 font-medium whitespace-nowrap bg-gray-100 border-l-2 border-gray-300" colSpan={4}>
                                    ลูกค้าขุด
                                </th>
                                {/* Upsell */}
                                <th className="px-2 py-2 text-center text-blue-600 font-medium whitespace-nowrap bg-blue-50 border-l-2 border-gray-300" colSpan={2}>
                                    Upsell
                                </th>
                                {/* ตีกลับ */}
                                <th className="px-2 py-2 text-center text-red-600 font-medium whitespace-nowrap bg-red-50 border-l-2 border-gray-300" colSpan={2}>
                                    ตีกลับ
                                </th>
                                {/* ยอดรวม */}
                                <th className="px-2 py-2 text-center text-blue-700 font-bold whitespace-nowrap bg-blue-100 border-l-2 border-gray-300">
                                    ยอดรวม
                                </th>
                                {/* เป้า */}
                                <th className="px-2 py-2 text-center text-gray-600 font-medium whitespace-nowrap border-l-2 border-gray-300">🎯 เป้า</th>
                                {/* สาย - กลุ่มโทรศัพท์ */}
                                <th className="px-2 py-2 text-center text-gray-600 font-medium whitespace-nowrap border-l-2 border-gray-300">สาย</th>
                                <SortableHeader label="นาที" field="totalMinutes" currentField={sortField} direction={sortDirection} onClick={handleSort} tooltip="เวลาโทรรวม (นาที)" />
                                <SortableHeader label="รับสาย" field="connectedCalls" currentField={sortField} direction={sortDirection} onClick={handleSort} tooltip="สายที่รับ (status=1)" />
                                <SortableHeader label="ได้คุย" field="talkedCalls" currentField={sortField} direction={sortDirection} onClick={handleSort} tooltip="สายที่คุยได้ ≥30 วินาที (status=1 + duration≥30s)" />
                                <SortableHeader label="ไม่ได้รับ" field="missedCalls" currentField={sortField} direction={sortDirection} onClick={handleSort} tooltip="สายที่ไม่ได้รับ" />
                                <SortableHeader label="%รับ" field="answerRate" currentField={sortField} direction={sortDirection} onClick={handleSort} tooltip="อัตราการรับสาย = รับสาย ÷ สาย × 100" />
                                <SortableHeader label="วันงาน" field="workingDays" currentField={sortField} direction={sortDirection} onClick={handleSort} tooltip="วันที่ทำงาน" />
                                <SortableHeader label="นาที/สาย" field="avgMinutesPerCall" currentField={sortField} direction={sortDirection} onClick={handleSort} />
                                <SortableHeader label="นาที/วัน" field="avgMinutesPerDay" currentField={sortField} direction={sortDirection} onClick={handleSort} />
                            </tr>
                            {/* Sub-headers for grouped columns */}
                            <tr className="text-[10px]">
                                <th></th><th></th><th></th><th></th><th></th><th></th><th></th><th></th>
                                {/* ลูกค้าใหม่ sub-headers */}
                                <th className="px-1 py-1 text-center text-gray-500 bg-gray-100 border-l-2 border-gray-300">จำนวน</th>
                                <th className="px-1 py-1 text-center text-gray-500 bg-gray-100">ออเดอร์</th>
                                <th className="px-1 py-1 text-center text-gray-500 bg-gray-100">บาท</th>
                                <th className="px-1 py-1 text-center text-gray-500 bg-gray-100">%</th>
                                {/* ลูกค้าเก่า sub-headers */}
                                <th className="px-1 py-1 text-center text-gray-500 bg-gray-100 border-l-2 border-gray-300">จำนวน</th>
                                <th className="px-1 py-1 text-center text-gray-500 bg-gray-100">ออเดอร์</th>
                                <th className="px-1 py-1 text-center text-gray-500 bg-gray-100">บาท</th>
                                <th className="px-1 py-1 text-center text-gray-500 bg-gray-100">%</th>
                                {/* ลูกค้าขุด sub-headers */}
                                <th className="px-1 py-1 text-center text-gray-500 bg-gray-100 border-l-2 border-gray-300">จำนวน</th>
                                <th className="px-1 py-1 text-center text-gray-500 bg-gray-100">ออเดอร์</th>
                                <th className="px-1 py-1 text-center text-gray-500 bg-gray-100">บาท</th>
                                <th className="px-1 py-1 text-center text-gray-500 bg-gray-100">%</th>
                                {/* Upsell sub-headers */}
                                <th className="px-1 py-1 text-center text-blue-600 bg-blue-50 border-l-2 border-gray-300">ออเดอร์</th>
                                <th className="px-1 py-1 text-center text-blue-600 bg-blue-50">บาท</th>
                                {/* ตีกลับ sub-headers */}
                                <th className="px-1 py-1 text-center text-red-600 bg-red-50 border-l-2 border-gray-300">ออเดอร์</th>
                                <th className="px-1 py-1 text-center text-red-600 bg-red-50">บาท</th>
                                {/* ยอดรวม */}
                                <th className="border-l-2 border-gray-300"></th>
                                {/* เป้า */}
                                <th className="border-l-2 border-gray-300"></th>
                                {/* สาย group */}
                                <th className="border-l-2 border-gray-300"></th>
                                {/* นาที, รับสาย, ได้คุย, ไม่ได้รับ, %รับ, วันงาน, นาที/สาย, นาที/วัน */}
                                <th></th><th></th><th></th><th></th><th></th><th></th><th></th><th></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {sortedDetails.map((ts, idx) => (
                                <tr key={ts.userId} className="hover:bg-gray-50">
                                    <td className="px-2 py-2 text-gray-500">{idx + 1}</td>
                                    <td className="px-2 py-2 font-medium text-gray-800 whitespace-nowrap sticky left-0 bg-white z-10">{ts.firstName}</td>
                                    <td className="px-2 py-2 text-center">{formatNumber(ts.metrics.totalOrders)}</td>
                                    <td className="px-2 py-2 text-center">
                                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${ts.metrics.conversionRate >= 10 ? 'bg-green-100 text-green-700' :
                                            ts.metrics.conversionRate >= 5 ? 'bg-yellow-100 text-yellow-700' :
                                                'bg-gray-100 text-gray-600'
                                            }`}>
                                            {ts.metrics.conversionRate}%
                                        </span>
                                    </td>
                                    <td className="px-2 py-2 text-right font-medium">{formatMoney(ts.metrics.totalSales)}</td>
                                    <td className="px-2 py-2 text-center">{formatNumber(ts.metrics.customers90Days)}</td>
                                    <td className="px-2 py-2 text-right text-xs">{ts.metrics.aovFertilizer > 0 ? formatMoney(ts.metrics.aovFertilizer) : '-'}</td>
                                    <td className="px-2 py-2 text-right text-xs">{ts.metrics.aovBio > 0 ? formatMoney(ts.metrics.aovBio) : '-'}</td>
                                    {/* ลูกค้าใหม่ */}
                                    <td className="px-2 py-2 text-center border-l-2 border-gray-200">{formatNumber(ts.metrics.newCustCount)}</td>
                                    <td className="px-2 py-2 text-center">{formatNumber(ts.metrics.newCustOrders)}</td>
                                    <td className="px-2 py-2 text-right text-xs">{ts.metrics.newCustSales > 0 ? formatMoney(ts.metrics.newCustSales) : '-'}</td>
                                    <td className="px-2 py-2 text-center">
                                        <span className={`text-xs ${ts.metrics.newCustRate > 0 ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                                            {ts.metrics.newCustRate}%
                                        </span>
                                    </td>
                                    {/* ลูกค้าเก่า */}
                                    <td className="px-2 py-2 text-center border-l-2 border-gray-200">{formatNumber(ts.metrics.coreCustCount)}</td>
                                    <td className="px-2 py-2 text-center">{formatNumber(ts.metrics.coreCustOrders)}</td>
                                    <td className="px-2 py-2 text-right text-xs">{ts.metrics.coreCustSales > 0 ? formatMoney(ts.metrics.coreCustSales) : '-'}</td>
                                    <td className="px-2 py-2 text-center">
                                        <span className={`text-xs ${ts.metrics.coreCustRate > 0 ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                                            {ts.metrics.coreCustRate}%
                                        </span>
                                    </td>
                                    {/* ลูกค้าขุด */}
                                    <td className="px-2 py-2 text-center border-l-2 border-gray-200">{formatNumber(ts.metrics.revivalCustCount)}</td>
                                    <td className="px-2 py-2 text-center">{formatNumber(ts.metrics.revivalCustOrders)}</td>
                                    <td className="px-2 py-2 text-right text-xs">{ts.metrics.revivalCustSales > 0 ? formatMoney(ts.metrics.revivalCustSales) : '-'}</td>
                                    <td className="px-2 py-2 text-center">
                                        <span className={`text-xs ${ts.metrics.revivalCustRate > 0 ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                                            {ts.metrics.revivalCustRate}%
                                        </span>
                                    </td>
                                    {/* Upsell */}
                                    <td className="px-2 py-2 text-center bg-blue-50/30 border-l-2 border-gray-200">
                                        {ts.metrics.upsellOrders > 0 ? (
                                            <span className="text-blue-600 font-medium">{formatNumber(ts.metrics.upsellOrders)}</span>
                                        ) : '-'}
                                    </td>
                                    <td className="px-2 py-2 text-right bg-blue-50/30">
                                        {ts.metrics.upsellSales > 0 ? (
                                            <span className="text-blue-600 font-medium">{formatMoney(ts.metrics.upsellSales)}</span>
                                        ) : '-'}
                                    </td>
                                    {/* ตีกลับ */}
                                    <td className="px-2 py-2 text-center bg-red-50/30 border-l-2 border-gray-200">
                                        {ts.metrics.returnedOrders > 0 ? (
                                            <span className="text-red-600 font-medium">{formatNumber(ts.metrics.returnedOrders)}</span>
                                        ) : '-'}
                                    </td>
                                    <td className="px-2 py-2 text-right bg-red-50/30">
                                        {ts.metrics.returnedSales > 0 ? (
                                            <span className="text-red-600 font-medium">{formatMoney(ts.metrics.returnedSales)}</span>
                                        ) : '-'}
                                    </td>
                                    {/* ยอดรวม */}
                                    <td className="px-2 py-2 text-right bg-blue-100 font-bold text-blue-800 border-l-2 border-gray-200">
                                        {formatCurrency(ts.metrics.combinedSales)}
                                    </td>
                                    {/* เป้า */}
                                    <td className="px-2 py-2 border-l-2 border-gray-200">
                                        {ts.metrics.targetAmount > 0 ? (
                                            <div className="flex flex-col items-center gap-0.5">
                                                <div className="w-16 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                                    <div
                                                        className={`h-1.5 rounded-full transition-all ${ts.metrics.targetProgress >= 100 ? 'bg-green-500' :
                                                            ts.metrics.targetProgress >= 80 ? 'bg-yellow-500' :
                                                                'bg-red-500'
                                                            }`}
                                                        style={{ width: `${Math.min(ts.metrics.targetProgress, 100)}%` }}
                                                    />
                                                </div>
                                                <span className={`text-[10px] font-medium ${ts.metrics.targetProgress >= 100 ? 'text-green-600' :
                                                    ts.metrics.targetProgress >= 80 ? 'text-yellow-600' :
                                                        'text-red-600'
                                                    }`}>
                                                    {ts.metrics.targetProgress.toFixed(0)}%
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-gray-400 text-[10px]">-</span>
                                        )}
                                    </td>
                                    {/* สาย */}
                                    <td className="px-2 py-2 text-center">{formatNumber(ts.metrics.totalCalls)}</td>
                                    <td className="px-2 py-2 text-center">{ts.metrics.totalMinutes.toFixed(0)}</td>
                                    <td className="px-2 py-2 text-center text-emerald-600 font-medium">{formatNumber(ts.metrics.connectedCalls)}</td>
                                    <td className="px-2 py-2 text-center">{formatNumber(ts.metrics.talkedCalls)}</td>
                                    <td className="px-2 py-2 text-center text-red-500">{formatNumber(ts.metrics.missedCalls)}</td>
                                    <td className="px-2 py-2 text-center">
                                        <span className={`inline-block px-1.5 py-0.5 rounded-full text-xs font-medium ${(ts.metrics.answerRate ?? 0) >= 80 ? 'bg-emerald-100 text-emerald-700' : (ts.metrics.answerRate ?? 0) >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                            {(ts.metrics.answerRate ?? 0).toFixed(1)}%
                                        </span>
                                    </td>
                                    <td className="px-2 py-2 text-center">{ts.metrics.workingDays.toFixed(1)}</td>
                                    <td className="px-2 py-2 text-center">{ts.metrics.avgMinutesPerCall.toFixed(1)}</td>
                                    <td className={`px-2 py-2 text-center font-medium ${ts.metrics.avgMinutesPerDay >= 100 ? 'bg-green-100 text-green-700' :
                                        ts.metrics.avgMinutesPerDay >= 80 ? 'bg-red-50 text-red-600' :
                                            ts.metrics.avgMinutesPerDay >= 60 ? 'bg-red-100 text-red-700' :
                                                ts.metrics.avgMinutesPerDay >= 40 ? 'bg-red-200 text-red-800' :
                                                    'bg-red-300 text-red-900'
                                        }`}>{ts.metrics.avgMinutesPerDay.toFixed(0)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

                        {/* ================================================ */}
            {/* DAILY KPI TABLE - Separate Section */}
            {/* ================================================ */}
            
            {/* View Mode Tabs */}
            <div className="flex items-center gap-2 mt-8 mb-4 border-b border-gray-200">
                <button
                    onClick={() => setDailyViewMode('old')}
                    className={`px-4 py-2 font-medium text-sm transition-colors ${
                        dailyViewMode === 'old' 
                            ? 'text-blue-600 border-b-2 border-blue-600' 
                            : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    สรุปภาพรวมรายวัน
                </button>
                <button
                    onClick={() => setDailyViewMode('new')}
                    className={`px-4 py-2 font-medium text-sm transition-colors ${
                        dailyViewMode === 'new' 
                            ? 'text-blue-600 border-b-2 border-blue-600' 
                            : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    เจาะลึก KPI & หมวดหมู่
                </button>
            </div>

            {dailyViewMode === 'old' && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-gray-50">
                        <h2 className="text-lg font-bold text-gray-800">สรุปผลงานรายวัน</h2>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => {
                                    const d = new Date(dailyDate);
                                    d.setDate(d.getDate() - 1);
                                    setDailyDate(d.toISOString().split('T')[0]);
                                }}
                                className="px-3 py-2 bg-white border hover:bg-gray-50 rounded-lg text-gray-700 transition-colors"
                            >
                                ←
                            </button>
                            <input
                                type="date"
                                value={dailyDate}
                                onChange={(e) => setDailyDate(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                            />
                            <button
                                onClick={() => {
                                    const d = new Date(dailyDate);
                                    d.setDate(d.getDate() + 1);
                                    setDailyDate(d.toISOString().split('T')[0]);
                                }}
                                className="px-3 py-2 bg-white border hover:bg-gray-50 rounded-lg text-gray-700 transition-colors"
                            >
                                →
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        {oldDailyLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                            </div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 text-gray-700">
                                        <th className="px-2 py-2 text-left font-medium" rowSpan={2}>#</th>
                                        <th className="px-2 py-2 text-left font-medium" rowSpan={2}>ชื่อ</th>
                                        <th className="px-2 py-2 text-center font-medium whitespace-nowrap" rowSpan={2}>สายที่โทร<br /><span className="text-xs text-gray-500 font-normal">ทั้งหมด</span></th>
                                        <th className="px-2 py-2 text-center font-medium whitespace-nowrap" rowSpan={2}>นาทีที่โทร<br /><span className="text-xs text-gray-500 font-normal">ทั้งหมด</span></th>
                                        <th className="px-2 py-2 text-center font-medium whitespace-nowrap" rowSpan={2}>รับสาย</th>
                                        <th className="px-2 py-2 text-center font-medium whitespace-nowrap" rowSpan={2}>ได้คุย<br /><span className="text-xs text-gray-500 font-normal">(≥30 วินาที)</span></th>
                                        <th className="px-2 py-2 text-center font-medium whitespace-nowrap" rowSpan={2}>ไม่ได้รับ</th>
                                        <th className="px-2 py-2 text-center font-medium whitespace-nowrap" rowSpan={2}>%รับ</th>
                                        <th className="px-2 py-2 text-center font-medium border-l-2 border-gray-300 bg-green-100" colSpan={2}>ลูกค้าใหม่</th>
                                        <th className="px-2 py-2 text-center font-medium border-l-2 border-gray-300 bg-blue-100" colSpan={2}>ลูกค้าเก่า</th>
                                        <th className="px-2 py-2 text-center font-medium border-l-2 border-gray-300 bg-orange-100" colSpan={2}>ลูกค้าขุด</th>
                                        <th className="px-2 py-2 text-center font-medium border-l-2 border-gray-300 bg-purple-100" colSpan={2}>Upsell</th>
                                        <th className="px-2 py-2 text-center font-medium border-l-2 border-gray-300" rowSpan={2}>รวม<br /><span className="text-xs text-gray-500 font-normal">ออเดอร์</span></th>
                                        <th className="px-2 py-2 text-center font-medium" rowSpan={2}>ยอดขาย<br /><span className="text-xs text-gray-500 font-normal">รวม</span></th>
                                        <th className="px-2 py-2 text-center font-medium whitespace-nowrap" rowSpan={2}>% ปิด</th>
                                    </tr>
                                    <tr className="bg-gray-50 text-gray-600 text-xs">
                                        <th className="px-1 py-1 text-center border-l-2 border-gray-300 bg-green-50">ออเดอร์</th>
                                        <th className="px-1 py-1 text-center bg-green-50">ยอดขาย</th>
                                        <th className="px-1 py-1 text-center border-l-2 border-gray-300 bg-blue-50">ออเดอร์</th>
                                        <th className="px-1 py-1 text-center bg-blue-50">ยอดขาย</th>
                                        <th className="px-1 py-1 text-center border-l-2 border-gray-300 bg-orange-50">ออเดอร์</th>
                                        <th className="px-1 py-1 text-center bg-orange-50">ยอดขาย</th>
                                        <th className="px-1 py-1 text-center border-l-2 border-gray-300 bg-purple-50">ออเดอร์</th>
                                        <th className="px-1 py-1 text-center bg-purple-50">ยอดขาย</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {oldDailyData?.telesaleDetails.map((ts, idx) => {
                                        const totalOrders = ts.metrics.newCustOrders + ts.metrics.coreCustOrders + ts.metrics.revivalCustOrders + ts.metrics.upsellOrders;
                                        const closeRate = ts.metrics.totalCalls > 0
                                            ? ((totalOrders / ts.metrics.totalCalls) * 100).toFixed(1)
                                            : '0.0';
                                        return (
                                            <tr key={ts.userId} className="hover:bg-gray-50">
                                                <td className="px-2 py-2 text-gray-500">{idx + 1}</td>
                                                <td className="px-2 py-2 font-medium text-gray-800">{ts.name}</td>
                                                <td className="px-2 py-2 text-center">{ts.metrics.totalCalls || '-'}</td>
                                                <td className="px-2 py-2 text-center">{ts.metrics.totalMinutes > 0 ? ts.metrics.totalMinutes.toFixed(0) : '-'}</td>
                                                <td className="px-2 py-2 text-center text-emerald-600">{ts.metrics.connectedCalls || '-'}</td>
                                                <td className="px-2 py-2 text-center">{ts.metrics.talkedCalls || '-'}</td>
                                                <td className="px-2 py-2 text-center text-red-500">{ts.metrics.missedCalls || '-'}</td>
                                                <td className="px-2 py-2 text-center">{ts.metrics.answerRate != null ? `${ts.metrics.answerRate}%` : '-'}</td>
                                                <td className="px-2 py-2 text-center border-l-2 border-gray-200 bg-green-50/30">{ts.metrics.newCustOrders || '-'}</td>
                                                <td className="px-2 py-2 text-center bg-green-50/30 text-green-700">{ts.metrics.newCustSales > 0 ? `฿${formatNumber(Math.round(ts.metrics.newCustSales))}` : '-'}</td>
                                                <td className="px-2 py-2 text-center border-l-2 border-gray-200 bg-blue-50/30">{ts.metrics.coreCustOrders || '-'}</td>
                                                <td className="px-2 py-2 text-center bg-blue-50/30 text-blue-700">{ts.metrics.coreCustSales > 0 ? `฿${formatNumber(Math.round(ts.metrics.coreCustSales))}` : '-'}</td>
                                                <td className="px-2 py-2 text-center border-l-2 border-gray-200 bg-orange-50/30">{ts.metrics.revivalCustOrders || '-'}</td>
                                                <td className="px-2 py-2 text-center bg-orange-50/30 text-orange-700">{ts.metrics.revivalCustSales > 0 ? `฿${formatNumber(Math.round(ts.metrics.revivalCustSales))}` : '-'}</td>
                                                <td className="px-2 py-2 text-center border-l-2 border-gray-200 bg-purple-50/30">{ts.metrics.upsellOrders || '-'}</td>
                                                <td className="px-2 py-2 text-center bg-purple-50/30 text-purple-700">{ts.metrics.upsellSales > 0 ? `฿${formatNumber(Math.round(ts.metrics.upsellSales))}` : '-'}</td>
                                                <td className="px-2 py-2 text-center border-l-2 border-gray-200 font-bold">{totalOrders || '-'}</td>
                                                <td className="px-2 py-2 text-center font-medium text-green-600">{ts.metrics.combinedSales > 0 ? `฿${formatNumber(Math.round(ts.metrics.combinedSales))}` : '-'}</td>
                                                <td className={`px-2 py-2 text-center font-medium ${parseFloat(closeRate) >= 5 ? 'text-green-600' : parseFloat(closeRate) >= 2 ? 'text-yellow-600' : 'text-red-600'}`}>{parseFloat(closeRate) > 0 ? `${closeRate}%` : '-'}</td>
                                            </tr>
                                        );
                                    })}
                                    {(!oldDailyData || oldDailyData.telesaleDetails.length === 0) && (
                                        <tr>
                                            <td colSpan={19} className="px-4 py-8 text-center text-gray-500">
                                                ไม่มีข้อมูลสำหรับวันที่เลือก
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {dailyViewMode === 'new' && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-gray-50">
                    <h2 className="text-lg font-bold text-gray-800">📊 ตรวจสอบ KPI & ยอดขายรายวัน</h2>
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                        <select
                            value={selectedTeam}
                            onChange={(e) => { setSelectedTeam(e.target.value); setSelectedUsers([]); }}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="all">ทุกทีม</option>
                            {availableTeams.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                        <div className="relative">
                            <button
                                onClick={() => setShowUserDropdown(!showUserDropdown)}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 min-w-[160px] text-left flex justify-between items-center"
                            >
                                <span className="truncate max-w-[120px]">
                                    {selectedUsers.length === 0 
                                        ? "พนักงานทุกคน" 
                                        : `เลือกแล้ว ${selectedUsers.length} คน`}
                                </span>
                                <span className="text-gray-400 text-xs">▼</span>
                            </button>
                            {showUserDropdown && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowUserDropdown(false)}></div>
                                    <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                                        <div 
                                            className="px-3 py-2 border-b border-gray-100 hover:bg-gray-50 cursor-pointer text-sm"
                                            onClick={() => setSelectedUsers([])}
                                        >
                                            <label className="flex items-center gap-2 cursor-pointer w-full">
                                                <input 
                                                    type="checkbox" 
                                                    checked={selectedUsers.length === 0} 
                                                    readOnly 
                                                    className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                />
                                                <span>พนักงานทุกคน (All)</span>
                                            </label>
                                        </div>
                                        {filteredUserDropdown.map(u => (
                                            <div 
                                                key={u.id}
                                                className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                                                onClick={() => {
                                                    const idStr = u.id.toString();
                                                    if (selectedUsers.includes(idStr)) {
                                                        setSelectedUsers(prev => prev.filter(id => id !== idStr));
                                                    } else {
                                                        setSelectedUsers(prev => [...prev, idStr]);
                                                    }
                                                }}
                                            >
                                                <label className="flex items-center gap-2 cursor-pointer w-full">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedUsers.includes(u.id.toString())} 
                                                        readOnly 
                                                        className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                    />
                                                    <span className="truncate">{u.firstName} {u.lastName}</span>
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-64 bg-white">
                                <UniversalDateRangePicker
                                    value={{ start: startDate, end: endDate }}
                                    onChange={(val) => {
                                        setStartDate(val.start);
                                        setEndDate(val.end);
                                    }}
                                />
                            </div>
                            <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-lg px-2 py-2 h-[42px]">
                                <input
                                    type="time"
                                    value={startTime}
                                    onChange={(e) => setStartTime(e.target.value)}
                                    className="border-none bg-transparent text-sm focus:ring-0 p-0 text-gray-700 w-24 text-center"
                                />
                                <span className="text-gray-400">-</span>
                                <input
                                    type="time"
                                    value={endTime}
                                    onChange={(e) => setEndTime(e.target.value)}
                                    className="border-none bg-transparent text-sm focus:ring-0 p-0 text-gray-700 w-24 text-center"
                                />
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Column Toggles */}
                <div className="p-3 bg-white border-b border-gray-200 text-xs">
                    <div className="font-semibold text-gray-700 mb-2">ซ่อน/แสดง คอลัมน์ KPI:</div>
                    <div className="flex flex-wrap gap-2 mb-3">
                        <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={visibleCols.kpi_calls} onChange={e => setVisibleCols(p => ({...p, kpi_calls: e.target.checked}))} /> สายที่โทร</label>
                        <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={visibleCols.kpi_minutes} onChange={e => setVisibleCols(p => ({...p, kpi_minutes: e.target.checked}))} /> นาที</label>
                        <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={visibleCols.kpi_connected} onChange={e => setVisibleCols(p => ({...p, kpi_connected: e.target.checked}))} /> รับสาย</label>
                        <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={visibleCols.kpi_talked} onChange={e => setVisibleCols(p => ({...p, kpi_talked: e.target.checked}))} /> ได้คุย(≥30s)</label>
                        <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={visibleCols.kpi_missed} onChange={e => setVisibleCols(p => ({...p, kpi_missed: e.target.checked}))} /> ไม่ได้รับ</label>
                        <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={visibleCols.kpi_answerRate} onChange={e => setVisibleCols(p => ({...p, kpi_answerRate: e.target.checked}))} /> %รับสาย</label>
                        <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={visibleCols.kpi_workingHours} onChange={e => setVisibleCols(p => ({...p, kpi_workingHours: e.target.checked}))} /> เวลาทำงาน</label>
                        <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={visibleCols.kpi_newCust} onChange={e => setVisibleCols(p => ({...p, kpi_newCust: e.target.checked}))} /> ลูกค้าใหม่</label>
                        <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={visibleCols.kpi_coreCust} onChange={e => setVisibleCols(p => ({...p, kpi_coreCust: e.target.checked}))} /> ลูกค้าเก่า</label>
                        <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={visibleCols.kpi_revivalCust} onChange={e => setVisibleCols(p => ({...p, kpi_revivalCust: e.target.checked}))} /> ลูกค้าขุด</label>
                        <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={visibleCols.kpi_upsell} onChange={e => setVisibleCols(p => ({...p, kpi_upsell: e.target.checked}))} /> Upsell</label>
                        <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={visibleCols.kpi_totalOrders} onChange={e => setVisibleCols(p => ({...p, kpi_totalOrders: e.target.checked}))} /> รวมออเดอร์</label>
                        <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={visibleCols.kpi_totalSales} onChange={e => setVisibleCols(p => ({...p, kpi_totalSales: e.target.checked}))} /> ยอดขายรวม</label>
                        <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={visibleCols.kpi_closeRate} onChange={e => setVisibleCols(p => ({...p, kpi_closeRate: e.target.checked}))} /> %ปิด</label>
                    </div>
                    
                    <div className="font-semibold text-gray-700 mb-2">ซ่อน/แสดง คอลัมน์ ยอดขาย:</div>
                    <div className="flex flex-wrap gap-2">
                        <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={visibleCols.sales_gross} onChange={e => setVisibleCols(p => ({...p, sales_gross: e.target.checked}))} /> ยอดขายรวม (ก่อนหัก)</label>
                        <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={visibleCols.sales_cancelled} onChange={e => setVisibleCols(p => ({...p, sales_cancelled: e.target.checked}))} /> ยอดยกเลิก</label>
                        <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={visibleCols.sales_returned} onChange={e => setVisibleCols(p => ({...p, sales_returned: e.target.checked}))} /> ยอดตีกลับ</label>
                        <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={visibleCols.sales_net} onChange={e => setVisibleCols(p => ({...p, sales_net: e.target.checked}))} /> ยอดสุทธิ (Net)</label>
                        <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={visibleCols.sales_bio} onChange={e => setVisibleCols(p => ({...p, sales_bio: e.target.checked}))} /> ยอดชีวภัณฑ์</label>
                        <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={visibleCols.sales_fertilizer} onChange={e => setVisibleCols(p => ({...p, sales_fertilizer: e.target.checked}))} /> ยอดปุ๋ย</label>
                        <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={visibleCols.sales_other} onChange={e => setVisibleCols(p => ({...p, sales_other: e.target.checked}))} /> ยอดอื่นๆ</label>
                    </div>
                </div>

                <div className="p-4 bg-gray-50 border-b border-gray-200 text-sm font-semibold text-gray-700 flex justify-between">
                    <span>1. สถิติการโทรรายวัน (Daily KPI)</span>
                    <span className="text-gray-500 font-normal">ข้อมูลแบ่งตามวันที่และบุคคล</span>
                </div>
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    {dailyLoading ? (
                        <div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div></div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 z-10 shadow-sm">
                                <tr className="bg-gray-100 text-gray-700">
                                    <th className="px-2 py-2 text-left font-medium sticky left-0 bg-gray-100 border-r border-gray-200">วันที่</th>
                                    <th className="px-2 py-2 text-left font-medium sticky left-[80px] bg-gray-100 border-r border-gray-200">ชื่อ</th>
                                    {visibleCols.kpi_calls && <th className="px-2 py-2 text-center font-medium">สายที่โทร</th>}
                                    {visibleCols.kpi_minutes && <th className="px-2 py-2 text-center font-medium">นาทีที่โทร</th>}
                                    {visibleCols.kpi_connected && <th className="px-2 py-2 text-center font-medium">รับสาย</th>}
                                    {visibleCols.kpi_talked && <th className="px-2 py-2 text-center font-medium">ได้คุย(≥30s)</th>}
                                    {visibleCols.kpi_missed && <th className="px-2 py-2 text-center font-medium">ไม่ได้รับ</th>}
                                    {visibleCols.kpi_answerRate && <th className="px-2 py-2 text-center font-medium">%รับ</th>}
                                    {visibleCols.kpi_workingHours && <th className="px-2 py-2 text-center font-medium">เวลาทำงาน</th>}
                                    
                                    {visibleCols.kpi_newCust && <th className="px-2 py-2 text-center font-medium bg-green-50 border-l border-gray-200">ออเดอร์<br/>(ลค.ใหม่)</th>}
                                    {visibleCols.kpi_coreCust && <th className="px-2 py-2 text-center font-medium bg-blue-50 border-l border-gray-200">ออเดอร์<br/>(ลค.เก่า)</th>}
                                    {visibleCols.kpi_revivalCust && <th className="px-2 py-2 text-center font-medium bg-orange-50 border-l border-gray-200">ออเดอร์<br/>(ลค.ขุด)</th>}
                                    {visibleCols.kpi_upsell && <th className="px-2 py-2 text-center font-medium bg-purple-50 border-l border-gray-200">ออเดอร์<br/>(Upsell)</th>}
                                    
                                    {visibleCols.kpi_totalOrders && <th className="px-2 py-2 text-center font-medium border-l border-gray-300">รวมออเดอร์</th>}
                                    {visibleCols.kpi_totalSales && <th className="px-2 py-2 text-center font-medium">ยอดขายรวม</th>}
                                    {visibleCols.kpi_closeRate && <th className="px-2 py-2 text-center font-medium">% ปิด</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredDailyRecords.map((ts, idx) => {
                                    const totalOrders = ts.metrics.newCustOrders + ts.metrics.coreCustOrders + ts.metrics.revivalCustOrders + ts.metrics.upsellOrders;
                                    const combinedSales = ts.metrics.grossSales - ts.metrics.cancelledSales - ts.metrics.returnedSales;
                                    const closeRate = ts.metrics.totalCalls > 0 ? ((totalOrders / ts.metrics.totalCalls) * 100).toFixed(1) : '0.0';
                                    return (
                                        <tr key={`${ts.userId}-${ts.date}`} className="hover:bg-gray-50 bg-white">
                                            <td className="px-2 py-2 text-gray-700 whitespace-nowrap sticky left-0 bg-white border-r border-gray-100">{ts.date}</td>
                                            <td className="px-2 py-2 font-medium text-gray-800 whitespace-nowrap sticky left-[80px] bg-white border-r border-gray-100">{ts.name}</td>
                                            {visibleCols.kpi_calls && <td className="px-2 py-2 text-center">{ts.metrics.totalCalls || '-'}</td>}
                                            {visibleCols.kpi_minutes && <td className="px-2 py-2 text-center">{ts.metrics.totalMinutes > 0 ? ts.metrics.totalMinutes.toFixed(0) : '-'}</td>}
                                            {visibleCols.kpi_connected && <td className="px-2 py-2 text-center text-emerald-600">{ts.metrics.connectedCalls || '-'}</td>}
                                            {visibleCols.kpi_talked && <td className="px-2 py-2 text-center">{ts.metrics.talkedCalls || '-'}</td>}
                                            {visibleCols.kpi_missed && <td className="px-2 py-2 text-center text-red-500">{ts.metrics.missedCalls || '-'}</td>}
                                            {visibleCols.kpi_answerRate && <td className="px-2 py-2 text-center">{ts.metrics.answerRate != null ? `${ts.metrics.answerRate.toFixed(1)}%` : '-'}</td>}
                                            {visibleCols.kpi_workingHours && <td className="px-2 py-2 text-center text-blue-600 font-medium">{ts.metrics.workingHours > 0 ? `${ts.metrics.workingHours.toFixed(1)} ชม.` : '-'}</td>}
                                            
                                            {visibleCols.kpi_newCust && <td className="px-2 py-2 text-center bg-green-50/20 border-l border-gray-100">{ts.metrics.newCustOrders || '-'}</td>}
                                            {visibleCols.kpi_coreCust && <td className="px-2 py-2 text-center bg-blue-50/20 border-l border-gray-100">{ts.metrics.coreCustOrders || '-'}</td>}
                                            {visibleCols.kpi_revivalCust && <td className="px-2 py-2 text-center bg-orange-50/20 border-l border-gray-100">{ts.metrics.revivalCustOrders || '-'}</td>}
                                            {visibleCols.kpi_upsell && <td className="px-2 py-2 text-center bg-purple-50/20 border-l border-gray-100">{ts.metrics.upsellOrders || '-'}</td>}
                                            
                                            {visibleCols.kpi_totalOrders && <td className="px-2 py-2 text-center border-l border-gray-200 font-bold">{totalOrders || '-'}</td>}
                                            {visibleCols.kpi_totalSales && <td className="px-2 py-2 text-center font-medium text-green-600">{combinedSales > 0 ? formatNumber(combinedSales) : '-'}</td>}
                                            {visibleCols.kpi_closeRate && <td className={`px-2 py-2 text-center font-medium ${parseFloat(closeRate) >= 5 ? 'text-green-600' : parseFloat(closeRate) >= 2 ? 'text-yellow-600' : 'text-red-600'}`}>{parseFloat(closeRate) > 0 ? `${closeRate}%` : '-'}</td>}
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <thead className="bg-gray-100 text-gray-700 shadow-sm border-t-2 border-gray-300">
                                <tr>
                                    <th className="px-2 py-2 text-left font-medium sticky left-0 bg-gray-100 border-r border-gray-200">สรุปรวม</th>
                                    <th className="px-2 py-2 text-left font-medium sticky left-[80px] bg-gray-100 border-r border-gray-200">ตามพนักงาน</th>
                                    {visibleCols.kpi_calls && <th className="px-2 py-2 text-center"></th>}
                                    {visibleCols.kpi_minutes && <th className="px-2 py-2 text-center"></th>}
                                    {visibleCols.kpi_connected && <th className="px-2 py-2 text-center"></th>}
                                    {visibleCols.kpi_talked && <th className="px-2 py-2 text-center"></th>}
                                    {visibleCols.kpi_missed && <th className="px-2 py-2 text-center"></th>}
                                    {visibleCols.kpi_answerRate && <th className="px-2 py-2 text-center"></th>}
                                    {visibleCols.kpi_workingHours && <th className="px-2 py-2 text-center"></th>}
                                    {visibleCols.kpi_newCust && <th className="px-2 py-2 text-center"></th>}
                                    {visibleCols.kpi_coreCust && <th className="px-2 py-2 text-center"></th>}
                                    {visibleCols.kpi_revivalCust && <th className="px-2 py-2 text-center"></th>}
                                    {visibleCols.kpi_upsell && <th className="px-2 py-2 text-center"></th>}
                                    {visibleCols.kpi_totalOrders && <th className="px-2 py-2 text-center"></th>}
                                    {visibleCols.kpi_totalSales && <th className="px-2 py-2 text-center"></th>}
                                    {visibleCols.kpi_closeRate && <th className="px-2 py-2 text-center"></th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-blue-50/30">
                                {summaryDailyRecords.map((ts, idx) => {
                                    const totalOrders = ts.metrics.newCustOrders + ts.metrics.coreCustOrders + ts.metrics.revivalCustOrders + ts.metrics.upsellOrders;
                                    const combinedSales = ts.metrics.grossSales - ts.metrics.cancelledSales - ts.metrics.returnedSales;
                                    const closeRate = ts.metrics.totalCalls > 0 ? ((totalOrders / ts.metrics.totalCalls) * 100).toFixed(1) : '0.0';
                                    return (
                                        <tr key={`sum-${ts.userId}`} className="font-semibold text-gray-800">
                                            <td className="px-2 py-2 sticky left-0 bg-blue-50 border-r border-blue-100">{ts.date}</td>
                                            <td className="px-2 py-2 sticky left-[80px] bg-blue-50 border-r border-blue-100">{ts.name}</td>
                                            {visibleCols.kpi_calls && <td className="px-2 py-2 text-center">{ts.metrics.totalCalls || '-'}</td>}
                                            {visibleCols.kpi_minutes && <td className="px-2 py-2 text-center">{ts.metrics.totalMinutes > 0 ? ts.metrics.totalMinutes.toFixed(0) : '-'}</td>}
                                            {visibleCols.kpi_connected && <td className="px-2 py-2 text-center text-emerald-600">{ts.metrics.connectedCalls || '-'}</td>}
                                            {visibleCols.kpi_talked && <td className="px-2 py-2 text-center">{ts.metrics.talkedCalls || '-'}</td>}
                                            {visibleCols.kpi_missed && <td className="px-2 py-2 text-center text-red-500">{ts.metrics.missedCalls || '-'}</td>}
                                            {visibleCols.kpi_answerRate && <td className="px-2 py-2 text-center">{ts.metrics.answerRate != null ? `${ts.metrics.answerRate.toFixed(1)}%` : '-'}</td>}
                                            {visibleCols.kpi_workingHours && <td className="px-2 py-2 text-center text-blue-700 font-bold">{ts.metrics.workingHours > 0 ? `${ts.metrics.workingHours.toFixed(1)} ชม.` : '-'}</td>}
                                            {visibleCols.kpi_newCust && <td className="px-2 py-2 text-center border-l border-gray-100">{ts.metrics.newCustOrders || '-'}</td>}
                                            {visibleCols.kpi_coreCust && <td className="px-2 py-2 text-center border-l border-gray-100">{ts.metrics.coreCustOrders || '-'}</td>}
                                            {visibleCols.kpi_revivalCust && <td className="px-2 py-2 text-center border-l border-gray-100">{ts.metrics.revivalCustOrders || '-'}</td>}
                                            {visibleCols.kpi_upsell && <td className="px-2 py-2 text-center border-l border-gray-100">{ts.metrics.upsellOrders || '-'}</td>}
                                            {visibleCols.kpi_totalOrders && <td className="px-2 py-2 text-center border-l border-gray-200 text-blue-700">{totalOrders || '-'}</td>}
                                            {visibleCols.kpi_totalSales && <td className="px-2 py-2 text-center text-green-700">{combinedSales > 0 ? formatNumber(combinedSales) : '-'}</td>}
                                            {visibleCols.kpi_closeRate && <td className={`px-2 py-2 text-center ${parseFloat(closeRate) >= 5 ? 'text-green-700' : 'text-blue-700'}`}>{parseFloat(closeRate) > 0 ? `${closeRate}%` : '-'}</td>}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Sales Section */}
                <div className="p-4 bg-gray-50 border-y border-gray-200 text-sm font-semibold text-gray-700 flex justify-between mt-4">
                    <span>2. ยอดขายรายวัน (Daily Sales)</span>
                    <span className="text-gray-500 font-normal">ข้อมูลยอดขายและการหักยกเลิก/ตีกลับ</span>
                </div>
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto pb-4">
                    {dailyLoading ? (
                        <div className="flex items-center justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div></div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 z-10 shadow-sm">
                                <tr className="bg-gray-100 text-gray-700">
                                    <th className="px-2 py-2 text-left font-medium sticky left-0 bg-gray-100 border-r border-gray-200">วันที่</th>
                                    <th className="px-2 py-2 text-left font-medium sticky left-[80px] bg-gray-100 border-r border-gray-200">ชื่อ</th>
                                    {visibleCols.sales_gross && <th className="px-2 py-2 text-right font-medium">ยอดขายรวม (ตั้งต้น)</th>}
                                    {visibleCols.sales_cancelled && <th className="px-2 py-2 text-right font-medium text-red-600">ยอดยกเลิก</th>}
                                    {visibleCols.sales_returned && <th className="px-2 py-2 text-right font-medium text-orange-600">ยอดตีกลับ</th>}
                                    {visibleCols.sales_net && <th className="px-2 py-2 text-right font-bold text-green-700 border-l-2 border-gray-300">ยอดสุทธิ (Net)</th>}
                                    {visibleCols.sales_bio && <th className="px-2 py-2 text-right font-medium border-l border-gray-200">ยอดชีวภัณฑ์</th>}
                                    {visibleCols.sales_fertilizer && <th className="px-2 py-2 text-right font-medium">ยอดปุ๋ย</th>}
                                    {visibleCols.sales_other && <th className="px-2 py-2 text-right font-medium">ยอดอื่นๆ</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredDailyRecords.map((ts, idx) => {
                                    const netSales = ts.metrics.grossSales - ts.metrics.cancelledSales - ts.metrics.returnedSales;
                                    return (
                                        <tr key={`sales-${ts.userId}-${ts.date}`} className="hover:bg-gray-50 bg-white">
                                            <td className="px-2 py-2 text-gray-700 whitespace-nowrap sticky left-0 bg-white border-r border-gray-100">{ts.date}</td>
                                            <td className="px-2 py-2 font-medium text-gray-800 whitespace-nowrap sticky left-[80px] bg-white border-r border-gray-100">{ts.name}</td>
                                            {visibleCols.sales_gross && <td className="px-2 py-2 text-right">{ts.metrics.grossSales > 0 ? formatNumber(ts.metrics.grossSales) : '-'}</td>}
                                            {visibleCols.sales_cancelled && <td className="px-2 py-2 text-right text-red-500">{ts.metrics.cancelledSales > 0 ? `-${formatNumber(ts.metrics.cancelledSales)}` : '-'}</td>}
                                            {visibleCols.sales_returned && <td className="px-2 py-2 text-right text-orange-500">{ts.metrics.returnedSales > 0 ? `-${formatNumber(ts.metrics.returnedSales)}` : '-'}</td>}
                                            {visibleCols.sales_net && <td className="px-2 py-2 text-right font-bold text-green-600 border-l-2 border-gray-100">{formatNumber(netSales)}</td>}
                                            {visibleCols.sales_bio && <td className="px-2 py-2 text-right text-gray-700 border-l border-gray-100">{ts.metrics.bioSales > 0 ? formatNumber(ts.metrics.bioSales) : '-'}</td>}
                                            {visibleCols.sales_fertilizer && <td className="px-2 py-2 text-right text-gray-700">{ts.metrics.fertilizerSales > 0 ? formatNumber(ts.metrics.fertilizerSales) : '-'}</td>}
                                            {visibleCols.sales_other && <td className="px-2 py-2 text-right text-gray-700">{ts.metrics.otherSales > 0 ? formatNumber(ts.metrics.otherSales) : '-'}</td>}
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <thead className="bg-gray-100 text-gray-700 shadow-sm border-t-2 border-gray-300">
                                <tr>
                                    <th className="px-2 py-2 text-left font-medium sticky left-0 bg-gray-100 border-r border-gray-200">สรุปรวม</th>
                                    <th className="px-2 py-2 text-left font-medium sticky left-[80px] bg-gray-100 border-r border-gray-200">ตามพนักงาน</th>
                                    {visibleCols.sales_gross && <th className="px-2 py-2 text-right"></th>}
                                    {visibleCols.sales_cancelled && <th className="px-2 py-2 text-right"></th>}
                                    {visibleCols.sales_returned && <th className="px-2 py-2 text-right"></th>}
                                    {visibleCols.sales_net && <th className="px-2 py-2 text-right border-l-2 border-gray-300"></th>}
                                    {visibleCols.sales_bio && <th className="px-2 py-2 text-right border-l border-gray-200"></th>}
                                    {visibleCols.sales_fertilizer && <th className="px-2 py-2 text-right"></th>}
                                    {visibleCols.sales_other && <th className="px-2 py-2 text-right"></th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-green-50/30">
                                {summaryDailyRecords.map((ts, idx) => {
                                    const netSales = ts.metrics.grossSales - ts.metrics.cancelledSales - ts.metrics.returnedSales;
                                    return (
                                        <tr key={`sums-${ts.userId}`} className="font-semibold text-gray-800">
                                            <td className="px-2 py-2 sticky left-0 bg-green-50 border-r border-green-100">{ts.date}</td>
                                            <td className="px-2 py-2 sticky left-[80px] bg-green-50 border-r border-green-100">{ts.name}</td>
                                            {visibleCols.sales_gross && <td className="px-2 py-2 text-right">{formatNumber(ts.metrics.grossSales)}</td>}
                                            {visibleCols.sales_cancelled && <td className="px-2 py-2 text-right text-red-600">{ts.metrics.cancelledSales > 0 ? `-${formatNumber(ts.metrics.cancelledSales)}` : '-'}</td>}
                                            {visibleCols.sales_returned && <td className="px-2 py-2 text-right text-orange-600">{ts.metrics.returnedSales > 0 ? `-${formatNumber(ts.metrics.returnedSales)}` : '-'}</td>}
                                            {visibleCols.sales_net && <td className="px-2 py-2 text-right text-green-700 border-l-2 border-gray-200 font-bold">{formatNumber(netSales)}</td>}
                                            {visibleCols.sales_bio && <td className="px-2 py-2 text-right text-gray-800 border-l border-gray-200">{ts.metrics.bioSales > 0 ? formatNumber(ts.metrics.bioSales) : '-'}</td>}
                                            {visibleCols.sales_fertilizer && <td className="px-2 py-2 text-right text-gray-800">{ts.metrics.fertilizerSales > 0 ? formatNumber(ts.metrics.fertilizerSales) : '-'}</td>}
                                            {visibleCols.sales_other && <td className="px-2 py-2 text-right text-gray-800">{ts.metrics.otherSales > 0 ? formatNumber(ts.metrics.otherSales) : '-'}</td>}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
            )}

            {/* Target Modal */}
            {showTargetModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowTargetModal(false)}>
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4 text-white">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-bold">🎯 ตั้งเป้ายอดขาย</h2>
                                <button onClick={() => setShowTargetModal(false)} className="text-white/80 hover:text-white">
                                    ✕
                                </button>
                            </div>
                            {/* Month/Year Selector */}
                            <div className="flex items-center gap-3 mt-3">
                                <select
                                    value={targetMonth}
                                    onChange={(e) => handleTargetMonthChange(parseInt(e.target.value), targetYear)}
                                    className="px-3 py-1.5 rounded-lg bg-white/20 text-white border border-white/30"
                                >
                                    {THAI_MONTHS.slice(1).map((name, idx) => (
                                        <option key={idx + 1} value={idx + 1} className="text-gray-800">{name}</option>
                                    ))}
                                </select>
                                <select
                                    value={targetYear}
                                    onChange={(e) => handleTargetMonthChange(targetMonth, parseInt(e.target.value))}
                                    className="px-3 py-1.5 rounded-lg bg-white/20 text-white border border-white/30"
                                >
                                    {yearOptions.map(y => (
                                        <option key={y} value={y} className="text-gray-800">{y}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="px-6 py-4 overflow-y-auto max-h-[50vh]">
                            {targetLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {targetTelesales.map((ts) => (
                                        <div key={ts.user_id} className="flex items-center gap-3 py-2 border-b border-gray-100">
                                            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold text-sm">
                                                {ts.first_name?.charAt(0).toUpperCase() || 'U'}
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-medium text-gray-800 text-sm">{ts.first_name} {ts.last_name}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    value={ts.target_amount}
                                                    onChange={(e) => {
                                                        const val = parseFloat(e.target.value) || 0;
                                                        setTargetTelesales(prev => prev.map(t =>
                                                            t.user_id === ts.user_id ? { ...t, target_amount: val } : t
                                                        ));
                                                    }}
                                                    onBlur={() => saveTarget(ts.user_id, ts.target_amount)}
                                                    className="w-28 px-2 py-1 border border-gray-300 rounded text-right text-sm"
                                                    placeholder="0"
                                                />
                                                {savingTarget === ts.user_id && (
                                                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-green-500"></div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                            <button
                                onClick={() => setShowTargetModal(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={saveAllTargets}
                                disabled={savingTarget !== null}
                                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 text-sm font-medium"
                            >
                                {savingTarget === -1 ? 'กำลังบันทึก...' : 'บันทึกทั้งหมด'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
