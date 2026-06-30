import React, { useState, useEffect, useMemo, useCallback } from "react";
import { User } from "../types";
import { apiFetch } from "../services/api";
import { Download, Loader2, BarChart3, ChevronDown, ChevronRight, ChevronLeft, Users, HelpCircle } from "lucide-react";
import ExportTypeModal from "../components/ExportTypeModal";
import { downloadDataFile } from "../utils/exportUtils";

interface Props { currentUser: User; }

interface Metrics { names_called: number; total_calls: number; answered: number; missed: number; talked: number; orders: number; sales: number; }
interface Period { a: Metrics; b: Metrics; }
interface SegmentRow { segment: string; owned: number; a: Metrics; b: Metrics; }
interface AgentRow {
    agent_id: number; username: string; label: string; name: string;
    role_label: string; team_key: string; team_name: string; is_head: boolean; is_inactive: boolean;
    owned: number; total: Period; segments: SegmentRow[];
}
interface TeamGroup { team_key: string; team_name: string; owned: number; total: Period; agents: AgentRow[]; }
interface ApiResp {
    success: boolean;
    periods: { a: { month: number; year: number }; b: { month: number; year: number } };
    has_teams: boolean;
    teams_list: { key: string; name: string }[];
    agents_list: { id: number; label: string; team_key: string }[];
    owned: number;
    total: Period | null;
    groups: TeamGroup[];
}

const THAI_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

const intFmt = (n: number) => (n || 0).toLocaleString("th-TH");
const moneyFmt = (n: number) => new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0);
const basketSize = (m: Metrics) => (m.orders > 0 ? m.sales / m.orders : 0);

const CELL = "px-3 py-3 text-right whitespace-nowrap text-[13px] text-gray-700 tabular-nums";
const SUB = "text-[11px] text-gray-400 font-normal leading-tight mt-0.5";
const AVATAR_PALETTE = ["bg-sky-100 text-sky-700", "bg-violet-100 text-violet-700", "bg-amber-100 text-amber-700", "bg-rose-100 text-rose-700", "bg-emerald-100 text-emerald-700", "bg-indigo-100 text-indigo-700"];
const avatarColor = (seed: string) => AVATAR_PALETTE[[...seed].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_PALETTE.length];

const Avatar: React.FC<{ label: string; muted?: boolean }> = ({ label, muted }) => (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-semibold flex-shrink-0 ${muted ? "bg-gray-100 text-gray-400" : avatarColor(label)}`}>
        {label.trim().charAt(0) || "?"}
    </span>
);

// Column definitions with hover tooltip explaining the calculation/meaning.
// Each cell may show a smaller secondary line below the main number to save horizontal space.
const COLS = [
    { key: "names_called", label: "ชื่อที่โทร", tip: "จำนวนลูกค้า (เบอร์ไม่ซ้ำ) ที่โทรออกไปหาในเดือนนี้ — นับจาก call_import_logs สายโทรออก, จัดกลุ่มตามถังปัจจุบันของลูกค้า" },
    { key: "total_calls", label: "สายโทร", tip: "จำนวนสายโทรออกทั้งหมด ตัวเล็กด้านล่าง = รับสาย/ไม่รับสาย (status เชื่อมต่อ ไม่ว่าจะคุยนานแค่ไหน)" },
    { key: "talked", label: "ได้คุย", tip: "จำนวนสายที่รับและคุยจริง = สถานะรับสาย และระยะเวลา ≥ 30 วินาที (จากระบบบันทึกเวลาคุยของผู้ให้บริการ)" },
    { key: "orders", label: "ออเดอร์", tip: "จำนวนออเดอร์ที่ปิดได้ (ไม่รวมที่ยกเลิก) ตัวเล็กด้านล่าง = %Con (ออเดอร์ ÷ ชื่อที่โทร × 100) — จัดกลุ่มตามถังขณะที่ปิดการขาย (basket ณ ตอนขาย)" },
    { key: "sales", label: "ยอดขาย", tip: "ยอดขายสุทธิ (ไม่รวมของแถมและออเดอร์ที่ยกเลิก) ตัวเล็กด้านล่าง = Basket Size เฉลี่ยต่อออเดอร์" },
];

const InfoTip: React.FC<{ text: string }> = ({ text }) => (
    <span className="relative inline-flex ml-1 group cursor-help align-middle">
        <HelpCircle className="w-3 h-3 text-gray-300 group-hover:text-gray-500 transition-colors" />
        <span className="absolute top-full right-0 mt-1.5 hidden group-hover:block w-56 px-3 py-2 text-[11px] leading-snug text-white bg-gray-800 rounded-xl shadow-lg z-[60] text-left font-normal normal-case whitespace-normal">{text}</span>
    </span>
);

// Soft colored pill for a %-style figure (used for sub-line %Con and the Diff/%Diff columns)
const Pill: React.FC<{ children: React.ReactNode; tone: "up" | "down" | "neutral" }> = ({ children, tone }) => {
    const cls = tone === "up" ? "bg-emerald-100 text-emerald-700" : tone === "down" ? "bg-rose-100 text-rose-700" : "bg-gray-100 text-gray-500";
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${cls}`}>{children}</span>;
};

// tint = faint background wash so the eye can tell "this column belongs to the recent/older block"
// without re-reading the header — recent (left) gets a blue wash, older (right) stays plain white.
const MetricCells: React.FC<{ m: Metrics; tint?: "recent" | "older" }> = ({ m, tint }) => {
    const bg = tint === "recent" ? "bg-blue-50/40" : "";
    return (
        <>
            <td className={`${CELL} ${bg}`}>{intFmt(m.names_called)}</td>
            <td className={`${CELL} ${bg}`}>
                <div>{intFmt(m.total_calls)}</div>
                <div className={SUB}>รับ {intFmt(m.answered)} · ไม่รับ {intFmt(m.missed)}</div>
            </td>
            <td className={`${CELL} ${bg}`}>{intFmt(m.talked)}</td>
            <td className={`${CELL} ${bg}`}>
                <div>{intFmt(m.orders)}</div>
                <div className="mt-0.5"><Pill tone="neutral">{pct(m.orders, m.names_called).toFixed(2)}%</Pill></div>
            </td>
            <td className={`${CELL} ${bg} font-semibold text-gray-900`}>
                <div>{moneyFmt(m.sales)}</div>
                <div className={SUB}>เฉลี่ย {moneyFmt(basketSize(m))}</div>
            </td>
        </>
    );
};

const OwnedCell: React.FC<{ n: number }> = ({ n }) => (
    <td className={CELL + " text-gray-500"}>{intFmt(n)}</td>
);

// The Diff block gets its own solid amber wash (header + body) so it reads as one distinct
// "comparison result" panel instead of blending into the surrounding raw-number columns.
const DiffCells: React.FC<{ a: Metrics; b: Metrics }> = ({ a, b }) => {
    const diff = (b.sales || 0) - (a.sales || 0);
    const pdiff = a.sales > 0 ? (diff / a.sales) * 100 : (b.sales > 0 ? 100 : 0);
    const tone: "up" | "down" | "neutral" = diff > 0 ? "up" : diff < 0 ? "down" : "neutral";
    const sign = diff > 0 ? "+" : "";
    return (
        <>
            <td className={`${CELL} bg-amber-50/70 ${tone === "up" ? "text-emerald-700" : tone === "down" ? "text-rose-600" : "text-gray-400"} font-bold`}>
                {diff === 0 ? "-" : sign + moneyFmt(diff)}
            </td>
            <td className={`${CELL} bg-amber-50/70`}>
                {(a.sales > 0 || b.sales > 0) ? <Pill tone={tone}>{sign}{pdiff.toFixed(2)}%</Pill> : <span className="text-gray-300">-</span>}
            </td>
        </>
    );
};

const TelesaleCampaignComparePage: React.FC<Props> = ({ currentUser }) => {
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const [monthA, setMonthA] = useState(prev.getMonth() + 1);
    const [yearA, setYearA] = useState(prev.getFullYear());
    const [monthB, setMonthB] = useState(now.getMonth() + 1);
    const [yearB, setYearB] = useState(now.getFullYear());
    const [agentId, setAgentId] = useState(0);
    const [teamKey, setTeamKey] = useState("");
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<ApiResp | null>(null);
    const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set());
    const [collapsedAgents, setCollapsedAgents] = useState<Set<number>>(new Set());
    const [isExportOpen, setIsExportOpen] = useState(false);

    const yearOptions = useMemo(() => {
        const cur = new Date().getFullYear();
        return [cur, cur - 1, cur - 2];
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                month_a: String(monthA), year_a: String(yearA),
                month_b: String(monthB), year_b: String(yearB),
            });
            if (agentId > 0) params.set("agent_id", String(agentId));
            else if (teamKey) params.set("team", teamKey);
            const res = await apiFetch(`Reports/telesale_campaign_compare.php?${params}`);
            setData(res?.success ? res : null);
        } catch (e) {
            console.error("Campaign compare fetch error:", e);
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [monthA, yearA, monthB, yearB, agentId, teamKey]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // When team filter changes, reset agent filter if agent not in team
    const agentOptions = useMemo(() => {
        if (!data) return [];
        if (teamKey) return data.agents_list.filter(a => a.team_key === teamKey);
        return data.agents_list;
    }, [data, teamKey]);

    const toggleTeam = (k: string) => setCollapsedTeams(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });
    const toggleAgent = (id: number) => setCollapsedAgents(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

    const labelA = `${THAI_MONTHS_SHORT[monthA - 1]} ${yearA + 543}`;
    const labelB = `${THAI_MONTHS_SHORT[monthB - 1]} ${yearB + 543}`;

    // --- Quick compare presets (set BOTH periods at once). Deltas are months relative to current month.
    // b is always the recent period (shown on the left in the table), a is the older one being
    // compared against (shown on the right) — labels read recent-first to match that layout.
    const PRESETS = [
        { label: "เดือนนี้ ← เดือนที่แล้ว", a: -1, b: 0 },
        { label: "เดือนที่แล้ว ← 2 เดือนก่อน", a: -2, b: -1 },
        { label: "ปีนี้ ← ปีก่อน (เดือนเดียวกัน)", a: -12, b: 0 },
    ];
    const pairKey = (am: number, ay: number, bm: number, by: number) => `${ay}-${am}_${by}-${bm}`;
    const presetPair = (aD: number, bD: number) => {
        const base = new Date();
        const a = new Date(base.getFullYear(), base.getMonth() + aD, 1);
        const b = new Date(base.getFullYear(), base.getMonth() + bD, 1);
        return { am: a.getMonth() + 1, ay: a.getFullYear(), bm: b.getMonth() + 1, by: b.getFullYear() };
    };
    const applyPair = (p: { am: number; ay: number; bm: number; by: number }) => {
        setMonthA(p.am); setYearA(p.ay); setMonthB(p.bm); setYearB(p.by);
    };
    const currentKey = pairKey(monthA, yearA, monthB, yearB);
    const shiftBoth = (d: number) => {
        const a = new Date(yearA, monthA - 1 + d, 1);
        const b = new Date(yearB, monthB - 1 + d, 1);
        applyPair({ am: a.getMonth() + 1, ay: a.getFullYear(), bm: b.getMonth() + 1, by: b.getFullYear() });
    };

    const handleExport = (type: 'csv' | 'xlsx') => {
        if (!data) return;
        // Export keeps full per-metric detail (answered/missed, Basket Size, %Con as separate columns)
        // even though the on-screen table merges them into compact two-line cells.
        // Column order mirrors the on-screen table: recent month (B) first, then Diff, then older month (A).
        const colNames = ["ชื่อที่โทร", "สายโทร", "รับสาย", "ไม่รับสาย", "ได้คุย", "ออเดอร์", "Basket Size", "ยอดขาย", "%Con"];
        const head1 = ["", "", labelB, ...Array(colNames.length - 1).fill(""), "Diff", "%Diff", labelA, ...Array(colNames.length - 1).fill("")];
        const head2 = ["ทีม / Agent / Segment", "ลูกค้าที่ดูแล", ...colNames, "Diff (ยอดขาย)", "%Diff", ...colNames];
        const mc = (m: Metrics) => [m.names_called, m.total_calls, m.answered, m.missed, m.talked, m.orders, +basketSize(m).toFixed(2), +m.sales.toFixed(2), +pct(m.orders, m.names_called).toFixed(2)];
        const rowOf = (label: string, p: Period, owned: number) => {
            const diff = p.b.sales - p.a.sales;
            const pdiff = p.a.sales > 0 ? (diff / p.a.sales) * 100 : (p.b.sales > 0 ? 100 : 0);
            return [label, owned, ...mc(p.b), +diff.toFixed(2), +pdiff.toFixed(2), ...mc(p.a)];
        };
        const rows: any[][] = [head1, head2];
        if (data.total) rows.push(rowOf("รวมทั้งหมด (Total)", data.total, data.owned));
        for (const g of data.groups) {
            if (data.has_teams) rows.push(rowOf(`ทีม ${g.team_name}`, g.total, g.owned));
            for (const ag of g.agents) {
                rows.push(rowOf((data.has_teams ? "  " : "") + ag.label + (ag.is_inactive ? " (ออก)" : ""), ag.total, ag.owned));
                for (const seg of ag.segments) rows.push(rowOf((data.has_teams ? "    " : "  ") + seg.segment, { a: seg.a, b: seg.b }, seg.owned));
            }
        }
        downloadDataFile(rows, `campaign_compare_${yearA}-${String(monthA).padStart(2, "0")}_vs_${yearB}-${String(monthB).padStart(2, "0")}`, type);
        setIsExportOpen(false);
    };

    return (
        <div className="flex flex-col h-full bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b px-4 py-3 flex-shrink-0">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-green-600" />
                        <h1 className="text-lg font-bold text-gray-800">แคมเปญรายคน</h1>
                        <span className="text-xs text-gray-400 ml-1">{labelB} vs {labelA}</span>
                    </div>
                    <button onClick={() => setIsExportOpen(true)} disabled={!data || data.groups.length === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-md text-xs font-medium hover:bg-green-700 disabled:opacity-40 transition-colors">
                        <Download className="w-3.5 h-3.5" /> ดาวน์โหลด Export
                    </button>
                </div>
                {/* Quick compare presets + stepper (change both periods at once) */}
                <div className="flex items-center gap-2 flex-wrap mb-2">
                    {PRESETS.map((p, i) => {
                        const pp = presetPair(p.a, p.b);
                        const active = currentKey === pairKey(pp.am, pp.ay, pp.bm, pp.by);
                        return (
                            <button key={i} onClick={() => applyPair(pp)}
                                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all border ${active ? "bg-green-600 text-white border-green-600 shadow-sm" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"}`}>
                                {p.label}
                            </button>
                        );
                    })}
                    <div className="flex items-center gap-1 ml-1 bg-gray-100 rounded-md px-1 py-0.5">
                        <button onClick={() => shiftBoth(-1)} title="ถอยทั้งคู่ 1 เดือน"
                            className="p-1 rounded hover:bg-white text-gray-600"><ChevronLeft className="w-3.5 h-3.5" /></button>
                        <span className="text-[10px] text-gray-500 px-1 whitespace-nowrap">เลื่อนช่วง</span>
                        <button onClick={() => shiftBoth(1)} title="เดินหน้าทั้งคู่ 1 เดือน"
                            className="p-1 rounded hover:bg-white text-gray-600"><ChevronRight className="w-3.5 h-3.5" /></button>
                    </div>
                </div>
                <div className="flex items-center gap-4 flex-wrap text-xs">
                    <div className="flex items-center gap-1">
                        <span className="text-blue-600 font-medium">เดือนล่าสุด:</span>
                        <select value={yearB} onChange={e => setYearB(Number(e.target.value))} className="border border-gray-300 rounded px-1.5 py-1 bg-white">
                            {yearOptions.map(y => <option key={y} value={y}>{y + 543}</option>)}
                        </select>
                        <select value={monthB} onChange={e => setMonthB(Number(e.target.value))} className="border border-gray-300 rounded px-1.5 py-1 bg-white">
                            {THAI_MONTHS_SHORT.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                        </select>
                    </div>
                    <span className="text-gray-400">←</span>
                    <div className="flex items-center gap-1">
                        <span className="text-gray-500 font-medium">เทียบกับ:</span>
                        <select value={yearA} onChange={e => setYearA(Number(e.target.value))} className="border border-gray-300 rounded px-1.5 py-1 bg-white">
                            {yearOptions.map(y => <option key={y} value={y}>{y + 543}</option>)}
                        </select>
                        <select value={monthA} onChange={e => setMonthA(Number(e.target.value))} className="border border-gray-300 rounded px-1.5 py-1 bg-white">
                            {THAI_MONTHS_SHORT.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                        </select>
                    </div>
                    {/* Team filter (only if teams exist) */}
                    {data?.has_teams && (
                        <div className="flex items-center gap-1">
                            <span className="text-gray-500 font-medium">ทีม:</span>
                            <select value={teamKey} onChange={e => { setTeamKey(e.target.value); setAgentId(0); }}
                                className="border border-gray-300 rounded px-1.5 py-1 bg-white min-w-[110px]">
                                <option value="">ทุกทีม</option>
                                {data.teams_list.map(t => <option key={t.key} value={t.key}>{t.name}</option>)}
                            </select>
                        </div>
                    )}
                    {/* Agent filter */}
                    <div className="flex items-center gap-1">
                        <span className="text-gray-500 font-medium">พนักงาน:</span>
                        <select value={agentId} onChange={e => setAgentId(Number(e.target.value))}
                            className="border border-gray-300 rounded px-1.5 py-1 bg-white min-w-[140px]">
                            <option value={0}>ทุกคน</option>
                            {agentOptions.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto px-4 py-2">
                {loading ? (
                    <div className="h-full flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-green-600 animate-spin" />
                        <span className="ml-2 text-sm text-gray-500">กำลังโหลด...</span>
                    </div>
                ) : !data || data.groups.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-gray-400 text-sm">ไม่พบข้อมูลในช่วงเดือนที่เลือก</div>
                ) : (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-auto">
                        <table className="w-full border-collapse min-w-[1700px]">
                            <thead className="sticky top-0 z-30">
                                <tr className="bg-white">
                                    <th rowSpan={2} className="px-4 py-3 text-left font-medium text-gray-400 text-[11px] uppercase tracking-wide sticky left-0 bg-white z-40 min-w-[240px] border-b-2 border-gray-100">ทีม / Agent / Segment</th>
                                    <th rowSpan={2} className="px-3 py-3 text-right font-medium text-gray-400 text-[11px] uppercase tracking-wide border-b-2 border-gray-100">
                                        <span className="inline-flex items-center justify-end">ลูกค้าที่ดูแล<InfoTip text="จำนวนลูกค้าที่ผูกกับ agent คนนี้อยู่ในถังนี้ขณะนี้ (assigned_to ปัจจุบัน) — เป็นค่าปัจจุบัน ใช้ร่วมกันทั้งสองเดือนที่เลือก ไม่ได้แยกตามเดือน" /></span>
                                    </th>
                                    <th colSpan={COLS.length} className="px-3 py-2.5 text-center font-bold text-blue-700 text-[12px] border-b-2 border-blue-100 bg-blue-50/60 border-l border-gray-100">
                                        {labelB} <span className="font-normal text-blue-400">(ล่าสุด)</span>
                                    </th>
                                    <th colSpan={2} className="px-3 py-2.5 text-center font-bold text-amber-700 text-[12px] border-b-2 border-amber-100 bg-amber-50/70 border-l border-amber-100">เทียบยอดขาย</th>
                                    <th colSpan={COLS.length} className="px-3 py-2.5 text-center font-semibold text-gray-500 text-[12px] border-b-2 border-gray-100 bg-gray-50/60 border-l border-gray-100">
                                        {labelA} <span className="font-normal text-gray-400">(ก่อนหน้า)</span>
                                    </th>
                                </tr>
                                <tr>
                                    {COLS.map((c, i) => (
                                        <th key={`b${i}`} className={`px-3 py-2 text-right font-medium text-blue-500 text-[11px] border-b-2 border-blue-100 bg-blue-50/40 ${i === 0 ? "border-l border-gray-100" : ""}`}>
                                            <span className="inline-flex items-center justify-end">{c.label}<InfoTip text={c.tip} /></span>
                                        </th>
                                    ))}
                                    <th className="px-3 py-2 text-right font-medium text-amber-600 text-[11px] border-b-2 border-amber-100 bg-amber-50/70 border-l border-amber-100">
                                        <span className="inline-flex items-center justify-end">Diff<InfoTip text="ผลต่างยอดขาย = เดือนล่าสุด − เดือนก่อนหน้า" /></span>
                                    </th>
                                    <th className="px-3 py-2 text-right font-medium text-amber-600 text-[11px] border-b-2 border-amber-100 bg-amber-50/70">
                                        <span className="inline-flex items-center justify-end">%Diff<InfoTip text="ผลต่างยอดขายคิดเป็นเปอร์เซ็นต์ = (ล่าสุด − ก่อนหน้า) ÷ ก่อนหน้า × 100" /></span>
                                    </th>
                                    {COLS.map((c, i) => (
                                        <th key={`a${i}`} className={`px-3 py-2 text-right font-medium text-gray-400 text-[11px] border-b-2 border-gray-100 bg-gray-50/40 ${i === 0 ? "border-l border-amber-100" : ""}`}>
                                            <span className="inline-flex items-center justify-end">{c.label}<InfoTip text={c.tip} /></span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {/* Grand total */}
                                {data.total && (
                                    <tr className="bg-indigo-50/60 font-bold text-indigo-900 border-b border-indigo-100">
                                        <td className="px-4 py-3.5 text-left sticky left-0 bg-indigo-50/60 z-20 border-l-4 border-indigo-400">
                                            <span className="inline-flex items-center gap-2.5">
                                                <Avatar label="รวม" />
                                                รวมทั้งหมด (Total)
                                            </span>
                                        </td>
                                        <td className="px-3 py-3.5 text-right text-indigo-700">{intFmt(data.owned)}</td>
                                        <MetricCells m={data.total.b} tint="recent" />
                                        <DiffCells a={data.total.a} b={data.total.b} />
                                        <MetricCells m={data.total.a} />
                                    </tr>
                                )}
                                {data.groups.map((g, gi) => {
                                    const teamCollapsed = collapsedTeams.has(g.team_key);
                                    return (
                                        <React.Fragment key={g.team_key + gi}>
                                            {/* Team header (only when teams exist) */}
                                            {data.has_teams && (
                                                <tr className="bg-slate-50 font-bold text-gray-800 hover:bg-slate-100 cursor-pointer transition-colors border-b border-gray-100" onClick={() => toggleTeam(g.team_key)}>
                                                    <td className="px-4 py-3 text-left sticky left-0 bg-slate-50 z-20">
                                                        <span className="inline-flex items-center gap-2.5">
                                                            {teamCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                                                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex-shrink-0"><Users className="w-3.5 h-3.5" /></span>
                                                            ทีม {g.team_name}
                                                            <span className="text-[11px] font-normal text-gray-400">({g.agents.length} คน)</span>
                                                        </span>
                                                    </td>
                                                    <OwnedCell n={g.owned} />
                                                    <MetricCells m={g.total.b} tint="recent" />
                                                    <DiffCells a={g.total.a} b={g.total.b} />
                                                    <MetricCells m={g.total.a} />
                                                </tr>
                                            )}
                                            {!teamCollapsed && g.agents.map(ag => {
                                                const agentCollapsed = collapsedAgents.has(ag.agent_id);
                                                return (
                                                    <React.Fragment key={ag.agent_id}>
                                                        <tr className="bg-white font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors border-b border-gray-100" onClick={() => toggleAgent(ag.agent_id)}>
                                                            <td className={`px-4 py-3 text-left sticky left-0 bg-white z-20 ${data.has_teams ? 'pl-9' : ''}`} title={ag.name}>
                                                                <span className="inline-flex items-center gap-2.5">
                                                                    {agentCollapsed ? <ChevronRight className="w-3 h-3 text-gray-400" /> : <ChevronDown className="w-3 h-3 text-gray-400" />}
                                                                    <Avatar label={ag.label} muted={ag.is_inactive} />
                                                                    <span className={ag.is_inactive ? "text-gray-400" : ""}>{ag.label}</span>
                                                                    {ag.is_inactive && <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">ออก</span>}
                                                                </span>
                                                            </td>
                                                            <OwnedCell n={ag.owned} />
                                                            <MetricCells m={ag.total.b} tint="recent" />
                                                            <DiffCells a={ag.total.a} b={ag.total.b} />
                                                            <MetricCells m={ag.total.a} />
                                                        </tr>
                                                        {!agentCollapsed && ag.segments.map((seg, si) => (
                                                            <tr key={si} className="hover:bg-gray-50/70 text-gray-400 transition-colors border-b border-gray-50">
                                                                <td className={`px-4 py-2.5 text-left sticky left-0 bg-white z-20 text-[12px] ${data.has_teams ? 'pl-[4.25rem]' : 'pl-14'}`}>{seg.segment}</td>
                                                                <OwnedCell n={seg.owned} />
                                                                <MetricCells m={seg.b} tint="recent" />
                                                                <DiffCells a={seg.a} b={seg.b} />
                                                                <MetricCells m={seg.a} />
                                                            </tr>
                                                        ))}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <ExportTypeModal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} onConfirm={handleExport} />
        </div>
    );
};

export default TelesaleCampaignComparePage;
