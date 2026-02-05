import { useState, useEffect, useMemo } from 'react';
import resolveApiBasePath from '@/utils/apiBasePath';

// ==========================================
// Interfaces
// ==========================================
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

    // Target
    targetAmount: number;
    targetProgress: number;

    // Call metrics
    totalCalls: number;
    answeredCalls: number;
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
    answeredCalls: number;
    totalMinutes: number;
    newCustCount: number;
    coreCustCount: number;
    revivalCustCount: number;
    newCustOrders: number;
    coreCustOrders: number;
    revivalCustOrders: number;
    conversionRate: number;
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
export default function TelesalePerformancePage() {
    const currentDate = new Date();
    const [year, setYear] = useState(currentDate.getFullYear());
    const [month, setMonth] = useState(currentDate.getMonth() + 1);
    const [data, setData] = useState<PerformanceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sortField, setSortField] = useState<keyof Metrics>('combinedSales');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    // Daily KPI State (separate from monthly view)
    const [dailyDate, setDailyDate] = useState(() => {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    });
    const [dailyData, setDailyData] = useState<PerformanceData | null>(null);
    const [dailyLoading, setDailyLoading] = useState(false);

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

    // Fetch Daily KPI Data (separate from monthly)
    useEffect(() => {
        const fetchDailyData = async () => {
            setDailyLoading(true);
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
                        setDailyData(result.data);
                    }
                }
            } catch (err) {
                console.error('Error fetching daily data:', err);
            } finally {
                setDailyLoading(false);
            }
        };

        // Debounce daily fetch
        const debounceTimer = setTimeout(() => {
            fetchDailyData();
        }, 500);

        return () => clearTimeout(debounceTimer);
    }, [dailyDate, year, month]);

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
                            ปกติ ฿{formatNumber(data?.teamTotals.totalSales || 0)} + Upsell ฿{formatNumber(data?.teamTotals.upsellSales || 0)}
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
                                <th className="px-2 py-2 text-center text-gray-600 font-medium whitespace-nowrap bg-gray-100 border-l-2 border-gray-300" colSpan={3}>
                                    ลูกค้าใหม่
                                </th>
                                {/* ลูกค้าเก่า */}
                                <th className="px-2 py-2 text-center text-gray-600 font-medium whitespace-nowrap bg-gray-100 border-l-2 border-gray-300" colSpan={3}>
                                    ลูกค้าเก่า
                                </th>
                                {/* ลูกค้าขุด */}
                                <th className="px-2 py-2 text-center text-gray-600 font-medium whitespace-nowrap bg-gray-100 border-l-2 border-gray-300" colSpan={3}>
                                    ลูกค้าขุด
                                </th>
                                {/* Upsell */}
                                <th className="px-2 py-2 text-center text-blue-600 font-medium whitespace-nowrap bg-blue-50 border-l-2 border-gray-300" colSpan={2}>
                                    Upsell
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
                                <SortableHeader label="ได้คุย" field="answeredCalls" currentField={sortField} direction={sortDirection} onClick={handleSort} tooltip="สายที่คุยได้ ≥40 วินาที" />
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
                                <th className="px-1 py-1 text-center text-gray-500 bg-gray-100">%</th>
                                {/* ลูกค้าเก่า sub-headers */}
                                <th className="px-1 py-1 text-center text-gray-500 bg-gray-100 border-l-2 border-gray-300">จำนวน</th>
                                <th className="px-1 py-1 text-center text-gray-500 bg-gray-100">ออเดอร์</th>
                                <th className="px-1 py-1 text-center text-gray-500 bg-gray-100">%</th>
                                {/* ลูกค้าขุด sub-headers */}
                                <th className="px-1 py-1 text-center text-gray-500 bg-gray-100 border-l-2 border-gray-300">จำนวน</th>
                                <th className="px-1 py-1 text-center text-gray-500 bg-gray-100">ออเดอร์</th>
                                <th className="px-1 py-1 text-center text-gray-500 bg-gray-100">%</th>
                                {/* Upsell sub-headers */}
                                <th className="px-1 py-1 text-center text-blue-600 bg-blue-50 border-l-2 border-gray-300">ออเดอร์</th>
                                <th className="px-1 py-1 text-center text-blue-600 bg-blue-50">บาท</th>
                                {/* ยอดรวม */}
                                <th className="border-l-2 border-gray-300"></th>
                                {/* เป้า */}
                                <th className="border-l-2 border-gray-300"></th>
                                {/* สาย */}
                                <th className="border-l-2 border-gray-300"></th>
                                {/* Remaining columns */}
                                <th></th><th></th><th></th><th></th><th></th>
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
                                    <td className="px-2 py-2 text-center">
                                        <span className={`text-xs ${ts.metrics.newCustRate > 0 ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                                            {ts.metrics.newCustRate}%
                                        </span>
                                    </td>
                                    {/* ลูกค้าเก่า */}
                                    <td className="px-2 py-2 text-center border-l-2 border-gray-200">{formatNumber(ts.metrics.coreCustCount)}</td>
                                    <td className="px-2 py-2 text-center">{formatNumber(ts.metrics.coreCustOrders)}</td>
                                    <td className="px-2 py-2 text-center">
                                        <span className={`text-xs ${ts.metrics.coreCustRate > 0 ? 'text-blue-600 font-medium' : 'text-gray-400'}`}>
                                            {ts.metrics.coreCustRate}%
                                        </span>
                                    </td>
                                    {/* ลูกค้าขุด */}
                                    <td className="px-2 py-2 text-center border-l-2 border-gray-200">{formatNumber(ts.metrics.revivalCustCount)}</td>
                                    <td className="px-2 py-2 text-center">{formatNumber(ts.metrics.revivalCustOrders)}</td>
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
                                    <td className="px-2 py-2 text-center">{formatNumber(ts.metrics.answeredCalls)}</td>
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
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <h2 className="text-lg font-bold text-gray-800">ตรวจสอบ KPI รายวัน</h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                const d = new Date(dailyDate);
                                d.setDate(d.getDate() - 1);
                                setDailyDate(d.toISOString().split('T')[0]);
                            }}
                            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition-colors"
                            title="วันก่อนหน้า"
                        >
                            ←
                        </button>
                        <input
                            type="date"
                            value={dailyDate}
                            onChange={(e) => setDailyDate(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                        <button
                            onClick={() => {
                                const d = new Date(dailyDate);
                                d.setDate(d.getDate() + 1);
                                setDailyDate(d.toISOString().split('T')[0]);
                            }}
                            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition-colors"
                            title="วันถัดไป"
                        >
                            →
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    {dailyLoading ? (
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
                                    <th className="px-2 py-2 text-center font-medium whitespace-nowrap cursor-help" rowSpan={2} title="นับเฉพาะสายที่คุยได้ตั้งแต่ 40 วินาทีขึ้นไป">ได้คุย<br /><span className="text-xs text-gray-500 font-normal">(≥40 วินาที)</span></th>
                                    {/* ลูกค้าใหม่ Group */}
                                    <th className="px-2 py-2 text-center font-medium border-l-2 border-gray-300 bg-green-100" colSpan={2}>ลูกค้าใหม่</th>
                                    {/* ลูกค้าเก่า Group */}
                                    <th className="px-2 py-2 text-center font-medium border-l-2 border-gray-300 bg-blue-100" colSpan={2}>ลูกค้าเก่า</th>
                                    {/* ลูกค้าขุด Group */}
                                    <th className="px-2 py-2 text-center font-medium border-l-2 border-gray-300 bg-orange-100" colSpan={2}>ลูกค้าขุด</th>
                                    {/* Upsell Group */}
                                    <th className="px-2 py-2 text-center font-medium border-l-2 border-gray-300 bg-purple-100" colSpan={2}>Upsell</th>
                                    {/* รวม */}
                                    <th className="px-2 py-2 text-center font-medium border-l-2 border-gray-300" rowSpan={2}>รวม<br /><span className="text-xs text-gray-500 font-normal">ออเดอร์</span></th>
                                    <th className="px-2 py-2 text-center font-medium" rowSpan={2}>ยอดขาย<br /><span className="text-xs text-gray-500 font-normal">รวม</span></th>
                                    <th className="px-2 py-2 text-center font-medium whitespace-nowrap" rowSpan={2}>% ปิด</th>
                                </tr>
                                <tr className="bg-gray-50 text-gray-600 text-xs">
                                    {/* ลูกค้าใหม่ sub */}
                                    <th className="px-1 py-1 text-center border-l-2 border-gray-300 bg-green-50">ออเดอร์</th>
                                    <th className="px-1 py-1 text-center bg-green-50">ยอดขาย</th>
                                    {/* ลูกค้าเก่า sub */}
                                    <th className="px-1 py-1 text-center border-l-2 border-gray-300 bg-blue-50">ออเดอร์</th>
                                    <th className="px-1 py-1 text-center bg-blue-50">ยอดขาย</th>
                                    {/* ลูกค้าขุด sub */}
                                    <th className="px-1 py-1 text-center border-l-2 border-gray-300 bg-orange-50">ออเดอร์</th>
                                    <th className="px-1 py-1 text-center bg-orange-50">ยอดขาย</th>
                                    {/* Upsell sub */}
                                    <th className="px-1 py-1 text-center border-l-2 border-gray-300 bg-purple-50">ออเดอร์</th>
                                    <th className="px-1 py-1 text-center bg-purple-50">ยอดขาย</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {dailyData?.telesaleDetails.map((ts, idx) => {
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
                                            <td className="px-2 py-2 text-center">{ts.metrics.answeredCalls || '-'}</td>
                                            {/* ลูกค้าใหม่ */}
                                            <td className="px-2 py-2 text-center border-l-2 border-gray-200 bg-green-50/30">{ts.metrics.newCustOrders || '-'}</td>
                                            <td className="px-2 py-2 text-center bg-green-50/30 text-green-700">{ts.metrics.newCustSales > 0 ? `${formatMoney(ts.metrics.newCustSales)}` : '-'}</td>
                                            {/* ลูกค้าเก่า */}
                                            <td className="px-2 py-2 text-center border-l-2 border-gray-200 bg-blue-50/30">{ts.metrics.coreCustOrders || '-'}</td>
                                            <td className="px-2 py-2 text-center bg-blue-50/30 text-blue-700">{ts.metrics.coreCustSales > 0 ? `${formatMoney(ts.metrics.coreCustSales)}` : '-'}</td>
                                            {/* ลูกค้าขุด */}
                                            <td className="px-2 py-2 text-center border-l-2 border-gray-200 bg-orange-50/30">{ts.metrics.revivalCustOrders || '-'}</td>
                                            <td className="px-2 py-2 text-center bg-orange-50/30 text-orange-700">{ts.metrics.revivalCustSales > 0 ? `${formatMoney(ts.metrics.revivalCustSales)}` : '-'}</td>
                                            {/* Upsell */}
                                            <td className="px-2 py-2 text-center border-l-2 border-gray-200 bg-purple-50/30">{ts.metrics.upsellOrders || '-'}</td>
                                            <td className="px-2 py-2 text-center bg-purple-50/30 text-purple-700">{ts.metrics.upsellSales > 0 ? `${formatMoney(ts.metrics.upsellSales)}` : '-'}</td>
                                            {/* รวม */}
                                            <td className="px-2 py-2 text-center border-l-2 border-gray-200 font-bold">{totalOrders || '-'}</td>
                                            <td className="px-2 py-2 text-center font-medium text-green-600">{ts.metrics.combinedSales > 0 ? `${formatMoney(ts.metrics.combinedSales)}` : '-'}</td>
                                            <td className={`px-2 py-2 text-center font-medium ${parseFloat(closeRate) >= 5 ? 'text-green-600' :
                                                parseFloat(closeRate) >= 2 ? 'text-yellow-600' :
                                                    'text-red-600'
                                                }`}>{parseFloat(closeRate) > 0 ? `${closeRate}%` : '-'}</td>
                                        </tr>
                                    );
                                })}
                                {(!dailyData || dailyData.telesaleDetails.length === 0) && (
                                    <tr>
                                        <td colSpan={12} className="px-4 py-8 text-center text-gray-500">
                                            ไม่มีข้อมูลสำหรับวันที่เลือก
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

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
