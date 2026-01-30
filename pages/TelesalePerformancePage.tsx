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
    activeCustomers: number;
    retentionRate: number;
    activeRate: number;
    efficiencyScore: number;
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
    activeRate: number;
    ahtMinutes: number;
    efficiencyScore: number;
    totalCalls: number;
    totalOrders: number;
    totalSales: number;
}

interface PerformanceData {
    period: { year: number; month: number };
    teamAverages: TeamAverages;
    tierAggregates: TierAggregates;
    telesaleCount: number;
    rankings: {
        byConversion: RankingItem[];
        byRetention: RankingItem[];
        byActive: RankingItem[];
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
                    activeCustomers: tierActive,
                    activeRate: tierActiveRate,
                    retentionRate: tierRetentionRate
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

                {/* Period & Tier Selectors */}
                <div className="flex gap-2 flex-wrap">
                    {/* Tier Filter */}
                    <select
                        value={tierFilter}
                        onChange={(e) => setTierFilter(e.target.value as 'all' | 'core' | 'new' | 'revival')}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    >
                        <option value="all">📊 ทุกกลุ่มลูกค้า</option>
                        <option value="core">🏠 Core Portfolio (ลูกค้าประจำ)</option>
                        <option value="new">🆕 New & Onboarding (ลูกค้าใหม่)</option>
                        <option value="revival">⭐ Revival (กู้ชีพ)</option>
                    </select>
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
                </div>
            </div>

            {/* ========================================== */}
            {/* TIER SUMMARY TABLE (Compact) */}
            {/* ========================================== */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-gray-50 text-gray-600 text-xs">
                            <th className="text-left px-3 py-2 font-medium">กลุ่มลูกค้า</th>
                            <th className="text-right px-3 py-2 font-medium">จำนวน</th>
                            <th className="text-right px-3 py-2 font-medium">Active %</th>
                            <th className="text-right px-3 py-2 font-medium">ความภักดี/เปลี่ยนใจ</th>
                            <th className="text-right px-3 py-2 font-medium">หมายเหตุ</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {/* Core Portfolio Row */}
                        <tr className="bg-blue-50/50 hover:bg-blue-50">
                            <td className="px-3 py-2">
                                <div className="flex items-center gap-1.5">
                                    <span>🏠</span>
                                    <span className="font-medium text-blue-800">ลูกค้าประจำ</span>
                                    <span className="text-[9px] text-blue-600 bg-blue-100 px-1 rounded">1-3 เดือน</span>
                                </div>
                            </td>
                            <td className="text-right px-3 py-2 font-semibold">{formatNumber(data?.tierAggregates?.core?.total || 0)}</td>
                            <td className="text-right px-3 py-2">
                                <span className="font-bold text-blue-600">{data?.tierAggregates?.core?.activeRate || 0}%</span>
                            </td>
                            <td className="text-right px-3 py-2">
                                <span className="font-bold text-indigo-600">{data?.tierAggregates?.core?.loyaltyRate || 0}%</span>
                                <span className="text-[10px] text-gray-400 ml-1">Loyalty</span>
                            </td>
                            <td className="text-right px-3 py-2 text-xs text-gray-500">
                                {formatNumber(data?.tierAggregates?.core?.loyal || 0)} ซื้อซ้ำ
                            </td>
                        </tr>
                        {/* New & Onboarding Row */}
                        <tr className="bg-green-50/50 hover:bg-green-50">
                            <td className="px-3 py-2">
                                <div className="flex items-center gap-1.5">
                                    <span>🆕</span>
                                    <span className="font-medium text-green-800">ลูกค้าใหม่</span>
                                    <span className="text-[9px] text-green-600 bg-green-100 px-1 rounded">หาลูกค้า</span>
                                </div>
                            </td>
                            <td className="text-right px-3 py-2 font-semibold">{formatNumber(data?.tierAggregates?.new?.total || 0)}</td>
                            <td className="text-right px-3 py-2 text-gray-400">-</td>
                            <td className="text-right px-3 py-2">
                                <span className="font-bold text-green-600">{data?.tierAggregates?.new?.conversionRate || 0}%</span>
                                <span className="text-[10px] text-gray-400 ml-1">เปลี่ยนใจซื้อ</span>
                            </td>
                            <td className="text-right px-3 py-2 text-xs text-gray-500">
                                {formatNumber(data?.tierAggregates?.new?.converted || 0)} คนซื้อแล้ว
                            </td>
                        </tr>
                        {/* Revival Row */}
                        <tr className="bg-amber-50/50 hover:bg-amber-50">
                            <td className="px-3 py-2">
                                <div className="flex items-center gap-1.5">
                                    <span>⭐</span>
                                    <span className="font-medium text-amber-800">กู้ชีพลูกค้า</span>
                                    <span className="text-[9px] text-amber-600 bg-amber-100 px-1 rounded">เก่าเก็บ</span>
                                </div>
                            </td>
                            <td className="text-right px-3 py-2 font-semibold">{formatNumber(data?.tierAggregates?.revival?.total || 0)}</td>
                            <td className="text-right px-3 py-2 text-gray-400">-</td>
                            <td className="text-right px-3 py-2 text-gray-400">-</td>
                            <td className="text-right px-3 py-2">
                                <span className="font-bold text-amber-600">🏆 {formatNumber(data?.tierAggregates?.revival?.revived || 0)}</span>
                                <span className="text-[10px] text-gray-400 ml-1">กู้ชีพ</span>
                            </td>
                        </tr>
                    </tbody>
                    <tfoot>
                        <tr className="bg-gray-100 text-xs text-gray-600">
                            <td className="px-3 py-2 font-medium">📊 ภาพรวมทีม</td>
                            <td className="text-right px-3 py-2">{formatNumber(data?.teamAverages.totalCalls || 0)} สาย</td>
                            <td className="text-right px-3 py-2">{data?.teamAverages.conversionRate || 0}% ปิดขาย</td>
                            <td className="text-right px-3 py-2">{data?.teamAverages.ahtMinutes?.toFixed(1) || 0} นาที/สาย</td>
                            <td className="text-right px-3 py-2 font-semibold text-gray-800">{formatCurrency(data?.teamAverages.totalSales || 0)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Rankings Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <RankingCard
                    title="🏆 อัตราปิดการขายสูงสุด"
                    items={data?.rankings.byConversion || []}
                    valueLabel="%"
                    valueKey="value"
                    extraInfo={(item) => `${item.calls} สาย → ${item.orders} ออเดอร์`}
                />
                <RankingCard
                    title="🔄 ลูกค้าซื้อซ้ำสูงสุด"
                    items={data?.rankings.byRetention || []}
                    valueLabel="%"
                    valueKey="value"
                    extraInfo={(item) => `${item.repeat}/${item.total} ซื้อซ้ำ`}
                />
                <RankingCard
                    title="👥 ลูกค้า Active สูงสุด"
                    items={data?.rankings.byActive || []}
                    valueLabel="%"
                    valueKey="value"
                    extraInfo={(item) => `${item.active}/${item.total} Active`}
                />
                <RankingCard
                    title="⚡ ประสิทธิภาพสูงสุด"
                    items={data?.rankings.byEfficiency || []}
                    valueLabel="บาท/นาที"
                    valueKey="value"
                    extraInfo={(item) => `${formatCurrency(item.sales as number)} / ${item.minutes} นาที`}
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
                                    label="Active"
                                    field="activeCustomers"
                                    currentField={sortField}
                                    direction={sortDirection}
                                    onClick={handleSort}
                                    tooltip="ลูกค้าที่สั่งซื้อใน 90 วันล่าสุด"
                                />
                                <SortableHeader
                                    label="Active %"
                                    field="activeRate"
                                    currentField={sortField}
                                    direction={sortDirection}
                                    onClick={handleSort}
                                    tooltip="วิธีคิด: (ลูกค้า Active ÷ ลูกค้าทั้งหมด) × 100\nตัวอย่าง: 30 Active ÷ 100 คน = 30%"
                                />
                                <SortableHeader
                                    label="ซื้อซ้ำ %"
                                    field="retentionRate"
                                    currentField={sortField}
                                    direction={sortDirection}
                                    onClick={handleSort}
                                    tooltip="วิธีคิด: (ลูกค้าซื้อซ้ำ ÷ ลูกค้าที่เคยซื้อ) × 100\nตัวอย่าง: 20 ซื้อซ้ำ ÷ 50 คน = 40%"
                                />
                                <SortableHeader
                                    label="เวลาโทร (นาที)"
                                    field="ahtMinutes"
                                    currentField={sortField}
                                    direction={sortDirection}
                                    onClick={handleSort}
                                    tooltip="วิธีคิด: เวลารวม ÷ จำนวนสาย\nตัวอย่าง: 100 นาที ÷ 50 สาย = 2 นาที/สาย"
                                />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {sortedDetails.map((ts, idx) => (
                                <tr key={ts.userId} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                                    <td className="px-4 py-3 font-medium text-gray-800">{ts.name}</td>
                                    <td className="px-4 py-3 text-center">{formatNumber(ts.metrics.totalCalls)}</td>
                                    <td className="px-4 py-3 text-center">{formatNumber(ts.metrics.totalOrders)}</td>
                                    <td className="px-4 py-3 text-center">
                                        <RateBadge value={ts.metrics.conversionRate} avg={data?.teamAverages.conversionRate || 0} />
                                    </td>
                                    <td className="px-4 py-3 text-right">{formatCurrency(ts.metrics.totalSales)}</td>
                                    <td className="px-4 py-3 text-center">{formatNumber(ts.metrics.totalCustomers)}</td>
                                    <td className="px-4 py-3 text-center">{formatNumber(ts.metrics.activeCustomers)}</td>
                                    <td className="px-4 py-3 text-center">
                                        <RateBadge value={ts.metrics.activeRate} avg={data?.teamAverages.activeRate || 0} />
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <RateBadge value={ts.metrics.retentionRate} avg={data?.teamAverages.retentionRate || 0} />
                                    </td>
                                    <td className="px-4 py-3 text-center">{ts.metrics.ahtMinutes.toFixed(1)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
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
    valueLabel: string;
    valueKey: string;
    extraInfo: (item: RankingItem) => string;
}

function RankingCard({ title, items, valueLabel, extraInfo }: RankingCardProps) {
    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                <h3 className="font-semibold text-gray-800">{title}</h3>
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
                            <span className="font-semibold text-gray-800">{item.value}{valueLabel}</span>
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
