import React, { useState, useEffect, useMemo } from 'react';
import { User, UserRole } from '../types';
import { BarChart2, Calendar, Users, Package, TrendingUp, ChevronDown, XCircle, Gift, ArrowUpRight } from 'lucide-react';
import APP_BASE_PATH from '../appBasePath';

interface ProductAnalysisPageProps {
    currentUser: User;
}

interface TopProduct {
    id: number;
    name: string;
    sku: string;
    category: string;
    value: number;
    quantity: number;
}

interface CategorySales {
    category_group: string;
    customer_type: string;
    revenue: number;
    quantity: number;
    order_count: number;
}

interface FreebieCategory {
    category_group: string;
    customer_type: string;
    quantity: number;
    order_count: number;
}

interface MonthlyData {
    quantity: number;
    revenue: number;
}

interface MonthlySalesRow {
    product_id: number;
    product_name: string;
    sku: string;
    category: string;
    months: Record<number, MonthlyData>;
    total_quantity: number;
    total_revenue: number;
}

interface OthersDetail {
    id: number;
    name: string;
    sku: string;
    category: string;
    customer_type: string;
    revenue: number;
    quantity: number;
}

interface Employee {
    id: number;
    firstName: string;
    lastName: string;
    role: string;
}

interface Summary {
    grossRevenue: number;
    netRevenue: number;
    discountAmount: number;
    totalQuantity: number;
    totalOrders: number;
    totalCustomers: number;
}

interface OrderStatusBreakdown {
    status: string;
    statusLabel: string;
    grossRevenue: number;
    netRevenue: number;
    quantity: number;
    orders: number;
    customers: number;
}

interface FreebieSummary {
    totalQuantity: number;
    totalOrders: number;
}

interface UpsellSummary {
    grossRevenue: number;
    netRevenue: number;
    totalQuantity: number;
    totalOrders: number;
}

interface AnalysisData {
    ok: boolean;
    year: number;
    month: number;
    summary: Summary;
    upsellSummary?: UpsellSummary;
    orderStatusBreakdown: OrderStatusBreakdown[];
    topProductsByValue: TopProduct[];
    topProductsByQuantity: TopProduct[];
    salesByCategory: CategorySales[];
    monthlySalesBreakdown: MonthlySalesRow[];
    othersDetail: OthersDetail[];
    freebieByCategory: FreebieCategory[];
    freebieSummary: FreebieSummary;
    employees: Employee[];
}

const MONTHS_TH = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('th-TH', {
        style: 'currency',
        currency: 'THB',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
};

const formatNumber = (value: number): string => {
    return new Intl.NumberFormat('th-TH').format(value);
};

export const ProductAnalysisPage: React.FC<ProductAnalysisPageProps> = ({ currentUser }) => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1; // 1-12
    const [year, setYear] = useState(currentYear);
    const [month, setMonth] = useState(currentMonth); // Default to current month
    const [userId, setUserId] = useState(0); // 0 = all users
    const [data, setData] = useState<AnalysisData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showOthersModal, setShowOthersModal] = useState(false);
    const [showStatusBreakdown, setShowStatusBreakdown] = useState(false);
    const [monthlyViewMode, setMonthlyViewMode] = useState<'revenue' | 'quantity'>('revenue');

    // API base path - use APP_BASE_PATH for correct routing on production
    const API_BASE = `${APP_BASE_PATH}api`;

    // Check if user can filter by employee
    const canFilterEmployees = useMemo(() => {
        return currentUser.role === UserRole.SuperAdmin ||
            currentUser.role === UserRole.AdminControl ||
            currentUser.role === UserRole.Supervisor ||
            currentUser.role === UserRole.Admin;
    }, [currentUser.role]);

    // Fetch data
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const token = localStorage.getItem('authToken');
                const params = new URLSearchParams({
                    year: year.toString(),
                    month: month.toString(),
                    company_id: currentUser.companyId.toString()
                });
                if (userId > 0) {
                    params.append('user_id', userId.toString());
                }

                const response = await fetch(`${API_BASE}/User_DB/product_analysis.php?${params}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch data');
                }

                const result = await response.json();
                if (!result.ok) {
                    throw new Error(result.error || 'Unknown error');
                }

                setData(result);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load data');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [year, month, userId, currentUser.companyId, API_BASE]);

    // Process category sales into pivot format matching the image
    const categorySalesPivot = useMemo(() => {
        if (!data?.salesByCategory) return [];

        // Define order: กระสอบใหญ่, กระสอบเล็ก, ชีวภัณฑ์, อื่นๆ
        const categoryOrder = ['กระสอบใหญ่', 'กระสอบเล็ก', 'ชีวภัณฑ์', 'อื่นๆ'];
        const pivot: Record<string, { newRevenue: number; newQty: number; reorderRevenue: number; reorderQty: number }> = {};

        // Initialize
        categoryOrder.forEach(cat => {
            pivot[cat] = { newRevenue: 0, newQty: 0, reorderRevenue: 0, reorderQty: 0 };
        });

        data.salesByCategory.forEach(row => {
            // Map category_group to display names
            let displayCat = row.category_group;
            if (!categoryOrder.includes(displayCat)) {
                displayCat = 'อื่นๆ';
            }

            if (!pivot[displayCat]) {
                pivot[displayCat] = { newRevenue: 0, newQty: 0, reorderRevenue: 0, reorderQty: 0 };
            }

            const revenue = parseFloat(String(row.revenue)) || 0;
            const qty = parseInt(String(row.quantity)) || 0;

            if (row.customer_type === 'New Customer' || row.customer_type === 'ลูกค้าใหม่' || row.customer_type === 'new') {
                pivot[displayCat].newRevenue += revenue;
                pivot[displayCat].newQty += qty;
            } else {
                pivot[displayCat].reorderRevenue += revenue;
                pivot[displayCat].reorderQty += qty;
            }
        });

        // Calculate totals
        let totalNewRevenue = 0, totalNewQty = 0, totalReorderRevenue = 0, totalReorderQty = 0;
        Object.values(pivot).forEach(v => {
            totalNewRevenue += v.newRevenue;
            totalNewQty += v.newQty;
            totalReorderRevenue += v.reorderRevenue;
            totalReorderQty += v.reorderQty;
        });

        // Create result in specific order
        const result = categoryOrder.map(cat => ({
            category: cat,
            ...pivot[cat]
        }));

        // Add summary row
        result.push({
            category: 'ยอดรวม',
            newRevenue: totalNewRevenue,
            newQty: totalNewQty,
            reorderRevenue: totalReorderRevenue,
            reorderQty: totalReorderQty
        });

        return result;
    }, [data?.salesByCategory]);

    // Process freebie data into pivot format
    const freebiePivot = useMemo(() => {
        if (!data?.freebieByCategory) return [];

        // Use same order as sales grid
        const categoryOrder = ['กระสอบใหญ่', 'กระสอบเล็ก', 'ชีวภัณฑ์', 'อื่นๆ'];
        const pivot: Record<string, { newQty: number; reorderQty: number }> = {};

        // Initialize all categories
        categoryOrder.forEach(cat => {
            pivot[cat] = { newQty: 0, reorderQty: 0 };
        });

        data.freebieByCategory.forEach(row => {
            let cat = row.category_group || 'อื่นๆ';
            // Map categories not in our list to 'อื่นๆ'
            if (!categoryOrder.includes(cat)) {
                cat = 'อื่นๆ';
            }

            const qty = parseInt(String(row.quantity)) || 0;

            if (row.customer_type === 'New Customer' || row.customer_type === 'ลูกค้าใหม่' || row.customer_type === 'new') {
                pivot[cat].newQty += qty;
            } else {
                pivot[cat].reorderQty += qty;
            }
        });

        // Calculate totals
        let totalNewQty = 0, totalReorderQty = 0;
        Object.values(pivot).forEach(v => {
            totalNewQty += v.newQty;
            totalReorderQty += v.reorderQty;
        });

        // Create result in specific order
        const result = categoryOrder.map(cat => ({
            category: cat,
            newQty: pivot[cat].newQty,
            reorderQty: pivot[cat].reorderQty,
            totalQty: pivot[cat].newQty + pivot[cat].reorderQty
        }));

        // Add summary row
        result.push({
            category: 'ยอดรวม',
            newQty: totalNewQty,
            reorderQty: totalReorderQty,
            totalQty: totalNewQty + totalReorderQty
        });

        return result;
    }, [data?.freebieByCategory]);

    // Calculate max values for bar charts
    const maxValue = useMemo(() => {
        if (!data) return 1;
        const values = data.topProductsByValue.map(p => p.value);
        return Math.max(...values, 1);
    }, [data]);

    const maxQuantity = useMemo(() => {
        if (!data) return 1;
        const quantities = data.topProductsByQuantity.map(p => p.quantity);
        return Math.max(...quantities, 1);
    }, [data]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6">
                <div className="bg-red-50 text-red-700 p-4 rounded-lg">
                    <p className="font-medium">เกิดข้อผิดพลาด</p>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
            {/* Header with Filters */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <div className="bg-green-100 p-3 rounded-xl">
                        <BarChart2 className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">วิเคราะห์ผลิตภัณฑ์</h1>
                        <p className="text-gray-500 text-sm">Product Analysis Dashboard</p>
                    </div>
                </div>

                {/* Filters - Right Side */}
                <div className="flex flex-wrap gap-3 items-center">
                    {/* Year Filter */}
                    <div className="flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-gray-400" />
                        <select
                            value={year}
                            onChange={(e) => setYear(parseInt(e.target.value))}
                            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                        >
                            {[currentYear - 2, currentYear - 1, currentYear].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    {/* Month Filter */}
                    <select
                        value={month}
                        onChange={(e) => setMonth(parseInt(e.target.value))}
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                    >
                        {MONTHS_TH.slice(1).map((m, i) => (
                            <option key={i + 1} value={i + 1}>{m}</option>
                        ))}
                    </select>

                    {/* Employee Filter */}
                    {canFilterEmployees && data?.employees && (
                        <div className="flex items-center gap-2">
                            <Users className="w-5 h-5 text-gray-400" />
                            <select
                                value={userId}
                                onChange={(e) => setUserId(parseInt(e.target.value))}
                                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white min-w-[160px]"
                            >
                                <option value={0}>พนักงานทั้งหมด</option>
                                {data.employees.map(emp => (
                                    <option key={emp.id} value={emp.id}>
                                        {emp.firstName} {emp.lastName}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-green-100 p-2 rounded-lg">
                            <TrendingUp className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="relative group">
                            <p className="text-gray-500 text-xs">ยอดขายรวม</p>
                            <p className="text-xl font-bold text-gray-800 cursor-help">{formatCurrency(data?.summary.netRevenue || 0)}</p>
                            {/* Tooltip with discount breakdown */}
                            <div className="absolute left-0 top-full mt-1 z-50 hidden group-hover:block">
                                <div className="bg-gray-800 text-white text-xs rounded-lg p-3 shadow-xl min-w-[200px]">
                                    <div className="space-y-1">
                                        <div className="flex justify-between">
                                            <span>ยอดก่อนลด:</span>
                                            <span className="font-semibold">{formatCurrency(data?.summary.grossRevenue || 0)}</span>
                                        </div>
                                        <div className="flex justify-between text-red-300">
                                            <span>ส่วนลด:</span>
                                            <span className="font-semibold">-{formatCurrency(data?.summary.discountAmount || 0)}</span>
                                        </div>
                                        <div className="border-t border-gray-600 pt-1 flex justify-between text-green-300">
                                            <span>ยอดสุทธิ:</span>
                                            <span className="font-semibold">{formatCurrency(data?.summary.netRevenue || 0)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-lg">
                            <Package className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-gray-500 text-xs">จำนวนสินค้า</p>
                            <p className="text-xl font-bold text-gray-800">{formatNumber(data?.summary.totalQuantity || 0)} ชิ้น</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-amber-100 p-2 rounded-lg">
                            <BarChart2 className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-gray-500 text-xs">จำนวนออเดอร์</p>
                            <p className="text-xl font-bold text-gray-800">{formatNumber(data?.summary.totalOrders || 0)}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-purple-100 p-2 rounded-lg">
                            <Users className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-gray-500 text-xs">จำนวนลูกค้า</p>
                            <p className="text-xl font-bold text-gray-800">{formatNumber(data?.summary.totalCustomers || 0)}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm p-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-pink-100 p-2 rounded-lg">
                            <Gift className="w-5 h-5 text-pink-600" />
                        </div>
                        <div>
                            <p className="text-gray-500 text-xs">ของแถม</p>
                            <p className="text-xl font-bold text-gray-800">{formatNumber(data?.freebieSummary?.totalQuantity || 0)} ชิ้น</p>
                        </div>
                    </div>
                </div>
                {/* Upsell Summary Card - Compact version */}
                {(data?.upsellSummary?.netRevenue ?? 0) > 0 && (
                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl shadow-sm p-4 border border-indigo-200">
                        <div className="flex items-center gap-3">
                            <div className="bg-indigo-100 p-2 rounded-lg">
                                <ArrowUpRight className="w-5 h-5 text-indigo-600" />
                            </div>
                            <div>
                                <p className="text-indigo-600 text-xs font-medium">Upsell</p>
                                <p className="text-xl font-bold text-indigo-700">{formatCurrency(data?.upsellSummary?.netRevenue || 0)}</p>
                                <p className="text-indigo-500 text-[10px]">
                                    {formatNumber(data?.upsellSummary?.totalOrders || 0)} รายการ
                                </p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Order Status Breakdown Toggle Button */}
            {data?.orderStatusBreakdown && data.orderStatusBreakdown.length > 0 && (
                <div className="flex justify-end">
                    <button
                        onClick={() => setShowStatusBreakdown(!showStatusBreakdown)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-medium rounded-lg transition-colors"
                    >
                        <XCircle className="w-3.5 h-3.5" />
                        ออเดอร์ไม่นับ ({data.orderStatusBreakdown.reduce((sum, item) => sum + item.orders, 0)})
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showStatusBreakdown ? 'rotate-180' : ''}`} />
                    </button>
                </div>
            )}

            {/* Order Status Breakdown Content (Collapsible) */}
            {showStatusBreakdown && data?.orderStatusBreakdown && data.orderStatusBreakdown.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl shadow-sm p-4 animate-fadeIn">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {data.orderStatusBreakdown.map((item) => (
                            <div key={item.status} className="bg-white rounded-lg p-3 border border-red-100">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm font-medium text-red-700">{item.statusLabel}</span>
                                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
                                        {item.orders} ออเดอร์
                                    </span>
                                </div>
                                <div className="space-y-1 text-xs text-gray-600">
                                    <div className="flex justify-between">
                                        <span>ยอดก่อนลด:</span>
                                        <span className="font-medium text-gray-800">{formatCurrency(item.grossRevenue)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>ยอดสุทธิ:</span>
                                        <span className="font-medium text-gray-800">{formatCurrency(item.netRevenue)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>จำนวน:</span>
                                        <span className="font-medium text-gray-800">{formatNumber(item.quantity)} ชิ้น</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>ลูกค้า:</span>
                                        <span className="font-medium text-gray-800">{item.customers} คน</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 4 Column Grid: Top 5 Value | Top 5 Qty | Category Sales Table | Freebie Table */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
                {/* Top 5 by Value - Bar Chart */}
                <div className="bg-white rounded-xl shadow-sm p-5">
                    <h3 className="text-base font-semibold text-gray-800 mb-4">Top 5 สินค้า (มูลค่า)</h3>
                    <div className="space-y-3">
                        {data?.topProductsByValue.map((product, index) => (
                            <div key={product.id} className="flex items-center gap-2">
                                <span className="w-5 text-xs font-bold text-gray-500">{index + 1}</span>
                                <div className="flex-1">
                                    <div className="flex justify-between items-center mb-1">
                                        <div className="relative group">
                                            <span className="text-xs font-medium text-gray-700 truncate max-w-[160px] block cursor-pointer hover:text-green-600 transition-colors">
                                                {product.name}
                                            </span>
                                            <div className="absolute left-0 bottom-full mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 whitespace-nowrap max-w-xs">
                                                {product.name}
                                                <div className="absolute left-4 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-800"></div>
                                            </div>
                                        </div>
                                        <span className="text-xs font-bold text-green-600">{formatCurrency(product.value)}</span>
                                    </div>
                                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all duration-500"
                                            style={{ width: `${(product.value / maxValue) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                        {(!data?.topProductsByValue || data.topProductsByValue.length === 0) && (
                            <p className="text-gray-400 text-center py-4 text-sm">ไม่มีข้อมูล</p>
                        )}
                    </div>
                </div>

                {/* Top 5 by Quantity - Bar Chart */}
                <div className="bg-white rounded-xl shadow-sm p-5">
                    <h3 className="text-base font-semibold text-gray-800 mb-4">Top 5 สินค้า (จำนวน)</h3>
                    <div className="space-y-3">
                        {data?.topProductsByQuantity.map((product, index) => (
                            <div key={product.id} className="flex items-center gap-2">
                                <span className="w-5 text-xs font-bold text-gray-500">{index + 1}</span>
                                <div className="flex-1">
                                    <div className="flex justify-between items-center mb-1">
                                        <div className="relative group">
                                            <span className="text-xs font-medium text-gray-700 truncate max-w-[160px] block cursor-pointer hover:text-blue-600 transition-colors">
                                                {product.name}
                                            </span>
                                            <div className="absolute left-0 bottom-full mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 whitespace-nowrap max-w-xs">
                                                {product.name}
                                                <div className="absolute left-4 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-800"></div>
                                            </div>
                                        </div>
                                        <span className="text-xs font-bold text-blue-600">{formatNumber(product.quantity)}</span>
                                    </div>
                                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-500"
                                            style={{ width: `${(product.quantity / maxQuantity) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                        {(!data?.topProductsByQuantity || data.topProductsByQuantity.length === 0) && (
                            <p className="text-gray-400 text-center py-4 text-sm">ไม่มีข้อมูล</p>
                        )}
                    </div>
                </div>

                {/* Category Sales Table - Matching Image Format */}
                <div className="bg-white rounded-xl shadow-sm p-5">
                    <h3 className="text-base font-semibold text-gray-800 mb-3">ยอดขายตามประเภทลูกค้า</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-gray-200">
                                    <th className="text-left py-1.5 px-1 font-semibold text-gray-600" rowSpan={2}>ประเภท</th>
                                    <th className="text-center py-1 px-1 font-semibold text-blue-600" colSpan={2}>ลูกค้าใหม่</th>
                                    <th className="text-center py-1 px-1 font-semibold text-green-600" colSpan={2}>รีออเดอร์</th>
                                </tr>
                                <tr className="border-b border-gray-200">
                                    <th className="text-right py-1 px-1 font-medium text-gray-400 text-[10px]">ยอด</th>
                                    <th className="text-right py-1 px-1 font-medium text-gray-400 text-[10px]">จำนวน</th>
                                    <th className="text-right py-1 px-1 font-medium text-gray-400 text-[10px]">ยอด</th>
                                    <th className="text-right py-1 px-1 font-medium text-gray-400 text-[10px]">จำนวน</th>
                                </tr>
                            </thead>
                            <tbody>
                                {categorySalesPivot.map((row) => (
                                    <tr
                                        key={row.category}
                                        className={`border-b border-gray-100 ${row.category === 'ยอดรวม' ? 'bg-gray-50 font-semibold' : 'hover:bg-gray-50'}`}
                                    >
                                        <td className="py-1.5 px-1 text-gray-700">
                                            {row.category === 'ไม่ระบุ' ? (
                                                <button
                                                    onClick={() => setShowOthersModal(true)}
                                                    className="text-blue-600 hover:underline flex items-center gap-0.5"
                                                >
                                                    {row.category}
                                                    <ChevronDown className="w-3 h-3" />
                                                </button>
                                            ) : (
                                                <span className="truncate block max-w-[70px]" title={row.category}>{row.category}</span>
                                            )}
                                        </td>
                                        <td className="text-right py-1.5 px-1 text-blue-600">{formatCurrency(row.newRevenue)}</td>
                                        <td className="text-right py-1.5 px-1 text-gray-600">{formatNumber(row.newQty)}</td>
                                        <td className="text-right py-1.5 px-1 text-green-600">{formatCurrency(row.reorderRevenue)}</td>
                                        <td className="text-right py-1.5 px-1 text-gray-600">{formatNumber(row.reorderQty)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Freebie Table */}
                <div className="bg-white rounded-xl shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <Gift className="w-4 h-4 text-pink-500" />
                        <h3 className="text-base font-semibold text-gray-800">ของแถมตามประเภท</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="border-b border-gray-200">
                                    <th className="text-left py-1.5 px-1 font-semibold text-gray-600">ประเภท</th>
                                    <th className="text-right py-1.5 px-1 font-semibold text-blue-600">ใหม่</th>
                                    <th className="text-right py-1.5 px-1 font-semibold text-green-600">รีออ</th>
                                    <th className="text-right py-1.5 px-1 font-semibold text-gray-600">รวม</th>
                                </tr>
                            </thead>
                            <tbody>
                                {freebiePivot.map((row) => (
                                    <tr
                                        key={row.category}
                                        className={`border-b border-gray-100 ${row.category === 'ยอดรวม' ? 'bg-pink-50 font-semibold' : 'hover:bg-gray-50'}`}
                                    >
                                        <td className="py-1.5 px-1 text-gray-700">
                                            <span className="truncate block max-w-[80px]" title={row.category}>{row.category}</span>
                                        </td>
                                        <td className="text-right py-1.5 px-1 text-blue-600">{formatNumber(row.newQty)}</td>
                                        <td className="text-right py-1.5 px-1 text-green-600">{formatNumber(row.reorderQty)}</td>
                                        <td className="text-right py-1.5 px-1 text-pink-600 font-medium">{formatNumber(row.totalQty)}</td>
                                    </tr>
                                ))}
                                {freebiePivot.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="py-4 text-center text-gray-400">ไม่มีของแถม</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Monthly Sales Pivot Table */}
            <div className="bg-white rounded-xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">ยอดขายรายเดือน (ปี {year})</h3>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setMonthlyViewMode('revenue')}
                            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${monthlyViewMode === 'revenue'
                                ? 'bg-green-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            ยอดขาย
                        </button>
                        <button
                            onClick={() => setMonthlyViewMode('quantity')}
                            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${monthlyViewMode === 'quantity'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            จำนวน
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-200">
                                <th className="text-left py-3 px-2 font-semibold text-gray-600 min-w-[180px]">สินค้า</th>
                                {MONTHS_TH.slice(1).map((m, i) => (
                                    <th key={i} className="text-right py-3 px-2 font-semibold text-gray-600 min-w-[70px]">{m}</th>
                                ))}
                                <th className="text-right py-3 px-2 font-semibold text-gray-600 min-w-[90px]">รวม</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data?.monthlySalesBreakdown.slice(0, 20).map((row) => (
                                <tr key={row.product_id} className="border-b border-gray-100 hover:bg-gray-50">
                                    <td className="py-2 px-2">
                                        <div className="font-medium text-gray-700 truncate max-w-[180px]" title={row.product_name}>
                                            {row.product_name}
                                        </div>
                                        <div className="text-xs text-gray-400">{row.sku}</div>
                                    </td>
                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                                        <td key={m} className="text-right py-2 px-2">
                                            {monthlyViewMode === 'revenue' ? (
                                                <span className={row.months[m]?.revenue > 0 ? 'text-green-600' : 'text-gray-300'}>
                                                    {row.months[m]?.revenue > 0 ? formatCurrency(row.months[m].revenue) : '-'}
                                                </span>
                                            ) : (
                                                <span className={row.months[m]?.quantity > 0 ? 'text-blue-600' : 'text-gray-300'}>
                                                    {row.months[m]?.quantity > 0 ? formatNumber(row.months[m].quantity) : '-'}
                                                </span>
                                            )}
                                        </td>
                                    ))}
                                    <td className="text-right py-2 px-2 font-bold">
                                        {monthlyViewMode === 'revenue' ? (
                                            <span className="text-green-600">{formatCurrency(row.total_revenue)}</span>
                                        ) : (
                                            <span className="text-blue-600">{formatNumber(row.total_quantity)}</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {(!data?.monthlySalesBreakdown || data.monthlySalesBreakdown.length === 0) && (
                                <tr>
                                    <td colSpan={14} className="py-8 text-center text-gray-400">ไม่มีข้อมูล</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Others Detail Modal */}
            {showOthersModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b">
                            <h3 className="text-lg font-semibold">รายละเอียดประเภท "ไม่ระบุ"</h3>
                            <button
                                onClick={() => setShowOthersModal(false)}
                                className="p-1 hover:bg-gray-100 rounded-full"
                            >
                                <XCircle className="w-6 h-6 text-gray-400" />
                            </button>
                        </div>
                        <div className="overflow-y-auto max-h-[60vh] p-4">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-white">
                                    <tr className="border-b border-gray-200">
                                        <th className="text-left py-2 px-3 font-semibold text-gray-600">สินค้า</th>
                                        <th className="text-left py-2 px-3 font-semibold text-gray-600">หมวดหมู่</th>
                                        <th className="text-left py-2 px-3 font-semibold text-gray-600">ประเภทลูกค้า</th>
                                        <th className="text-right py-2 px-3 font-semibold text-gray-600">จำนวน</th>
                                        <th className="text-right py-2 px-3 font-semibold text-gray-600">ยอดขาย</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data?.othersDetail.map((item, i) => (
                                        <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                                            <td className="py-2 px-3">
                                                <div className="font-medium">{item.name}</div>
                                                <div className="text-xs text-gray-400">{item.sku}</div>
                                            </td>
                                            <td className="py-2 px-3 text-gray-600">{item.category || '-'}</td>
                                            <td className="py-2 px-3 text-gray-600">{item.customer_type || 'ไม่ระบุ'}</td>
                                            <td className="text-right py-2 px-3">{formatNumber(item.quantity)}</td>
                                            <td className="text-right py-2 px-3 font-medium text-green-600">{formatCurrency(item.revenue)}</td>
                                        </tr>
                                    ))}
                                    {(!data?.othersDetail || data.othersDetail.length === 0) && (
                                        <tr>
                                            <td colSpan={5} className="py-8 text-center text-gray-400">ไม่มีข้อมูล</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductAnalysisPage;
