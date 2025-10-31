import React from "react";
import { CustomerGrade, OrderStatus } from "../types";
import ReactApexChart from "react-apexcharts";

export const MonthlyOrdersChart: React.FC = () => {
  const series = [
    { name: "Orders", data: [10, 22, 15, 30, 18, 26, 20, 32, 28, 25, 30, 35] },
  ];
  const options: any = {
    chart: { type: "line", toolbar: { show: false } },
    stroke: { curve: "smooth", width: 3 },
    colors: ["#34D399"],
    xaxis: {
      categories: [
        "01",
        "02",
        "03",
        "04",
        "05",
        "06",
        "07",
        "08",
        "09",
        "10",
        "11",
        "12",
      ],
    },
    grid: { borderColor: "#E5E7EB" },
    legend: { show: false },
  };
  return (
    <div className="bg-white p-2 pt-0 rounded-lg shadow-sm border border-gray-200 h-full overflow-hidden">
      <div
        className="w-full overflow-hidden"
        style={{ maxWidth: "100%", width: "100%" }}
      >
        <ReactApexChart
          options={options}
          series={series}
          type="line"
          height={250}
          width="100%"
        />
      </div>
    </div>
  );
};

interface CustomerGradeChartProps {
  grades: { label: string; value: number; total: number }[];
}

const gradeColors: Record<string, string> = {
  [CustomerGrade.APlus]: "#6EE7B7",
  [CustomerGrade.A]: "#34D399",
  [CustomerGrade.B]: "#A7F3D0",
  [CustomerGrade.C]: "#FCD34D",
  [CustomerGrade.D]: "#FCA5A5",
};

export const CustomerGradeChart: React.FC<CustomerGradeChartProps> = ({
  grades,
}) => {
  const series = grades.map((g) => g.value);
  const labels = grades.map((g) => g.label);
  const colors = labels.map((l) => gradeColors[l] || "#E5E7EB");
  const options: any = {
    chart: { type: "donut", toolbar: { show: false } },
    labels,
    colors,
    legend: {
      position: "right",
      fontSize: "12px",
      itemMargin: { horizontal: 5, vertical: 2 },
      containerMargin: { top: 0, right: 0, bottom: 0, left: 0 },
      floating: false,
      offsetX: 0,
      offsetY: 0,
    },
    plotOptions: { pie: { donut: { size: "65%", labels: { show: true } } } },
  };
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 h-full overflow-hidden">
      <h3 className="text-md font-semibold text-gray-700 mb-4">
        สัดส่วนเกรดลูกค้า
      </h3>
      <div className="w-full overflow-hidden">
        <ReactApexChart
          options={options}
          series={series}
          type="donut"
          height={260}
        />
      </div>
    </div>
  );
};

interface OrderStatusChartProps {
  title: string;
  data: { label: string; value: number; total: number }[];
}

const statusColors: Record<string, string> = {
  [OrderStatus.Pending]: "#FBBF24",
  [OrderStatus.Picking]: "#F97316",
  [OrderStatus.Shipping]: "#3B82F6",
  [OrderStatus.Delivered]: "#22C55E",
  [OrderStatus.Returned]: "#EF4444",
  [OrderStatus.Cancelled]: "#6B7280",
};

export const OrderStatusChart: React.FC<OrderStatusChartProps> = ({
  title,
  data,
}) => {
  const series = data.map((d) => d.value);
  const labels = data.map((d) => d.label);
  const colors = labels.map((l) => statusColors[l] || "#E5E7EB");
  const options: any = {
    chart: { type: "donut", toolbar: { show: false } },
    labels,
    colors,
    legend: {
      position: "right",
      fontSize: "12px",
      itemMargin: { horizontal: 5, vertical: 2 },
      containerMargin: { top: 0, right: 0, bottom: 0, left: 0 },
      floating: false,
      offsetX: 0,
      offsetY: 0,
    },
    dataLabels: { enabled: true },
    plotOptions: { pie: { donut: { size: "65%", labels: { show: true } } } },
  };
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border h-full overflow-hidden">
      <h3 className="text-md font-semibold text-gray-700 mb-4">{title}</h3>
      <div className="w-full overflow-hidden">
        <ReactApexChart
          options={options}
          series={series}
          type="donut"
          height={260}
        />
      </div>
    </div>
  );
};
