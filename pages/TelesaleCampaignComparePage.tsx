/**
 * TelesaleCampaignComparePage — แคมเปญรายคน (ทีม › คน › ถัง)
 *
 * Layout ตามหน้า /segment-performance ของ Prima well: ค่าเริ่มต้นโชว์ "เดือนเดียว" 8 คอลัมน์
 * ที่อ่านจบได้ในจอเดียว แล้วค่อยกดสวิตช์ "เทียบ" เพื่อกางบล็อกเดือนก่อนหน้า + Δ ออกมา
 * (ของเดิมบังคับโชว์ 2 เดือน + Diff ตลอดเวลา กว้าง 1820px เลยต้องเลื่อนซ้าย-ขวาตลอด)
 *
 * กติกาการแสดงตัวเลข — ให้ตากวาดหาแนวโน้มได้เร็ว ไม่ต้องอ่านทีละหลัก:
 *   • ไม่มีสัญลักษณ์ ฿ และไม่มีทศนิยมในตัวเงิน (50,690 ไม่ใช่ ฿50,690.00)
 *   • ค่าที่เป็น 0 แสดงเป็นจุด · สีจาง — แถวที่ยังไม่มีความเคลื่อนไหวจะจางหายไปเอง
 *   • ตัวเลขรองอยู่บรรทัดล่างของช่องเดียวกัน (รับ/ไม่รับ, %ปิด, เฉลี่ย/ใบ) แทนการเพิ่มคอลัมน์
 *
 * AOV แยก ปุ๋ย / ชีวภัณฑ์ — สองกลุ่มนี้ขนาดตะกร้าต่างกันราว 3 เท่า (ก.ค. 69: ~2,900 vs ~950)
 * ค่าเฉลี่ยรวมค่าเดียวจึงบอกไม่ได้ว่าคนนี้ขายอะไรอยู่ ตัวเลขในวงเล็บคือ "จำนวนใบที่มีสินค้ากลุ่มนั้น"
 * ซึ่งเป็นตัวหารของ AOV — ใบที่มีทั้งปุ๋ยและชีวภัณฑ์ถูกนับทั้งสองฝั่ง สองค่านี้จึงไม่รวมกันเป็นออเดอร์
 */
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { User } from "../types";
import { apiFetch } from "../services/api";
import { Download, Loader2, BarChart3, ChevronDown, ChevronRight, Users, HelpCircle } from "lucide-react";
import ExportTypeModal from "../components/ExportTypeModal";
import MultiSelectFilter from "../components/MultiSelectFilter";
import { downloadDataFile } from "../utils/exportUtils";

interface Props { currentUser: User; }

interface Metrics {
    names_called: number; total_calls: number; answered: number; missed: number; talked: number;
    orders: number; sales: number;
    // ยอด/จำนวนใบแยกกลุ่มสินค้า — ใช้เป็นตัวตั้ง/ตัวหารของ AOV ปุ๋ย และ AOV ชีวภัณฑ์
    orders_fert: number; sales_fert: number; orders_bio: number; sales_bio: number;
}
interface Period { a: Metrics; b: Metrics; }
// owned is point-in-time per period (end of that month), not one shared "today" figure.
interface Owned { a: number; b: number; }
interface SegmentRow { segment: string; owned: Owned; a: Metrics; b: Metrics; }
interface AgentRow {
    agent_id: number; username: string; label: string; name: string;
    role_label: string; team_key: string; team_name: string; is_head: boolean; is_inactive: boolean;
    owned: Owned; total: Period; segments: SegmentRow[];
}
interface TeamGroup { team_key: string; team_name: string; owned: Owned; total: Period; agents: AgentRow[]; }
// snapshot = captured that night by cron | backfill = reconstructed from basket history | live = today's count
type OwnedSource = "snapshot" | "backfill" | "live";
interface ApiResp {
    success: boolean;
    periods: { a: { month: number; year: number }; b: { month: number; year: number } };
    has_teams: boolean;
    teams_list: { key: string; name: string }[];
    agents_list: { id: number; label: string; team_key: string }[];
    segments_list: string[];
    owned: Owned;
    owned_source: { a: OwnedSource; b: OwnedSource };
    total: Period | null;
    groups: TeamGroup[];
}

// ── เดือน ────────────────────────────────────────────────────────────────────
const THAI_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
/** "2026-08" → "ส.ค. 69" */
const fmtYm = (ym: string) => {
    const [y, m] = ym.split("-").map(Number);
    return `${THAI_MONTHS_SHORT[m - 1] ?? m} ${String((y + 543) % 100).padStart(2, "0")}`;
};
const ymOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const shiftYm = (ym: string, delta: number) => {
    const [y, m] = ym.split("-").map(Number);
    return ymOf(new Date(y, m - 1 + delta, 1));
};
/** ย้อนหลัง 24 เดือน (รวมเดือนนี้) ใหม่สุดก่อน — ครอบคลุมถึงเทียบเดือนเดียวกันปีก่อน */
const buildMonthOptions = () => {
    const now = new Date();
    return Array.from({ length: 24 }, (_, i) => ymOf(new Date(now.getFullYear(), now.getMonth() - i, 1)));
};

// ── ตัวเลข ───────────────────────────────────────────────────────────────────
// ไม่มี ฿ ไม่มีทศนิยม — ตัวเงินกับตัวนับใช้ฟอร์แมตเดียวกันทั้งหน้า
const nf = new Intl.NumberFormat("th-TH", { maximumFractionDigits: 0 });
const fmtNum = (n: number) => nf.format(Math.round(n || 0));
const pct = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0);
const aovOf = (sales: number, orders: number) => (orders > 0 ? sales / orders : 0);

/** ค่าเป็น 0 → จุดจาง ๆ ไม่ใช่เลข 0 เต็ม ๆ ที่แย่งสายตา */
const Zero = () => <span className="text-gray-300">·</span>;

// แถวหนึ่งของตาราง = metric ของเดือนนั้น + ยอดลูกค้าที่ดูแล ณ สิ้นเดือนนั้น
type Cell = Metrics & { owned: number };
const cellOf = (m: Metrics, owned: number): Cell => ({ ...m, owned });

const METRIC_KEYS: (keyof Metrics)[] = ["names_called", "total_calls", "answered", "missed", "talked", "orders", "sales", "orders_fert", "sales_fert", "orders_bio", "sales_bio"];
const eqMetrics = (x: Metrics, y: Metrics) => METRIC_KEYS.every(k => (x[k] || 0) === (y[k] || 0));
const isBlank = (m: Metrics, owned: number) => owned === 0 && METRIC_KEYS.every(k => (m[k] || 0) === 0);
// When an agent has exactly one segment and it accounts for their entire total (typical when
// the segment filter is narrowed to one basket), the sub-row would duplicate the agent row —
// collapse them into one line with the segment name shown as a small tag after the agent name.
const soleSegmentOf = (ag: AgentRow): SegmentRow | null =>
    ag.segments.length === 1
        && ag.segments[0].owned.a === ag.owned.a && ag.segments[0].owned.b === ag.owned.b
        && eqMetrics(ag.segments[0].a, ag.total.a) && eqMetrics(ag.segments[0].b, ag.total.b)
        ? ag.segments[0] : null;

// ── สีประจำถัง ───────────────────────────────────────────────────────────────
// สีคงที่ต่อชื่อถัง เพื่อให้จำได้ว่าจุดสีไหนคือถังไหนโดยไม่ต้องอ่านชื่อซ้ำทุกแถว
const SEGMENT_COLORS: Record<string, string> = {
    "Upsell": "#8b5cf6",
    "ลูกค้าใหม่": "#6366f1",
    "ส่วนตัว 1-2 เดือน": "#10b981",
    "ส่วนตัวโอกาสสุดท้าย": "#f59e0b",
    "หาคนดูแลใหม่": "#0ea5e9",
    "รอคนมาจีบให้ติด": "#ef4444",
    "ถังกลาง 6-12 เดือน": "#d946ef",
    "ถังกลาง 6-9 เดือน": "#d946ef",
    "ถังกลาง 9-12 เดือน": "#c026d3",
    "ถังกลาง 1-3 ปี": "#78716c",
    "ถังโบราณ เก่าเก็บ": "#57534e",
    "Marketplace": "#14b8a6",
    "ไม่มีแคมเปญ": "#94a3b8",
};
const FALLBACK_COLORS = ["#a855f7", "#f97316", "#06b6d4", "#84cc16", "#e11d48", "#3b82f6"];
const segColor = (name: string) =>
    SEGMENT_COLORS[name] ?? FALLBACK_COLORS[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % FALLBACK_COLORS.length];

// อวาตาร์เป็นสีเทากลาง ๆ ตัวเดียว — เดิมสุ่มจากจานพาสเทล 6 สีซึ่งไม่ได้สื่อความหมายอะไร
// มีแต่เพิ่มสีให้หน้าจอ ตัวอักษรย่อกับชื่อข้าง ๆ ก็แยกคนได้อยู่แล้ว
const Avatar: React.FC<{ label: string; muted?: boolean }> = ({ label, muted }) => (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-semibold flex-shrink-0 ${muted ? "bg-gray-100 text-gray-400" : "bg-gray-200 text-gray-700"}`}>
        {label.trim().charAt(0) || "?"}
    </span>
);

const InfoTip: React.FC<{ text: string }> = ({ text }) => (
    <span className="relative inline-flex ml-1 group cursor-help align-middle">
        <HelpCircle className="w-3 h-3 text-gray-300 group-hover:text-gray-500 transition-colors" />
        <span className="absolute top-full right-0 mt-1.5 hidden group-hover:block w-60 px-3 py-2 text-[11px] leading-snug text-white bg-gray-800 rounded-lg shadow-lg z-[60] text-left font-normal normal-case whitespace-normal">{text}</span>
    </span>
);

// ── นิยามคอลัมน์ ─────────────────────────────────────────────────────────────
// แหล่งความจริงเดียวของทั้งหัวตาราง / ช่องตัวเลข / บล็อก Δ / ไฟล์ export —
// เพิ่มหรือย้ายคอลัมน์ที่นี่ที่เดียวแล้วทุกส่วนขยับตาม
interface ColDef {
    key: string;
    label: string;
    tip: string;
    value: (c: Cell) => number;
    /** บรรทัดเล็กใต้ตัวเลขหลัก — ใส่รายละเอียดโดยไม่กินคอลัมน์เพิ่ม */
    sub?: (c: Cell) => React.ReactNode;
    /** มีคอลัมน์ Δ ในโหมดเทียบหรือไม่ (สายที่โทรไม่มี เพราะดูจาก "ชื่อที่โทร" กับ "ได้คุย" พอ) */
    delta?: boolean;
    strong?: boolean;
}

const SUB = "text-[10px] text-gray-400 font-normal leading-tight mt-0.5";

const COLS: ColDef[] = [
    {
        key: "owned", label: "ลูกค้าที่ดูแล", delta: true,
        tip: "จำนวนลูกค้าในมือ ณ วันสุดท้ายของเดือนนั้น (ก่อนระบบดึงกลับต้นเดือนถัดไป) — เก็บเป็น snapshot รายวัน ไม่ใช่ยอดวันนี้ เดือนที่ยังไม่จบจะแสดงยอดปัจจุบัน",
        value: c => c.owned,
    },
    {
        key: "names_called", label: "ชื่อที่โทร", delta: true,
        tip: "จำนวนลูกค้า (เบอร์ไม่ซ้ำ) ที่โทรออกไปหาในเดือนนี้ — นับจากสายโทรออกของระบบ CDR จัดกลุ่มตามถังที่ลูกค้าอยู่ในเดือนนั้น",
        value: c => c.names_called,
    },
    {
        key: "total_calls", label: "สายที่โทร",
        tip: "จำนวนสายโทรออกทั้งหมด (นับซ้ำเบอร์เดิมได้) บรรทัดล่าง = รับสาย / ไม่รับสาย ตามสถานะการเชื่อมต่อ ไม่ว่าจะคุยนานแค่ไหน",
        value: c => c.total_calls,
        sub: c => c.total_calls > 0 ? <>รับ {fmtNum(c.answered)} · ไม่รับ {fmtNum(c.missed)}</> : null,
    },
    {
        key: "talked", label: "ได้คุย", delta: true,
        tip: "สายที่รับและคุยจริง = สถานะรับสาย และระยะเวลา ≥ 30 วินาที (จากเวลาคุยที่ผู้ให้บริการบันทึกไว้)",
        value: c => c.talked,
    },
    {
        key: "orders", label: "ออเดอร์", delta: true,
        tip: "จำนวนออเดอร์ที่ปิดได้ (ไม่รวมที่ยกเลิก) จัดกลุ่มตามถังขณะที่ปิดการขาย บรรทัดล่าง = %ปิด (ออเดอร์ ÷ ชื่อที่โทร)",
        value: c => c.orders,
        // ไม่โชว์ "ปิด 0.0%" ใต้ช่องที่เป็นจุด — บรรทัดเล็กที่บอกว่าศูนย์ซ้ำอีกรอบมีแต่รบกวนสายตา
        sub: c => c.orders > 0 && c.names_called > 0 ? <>ปิด {pct(c.orders, c.names_called).toFixed(1)}%</> : null,
    },
    {
        key: "sales", label: "ยอดขาย", delta: true, strong: true,
        tip: "ยอดขายสุทธิ ไม่รวมของแถมและออเดอร์ที่ยกเลิก บรรทัดล่าง = เฉลี่ยต่อใบ รวมทุกกลุ่มสินค้า",
        value: c => c.sales,
        sub: c => c.orders > 0 ? <>เฉลี่ย {fmtNum(aovOf(c.sales, c.orders))}</> : null,
    },
    {
        key: "aov_fert", label: "AOV ปุ๋ย", delta: true,
        tip: "ยอดขายเฉพาะสินค้ากลุ่มปุ๋ย ÷ จำนวนใบที่มีปุ๋ยอยู่ในบิล — ตัวเลขในวงเล็บคือจำนวนใบนั้น (ตัวหาร) ใบที่มีทั้งปุ๋ยและชีวภัณฑ์ถูกนับทั้งสองฝั่ง",
        value: c => aovOf(c.sales_fert, c.orders_fert),
        sub: c => c.orders_fert > 0 ? <>{fmtNum(c.orders_fert)} ใบ</> : null,
    },
    {
        key: "aov_bio", label: "AOV ชีวภัณฑ์", delta: true,
        tip: "ยอดขายเฉพาะสินค้ากลุ่มชีวภัณฑ์ ÷ จำนวนใบที่มีชีวภัณฑ์อยู่ในบิล — ตัวเลขในวงเล็บคือจำนวนใบนั้น (ตัวหาร) ใบที่มีทั้งสองกลุ่มถูกนับทั้งสองฝั่ง",
        value: c => aovOf(c.sales_bio, c.orders_bio),
        sub: c => c.orders_bio > 0 ? <>{fmtNum(c.orders_bio)} ใบ</> : null,
    },
];
const DELTA_COLS = COLS.filter(c => c.delta);
const COL = Object.fromEntries(COLS.map(c => [c.key, c])) as Record<string, ColDef>;

/** ส่วนต่างที่ปัดเศษแล้วทั้งคู่ — ตัวเงิน/AOV บนจอไม่มีทศนิยม Δ จึงต้องคิดจากเลขที่ผู้ใช้เห็นจริง */
const deltaOf = (cur: number, prev: number) => {
    const c = Math.round(cur || 0), p = Math.round(prev || 0);
    const d = c - p;
    return { d, pct: p !== 0 ? (d / Math.abs(p)) * 100 : null };
};

// ── ช่องตาราง ────────────────────────────────────────────────────────────────
// โทนอ่อน เส้นบาง: หัวตารางพื้นเทาอ่อน ชื่อบล็อกเดือนใช้สีบอกความต่าง (ล่าสุด=คราม เทียบ=เทา Δ=เหลือง)
// ส่วนตัวเลขในตารางเป็นเทาเข้ม/ดำล้วน มีแค่ Δ ที่ลงสีเขียว-แดง
const TD = "px-2.5 py-2 text-right whitespace-nowrap text-[12px] tabular-nums border-l border-gray-100";
/** เส้นคั่นระหว่างบล็อก (เดือนหลัก | เดือนเทียบ | Δ) — เข้มกว่าเส้นคั่นคอลัมน์นิดเดียวก็พอ */
const BLOCK_EDGE = "border-l border-l-gray-300";

const MetricCells: React.FC<{ c: Cell; dim?: boolean }> = ({ c, dim }) => (
    <>
        {COLS.map((col, i) => {
            const v = col.value(c);
            const sub = col.sub?.(c);
            return (
                <td key={col.key} className={`${TD} ${dim && i === 0 ? BLOCK_EDGE : ""} ${dim ? "text-gray-400" : col.strong ? "text-gray-900 font-semibold" : "text-gray-700"}`}>
                    {v ? fmtNum(v) : <Zero />}
                    {sub && <div className={SUB}>{sub}</div>}
                </td>
            );
        })}
    </>
);

/** Δ = เดือนหลัก − เดือนเทียบ, ตัวเล็กคือ % เทียบฐานเดือนเทียบ (ฐาน 0 = "ใหม่") */
const DeltaCell: React.FC<{ cur: number; prev: number; edge?: boolean }> = ({ cur, prev, edge }) => {
    const { d, pct: p } = deltaOf(cur, prev);
    const cls = d === 0 ? "text-gray-300" : d > 0 ? "text-emerald-700 font-semibold" : "text-rose-700 font-semibold";
    return (
        <td className={`${TD} ${edge ? BLOCK_EDGE : ""} ${cls}`}>
            {d === 0 ? "·" : <>{d > 0 ? "+" : "−"}{fmtNum(Math.abs(d))}</>}
            {d !== 0 && (
                <div className={`${SUB} ${cls} opacity-70`}>
                    {p === null ? "ใหม่" : `${p >= 0 ? "+" : "−"}${Math.abs(p).toFixed(0)}%`}
                </div>
            )}
        </td>
    );
};

const DeltaCells: React.FC<{ cur: Cell; prev: Cell }> = ({ cur, prev }) => (
    <>{DELTA_COLS.map((col, i) => <DeltaCell key={col.key} cur={col.value(cur)} prev={col.value(prev)} edge={i === 0} />)}</>
);

// Tag next to a month header saying where its "ลูกค้าที่ดูแล" number came from.
// A live figure is today's count standing in for a month that has not ended (or has no
// snapshot yet) — it must not be read as the month-end book.
const OWNED_SOURCE_TAG: Record<OwnedSource, { label: string; cls: string; tip: string } | null> = {
    snapshot: null,
    backfill: { label: "ประมาณการ", cls: "", tip: "ยอดลูกค้าที่ดูแลของเดือนนี้ ย้อนสร้างจากประวัติการย้ายถัง เพราะยังไม่มีการเก็บ snapshot ตอนนั้น — คลาดเคลื่อนได้ราว 0.5%" },
    live: { label: "ยอดปัจจุบัน", cls: "", tip: "เดือนนี้ยังไม่จบ (หรือยังไม่มี snapshot) จึงแสดงยอดลูกค้าที่ดูแล ณ ตอนนี้ ไม่ใช่ยอดสิ้นเดือน" },
};
const OwnedSourceTag: React.FC<{ source?: OwnedSource }> = ({ source }) => {
    const tag = source ? OWNED_SOURCE_TAG[source] : null;
    if (!tag) return null;
    return (
        <span
            className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-normal border border-gray-300 text-gray-500"
            title={tag.tip}
        >
            {tag.label}
        </span>
    );
};

// ── การ์ดสรุปด้านบน ──────────────────────────────────────────────────────────
const KpiCard: React.FC<{ title: string; value: number; sub?: string; prev: number; tip?: string }> =
    ({ title, value, sub, prev, tip }) => {
        const { d, pct: p } = deltaOf(value, prev);
        return (
            <div className="bg-white rounded-lg border border-gray-200 px-3.5 py-3 shadow-sm">
                <div className="flex items-center text-[11px] text-gray-500 font-medium">
                    <span className="truncate">{title}</span>
                    {tip && <InfoTip text={tip} />}
                </div>
                <div className="text-xl font-bold text-gray-900 tabular-nums mt-1 leading-tight">{fmtNum(value)}</div>
                <div className="flex items-baseline gap-1.5 mt-1 min-h-[15px]">
                    {d !== 0 && (
                        <span className={`text-[11px] font-semibold tabular-nums ${d > 0 ? "text-emerald-700" : "text-rose-700"}`}>
                            {d > 0 ? "+" : "−"}{fmtNum(Math.abs(d))}{p !== null && ` (${p >= 0 ? "+" : "−"}${Math.abs(p).toFixed(0)}%)`}
                        </span>
                    )}
                    {sub && <span className="text-[10px] text-gray-400 truncate">{sub}</span>}
                </div>
            </div>
        );
    };

// ─────────────────────────────────────────────────────────────────────────────
const TelesaleCampaignComparePage: React.FC<Props> = ({ currentUser }) => {
    const monthOptions = useMemo(buildMonthOptions, []);
    // mainYm = เดือนที่กำลังดู (ตรงกับ period b ฝั่ง API), cmpYm = เดือนที่เอาไว้เทียบ (period a)
    const [mainYm, setMainYm] = useState(monthOptions[0]);
    const [cmpYm, setCmpYm] = useState(() => shiftYm(monthOptions[0], -1));
    const [compareOn, setCompareOn] = useState(false);
    // Agent + segment filters are both multi-select and both debounced, so ticking several
    // boxes in one dropdown fires a single API call instead of one per tick.
    const [agentIds, setAgentIds] = useState<number[]>([]);
    const [agentIdsDebounced, setAgentIdsDebounced] = useState<number[]>([]);
    const [teamKey, setTeamKey] = useState("");
    const [segNames, setSegNames] = useState<string[]>([]);
    const [segNamesDebounced, setSegNamesDebounced] = useState<string[]>([]);
    // Full list of segment names kept from the last successful fetch, so the dropdown
    // stays populated even while a filtered request is in flight or returns empty groups.
    const [segmentsList, setSegmentsList] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<ApiResp | null>(null);
    const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set());
    const [collapsedAgents, setCollapsedAgents] = useState<Set<number>>(new Set());
    const [isExportOpen, setIsExportOpen] = useState(false);

    const [yearB, monthB] = useMemo(() => mainYm.split("-").map(Number), [mainYm]);
    const [yearA, monthA] = useMemo(() => cmpYm.split("-").map(Number), [cmpYm]);
    const labelB = fmtYm(mainYm);
    const labelA = fmtYm(cmpYm);
    // เดือนที่กำลังดูยังไม่จบ → ตัวเลขเป็นยอดสะสมถึงวันนี้ ถ้าเอาไปเทียบเดือนเต็มจะติดลบยกแผง
    // ต้องบอกไว้ตรง ๆ ไม่งั้นการ์ดแดงทั้งแถวจะถูกอ่านว่าผลงานตก
    const partialDay = useMemo(() => {
        const now = new Date();
        return mainYm === ymOf(now) ? now.getDate() : 0;
    }, [mainYm]);

    useEffect(() => {
        const t = setTimeout(() => setSegNamesDebounced(segNames), 500);
        return () => clearTimeout(t);
    }, [segNames]);

    useEffect(() => {
        const t = setTimeout(() => setAgentIdsDebounced(agentIds), 500);
        return () => clearTimeout(t);
    }, [agentIds]);

    // ทั้งสองเดือนถูกดึงมาเสมอแม้สวิตช์ "เทียบ" จะปิดอยู่ — การ์ดสรุปด้านบนใช้ Δ ตลอด
    // และการกดสวิตช์เปิด/ปิดจึงไม่ต้องยิง API ใหม่
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                month_a: String(monthA), year_a: String(yearA),
                month_b: String(monthB), year_b: String(yearB),
            });
            if (agentIdsDebounced.length > 0) agentIdsDebounced.forEach(id => params.append("agent_ids[]", String(id)));
            else if (teamKey) params.set("team", teamKey);
            segNamesDebounced.forEach(s => params.append("segments[]", s));
            const res = await apiFetch(`Reports/telesale_campaign_compare.php?${params}`);
            setData(res?.success ? res : null);
            if (res?.success && Array.isArray(res.segments_list)) setSegmentsList(res.segments_list);
        } catch (e) {
            console.error("Campaign compare fetch error:", e);
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [monthA, yearA, monthB, yearB, agentIdsDebounced, teamKey, segNamesDebounced]);

    useEffect(() => { fetchData(); }, [fetchData]);

    /** เปลี่ยนเดือนหลัก → เลื่อนเดือนเทียบตามให้เป็นเดือนก่อนหน้าอัตโนมัติ (เลือกเองทีหลังได้) */
    const changeMainYm = (ym: string) => { setMainYm(ym); setCmpYm(shiftYm(ym, -1)); };

    const agentOptions = useMemo(() => {
        if (!data) return [];
        const list = teamKey ? data.agents_list.filter(a => a.team_key === teamKey) : data.agents_list;
        return list.map(a => ({ id: a.id, label: a.label }));
    }, [data, teamKey]);
    // เปลี่ยนทีมแล้วคนที่เลือกไว้ซึ่งไม่ได้อยู่ทีมนั้นต้องหลุดออก ไม่งั้นตัวกรองจะขัดกันเอง
    // แล้วผลลัพธ์ออกมาว่างโดยไม่มีอะไรบอกว่าเพราะอะไร
    const changeTeam = (k: string) => {
        setTeamKey(k);
        if (!data) { setAgentIds([]); return; }
        const inTeam = new Set(data.agents_list.filter(a => !k || a.team_key === k).map(a => a.id));
        setAgentIds(prev => prev.filter(id => inTeam.has(id)));
    };

    // MultiSelectFilter works with numeric ids -> map segment names to their index in segmentsList
    const segOptions = useMemo(() => segmentsList.map((s, i) => ({ id: i, label: s })), [segmentsList]);
    const selectedSegIds = useMemo(
        () => segNames.map(n => segmentsList.indexOf(n)).filter(i => i >= 0),
        [segNames, segmentsList]
    );
    const handleSegChange = (ids: number[]) => setSegNames(ids.map(i => segmentsList[i]).filter(Boolean));

    const toggleTeam = (k: string) => setCollapsedTeams(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });
    const toggleAgent = (id: number) => setCollapsedAgents(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

    // API ส่งถังที่มีความเคลื่อนไหวใน "เดือนใดเดือนหนึ่ง" มาให้ พอปิดสวิตช์เทียบแล้วถังที่
    // เคลื่อนไหวเฉพาะเดือนก่อนจะกลายเป็นแถวจุดล้วน ๆ — ซ่อนทิ้งเมื่อมองเดือนเดียว
    const visibleSegments = useCallback(
        (ag: AgentRow) => compareOn ? ag.segments : ag.segments.filter(s => !isBlank(s.b, s.owned.b)),
        [compareOn]
    );

    const grand = useMemo(() => {
        if (!data?.total) return null;
        return { cur: cellOf(data.total.b, data.owned.b), prev: cellOf(data.total.a, data.owned.a) };
    }, [data]);

    const handleExport = (type: 'csv' | 'xlsx') => {
        if (!data) return;
        // Export keeps full per-metric detail (answered/missed, %ปิด, AOV แยกกลุ่ม เป็นคอลัมน์แยก)
        // แม้ตารางบนจอจะยุบบางค่าไว้เป็นบรรทัดเล็ก และคงทั้งสองเดือน + Diff ไว้เสมอ
        // ไม่ว่าสวิตช์ "เทียบ" บนจอจะเปิดหรือปิด
        const colNames = ["ลูกค้าที่ดูแล", "ชื่อที่โทร", "สายที่โทร", "รับสาย", "ไม่รับสาย", "ได้คุย", "ออเดอร์", "%ปิด", "ยอดขาย", "เฉลี่ยต่อใบ", "ยอดขายปุ๋ย", "ใบที่มีปุ๋ย", "AOV ปุ๋ย", "ยอดขายชีวภัณฑ์", "ใบที่มีชีวภัณฑ์", "AOV ชีวภัณฑ์"];
        const srcNote = (s?: OwnedSource) => (s && OWNED_SOURCE_TAG[s] ? ` (ลูกค้าที่ดูแล: ${OWNED_SOURCE_TAG[s]!.label})` : "");
        const head1 = ["", labelB + srcNote(data.owned_source?.b), ...Array(colNames.length - 1).fill(""), "Diff", "%Diff", labelA + srcNote(data.owned_source?.a), ...Array(colNames.length - 1).fill("")];
        const head2 = ["ทีม / Agent / ถัง", ...colNames, "Diff (ยอดขาย)", "%Diff", ...colNames];
        const mc = (m: Metrics, owned: number) => [
            owned, m.names_called, m.total_calls, m.answered, m.missed, m.talked,
            m.orders, +pct(m.orders, m.names_called).toFixed(2),
            Math.round(m.sales), Math.round(aovOf(m.sales, m.orders)),
            Math.round(m.sales_fert), m.orders_fert, Math.round(aovOf(m.sales_fert, m.orders_fert)),
            Math.round(m.sales_bio), m.orders_bio, Math.round(aovOf(m.sales_bio, m.orders_bio)),
        ];
        const rowOf = (label: string, p: Period, owned: Owned) => {
            const diff = p.b.sales - p.a.sales;
            const pdiff = p.a.sales > 0 ? (diff / p.a.sales) * 100 : (p.b.sales > 0 ? 100 : 0);
            return [label, ...mc(p.b, owned.b), Math.round(diff), +pdiff.toFixed(2), ...mc(p.a, owned.a)];
        };
        const rows: any[][] = [head1, head2];
        if (data.total) rows.push(rowOf("รวมทั้งหมด (Total)", data.total, data.owned));
        for (const g of data.groups) {
            if (data.has_teams) rows.push(rowOf(`ทีม ${g.team_name}`, g.total, g.owned));
            for (const ag of g.agents) {
                const soleSeg = soleSegmentOf(ag);
                const agLabel = ag.label + (ag.is_inactive ? " (ออก)" : "") + (soleSeg ? ` — ${soleSeg.segment}` : "");
                rows.push(rowOf((data.has_teams ? "  " : "") + agLabel, ag.total, ag.owned));
                if (!soleSeg) for (const seg of ag.segments) rows.push(rowOf((data.has_teams ? "    " : "  ") + seg.segment, { a: seg.a, b: seg.b }, seg.owned));
            }
        }
        downloadDataFile(rows, `campaign_compare_${mainYm}_vs_${cmpYm}`, type);
        setIsExportOpen(false);
    };

    // หัวตารางสองชั้นเมื่อเปิดโหมดเทียบ — ชั้นล่างต้องถูกดันลงมาให้พ้นชั้นบนตอน sticky
    // คลาสต้องเขียนเต็มเป็น literal (top-[28px]) ไม่ใช่ประกอบจากตัวแปร ไม่งั้น Tailwind สแกนไม่เจอ
    const HEAD_ROW_H = 28;
    const th2Sticky = compareOn ? "top-[28px]" : "top-0";

    const renderRow = (
        key: React.Key, labelCell: React.ReactNode, p: Period, owned: Owned,
        rowCls: string, stickyBg: string, onClick?: () => void,
    ) => {
        const cur = cellOf(p.b, owned.b);
        const prev = cellOf(p.a, owned.a);
        return (
            <tr key={key} className={rowCls} onClick={onClick}>
                <td className={`px-3 py-2 text-left sticky left-0 z-20 ${stickyBg}`}>{labelCell}</td>
                <MetricCells c={cur} />
                {compareOn && <MetricCells c={prev} dim />}
                {compareOn && <DeltaCells cur={cur} prev={prev} />}
            </tr>
        );
    };

    // จำนวนคอลัมน์ทั้งแถว ใช้กับแถบคั่นทีมที่กินความกว้างเต็มแถว
    const totalCols = 1 + COLS.length + (compareOn ? COLS.length + DELTA_COLS.length : 0);

    return (
        <div className="flex flex-col h-full bg-gray-50">
            {/* ── Header ─────────────────────────────────────────────── */}
            <div className="bg-white border-b px-4 py-3 flex-shrink-0">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                        <h1 className="text-lg font-bold text-gray-900 inline-flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-indigo-500" />
                            แคมเปญรายคน
                        </h1>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                            ทีม › คน › ถัง — โทรเท่าไหร่ ได้คุยเท่าไหร่ ปิดได้กี่ใบ และตะกร้าปุ๋ย/ชีวภัณฑ์ใหญ่แค่ไหน
                        </p>
                    </div>
                    <button onClick={() => setIsExportOpen(true)} disabled={!data || data.groups.length === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-40 transition-colors">
                        <Download className="w-3.5 h-3.5" /> ดาวน์โหลด Export
                    </button>
                </div>

                <div className="flex items-center gap-x-4 gap-y-2 flex-wrap text-xs mt-3">
                    <div className="flex items-center gap-1.5">
                        <span className="text-gray-500 font-medium">เดือน</span>
                        <select value={mainYm} onChange={e => changeMainYm(e.target.value)}
                            className="border border-gray-300 rounded-md px-2 py-1 bg-white font-semibold text-gray-800 cursor-pointer">
                            {monthOptions.map(m => <option key={m} value={m}>{fmtYm(m)}</option>)}
                        </select>
                    </div>

                    {data?.has_teams && (
                        <div className="flex items-center gap-1.5">
                            <span className="text-gray-500 font-medium">ทีม</span>
                            <select value={teamKey} onChange={e => changeTeam(e.target.value)}
                                className="border border-gray-300 rounded-md px-2 py-1 bg-white min-w-[110px]">
                                <option value="">ทุกทีม</option>
                                {data.teams_list.map(t => <option key={t.key} value={t.key}>{t.name}</option>)}
                            </select>
                        </div>
                    )}
                    <div className="flex items-center gap-1.5">
                        <span className="text-gray-500 font-medium">พนักงาน</span>
                        <div className="w-[190px]">
                            <MultiSelectFilter
                                options={agentOptions}
                                selectedIds={agentIds}
                                onChange={setAgentIds}
                                placeholder="ค้นหาพนักงาน..."
                                emptyMeansAllLabel="ทุกคน"
                                emptyHint="ไม่เลือก = แสดงทุกคน"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-gray-500 font-medium">ถัง/แคมเปญ</span>
                        <div className="w-[190px]">
                            <MultiSelectFilter
                                options={segOptions}
                                selectedIds={selectedSegIds}
                                onChange={handleSegChange}
                                placeholder="ค้นหาถัง..."
                                emptyMeansAllLabel="ทุกถัง"
                                emptyHint="ไม่เลือก = แสดงทุกถัง"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Body ───────────────────────────────────────────────── */}
            <div className="flex-1 overflow-auto px-4 py-4">
                {/* การ์ดสรุป — Δ เทียบเดือนที่เลือกไว้เสมอ แม้สวิตช์เทียบจะปิด */}
                {grand && (
                    <div className={`mb-4 transition-opacity ${loading ? "opacity-50" : ""}`}>
                        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
                            <KpiCard title="ลูกค้าที่ดูแล" tip={COL.owned.tip}
                                value={grand.cur.owned} prev={grand.prev.owned} />
                            <KpiCard title="ชื่อที่โทร" tip={COL.names_called.tip}
                                value={grand.cur.names_called} prev={grand.prev.names_called}
                                sub={`ได้คุย ${fmtNum(grand.cur.talked)}`} />
                            <KpiCard title="ออเดอร์" tip={COL.orders.tip}
                                value={grand.cur.orders} prev={grand.prev.orders}
                                sub={`ปิด ${pct(grand.cur.orders, grand.cur.names_called).toFixed(1)}%`} />
                            <KpiCard title="ยอดขาย" tip={COL.sales.tip}
                                value={grand.cur.sales} prev={grand.prev.sales}
                                sub={`เฉลี่ย ${fmtNum(aovOf(grand.cur.sales, grand.cur.orders))}/ใบ`} />
                            <KpiCard title="AOV ปุ๋ย" tip={COL.aov_fert.tip}
                                value={aovOf(grand.cur.sales_fert, grand.cur.orders_fert)}
                                prev={aovOf(grand.prev.sales_fert, grand.prev.orders_fert)}
                                sub={`${fmtNum(grand.cur.orders_fert)} ใบ`} />
                            <KpiCard title="AOV ชีวภัณฑ์" tip={COL.aov_bio.tip}
                                value={aovOf(grand.cur.sales_bio, grand.cur.orders_bio)}
                                prev={aovOf(grand.prev.sales_bio, grand.prev.orders_bio)}
                                sub={`${fmtNum(grand.cur.orders_bio)} ใบ`} />
                        </div>
                        <p className="text-[11px] text-gray-400 mt-1.5">
                            ตัวเลขสีเขียว/แดงใต้การ์ด = ส่วนต่างจาก {labelA} (แสดงตลอด ไม่ต้องเปิดสวิตช์เทียบ)
                            {partialDay > 0 && (
                                <span className="ml-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-gray-300 text-gray-600 font-medium">
                                    {labelB} ยังไม่จบเดือน — เป็นยอดสะสมถึงวันที่ {partialDay} เทียบกับเดือนเต็มจะติดลบเป็นปกติ
                                </span>
                            )}
                        </p>
                    </div>
                )}

                {loading ? (
                    <div className="h-40 flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
                        <span className="ml-2 text-sm text-gray-500">กำลังโหลด...</span>
                    </div>
                ) : !data || data.groups.length === 0 ? (
                    <div className="h-40 flex items-center justify-center text-gray-400 text-sm">ไม่พบข้อมูลในเดือนที่เลือก</div>
                ) : (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        {/* แถบหัวตาราง — สวิตช์เทียบอยู่ตรงนี้ ติดกับตารางที่มันไปกางคอลัมน์ให้
                            ไม่ได้อยู่รวมกับตัวกรองด้านบนซึ่งเป็นคนละเรื่องกัน */}
                        <div className="px-4 py-2.5 border-b border-gray-200 bg-white flex items-center justify-between flex-wrap gap-x-4 gap-y-2">
                            <h3 className="text-sm font-bold text-gray-900">
                                แยกตาม {data.has_teams ? "ทีม › คน › ถัง" : "คน › ถัง"}
                                <span className="ml-2 text-[11px] font-normal text-gray-500">{labelB}{compareOn && ` เทียบ ${labelA}`}</span>
                            </h3>
                            <div className="flex items-center gap-3 flex-wrap text-xs">
                                <span className="text-[10px] text-gray-400">
                                    ได้คุย = คุยตั้งแต่ 30 วินาที · ถัง = ถังที่ลูกค้าอยู่ในเดือนนั้น · จุด · คือค่าศูนย์
                                </span>
                                <div className={`flex items-center gap-1.5 rounded-md border px-2 py-1 transition-colors ${compareOn ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-gray-200 bg-white text-gray-600"}`}>
                                    <label className="inline-flex items-center gap-1.5 font-medium cursor-pointer select-none">
                                        <input type="checkbox" checked={compareOn} onChange={e => setCompareOn(e.target.checked)}
                                            className="accent-indigo-600 w-3.5 h-3.5" />
                                        เทียบกับ
                                    </label>
                                    {/* เดือนเทียบใช้งานอยู่เสมอ แม้สวิตช์ปิด — การ์ดสรุปด้านบนยังคิด Δ จากเดือนนี้ */}
                                    <select value={cmpYm} onChange={e => setCmpYm(e.target.value)}
                                        className="border border-gray-300 rounded px-1.5 py-0.5 bg-white text-gray-900 cursor-pointer">
                                        {monthOptions.filter(m => m !== mainYm).map(m => <option key={m} value={m}>{fmtYm(m)}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="overflow-auto max-h-[72vh]">
                            <table className="border-collapse text-[12px] min-w-full">
                                {/* หัวตารางพื้นเทาอ่อน เส้นคั่นบาง — ชื่อบล็อกเดือนแยกกันด้วยสีตัวอักษร
                                    (ล่าสุด = คราม, เทียบ = เทาจาง, Δ = เหลือง) ไม่ต้องลงพื้นหลังทั้งบล็อก */}
                                <thead className="bg-gray-50">
                                    {compareOn && (
                                        <tr className="text-[10px] uppercase tracking-wide">
                                            <th className="sticky left-0 top-0 z-40 bg-gray-50 border-b border-r border-gray-200" style={{ height: HEAD_ROW_H }} />
                                            <th colSpan={COLS.length} className="sticky top-0 z-30 bg-gray-50 text-indigo-600 font-bold px-2 border-b border-gray-200" style={{ height: HEAD_ROW_H }}>
                                                {labelB} (ล่าสุด)<OwnedSourceTag source={data.owned_source?.b} />
                                            </th>
                                            <th colSpan={COLS.length} className={`sticky top-0 z-30 bg-gray-50 text-gray-400 font-bold px-2 border-b border-gray-200 ${BLOCK_EDGE}`} style={{ height: HEAD_ROW_H }}>
                                                {labelA} (เทียบ)<OwnedSourceTag source={data.owned_source?.a} />
                                            </th>
                                            <th colSpan={DELTA_COLS.length} className={`sticky top-0 z-30 bg-gray-50 text-amber-600 font-bold px-2 border-b border-gray-200 ${BLOCK_EDGE}`} style={{ height: HEAD_ROW_H }}>
                                                ส่วนต่าง (Δ)
                                            </th>
                                        </tr>
                                    )}
                                    <tr>
                                        <th className={`sticky left-0 z-40 bg-gray-50 px-3 py-2 text-left font-semibold text-gray-500 text-[11px] border-b border-r border-gray-200 min-w-[230px] ${th2Sticky}`}>
                                            {data.has_teams ? "ทีม / คน / ถัง" : "คน / ถัง"}
                                        </th>
                                        {COLS.map(c => (
                                            <th key={`b-${c.key}`} className={`sticky z-30 ${th2Sticky} bg-gray-50 px-2.5 py-2 text-right font-semibold text-gray-700 text-[11px] border-b border-gray-200 whitespace-nowrap`}>
                                                <span className="inline-flex items-center justify-end">
                                                    {c.label}
                                                    {c.key === "owned" && !compareOn && <OwnedSourceTag source={data.owned_source?.b} />}
                                                    <InfoTip text={c.tip} />
                                                </span>
                                            </th>
                                        ))}
                                        {compareOn && COLS.map((c, i) => (
                                            <th key={`a-${c.key}`} className={`sticky z-30 ${th2Sticky} bg-gray-50 px-2.5 py-2 text-right font-normal text-gray-400 text-[11px] border-b border-gray-200 whitespace-nowrap ${i === 0 ? BLOCK_EDGE : ""}`}>
                                                {c.label}
                                            </th>
                                        ))}
                                        {compareOn && DELTA_COLS.map((c, i) => (
                                            <th key={`d-${c.key}`} className={`sticky z-30 ${th2Sticky} bg-gray-50 px-2.5 py-2 text-right font-semibold text-amber-700 text-[11px] border-b border-gray-200 whitespace-nowrap ${i === 0 ? BLOCK_EDGE : ""}`}>
                                                <span className="inline-flex items-center justify-end">
                                                    Δ {c.label}
                                                    <InfoTip text={`ส่วนต่าง ${c.label}: ${labelB} − ${labelA} · ตัวเล็ก = % เทียบฐาน ${labelA}`} />
                                                </span>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* ไม่มีแถวรวมทั้งหมดและไม่มีแถวรวมของทีม — แถวยอดรวมที่หน้าตาเหมือนแถวข้อมูล
                                        ทำให้อ่านสับสนว่าตัวไหนคือของใคร ยอดรวมทั้งหมดไปอยู่บนการ์ดสรุปด้านบนแทน
                                        เหลือไว้แค่แถบชื่อทีมที่ไม่มีตัวเลข ใช้คั่นกลุ่มและกดยุบทีมได้ */}
                                    {data.groups.map((g, gi) => {
                                        const teamCollapsed = collapsedTeams.has(g.team_key);
                                        return (
                                            <React.Fragment key={g.team_key + gi}>
                                                {data.has_teams && (
                                                    <tr className="bg-gray-100 hover:bg-gray-200 cursor-pointer transition-colors" onClick={() => toggleTeam(g.team_key)}>
                                                        <td colSpan={totalCols} className="px-3 py-1.5 text-left border-y border-gray-200">
                                                            <span className="inline-flex items-center gap-2 text-[12px] font-bold text-gray-700">
                                                                {teamCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                                                                <Users className="w-3.5 h-3.5 text-gray-400" />
                                                                ทีม {g.team_name}
                                                                <span className="text-[11px] font-normal text-gray-400">({g.agents.length} คน)</span>
                                                            </span>
                                                        </td>
                                                    </tr>
                                                )}
                                                {!teamCollapsed && g.agents.map(ag => {
                                                    const agentCollapsed = collapsedAgents.has(ag.agent_id);
                                                    const soleSeg = soleSegmentOf(ag);
                                                    const segs = soleSeg ? [] : visibleSegments(ag);
                                                    const expandable = segs.length > 0;
                                                    return (
                                                        <React.Fragment key={ag.agent_id}>
                                                            {renderRow(
                                                                `ag-${ag.agent_id}`,
                                                                <span className={`inline-flex items-center gap-2.5 ${data.has_teams ? "pl-5" : ""}`} title={ag.name}>
                                                                    {!expandable ? <span className="w-3 flex-shrink-0" /> : agentCollapsed ? <ChevronRight className="w-3 h-3 text-gray-400" /> : <ChevronDown className="w-3 h-3 text-gray-400" />}
                                                                    <Avatar label={ag.label} muted={ag.is_inactive} />
                                                                    <span className={ag.is_inactive ? "text-gray-400" : ""}>{ag.label}</span>
                                                                    {ag.is_inactive && <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400">ออก</span>}
                                                                    {soleSeg && (
                                                                        <span className="inline-flex items-center gap-1 text-[10px] font-normal px-1.5 py-0.5 rounded-full bg-gray-50 text-gray-500 whitespace-nowrap">
                                                                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: segColor(soleSeg.segment) }} />
                                                                            {soleSeg.segment}
                                                                        </span>
                                                                    )}
                                                                </span>,
                                                                ag.total, ag.owned,
                                                                `bg-gray-50 font-bold text-gray-900 transition-colors border-t border-gray-300 ${expandable ? "hover:bg-gray-100 cursor-pointer" : ""}`,
                                                                "bg-gray-50 border-r border-gray-200",
                                                                expandable ? () => toggleAgent(ag.agent_id) : undefined,
                                                            )}
                                                            {!agentCollapsed && segs.map((seg, si) => renderRow(
                                                                `seg-${ag.agent_id}-${si}`,
                                                                <span className={`inline-flex items-center gap-2 text-[12px] ${data.has_teams ? "pl-[3.25rem]" : "pl-8"}`}>
                                                                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: segColor(seg.segment) }} />
                                                                    {seg.segment}
                                                                </span>,
                                                                { a: seg.a, b: seg.b }, seg.owned,
                                                                "bg-white hover:bg-gray-50 text-gray-600 transition-colors",
                                                                "bg-white border-r border-gray-200",
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
                    </div>
                )}

                {/* วิธีอ่าน */}
                {data && data.groups.length > 0 && (
                    <div className="text-[11px] text-gray-500 leading-relaxed mt-3">
                        <strong className="text-gray-600">วิธีอ่าน:</strong>{" "}
                        AOV ปุ๋ยกับ AOV ชีวภัณฑ์ต่างกันหลายเท่าโดยธรรมชาติ ให้เทียบคนกับคนภายในกลุ่มเดียวกัน อย่าเอาสองคอลัมน์มาเทียบกันเอง —
                        ยอดขายตกทั้งที่ออเดอร์เท่าเดิม มักแปลว่าสัดส่วนขายเลื่อนไปทางชีวภัณฑ์มากขึ้น ดูได้จากจำนวน "ใบ" ใต้ AOV แต่ละกลุ่ม ·
                        ถังที่ %ปิดสูงคือถังที่คุ้มเวลาโทรที่สุด ถ้าถังไหนลูกค้าที่ดูแลเยอะแต่ชื่อที่โทรน้อย แปลว่ายังเก็บไม่ทัน
                    </div>
                )}
            </div>

            <ExportTypeModal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} onConfirm={handleExport} />
        </div>
    );
};

export default TelesaleCampaignComparePage;
