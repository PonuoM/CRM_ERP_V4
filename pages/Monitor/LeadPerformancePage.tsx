import React, { useEffect, useMemo, useState, useCallback } from "react";
import ReactApexChart from "react-apexcharts";
import {
    Users as UsersIcon,
    PhoneCall,
    ShoppingCart,
    RefreshCw,
    TrendingUp,
    DollarSign,
} from "lucide-react";
import resolveApiBasePath from "@/utils/apiBasePath";
import { User } from "@/types";
import {
    KpiRowSkeleton,
    ChartSkeleton,
    Skeleton,
} from "@/components/Monitor/Skeleton";
import MemberCard, { CardStatus, BulletItem } from "@/components/Monitor/MemberCard";
import TeamInsights, { InsightItem } from "@/components/Monitor/TeamInsights";

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


const THAI_MONTHS = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

const fmtNum = (n: number) => n.toLocaleString("th-TH");
const fmtMoney = (n: number) => `฿${Math.round(n).toLocaleString("th-TH")}`;
const fmtPct = (r: number) => `${(r * 100).toFixed(1)}%`;

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

    // Cards sorted by closed desc (top performers first)
    const cardMembers = useMemo(() => {
        if (!data) return [];
        return [...data.members].sort((a, b) => b.closed - a.closed);
    }, [data]);

    // Insights derived from team data
    const insights = useMemo<InsightItem[]>(() => {
        if (!data || data.members.length === 0) return [];
        const items: InsightItem[] = [];
        const t = data.team_totals;
        const members = data.members;

        // Team funnel summary
        items.push({
            tone: t.close_rate >= 0.02 ? "good" : t.close_rate >= 0.005 ? "info" : "warn",
            text: (
                <>
                    เดือนนี้แจก <b>{t.distributed.toLocaleString()}</b> ลูกค้า → คุย{" "}
                    <b>{t.called.toLocaleString()}</b> ({fmtPct(t.call_rate)}) → ปิดบิล{" "}
                    <b>{t.closed.toLocaleString()}</b> ({fmtPct(t.close_rate)}) — ยอดรวม{" "}
                    <b>{fmtMoney(t.sales)}</b>
                </>
            ),
        });

        // Top closer
        const top = [...members].filter((m) => m.distributed > 0).sort((a, b) => b.close_rate - a.close_rate)[0];
        if (top && top.closed > 0) {
            items.push({
                tone: "highlight",
                text: (
                    <>
                        <b>Top closer:</b> <b className="text-yellow-700">{top.name}</b> ปิด{" "}
                        <b>{top.closed}</b> ลูกค้า ({fmtPct(top.close_rate)} ของที่แจก) — ยอด{" "}
                        <b>{fmtMoney(top.sales)}</b>
                    </>
                ),
            });
        }

        // Untouched leads
        const untouchedTotal = members.reduce(
            (s, m) => s + Math.max(0, m.distributed - m.called),
            0,
        );
        if (untouchedTotal > 0 && t.distributed > 0) {
            const pct = Math.round((untouchedTotal / t.distributed) * 100);
            items.push({
                tone: pct > 50 ? "bad" : "warn",
                text: (
                    <>
                        มีลูกค้า <b>{untouchedTotal.toLocaleString()}</b> รายที่แจกแล้วยังไม่ได้คุย
                        (<b>{pct}%</b> ของที่แจก) — เสี่ยงหลุดเพราะ follow ไม่ทัน
                    </>
                ),
            });
        }

        // Low performers: distributed > 50 but close_rate < team_close_rate * 0.5
        const teamRate = t.close_rate;
        const low = members
            .filter((m) => m.distributed >= 50 && m.close_rate < teamRate * 0.5)
            .sort((a, b) => a.close_rate - b.close_rate)
            .slice(0, 3);
        if (low.length > 0 && teamRate > 0) {
            items.push({
                tone: "bad",
                text: (
                    <>
                        <b>ปิดน้อยกว่าค่าเฉลี่ยทีมครึ่งหนึ่ง:</b>{" "}
                        {low.map((m, i) => (
                            <span key={m.user_id}>
                                {i > 0 && ", "}
                                <b>{m.name}</b> ({fmtPct(m.close_rate)})
                            </span>
                        ))}{" "}
                        — ควรดูคุณภาพการโทร
                    </>
                ),
            });
        }

        // Sales leader
        const salesTop = [...members].sort((a, b) => b.sales - a.sales)[0];
        if (salesTop && salesTop.sales > 0 && salesTop.user_id !== top?.user_id) {
            items.push({
                tone: "good",
                text: (
                    <>
                        <b>ยอดขายสูงสุด:</b> <b className="text-green-700">{salesTop.name}</b> ทำได้{" "}
                        <b>{fmtMoney(salesTop.sales)}</b>
                    </>
                ),
            });
        }

        return items;
    }, [data]);

    // Status from close_rate vs team avg
    const statusFromCloseRate = (closeRate: number, distributed: number, teamAvg: number): CardStatus => {
        if (distributed === 0) return "idle";
        if (teamAvg === 0) return "idle";
        if (closeRate >= teamAvg * 1.5) return "great";
        if (closeRate >= teamAvg) return "good";
        if (closeRate >= teamAvg * 0.5) return "warn";
        return "bad";
    };


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

            {/* Insights */}
            {!loading && insights.length > 0 && <TeamInsights items={insights} />}

            {/* KPI cards */}
            {loading ? (
                <KpiRowSkeleton count={4} />
            ) : (
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
            )}

            {/* Funnel chart */}
            {loading ? (
                <ChartSkeleton height={240} title="Conversion Funnel" />
            ) : (
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
                            ไม่มีข้อมูล
                        </div>
                    )}
                </div>
            )}

            {/* Member cards (grid) */}
            <div className="mb-2 flex items-center gap-2">
                <UsersIcon className="w-4 h-4 text-gray-500" />
                <h3 className="text-md font-semibold text-gray-800">
                    KPI รายคน
                    {data && (
                        <span className="text-xs font-normal text-gray-500 ml-2">
                            ({data.members.length} คน — เรียงตามปิดบิลมากสุด)
                        </span>
                    )}
                </h3>
            </div>
            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
                            <div className="flex items-center gap-3">
                                <Skeleton className="w-10 h-10 rounded-full" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-3 w-24" />
                                    <Skeleton className="h-2.5 w-16" />
                                </div>
                            </div>
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-3 w-5/6" />
                            <Skeleton className="h-3 w-2/3" />
                            <Skeleton className="h-2 w-full mt-2" />
                        </div>
                    ))}
                </div>
            ) : cardMembers.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-10 text-center text-gray-400">
                    ไม่มีข้อมูล
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {cardMembers.map((m, idx) => {
                        const teamAvg = data?.team_totals.close_rate ?? 0;
                        const status = statusFromCloseRate(m.close_rate, m.distributed, teamAvg);
                        const pct = m.close_rate * 100;
                        const bullets: BulletItem[] = [
                            {
                                icon: <UsersIcon className="w-3.5 h-3.5 text-blue-500" />,
                                label: "แจกให้",
                                value: fmtNum(m.distributed),
                            },
                            {
                                icon: <PhoneCall className="w-3.5 h-3.5 text-green-500" />,
                                label: "โทรได้คุย",
                                value: fmtNum(m.called),
                                hint: `${fmtPct(m.call_rate)}`,
                            },
                            {
                                icon: <ShoppingCart className="w-3.5 h-3.5 text-amber-500" />,
                                label: "ปิดบิล",
                                value: fmtNum(m.closed),
                                hint: fmtPct(m.close_rate),
                                emphasize: true,
                            },
                            {
                                icon: <DollarSign className="w-3.5 h-3.5 text-purple-500" />,
                                label: "ยอดขาย",
                                value: m.sales > 0 ? fmtMoney(m.sales) : "—",
                            },
                        ];
                        return (
                            <MemberCard
                                key={m.user_id}
                                name={m.name}
                                role={m.role}
                                initial={(m.first_name || "?").charAt(0)}
                                status={status}
                                bullets={bullets}
                                progressPercent={Math.min(100, pct * 10)}
                                progressLabel={`Close rate ${pct.toFixed(2)}%`}
                                badge={
                                    idx === 0 && m.closed > 0 ? (
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">
                                            ⭐ TOP
                                        </span>
                                    ) : undefined
                                }
                            />
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default LeadPerformancePage;
