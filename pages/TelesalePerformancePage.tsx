import { useState, useEffect, useMemo } from 'react';
import resolveApiBasePath from '@/utils/apiBasePath';

// ==========================================
// Interfaces
// ==========================================
interface Metrics {
    totalCalls: number;
    totalOrders: number;
    totalSales: number;
    conversionRate: number;
    totalMinutes: number;
    ahtMinutes: number;
    totalCustomers: number;
    repeatCustomers: number;
    retentionRate: number;
    // NEW METRICS
    aov: number;                // ยอดเฉลี่ยต่อออเดอร์
    newCustomers: number;       // ลูกค้าใหม่
    newCustomerRate: number;    // อัตราลูกค้าใหม่ %
    winbackCustomers: number;   // ลูกค้าเก่าที่กลับมา
    efficiencyScore: number;
    combinedSales: number;      // ยอดขายรวม upsell
    // Upsell: Items added by this telesale to other users' orders
    upsellOrders?: number;
    upsellSales?: number;
    upsellQuantity?: number;
    // Target: Monthly sales target
    targetAmount?: number;
    targetProgress?: number;
}


interface TierMetrics {
    core: { total: number; active: number; loyal: number; activeRate: number; loyaltyRate: number; };
    revival: { total: number; revived: number; };
    new: { total: number; converted: number; conversionRate: number; };
}

interface TierAggregates {
    core: { total: number; active: number; loyal: number; activeRate: number; loyaltyRate: number; };
    revival: { total: number; revived: number; };
    new: { total: number; converted: number; conversionRate: number; };
}

interface TelesaleDetail {
    userId: number;
    name: string;
    firstName: string;
    phone: string;
    metrics: Metrics;
    tierMetrics: TierMetrics;
}

interface RankingItem {
    userId: number;
    name: string;
    value: number;
    [key: string]: unknown;
}

interface TeamAverages {
    conversionRate: number;
    retentionRate: number;
    aov: number;              // ยอดเฉลี่ยต่อออเดอร์
    newCustomerRate: number;  // อัตราลูกค้าใหม่
    ahtMinutes: number;
    efficiencyScore: number;
    totalCalls: number;
    totalOrders: number;
    totalSales: number;
    newCustomers: number;
    winbackCustomers: number;
}

interface PerformanceData {
    period: { year: number; month: number };
    teamAverages: TeamAverages;
    tierAggregates: TierAggregates;
    telesaleCount: number;
    previousMonthSales?: number;
    rankings: {
        byConversion: RankingItem[];
        byRetention: RankingItem[];
        byAov: RankingItem[];  // เปลี่ยนจาก byActive
        byEfficiency: RankingItem[];
        byAht: RankingItem[];
        byRevival: RankingItem[];
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

const THAI_MONTHS = [
    '', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

// ==========================================
// Component
// ==========================================
export default function TelesalePerformancePage() {
    const currentDate = new Date();
    const [year, setYear] = useState(currentDate.getFullYear());
    const [month, setMonth] = useState(currentDate.getMonth() + 1);
    const [data, setData] = useState<PerformanceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sortField, setSortField] = useState<keyof Metrics>('conversionRate');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [tierFilter, setTierFilter] = useState<'all' | 'core' | 'new' | 'revival'>('all');

    // Target Modal State
    const [showTargetModal, setShowTargetModal] = useState(false);
    const [targetMonth, setTargetMonth] = useState(currentDate.getMonth() + 1);
    const [targetYear, setTargetYear] = useState(currentDate.getFullYear());
    const [targetTelesales, setTargetTelesales] = useState<{ user_id: number; first_name: string; last_name: string; target_amount: number }[]>([]);
    const [targetLoading, setTargetLoading] = useState(false);
    const [savingTarget, setSavingTarget] = useState<number | null>(null);


    // Fetch data
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const token = localStorage.getItem('authToken');
                const API_BASE = resolveApiBasePath();

                const response = await fetch(
                    `${API_BASE}/User_DB/telesale_performance.php?year=${year}&month=${month}`,
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
        fetchData();
    }, [year, month]);

    // Sorted and tier-filtered telesale details
    const sortedDetails = useMemo(() => {
        if (!data) return [];

        // Map telesale details with tier-specific data when filter is applied
        const mappedDetails = data.telesaleDetails.map(telesale => {
            if (tierFilter === 'all') {
                return telesale;
            }

            // Check if tierMetrics exists
            if (!telesale.tierMetrics) {
                return telesale;
            }

            // Override metrics with tier-specific data
            let tierCustomers = 0;
            let tierActive = 0;
            let tierActiveRate = 0;
            let tierRetentionRate = 0;

            if (tierFilter === 'core' && telesale.tierMetrics.core) {
                const core = telesale.tierMetrics.core;
                tierCustomers = core.total || 0;
                tierActive = core.active || 0;
                tierActiveRate = core.activeRate || 0;
                tierRetentionRate = core.loyaltyRate || 0;
            } else if (tierFilter === 'new' && telesale.tierMetrics.new) {
                const newTier = telesale.tierMetrics.new;
                tierCustomers = newTier.total || 0;
                tierActive = newTier.converted || 0; // For new, "active" means converted
                tierActiveRate = newTier.conversionRate || 0;
                tierRetentionRate = 0; // Not applicable for new
            } else if (tierFilter === 'revival' && telesale.tierMetrics.revival) {
                const revival = telesale.tierMetrics.revival;
                tierCustomers = revival.total || 0;
                tierActive = revival.revived || 0;
                tierActiveRate = revival.total > 0 ? (revival.revived / revival.total) * 100 : 0;
                tierRetentionRate = 0; // Not applicable for revival
            }

            return {
                ...telesale,
                metrics: {
                    ...telesale.metrics,
                    totalCustomers: tierCustomers,
                    newCustomers: tierActive, // แทนที่ activeCustomers ด้วย newCustomers
                    newCustomerRate: tierActiveRate // แทนที่ activeRate ด้วย newCustomerRate
                    // retentionRate ยังคงใช้ค่าเดิม
                }
            };
        });

        return [...mappedDetails].sort((a, b) => {
            const aVal = a.metrics[sortField];
            const bVal = b.metrics[sortField];
            return sortDirection === 'desc' ? bVal - aVal : aVal - bVal;
        });
    }, [data, sortField, sortDirection, tierFilter]);

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
        setSavingTarget(-1); // Use -1 to indicate "saving all"
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
        <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        📊 วิเคราะห์ประสิทธิภาพ Telesale
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        ข้อมูล {THAI_MONTHS[month]} {year} • Telesale {data?.telesaleCount || 0} คน
                    </p>
                </div>

                {/* Period Selectors */}
                <div className="flex gap-2 flex-wrap">
                    {/* Month Selector */}
                    <select
                        value={month}
                        onChange={(e) => setMonth(parseInt(e.target.value))}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        {THAI_MONTHS.slice(1).map((name, idx) => (
                            <option key={idx + 1} value={idx + 1}>{name}</option>
                        ))}
                    </select>
                    <select
                        value={year}
                        onChange={(e) => setYear(parseInt(e.target.value))}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        {yearOptions.map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                    <button
                        onClick={openTargetModal}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2 font-medium"
                    >
                        🎯 ตั้งเป้า
                    </button>
                </div>
            </div>

            {/* ========================================== */}
            {/* TEAM SALES HERO BANNER */}
            {/* ========================================== */}
            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <div className="text-sm text-gray-500 mb-1">ยอดขายรวมทีม {THAI_MONTHS[month]} {year}</div>
                        <div className="text-4xl font-bold tracking-tight text-gray-800">
                            ฿{formatNumber(data?.teamAverages.totalSales || 0)}
                        </div>
                        {/* Month over month comparison */}
                        {data?.previousMonthSales !== undefined && (
                            <div className="mt-2 flex items-center gap-2">
                                {(() => {
                                    const prev = data.previousMonthSales || 0;
                                    const curr = data.teamAverages.totalSales || 0;
                                    const diff = curr - prev;
                                    const pct = prev > 0 ? ((diff / prev) * 100).toFixed(1) : '∞';
                                    const isUp = diff >= 0;
                                    return (
                                        <>
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-medium ${isUp ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                }`}>
                                                {isUp ? '📈' : '📉'} {isUp ? '+' : ''}{pct}%
                                            </span>
                                            <span className="text-sm text-gray-500">
                                                เทียบเดือนก่อน (฿{formatNumber(prev)})
                                            </span>
                                        </>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                    <div className="flex gap-6">
                        <div className="text-center px-4 py-2 bg-gray-50 rounded-lg">
                            <div className="text-3xl font-bold text-gray-700">{formatNumber(data?.teamAverages.totalOrders || 0)}</div>
                            <div className="text-sm text-gray-500">ออเดอร์</div>
                        </div>
                        <div className="text-center px-4 py-2 bg-gray-50 rounded-lg">
                            <div className="text-3xl font-bold text-gray-700">{formatNumber(data?.teamAverages.totalCalls || 0)}</div>
                            <div className="text-sm text-gray-500">สายโทร</div>
                        </div>
                        <div className="text-center px-4 py-2 bg-gray-50 rounded-lg">
                            <div className="text-3xl font-bold text-gray-700">{data?.telesaleCount || 0}</div>
                            <div className="text-sm text-gray-500">พนักงาน</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ========================================== */}
            {/* CUSTOMER SEGMENT SUMMARY - Simple Cards */}
            {/* ========================================== */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Orders & Conversion Card */}
                <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-2xl">📞</span>
                        <div>
                            <div className="font-semibold text-gray-800">ผลโทรเดือนนี้</div>
                            <div className="text-xs text-gray-500">สายโทร → ออเดอร์</div>
                        </div>
                    </div>
                    <div className="flex justify-between items-end">
                        <div>
                            <div className="text-3xl font-bold text-gray-600">{formatNumber(data?.teamAverages.totalCalls || 0)}</div>
                            <div className="text-sm text-gray-500">สายโทร</div>
                        </div>
                        <div className="text-center">
                            <div className="text-xl font-bold text-blue-600">{data?.teamAverages.conversionRate || 0}%</div>
                            <div className="text-xs text-gray-400">ปิดการขาย</div>
                        </div>
                        <div className="text-right">
                            <div className="text-3xl font-bold text-green-600">{formatNumber(data?.teamAverages.totalOrders || 0)}</div>
                            <div className="text-sm text-gray-500">ออเดอร์</div>
                        </div>
                    </div>
                </div>

                {/* New Customers Card - Uses teamAverages.newCustomers (same as table) */}
                <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-2xl">🆕</span>
                        <div>
                            <div className="font-semibold text-gray-800">ลูกค้าใหม่</div>
                            <div className="text-xs text-gray-500">ซื้อครั้งแรก (New Customer)</div>
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="text-4xl font-bold text-green-600">{formatNumber(data?.teamAverages.newCustomers || 0)}</div>
                        <div className="text-sm text-gray-500">คนซื้อครั้งแรกเดือนนี้</div>
                    </div>
                </div>

                {/* Win-back Card - Uses teamAverages.winbackCustomers (same as table) */}
                <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-2xl">💚</span>
                        <div>
                            <div className="font-semibold text-gray-800">กลับมาซื้อ</div>
                            <div className="text-xs text-gray-500">หายไป 6+ เดือน กลับมาแล้ว</div>
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="text-4xl font-bold text-amber-500">{formatNumber(data?.teamAverages.winbackCustomers || 0)}</div>
                        <div className="text-sm text-gray-500">🏆 กู้ชีพสำเร็จเดือนนี้</div>
                    </div>
                </div>
            </div>

            {/* Rankings Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <RankingCard
                    title="🏆 อัตราปิดการขายสูงสุด"
                    items={data?.rankings.byConversion || []}
                    valueLabel="%"
                    valueKey="value"
                    extraInfo={(item) => `${item.calls} สาย → ${item.orders} ออเดอร์`}
                    tooltip="วิธีคิด: (จำนวนออเดอร์ ÷ จำนวนสายโทร) × 100 เช่น 7 ออเดอร์ ÷ 100 สาย = 7%"
                />
                <RankingCard
                    title="🔄 ลูกค้าซื้อซ้ำสูงสุด"
                    items={data?.rankings.byRetention || []}
                    valueLabel="%"
                    valueKey="value"
                    extraInfo={(item) => `${item.repeat}/${item.total} ซื้อซ้ำ`}
                    tooltip="ลูกค้าในถัง 39,40 (90 วันหลังขาย) ที่ซื้อซ้ำเดือนนี้ เช่น 59 ซื้อ ÷ 99 คนในถัง = 59.6%"
                />
                <RankingCard
                    title="💰 เฉลี่ยต่อบิลสูงสุด"
                    items={(data?.rankings.byAov || []).map(item => ({ ...item, value: Math.round(item.value) }))}
                    valuePrefix="฿"
                    valueKey="value"
                    extraInfo={(item) => `฿${formatNumber(item.sales as number)} / ${item.orders} ออเดอร์`}
                    tooltip="ยอดเฉลี่ยต่อบิล - ยอดขายรวม ÷ จำนวนออเดอร์ เช่น ฿12,000 ต่อบิล"
                />
                <RankingCard
                    title="⚡ ประสิทธิภาพสูงสุด"
                    items={(data?.rankings.byEfficiency || []).map(item => ({ ...item, value: Math.round(item.value) }))}
                    valuePrefix="฿"
                    valueSuffix="/นาที"
                    valueKey="value"
                    extraInfo={(item) => `฿${formatNumber(item.sales as number)} / ${item.minutes} นาที`}
                    tooltip="วิธีคิด: ยอดขายรวม ÷ เวลาโทรรวม เช่น ฿8,400/นาที"
                />
            </div>

            {/* Detail Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="p-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-800">📋 รายละเอียด Telesale</h2>
                </div>
                <div className="overflow-x-auto overflow-y-visible">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 relative" style={{ overflow: 'visible' }}>
                            <tr>
                                <th className="px-4 py-3 text-left text-gray-600 font-medium">#</th>
                                <th className="px-4 py-3 text-left text-gray-600 font-medium">ชื่อ</th>
                                <SortableHeader
                                    label="สาย"
                                    field="totalCalls"
                                    currentField={sortField}
                                    direction={sortDirection}
                                    onClick={handleSort}
                                    tooltip="จำนวนสายโทรทั้งหมดในเดือนนี้"
                                />
                                <SortableHeader
                                    label="ออเดอร์"
                                    field="totalOrders"
                                    currentField={sortField}
                                    direction={sortDirection}
                                    onClick={handleSort}
                                    tooltip="จำนวนออเดอร์ที่สร้างในเดือนนี้ (ไม่นับยกเลิก)"
                                />
                                <SortableHeader
                                    label="ปิดการขาย %"
                                    field="conversionRate"
                                    currentField={sortField}
                                    direction={sortDirection}
                                    onClick={handleSort}
                                    tooltip="วิธีคิด: (จำนวนออเดอร์ ÷ จำนวนสาย) × 100\nตัวอย่าง: 5 ออเดอร์ ÷ 100 สาย = 5%"
                                />
                                <SortableHeader
                                    label="ยอดขาย"
                                    field="totalSales"
                                    currentField={sortField}
                                    direction={sortDirection}
                                    onClick={handleSort}
                                    tooltip="ยอดขายรวมในเดือนนี้ (บาท)"
                                />
                                <SortableHeader
                                    label="ลูกค้า"
                                    field="totalCustomers"
                                    currentField={sortField}
                                    direction={sortDirection}
                                    onClick={handleSort}
                                    tooltip="จำนวนลูกค้าที่เคยสั่งซื้อที่ assign ให้"
                                />
                                <SortableHeader
                                    label="เฉลี่ย/บิล"
                                    field="aov"
                                    currentField={sortField}
                                    direction={sortDirection}
                                    onClick={handleSort}
                                    tooltip="ยอดเฉลี่ยต่อออเดอร์ (บาท)"
                                />
                                <SortableHeader
                                    label="ลูกค้าใหม่"
                                    field="newCustomers"
                                    currentField={sortField}
                                    direction={sortDirection}
                                    onClick={handleSort}
                                    tooltip="จำนวนลูกค้าใหม่ (customer_type = 'New Customer')"
                                />
                                <SortableHeader
                                    label="💚 กลับมาซื้อ"
                                    field="winbackCustomers"
                                    currentField={sortField}
                                    direction={sortDirection}
                                    onClick={handleSort}
                                    tooltip="ลูกค้าเก่าที่กลับมา (ถัง 6-12 เดือน, 1-3 ปี, >3 ปี)"
                                />
                                <SortableHeader
                                    label="ซื้อซ้ำ %"
                                    field="retentionRate"
                                    currentField={sortField}
                                    direction={sortDirection}
                                    onClick={handleSort}
                                    tooltip="ลูกค้าซื้อซ้ำ (Reorder Customer) ÷ ลูกค้าทั้งหมด × 100"
                                />
                                <SortableHeader
                                    label="เวลาโทร (นาที)"
                                    field="ahtMinutes"
                                    currentField={sortField}
                                    direction={sortDirection}
                                    onClick={handleSort}
                                    tooltip="วิธีคิด: เวลารวม ÷ จำนวนสาย\nตัวอย่าง: 100 นาที ÷ 50 สาย = 2 นาที/สาย"
                                />
                                {/* Upsell Column Header */}
                                <th className="px-4 py-3 text-right text-gray-600 font-medium">
                                    <div className="flex items-center justify-end gap-1">
                                        <span className="text-purple-600">Upsell</span>
                                        <span className="text-gray-400 cursor-help" title="ยอดขายจากสินค้าที่เพิ่มในบิลของคนอื่น">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </span>
                                    </div>
                                </th>
                                {/* Target Progress Column Header */}
                                <th className="px-4 py-3 text-center text-gray-600 font-medium">
                                    <div className="flex items-center justify-center gap-1">
                                        <span className="text-green-600">🎯 เป้า</span>
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {sortedDetails.map((ts, idx) => (
                                <tr key={ts.userId} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                                    <td className="px-4 py-3 font-medium text-gray-800">{ts.firstName}</td>
                                    <td className="px-4 py-3 text-center">{formatNumber(ts.metrics.totalCalls)}</td>
                                    <td className="px-4 py-3 text-center">{formatNumber(ts.metrics.totalOrders)}</td>
                                    <td className="px-4 py-3 text-center">
                                        <RateBadge value={ts.metrics.conversionRate} avg={data?.teamAverages.conversionRate || 0} />
                                    </td>
                                    <td className="px-4 py-3 text-right">{formatCurrency(ts.metrics.totalSales)}</td>
                                    <td className="px-4 py-3 text-center">{formatNumber(ts.metrics.totalCustomers)}</td>
                                    <td className="px-4 py-3 text-right">{formatCurrency(Math.ceil(ts.metrics.aov || 0))}</td>
                                    <td className="px-4 py-3 text-center">{formatNumber(ts.metrics.newCustomers)}</td>
                                    {/* กลับมาซื้อ Column */}
                                    <td className="px-4 py-3 text-center">
                                        {ts.metrics.winbackCustomers > 0 ? (
                                            <span className="inline-flex items-center px-2 py-0.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 font-medium">
                                                {formatNumber(ts.metrics.winbackCustomers)}
                                            </span>
                                        ) : (
                                            <span className="text-gray-400">0</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <RateBadge value={ts.metrics.retentionRate} avg={data?.teamAverages.retentionRate || 0} />
                                    </td>
                                    <td className="px-4 py-3 text-center">{ts.metrics.ahtMinutes.toFixed(1)}</td>
                                    {/* Upsell Column */}
                                    <td className="px-4 py-3 text-right">
                                        {(ts.metrics.upsellSales ?? 0) > 0 ? (
                                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-purple-50 border border-purple-200 rounded-lg">
                                                <span className="text-purple-600 font-medium">
                                                    {formatCurrency(ts.metrics.upsellSales ?? 0)}
                                                </span>
                                                <span className="text-purple-400 text-xs">
                                                    ({ts.metrics.upsellOrders ?? 0})
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-gray-400">-</span>
                                        )}
                                    </td>
                                    {/* Target Progress Cell */}
                                    <td className="px-4 py-3">
                                        {(ts.metrics.targetAmount ?? 0) > 0 ? (
                                            <div className="flex flex-col items-center gap-0.5">
                                                <span className="text-[10px] text-gray-500">
                                                    {formatNumber(ts.metrics.combinedSales)}/{formatNumber(ts.metrics.targetAmount ?? 0)}
                                                </span>
                                                <div className="w-24 bg-gray-200 rounded-full h-2 overflow-hidden">
                                                    <div
                                                        className={`h-2 rounded-full transition-all ${(ts.metrics.targetProgress ?? 0) >= 100 ? 'bg-green-500' :
                                                            (ts.metrics.targetProgress ?? 0) >= 80 ? 'bg-yellow-500' :
                                                                'bg-red-500'
                                                            }`}
                                                        style={{ width: `${Math.min(ts.metrics.targetProgress ?? 0, 100)}%` }}
                                                    />
                                                </div>
                                                <span className={`text-[10px] font-medium ${(ts.metrics.targetProgress ?? 0) >= 100 ? 'text-green-600' :
                                                    (ts.metrics.targetProgress ?? 0) >= 80 ? 'text-yellow-600' :
                                                        'text-red-600'
                                                    }`}>
                                                    {ts.metrics.targetProgress?.toFixed(0)}%
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-gray-400 text-xs">ยังไม่ตั้งเป้า</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
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
                            <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 mb-4">
                                <span className="text-orange-700 font-medium">Supervisor Telesale ({targetTelesales.length} คน)</span>
                            </div>

                            {targetLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {targetTelesales.map((ts) => (
                                        <div key={ts.user_id} className="flex items-center gap-3 py-2 border-b border-gray-100">
                                            {/* Avatar */}
                                            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold">
                                                {ts.first_name?.charAt(0).toUpperCase() || 'U'}
                                            </div>
                                            {/* Name */}
                                            <div className="flex-1">
                                                <div className="font-medium text-gray-800">{ts.first_name} {ts.last_name}</div>
                                                <div className="text-xs text-gray-500">ID: {ts.user_id}</div>
                                            </div>
                                            {/* Target Input */}
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-400">฿</span>
                                                <input
                                                    type="number"
                                                    value={ts.target_amount || ''}
                                                    onChange={(e) => {
                                                        const newVal = parseFloat(e.target.value) || 0;
                                                        setTargetTelesales(prev =>
                                                            prev.map(t => t.user_id === ts.user_id ? { ...t, target_amount: newVal } : t)
                                                        );
                                                    }}
                                                    placeholder="0"
                                                    className="w-24 px-2 py-1 border border-gray-300 rounded-lg text-right focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                                />
                                            </div>
                                            {/* Save Button */}
                                            <button
                                                onClick={() => saveTarget(ts.user_id, ts.target_amount)}
                                                disabled={savingTarget === ts.user_id}
                                                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 text-sm font-medium"
                                            >
                                                {savingTarget === ts.user_id ? '...' : 'บันทึก'}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
                            <button
                                onClick={() => setShowTargetModal(false)}
                                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                            >
                                ปิด
                            </button>
                            <button
                                onClick={saveAllTargets}
                                disabled={savingTarget === -1}
                                className="px-5 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 font-medium flex items-center gap-2"
                            >
                                {savingTarget === -1 ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                                        กำลังบันทึก...
                                    </>
                                ) : (
                                    <>💾 บันทึกทั้งหมด</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ==========================================
// Sub-components
// ==========================================
interface MetricCardProps {
    title: string;
    value: string;
    subtitle: string;
    icon: string;
    detail: string;
    tooltip: string;
}

function MetricCard({ title, value, subtitle, icon, detail, tooltip }: MetricCardProps) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm relative group">
            <div className="flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-1">
                        <p className="text-sm font-medium text-gray-500">{title}</p>
                        <span className="text-gray-400 cursor-help" title={tooltip}>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </span>
                    </div>
                    <p className="text-3xl font-bold mt-1 text-gray-900">{value}</p>
                    <p className="text-xs mt-1 text-gray-400">{subtitle}</p>
                </div>
                <span className="text-2xl">{icon}</span>
            </div>
            <p className="text-xs mt-3 text-gray-400">{detail}</p>
            {/* Tooltip popup */}
            <div className="absolute hidden group-hover:block bottom-full left-0 mb-2 w-64 bg-gray-800 text-white text-xs rounded-lg p-3 shadow-lg z-10 whitespace-pre-line">
                {tooltip}
                <div className="absolute top-full left-4 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-gray-800"></div>
            </div>
        </div>
    );
}

interface RankingCardProps {
    title: string;
    items: RankingItem[];
    valuePrefix?: string;
    valueSuffix?: string;
    valueLabel?: string;  // Legacy support
    valueKey: string;
    extraInfo: (item: RankingItem) => string;
    tooltip?: string;
}

function RankingCard({ title, items, valuePrefix, valueSuffix, valueLabel, extraInfo, tooltip }: RankingCardProps) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between relative group">
                <h3 className="font-semibold text-gray-800">{title}</h3>
                {tooltip && (
                    <>
                        <span className="text-gray-400 cursor-help">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </span>
                        <div className="absolute hidden group-hover:block top-full right-0 mt-2 w-64 bg-gray-800 text-white text-xs rounded-lg p-3 shadow-lg z-50 whitespace-pre-line text-left">
                            {tooltip}
                            <div className="absolute bottom-full right-4 w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-gray-800"></div>
                        </div>
                    </>
                )}
            </div>
            <div className="divide-y divide-gray-100">
                {items.slice(0, 5).map((item, idx) => (
                    <div key={item.userId} className="px-4 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                                idx === 1 ? 'bg-gray-100 text-gray-600' :
                                    idx === 2 ? 'bg-orange-100 text-orange-700' :
                                        'bg-gray-50 text-gray-500'
                                }`}>
                                {idx + 1}
                            </span>
                            <span className="text-sm text-gray-800">{item.name}</span>
                        </div>
                        <div className="text-right">
                            <span className="font-semibold text-gray-800">
                                {valuePrefix || ''}{formatNumber(item.value)}{valueSuffix || valueLabel || ''}
                            </span>
                            <p className="text-xs text-gray-400">{extraInfo(item)}</p>
                        </div>
                    </div>
                ))}
                {items.length === 0 && (
                    <div className="px-4 py-4 text-center text-gray-400 text-sm">
                        ไม่มีข้อมูล
                    </div>
                )}
            </div>
        </div>
    );
}

interface SortableHeaderProps {
    label: string;
    field: keyof Metrics;
    currentField: keyof Metrics;
    direction: 'asc' | 'desc';
    onClick: (field: keyof Metrics) => void;
    tooltip?: string;
}

function SortableHeader({ label, field, currentField, direction, onClick, tooltip }: SortableHeaderProps) {
    const isActive = currentField === field;
    return (
        <th
            className="px-4 py-3 text-center text-gray-600 font-medium cursor-pointer hover:bg-gray-100 select-none relative group"
            onClick={() => onClick(field)}
        >
            <div className="flex items-center justify-center gap-1">
                {label}
                {tooltip && (
                    <span className="text-gray-400 cursor-help">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </span>
                )}
                {isActive && (
                    <span className="text-blue-500">
                        {direction === 'desc' ? '↓' : '↑'}
                    </span>
                )}
            </div>
            {tooltip && (
                <div className="absolute hidden group-hover:block top-full left-1/2 transform -translate-x-1/2 mt-2 w-56 bg-gray-800 text-white text-xs rounded-lg p-2 shadow-lg z-50 whitespace-pre-line text-left">
                    {tooltip}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-gray-800"></div>
                </div>
            )}
        </th>
    );
}

interface RateBadgeProps {
    value: number;
    avg: number;
}

function RateBadge({ value, avg }: RateBadgeProps) {
    const isAboveAvg = value >= avg;
    return (
        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${isAboveAvg ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
            {value.toFixed(1)}%
        </span>
    );
}
