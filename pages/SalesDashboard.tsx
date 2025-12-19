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
import { getOrderStats, getCustomerStats } from "@/services/api";
import Spinner from "@/components/Spinner";

interface SalesDashboardProps {
  user?: any; // Accepting user for companyId
  orders?: Order[];
  customers?: Customer[];
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

  const fetchStats = async () => {
    if (!user?.companyId) return;

    setLoading(true);
    try {
      const [oStats, cStats] = await Promise.all([
        getOrderStats(user.companyId, month, year),
        getCustomerStats(user.companyId)
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

  // Auto-refresh chart when page loads or when filters change
  useEffect(() => {
    fetchStats();
  }, [user?.companyId, month, year]);

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
            <div>
              <label className="block text-xs text-gray-500 mb-1">มุมมอง</label>
              <button className="w-full border rounded-md px-3 py-2 text-sm flex items-center justify-between">
                <span>รายเดือน</span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 h-full overflow-hidden">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-md font-semibold text-gray-700">
                สรุปคำสั่งซื้อรายเดือน
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
              <MonthlyOrdersChart key={chartKey} data={orderStats?.monthlyCounts} loading={loading} />
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-md font-semibold text-gray-700 mb-4">
              สถานะการชำระเงิน
            </h3>
            <div className="space-y-3 text-sm">
              {loading ? (
                <Spinner />
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">ชำระแล้ว (Transfer)</span>
                    <span className="font-medium">{paymentCounts['Transfer'] || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">เก็บเงินปลายทาง (COD)</span>
                    <span className="font-medium">{paymentCounts['COD'] || 0}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SalesDashboard;
