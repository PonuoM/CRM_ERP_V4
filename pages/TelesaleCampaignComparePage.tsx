import React, { useState, useEffect, useMemo, useCallback } from "react";
import { User } from "../types";
import { apiFetch } from "../services/api";
import { Download, Loader2, BarChart3, ChevronDown, ChevronRight, Users, HelpCircle } from "lucide-react";
import ExportTypeModal from "../components/ExportTypeModal";
import { downloadDataFile } from "../utils/exportUtils";

interface Props { currentUser: User; }

interface Metrics { names_called: number; total_calls: number; talked: number; orders: number; sales: number; }
interface Period { a: Metrics; b: Metrics; }
interface SegmentRow { segment: string; a: Metrics; b: Metrics; }
interface AgentRow {
    agent_id: number; username: string; label: string; name: string;
    role_label: string; team_key: string; team_name: string; is_head: boolean; is_inactive: boolean;
    total: Period; segments: SegmentRow[];
}
interface TeamGroup { team_key: string; team_name: string; total: Period; agents: AgentRow[]; }
interface ApiResp {
    success: boolean;
    periods: { a: { month: number; year: number }; b: { month: number; year: number } };
    has_teams: boolean;
    teams_list: { key: string; name: string }[];
    agents_list: { id: number; label: string; team_key: string }[];
    total: Period | null;
    groups: TeamGroup[];
}

const THAI_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

const intFmt = (n: number) => (n || 0).toLocaleString("th-TH");
const moneyFmt = (n: number) => new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0);
const basketSize = (m: Metrics) => (m.orders > 0 ? m.sales / m.orders : 0);

const CELL = "px-2 py-1 text-right whitespace-nowrap border-r border-gray-100 text-[11px]";

// Column definitions with hover tooltip explaining the calculation/meaning
const COLS = [
    { key: "names_called", label: "ชื่อที่โทร", tip: "จำนวนลูกค้า (เบอร์ไม่ซ้ำ) ที่โทรออกไปหาในเดือนนี้ — นับจาก call_import_logs สายโทรออก, จัดกลุ่มตามถังปัจจุบันของลูกค้า" },
    { key: "total_calls", label: "สายโทร", tip: "จำนวนสายโทรออกทั้งหมด (รวมสายที่ไม่รับ) ในเดือนนี้" },
    { key: "talked", label: "ได้คุย", tip: "จำนวนสายที่รับและคุยจริง = สถานะรับสาย และระยะเวลา ≥ 30 วินาที (จากระบบบันทึกเวลาคุยของผู้ให้บริการ)" },
    { key: "orders", label: "ออเดอร์", tip: "จำนวนออเดอร์ที่ปิดได้ (ไม่รวมที่ยกเลิก) — จัดกลุ่มตามถังขณะที่ปิดการขาย (basket ณ ตอนขาย)" },
    { key: "basket", label: "Basket Size", tip: "ยอดขายเฉลี่ยต่อออเดอร์ = ยอดขาย ÷ จำนวนออเดอร์" },
    { key: "sales", label: "ยอดขาย", tip: "ยอดขายสุทธิ (ไม่รวมของแถมและออเดอร์ที่ยกเลิก)" },
    { key: "con", label: "%Con", tip: "อัตราปิดการขาย = ออเดอร์ ÷ ชื่อที่โทร × 100" },
];

const InfoTip: React.FC<{ text: string }> = ({ text }) => (
    <span className="relative inline-flex ml-0.5 group cursor-help align-middle">
        <HelpCircle className="w-2.5 h-2.5 text-gray-400 group-hover:text-gray-600" />
        <span className="absolute top-full right-0 mt-1 hidden group-hover:block w-52 px-2.5 py-1.5 text-[10px] leading-snug text-white bg-gray-800 rounded-lg shadow-lg z-[60] text-left font-normal normal-case whitespace-normal">{text}</span>
    </span>
);

const MetricCells: React.FC<{ m: Metrics }> = ({ m }) => (
    <>
        <td className={CELL}>{intFmt(m.names_called)}</td>
        <td className={CELL}>{intFmt(m.total_calls)}</td>
        <td className={CELL}>{intFmt(m.talked)}</td>
        <td className={CELL}>{intFmt(m.orders)}</td>
        <td className={CELL}>{moneyFmt(basketSize(m))}</td>
        <td className={CELL + " font-medium text-emerald-700"}>{moneyFmt(m.sales)}</td>
        <td className={CELL}>{pct(m.orders, m.names_called).toFixed(2)}%</td>
    </>
);

const DiffCells: React.FC<{ a: Metrics; b: Metrics }> = ({ a, b }) => {
    const diff = (b.sales || 0) - (a.sales || 0);
    const pdiff = a.sales > 0 ? (diff / a.sales) * 100 : (b.sales > 0 ? 100 : 0);
    const color = diff > 0 ? "text-green-600" : diff < 0 ? "text-red-600" : "text-gray-400";
    const sign = diff > 0 ? "+" : "";
    return (
        <>
            <td className={`${CELL} ${color} font-medium bg-amber-50/40`}>{diff === 0 ? "-" : sign + moneyFmt(diff)}</td>
            <td className={`${CELL} ${color} bg-amber-50/40`}>{(a.sales > 0 || b.sales > 0) ? sign + pdiff.toFixed(2) + "%" : "-"}</td>
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

    const handleExport = (type: 'csv' | 'xlsx') => {
        if (!data) return;
        const colNames = COLS.map(c => c.label);
        const head1 = ["", labelA, "", "", "", "", "", "", "Diff", "%Diff", labelB, "", "", "", "", "", ""];
        const head2 = ["ทีม / Agent / Segment", ...colNames, "Diff (ยอดขาย)", "%Diff", ...colNames];
        const mc = (m: Metrics) => [m.names_called, m.total_calls, m.talked, m.orders, +basketSize(m).toFixed(2), +m.sales.toFixed(2), +pct(m.orders, m.names_called).toFixed(2)];
        const rowOf = (label: string, p: Period) => {
            const diff = p.b.sales - p.a.sales;
            const pdiff = p.a.sales > 0 ? (diff / p.a.sales) * 100 : (p.b.sales > 0 ? 100 : 0);
            return [label, ...mc(p.a), +diff.toFixed(2), +pdiff.toFixed(2), ...mc(p.b)];
        };
        const rows: any[][] = [head1, head2];
        if (data.total) rows.push(rowOf("รวมทั้งหมด (Total)", data.total));
        for (const g of data.groups) {
            if (data.has_teams) rows.push(rowOf(`ทีม ${g.team_name}`, g.total));
            for (const ag of g.agents) {
                rows.push(rowOf((data.has_teams ? "  " : "") + ag.label + (ag.is_inactive ? " (ออก)" : ""), ag.total));
                for (const seg of ag.segments) rows.push(rowOf((data.has_teams ? "    " : "  ") + seg.segment, { a: seg.a, b: seg.b }));
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
                        <span className="text-xs text-gray-400 ml-1">{labelA} vs {labelB}</span>
                    </div>
                    <button onClick={() => setIsExportOpen(true)} disabled={!data || data.groups.length === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-md text-xs font-medium hover:bg-green-700 disabled:opacity-40 transition-colors">
                        <Download className="w-3.5 h-3.5" /> ดาวน์โหลด Export
                    </button>
                </div>
                <div className="flex items-center gap-4 flex-wrap text-xs">
                    <div className="flex items-center gap-1">
                        <span className="text-gray-500 font-medium">เดือน A:</span>
                        <select value={yearA} onChange={e => setYearA(Number(e.target.value))} className="border border-gray-300 rounded px-1.5 py-1 bg-white">
                            {yearOptions.map(y => <option key={y} value={y}>{y + 543}</option>)}
                        </select>
                        <select value={monthA} onChange={e => setMonthA(Number(e.target.value))} className="border border-gray-300 rounded px-1.5 py-1 bg-white">
                            {THAI_MONTHS_SHORT.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                        </select>
                    </div>
                    <span className="text-gray-400">→</span>
                    <div className="flex items-center gap-1">
                        <span className="text-gray-500 font-medium">เดือน B:</span>
                        <select value={yearB} onChange={e => setYearB(Number(e.target.value))} className="border border-gray-300 rounded px-1.5 py-1 bg-white">
                            {yearOptions.map(y => <option key={y} value={y}>{y + 543}</option>)}
                        </select>
                        <select value={monthB} onChange={e => setMonthB(Number(e.target.value))} className="border border-gray-300 rounded px-1.5 py-1 bg-white">
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
                    <div className="bg-white rounded-lg border overflow-auto">
                        <table className="w-full text-[11px] border-collapse min-w-[1500px]">
                            <thead className="sticky top-0 z-30">
                                <tr className="bg-gray-100 text-gray-700">
                                    <th rowSpan={2} className="px-2 py-1.5 text-left border-r border-gray-300 font-semibold sticky left-0 bg-gray-100 z-40 min-w-[230px]">ทีม / Agent / Segment</th>
                                    <th colSpan={7} className="px-2 py-1.5 text-center border-r border-gray-300 font-semibold bg-rose-50 text-rose-800">{labelA}</th>
                                    <th colSpan={2} className="px-2 py-1.5 text-center border-r border-gray-300 font-semibold bg-amber-50 text-amber-800">เทียบยอดขาย</th>
                                    <th colSpan={7} className="px-2 py-1.5 text-center font-semibold bg-sky-50 text-sky-800">{labelB}</th>
                                </tr>
                                <tr className="bg-gray-50 text-gray-500 text-[10px]">
                                    {COLS.map((c, i) => (
                                        <th key={`a${i}`} className="px-2 py-1 text-right border-r border-gray-200 font-medium">
                                            <span className="inline-flex items-center justify-end">{c.label}<InfoTip text={c.tip} /></span>
                                        </th>
                                    ))}
                                    <th className="px-2 py-1 text-right border-r border-gray-200 font-medium">
                                        <span className="inline-flex items-center justify-end">Diff<InfoTip text="ผลต่างยอดขาย = ยอดขายเดือน B − เดือน A" /></span>
                                    </th>
                                    <th className="px-2 py-1 text-right border-r border-gray-300 font-medium">
                                        <span className="inline-flex items-center justify-end">%Diff<InfoTip text="ผลต่างยอดขายคิดเป็นเปอร์เซ็นต์ = (B − A) ÷ A × 100" /></span>
                                    </th>
                                    {COLS.map((c, i) => (
                                        <th key={`b${i}`} className="px-2 py-1 text-right border-r border-gray-200 font-medium">
                                            <span className="inline-flex items-center justify-end">{c.label}<InfoTip text={c.tip} /></span>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {/* Grand total */}
                                {data.total && (
                                    <tr className="bg-slate-800 text-white font-semibold">
                                        <td className="px-2 py-1.5 text-left border-r border-slate-600 sticky left-0 bg-slate-800 z-20">รวมทั้งหมด (Total)</td>
                                        <MetricCells m={data.total.a} />
                                        <DiffCells a={data.total.a} b={data.total.b} />
                                        <MetricCells m={data.total.b} />
                                    </tr>
                                )}
                                {data.groups.map((g, gi) => {
                                    const teamCollapsed = collapsedTeams.has(g.team_key);
                                    return (
                                        <React.Fragment key={g.team_key + gi}>
                                            {/* Team header (only when teams exist) */}
                                            {data.has_teams && (
                                                <tr className="bg-indigo-100 font-bold text-indigo-900 hover:bg-indigo-200 cursor-pointer border-t-4 border-indigo-300" onClick={() => toggleTeam(g.team_key)}>
                                                    <td className="px-2 py-1.5 text-left border-r border-indigo-200 sticky left-0 bg-indigo-100 z-20">
                                                        <span className="inline-flex items-center gap-1">
                                                            {teamCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                            <Users className="w-3.5 h-3.5" /> ทีม {g.team_name}
                                                            <span className="text-[10px] font-normal text-indigo-500 ml-1">({g.agents.length} คน)</span>
                                                        </span>
                                                    </td>
                                                    <MetricCells m={g.total.a} />
                                                    <DiffCells a={g.total.a} b={g.total.b} />
                                                    <MetricCells m={g.total.b} />
                                                </tr>
                                            )}
                                            {!teamCollapsed && g.agents.map(ag => {
                                                const agentCollapsed = collapsedAgents.has(ag.agent_id);
                                                return (
                                                    <React.Fragment key={ag.agent_id}>
                                                        <tr className="bg-blue-50 font-semibold text-gray-800 hover:bg-blue-100 cursor-pointer" onClick={() => toggleAgent(ag.agent_id)}>
                                                            <td className={`px-2 py-1.5 text-left border-r border-gray-200 sticky left-0 bg-blue-50 z-20 ${data.has_teams ? 'pl-5' : ''}`} title={ag.name}>
                                                                <span className="inline-flex items-center gap-1">
                                                                    {agentCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                                                    <span className={ag.is_inactive ? "text-gray-400" : ""}>{ag.label}</span>
                                                                    {ag.is_inactive && <span className="text-[9px] font-normal px-1 py-0.5 rounded bg-gray-200 text-gray-500">ออก</span>}
                                                                </span>
                                                            </td>
                                                            <MetricCells m={ag.total.a} />
                                                            <DiffCells a={ag.total.a} b={ag.total.b} />
                                                            <MetricCells m={ag.total.b} />
                                                        </tr>
                                                        {!agentCollapsed && ag.segments.map((seg, si) => (
                                                            <tr key={si} className="hover:bg-gray-50 text-gray-600">
                                                                <td className={`px-2 py-1 text-left border-r border-gray-100 sticky left-0 bg-white z-20 ${data.has_teams ? 'pl-10' : 'pl-7'}`}>{seg.segment}</td>
                                                                <MetricCells m={seg.a} />
                                                                <DiffCells a={seg.a} b={seg.b} />
                                                                <MetricCells m={seg.b} />
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
