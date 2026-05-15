import React, { useEffect, useMemo, useState, useCallback } from "react";
import ReactApexChart from "react-apexcharts";
import {
    Users as UsersIcon,
    PhoneCall,
    ShoppingCart,
    RefreshCw,
    TrendingUp,
    ChevronDown,
    ChevronUp,
    DollarSign,
} from "lucide-react";
import resolveApiBasePath from "@/utils/apiBasePath";
import { User } from "@/types";

interface TeamTotals {
    distributed: number;
    called: number;
    closed: number;
    sales: number;
    call_rate: number;
    close_rate: number;
    call_close: number;
}

interface MemberRow {
    user_id: number;
    name: string;
    first_name: string;
    last_name: string;
    role: string;
    distributed: number;
    called: number;
    closed: number;
    sales: number;
    call_rate: number;
    close_rate: number;
    call_close: number;
}

interface LeadPerformanceData {
    period: { year: number; month: number; start: string; end: string };
    team_totals: TeamTotals;
    members: MemberRow[];
}

type SortField = "name" | "distributed" | "called" | "closed" | "sales" | "close_rate";

const THAI_MONTHS = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

const KpiCard: React.FC<{
    title: string;
    value: React.ReactNode;
    subtext?: string;
    icon: React.ComponentType<{ className?: string }>;
    color?: string;
}> = ({ title, value, subtext, icon: Icon, color = "bg-green-50 text-green-600" }) => (
    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-start justify-between">
            <div>
                <p className="text-sm text-gray-500">{title}</p>
                <div className="text-2xl sm:text-3xl font-bold text-gray-800 leading-tight mt-1">{value}</div>
                {subtext && <p className="text-xs text-gray-500 mt-2">{subtext}</p>}
            </div>
            <div className={`p-2 rounded-lg ${color}`}>
                <Icon className="w-6 h-6" />
            </div>
        </div>
    </div>
);

interface Props {
    user: User;
}

const LeadPerformancePage: React.FC<Props> = ({ user }) => {
    const apiBase = useMemo(() => resolveApiBasePath(), []);
    const now = new Date();
    const [year, setYear] = useState<number>(now.getFullYear());
    const [month, setMonth] = useState<number>(now.getMonth() + 1);
    const [data, setData] = useState<LeadPerformanceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sortField, setSortField] = useState<SortField>("closed");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem("authToken");
            const res = await fetch(
                `${apiBase}/Monitor/lead_performance.php?year=${year}&month=${month}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                },
            );
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json?.message || `HTTP ${res.status}`);
            setData(json.data);
        } catch (e: any) {
            setError(e?.message || "โหลดข้อมูลไม่สำเร็จ");
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [apiBase, year, month]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const totals = data?.team_totals;

    // Funnel chart — horizontal bar visualizing drop-off
    const funnelChart = useMemo(() => {
        if (!totals) return null;
        const series = [
            {
                name: "จำนวน",
                data: [totals.distributed, totals.called, totals.closed],
            },
        ];
        const options: any = {
            chart: { type: "bar", toolbar: { show: false }, fontFamily: "inherit" },
            plotOptions: {
                bar: {
                    horizontal: true,
                    barHeight: "60%",
                    distributed: true,
                    borderRadius: 4,
                },
            },
            colors: ["#3B82F6", "#10B981", "#F59E0B"],
            dataLabels: {
                enabled: true,
                formatter: (val: number, opts: any) => {
                    const labels = ["แจกให้", "ได้คุย", "ปิดบิล"];
                    const dist = totals.distributed || 1;
                    const pct = Math.round((val / dist) * 100);
                    return `${labels[opts.dataPointIndex]} • ${val.toLocaleString()} (${pct}%)`;
                },
                style: { colors: ["#fff"], fontSize: "13px", fontWeight: 600 },
            },
            xaxis: { categories: ["แจกให้", "ได้คุย", "ปิดบิล"], labels: { show: false } },
            yaxis: { labels: { show: false } },
            grid: { show: false },
            legend: { show: false },
            tooltip: { y: { formatter: (v: number) => `${v.toLocaleString()} ลูกค้า` } },
        };
        return { options, series };
    }, [totals]);

    const sortedMembers = useMemo(() => {
        if (!data) return [];
        const arr = [...data.members];
        arr.sort((a, b) => {
            if (sortField === "name") {
                return sortDir === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
            }
            const av = (a as any)[sortField] as number;
            const bv = (b as any)[sortField] as number;
            return sortDir === "asc" ? av - bv : bv - av;
        });
        return arr;
    }, [data, sortField, sortDir]);

    const toggleSort = (f: SortField) => {
        if (sortField === f) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else {
            setSortField(f);
            setSortDir("desc");
        }
    };

    const SortIcon: React.FC<{ field: SortField }> = ({ field }) => {
        if (sortField !== field) return <ChevronDown className="w-3 h-3 inline opacity-30" />;
        return sortDir === "desc" ? (
            <ChevronDown className="w-3 h-3 inline text-green-600" />
        ) : (
            <ChevronUp className="w-3 h-3 inline text-green-600" />
        );
    };

    const fmtNum = (n: number) => n.toLocaleString("th-TH");
    const fmtMoney = (n: number) =>
        `฿${Math.round(n).toLocaleString("th-TH")}`;
    const fmtPct = (r: number) => `${(r * 100).toFixed(1)}%`;

    const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

    return (
        <div className="p-4 sm:p-6 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <TrendingUp className="w-6 h-6 text-green-600" />
                        Lead Performance — อัตราการปิดการขาย
                    </h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Funnel ลูกค้า: แจกให้ทีม → โทรได้คุย → ปิดบิล
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <select
                        value={month}
                        onChange={(e) => setMonth(parseInt(e.target.value, 10))}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                        {THAI_MONTHS.slice(1).map((m, i) => (
                            <option key={i + 1} value={i + 1}>
                                {m}
                            </option>
                        ))}
                    </select>
                    <select
                        value={year}
                        onChange={(e) => setYear(parseInt(e.target.value, 10))}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                        {years.map((y) => (
                            <option key={y} value={y}>
                                {y}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                        รีเฟรช
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                    {error}
                </div>
            )}

            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
                <KpiCard
                    title="แจกให้ทีม"
                    value={totals ? fmtNum(totals.distributed) : "—"}
                    subtext="ลูกค้า unique ที่ได้รับเดือนนี้"
                    icon={UsersIcon}
                    color="bg-blue-50 text-blue-600"
                />
                <KpiCard
                    title="โทรได้คุย"
                    value={totals ? fmtNum(totals.called) : "—"}
                    subtext={totals ? `${fmtPct(totals.call_rate)} ของที่แจก` : ""}
                    icon={PhoneCall}
                    color="bg-green-50 text-green-600"
                />
                <KpiCard
                    title="ปิดบิล (ลูกค้า)"
                    value={totals ? fmtNum(totals.closed) : "—"}
                    subtext={totals ? `${fmtPct(totals.close_rate)} ของที่แจก / ${fmtPct(totals.call_close)} ของที่คุย` : ""}
                    icon={ShoppingCart}
                    color="bg-amber-50 text-amber-600"
                />
                <KpiCard
                    title="ยอดขายรวม"
                    value={totals ? fmtMoney(totals.sales) : "—"}
                    subtext="รวมทีมในเดือนที่เลือก"
                    icon={DollarSign}
                    color="bg-purple-50 text-purple-600"
                />
            </div>

            {/* Funnel chart */}
            <div className="bg-white p-4 sm:p-5 rounded-lg shadow-sm border border-gray-200 mb-5">
                <h3 className="text-md font-semibold text-gray-800 mb-2">Conversion Funnel</h3>
                {funnelChart ? (
                    <ReactApexChart
                        options={funnelChart.options}
                        series={funnelChart.series}
                        type="bar"
                        height={240}
                    />
                ) : (
                    <div className="h-[240px] flex items-center justify-center text-gray-400 text-sm">
                        {loading ? "กำลังโหลด..." : "ไม่มีข้อมูล"}
                    </div>
                )}
            </div>

            {/* Per-member table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-md font-semibold text-gray-800 flex items-center gap-2">
                        <UsersIcon className="w-4 h-4 text-gray-500" />
                        รายละเอียดรายคน
                        {data && (
                            <span className="text-xs font-normal text-gray-500">
                                ({data.members.length} คน)
                            </span>
                        )}
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-600">
                            <tr>
                                <th
                                    onClick={() => toggleSort("name")}
                                    className="px-3 py-2 text-left font-medium cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                                >
                                    ชื่อ <SortIcon field="name" />
                                </th>
                                <th
                                    onClick={() => toggleSort("distributed")}
                                    className="px-3 py-2 text-right font-medium cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                                >
                                    แจกให้ <SortIcon field="distributed" />
                                </th>
                                <th
                                    onClick={() => toggleSort("called")}
                                    className="px-3 py-2 text-right font-medium cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                                >
                                    ได้คุย <SortIcon field="called" />
                                </th>
                                <th
                                    onClick={() => toggleSort("closed")}
                                    className="px-3 py-2 text-right font-medium cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                                >
                                    ปิดบิล <SortIcon field="closed" />
                                </th>
                                <th
                                    onClick={() => toggleSort("sales")}
                                    className="px-3 py-2 text-right font-medium cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                                >
                                    ยอดขาย <SortIcon field="sales" />
                                </th>
                                <th
                                    onClick={() => toggleSort("close_rate")}
                                    className="px-3 py-2 text-right font-medium cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                                >
                                    ปิด% <SortIcon field="close_rate" />
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-3 py-10 text-center text-gray-400">
                                        กำลังโหลด...
                                    </td>
                                </tr>
                            ) : sortedMembers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-3 py-10 text-center text-gray-400">
                                        ไม่มีข้อมูล
                                    </td>
                                </tr>
                            ) : (
                                sortedMembers.map((m) => {
                                    const closePct = Math.round(m.close_rate * 1000) / 10;
                                    const barColor =
                                        closePct >= 5 ? "bg-green-500" : closePct >= 2 ? "bg-amber-500" : "bg-red-500";
                                    return (
                                        <tr key={m.user_id} className="border-t border-gray-100 hover:bg-gray-50">
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">
                                                        {(m.first_name || "?").charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-gray-800 text-sm">
                                                            {m.name || "—"}
                                                        </div>
                                                        <div className="text-[11px] text-gray-400">{m.role}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-right tabular-nums">{fmtNum(m.distributed)}</td>
                                            <td className="px-3 py-2 text-right tabular-nums text-green-700 font-semibold">
                                                {fmtNum(m.called)}
                                            </td>
                                            <td className="px-3 py-2 text-right tabular-nums text-amber-700 font-semibold">
                                                {fmtNum(m.closed)}
                                            </td>
                                            <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                                                {m.sales > 0 ? fmtMoney(m.sales) : "—"}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                <div className="flex items-center gap-2 justify-end">
                                                    <div className="flex-1 max-w-[80px] h-2 bg-gray-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full ${barColor}`}
                                                            style={{ width: `${Math.min(100, closePct * 5)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs font-semibold tabular-nums w-12 text-right">
                                                        {closePct.toFixed(1)}%
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default LeadPerformancePage;
