import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
    Calendar,
    RefreshCw,
    Settings as SettingsIcon,
    TrendingUp,
} from "lucide-react";
import resolveApiBasePath from "@/utils/apiBasePath";
import { User } from "@/types";
import { Skeleton } from "@/components/Monitor/Skeleton";
import TeamInsights, { InsightItem } from "@/components/Monitor/TeamInsights";
import {
    fetchOneCallRecordings,
    aggregateOneCallByUsers,
} from "@/services/onecallRealtime";
import DateRangePicker from "@/components/DateRangePicker";

type Period = "today" | "week" | "month" | "year" | "all" | "custom";
type SortKey = "score" | "sales" | "orders" | "calls" | "customers" | "close_rate" | "minutes";

interface StaffStat {
    user_id: number;
    username: string;
    first_name: string;
    last_name: string;
    name: string;
    phone?: string;
    role: string;
    role_id: number;
    department: "CRM Telesale" | "Sale Admin";
    assigned_total: number;
    new_count: number;
    active_count: number;
    risk_count: number;
    tank_count: number;
    qual_pct: number;
    calls_total: number;
    talked_calls: number;
    total_min: number;
    avg_min: number;
    calls_per_cust: number;
    orders_period: number;
    sales_period: number;
    orders_today: number;
    sales_today: number;
    aov: number;
    close_rate: number;
    distributed_today: number;
    distributed_period: number;
    total_distributed: number;
}

interface SalesData {
    period: Period;
    targets: { daily_calls: number; daily_minutes: number };
    summary: { staff_count: number; total_customers: number; distributed_today: number };
    staff: StaffStat[];
    viewer?: { user_id: number; role: string; is_supervisor: boolean; is_admin: boolean };
}

const PERIOD_LABELS: Record<Period, string> = {
    today: "วันนี้",
    week: "สัปดาห์นี้",
    month: "เดือนนี้",
    year: "ปีนี้",
    all: "ทั้งหมด",
    custom: "กำหนดเอง",
};

const fmtNum = (n: number) => n.toLocaleString("th-TH");
const fmtMoney = (n: number) => `฿${Math.round(n).toLocaleString("th-TH")}`;

function periodRangeText(
    period: Period,
    customStartDate?: string,
    customEndDate?: string
): string {
    const fmt = (d: Date) =>
        d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
    const today = new Date();
    if (period === "today") return fmt(today);
    if (period === "custom") {
        if (customStartDate && customEndDate) {
            const [sy, sm, sd] = customStartDate.split("-").map(Number);
            const startD = new Date(sy, sm - 1, sd);
            if (customStartDate === customEndDate) {
                return fmt(startD);
            }
            const [ey, em, ed] = customEndDate.split("-").map(Number);
            const endD = new Date(ey, em - 1, ed);
            return `${fmt(startD)} – ${fmt(endD)}`;
        }
        if (customStartDate) {
            const [year, month, day] = customStartDate.split("-").map(Number);
            const d = new Date(year, month - 1, day);
            return fmt(d);
        }
        return fmt(today);
    }
    if (period === "week") {
        const d = today.getDay();
        const off = d === 0 ? -6 : 1 - d;
        const mon = new Date(today);
        mon.setDate(today.getDate() + off);
        return `${fmt(mon)} – ${fmt(today)}`;
    }
    if (period === "month") {
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        return `${fmt(start)} – ${fmt(today)}`;
    }
    if (period === "year") {
        const start = new Date(today.getFullYear(), 0, 1);
        return `${fmt(start)} – ${fmt(today)}`;
    }
    return "ตั้งแต่เริ่มเก็บข้อมูล";
}

// Scoring — calls per customer ratio (higher = more responsive)
function scoreStaff(s: StaffStat): number {
    const ratio = s.assigned_total > 0 ? s.calls_total / s.assigned_total : 0;
    const qual = s.qual_pct / 100;
    const sales = s.sales_period > 0 ? Math.log10(s.sales_period) / 6 : 0; // 0..1
    return ratio * 0.4 + qual * 0.3 + sales * 0.3;
}

// ── SummaryBar ─────────────────────────────────────────────────────────────
const SummaryBar: React.FC<{ data?: SalesData; loading: boolean }> = ({ data, loading }) => {
    const items: { id: string; num: number | null; label: string; highlight?: "primary" | "negative" }[] = [
        { id: "staff", num: data?.summary.staff_count ?? null, label: "พนักงาน CRM" },
        { id: "customers", num: data?.summary.total_customers ?? null, label: "ลูกค้าทั้งหมด" },
        {
            id: "today",
            num: data?.summary.distributed_today ?? null,
            label: "แจกวันนี้ (ทีม)",
            highlight: (data?.summary.distributed_today ?? 0) > 0 ? "primary" : undefined,
        },
    ];
    return (
        <div className="bg-white border border-gray-200 rounded-xl px-5 py-3 flex flex-wrap gap-x-8 gap-y-2 mb-3">
            {items.map((item) => {
                const valCls =
                    item.highlight === "primary"
                        ? "text-indigo-600"
                        : item.highlight === "negative"
                            ? "text-rose-500"
                            : "text-gray-800";
                const labelCls =
                    item.highlight === "primary"
                        ? "text-indigo-400"
                        : item.highlight === "negative"
                            ? "text-rose-400"
                            : "text-gray-500";
                return (
                    <div key={item.id} className="flex flex-col">
                        <span className={`text-[22px] font-extrabold leading-none ${valCls}`}>
                            {loading || item.num === null ? (
                                <Skeleton className="h-6 w-16" />
                            ) : (
                                fmtNum(item.num)
                            )}
                        </span>
                        <span className={`text-[11px] mt-1 ${labelCls}`}>{item.label}</span>
                    </div>
                );
            })}
        </div>
    );
};

// ── Toolbar ─────────────────────────────────────────────────────────────
const Toolbar: React.FC<{
    period: Period;
    onPeriod: (p: Period) => void;
    customStartDate: string;
    onCustomStartDateChange: (d: string) => void;
    customEndDate: string;
    onCustomEndDateChange: (d: string) => void;
    sort: SortKey;
    onSort: (s: SortKey) => void;
    onRefresh: () => void;
    onSettings: () => void;
    canSettings: boolean;
    loading: boolean;
}> = ({
    period,
    onPeriod,
    customStartDate,
    onCustomStartDateChange,
    customEndDate,
    onCustomEndDateChange,
    sort,
    onSort,
    onRefresh,
    onSettings,
    canSettings,
    loading,
}) => {
    const periods: Period[] = ["today", "week", "month", "year", "custom", "all"];
    return (
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 flex flex-wrap items-center gap-2 mb-3">
            <div className="flex bg-white/60 backdrop-blur-md p-1.5 rounded-full border border-gray-200 shadow-sm overflow-x-auto">
                {periods.map((p) => (
                    <button
                        key={p}
                        onClick={() => onPeriod(p)}
                        className={`px-5 py-2 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${period === p
                                ? "bg-gray-900 text-white shadow-md"
                                : "text-gray-600 hover:text-gray-900 hover:bg-slate-100"
                            }`}
                    >
                        {PERIOD_LABELS[p]}
                    </button>
                ))}
            </div>

            {period === "custom" && (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                    <DateRangePicker
                        value={{
                            start: customStartDate ? `${customStartDate}T00:00:00` : "",
                            end: customEndDate ? `${customEndDate}T23:59:59` : ""
                        }}
                        onApply={(range) => {
                            if (range.start && range.end) {
                                const startYMD = range.start.split("T")[0];
                                const endYMD = range.end.split("T")[0];
                                onCustomStartDateChange(startYMD);
                                onCustomEndDateChange(endYMD);
                            }
                        }}
                    />
                </div>
            )}

            <span className="text-[11px] text-gray-400 ml-1">
                <span className="font-semibold text-gray-600">{PERIOD_LABELS[period]}:</span>{" "}
                {periodRangeText(period, customStartDate, customEndDate)}
            </span>
            <select
                value={sort}
                onChange={(e) => onSort(e.target.value as SortKey)}
                className="ml-auto px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white text-gray-700 outline-none cursor-pointer"
            >
                <option value="score">คะแนนแนะนำ</option>
                <option value="sales">ยอดขาย</option>
                <option value="orders">จำนวนออเดอร์</option>
                <option value="close_rate">Close rate</option>
                <option value="calls">จำนวนสาย</option>
                <option value="minutes">นาทีโทร</option>
                <option value="customers">จำนวนลูกค้า</option>
            </select>
            <button
                onClick={onRefresh}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                รีเฟรช
            </button>
            {canSettings && (
                <button
                    onClick={onSettings}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold bg-white text-gray-700 hover:bg-gray-50"
                    title="ตั้งค่าเป้าหมาย"
                >
                    <SettingsIcon className="w-3.5 h-3.5" />
                    ตั้งค่า
                </button>
            )}
        </div>
    );
};

// ── StaffCard ─────────────────────────────────────────────────────────
const SEG_COLORS = { new: "#3b82f6", active: "#22c55e", risk: "#f59e0b", tank: "#94a3b8" };
const SEG_LABELS: Record<string, string> = { new: "ใหม่", active: "Active", risk: "เสี่ยง", tank: "ถัง" };

const DepBadge: React.FC<{ dep: string }> = ({ dep }) => {
    const conf =
        dep === "CRM Telesale"
            ? { bg: "#dbeafe", fg: "#1e3a8a" }
            : { bg: "#dcfce7", fg: "#166534" };
    return (
        <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
            style={{ background: conf.bg, color: conf.fg }}
        >
            {dep}
        </span>
    );
};

const StaffCard: React.FC<{
    s: StaffStat;
    period: Period;
    minuteTarget: number;
    rank: number;
}> = ({ s, period, minuteTarget, rank }) => {
    const total = s.assigned_total;
    // Status from quality + activity
    const sc = scoreStaff(s);
    const stripCls = sc > 0.55 ? "bg-green-500" : sc > 0.35 ? "bg-amber-400" : "bg-red-500";
    const statusColor =
        sc > 0.55 ? "text-green-600" : sc > 0.35 ? "text-amber-600" : "text-red-600";
    const statusLabel = sc > 0.55 ? "ทำดี" : sc > 0.35 ? "พอใช้" : "ต้องดู";

    const ordNow = (period === "today" || period === "custom") ? s.orders_today : s.orders_period;
    const saleNow = (period === "today" || period === "custom") ? s.sales_today : s.sales_period;

    // Minute-target progress (when period = today, compare directly. otherwise scale)
    const isToday = period === "today" || period === "custom";
    const minPct = isToday ? Math.round((s.total_min / minuteTarget) * 100) : null;

    const initial = (s.first_name || s.username || "?").charAt(0);

    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-all">
            <div className={`h-0.5 ${stripCls}`} />
            <div className="p-3.5">
                {/* Identity */}
                <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex gap-2.5 items-start">
                        <div className="w-[34px] h-[34px] rounded-lg bg-gray-900 text-white flex items-center justify-center text-sm font-extrabold flex-shrink-0">
                            {initial}
                        </div>
                        <div>
                            <div className="text-sm font-bold text-gray-800 leading-tight flex items-center gap-1.5">
                                {s.name || s.username}
                                {rank === 0 && (
                                    <span className="text-[10px] font-bold px-1 py-0.5 rounded bg-yellow-100 text-yellow-700">
                                        ⭐ TOP
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[11px] text-gray-400">{s.username}</span>
                                <DepBadge dep={s.department} />
                            </div>
                        </div>
                    </div>
                    <div className={`flex items-center gap-1.5 text-xs font-semibold ${statusColor}`}>
                        <span className={`w-[7px] h-[7px] rounded-full ${stripCls}`} />
                        {statusLabel}
                    </div>
                </div>

                {/* Customer base */}
                {total > 0 && (
                    <>
                        <div className="mb-1">
                            <span className="text-2xl font-extrabold text-gray-800 tracking-tight leading-none">
                                {fmtNum(total)}
                            </span>
                            <span className="text-xs text-gray-500 ml-1.5">ลูกค้า</span>
                        </div>
                        <div className="text-[11px] text-gray-400 mb-2.5">
                            {s.qual_pct}% ยังในวงจร
                        </div>
                        {/* Segment bar */}
                        <div className="h-1 rounded-full flex overflow-hidden bg-gray-100 mb-2">
                            {(["new", "active", "risk", "tank"] as const).map((k) => {
                                const v = s[`${k}_count` as const] as number;
                                const pct = total > 0 ? Math.round((v / total) * 100) : 0;
                                return pct > 0 ? (
                                    <div
                                        key={k}
                                        style={{
                                            width: `${pct}%`,
                                            background: SEG_COLORS[k],
                                            minWidth: "2px",
                                        }}
                                    />
                                ) : null;
                            })}
                        </div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 mb-3">
                            {(["new", "active", "risk", "tank"] as const).map((k) => (
                                <div key={k} className="flex items-center gap-1.5 text-[11px]">
                                    <span
                                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                        style={{ background: SEG_COLORS[k] }}
                                    />
                                    <span className="text-gray-400">{SEG_LABELS[k]}</span>
                                    <span className="font-bold text-gray-800 ml-auto">
                                        {s[`${k}_count` as const] as number}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {/* Ratio box */}
                <div className="flex items-center justify-between px-2.5 py-2 bg-gray-50 rounded-lg mb-2">
                    <div>
                        <div className="text-lg font-extrabold text-gray-800 leading-none">
                            {s.calls_per_cust.toFixed(2)}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">สาย ÷ ลูกค้า</div>
                    </div>
                    <div className="text-right text-[11px] text-gray-500 leading-relaxed">
                        {fmtNum(s.calls_total)} สาย
                        <br />
                        {total > 0 ? `${fmtNum(total)} ลูกค้า` : "—"}
                    </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 border border-gray-200 rounded-lg overflow-hidden mb-2">
                    <div className="py-2 text-center">
                        <div className="text-sm font-extrabold text-gray-800">{fmtNum(s.calls_total)}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">สาย</div>
                    </div>
                    <div className="py-2 text-center border-l border-gray-200 relative">
                        <div className="text-sm font-extrabold text-gray-800">
                            {fmtNum(Math.round(s.total_min))}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">นาที</div>
                        {minPct !== null && (
                            <div
                                className={`absolute top-0 right-0 text-[9px] font-bold px-1 py-0.5 rounded-bl ${minPct >= 100
                                    ? "bg-green-500 text-white"
                                    : minPct >= 60
                                        ? "bg-amber-500 text-white"
                                        : "bg-red-500 text-white"
                                    }`}
                                title={`เป้านาทีโทร ${minuteTarget}/วัน`}
                            >
                                {minPct}%
                            </div>
                        )}
                    </div>
                    <div className="py-2 text-center border-l border-gray-200">
                        <div className="text-sm font-extrabold text-gray-800">
                            {s.avg_min ? s.avg_min.toFixed(1) : "—"}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5">avg/สาย</div>
                    </div>
                </div>

                {/* Sales */}
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 rounded-lg mb-2 text-xs">
                    <span className="text-gray-400">ขาย{PERIOD_LABELS[period]}</span>
                    <span className={`font-bold ${ordNow > 0 ? "text-green-700" : "text-gray-400"}`}>
                        {ordNow} ออเดอร์
                    </span>
                    <span className="ml-auto font-semibold text-gray-700">
                        {fmtMoney(saleNow)}
                    </span>
                </div>

                {/* AOV + Close rate */}
                {(s.aov > 0 || s.close_rate > 0) && (
                    <div className="grid grid-cols-2 gap-1.5 mb-2 text-[11px]">
                        {s.aov > 0 && (
                            <div className="bg-purple-50 text-purple-700 px-2 py-1.5 rounded">
                                AOV <b>{fmtMoney(s.aov)}</b>
                            </div>
                        )}
                        {s.close_rate > 0 && (
                            <div className="bg-amber-50 text-amber-700 px-2 py-1.5 rounded">
                                Close <b>{(s.close_rate * 100).toFixed(1)}%</b>
                            </div>
                        )}
                    </div>
                )}

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-100 mt-1">
                    {s.distributed_today > 0 ? (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-green-50 text-green-800 border border-green-200">
                            แจก {s.distributed_today} วันนี้
                        </span>
                    ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-gray-50 text-gray-500 border border-gray-200">
                            ยังไม่แจกวันนี้
                        </span>
                    )}
                    {s.distributed_period > 0 && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                            {PERIOD_LABELS[period]} {s.distributed_period}
                        </span>
                    )}
                    {s.total_distributed > 0 && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-gray-50 text-gray-500 border border-gray-200">
                            รวม {s.total_distributed}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

// ── Settings modal ───────────────────────────────────────────────────
const SettingsModal: React.FC<{
    initial: { daily_calls: number; daily_minutes: number };
    onClose: () => void;
    onSave: (next: { daily_call_target: number; daily_minute_target: number }) => Promise<void>;
}> = ({ initial, onClose, onSave }) => {
    const [calls, setCalls] = useState(String(initial.daily_calls));
    const [minutes, setMinutes] = useState(String(initial.daily_minutes));
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const submit = async () => {
        const c = parseInt(calls, 10);
        const m = parseInt(minutes, 10);
        if (Number.isNaN(c) || c < 1 || c > 500) return setErr("เป้าโทรต้อง 1-500");
        if (Number.isNaN(m) || m < 1 || m > 1440) return setErr("เป้านาทีต้อง 1-1440");
        setSaving(true);
        setErr(null);
        try {
            await onSave({ daily_call_target: c, daily_minute_target: m });
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
                <h2 className="text-lg font-bold text-gray-800 mb-1">ตั้งค่าเป้าหมายต่อวัน</h2>
                <p className="text-sm text-gray-500 mb-4">
                    เป้าใช้ใน Daily Monitoring + Sales Monitoring
                </p>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    สายที่ได้คุย / วัน (default 40)
                </label>
                <input
                    type="number"
                    value={calls}
                    onChange={(e) => setCalls(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 mb-3"
                />
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    นาทีโทร / วัน (default 100)
                </label>
                <input
                    type="number"
                    value={minutes}
                    onChange={(e) => setMinutes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
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
                        onClick={submit}
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

// ── Main Page ────────────────────────────────────────────────────────
const SalesMonitoringPage: React.FC<{ user: User }> = ({ user }) => {
    const apiBase = useMemo(() => resolveApiBasePath(), []);
    const [period, setPeriod] = useState<Period>("week");
    const [customStartDate, setCustomStartDate] = useState<string>(() => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    });
    const [customEndDate, setCustomEndDate] = useState<string>(() => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    });
    const [sort, setSort] = useState<SortKey>("score");
    const [data, setData] = useState<SalesData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showSettings, setShowSettings] = useState(false);
    const [refreshingRealtime, setRefreshingRealtime] = useState(false);

    const canEditSettings = useMemo(() => {
        const r = (user.role || "").toLowerCase();
        return r.includes("admin") || r.includes("supervisor") || r.includes("ceo");
    }, [user]);

    const isTodayInRange = useMemo(() => {
        const d = new Date();
        const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        return period === "today" || (period === "custom" && customStartDate === todayStr && customEndDate === todayStr);
    }, [period, customStartDate, customEndDate]);

    // Overlay realtime OneCall call data onto the DB snapshot (only used when
    // period = today or today is in range).
    const overlayRealtime = useCallback(async (base: SalesData) => {
        setRefreshingRealtime(true);
        try {
            const todayISO = new Date();
            const ymd = `${todayISO.getFullYear()}-${String(todayISO.getMonth() + 1).padStart(2, "0")}-${String(todayISO.getDate()).padStart(2, "0")}`;
            const rt = await fetchOneCallRecordings(ymd);
            if (!rt.success || !rt.recordings) {
                if (rt.error) setError(`OneCall realtime: ${rt.error} (แสดงข้อมูลจาก DB)`);
                return;
            }
            const users = base.staff.map((s) => ({ user_id: s.user_id, phone: s.phone }));
            const agg = aggregateOneCallByUsers(rt.recordings, users);
            const overlay = base.staff.map((s) => {
                const rtMember = agg.members[s.user_id];
                if (!rtMember) return s;
                const callsTotal = rtMember.total_calls;
                const talkedCalls = rtMember.talked_calls;
                const totalMin = rtMember.total_seconds / 60;
                const avgMin = talkedCalls > 0 ? totalMin / talkedCalls : 0;
                const ratio = s.assigned_total > 0 ? callsTotal / s.assigned_total : 0;
                return {
                    ...s,
                    calls_total: callsTotal,
                    talked_calls: talkedCalls,
                    total_min: totalMin,
                    avg_min: avgMin,
                    calls_per_cust: ratio,
                };
            });
            setData({ ...base, staff: overlay });
        } catch (rtErr: any) {
            setError(`OneCall realtime ผิดพลาด: ${rtErr?.message || ""}`);
        } finally {
            setRefreshingRealtime(false);
        }
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const token = localStorage.getItem("authToken");
            const dateParam = period === "custom" ? `&startDate=${customStartDate}&endDate=${customEndDate}` : "";
            const res = await fetch(
                `${apiBase}/Monitor/sales_monitoring.php?period=${period}${dateParam}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                },
            );
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json?.message || `HTTP ${res.status}`);
            const baseData: SalesData = json.data;
            setData(baseData);
            setLoading(false);

            if (isTodayInRange) {
                overlayRealtime(baseData);
            }
        } catch (e: any) {
            setError(e?.message || "โหลดข้อมูลไม่สำเร็จ");
            setLoading(false);
        }
    }, [apiBase, period, customStartDate, customEndDate, isTodayInRange, overlayRealtime]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSaveSettings = async (next: {
        daily_call_target: number;
        daily_minute_target: number;
    }) => {
        const token = localStorage.getItem("authToken");
        const res = await fetch(`${apiBase}/Monitor/settings.php`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(next),
        });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json?.message || `HTTP ${res.status}`);
        await fetchData();
    };

    // Enrich + sort + split by department
    const sortedStaff = useMemo(() => {
        if (!data) return { crm: [], admin: [] };
        const enriched = data.staff.map((s) => ({ ...s, _score: scoreStaff(s) }));
        const sortFn = (a: typeof enriched[number], b: typeof enriched[number]) => {
            switch (sort) {
                case "sales": return b.sales_period - a.sales_period;
                case "orders": return b.orders_period - a.orders_period;
                case "close_rate": return b.close_rate - a.close_rate;
                case "calls": return b.calls_total - a.calls_total;
                case "minutes": return b.total_min - a.total_min;
                case "customers": return b.assigned_total - a.assigned_total;
                case "score":
                default: return b._score - a._score;
            }
        };
        const crm = enriched.filter((s) => s.department === "CRM Telesale").sort(sortFn);
        const admin = enriched.filter((s) => s.department === "Sale Admin").sort(sortFn);
        return { crm, admin };
    }, [data, sort]);

    const insights = useMemo<InsightItem[]>(() => {
        if (!data || data.staff.length === 0) return [];
        const items: InsightItem[] = [];
        const all = data.staff;
        const totalSales = all.reduce((s, m) => s + m.sales_period, 0);
        const totalOrders = all.reduce((s, m) => s + m.orders_period, 0);
        const totalCalls = all.reduce((s, m) => s + m.calls_total, 0);
        const totalMin = all.reduce((s, m) => s + m.total_min, 0);

        items.push({
            tone: "info",
            text: (
                <>
                    {PERIOD_LABELS[data.period]}: ยอด <b>{fmtMoney(totalSales)}</b> /{" "}
                    <b>{fmtNum(totalOrders)}</b> ออเดอร์ — โทร <b>{fmtNum(totalCalls)}</b> สาย /{" "}
                    <b>{fmtNum(Math.round(totalMin))}</b> นาที
                </>
            ),
        });

        const top = [...all].sort((a, b) => b.sales_period - a.sales_period)[0];
        if (top && top.sales_period > 0) {
            items.push({
                tone: "highlight",
                text: (
                    <>
                        <b>ยอดขายสูงสุด:</b>{" "}
                        <b className="text-yellow-700">{top.name}</b> ทำได้{" "}
                        <b>{fmtMoney(top.sales_period)}</b> ({top.orders_period} ออเดอร์)
                    </>
                ),
            });
        }

        if (data.period === "today" || data.period === "custom") {
            const minTarget = data.targets.daily_minutes;
            const under = all.filter((s) => s.total_min < minTarget * 0.6 && s.calls_total > 0);
            if (under.length > 0) {
                items.push({
                    tone: "bad",
                    text: (
                        <>
                            <b>นาทีโทรต่ำกว่า 60% ของเป้า ({minTarget} นาที):</b>{" "}
                            {under.slice(0, 4).map((m, i) => (
                                <span key={m.user_id}>
                                    {i > 0 && ", "}
                                    <b>{m.name}</b> ({Math.round(m.total_min)})
                                </span>
                            ))}
                            {under.length > 4 && ` และอีก ${under.length - 4} คน`}
                        </>
                    ),
                });
            }
        }

        const bestClose = [...all]
            .filter((s) => s.assigned_total >= 50)
            .sort((a, b) => b.close_rate - a.close_rate)[0];
        if (bestClose && bestClose.close_rate > 0) {
            items.push({
                tone: "good",
                text: (
                    <>
                        <b>Close rate สูงสุด:</b>{" "}
                        <b className="text-green-700">{bestClose.name}</b> —{" "}
                        <b>{(bestClose.close_rate * 100).toFixed(1)}%</b> ของลูกค้าในมือ
                    </>
                ),
            });
        }

        const idleSales = all.filter((s) => s.orders_period === 0 && s.assigned_total > 50);
        if (idleSales.length > 0) {
            items.push({
                tone: "warn",
                text: (
                    <>
                        <b>{idleSales.length} คน</b>ที่มีลูกค้าในมือ &gt;50 แต่ยังไม่ปิดบิลใน{PERIOD_LABELS[data.period]}:{" "}
                        {idleSales.slice(0, 4).map((m, i) => (
                            <span key={m.user_id}>
                                {i > 0 && ", "}
                                {m.name}
                            </span>
                        ))}
                        {idleSales.length > 4 && ` และอีก ${idleSales.length - 4} คน`}
                    </>
                ),
            });
        }

        return items;
    }, [data]);

    const minuteTarget = data?.targets.daily_minutes || 100;

    return (
        <div className="p-4 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-xl font-bold text-gray-950 flex items-center gap-2">
                        <span>📊</span> ภาพรวมทีมขาย
                        {isTodayInRange && (
                            loading || refreshingRealtime ? (
                                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 animate-pulse">
                                    กำลังอัปเดตสาย...
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                    Realtime
                                </span>
                            )
                        )}
                    </h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        ลูกค้าในมือ / โทร / ยอดขาย / การแจกงาน — แยกตามคน
                    </p>
                </div>
            </div>

            <SummaryBar data={data || undefined} loading={loading} />
            <Toolbar
                period={period}
                onPeriod={setPeriod}
                customStartDate={customStartDate}
                onCustomStartDateChange={setCustomStartDate}
                customEndDate={customEndDate}
                onCustomEndDateChange={setCustomEndDate}
                sort={sort}
                onSort={setSort}
                onRefresh={fetchData}
                onSettings={() => setShowSettings(true)}
                canSettings={canEditSettings}
                loading={loading}
            />

            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                    {error}
                </div>
            )}

            {/* Insights */}
            {!loading && insights.length > 0 && <TeamInsights items={insights} />}

            {/* CRM Telesale section */}
            {(sortedStaff.crm.length > 0 || loading) && (
                <>
                    <div className="flex items-center justify-between mb-2 mt-4">
                        <h3 className="text-md font-bold text-gray-800 flex items-center gap-2">
                            <span className="text-lg">🎯</span> CRM Telesale
                            <span className="text-xs font-normal text-gray-500">
                                ({sortedStaff.crm.length} คน)
                            </span>
                        </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-5">
                        {loading
                            ? Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
                                    <div className="flex items-center gap-3">
                                        <Skeleton className="w-9 h-9 rounded-lg" />
                                        <div className="flex-1 space-y-2">
                                            <Skeleton className="h-3 w-24" />
                                            <Skeleton className="h-2.5 w-16" />
                                        </div>
                                    </div>
                                    <Skeleton className="h-6 w-20" />
                                    <Skeleton className="h-1 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                    <Skeleton className="h-10 w-full" />
                                </div>
                            ))
                            : sortedStaff.crm.map((s, i) => (
                                <StaffCard
                                    key={s.user_id}
                                    s={s}
                                    period={period}
                                    minuteTarget={minuteTarget}
                                    rank={i}
                                />
                            ))}
                    </div>
                </>
            )}

            {/* Sale Admin section */}
            {sortedStaff.admin.length > 0 && (
                <>
                    <div className="flex items-center justify-between mb-2 mt-4">
                        <h3 className="text-md font-bold text-gray-800 flex items-center gap-2">
                            <span className="text-lg">💼</span> Sale Admin
                            <span className="text-xs font-normal text-gray-500">
                                ({sortedStaff.admin.length} คน)
                            </span>
                        </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-5">
                        {sortedStaff.admin.map((s, i) => (
                            <StaffCard
                                key={s.user_id}
                                s={s}
                                period={period}
                                minuteTarget={minuteTarget}
                                rank={i}
                            />
                        ))}
                    </div>
                </>
            )}

            {showSettings && (
                <SettingsModal
                    initial={data?.targets || { daily_calls: 40, daily_minutes: 100 }}
                    onClose={() => setShowSettings(false)}
                    onSave={handleSaveSettings}
                />
            )}
        </div>
    );
};

export default SalesMonitoringPage;
