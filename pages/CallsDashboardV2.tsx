import React, { useMemo, useState, useEffect } from "react";
import { User, UserRole } from "@/types";
import {
    Phone,
    PhoneIncoming,
    PhoneMissed,
    PhoneOutgoing,
    Clock3,
    Users as UsersIcon,
    ChevronDown,
    ChevronUp,
    TrendingUp,
} from "lucide-react";
import StatCard from "@/components/StatCard";
import LineChart from "@/components/LineChart";
import PieChart from "@/components/PieChart";
import resolveApiBasePath from "@/utils/apiBasePath";
import OnecallLoginSidebar from "@/components/common/OnecallLoginSidebar";

const InfoTip: React.FC<{ text: string }> = ({ text }) => (
    <span className="relative inline-flex ml-1 group cursor-help">
        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-300 text-[10px] font-bold text-gray-600 leading-none">!</span>
        <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 hidden group-hover:block w-48 px-2.5 py-1.5 text-xs text-white bg-gray-800 rounded-lg shadow-lg z-50 text-left font-normal whitespace-normal">{text}</span>
    </span>
);

interface CallsDashboardV2Props {
    user?: User;
}

const CallsDashboardV2: React.FC<CallsDashboardV2Props> = ({ user }) => {
    const apiBase = useMemo(() => resolveApiBasePath(), []);
    const [month, setMonth] = useState<string>(() =>
        String(new Date().getMonth() + 1).padStart(2, "0"),
    );
    const [year, setYear] = useState<string>(() =>
        String(new Date().getFullYear()),
    );

    // Users
    const [users, setUsers] = useState<any[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string>("");

    const currentCompanyId = useMemo(() => {
        if (user && typeof user.companyId === "number") return user.companyId;
        try {
            const s = localStorage.getItem("sessionUser");
            if (s) {
                const su = JSON.parse(s);
                if (su && typeof su.company_id === "number") return su.company_id;
            }
        } catch { }
        return undefined as number | undefined;
    }, [user]);

    const usersForFilter = useMemo(() => {
        if (!Array.isArray(users)) return [] as any[];
        let filtered = users;
        if (currentCompanyId != null) {
            filtered = filtered.filter((u) => {
                const cid =
                    typeof u.company_id === "number" ? u.company_id : u.companyId;
                return cid === currentCompanyId;
            });
        }
        if (user?.role === UserRole.Supervisor) {
            const myId = String(user.id);
            filtered = filtered.filter(
                (u) =>
                    String(u.id) === myId ||
                    String(u.supervisor_id ?? u.supervisorId ?? "") === myId,
            );
        }
        if (user?.role === UserRole.Telesale) {
            filtered = filtered.filter((u) => String(u.id) === String(user.id));
        }
        return filtered;
    }, [users, currentCompanyId, user]);

    const teamUserIds = useMemo(() => {
        if (user?.role === UserRole.Telesale) return [String(user.id)];
        if (user?.role === UserRole.Supervisor) {
            const ids = usersForFilter.map((u) => String(u.id));
            if (!ids.includes(String(user.id))) ids.push(String(user.id));
            return ids;
        }
        return null;
    }, [user, usersForFilter]);

    useEffect(() => {
        if (!selectedUserId) return;
        const exists = usersForFilter.some(
            (u) => String(u.id) === String(selectedUserId),
        );
        if (!exists) setSelectedUserId("");
    }, [usersForFilter, selectedUserId]);

    // Dashboard data
    const [dashboardStats, setDashboardStats] = useState({
        totalCalls: 0,
        answeredCalls: 0,
        missedCalls: 0,
        totalMinutes: 0,
        avgMinutes: 0,
        answerRate: 0,
        inboundCalls: 0,
        outboundCalls: 0,
        internalCalls: 0,
        voicemailCalls: 0,
        inboundRate: 0,
        outboundRate: 0,
    });
    const [employeeSummary, setEmployeeSummary] = useState<any[]>([]);
    const [sortKey, setSortKey] = useState<string>("total_calls");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

    const toggleSort = (key: string) => {
        if (sortKey === key) {
            setSortDir(prev => prev === "asc" ? "desc" : "asc");
        } else {
            setSortKey(key);
            setSortDir("desc");
        }
    };

    const sortedEmployees = useMemo(() => {
        if (!employeeSummary.length) return [];
        return [...employeeSummary].sort((a, b) => {
            const av = a[sortKey] ?? 0;
            const bv = b[sortKey] ?? 0;
            if (typeof av === "string" && typeof bv === "string") {
                return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
            }
            return sortDir === "asc" ? av - bv : bv - av;
        });
    }, [employeeSummary, sortKey, sortDir]);
    const [dailySeries, setDailySeries] = useState<
        { date: string; count: number; total_minutes: number; answered: number; missed: number }[]
    >([]);
    const [talkSummary, setTalkSummary] = useState({
        answered: 0,
        missed: 0,
        inbound: 0,
        outbound: 0,
        internal: 0,
        voicemail: 0,
    });

    // Build common query params
    const buildParams = () => {
        const userParam = selectedUserId
            ? `&user_id=${encodeURIComponent(selectedUserId)}`
            : "";
        const companyParam = currentCompanyId
            ? `&company_id=${currentCompanyId}`
            : "";
        const userIdsParam =
            !selectedUserId && teamUserIds
                ? `&user_ids=${encodeURIComponent(teamUserIds.join(","))}`
                : "";
        return `month=${month}&year=${year}${userParam}${companyParam}${userIdsParam}`;
    };

    const fetchDashboardStats = async () => {
        try {
            const resp = await fetch(
                `${apiBase}/Onecall_DB/get_dashboard_stats_v2.php?${buildParams()}`,
            );
            const data = await resp.json();
            if (data.success) setDashboardStats(data.data);
        } catch (e) {
            console.error("fetchDashboardStats", e);
        }
    };

    const fetchEmployeeSummary = async () => {
        try {
            const resp = await fetch(
                `${apiBase}/Onecall_DB/get_employee_summary_v2.php?${buildParams()}`,
            );
            const data = await resp.json();
            if (data?.success && Array.isArray(data.data))
                setEmployeeSummary(data.data);
            else setEmployeeSummary([]);
        } catch (e) {
            console.error("fetchEmployeeSummary", e);
            setEmployeeSummary([]);
        }
    };

    const fetchDailySeries = async () => {
        try {
            const resp = await fetch(
                `${apiBase}/Onecall_DB/get_daily_calls_v2.php?${buildParams()}`,
            );
            const data = await resp.json();
            if (data?.success && Array.isArray(data.data))
                setDailySeries(data.data);
            else setDailySeries([]);
        } catch (e) {
            console.error("fetchDailySeries", e);
            setDailySeries([]);
        }
    };

    const fetchTalkSummary = async () => {
        try {
            const resp = await fetch(
                `${apiBase}/Onecall_DB/get_talk_summary_v2.php?${buildParams()}`,
            );
            const data = await resp.json();
            if (data?.success && data.data) setTalkSummary(data.data);
            else
                setTalkSummary({
                    answered: 0,
                    missed: 0,
                    inbound: 0,
                    outbound: 0,
                    internal: 0,
                    voicemail: 0,
                });
        } catch (e) {
            console.error("fetchTalkSummary", e);
        }
    };

    const fetchUsers = async () => {
        try {
            const companyParam = currentCompanyId
                ? `?company_id=${currentCompanyId}`
                : "";
            const resp = await fetch(
                `${apiBase}/Onecall_DB/get_users.php${companyParam}`,
            );
            const data = await resp.json();
            if (data.success) {
                const mapped = (data.data || []).map((u: any) => ({
                    ...u,
                    role:
                        u.role === "Supervisor Telesale" ? UserRole.Supervisor : u.role,
                }));
                setUsers(mapped);
            }
        } catch (e) {
            console.error("fetchUsers", e);
        }
    };

    const monthOptions = Array.from({ length: 12 }, (_, i) =>
        String(i + 1).padStart(2, "0"),
    );
    const yearOptions = [
        String(new Date().getFullYear()),
        String(new Date().getFullYear() - 1),
    ];

    useEffect(() => {
        fetchUsers();
    }, []);

    useEffect(() => {
        if (month && year) {
            fetchDashboardStats();
            fetchEmployeeSummary();
            fetchDailySeries();
            fetchTalkSummary();
        }
    }, [month, year, selectedUserId, teamUserIds]);

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-1">
                    <div className="p-2 bg-emerald-100 rounded-lg">
                        <Phone className="w-6 h-6 text-emerald-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-800">
                        ภาพรวมการโทร V2
                    </h1>
                </div>
                <p className="text-gray-500 ml-11 text-sm">
                    ข้อมูลจากการ Import CSV
                </p>
            </div>

            {/* Filters */}
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
                        <label className="block text-xs text-gray-500 mb-1">
                            พนักงาน
                        </label>
                        <select
                            value={selectedUserId}
                            onChange={(e) => setSelectedUserId(e.target.value)}
                            className="w-full border rounded-md px-3 py-2 text-sm"
                        >
                            <option value="">ทั้งหมด</option>
                            {usersForFilter.map((u) => (
                                <option key={u.id} value={u.id}>
                                    {u.firstname} {u.lastname} ({u.role})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* KPI Cards - Row 1 */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                <StatCard
                    title="สายทั้งหมด"
                    value={dashboardStats.totalCalls.toLocaleString()}
                    subtext="ช่วงนี้"
                    icon={Phone}
                />
                <StatCard
                    title="สายที่รับ"
                    value={dashboardStats.answeredCalls.toLocaleString()}
                    subtext={`${dashboardStats.answerRate}%`}
                    icon={PhoneIncoming}
                />
                <StatCard
                    title="ไม่ได้รับ"
                    value={dashboardStats.missedCalls.toLocaleString()}
                    subtext={`${dashboardStats.totalCalls > 0 ? (100 - dashboardStats.answerRate).toFixed(1) : 0}%`}
                    icon={PhoneMissed}
                />
                <StatCard
                    title="สายโทรเข้า"
                    value={dashboardStats.inboundCalls.toLocaleString()}
                    subtext={`${dashboardStats.inboundRate}%`}
                    icon={PhoneIncoming}
                />
                <StatCard
                    title="สายโทรออก"
                    value={dashboardStats.outboundCalls.toLocaleString()}
                    subtext={`${dashboardStats.outboundRate}%`}
                    icon={PhoneOutgoing}
                />
                <StatCard
                    title="เวลาสนทนา (นาที)"
                    value={Math.floor(dashboardStats.totalMinutes).toLocaleString()}
                    subtext={`เฉลี่ย ${dashboardStats.avgMinutes} นาที/สาย`}
                    icon={Clock3}
                />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <LineChart
                    title="สายรายวัน"
                    yLabel="จำนวนสาย"
                    data={(dailySeries.length ? dailySeries : []).map((d) => ({
                        label: d.date?.substring(5, 10) || "",
                        value: d.count || 0,
                    }))}
                    color="#34D399"
                    xTickEvery={7}
                    height={220}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <PieChart
                        title="รับสาย / ไม่ได้รับ"
                        data={[
                            {
                                label: `รับสาย (${talkSummary.answered})`,
                                value: talkSummary.answered,
                                color: "#34D399",
                            },
                            {
                                label: `ไม่ได้รับ (${talkSummary.missed})`,
                                value: talkSummary.missed,
                                color: "#F87171",
                            },
                        ]}
                        size={200}
                    />
                    <PieChart
                        title="ประเภทสาย"
                        data={[
                            {
                                label: `โทรเข้า (${talkSummary.inbound})`,
                                value: talkSummary.inbound,
                                color: "#60A5FA",
                            },
                            {
                                label: `โทรออก (${talkSummary.outbound})`,
                                value: talkSummary.outbound,
                                color: "#FBBF24",
                            },
                            {
                                label: `ภายใน (${talkSummary.internal})`,
                                value: talkSummary.internal,
                                color: "#A78BFA",
                            },
                            ...(talkSummary.voicemail > 0
                                ? [
                                    {
                                        label: `ข้อความเสียง (${talkSummary.voicemail})`,
                                        value: talkSummary.voicemail,
                                        color: "#E5E7EB",
                                    },
                                ]
                                : []),
                        ]}
                        size={200}
                    />
                </div>
            </div>

            {/* Employee Summary Table */}
            <div className="bg-white border rounded-lg overflow-hidden">
                <div className="p-4 border-b">
                    <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        <UsersIcon className="w-5 h-5 text-gray-500" />
                        สรุปรายบุคคล
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-600">
                            <tr>
                                {[
                                    { key: "first_name", label: "ชื่อ", align: "left" },
                                    { key: "role", label: "ตำแหน่ง" },
                                    { key: "total_calls", label: "สายทั้งหมด", tip: "จำนวนสายทั้งหมดในช่วงเดือนที่เลือก" },
                                    { key: "answered_calls", label: "รับสาย", tip: "จำนวนสายที่มีการรับสนทนา" },
                                    { key: "missed_calls", label: "ไม่ได้รับ", tip: "จำนวนสายที่ไม่มีการรับสนทนา" },
                                    { key: "talked_calls", label: "ได้คุย", tip: "สายที่รับและสนทนาตั้งแต่ 40 วินาทีขึ้นไป" },
                                    { key: "answer_rate", label: "% รับ", tip: "อัตราการรับสาย = สายที่รับ ÷ สายทั้งหมด × 100" },
                                    { key: "inbound_calls", label: "สายเข้า", tip: "สายที่โทรเข้ามา" },
                                    { key: "outbound_calls", label: "สายออก", tip: "สายที่โทรออกไป" },
                                    { key: "outbound_rate", label: "% ออก", tip: "อัตราสายออก = สายออก ÷ สายทั้งหมด × 100" },
                                    { key: "total_minutes", label: "เวลาโทร (นาที)", tip: "เวลาสนทนาสะสมของทุกสายรวมกัน" },
                                    { key: "avg_minutes", label: "เฉลี่ย/สาย", tip: "เวลาโทรรวม ÷ สายที่รับ (คิดเฉพาะสายที่รับเท่านั้น)" },
                                ].map(col => (
                                    <th
                                        key={col.key}
                                        className={`px-3 py-3 font-medium cursor-pointer select-none hover:bg-gray-100 transition-colors ${col.align === "left" ? "text-left px-4" : "text-center"}`}
                                        onClick={() => toggleSort(col.key)}
                                    >
                                        <span className="inline-flex items-center gap-0.5">
                                            {col.label}
                                            {col.tip && <InfoTip text={col.tip} />}
                                            {sortKey === col.key && (
                                                sortDir === "asc"
                                                    ? <ChevronUp className="w-3 h-3 text-emerald-600" />
                                                    : <ChevronDown className="w-3 h-3 text-emerald-600" />
                                            )}
                                        </span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {employeeSummary.length === 0 ? (
                                <tr>
                                    <td colSpan={12} className="py-12 text-center text-gray-400">
                                        ไม่พบข้อมูล
                                    </td>
                                </tr>
                            ) : (
                                sortedEmployees.map((emp) => (
                                    <tr
                                        key={emp.user_id}
                                        className="hover:bg-gray-50 transition-colors"
                                    >
                                        <td className="px-4 py-3 font-medium text-gray-800">
                                            {emp.first_name} {emp.last_name || ""}
                                        </td>
                                        <td className="px-3 py-3 text-center text-gray-500 text-xs">
                                            {emp.role}
                                        </td>
                                        <td className="px-3 py-3 text-center font-semibold">
                                            {emp.total_calls}
                                        </td>
                                        <td className="px-3 py-3 text-center text-emerald-600 font-medium">
                                            {emp.answered_calls}
                                        </td>
                                        <td className="px-3 py-3 text-center text-red-500 font-medium">
                                            {emp.missed_calls}
                                        </td>
                                        <td className="px-3 py-3 text-center text-violet-600 font-medium">
                                            {emp.talked_calls ?? 0}
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                            <span
                                                className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${emp.answer_rate >= 80
                                                    ? "bg-emerald-100 text-emerald-700"
                                                    : emp.answer_rate >= 50
                                                        ? "bg-amber-100 text-amber-700"
                                                        : "bg-red-100 text-red-700"
                                                    }`}
                                            >
                                                {emp.answer_rate}%
                                            </span>
                                        </td>
                                        <td className="px-3 py-3 text-center text-blue-600">
                                            {emp.inbound_calls}
                                        </td>
                                        <td className="px-3 py-3 text-center text-amber-600">
                                            {emp.outbound_calls}
                                        </td>
                                        <td className="px-3 py-3 text-center text-gray-500">
                                            {emp.outbound_rate}%
                                        </td>
                                        <td className="px-3 py-3 text-center">
                                            {emp.total_minutes} นาที
                                        </td>
                                        <td className="px-3 py-3 text-center text-gray-500">
                                            {emp.avg_minutes} นาที
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            
            <OnecallLoginSidebar currentUser={user} />
        </div>
    );
};

export default CallsDashboardV2;
