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

            {/* KPI cards */}
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

            {/* Per-member counts */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-5">
                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="text-md font-semibold text-gray-800">
                        นัดหมายของลูกทีม
                        {data && (
                            <span className="text-xs font-normal text-gray-500 ml-2">
                                ({data.members.length} คน)
                            </span>
                        )}
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-600">
                            <tr>
                                <th className="px-3 py-2 text-left font-medium">ชื่อ</th>
                                <th className="px-3 py-2 text-right font-medium">วันนี้/วันเลือก</th>
                                <th className="px-3 py-2 text-right font-medium">7 วัน</th>
                                <th className="px-3 py-2 text-right font-medium">ค้าง</th>
                                <th className="px-3 py-2 text-right font-medium">ดู</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-3 py-10 text-center text-gray-400">
                                        กำลังโหลด...
                                    </td>
                                </tr>
                            ) : (data?.members || []).length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-3 py-10 text-center text-gray-400">
                                        ไม่มีข้อมูล
                                    </td>
                                </tr>
                            ) : (
                                (data?.members || []).map((m) => (
                                    <tr
                                        key={m.user_id}
                                        className={`border-t border-gray-100 hover:bg-gray-50 ${agentFilter === m.user_id ? "bg-green-50/50" : ""}`}
                                    >
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
                                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-blue-700">
                                            {m.selected}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums text-gray-700">{m.week}</td>
                                        <td
                                            className={`px-3 py-2 text-right tabular-nums ${m.overdue > 0 ? "font-semibold text-red-600" : "text-gray-400"}`}
                                        >
                                            {m.overdue}
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            <button
                                                onClick={() =>
                                                    setAgentFilter(agentFilter === m.user_id ? "all" : m.user_id)
                                                }
                                                className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-100"
                                            >
                                                {agentFilter === m.user_id ? "ยกเลิก" : "กรองดู"}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

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
                                <tr>
                                    <td colSpan={6} className="px-3 py-10 text-center text-gray-400">
                                        กำลังโหลด...
                                    </td>
                                </tr>
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
