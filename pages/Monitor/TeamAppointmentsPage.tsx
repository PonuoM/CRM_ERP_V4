import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
    CalendarDays,
    Users as UsersIcon,
    AlertCircle,
    RefreshCw,
    Clock,
    Phone,
} from "lucide-react";
import resolveApiBasePath from "@/utils/apiBasePath";
import { User } from "@/types";
import { KpiRowSkeleton, TableRowsSkeleton, Skeleton } from "@/components/Monitor/Skeleton";
import MemberCard, { CardStatus, BulletItem } from "@/components/Monitor/MemberCard";
import TeamInsights, { InsightItem } from "@/components/Monitor/TeamInsights";

interface TeamTotals {
    selected: number;
    today: number;
    week: number;
    overdue: number;
}

interface MemberRow {
    user_id: number;
    name: string;
    first_name: string;
    last_name: string;
    role: string;
    selected: number;
    week: number;
    overdue: number;
}

interface AppointmentRow {
    id: number;
    date: string;
    status: string;
    notes: string | null;
    title: string | null;
    customer_id: number;
    customer_name: string;
    customer_phone: string;
    agent_id: number;
    agent_name: string;
}

interface ApptData {
    date: string;
    range_days: number;
    team_totals: TeamTotals;
    members: MemberRow[];
    appointments: AppointmentRow[];
}

const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

interface Props {
    user: User;
}

const TeamAppointmentsPage: React.FC<Props> = ({ user }) => {
    const apiBase = useMemo(() => resolveApiBasePath(), []);
    const [date, setDate] = useState<string>(todayISO);
    const [rangeDays, setRangeDays] = useState<number>(1);
    const [data, setData] = useState<ApptData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [agentFilter, setAgentFilter] = useState<number | "all">("all");

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem("authToken");
            const res = await fetch(
                `${apiBase}/Monitor/team_appointments.php?date=${date}&range_days=${rangeDays}`,
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
    }, [apiBase, date, rangeDays]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const totals = data?.team_totals;

    // Sort members by overdue desc (need attention first)
    const cardMembers = useMemo(() => {
        if (!data) return [];
        return [...data.members].sort((a, b) => b.overdue - a.overdue);
    }, [data]);

    // Insights
    const insights = useMemo<InsightItem[]>(() => {
        if (!data || data.members.length === 0) return [];
        const items: InsightItem[] = [];
        const t = data.team_totals;
        const members = data.members;

        // Team summary
        items.push({
            tone: "info",
            text: (
                <>
                    วันนี้ทีมมีนัด <b>{t.today}</b> รายการ • ช่วงที่เลือก{" "}
                    <b>{t.selected}</b> • หน้าต่าง 7 วัน <b>{t.week}</b>
                </>
            ),
        });

        // Overdue alert
        if (t.overdue > 0) {
            const topOverdue = [...members].filter((m) => m.overdue > 0).sort((a, b) => b.overdue - a.overdue).slice(0, 3);
            items.push({
                tone: t.overdue > 1000 ? "bad" : "warn",
                text: (
                    <>
                        <b>นัดหมายค้าง {t.overdue.toLocaleString()} รายการ</b> — ส่วนใหญ่:{" "}
                        {topOverdue.map((m, i) => (
                            <span key={m.user_id}>
                                {i > 0 && ", "}
                                <b>{m.name}</b> ({m.overdue})
                            </span>
                        ))}{" "}
                        — ต้องตามเคลียร์
                    </>
                ),
            });
        }

        // People with no appointments at all this period
        const idle = members.filter((m) => m.selected === 0 && m.week === 0 && m.overdue === 0);
        if (idle.length > 0 && members.length > idle.length) {
            items.push({
                tone: "warn",
                text: (
                    <>
                        <b>{idle.length} คน</b>ไม่มีนัดหมายในช่วงนี้เลย:{" "}
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

        // Top scheduler (most week appointments)
        const top = [...members].sort((a, b) => b.week - a.week)[0];
        if (top && top.week > 0) {
            items.push({
                tone: "highlight",
                text: (
                    <>
                        <b>ตั้งนัดเยอะสุด:</b> <b className="text-yellow-700">{top.name}</b> มี{" "}
                        <b>{top.week}</b> นัดใน 7 วันข้างหน้า
                    </>
                ),
            });
        }

        return items;
    }, [data]);

    // Status from overdue ratio
    const statusFromOverdue = (overdue: number, week: number): CardStatus => {
        const total = overdue + week;
        if (total === 0) return "idle";
        const ratio = overdue / total;
        if (ratio >= 0.7) return "bad";
        if (ratio >= 0.4) return "warn";
        if (ratio >= 0.2) return "good";
        return "great";
    };

    const filteredAppts = useMemo(() => {
        if (!data) return [];
        if (agentFilter === "all") return data.appointments;
        return data.appointments.filter((a) => a.agent_id === agentFilter);
    }, [data, agentFilter]);

    const fmtTime = (iso: string) => {
        const d = new Date(iso.replace(" ", "T"));
        return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    };

    const fmtDateTH = (iso: string) => {
        const d = new Date(iso.replace(" ", "T"));
        return `${d.getDate()} ${["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."][d.getMonth()]}`;
    };

    return (
        <div className="p-4 sm:p-6 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <CalendarDays className="w-6 h-6 text-green-600" />
                        นัดหมายของทีม
                    </h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        ติดตามนัดหมาย (Follow up) ของลูกทีมแต่ละคน — เห็นทั้งวันนี้, สัปดาห์นี้, และที่ค้างเก่า
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <select
                        value={rangeDays}
                        onChange={(e) => setRangeDays(parseInt(e.target.value, 10))}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                        <option value={1}>วันนี้</option>
                        <option value={3}>3 วัน</option>
                        <option value={7}>1 สัปดาห์</option>
                        <option value={14}>2 สัปดาห์</option>
                        <option value={30}>1 เดือน</option>
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
                        title="วันนี้"
                        value={totals ? totals.today : "—"}
                        subtext="นัดหมายที่รอดำเนินการ"
                        icon={CalendarDays}
                        color="bg-blue-50 text-blue-600"
                    />
                    <KpiCard
                        title={rangeDays > 1 ? `ช่วงที่เลือก (${rangeDays} วัน)` : "ในวันที่เลือก"}
                        value={totals ? totals.selected : "—"}
                        subtext="ภายในช่วงเวลาที่เลือก"
                        icon={Clock}
                        color="bg-green-50 text-green-600"
                    />
                    <KpiCard
                        title="หน้าต่าง 7 วัน"
                        value={totals ? totals.week : "—"}
                        subtext="ตั้งแต่วันที่เลือก +7 วัน"
                        icon={UsersIcon}
                        color="bg-amber-50 text-amber-600"
                    />
                    <KpiCard
                        title="ค้าง (Overdue)"
                        value={totals ? totals.overdue : "—"}
                        subtext="เลยวันแล้วยังไม่ปิด"
                        icon={AlertCircle}
                        color="bg-red-50 text-red-600"
                    />
                </div>
            )}

            {/* Member cards (grid) */}
            <div className="mb-2 flex items-center gap-2">
                <UsersIcon className="w-4 h-4 text-gray-500" />
                <h3 className="text-md font-semibold text-gray-800">
                    KPI รายคน
                    {data && (
                        <span className="text-xs font-normal text-gray-500 ml-2">
                            ({data.members.length} คน — เรียงตาม "ค้าง" มากสุด)
                        </span>
                    )}
                </h3>
            </div>
            {loading ? (
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
                        </div>
                    ))}
                </div>
            ) : cardMembers.length === 0 ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-10 text-center text-gray-400 mb-5">
                    ไม่มีข้อมูล
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-5">
                    {cardMembers.map((m) => {
                        const status = statusFromOverdue(m.overdue, m.week);
                        const bullets: BulletItem[] = [
                            {
                                icon: <CalendarDays className="w-3.5 h-3.5 text-blue-500" />,
                                label: "วันนี้/วันเลือก",
                                value: m.selected,
                                emphasize: true,
                            },
                            {
                                icon: <Clock className="w-3.5 h-3.5 text-emerald-500" />,
                                label: "ใน 7 วัน",
                                value: m.week,
                            },
                            {
                                icon: <AlertCircle className="w-3.5 h-3.5 text-red-500" />,
                                label: "ค้าง (Overdue)",
                                value: (
                                    <span className={m.overdue > 0 ? "text-red-600 font-bold" : ""}>
                                        {m.overdue}
                                    </span>
                                ),
                            },
                        ];
                        return (
                            <div
                                key={m.user_id}
                                className={`relative ${agentFilter === m.user_id ? "ring-2 ring-green-400 rounded-xl" : ""}`}
                            >
                                <MemberCard
                                    name={m.name}
                                    role={m.role}
                                    initial={(m.first_name || "?").charAt(0)}
                                    status={status}
                                    bullets={bullets}
                                />
                                <button
                                    onClick={() =>
                                        setAgentFilter(agentFilter === m.user_id ? "all" : m.user_id)
                                    }
                                    className="absolute top-3 right-3 text-xs px-2 py-1 rounded border border-gray-200 bg-white/80 hover:bg-gray-100"
                                >
                                    {agentFilter === m.user_id ? "ยกเลิก" : "ดูรายการ"}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Appointment list */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-md font-semibold text-gray-800">
                        รายการนัดหมาย
                        {data && (
                            <span className="text-xs font-normal text-gray-500 ml-2">
                                ({filteredAppts.length} รายการ
                                {agentFilter !== "all" ? ` — เฉพาะคนที่เลือก` : ""}
                                {data.appointments.length >= 200 ? " — แสดง 200 รายการแรก" : ""})
                            </span>
                        )}
                    </h3>
                    {agentFilter !== "all" && (
                        <button
                            onClick={() => setAgentFilter("all")}
                            className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200"
                        >
                            ล้างตัวกรอง
                        </button>
                    )}
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-600">
                            <tr>
                                <th className="px-3 py-2 text-left font-medium">เวลา</th>
                                <th className="px-3 py-2 text-left font-medium">เซลส์</th>
                                <th className="px-3 py-2 text-left font-medium">ลูกค้า</th>
                                <th className="px-3 py-2 text-left font-medium">เบอร์</th>
                                <th className="px-3 py-2 text-left font-medium">หมายเหตุ</th>
                                <th className="px-3 py-2 text-left font-medium">สถานะ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <TableRowsSkeleton rows={8} colCount={6} />
                            ) : filteredAppts.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-3 py-10 text-center text-gray-400">
                                        ไม่มีนัดหมายในช่วงที่เลือก
                                    </td>
                                </tr>
                            ) : (
                                filteredAppts.map((a) => (
                                    <tr key={a.id} className="border-t border-gray-100 hover:bg-gray-50">
                                        <td className="px-3 py-2 whitespace-nowrap text-xs">
                                            <div className="text-gray-500">{fmtDateTH(a.date)}</div>
                                            <div className="font-mono font-semibold text-gray-800">
                                                {fmtTime(a.date)}
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap text-gray-700">{a.agent_name}</td>
                                        <td className="px-3 py-2 whitespace-nowrap text-gray-800 font-medium">
                                            {a.customer_name || "—"}
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap text-gray-500">
                                            <span className="inline-flex items-center gap-1">
                                                <Phone className="w-3 h-3" />
                                                {a.customer_phone || "—"}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-gray-600 max-w-[300px] truncate" title={a.notes || ""}>
                                            {a.notes || "—"}
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            <span
                                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${a.status === "ใหม่"
                                                    ? "bg-blue-100 text-blue-700"
                                                    : "bg-amber-100 text-amber-700"
                                                    }`}
                                            >
                                                {a.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default TeamAppointmentsPage;
