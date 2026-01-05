import React, { useState } from "react";
import ReactApexChart from "react-apexcharts";
import Spinner from "./Spinner";
import { Filter, ChevronDown } from "lucide-react";

interface DailySalesChartProps {
    data: {
        days: string[];
        daysInMonth: number;
        series: { name: string; data: number[] }[];
    } | null;
    details: {
        id: string | number;
        name: string;
        dailySales: Record<string, number>;
        total: number;
    }[];
    loading?: boolean;
    groupBy: 'role' | 'page' | 'seller';
    onGroupByChange: (groupBy: 'role' | 'page' | 'seller') => void;
    statusFilter: 'all' | 'confirmed' | 'delivered';
    onStatusFilterChange: (status: 'all' | 'confirmed' | 'delivered') => void;
}

// Color palette for stacked bars - Modern & Vibrant
const COLORS = [
    "#3B82F6", // Blue
    "#10B981", // Emerald
    "#F59E0B", // Amber
    "#EF4444", // Red
    "#8B5CF6", // Violet
    "#EC4899", // Pink
    "#06B6D4", // Cyan
    "#F97316", // Orange
    "#84CC16", // Lime
    "#6366F1", // Indigo
    "#14B8A6", // Teal
    "#A855F7", // Purple
];

const groupByLabels = {
    role: "แยกตามแผนก",
    page: "แยกตามเพจ",
    seller: "แยกตามผู้ขาย",
};

const statusLabels = {
    all: "ยอดสั่งซื้อทั้งหมด",
    confirmed: "ยอดที่ยืนยันแล้ว",
    delivered: "ยอดส่งสำเร็จ",
};

const DailySalesChart: React.FC<DailySalesChartProps> = ({
    data,
    details,
    loading = false,
    groupBy,
    onGroupByChange,
    statusFilter,
    onStatusFilterChange,
}) => {
    const [isStatusOpen, setIsStatusOpen] = useState(false);

    // Chart configuration
    const chartOptions: ApexCharts.ApexOptions = {
        chart: {
            type: "bar",
            stacked: true,
            toolbar: { show: false },
            zoom: { enabled: false },
            fontFamily: "'Inter', sans-serif",
        },
        plotOptions: {
            bar: {
                horizontal: false,
                columnWidth: "65%", // Slightly wider bars
                borderRadius: 4,     // More rounded
                borderRadiusApplication: 'end',
            },
        },
        colors: COLORS.slice(0, data?.series?.length || 1),
        xaxis: {
            categories: data?.days || [],
            labels: {
                style: { fontSize: "11px", fontWeight: 500, colors: "#64748B" },
            },
            title: {
                text: "วันที่",
                style: { fontSize: "12px", fontWeight: 600, color: "#64748B" },
            },
            axisBorder: { show: false },
            axisTicks: { show: false },
        },
        yaxis: {
            title: {
                text: "ยอดขาย (บาท)",
                style: { fontSize: "12px", fontWeight: 600, color: "#64748B" },
            },
            labels: {
                style: { colors: "#64748B", fontWeight: 500 },
                formatter: (val: number) =>
                    val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toFixed(0),
            },
        },
        legend: {
            position: "top",
            horizontalAlign: "left",
            fontSize: "13px",
            fontWeight: 500,
            offsetY: 0,
            markers: {
                size: 8,
                shape: "circle",
            },
            itemMargin: {
                horizontal: 10,
                vertical: 5,
            },
        },
        dataLabels: {
            enabled: false,
        },
        tooltip: {
            theme: "light",
            y: {
                formatter: (val: number) =>
                    `฿${val.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`,
            },
            style: {
                fontSize: "12px",
            },
        },
        grid: {
            borderColor: "#F1F5F9",
            strokeDashArray: 4,
            yaxis: {
                lines: { show: true },
            },
            xaxis: {
                lines: { show: false },
            },
        },
        noData: {
            text: loading ? " " : "ไม่มีข้อมูล",
            align: "center",
            verticalAlign: "middle",
            style: {
                color: "#94A3B8",
                fontSize: "14px",
            },
        },
    };

    const series = data?.series || [];

    return (
        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 mb-6 overflow-visible transition-shadow hover:shadow-lg">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <span className="bg-blue-100 text-blue-600 p-1.5 rounded-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"></line><line x1="18" y1="20" x2="18" y2="4"></line><line x1="6" y1="20" x2="6" y2="16"></line></svg>
                        </span>
                        ยอดขายรายวัน
                    </h3>
                    <p className="text-sm text-gray-500 mt-1 ml-10">
                        แสดงข้อมูลยอดขายแยกตามวันที่ โดยสามารถกรองตามหมวดหมู่และสถานะได้
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {/* Status Filter Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setIsStatusOpen(!isStatusOpen)}
                            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 w-full md:w-auto justify-between"
                        >
                            <div className="flex items-center gap-2">
                                <Filter size={16} className={statusFilter === 'all' ? 'text-gray-400' : 'text-blue-500'} />
                                <span>{statusLabels[statusFilter]}</span>
                            </div>
                            <ChevronDown size={16} className={`text-gray-400 transition-transform ${isStatusOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isStatusOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setIsStatusOpen(false)}></div>
                                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-100 z-20 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                    <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                        กรองตามสถานะออเดอร์
                                    </div>
                                    {(['all', 'confirmed', 'delivered'] as const).map((status) => (
                                        <button
                                            key={status}
                                            onClick={() => {
                                                onStatusFilterChange(status);
                                                setIsStatusOpen(false);
                                            }}
                                            className={`flex w-full items-center px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors ${statusFilter === status
                                                    ? 'bg-blue-50 text-blue-700 font-medium'
                                                    : 'text-gray-700'
                                                }`}
                                        >
                                            <span className={`w-2 h-2 rounded-full mr-3 ${status === 'all' ? 'bg-gray-400' :
                                                    status === 'confirmed' ? 'bg-orange-500' : 'bg-green-500'
                                                }`}></span>
                                            {statusLabels[status]}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Group By Toggle Buttons */}
                    <div className="flex bg-gray-100 p-1 rounded-lg w-full md:w-auto">
                        {(["role", "page", "seller"] as const).map((type) => (
                            <button
                                key={type}
                                onClick={() => onGroupByChange(type)}
                                className={`flex-1 md:flex-none px-4 py-1.5 text-sm rounded-md transition-all duration-200 ${groupBy === type
                                        ? "bg-white text-blue-600 shadow-sm font-semibold ring-1 ring-black/5"
                                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/50"
                                    }`}
                            >
                                {groupByLabels[type]}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Chart */}
            <div className="w-full relative" style={{ minHeight: 380 }}>
                {loading && (
                    <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[1px] flex items-center justify-center rounded-lg transition-opacity duration-300">
                        <Spinner />
                    </div>
                )}
                <ReactApexChart
                    options={chartOptions}
                    series={series}
                    type="bar"
                    height={380}
                    width="100%"
                />
            </div>

            {/* Data Table */}
            <div className="mt-8 overflow-hidden rounded-xl border border-gray-200 shadow-sm">
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <h4 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                        <span className="text-gray-400">#</span>
                        ตารางข้อมูลละเอียด
                    </h4>
                    <span className="text-xs font-medium text-gray-500 bg-white px-2 py-1 rounded border border-gray-200">
                        {details.length} รายการ
                    </span>
                </div>

                <div className="overflow-x-auto relative">
                    {loading && details.length === 0 ? (
                        <div className="py-12 flex justify-center text-gray-400">
                            กำลังโหลดข้อมูล...
                        </div>
                    ) : details.length > 0 ? (
                        <table className="w-full text-sm">
                            <thead className="bg-white text-gray-600 border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-3 text-left font-semibold sticky left-0 bg-white z-10 min-w-[180px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                        {groupBy === "role"
                                            ? "แผนก"
                                            : groupBy === "page"
                                                ? "เพจ"
                                                : "ผู้ขาย"}
                                    </th>
                                    {data?.days.map((day) => (
                                        <th
                                            key={day}
                                            className="px-2 py-3 text-right font-medium text-xs text-gray-500 min-w-[50px]"
                                        >
                                            {parseInt(day)}
                                        </th>
                                    ))}
                                    <th className="px-4 py-3 text-right font-semibold bg-gray-50 text-gray-800 min-w-[110px]">
                                        รวม
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {details.map((row, idx) => (
                                    <tr key={row.id} className={`hover:bg-blue-50/30 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                                        <td className="px-4 py-3 font-medium text-gray-700 sticky left-0 bg-inherit z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] border-r border-transparent">
                                            <div className="truncate max-w-[160px]" title={row.name}>
                                                {row.name || "ไม่ระบุ"}
                                            </div>
                                        </td>
                                        {data?.days.map((day) => {
                                            const value = row.dailySales[day] || 0;
                                            return (
                                                <td key={day} className={`px-2 py-3 text-right ${value > 0 ? 'text-gray-700' : 'text-gray-300'}`}>
                                                    {value > 0
                                                        ? value.toLocaleString("th-TH", { maximumFractionDigits: 0 })
                                                        : "-"}
                                                </td>
                                            );
                                        })}
                                        <td className="px-4 py-3 text-right font-bold text-blue-600 bg-gray-50/50">
                                            {row.total.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                ))}
                                {/* Total Row */}
                                <tr className="bg-blue-50 font-bold border-t border-blue-100 text-blue-900">
                                    <td className="px-4 py-3 sticky left-0 bg-blue-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">รวมทั้งหมด</td>
                                    {data?.days.map((day) => {
                                        const dayTotal = details.reduce(
                                            (sum, row) => sum + (row.dailySales[day] || 0),
                                            0
                                        );
                                        return (
                                            <td key={day} className="px-2 py-3 text-right text-xs">
                                                {dayTotal > 0
                                                    ? dayTotal.toLocaleString("th-TH", { maximumFractionDigits: 0 })
                                                    : "-"}
                                            </td>
                                        );
                                    })}
                                    <td className="px-4 py-3 text-right text-blue-700 text-base">
                                        {details
                                            .reduce((sum, row) => sum + row.total, 0)
                                            .toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    ) : (
                        <div className="py-12 text-center">
                            <div className="inline-block p-4 rounded-full bg-gray-50 mb-3">
                                <Filter className="w-8 h-8 text-gray-300" />
                            </div>
                            <p className="text-gray-500 font-medium">ไม่พบข้อมูลในช่วงเวลาและเงื่อนไขที่เลือก</p>
                            <p className="text-gray-400 text-sm mt-1">ลองเปลี่ยนตัวกรองหรือเลือกช่วงเวลาอื่น</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DailySalesChart;
