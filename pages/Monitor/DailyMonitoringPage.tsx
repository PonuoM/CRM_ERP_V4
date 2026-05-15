import React, { useEffect, useMemo, useState, useCallback } from "react";
import ReactApexChart from "react-apexcharts";
import {
    Phone,
    PhoneCall,
    Clock,
    Target,
    RefreshCw,
    Settings as SettingsIcon,
    ChevronUp,
    ChevronDown,
    Users as UsersIcon,
    Sun,
    Moon,
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
    TableRowsSkeleton,
} from "@/components/Monitor/Skeleton";

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

type SortField =
    | "name"
    | "total_calls"
    | "talked_calls"
    | "total_minutes"
    | "morning_calls"
    | "afternoon_calls"
    | "target_progress";

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
    const [sortField, setSortField] = useState<SortField>("talked_calls");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
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

    // Sorting members
    const sortedMembers = useMemo(() => {
        if (!data) return [];
        const arr = [...data.members];
        arr.sort((a, b) => {
            let av: any = a[sortField];
            let bv: any = b[sortField];
            if (sortField === "name") {
                av = a.name;
                bv = b.name;
                return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
            }
            return sortDir === "asc" ? Number(av) - Number(bv) : Number(bv) - Number(av);
        });
        return arr;
    }, [data, sortField, sortDir]);

    const toggleSort = (f: SortField) => {
        if (sortField === f) {
            setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        } else {
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

    const totals = data?.team_totals;
    const target = data?.target_per_day || 40;
    // While realtime is being fetched for today, treat KPI/chart/table as loading
    // because the DB numbers (which we already rendered) are likely 0 for today.
    const isLoadingData = loading || (refreshingRealtime && isToday(date));

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

            {/* Members table */}
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
                                    onClick={() => toggleSort("total_calls")}
                                    className="px-3 py-2 text-right font-medium cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                                >
                                    โทร <SortIcon field="total_calls" />
                                </th>
                                <th
                                    onClick={() => toggleSort("talked_calls")}
                                    className="px-3 py-2 text-right font-medium cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                                >
                                    ได้คุย <SortIcon field="talked_calls" />
                                </th>
                                <th
                                    onClick={() => toggleSort("total_minutes")}
                                    className="px-3 py-2 text-right font-medium cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                                >
                                    เวลา <SortIcon field="total_minutes" />
                                </th>
                                <th
                                    onClick={() => toggleSort("morning_calls")}
                                    className="px-3 py-2 text-right font-medium cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                                >
                                    <span className="inline-flex items-center gap-1">
                                        <Sun className="w-3.5 h-3.5 text-amber-500" />
                                        เช้า
                                    </span>
                                    <SortIcon field="morning_calls" />
                                </th>
                                <th
                                    onClick={() => toggleSort("afternoon_calls")}
                                    className="px-3 py-2 text-right font-medium cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                                >
                                    <span className="inline-flex items-center gap-1">
                                        <Moon className="w-3.5 h-3.5 text-indigo-500" />
                                        บ่าย
                                    </span>
                                    <SortIcon field="afternoon_calls" />
                                </th>
                                <th
                                    onClick={() => toggleSort("target_progress")}
                                    className="px-3 py-2 text-right font-medium cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                                >
                                    เป้า <SortIcon field="target_progress" />
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoadingData ? (
                                <TableRowsSkeleton rows={8} colCount={7} />
                            ) : sortedMembers.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-3 py-10 text-center text-gray-400">
                                        ไม่มีข้อมูล
                                    </td>
                                </tr>
                            ) : (
                                sortedMembers.map((m) => {
                                    const pct = Math.min(100, Math.round(m.target_progress * 100));
                                    const barColor =
                                        pct >= 90
                                            ? "bg-green-500"
                                            : pct >= 60
                                                ? "bg-amber-500"
                                                : "bg-red-500";
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
                                                        {m.phone && (
                                                            <div className="text-[11px] text-gray-400">{m.phone}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2 text-right tabular-nums">{m.total_calls}</td>
                                            <td className="px-3 py-2 text-right tabular-nums font-semibold text-green-700">
                                                {m.talked_calls}
                                            </td>
                                            <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                                                {formatMinutes(m.total_minutes)}
                                            </td>
                                            <td className="px-3 py-2 text-right tabular-nums text-gray-500">
                                                {m.morning_calls}
                                            </td>
                                            <td className="px-3 py-2 text-right tabular-nums text-gray-500">
                                                {m.afternoon_calls}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 min-w-[60px] h-2 bg-gray-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full ${barColor}`}
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                    <span
                                                        className={`text-xs font-semibold tabular-nums w-10 text-right ${pct >= 90 ? "text-green-700" : pct >= 60 ? "text-amber-700" : "text-red-700"
                                                            }`}
                                                    >
                                                        {pct}%
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
