import React, { useEffect, useMemo, useState, useCallback } from "react";
import ReactApexChart from "react-apexcharts";
import {
    Phone,
    PhoneCall,
    Clock,
    Target,
    RefreshCw,
    Settings as SettingsIcon,
    Users as UsersIcon,
    Sun,
} from "lucide-react";
import resolveApiBasePath from "@/utils/apiBasePath";
import { User } from "@/types";
import {
    fetchOneCallRecordings,
    aggregateOneCallByUsers,
    isToday,
} from "@/services/onecallRealtime";
import {
    KpiRowSkeleton,
    ChartSkeleton,
    Skeleton,
} from "@/components/Monitor/Skeleton";
import MemberCard, { CardStatus, BulletItem } from "@/components/Monitor/MemberCard";
import TeamInsights, { InsightItem } from "@/components/Monitor/TeamInsights";

interface TeamTotals {
    total_calls: number;
    connected_calls: number;
    talked_calls: number;
    total_minutes: number;
    talk_rate: number;
    answer_rate: number;
    active_users: number;
}

interface HourlyRow {
    hour: number;
    label: string;
    period: "morning" | "afternoon";
    total_calls: number;
    talked_calls: number;
}

interface MemberRow {
    user_id: number;
    name: string;
    first_name: string;
    last_name: string;
    phone: string;
    role: string;
    total_calls: number;
    connected_calls: number;
    talked_calls: number;
    total_minutes: number;
    morning_calls: number;
    afternoon_calls: number;
    target_progress: number;
}

interface MonitorData {
    date: string;
    target_per_day: number;
    team_totals: TeamTotals;
    hourly: HourlyRow[];
    members: MemberRow[];
    viewer: {
        user_id: number;
        role: string;
        is_supervisor: boolean;
        is_admin: boolean;
    };
}


interface Props {
    user: User;
}

const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const formatMinutes = (m: number) => {
    if (!m) return "0:00";
    const total = Math.round(m * 60);
    const hh = Math.floor(total / 3600);
    const mm = Math.floor((total % 3600) / 60);
    const ss = total % 60;
    return hh > 0
        ? `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`
        : `${mm}:${String(ss).padStart(2, "0")}`;
};

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
                <div className="text-3xl font-bold text-gray-800 leading-tight mt-1">{value}</div>
                {subtext && <p className="text-xs text-gray-500 mt-2">{subtext}</p>}
            </div>
            <div className={`p-2 rounded-lg ${color}`}>
                <Icon className="w-6 h-6" />
            </div>
        </div>
    </div>
);

const SettingsModal: React.FC<{
    initial: number;
    onClose: () => void;
    onSave: (newTarget: number) => Promise<void>;
}> = ({ initial, onClose, onSave }) => {
    const [val, setVal] = useState(String(initial));
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const handleSave = async () => {
        const num = parseInt(val, 10);
        if (Number.isNaN(num) || num < 1 || num > 500) {
            setErr("กรุณาใส่จำนวนระหว่าง 1-500");
            return;
        }
        setSaving(true);
        setErr(null);
        try {
            await onSave(num);
            onClose();
        } catch (e: any) {
            setErr(e?.message || "บันทึกไม่สำเร็จ");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                <h2 className="text-lg font-bold text-gray-800 mb-1">ตั้งค่าเป้าหมายการคุย</h2>
                <p className="text-sm text-gray-500 mb-4">
                    กำหนดจำนวน "สายที่ได้คุย" ต่อวันที่เป็นเป้าของแต่ละพนักงาน
                </p>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    จำนวนสายที่ได้คุย/วัน
                </label>
                <input
                    type="number"
                    value={val}
                    onChange={(e) => setVal(e.target.value)}
                    min={1}
                    max={500}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
                <div className="mt-6 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-50"
                    >
                        ยกเลิก
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-50"
                    >
                        {saving ? "กำลังบันทึก..." : "บันทึก"}
                    </button>
                </div>
            </div>
        </div>
    );
};

const DailyMonitoringPage: React.FC<Props> = ({ user }) => {
    const apiBase = useMemo(() => resolveApiBasePath(), []);
    const [date, setDate] = useState<string>(todayISO);
    const [data, setData] = useState<MonitorData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [dataSource, setDataSource] = useState<"db" | "realtime">("db");
    const [refreshingRealtime, setRefreshingRealtime] = useState(false);

    const canEditSettings = useMemo(() => {
        const r = (user.role || "").toLowerCase();
        return (
            r.includes("admin") ||
            r.includes("supervisor") ||
            r.includes("ceo") ||
            r.includes("super")
        );
    }, [user]);

    const overlayRealtime = useCallback(
        async (baseData: MonitorData) => {
            setRefreshingRealtime(true);
            try {
                const rt = await fetchOneCallRecordings(baseData.date);
                if (!rt.success || !rt.recordings) {
                    if (rt.error) setError(`OneCall realtime: ${rt.error} (แสดงข้อมูลจาก DB)`);
                    return;
                }
                const users = baseData.members.map((m) => ({
                    user_id: m.user_id,
                    phone: m.phone,
                }));
                const agg = aggregateOneCallByUsers(rt.recordings, users);
                const target = baseData.target_per_day || 40;
                const mergedMembers = baseData.members.map((m) => {
                    const acc = agg.members[m.user_id];
                    const talked = acc?.talked_calls ?? 0;
                    return {
                        ...m,
                        total_calls: acc?.total_calls ?? 0,
                        connected_calls: acc?.connected_calls ?? 0,
                        talked_calls: talked,
                        total_minutes: acc ? Math.round((acc.total_seconds / 60) * 10) / 10 : 0,
                        morning_calls: acc?.morning_calls ?? 0,
                        afternoon_calls: acc?.afternoon_calls ?? 0,
                        target_progress:
                            target > 0 ? Math.round((talked / target) * 1000) / 1000 : 0,
                    };
                });
                setData({
                    ...baseData,
                    team_totals: agg.team_totals,
                    hourly: agg.hourly,
                    members: mergedMembers,
                });
            } catch (rtErr: any) {
                setError(`OneCall realtime ผิดพลาด: ${rtErr?.message || ""} — แสดงข้อมูลจาก DB แทน`);
            } finally {
                setRefreshingRealtime(false);
            }
        },
        [],
    );

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem("authToken");
            const res = await fetch(`${apiBase}/Monitor/daily_monitoring.php?date=${date}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });
            const json = await res.json();
            if (!res.ok || !json.success) {
                throw new Error(json?.message || `HTTP ${res.status}`);
            }
            const dbData: MonitorData = json.data;

            // Render DB data immediately so the page is interactive within ~200ms,
            // then upgrade to realtime in the background when looking at today.
            setData(dbData);
            setLoading(false);

            if (isToday(date)) {
                setDataSource("realtime");
                // Fire and forget; setData inside will trigger re-render
                overlayRealtime(dbData);
            } else {
                setDataSource("db");
            }
        } catch (e: any) {
            setError(e?.message || "โหลดข้อมูลไม่สำเร็จ");
            setData(null);
            setLoading(false);
        }
    }, [apiBase, date, overlayRealtime]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSaveTarget = async (newTarget: number) => {
        const token = localStorage.getItem("authToken");
        const res = await fetch(`${apiBase}/Monitor/settings.php`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ daily_call_target: newTarget }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json?.message || `HTTP ${res.status}`);
        await fetchData();
    };

    // Chart data
    const chartConfig = useMemo(() => {
        if (!data) return null;
        const labels = data.hourly.map((h) => h.label);
        const series = [
            {
                name: "ได้คุย",
                data: data.hourly.map((h) => h.talked_calls),
            },
            {
                name: "ไม่ได้คุย",
                data: data.hourly.map((h) => Math.max(0, h.total_calls - h.talked_calls)),
            },
        ];
        const options: any = {
            chart: {
                type: "bar",
                stacked: true,
                toolbar: { show: false },
                fontFamily: "inherit",
            },
            plotOptions: {
                bar: {
                    columnWidth: "60%",
                    borderRadius: 4,
                },
            },
            colors: ["#10B981", "#E5E7EB"],
            dataLabels: { enabled: false },
            xaxis: {
                categories: labels,
                labels: { style: { fontSize: "11px" } },
            },
            yaxis: {
                title: { text: "จำนวนสาย" },
            },
            grid: { borderColor: "#F3F4F6" },
            legend: { position: "top", horizontalAlign: "right" },
            tooltip: {
                shared: true,
                intersect: false,
                y: { formatter: (v: number) => `${v} สาย` },
            },
            annotations: {
                xaxis: [
                    {
                        x: "12:00",
                        borderColor: "#9CA3AF",
                        strokeDashArray: 4,
                        label: {
                            text: "เที่ยง",
                            style: { color: "#fff", background: "#9CA3AF", fontSize: "10px" },
                        },
                    },
                ],
            },
        };
        return { options, series };
    }, [data]);

    const totals = data?.team_totals;
    const target = data?.target_per_day || 40;
    // While realtime is being fetched for today, treat KPI/chart/table as loading
    // because the DB numbers (which we already rendered) are likely 0 for today.
    const isLoadingData = loading || (refreshingRealtime && isToday(date));

    // Sort cards by talked_calls desc (so top performers are first)
    const cardMembers = useMemo(() => {
        if (!data) return [];
        return [...data.members].sort((a, b) => b.talked_calls - a.talked_calls);
    }, [data]);

    // Derive team-level insights from the data
    const insights = useMemo<InsightItem[]>(() => {
        if (!data || data.members.length === 0) return [];
        const items: InsightItem[] = [];
        const members = data.members;
        const totalTalked = members.reduce((s, m) => s + m.talked_calls, 0);
        const totalTarget = members.length * target;
        const teamPct = totalTarget > 0 ? Math.round((totalTalked / totalTarget) * 100) : 0;

        // Team progress
        items.push({
            tone: teamPct >= 80 ? "good" : teamPct >= 50 ? "info" : "warn",
            text: (
                <>
                    ทีมทำได้ <b>{totalTalked.toLocaleString()}</b> สาย /
                    เป้ารวม <b>{totalTarget.toLocaleString()}</b> สาย —
                    <b className={teamPct >= 80 ? "text-green-700" : teamPct >= 50 ? "text-blue-700" : "text-amber-700"}>
                        {" "}{teamPct}%{" "}
                    </b>
                    ของเป้าทั้งทีม
                </>
            ),
        });

        // Top performer
        const top = [...members].sort((a, b) => b.talked_calls - a.talked_calls)[0];
        if (top && top.talked_calls > 0) {
            const pct = Math.round((top.talked_calls / target) * 100);
            items.push({
                tone: "highlight",
                text: (
                    <>
                        <b>Top performer:</b> <b className="text-yellow-700">{top.name}</b> ได้คุย{" "}
                        <b>{top.talked_calls}</b> สาย ({pct}% ของเป้า)
                    </>
                ),
            });
        }

        // Under-performers (< 60%)
        const under = members.filter((m) => m.target_progress < 0.6 && m.total_calls > 0)
            .sort((a, b) => a.target_progress - b.target_progress).slice(0, 3);
        if (under.length > 0) {
            items.push({
                tone: "bad",
                text: (
                    <>
                        <b>ต้องช่วย:</b>{" "}
                        {under.map((m, i) => (
                            <span key={m.user_id}>
                                {i > 0 && ", "}
                                <b>{m.name}</b> ({m.talked_calls}/{target})
                            </span>
                        ))}
                    </>
                ),
            });
        }

        // Idle people (no calls yet)
        const idle = members.filter((m) => m.total_calls === 0);
        if (idle.length > 0 && members.length > idle.length) {
            items.push({
                tone: "warn",
                text: (
                    <>
                        <b>{idle.length} คน</b>ยังไม่ได้โทรเลย:{" "}
                        {idle.slice(0, 5).map((m, i) => (
                            <span key={m.user_id}>
                                {i > 0 && ", "}
                                {m.name}
                            </span>
                        ))}
                        {idle.length > 5 && ` และอีก ${idle.length - 5} คน`}
                    </>
                ),
            });
        }

        // Time-of-day pattern (compare morning vs afternoon team-wide)
        if (data.hourly && data.hourly.length > 0) {
            const morningTalked = data.hourly
                .filter((h) => h.period === "morning")
                .reduce((s, h) => s + h.talked_calls, 0);
            const afternoonTalked = data.hourly
                .filter((h) => h.period === "afternoon")
                .reduce((s, h) => s + h.talked_calls, 0);
            if (morningTalked + afternoonTalked > 20) {
                const ratio = afternoonTalked / Math.max(1, morningTalked);
                if (ratio > 1.4) {
                    items.push({
                        tone: "info",
                        text: (
                            <>
                                ช่วงบ่ายปั่นได้มากกว่าเช้า{" "}
                                <b>{Math.round((ratio - 1) * 100)}%</b> (เช้า {morningTalked} / บ่าย {afternoonTalked})
                            </>
                        ),
                    });
                } else if (ratio < 0.7) {
                    items.push({
                        tone: "info",
                        text: (
                            <>
                                ช่วงเช้าปั่นเก่งกว่าบ่าย — บ่ายตกลง <b>{Math.round((1 - ratio) * 100)}%</b>
                            </>
                        ),
                    });
                }
            }
        }

        return items;
    }, [data, target]);

    // Helper: map progress → CardStatus
    const statusFromProgress = (pct: number, totalCalls: number): CardStatus => {
        if (totalCalls === 0) return "idle";
        if (pct >= 1.0) return "great";
        if (pct >= 0.8) return "good";
        if (pct >= 0.5) return "warn";
        return "bad";
    };

    return (
        <div className="p-4 sm:p-6 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <PhoneCall className="w-6 h-6 text-green-600" />
                        ติดตามทีม — รายวัน
                        {dataSource === "realtime" ? (
                            <span
                                className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${refreshingRealtime
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-green-100 text-green-700"
                                    }`}
                            >
                                <span
                                    className={`w-1.5 h-1.5 rounded-full ${refreshingRealtime ? "bg-amber-500 animate-pulse" : "bg-green-500 animate-pulse"
                                        }`}
                                />
                                {refreshingRealtime ? "กำลังอัพเดต Realtime..." : "Realtime"}
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                จาก DB
                            </span>
                        )}
                    </h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        สรุปการโทรของลูกทีมแบบรายวัน + แยกช่วงเช้า/บ่าย
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        max={todayISO()}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <button
                        onClick={fetchData}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                        รีเฟรช
                    </button>
                    {canEditSettings && (
                        <button
                            onClick={() => setShowSettings(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50"
                            title="ตั้งค่าเป้าหมายต่อวัน"
                        >
                            <SettingsIcon className="w-4 h-4" />
                            ตั้งค่า
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                    {error}
                </div>
            )}

            {/* Insights panel — derived from the data so user knows what to look at */}
            {!isLoadingData && insights.length > 0 && <TeamInsights items={insights} />}

            {/* KPI cards */}
            {isLoadingData ? (
                <KpiRowSkeleton count={4} />
            ) : (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
                    <KpiCard
                        title="สายโทรทั้งหมด"
                        value={totals ? totals.total_calls.toLocaleString() : "—"}
                        subtext={totals ? `${totals.active_users} คนทำงาน` : ""}
                        icon={Phone}
                        color="bg-blue-50 text-blue-600"
                    />
                    <KpiCard
                        title="สายที่ได้คุย"
                        value={totals ? totals.talked_calls.toLocaleString() : "—"}
                        subtext={totals ? `อัตราคุย ${Math.round(totals.talk_rate * 100)}%` : ""}
                        icon={PhoneCall}
                        color="bg-green-50 text-green-600"
                    />
                    <KpiCard
                        title="เวลาโทรรวม"
                        value={totals ? formatMinutes(totals.total_minutes) : "—"}
                        subtext={`รวมทีม (ชม:นาที:วินาที)`}
                        icon={Clock}
                        color="bg-purple-50 text-purple-600"
                    />
                    <KpiCard
                        title="เป้าหมายต่อคน"
                        value={`${target}`}
                        subtext="สายที่ได้คุย/วัน"
                        icon={Target}
                        color="bg-amber-50 text-amber-600"
                    />
                </div>
            )}

            {/* Hourly chart */}
            {isLoadingData ? (
                <ChartSkeleton height={300} title="จำนวนสายแยกตามชั่วโมง (08:00 – 18:00)" />
            ) : (
                <div className="bg-white p-4 sm:p-5 rounded-lg shadow-sm border border-gray-200 mb-5">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-md font-semibold text-gray-800">
                            จำนวนสายแยกตามชั่วโมง (08:00 – 18:00)
                        </h3>
                    </div>
                    {chartConfig ? (
                        <ReactApexChart
                            options={chartConfig.options}
                            series={chartConfig.series}
                            type="bar"
                            height={300}
                        />
                    ) : (
                        <div className="h-[300px] flex items-center justify-center text-gray-400 text-sm">
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
                            ({data.members.length} คน — เรียงตามผลงานวันนี้)
                        </span>
                    )}
                </h3>
            </div>
            {isLoadingData ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-5">
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
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-10 text-center text-gray-400 mb-5">
                    ไม่มีข้อมูล
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-5">
                    {cardMembers.map((m, idx) => {
                        const status = statusFromProgress(m.target_progress, m.total_calls);
                        const pct = m.target_progress * 100;
                        const bullets: BulletItem[] = [
                            {
                                icon: <Phone className="w-3.5 h-3.5 text-blue-500" />,
                                label: "โทรทั้งหมด",
                                value: m.total_calls.toLocaleString(),
                            },
                            {
                                icon: <PhoneCall className="w-3.5 h-3.5 text-green-500" />,
                                label: "ได้คุย",
                                value: m.talked_calls.toLocaleString(),
                                hint: `เป้า ${target}`,
                                emphasize: true,
                            },
                            {
                                icon: <Clock className="w-3.5 h-3.5 text-purple-500" />,
                                label: "เวลาโทรรวม",
                                value: formatMinutes(m.total_minutes),
                            },
                            {
                                icon: <Sun className="w-3.5 h-3.5 text-amber-500" />,
                                label: "เช้า / บ่าย",
                                value: (
                                    <span>
                                        {m.morning_calls}
                                        <span className="text-gray-300 mx-1">/</span>
                                        {m.afternoon_calls}
                                    </span>
                                ),
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
                                progressPercent={pct}
                                progressLabel="ความคืบหน้าเป้าที่ได้คุย"
                                badge={
                                    idx === 0 && m.talked_calls > 0 ? (
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

            {showSettings && (
                <SettingsModal
                    initial={target}
                    onClose={() => setShowSettings(false)}
                    onSave={handleSaveTarget}
                />
            )}
        </div>
    );
};

export default DailyMonitoringPage;
