import React, { useMemo, useState, useEffect } from "react";
import { Order, Customer } from "@/types";
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Users as UsersIcon,
  ChevronDown,
  RefreshCw,
} from "lucide-react";
import StatCard from "@/components/StatCard";
import { MonthlyOrdersChart } from "@/components/Charts";
import DailySalesChart from "@/components/DailySalesChart";
import { getOrderStats, getCustomerStats, getDailySales } from "@/services/api";
import Spinner from "@/components/Spinner";

interface SalesDashboardProps {
  user?: any; // Accepting user for companyId
  orders?: Order[];
  customers?: Customer[];
  openCreateOrderModal?: () => void;
}

// Custom styles to fix ApexCharts legend overflow
const legendStyles = `
  .apexcharts-legend {
    max-width: 100% !important;
    overflow-x: auto !important;
    overflow-y: hidden !important;
    white-space: nowrap !important;
    flex-wrap: nowrap !important;
  }
  .apexcharts-legend-series {
    flex-shrink: 0 !important;
    min-width: 0 !important;
  }
  .apexcharts-canvas {
    width: 100% !important;
    max-width: 100% !important;
  }
`;

// A lightweight, international-friendly sales overview that focuses on layout only.
const SalesDashboard: React.FC<SalesDashboardProps> = ({
  user,
  orders = [],
  customers = [],
  openCreateOrderModal,
}) => {
  const [month, setMonth] = useState<string>(() =>
    String(new Date().getMonth() + 1).padStart(2, "0"),
  );
  const [year, setYear] = useState<string>(() =>
    String(new Date().getFullYear()),
  );
  const [chartKey, setChartKey] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const [orderStats, setOrderStats] = useState<any>(null);
  const [customerStats, setCustomerStats] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Daily Sales Chart State
  const [dailySalesData, setDailySalesData] = useState<any>(null);
  const [dailySalesDetails, setDailySalesDetails] = useState<any[]>([]);
  const [dailySalesLoading, setDailySalesLoading] = useState<boolean>(false);
  const [dailySalesGroupBy, setDailySalesGroupBy] = useState<'role' | 'page' | 'seller'>('seller');
  const [dailySalesStatus, setDailySalesStatus] = useState<'all' | 'confirmed' | 'delivered'>('all');

  const fetchStats = async () => {
    if (!user?.companyId) return;

    setLoading(true);
    try {
      // Admin Control and Super Admin see all orders in their company
      // Other roles only see their own orders
      const isCompanyAdmin = user.role === 'Admin Control' || user.role === 'Super Admin';
      const userIdFilter = isCompanyAdmin ? undefined : user.id;

      const [oStats, cStats] = await Promise.all([
        getOrderStats(user.companyId, month, year, userIdFilter),
        getCustomerStats(user.companyId, userIdFilter) // Pass user.id to filter count
      ]);

      if (oStats.ok) setOrderStats(oStats.stats);
      if (cStats.ok) setCustomerStats(cStats.stats);

    } catch (error) {
      console.error("SalesDashboard fetch error", error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Function to refresh the chart
  const refreshChart = () => {
    setIsRefreshing(true);
    setChartKey((prev) => prev + 1);
    fetchStats();
  };

  // Fetch Daily Sales Data
  const fetchDailySales = async () => {
    if (!user?.companyId) return;

    setDailySalesLoading(true);
    try {
      const isCompanyAdmin = user.role === 'Admin Control' || user.role === 'Super Admin';
      const userIdFilter = isCompanyAdmin ? undefined : user.id;

      const result = await getDailySales(
        user.companyId,
        month,
        year,
        dailySalesGroupBy,
        userIdFilter,
        dailySalesStatus
      );

      if (result.ok) {
        setDailySalesData(result.data);
        setDailySalesDetails(result.details || []);
      }
    } catch (error) {
      console.error("Daily sales fetch error", error);
    } finally {
      setDailySalesLoading(false);
    }
  };

  // Auto-refresh chart when page loads or when filters change
  useEffect(() => {
    fetchStats();
  }, [user?.companyId, month, year]);

  // Auto-refresh daily sales when filters or groupBy change
  useEffect(() => {
    fetchDailySales();
  }, [user?.companyId, month, year, dailySalesGroupBy, dailySalesStatus]);

  const { monthlySales, monthlyOrders, customersCount, performancePct } =
    useMemo(() => {
      // Use API stats if available, fall back to "0" or mocked props if needed (though we expect API now)
      const monthlySales = orderStats?.totalRevenue || 0;
      const monthlyOrdersCount = orderStats?.totalOrders || 0;
      const customersCount = customerStats?.totalCustomers || 0;

      // Simple placeholder: performance as a ratio of monthly sales to an arbitrary target value
      const performanceTarget = 100000; // arbitrary target for layout purposes only
      const performancePct =
        performanceTarget > 0 ? (monthlySales / performanceTarget) * 100 : 0;

      return {
        monthlySales,
        monthlyOrders: monthlyOrdersCount,
        customersCount,
        performancePct,
      };
    }, [orderStats, customerStats]);

  const monthOptions = Array.from({ length: 12 }, (_, i) =>
    String(i + 1).padStart(2, "0"),
  );
  const yearOptions = [
    String(new Date().getFullYear()),
    String(new Date().getFullYear() - 1),
  ];

  const paymentCounts = orderStats?.paymentMethodCounts || {};
  const renderLoadingSpinner = () => (
    <div className="flex items-center">
      <svg className="animate-spin h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </div>
  );

  return (
    <>
      <style>{legendStyles}</style>
      <div className="p-6">
        {/* Filters (layout only) */}
        <div className="bg-white border rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">เดือน</label>
              <select
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                {monthOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">ปี</label>
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={openCreateOrderModal}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-medium rounded-md px-4 py-2 text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                สร้างคำสั่งซื้อ
              </button>
            </div>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <StatCard
            title="ยอดขายรายเดือน"
            value={loading ? renderLoadingSpinner() : `฿${monthlySales.toLocaleString()}`}
            subtext="อัปเดตล่าสุด"
            icon={DollarSign}
          />
          <StatCard
            title="จำนวนออเดอร์"
            value={loading ? renderLoadingSpinner() : monthlyOrders.toString()}
            subtext="ช่วงนี้"
            icon={ShoppingCart}
          />
          <StatCard
            title="ประสิทธิภาพ"
            value={loading ? renderLoadingSpinner() : `${performancePct.toFixed(2)}%`}
            subtext="เทียบเป้าหมาย"
            icon={TrendingUp}
          />
          <StatCard
            title="ลูกค้า"
            value={loading ? renderLoadingSpinner() : customersCount.toString()}
            subtext="ทั้งหมด"
            icon={UsersIcon}
          />
        </div>

        {/* Charts/sections (placeholders for layout) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 h-full overflow-hidden">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-md font-semibold text-gray-700">
                สรุปคำสั่งซื้อรายเดือน ({year})
              </h3>
              <button
                onClick={refreshChart}
                disabled={isRefreshing}
                className={`p-2 rounded-md transition-colors ${isRefreshing
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                  }`}
                title={isRefreshing ? "กำลังรีเฟรช..." : "รีเฟรชกราฟ"}
              >
                <RefreshCw
                  className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
                />
              </button>
            </div>
            <div className="w-full">
              <MonthlyOrdersChart key={chartKey} data={orderStats?.monthlyCounts} loading={loading} year={year} />
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-md font-semibold text-gray-700 mb-4">
              ช่องทางการชำระเงิน
            </h3>
            <div className="space-y-3 text-sm">
              {loading ? (
                <Spinner />
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">โอนเงิน</span>
                    <span className="font-medium">{paymentCounts['Transfer'] || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">เก็บเงินปลายทาง (COD)</span>
                    <span className="font-medium">{paymentCounts['COD'] || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">รับสินค้าก่อน</span>
                    <span className="font-medium">{paymentCounts['หลังจากรับสินค้า'] || paymentCounts['PayAfter'] || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">ส่งเคลม</span>
                    <span className="font-medium">{paymentCounts['Claim'] || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">ส่งของแถม</span>
                    <span className="font-medium">{paymentCounts['FreeGift'] || 0}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Order Status Section */}
        <div className="grid grid-cols-1 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-md font-semibold text-gray-700 mb-4">
              สถานะออเดอร์
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
              {loading ? (
                <Spinner />
              ) : (
                <>
                  <div className="bg-yellow-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-yellow-600">{orderStats?.statusCounts?.['Pending'] || 0}</div>
                    <div className="text-gray-600 mt-1">รอดำเนินการ</div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-purple-600">{(orderStats?.statusCounts?.['Preparing'] || 0) + (orderStats?.statusCounts?.['Picking'] || 0)}</div>
                    <div className="text-gray-600 mt-1">กำลังจัดเตรียม</div>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-600">{orderStats?.statusCounts?.['Shipping'] || 0}</div>
                    <div className="text-gray-600 mt-1">กำลังจัดส่ง</div>
                  </div>
                  <div className="bg-orange-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-orange-600">{(orderStats?.statusCounts?.['PreApproved'] || 0) + (orderStats?.statusCounts?.['AwaitingVerification'] || 0)}</div>
                    <div className="text-gray-600 mt-1">รอตรวจสอบ</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-600">{orderStats?.statusCounts?.['Delivered'] || 0}</div>
                    <div className="text-gray-600 mt-1">เสร็จสิ้น</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-gray-600">{orderStats?.statusCounts?.['Cancelled'] || 0}</div>
                    <div className="text-gray-600 mt-1">ยกเลิก</div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Daily Sales Chart Section */}
        <div className="mt-6">
          <DailySalesChart
            data={dailySalesData}
            details={dailySalesDetails}
            loading={dailySalesLoading}
            groupBy={dailySalesGroupBy}
            onGroupByChange={setDailySalesGroupBy}
            statusFilter={dailySalesStatus}
            onStatusFilterChange={setDailySalesStatus}
          />
        </div>
      </div>
    </>
  );
};

export default SalesDashboard;
