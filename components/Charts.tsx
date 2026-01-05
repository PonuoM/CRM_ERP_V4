import React from "react";
import { CustomerGrade, OrderStatus } from "../types";
import ReactApexChart from "react-apexcharts";

interface MonthlyOrdersChartProps {
  data?: Record<string, number>;
  loading?: boolean;
  year?: string; // Selected year
}

export const MonthlyOrdersChart: React.FC<MonthlyOrdersChartProps> = ({ data, loading, year }) => {
  // Process data to show all 12 months of selected year
  const processData = () => {
    const targetYear = year || String(new Date().getFullYear());
    const monthLabels = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

    // Generate all 12 months for the selected year
    const labels: string[] = [];
    const values: number[] = [];

    for (let m = 1; m <= 12; m++) {
      const monthKey = `${targetYear}-${String(m).padStart(2, '0')}`;
      labels.push(monthLabels[m - 1]);
      values.push(data?.[monthKey] || 0);
    }

    return { labels, values };
  };

  const { labels, values } = processData();

  const series = [
    { name: "ออเดอร์", data: values },
  ];

  const options: any = {
    chart: { type: "bar", toolbar: { show: false } },
    plotOptions: {
      bar: {
        borderRadius: 4,
        columnWidth: '60%',
      }
    },
    colors: ["#3B82F6"],
    xaxis: {
      categories: labels,
    },
    yaxis: {
      labels: {
        formatter: (val: number) => Math.round(val).toString()
      }
    },
    dataLabels: {
      enabled: true,
      style: {
        fontSize: '10px',
      }
    },
    grid: { borderColor: "#E5E7EB" },
    legend: { show: false },
    noData: {
      text: loading ? ' ' : 'ไม่มีข้อมูล',
      align: 'center',
      verticalAlign: 'middle',
      style: {
        color: '#888',
        fontSize: '14px',
      }
    }
  };
  return (
    <div className="bg-white p-2 pt-0 rounded-lg shadow-sm border border-gray-200 h-full overflow-hidden">
      <div
        className="w-full overflow-hidden"
        style={{ maxWidth: "100%", width: "100%" }}
      >
        {loading ? (
          <div className="h-[250px] flex justify-center items-center">
            <Spinner />
          </div>
        ) : (
          <ReactApexChart
            options={options}
            series={series}
            type="bar"
            height={250}
            width="100%"
          />
        )}
      </div>
    </div>
  );
};

import Spinner from "./Spinner";

interface CustomerGradeChartProps {
  grades: { label: string; value: number; total: number }[];
  loading?: boolean;
}

const gradeColors: Record<string, string> = {
  [CustomerGrade.A]: "#34D399",
  [CustomerGrade.B]: "#6EE7B7",
  [CustomerGrade.C]: "#FCD34D",
  [CustomerGrade.D]: "#FCA5A5",
};

export const CustomerGradeChart: React.FC<CustomerGradeChartProps> = ({
  grades,
  loading,
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
    dataLabels: {
      enabled: true,
      formatter: function (val: number) {
        return val.toFixed(1) + "%";
      },
      style: {
        fontSize: '12px',
        fontFamily: 'Helvetica, Arial, sans-serif',
        fontWeight: 'bold',
        colors: ['#fff']
      },
      dropShadow: {
        enabled: true,
      }
    },
    tooltip: {
      y: {
        formatter: function (val: number) {
          return val + " คน";
        },
      },
    },
  };
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 h-full overflow-hidden">
      <h3 className="text-md font-semibold text-gray-700 mb-4">
        สัดส่วนเกรดลูกค้า
      </h3>
      <div className="w-full overflow-hidden">
        {loading ? (
          <Spinner />
        ) : (
          <ReactApexChart
            options={options}
            series={series}
            type="donut"
            height={260}
          />
        )}
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
