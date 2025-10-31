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

interface SalesDashboardProps {
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
  }
  .apexcharts-canvas {
    width: 100% !important;
    max-width: 100% !important;
  }
`;

// A lightweight, international-friendly sales overview that focuses on layout only.
const SalesDashboard: React.FC<SalesDashboardProps> = ({
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

  // Function to refresh the chart
  const refreshChart = () => {
    setIsRefreshing(true);
    setChartKey((prev) => prev + 1);
    // Simulate refresh delay and reset loading state
    setTimeout(() => {
      setIsRefreshing(false);
    }, 500);
  };

  // Auto-refresh chart when page loads or when orders data changes
  useEffect(() => {
    refreshChart();
  }, [orders]);

  const { monthlySales, monthlyOrders, customersCount, performancePct } =
    useMemo(() => {
      const start = new Date(Number(year), Number(month) - 1, 1);
      const end = new Date(Number(year), Number(month), 0, 23, 59, 59, 999);

      const monthlyOrders = orders.filter((o) => {
        const d = new Date(o.orderDate);
        return d >= start && d <= end;
      });

      const monthlySales = monthlyOrders.reduce(
        (sum, o) => sum + (o.totalAmount || 0),
        0,
      );
      const customersCount = customers.length;
      // Simple placeholder: performance as a ratio of monthly sales to an arbitrary target value
      const performanceTarget = 100000; // arbitrary target for layout purposes only
      const performancePct =
        performanceTarget > 0 ? (monthlySales / performanceTarget) * 100 : 0;

      return {
        monthlySales,
        monthlyOrders: monthlyOrders.length,
        customersCount,
        performancePct,
      };
    }, [orders, customers, month, year]);

  const monthOptions = Array.from({ length: 12 }, (_, i) =>
    String(i + 1).padStart(2, "0"),
  );
  const yearOptions = [
    String(new Date().getFullYear()),
    String(new Date().getFullYear() - 1),
  ];

  return (
    <>
      <style jsx>{legendStyles}</style>
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
            value={`฿${monthlySales.toLocaleString()}`}
            subtext="อัปเดตล่าสุด"
            icon={DollarSign}
          />
          <StatCard
            title="จำนวนออเดอร์"
            value={monthlyOrders.toString()}
            subtext="ช่วงนี้"
            icon={ShoppingCart}
          />
          <StatCard
            title="ประสิทธิภาพ"
            value={`${performancePct.toFixed(2)}%`}
            subtext="เทียบเป้าหมาย"
            icon={TrendingUp}
          />
          <StatCard
            title="ลูกค้า"
            value={customersCount.toString()}
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
                className={`p-2 rounded-md transition-colors ${
                  isRefreshing
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
              <MonthlyOrdersChart key={chartKey} />
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-md font-semibold text-gray-700 mb-4">
              สถานะการชำระเงิน
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">ชำระแล้ว</span>
                <span className="font-medium">—</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">เก็บเงินปลายทาง</span>
                <span className="font-medium">—</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SalesDashboard;
