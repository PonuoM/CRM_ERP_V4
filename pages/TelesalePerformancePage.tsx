import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import resolveApiBasePath from '@/utils/apiBasePath';
import UniversalDateRangePicker from '@/components/UniversalDateRangePicker';

// ==========================================
// Types
// ==========================================
interface DailyMetrics {
    totalCalls: number;
    connectedCalls: number;
    talkedCalls: number;
    missedCalls: number;
    totalMinutes: number;
    answerRate: number;
    workingHours: number;
    workingDays: number;
    totalSales: number;
    upsellSales: number;
    cancelledSales: number;
    returnedSales: number;
    grossSales: number;
    totalOrders: number;
    upsellOrders: number;
    grossOrders: number;
    netOrders: number;
    newCustOrders: number;
    newCustSales: number;
    coreCustOrders: number;
    coreCustSales: number;
    revivalCustOrders: number;
    revivalCustSales: number;
    bioSales: number;
    fertilizerSales: number;
    otherSales: number;
}
interface DailyRecord {
    userId: number;
    name: string;
    team: string;
    teamKey: string;
    roleLabel: string;
    date: string;
    metrics: DailyMetrics;
}

interface Metrics {
    totalOrders: number;
    conversionRate: number;
    totalSales: number;
    upsellOrders: number;
    upsellSales: number;
    combinedSales: number;
    customers90Days: number;
    aovFertilizer: number;
    aovBio: number;
    newCustCount: number;
    coreCustCount: number;
    revivalCustCount: number;
    returnedOrders: number;
    returnedSales: number;
    targetAmount: number;
    targetProgress: number;
    totalCalls: number;
    connectedCalls: number;
    talkedCalls: number;
    answeredCalls: number;
    missedCalls: number;
    inboundCalls: number;
    outboundCalls: number;
    answerRate: number;
    totalMinutes: number;
    avgMinutesPerCall: number;
    workingDays: number;
    avgMinutesPerDay: number;
}

interface TelesaleDetail {
    userId: number;
    name: string;
    firstName: string;
    phone: string;
    teamKey: string;
    teamName: string;
    roleLabel: string;
    isInactive: boolean;
    hasBook: boolean;
    metrics: Metrics;
}

interface RankingItem {
    userId: number;
    name: string;
    value: number;
    [key: string]: unknown;
}

interface TeamTotals {
    totalOrders: number;
    totalSales: number;
    upsellSales: number;
    combinedSales: number;
    totalCalls: number;
    connectedCalls: number;
    talkedCalls: number;
    missedCalls: number;
    totalMinutes: number;
    newCustCount: number;
    coreCustCount: number;
    revivalCustCount: number;
    newCustOrders: number;
    coreCustOrders: number;
    revivalCustOrders: number;
    conversionRate: number;
    returnedOrders: number;
    returnedSales: number;
}

interface TeamOption { key: string; name: string; }
interface AgentOption { id: number; name: string; firstName: string; teamKey: string; roleLabel: string; isInactive: boolean; }

interface PerformanceData {
    period: { year: number; month: number };
    teamTotals: TeamTotals;
    telesaleCount: number;
    previousMonthSales?: number;
    ownedSource?: OwnedSource;
    teams: TeamOption[];
    agents: AgentOption[];
    rankings: {
        byConversion: RankingItem[];
        bySales: RankingItem[];
        byCoreRate: RankingItem[];
        byUpsell: RankingItem[];
    };
    telesaleDetails: TelesaleDetail[];
}

type OwnedSource = 'snapshot' | 'backfill' | 'live';

/** ไม่โชว์ .0 เมื่อเป็นจำนวนเต็ม เช่น 2 วัน (14 ชม.) — เศษยังโชว์ทศนิยม 1 ตำแหน่ง */
const formatWorkQty = (n: number): string => {
    const rounded = Math.round(n * 10) / 10;
    return Math.abs(rounded - Math.round(rounded)) < 1e-6
        ? String(Math.round(rounded))
        : rounded.toFixed(1);
};

/** API ส่งวัน/ชม. ที่แปลงแล้ว — ส–อา 0.75=1 วันเฉพาะ role 6/7; เพดานไม่เกิน 1 วัน/วัน */
const formatWorkingTime = (hours?: number | null, days?: number | null): string => {
    const h = Number(hours);
    const d = Number(days);
    const hasDays = Number.isFinite(d) && d > 0;
    const hasHours = Number.isFinite(h) && h > 0;
    if (!hasDays && !hasHours) return '-';
    const displayDays = hasDays ? d : h / 8;
    const displayHours = hasHours ? h : displayDays * 8;
    return `${formatWorkQty(displayDays)} วัน (${formatWorkQty(displayHours)} ชม.)`;
};

interface SegmentCell {
    owned: number;
    names_called: number;
    total_calls: number;
    talked: number;
    orders: number;
    sales: number;
}
interface SegmentDef { key: string; label: string; tip: string | null; auto: boolean; }
interface SegmentRow {
    agentId: number;
    name: string;
    firstName: string;
    teamKey: string;
    teamName: string;
    roleLabel: string;
    isInactive: boolean;
    hasBook: boolean;
    cells: Record<string, SegmentCell>;
    total: SegmentCell;
}
interface SegmentMatrix {
    period: { year: number; month: number };
    owned_source: OwnedSource;
    snapshot_date: string | null;
    segments: SegmentDef[];
    teams: TeamOption[];
    agents: AgentOption[];
    rows: SegmentRow[];
    totals: { bySegment: Record<string, SegmentCell>; grand: SegmentCell };
}

// ==========================================
// Utils
// ==========================================
const formatNumber = (num: number): string => new Intl.NumberFormat('th-TH').format(Math.round(num || 0));
const formatMoney = (num: number): string => `฿${formatNumber(num)}`;
const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

const THAI_MONTHS = [
    '', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

const OWNED_SOURCE_NOTE: Record<OwnedSource, string> = {
    snapshot: 'ลูกค้าที่ดูแล = ยอด ณ วันสุดท้ายของเดือน (snapshot ที่เก็บไว้คืนนั้น)',
    backfill: 'ลูกค้าที่ดูแล = ยอดสิ้นเดือนที่ย้อนสร้างจาก log การย้ายถัง',
    live: 'ลูกค้าที่ดูแล = ยอด ณ ตอนนี้ (เดือนนี้ยังไม่จบ หรือไม่มี snapshot ของเดือนนั้น)',
};

const authHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
    'Content-Type': 'application/json',
});

// ==========================================
// Small shared UI
// ==========================================
function Tip({ text }: { text: string }) {
    return (
        <span className="relative group inline-flex ml-1 align-middle">
            <span className="w-3.5 h-3.5 rounded-full border border-gray-300 text-gray-400 text-[9px] leading-[13px] text-center cursor-help">?</span>
            <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 hidden group-hover:block w-56 px-3 py-2 text-[11px] leading-snug text-white bg-gray-800 rounded-lg shadow-lg z-[70] text-left font-normal normal-case whitespace-normal">
                {text}
            </span>
        </span>
    );
}

/** Checkbox list in a popover. Empty selection means "ทั้งหมด" — never "ไม่มีเลย". */
function MultiSelect<T extends { key: string; label: string; hint?: string }>({
    label, options, selected, onChange, width = 'w-56', emptyLabel,
}: {
    label: string;
    options: T[];
    selected: string[];
    onChange: (next: string[]) => void;
    width?: string;
    emptyLabel: string;
}) {
    const [open, setOpen] = useState(false);
    const box = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);

    const toggle = (key: string) => {
        onChange(selected.includes(key) ? selected.filter(k => k !== key) : [...selected, key]);
    };

    const summary = selected.length === 0
        ? emptyLabel
        : selected.length === 1
            ? (options.find(o => o.key === selected[0])?.label ?? `เลือก 1`)
            : `เลือก ${selected.length}`;

    return (
        <div className="relative" ref={box}>
            <div className="text-[11px] text-gray-500 mb-1">{label}</div>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className={`${width} px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-left flex justify-between items-center gap-2 hover:border-gray-400`}
            >
                <span className={`truncate ${selected.length ? 'text-gray-800' : 'text-gray-500'}`}>{summary}</span>
                <span className="text-gray-400 text-[10px]">▼</span>
            </button>
            {open && (
                <div className={`absolute top-full left-0 mt-1 ${width} bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-72 overflow-y-auto`}>
                    <button
                        type="button"
                        onClick={() => onChange([])}
                        className={`w-full text-left px-3 py-2 text-sm border-b border-gray-100 hover:bg-gray-50 ${selected.length === 0 ? 'text-blue-600 font-medium' : 'text-gray-600'}`}
                    >
                        {emptyLabel}
                    </button>
                    {options.map(o => (
                        <label key={o.key} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={selected.includes(o.key)}
                                onChange={() => toggle(o.key)}
                                className="rounded text-blue-600 focus:ring-blue-500"
                            />
                            <span className="truncate flex-1">{o.label}</span>
                            {o.hint && <span className="text-[10px] text-gray-400">{o.hint}</span>}
                        </label>
                    ))}
                    {options.length === 0 && <div className="px-3 py-3 text-sm text-gray-400">ไม่มีตัวเลือก</div>}
                </div>
            )}
        </div>
    );
}

function RankingCard({
    title, items, valuePrefix = '', valueSuffix = '', extraInfo, bgColor = 'bg-white',
}: {
    title: string;
    items: RankingItem[];
    valuePrefix?: string;
    valueSuffix?: string;
    extraInfo?: (item: RankingItem) => string;
    bgColor?: string;
}) {
    return (
        <div className={`${bgColor} rounded-lg border border-gray-200 p-4 shadow-sm`}>
            <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
            <div className="mt-3 space-y-2">
                {items.slice(0, 5).map((item, idx) => (
                    <div key={item.userId} className="flex items-center justify-between gap-2 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                idx === 0 ? 'bg-yellow-400 text-yellow-900'
                                    : idx === 1 ? 'bg-gray-300 text-gray-700'
                                        : idx === 2 ? 'bg-amber-600 text-white'
                                            : 'bg-gray-100 text-gray-500'
                            }`}>{idx + 1}</span>
                            <div className="min-w-0">
                                <div className="truncate text-gray-800">{item.name}</div>
                                {extraInfo && <div className="text-[11px] text-gray-400 truncate">{extraInfo(item)}</div>}
                            </div>
                        </div>
                        <span className="font-semibold text-gray-800 tabular-nums whitespace-nowrap">
                            {valuePrefix}{formatNumber(item.value)}{valueSuffix}
                        </span>
                    </div>
                ))}
                {items.length === 0 && <div className="text-sm text-gray-400 py-2">ไม่มีข้อมูล</div>}
            </div>
        </div>
    );
}

function SortableHeader({
    label, field, currentField, direction, onClick, tooltip, className = '',
}: {
    label: string;
    field: keyof Metrics;
    currentField: keyof Metrics;
    direction: 'asc' | 'desc';
    onClick: (field: keyof Metrics) => void;
    tooltip?: string;
    className?: string;
}) {
    const isActive = currentField === field;
    // A caller-supplied text colour has to replace the default, not sit next to it — two utilities
    // of the same specificity resolve by stylesheet order, which is not the order written here.
    const base = className.includes('text-') ? '' : 'text-gray-600';
    return (
        <th
            className={`px-2 py-2 text-center ${base} font-medium cursor-pointer hover:bg-gray-100 whitespace-nowrap text-xs ${className}`}
            onClick={() => onClick(field)}
            title={tooltip}
        >
            <div className="flex items-center justify-center gap-1">
                <span>{label}</span>
                {isActive && <span className="text-blue-500">{direction === 'desc' ? '▼' : '▲'}</span>}
            </div>
        </th>
    );
}

// ==========================================
// Segment matrix — agent (row) × basket (column)
// ==========================================
type SegMetricKey = 'owned' | 'names_called' | 'total_calls' | 'talked' | 'orders' | 'conv' | 'sales';

interface SegMetricDef {
    key: SegMetricKey;
    label: string;
    tip: string;
    /** true when the number is meaningless for someone who holds no customer book (Admin Page) */
    needsBook: boolean;
    value: (c: SegmentCell) => number;
    render: (c: SegmentCell) => string;
}

const SEG_METRICS: SegMetricDef[] = [
    {
        key: 'owned', label: 'ดูแล', needsBook: true,
        tip: 'ลูกค้าที่ดูแล — จำนวนลูกค้าในมือ ณ วันสุดท้ายของเดือนนั้น (ก่อนระบบดึงกลับต้นเดือนถัดไป) เดือนที่ยังไม่จบจะแสดงยอดปัจจุบัน',
        value: c => c.owned, render: c => formatNumber(c.owned),
    },
    {
        key: 'names_called', label: 'ชื่อที่โทร', needsBook: true,
        tip: 'จำนวนลูกค้า (เบอร์ไม่ซ้ำ) ที่โทรออกไปหาในเดือนนี้ — จัดกลุ่มตามถังที่ลูกค้าอยู่ในเดือนนั้น',
        value: c => c.names_called, render: c => formatNumber(c.names_called),
    },
    {
        key: 'total_calls', label: 'สาย', needsBook: true,
        tip: 'จำนวนสายโทรออกทั้งหมด (เบอร์เดิมนับซ้ำได้)',
        value: c => c.total_calls, render: c => formatNumber(c.total_calls),
    },
    {
        key: 'talked', label: 'ได้คุย', needsBook: true,
        tip: 'จำนวนลูกค้า (เบอร์ไม่ซ้ำ) ที่ได้คุยจริง — รับสายและคุย ≥ 30 วินาที นับเป็นคน ไม่ใช่จำนวนครั้ง ' +
             'โทรหาคนเดิม 4 ครั้งแล้วคุยได้ทุกครั้ง ยังนับเป็น 1',
        value: c => c.talked, render: c => formatNumber(c.talked),
    },
    {
        key: 'orders', label: 'ORD', needsBook: false,
        tip: 'จำนวนออเดอร์ที่ปิดได้ในถังนั้น (ไม่รวมบิลยกเลิก/ตีกลับ) จัดกลุ่มตามถังขณะปิดการขาย',
        value: c => c.orders, render: c => formatNumber(c.orders),
    },
    {
        // Divided by ได้คุย, not ชื่อที่โทร: a number that never picked up was never a chance to
        // sell, so counting it as a miss punishes the agent for the customer's phone habits.
        // Same formula as "ปิดการขาย %" in the detail table below — one close rate on the page.
        key: 'conv', label: '%conv', needsBook: true,
        tip: '% ปิดการขาย = ออเดอร์ ÷ ได้คุย (นับเฉพาะลูกค้าที่คุยได้จริง ≥ 30 วินาที ไม่ใช่ทุกเบอร์ที่กดโทร) — สูตรเดียวกับคอลัมน์ “ปิดการขาย %” ในตารางรายละเอียด',
        value: c => pct(c.orders, c.talked),
        render: c => (c.talked > 0 ? `${pct(c.orders, c.talked).toFixed(1)}%` : '-'),
    },
    {
        key: 'sales', label: 'ยอดขาย', needsBook: false,
        tip: 'ยอดขายสุทธิของถังนั้น ไม่รวมของแถม และไม่รวมบิลยกเลิก/หนี้เสีย/ตีกลับ',
        value: c => c.sales, render: c => formatNumber(c.sales),
    },
];

const emptyCell: SegmentCell = { owned: 0, names_called: 0, total_calls: 0, talked: 0, orders: 0, sales: 0 };

/** Row banding does the "which line am I on" work; the segment groups are told apart by a heavier
 *  rule instead of a second background, so the two never fight for the same pixel. */
const ZEBRA = (i: number) => (i % 2 === 1 ? 'bg-slate-50' : 'bg-white');
const SEG_EDGE = 'border-l-2 border-slate-300';

/** "หลุดมือ / นอกถัง" is off out of the box — it is diagnostic, not part of the daily read. */
const DEFAULT_HIDDEN_SEGMENTS = ['other'];

interface ViewPrefs { hiddenSegments: string[]; hiddenMetrics: SegMetricKey[]; }

/** Per-person, per-browser. Keyed on the logged-in user so a shared machine does not hand one
 *  person's layout to the next. Every access is guarded — private windows can throw on read. */
const prefsKey = () => {
    let uid = 'anon';
    try {
        const raw = localStorage.getItem('sessionUser');
        if (raw) {
            const u = JSON.parse(raw);
            if (u && u.id) uid = String(u.id);
        }
    } catch { /* unreadable storage — fall back to the shared key */ }
    return `telesalePerf.segmentView.v1.${uid}`;
};

function useViewPrefs(): [ViewPrefs, (next: ViewPrefs) => void] {
    const [prefs, setPrefs] = useState<ViewPrefs>(() => {
        try {
            const raw = localStorage.getItem(prefsKey());
            if (raw) {
                const p = JSON.parse(raw);
                return {
                    hiddenSegments: Array.isArray(p?.hiddenSegments) ? p.hiddenSegments : DEFAULT_HIDDEN_SEGMENTS,
                    hiddenMetrics: Array.isArray(p?.hiddenMetrics) ? p.hiddenMetrics : [],
                };
            }
        } catch { /* ignore */ }
        return { hiddenSegments: DEFAULT_HIDDEN_SEGMENTS, hiddenMetrics: [] };
    });
    const save = useCallback((next: ViewPrefs) => {
        setPrefs(next);
        try { localStorage.setItem(prefsKey(), JSON.stringify(next)); } catch { /* ignore */ }
    }, []);
    return [prefs, save];
}

function SegmentMatrixTable({ data, loading }: { data: SegmentMatrix | null; loading: boolean }) {
    const [prefs, savePrefs] = useViewPrefs();
    const { hiddenSegments, hiddenMetrics } = prefs;
    const [settingsOpen, setSettingsOpen] = useState(false);
    const settingsBox = useRef<HTMLDivElement>(null);
    const [sort, setSort] = useState<{ seg: string; metric: SegMetricKey } | null>(null);

    useEffect(() => {
        if (!settingsOpen) return;
        const onDoc = (e: MouseEvent) => {
            if (settingsBox.current && !settingsBox.current.contains(e.target as Node)) setSettingsOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, [settingsOpen]);

    const toggleSegment = (key: string) => savePrefs({
        ...prefs,
        hiddenSegments: hiddenSegments.includes(key) ? hiddenSegments.filter(k => k !== key) : [...hiddenSegments, key],
    });
    const toggleMetric = (key: SegMetricKey) => savePrefs({
        ...prefs,
        hiddenMetrics: hiddenMetrics.includes(key) ? hiddenMetrics.filter(k => k !== key) : [...hiddenMetrics, key],
    });

    const segments = useMemo(
        () => (data?.segments ?? []).filter(s => !hiddenSegments.includes(s.key)),
        [data, hiddenSegments]
    );
    const metrics = useMemo(
        () => SEG_METRICS.filter(m => !hiddenMetrics.includes(m.key)),
        [hiddenMetrics]
    );
    const hiddenCount = useMemo(() => {
        const shown = new Set((data?.segments ?? []).map(s => s.key));
        return hiddenSegments.filter(k => shown.has(k)).length + hiddenMetrics.length;
    }, [data, hiddenSegments, hiddenMetrics]);

    const rows = useMemo(() => {
        const list = [...(data?.rows ?? [])];
        if (!sort) return list;
        const def = SEG_METRICS.find(m => m.key === sort.metric)!;
        return list.sort((a, b) => {
            const av = def.value(sort.seg === '_total' ? a.total : (a.cells[sort.seg] ?? emptyCell));
            const bv = def.value(sort.seg === '_total' ? b.total : (b.cells[sort.seg] ?? emptyCell));
            return bv - av;
        });
    }, [data, sort]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" />
            </div>
        );
    }
    if (!data || data.rows.length === 0) {
        return <div className="px-4 py-10 text-center text-gray-500 text-sm">ไม่มีข้อมูลตามตัวกรองที่เลือก</div>;
    }

    const headCell = (segKey: string, m: SegMetricDef, tint: string, first: boolean) => {
        const active = sort?.seg === segKey && sort?.metric === m.key;
        return (
            <th
                key={`${segKey}-${m.key}`}
                onClick={() => setSort(active ? null : { seg: segKey, metric: m.key })}
                title={m.tip}
                className={`px-1.5 py-1.5 text-right font-medium text-[10px] whitespace-nowrap cursor-pointer border-b border-slate-300 ${tint} ${first ? SEG_EDGE : ''} ${active ? 'text-blue-600' : 'text-gray-500'} hover:text-blue-600`}
            >
                {m.label}{active ? ' ▼' : ''}
            </th>
        );
    };

    const bodyCells = (row: SegmentRow, segKey: string, cell: SegmentCell, tint: string) =>
        metrics.map((m, mi) => {
            const blank = m.needsBook && !row.hasBook;
            const zero = !blank && m.value(cell) === 0;
            return (
                <td
                    key={`${row.agentId}-${segKey}-${m.key}`}
                    className={`px-1.5 py-1.5 text-right tabular-nums text-[11px] whitespace-nowrap border-b border-slate-200 ${tint} ${mi === 0 ? SEG_EDGE : ''} ${
                        blank || zero ? 'text-gray-300' : m.key === 'sales' ? 'text-gray-900 font-medium' : 'text-gray-700'
                    }`}
                    title={blank ? 'Admin Page ไม่มีลูกค้าในมือ และไม่มีสายโทรผ่านระบบ CDR' : undefined}
                >
                    {blank ? '–' : zero ? '·' : m.render(cell)}
                </td>
            );
        });

    return (
        <>
            <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between gap-3 bg-white">
                <div className="relative" ref={settingsBox}>
                    <button
                        type="button"
                        onClick={() => setSettingsOpen(o => !o)}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs bg-white hover:border-gray-400 flex items-center gap-2"
                    >
                        ⚙ ตั้งค่าการแสดงผล
                        {hiddenCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px]">ซ่อน {hiddenCount}</span>
                        )}
                    </button>
                    {settingsOpen && (
                        <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-[70vh] overflow-y-auto">
                            <div className="px-3 py-2 border-b border-gray-100 text-[11px] text-gray-500">
                                ค่าที่ตั้งไว้จะถูกจำไว้ให้เฉพาะบัญชีนี้ ไม่กระทบคนอื่น
                            </div>
                            <div className="px-3 py-2">
                                <div className="text-[11px] font-semibold text-gray-600 mb-1.5">ถัง</div>
                                {(data.segments ?? []).map(s => (
                                    <label key={s.key} className="flex items-center gap-2 py-1 text-xs text-gray-700 cursor-pointer hover:bg-gray-50 rounded px-1">
                                        <input
                                            type="checkbox"
                                            checked={!hiddenSegments.includes(s.key)}
                                            onChange={() => toggleSegment(s.key)}
                                            className="rounded text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="flex-1 truncate">{s.label}</span>
                                        {s.auto && <span className="text-[9px] text-gray-400">พิเศษ</span>}
                                    </label>
                                ))}
                            </div>
                            <div className="px-3 py-2 border-t border-gray-100">
                                <div className="text-[11px] font-semibold text-gray-600 mb-1.5">คอลัมน์ในแต่ละถัง</div>
                                {SEG_METRICS.map(m => (
                                    <label key={m.key} className="flex items-center gap-2 py-1 text-xs text-gray-700 cursor-pointer hover:bg-gray-50 rounded px-1">
                                        <input
                                            type="checkbox"
                                            checked={!hiddenMetrics.includes(m.key)}
                                            onChange={() => toggleMetric(m.key)}
                                            className="rounded text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="flex-1">{m.label}</span>
                                    </label>
                                ))}
                            </div>
                            <div className="px-3 py-2 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => savePrefs({ hiddenSegments: DEFAULT_HIDDEN_SEGMENTS, hiddenMetrics: [] })}
                                    className="text-xs text-gray-500 hover:text-gray-700 underline"
                                >
                                    กลับไปใช้ค่าเริ่มต้น
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                <span className="text-[11px] text-gray-400">คลิกหัวคอลัมน์เพื่อเรียงลำดับ</span>
            </div>

            {/* Horizontal scroll only — the table shows every agent, and the page does the vertical
                scrolling so nothing is hidden behind an inner scrollbar. */}
            <div className="overflow-x-auto">
                <table className="text-[11px] border-separate border-spacing-0">
                    <thead>
                        <tr>
                            <th
                                rowSpan={2}
                                className="sticky left-0 top-0 z-40 bg-gray-50 px-3 py-2 text-left font-semibold text-gray-600 text-[11px] border-b border-r border-gray-200 min-w-[150px]"
                            >
                                พนักงาน
                            </th>
                            {segments.map((s, i) => (
                                <th
                                    key={s.key}
                                    colSpan={metrics.length}
                                    className={`sticky top-0 z-30 px-2 py-1.5 text-center font-semibold text-gray-700 text-[11px] whitespace-nowrap border-b border-slate-300 ${SEG_EDGE} ${i % 2 === 1 ? 'bg-slate-100' : 'bg-gray-50'}`}
                                >
                                    <span className={s.auto ? 'text-gray-500 font-medium' : ''}>{s.label}</span>
                                    {s.tip && <Tip text={s.tip} />}
                                    {s.auto && <Tip text="ถังนอกเหนือจาก 8 ถังหลัก — แสดงเฉพาะเดือนที่มีความเคลื่อนไหวจริง" />}
                                </th>
                            ))}
                            <th
                                colSpan={metrics.length}
                                className="sticky top-0 z-30 bg-indigo-50 px-2 py-1.5 text-center font-semibold text-indigo-700 text-[11px] border-b border-l-2 border-indigo-200"
                            >
                                รวมทุกถัง
                            </th>
                        </tr>
                        <tr>
                            {segments.flatMap((s, i) =>
                                metrics.map((m, mi) => headCell(s.key, m, i % 2 === 1 ? 'bg-slate-100' : 'bg-gray-50', mi === 0))
                            )}
                            {metrics.map((m, mi) => headCell('_total', m, 'bg-indigo-50', mi === 0))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, ri) => {
                            const band = ZEBRA(ri);
                            return (
                                <tr key={row.agentId} className={`group ${band}`}>
                                    <td className={`sticky left-0 z-20 ${band} group-hover:bg-amber-50 px-3 py-1.5 border-b border-r-2 border-slate-300 whitespace-nowrap`}>
                                        <span className="text-gray-800 font-medium">{row.firstName}</span>
                                        <span className="text-gray-400 ml-1.5 text-[10px]">{row.teamName}</span>
                                        {row.roleLabel !== 'Telesale' && (
                                            <span className="ml-1.5 text-[9px] px-1 py-0.5 rounded border border-gray-200 text-gray-500">{row.roleLabel}</span>
                                        )}
                                        {row.isInactive && <span className="ml-1 text-[9px] text-rose-500">ออก</span>}
                                    </td>
                                    {segments.flatMap(s =>
                                        bodyCells(row, s.key, row.cells[s.key] ?? emptyCell, `${band} group-hover:bg-amber-50`)
                                    )}
                                    {bodyCells(row, '_total', row.total, 'bg-indigo-50/60 group-hover:bg-amber-50 font-medium')}
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="bg-gray-100 font-semibold">
                            <td className="sticky left-0 z-20 bg-gray-100 px-3 py-2 border-t-2 border-r-2 border-slate-400 text-gray-700 whitespace-nowrap">
                                รวมทั้งหมด ({rows.length} คน)
                            </td>
                            {segments.flatMap(s =>
                                metrics.map((m, mi) => {
                                    const cell = data.totals.bySegment[s.key] ?? emptyCell;
                                    return (
                                        <td key={`t-${s.key}-${m.key}`} className={`px-1.5 py-2 text-right tabular-nums text-[11px] border-t-2 border-slate-400 bg-gray-100 ${mi === 0 ? SEG_EDGE : ''}`}>
                                            {m.value(cell) === 0 ? '·' : m.render(cell)}
                                        </td>
                                    );
                                })
                            )}
                            {metrics.map((m, mi) => (
                                <td key={`tg-${m.key}`} className={`px-1.5 py-2 text-right tabular-nums text-[11px] border-t-2 border-slate-400 bg-indigo-100 text-indigo-900 ${mi === 0 ? SEG_EDGE : ''}`}>
                                    {m.render(data.totals.grand)}
                                </td>
                            ))}
                        </tr>
                    </tfoot>
                </table>
            </div>
        </>
    );
}


// ==========================================
// Main
// ==========================================
export default function TelesalePerformancePage() {
    const currentDate = new Date();
    const API_BASE = resolveApiBasePath();

    // ---- Filters (shared by every dataset on the page) ----
    const [year, setYear] = useState(currentDate.getFullYear());
    const [month, setMonth] = useState(currentDate.getMonth() + 1);
    const [includeTelesale, setIncludeTelesale] = useState(true);
    const [includeAdminPage, setIncludeAdminPage] = useState(false);
    const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
    const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
    const [showInactive, setShowInactive] = useState(false);

    const rolesParam = useMemo(() => {
        const r: string[] = [];
        if (includeTelesale) r.push('telesale');
        if (includeAdminPage) r.push('adminpage');
        return r.length ? r.join(',') : 'telesale';
    }, [includeTelesale, includeAdminPage]);

    const filterQS = useMemo(() => {
        const p = new URLSearchParams();
        p.set('roles', rolesParam);
        if (selectedTeams.length) p.set('teams', selectedTeams.join(','));
        if (selectedAgents.length) p.set('agents', selectedAgents.join(','));
        if (showInactive) p.set('inactive', '1');
        return p.toString();
    }, [rolesParam, selectedTeams, selectedAgents, showInactive]);

    // ---- Monthly summary ----
    const [data, setData] = useState<PerformanceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sortField, setSortField] = useState<keyof Metrics>('combinedSales');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    // ---- Segment matrix ----
    const [matrix, setMatrix] = useState<SegmentMatrix | null>(null);
    const [matrixLoading, setMatrixLoading] = useState(true);

    // ---- Daily (lazy: nothing is fetched until the section is opened) ----
    const [dailyOpen, setDailyOpen] = useState(false);
    const [dailyViewMode, setDailyViewMode] = useState<'old' | 'new'>('old');
    const [dailyDate, setDailyDate] = useState(() => {
        const t = new Date();
        return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    });
    const [oldDailyData, setOldDailyData] = useState<PerformanceData | null>(null);
    const [oldDailyLoading, setOldDailyLoading] = useState(false);
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [startTime, setStartTime] = useState('00:00');
    const [endTime, setEndTime] = useState('23:59');
    const [dailyRecords, setDailyRecords] = useState<DailyRecord[]>([]);
    const [dailyLoading, setDailyLoading] = useState(false);

    const [visibleCols, setVisibleCols] = useState({
        kpi_calls: true, kpi_minutes: true, kpi_avgDailyMinutes: true, kpi_connected: true,
        kpi_avgConnected: true, kpi_talked: true, kpi_avgTalked: true, kpi_missed: true,
        kpi_avgMissed: true, kpi_answerRate: true, kpi_workingHours: true,
        kpi_newCust: true, kpi_coreCust: true, kpi_revivalCust: true, kpi_upsell: true,
        kpi_totalOrders: true, kpi_totalSales: true, kpi_closeRate: true,
        sales_gross: true, sales_cancelled: true, sales_returned: true, sales_net: true,
        sales_bio: true, sales_fertilizer: true, sales_other: true,
    });

    // ---- Target modal ----
    const [showTargetModal, setShowTargetModal] = useState(false);
    const [targetMonth, setTargetMonth] = useState(currentDate.getMonth() + 1);
    const [targetYear, setTargetYear] = useState(currentDate.getFullYear());
    const [targetTelesales, setTargetTelesales] = useState<{ user_id: number; first_name: string; last_name: string; target_amount: number }[]>([]);
    const [targetLoading, setTargetLoading] = useState(false);
    const [savingTarget, setSavingTarget] = useState<number | null>(null);

    // ---- Fetches ----
    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`${API_BASE}/User_DB/telesale_performance.php?year=${year}&month=${month}&${filterQS}`, { headers: authHeaders() });
                if (!res.ok) throw new Error('Failed to fetch data');
                const json = await res.json();
                if (cancelled) return;
                if (json.success) setData(json.data);
                else setError(json.message || 'Failed to load data');
            } catch (err) {
                if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        const t = setTimeout(run, 350);
        return () => { cancelled = true; clearTimeout(t); };
    }, [API_BASE, year, month, filterQS]);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            setMatrixLoading(true);
            try {
                const res = await fetch(`${API_BASE}/User_DB/telesale_segment_matrix.php?year=${year}&month=${month}&${filterQS}`, { headers: authHeaders() });
                const json = await res.json();
                if (!cancelled && json.success) setMatrix(json);
            } catch (err) {
                console.error('Error fetching segment matrix:', err);
            } finally {
                if (!cancelled) setMatrixLoading(false);
            }
        };
        const t = setTimeout(run, 350);
        return () => { cancelled = true; clearTimeout(t); };
    }, [API_BASE, year, month, filterQS]);

    // Daily datasets only exist once the user opens the section — they used to load on every
    // page view even though the section sits below the fold and one of the two tabs is hidden.
    useEffect(() => {
        if (!dailyOpen || dailyViewMode !== 'old') return;
        let cancelled = false;
        const run = async () => {
            setOldDailyLoading(true);
            try {
                const res = await fetch(`${API_BASE}/User_DB/telesale_performance.php?year=${year}&month=${month}&date=${dailyDate}&${filterQS}`, { headers: authHeaders() });
                const json = await res.json();
                if (!cancelled && json.success) setOldDailyData(json.data);
            } catch (err) {
                console.error('Error fetching daily data:', err);
            } finally {
                if (!cancelled) setOldDailyLoading(false);
            }
        };
        const t = setTimeout(run, 350);
        return () => { cancelled = true; clearTimeout(t); };
    }, [API_BASE, dailyOpen, dailyViewMode, dailyDate, year, month, filterQS]);

    useEffect(() => {
        if (!dailyOpen || dailyViewMode !== 'new') return;
        let cancelled = false;
        const run = async () => {
            setDailyLoading(true);
            try {
                const url = `${API_BASE}/User_DB/telesale_daily_performance.php?start_date=${startDate}&end_date=${endDate}&start_time=${startTime}&end_time=${endTime}&${filterQS}`;
                const res = await fetch(url, { headers: authHeaders() });
                const json = await res.json();
                if (!cancelled && json.success) setDailyRecords(json.data.dailyRecords);
            } catch (err) {
                console.error('Error fetching daily data:', err);
            } finally {
                if (!cancelled) setDailyLoading(false);
            }
        };
        const t = setTimeout(run, 350);
        return () => { cancelled = true; clearTimeout(t); };
    }, [API_BASE, dailyOpen, dailyViewMode, startDate, endDate, startTime, endTime, filterQS]);

    // ---- Filter option lists (served by the API, so they always match the viewer's scope) ----
    const teamOptions = useMemo(
        () => (data?.teams ?? []).map(t => ({ key: t.key, label: t.name })),
        [data]
    );
    const agentOptions = useMemo(() => {
        const all = data?.agents ?? [];
        const scoped = selectedTeams.length ? all.filter(a => selectedTeams.includes(a.teamKey)) : all;
        return scoped.map(a => ({
            key: String(a.id),
            label: a.name || a.firstName,
            hint: a.isInactive ? 'ออก' : (a.roleLabel !== 'Telesale' ? a.roleLabel : undefined),
        }));
    }, [data, selectedTeams]);

    // Picking a team must not leave a stranded agent from a team that is no longer shown.
    useEffect(() => {
        if (!selectedTeams.length || !selectedAgents.length || !data) return;
        const allowed = new Set((data.agents ?? []).filter(a => selectedTeams.includes(a.teamKey)).map(a => String(a.id)));
        const next = selectedAgents.filter(id => allowed.has(id));
        if (next.length !== selectedAgents.length) setSelectedAgents(next);
    }, [selectedTeams, data]); // eslint-disable-line react-hooks/exhaustive-deps

    const sortedDetails = useMemo(() => {
        if (!data) return [];
        return [...data.telesaleDetails].sort((a, b) => {
            const av = a.metrics[sortField] ?? 0;
            const bv = b.metrics[sortField] ?? 0;
            return sortDirection === 'desc' ? bv - av : av - bv;
        });
    }, [data, sortField, sortDirection]);

    const handleSort = (field: keyof Metrics) => {
        if (sortField === field) setSortDirection(p => (p === 'desc' ? 'asc' : 'desc'));
        else { setSortField(field); setSortDirection('desc'); }
    };

    const filteredDailyRecords = useMemo(
        () => [...dailyRecords].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || a.name.localeCompare(b.name)),
        [dailyRecords]
    );

    const summaryDailyRecords = useMemo(() => {
        const summary = new Map<number, DailyRecord>();
        filteredDailyRecords.forEach(r => {
            if (!summary.has(r.userId)) {
                summary.set(r.userId, {
                    ...r,
                    date: 'สรุปรวม',
                    metrics: { ...r.metrics, totalCalls: 0, connectedCalls: 0, talkedCalls: 0, missedCalls: 0, totalMinutes: 0, answerRate: 0, workingHours: 0, workingDays: 0,
                        totalSales: 0, upsellSales: 0, cancelledSales: 0, returnedSales: 0, grossSales: 0,
                        totalOrders: 0, upsellOrders: 0, grossOrders: 0, netOrders: 0,
                        newCustOrders: 0, newCustSales: 0, coreCustOrders: 0, coreCustSales: 0,
                        revivalCustOrders: 0, revivalCustSales: 0, bioSales: 0, fertilizerSales: 0, otherSales: 0 },
                });
            }
            const s = summary.get(r.userId)!.metrics;
            const m = r.metrics;
            (Object.keys(s) as (keyof DailyMetrics)[]).forEach(k => {
                if (k === 'answerRate') return;
                s[k] = (s[k] || 0) + (m[k] || 0);
            });
        });
        return Array.from(summary.values()).map(r => {
            r.metrics.answerRate = pct(r.metrics.connectedCalls, r.metrics.totalCalls);
            return r;
        });
    }, [filteredDailyRecords]);

    // ---- Targets ----
    const fetchTargets = useCallback(async (m: number, y: number) => {
        setTargetLoading(true);
        try {
            const res = await fetch(`${API_BASE}/User_DB/sales_targets.php?year=${y}&month=${m}`, { headers: authHeaders() });
            const json = await res.json();
            if (json.success) setTargetTelesales(json.telesales || []);
        } catch (err) {
            console.error('Failed to fetch targets:', err);
        } finally {
            setTargetLoading(false);
        }
    }, [API_BASE]);

    const saveTarget = async (userId: number, targetAmount: number) => {
        setSavingTarget(userId);
        try {
            await fetch(`${API_BASE}/User_DB/sales_targets.php`, {
                method: 'POST', headers: authHeaders(),
                body: JSON.stringify({ action: 'save_one', user_id: userId, month: targetMonth, year: targetYear, target_amount: targetAmount }),
            });
        } catch (err) {
            console.error('Failed to save target:', err);
        } finally {
            setSavingTarget(null);
        }
    };

    const saveAllTargets = async () => {
        setSavingTarget(-1);
        try {
            await fetch(`${API_BASE}/User_DB/sales_targets.php`, {
                method: 'POST', headers: authHeaders(),
                body: JSON.stringify({
                    action: 'save_all', month: targetMonth, year: targetYear,
                    targets: targetTelesales.map(t => ({ user_id: t.user_id, target_amount: t.target_amount })),
                }),
            });
            setShowTargetModal(false);
        } catch (err) {
            console.error('Failed to save all targets:', err);
        } finally {
            setSavingTarget(null);
        }
    };

    const yearOptions: number[] = [];
    for (let y = currentDate.getFullYear(); y >= 2024; y--) yearOptions.push(y);

    const ownedSource: OwnedSource = matrix?.owned_source ?? data?.ownedSource ?? 'live';
    const activeFilterCount = selectedTeams.length + selectedAgents.length + (includeAdminPage ? 1 : 0) + (showInactive ? 1 : 0);

    if (error) {
        return (
            <div className="p-6">
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                    <strong>Error:</strong> {error}
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-4 bg-gray-50 min-h-screen">
            {/* ── Header ─────────────────────────────────────────── */}
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">📊 วิเคราะห์ประสิทธิภาพ Telesale</h1>
                    <p className="text-gray-500 text-sm">
                        {THAI_MONTHS[month]} {year} • พนักงาน {data?.telesaleCount ?? 0} คน
                        {activeFilterCount > 0 && <span className="ml-2 text-blue-600">• กรองอยู่ {activeFilterCount} เงื่อนไข</span>}
                    </p>
                </div>
                <button
                    onClick={() => { setTargetMonth(month); setTargetYear(year); setShowTargetModal(true); fetchTargets(month, year); }}
                    className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 whitespace-nowrap"
                >
                    🎯 ตั้งเป้ายอดขาย
                </button>
            </div>

            {/* ── Filter bar ─────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <div className="flex flex-wrap items-end gap-4">
                    <div>
                        <div className="text-[11px] text-gray-500 mb-1">เดือน</div>
                        <div className="flex gap-2">
                            <select value={month} onChange={e => setMonth(parseInt(e.target.value))}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                                {THAI_MONTHS.slice(1).map((name, idx) => <option key={idx + 1} value={idx + 1}>{name}</option>)}
                            </select>
                            <select value={year} onChange={e => setYear(parseInt(e.target.value))}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <div className="text-[11px] text-gray-500 mb-1">
                            กลุ่มพนักงาน
                            <Tip text="Admin Page ไม่มีลูกค้าในมือและไม่มีสายโทรผ่านระบบ CDR — เปิดดูได้เฉพาะฝั่งออเดอร์/ยอดขาย จึงไม่ถูกรวมไว้ตั้งแต่แรก" />
                        </div>
                        <div className="flex gap-2">
                            {[
                                { on: includeTelesale, set: setIncludeTelesale, label: 'Telesale + หัวหน้า', other: includeAdminPage },
                                { on: includeAdminPage, set: setIncludeAdminPage, label: 'Admin Page', other: includeTelesale },
                            ].map(chip => (
                                <button
                                    key={chip.label}
                                    type="button"
                                    onClick={() => { if (chip.on && !chip.other) return; chip.set(!chip.on); }}
                                    title={chip.on && !chip.other ? 'ต้องเลือกอย่างน้อย 1 กลุ่ม' : undefined}
                                    className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                                        chip.on ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium' : 'bg-white border-gray-300 text-gray-500 hover:border-gray-400'
                                    }`}
                                >
                                    {chip.on ? '✓ ' : ''}{chip.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <MultiSelect label="ทีม" options={teamOptions} selected={selectedTeams} onChange={setSelectedTeams} emptyLabel="ทุกทีม" />
                    <MultiSelect label="รายคน" options={agentOptions} selected={selectedAgents} onChange={setSelectedAgents} emptyLabel="ทุกคน" width="w-60" />

                    <label className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={showInactive}
                            onChange={e => setShowInactive(e.target.checked)}
                            className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        แสดงคนที่ออกแล้ว
                        <Tip text="คนที่ลาออก/ปิดบัญชีไปแล้ว ลูกค้าในมือถูกดึงคืนหมด จึงเหลือแต่ยอดขายของเดือนที่เขายังทำงานอยู่" />
                    </label>

                    {activeFilterCount > 0 && (
                        <button
                            onClick={() => { setSelectedTeams([]); setSelectedAgents([]); setIncludeAdminPage(false); setIncludeTelesale(true); setShowInactive(false); }}
                            className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 underline"
                        >
                            ล้างตัวกรอง
                        </button>
                    )}
                </div>
            </div>

            {loading && !data ? (
                <div className="flex items-center justify-center py-24">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
                </div>
            ) : (
                <>
                    {/* ── Hero ───────────────────────────────────── */}
                    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                            <div>
                                <div className="text-sm text-gray-500 mb-1">ยอดขายสุทธิ {THAI_MONTHS[month]}</div>
                                <div className="text-3xl font-bold text-gray-800 tracking-tight">
                                    {formatMoney(data?.teamTotals.combinedSales || 0)}
                                </div>
                                <div className="text-sm text-gray-500 mt-1">
                                    ปกติ {formatMoney(data?.teamTotals.totalSales || 0)} + Upsell {formatMoney(data?.teamTotals.upsellSales || 0)}
                                    {(data?.teamTotals.returnedSales || 0) > 0 && (
                                        <span className="text-orange-600"> · หักบิลตีกลับแล้ว {formatMoney(data?.teamTotals.returnedSales || 0)}</span>
                                    )}
                                </div>
                                {data?.previousMonthSales !== undefined && (
                                    <div className="mt-2">
                                        {(() => {
                                            const prev = data.previousMonthSales || 0;
                                            const curr = data.teamTotals.combinedSales || 0;
                                            const diff = curr - prev;
                                            const p = prev > 0 ? ((diff / prev) * 100).toFixed(1) : '∞';
                                            const up = diff >= 0;
                                            return (
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${up ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {up ? '+' : ''}{p}% vs เดือนก่อน
                                                </span>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>
                            <div className="flex gap-4 text-center">
                                <div className="px-4 py-2 bg-gray-50 rounded-lg border border-gray-100">
                                    <div className="text-2xl font-bold text-gray-800">{formatNumber(data?.teamTotals.totalOrders || 0)}</div>
                                    <div className="text-xs text-gray-500">ออเดอร์</div>
                                </div>
                                <div className="px-4 py-2 bg-gray-50 rounded-lg border border-gray-100">
                                    <div className="text-2xl font-bold text-gray-800">{formatNumber(data?.teamTotals.talkedCalls || 0)}</div>
                                    <div className="text-xs text-gray-500 flex items-center justify-center">
                                        ได้คุย<Tip text="จำนวนลูกค้า (เบอร์ไม่ซ้ำ) ที่คุยได้ ≥ 30 วินาที รวมทุกคนในตัวกรอง — ลูกค้าที่ถูกเทเล 2 คนโทรหา จะถูกนับทั้งสองฝั่ง" />
                                    </div>
                                </div>
                                <div className="px-4 py-2 bg-gray-50 rounded-lg border border-gray-100">
                                    <div className="text-2xl font-bold text-gray-800">{data?.teamTotals.conversionRate || 0}%</div>
                                    <div className="text-xs text-gray-500 flex items-center justify-center">
                                        ปิดการขาย<Tip text="ออเดอร์ ÷ ได้คุย — สูตรเดียวกันทั้งหน้า (รายคน ทีม และรายวัน)" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Roll-up cards ──────────────────────────── */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                            { label: 'ลูกค้าใหม่', tip: 'ถัง: ลูกค้าใหม่ + หาคนดูแลใหม่ + รอคนมาจีบให้ติด', count: data?.teamTotals.newCustCount, orders: data?.teamTotals.newCustOrders, unit: 'ออเดอร์' },
                            { label: 'ลูกค้าเก่า 3 เดือน', tip: 'ถัง: ส่วนตัว 1-2 เดือน + ส่วนตัวโอกาสสุดท้าย', count: data?.teamTotals.coreCustCount, orders: data?.teamTotals.coreCustOrders, unit: 'ซื้อซ้ำ' },
                            { label: 'ลูกค้าขุด', tip: 'ถัง: 6-9 เดือน + 9-12 เดือน + 1-3 ปี + โบราณ (6-9/9-12 เพิ่งถูกนับเข้ามา หลังแตกออกจากถัง 6-12 เดือนเมื่อ พ.ค. 2026)', count: data?.teamTotals.revivalCustCount, orders: data?.teamTotals.revivalCustOrders, unit: 'กู้สำเร็จ' },
                        ].map(card => (
                            <div key={card.label} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                                <div className="flex items-center gap-1 mb-2">
                                    <span className="font-semibold text-gray-700">{card.label}</span>
                                    <Tip text={card.tip} />
                                </div>
                                <div className="flex justify-between items-end">
                                    <div>
                                        <div className="text-3xl font-bold text-gray-800">{formatNumber(card.count || 0)}</div>
                                        <div className="text-xs text-gray-500">ถือครอง</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xl font-bold text-gray-600">{formatNumber(card.orders || 0)}</div>
                                        <div className="text-xs text-gray-500">{card.unit}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="text-[11px] text-gray-400 -mt-2">{OWNED_SOURCE_NOTE[ownedSource]}</div>

                    {/* ── Rankings ───────────────────────────────── */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <RankingCard title="ยอดขายรวมสูงสุด" items={data?.rankings.bySales || []} valuePrefix="฿"
                            extraInfo={item => `Upsell: ฿${formatNumber(item.upsell as number)}`} />
                        <RankingCard title="อัตราปิดการขายสูงสุด" items={data?.rankings.byConversion || []} valueSuffix="%"
                            extraInfo={item => `ได้คุย ${item.calls} → ${item.orders} ออเดอร์`} />
                        <RankingCard title="ลูกค้าเก่าซื้อซ้ำสูงสุด" items={data?.rankings.byCoreRate || []} valueSuffix="%"
                            extraInfo={item => `${item.orders}/${item.count} ซื้อซ้ำ`} />
                        <RankingCard title="Upsell สูงสุด" items={data?.rankings.byUpsell || []} valuePrefix="฿"
                            extraInfo={item => `${item.orders} ออเดอร์`} bgColor="bg-gray-50" />
                    </div>

                    {/* ── Segment matrix ─────────────────────────── */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-4 border-b border-gray-200 flex flex-wrap items-baseline justify-between gap-2">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-800">🧺 แยกตามถัง (Segment)</h2>
                                <p className="text-[11px] text-gray-500 mt-0.5">
                                    แถว = พนักงาน · คอลัมน์ = ถัง — {OWNED_SOURCE_NOTE[ownedSource]}
                                    {matrix?.snapshot_date && <span className="text-gray-400"> ({matrix.snapshot_date})</span>}
                                </p>
                            </div>
                        </div>
                        <SegmentMatrixTable data={matrix} loading={matrixLoading} />
                    </div>

                    {/* ── Detail table ───────────────────────────── */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                        <div className="p-4 border-b border-gray-200">
                            <h2 className="text-lg font-semibold text-gray-800">📋 รายละเอียด Telesale</h2>
                            <p className="text-[11px] text-gray-500 mt-0.5">ยอดรวมรายคน — รายละเอียดแยกถังดูได้ที่ตาราง “แยกตามถัง” ด้านบน</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead className="bg-gray-50 sticky top-0">
                                    <tr>
                                        <th className="px-2 py-2 text-left text-gray-600 font-medium whitespace-nowrap">#</th>
                                        <th className="px-2 py-2 text-left text-gray-600 font-medium whitespace-nowrap sticky left-0 bg-gray-50 z-10">ชื่อ</th>
                                        <SortableHeader label="ออเดอร์" field="totalOrders" currentField={sortField} direction={sortDirection} onClick={handleSort} tooltip="จำนวนบิลที่ปิดได้ นับแบบไม่ซ้ำ (บิลที่มีทั้งขายปกติและ Upsell นับใบเดียว)" />
                                        <SortableHeader label="ปิดการขาย %" field="conversionRate" currentField={sortField} direction={sortDirection} onClick={handleSort} tooltip="ออเดอร์ ÷ ได้คุย" />
                                        <SortableHeader label="ยอดขาย" field="totalSales" currentField={sortField} direction={sortDirection} onClick={handleSort} tooltip="ยอดขายปกติ (ไม่รวม Upsell) ไม่รวมบิลยกเลิก/หนี้เสีย/ตีกลับ" />
                                        <SortableHeader label="ลค.3เดือน" field="customers90Days" currentField={sortField} direction={sortDirection} onClick={handleSort} tooltip="ลูกค้าถังส่วนตัว 1-2 เดือน + โอกาสสุดท้าย ณ สิ้นเดือนนั้น" />
                                        <SortableHeader label="ขายปุ๋ย/ออเดอร์" field="aovFertilizer" currentField={sortField} direction={sortDirection} onClick={handleSort} tooltip="เฉลี่ย/บิล เฉพาะบิลที่มีสินค้าปุ๋ย" />
                                        <SortableHeader label="ขายชีวภัณฑ์/ออเดอร์" field="aovBio" currentField={sortField} direction={sortDirection} onClick={handleSort} tooltip="เฉลี่ย/บิล เฉพาะบิลที่มีสินค้าชีวภัณฑ์" />
                                        <SortableHeader label="Upsell ใบ" field="upsellOrders" currentField={sortField} direction={sortDirection} onClick={handleSort} className="bg-blue-50 text-blue-700 border-l-2 border-gray-300" />
                                        <SortableHeader label="Upsell บาท" field="upsellSales" currentField={sortField} direction={sortDirection} onClick={handleSort} className="bg-blue-50 text-blue-700" />
                                        <SortableHeader label="ตีกลับ ใบ" field="returnedOrders" currentField={sortField} direction={sortDirection} onClick={handleSort} className="bg-red-50 text-red-600 border-l-2 border-gray-300" tooltip="บิลที่ตีกลับ — ถูกหักออกจากยอดขายแล้ว แสดงไว้ให้เห็นความเสียหาย" />
                                        <SortableHeader label="ตีกลับ บาท" field="returnedSales" currentField={sortField} direction={sortDirection} onClick={handleSort} className="bg-red-50 text-red-600" />
                                        <SortableHeader label="ยอดรวม" field="combinedSales" currentField={sortField} direction={sortDirection} onClick={handleSort} className="bg-blue-100 text-blue-800 font-bold border-l-2 border-gray-300" tooltip="ปกติ + Upsell" />
                                        <SortableHeader label="🎯 เป้า" field="targetProgress" currentField={sortField} direction={sortDirection} onClick={handleSort} className="border-l-2 border-gray-300" />
                                        <SortableHeader label="สาย" field="totalCalls" currentField={sortField} direction={sortDirection} onClick={handleSort} className="border-l-2 border-gray-300" />
                                        <SortableHeader label="นาที" field="totalMinutes" currentField={sortField} direction={sortDirection} onClick={handleSort} />
                                        <SortableHeader label="รับสาย" field="connectedCalls" currentField={sortField} direction={sortDirection} onClick={handleSort} />
                                        <SortableHeader label="ได้คุย (คน)" field="talkedCalls" currentField={sortField} direction={sortDirection} onClick={handleSort} tooltip="จำนวนลูกค้า (เบอร์ไม่ซ้ำ) ที่โทรออกไปแล้วคุยได้ ≥ 30 วินาที — นับเป็นคน ไม่ใช่จำนวนครั้ง" />
                                        <SortableHeader label="ไม่ได้รับ" field="missedCalls" currentField={sortField} direction={sortDirection} onClick={handleSort} />
                                        <SortableHeader label="%รับ" field="answerRate" currentField={sortField} direction={sortDirection} onClick={handleSort} tooltip="รับสาย ÷ สายทั้งหมด (รวมสายเข้า)" />
                                        <SortableHeader label="วันงาน" field="workingDays" currentField={sortField} direction={sortDirection} onClick={handleSort} />
                                        <SortableHeader label="นาที/สาย" field="avgMinutesPerCall" currentField={sortField} direction={sortDirection} onClick={handleSort} />
                                        <SortableHeader label="นาที/วัน" field="avgMinutesPerDay" currentField={sortField} direction={sortDirection} onClick={handleSort} />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {sortedDetails.map((ts, idx) => (
                                        <tr key={ts.userId} className="hover:bg-gray-50">
                                            <td className="px-2 py-2 text-gray-400">{idx + 1}</td>
                                            <td className="px-2 py-2 font-medium text-gray-800 whitespace-nowrap sticky left-0 bg-white z-10">
                                                {ts.firstName}
                                                <span className="text-gray-400 ml-1.5 text-[10px]">{ts.teamName}</span>
                                                {ts.roleLabel !== 'Telesale' && <span className="ml-1 text-[9px] px-1 rounded border border-gray-200 text-gray-500">{ts.roleLabel}</span>}
                                            </td>
                                            <td className="px-2 py-2 text-center">{formatNumber(ts.metrics.totalOrders)}</td>
                                            <td className="px-2 py-2 text-center">{ts.metrics.conversionRate}%</td>
                                            <td className="px-2 py-2 text-center">{formatNumber(ts.metrics.totalSales)}</td>
                                            <td className="px-2 py-2 text-center">{ts.hasBook ? formatNumber(ts.metrics.customers90Days) : '–'}</td>
                                            <td className="px-2 py-2 text-center">{formatNumber(ts.metrics.aovFertilizer)}</td>
                                            <td className="px-2 py-2 text-center">{formatNumber(ts.metrics.aovBio)}</td>
                                            <td className="px-2 py-2 text-center bg-blue-50/40 border-l-2 border-gray-200">{ts.metrics.upsellOrders || '·'}</td>
                                            <td className="px-2 py-2 text-right bg-blue-50/40">{ts.metrics.upsellSales ? formatNumber(ts.metrics.upsellSales) : '·'}</td>
                                            {/* Returned bills are already out of the sales figures — this block is the size of
                                                the hole they left, so it keeps the red block fill that makes it findable. */}
                                            <td className="px-2 py-2 text-center bg-red-50/50 border-l-2 border-gray-200">
                                                {ts.metrics.returnedOrders > 0
                                                    ? <span className="text-red-600 font-medium">{formatNumber(ts.metrics.returnedOrders)}</span>
                                                    : <span className="text-gray-300">·</span>}
                                            </td>
                                            <td className="px-2 py-2 text-right bg-red-50/50">
                                                {ts.metrics.returnedSales > 0
                                                    ? <span className="text-red-600 font-medium">{formatMoney(ts.metrics.returnedSales)}</span>
                                                    : <span className="text-gray-300">·</span>}
                                            </td>
                                            <td className="px-2 py-2 text-right bg-blue-100 font-bold text-blue-800 border-l-2 border-gray-200">{formatMoney(ts.metrics.combinedSales)}</td>
                                            <td className="px-2 py-2 border-l-2 border-gray-200">
                                                {ts.metrics.targetAmount > 0 ? (
                                                    <div className="flex flex-col items-center gap-0.5">
                                                        <div className="w-16 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                                            <div
                                                                className={`h-1.5 rounded-full transition-all ${
                                                                    ts.metrics.targetProgress >= 100 ? 'bg-green-500'
                                                                        : ts.metrics.targetProgress >= 80 ? 'bg-yellow-500' : 'bg-red-500'
                                                                }`}
                                                                style={{ width: `${Math.min(ts.metrics.targetProgress, 100)}%` }}
                                                            />
                                                        </div>
                                                        <span className={`text-[10px] font-medium ${
                                                            ts.metrics.targetProgress >= 100 ? 'text-green-600'
                                                                : ts.metrics.targetProgress >= 80 ? 'text-yellow-600' : 'text-red-600'
                                                        }`}>
                                                            {ts.metrics.targetProgress.toFixed(0)}%
                                                        </span>
                                                    </div>
                                                ) : <span className="text-gray-400 text-[10px]">–</span>}
                                            </td>
                                            <td className="px-2 py-2 text-center border-l-2 border-gray-200">{ts.hasBook ? formatNumber(ts.metrics.totalCalls) : '–'}</td>
                                            <td className="px-2 py-2 text-center">{ts.hasBook ? formatNumber(ts.metrics.totalMinutes) : '–'}</td>
                                            <td className="px-2 py-2 text-center text-emerald-600">{ts.hasBook ? formatNumber(ts.metrics.connectedCalls) : '–'}</td>
                                            <td className="px-2 py-2 text-center">{ts.hasBook ? formatNumber(ts.metrics.talkedCalls) : '–'}</td>
                                            <td className="px-2 py-2 text-center text-red-500">{ts.hasBook ? formatNumber(ts.metrics.missedCalls) : '–'}</td>
                                            <td className="px-2 py-2 text-center">
                                                {ts.hasBook ? (
                                                    <span className={`inline-block px-1.5 py-0.5 rounded-full text-xs font-medium ${
                                                        ts.metrics.answerRate >= 80 ? 'bg-emerald-100 text-emerald-700'
                                                            : ts.metrics.answerRate >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                                                    }`}>
                                                        {ts.metrics.answerRate.toFixed(1)}%
                                                    </span>
                                                ) : '–'}
                                            </td>
                                            <td className="px-2 py-2 text-center">{ts.metrics.workingDays ? ts.metrics.workingDays.toFixed(1) : '·'}</td>
                                            <td className="px-2 py-2 text-center">{ts.hasBook ? ts.metrics.avgMinutesPerCall.toFixed(1) : '–'}</td>
                                            {/* Minutes on the phone per day worked — the one number that says whether the
                                                shift was actually spent dialling, so it keeps its heat scale. */}
                                            <td className={`px-2 py-2 text-center font-medium ${!ts.hasBook ? '' :
                                                ts.metrics.avgMinutesPerDay >= 100 ? 'bg-green-100 text-green-700'
                                                    : ts.metrics.avgMinutesPerDay >= 80 ? 'bg-red-50 text-red-600'
                                                        : ts.metrics.avgMinutesPerDay >= 60 ? 'bg-red-100 text-red-700'
                                                            : ts.metrics.avgMinutesPerDay >= 40 ? 'bg-red-200 text-red-800'
                                                                : 'bg-red-300 text-red-900'
                                            }`}>
                                                {ts.hasBook ? ts.metrics.avgMinutesPerDay.toFixed(0) : '–'}
                                            </td>
                                        </tr>
                                    ))}
                                    {sortedDetails.length === 0 && (
                                        <tr><td colSpan={23} className="px-4 py-8 text-center text-gray-500">ไม่มีข้อมูลตามตัวกรองที่เลือก</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* ── Daily section (lazy) ───────────────────── */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <button
                            onClick={() => setDailyOpen(o => !o)}
                            className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50"
                        >
                            <span className="text-lg font-semibold text-gray-800">📅 ผลงานรายวัน</span>
                            <span className="text-sm text-gray-500">{dailyOpen ? 'ซ่อน ▲' : 'แสดง ▼'}</span>
                        </button>

                        {dailyOpen && (
                            <div className="border-t border-gray-200">
                                <div className="flex items-center gap-2 px-4 pt-3 border-b border-gray-200">
                                    {([['old', 'สรุปภาพรวมรายวัน'], ['new', 'เจาะลึก KPI & หมวดหมู่']] as const).map(([mode, label]) => (
                                        <button
                                            key={mode}
                                            onClick={() => setDailyViewMode(mode)}
                                            className={`px-4 py-2 font-medium text-sm transition-colors ${
                                                dailyViewMode === mode ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>

                                {dailyViewMode === 'old' && (
                                    <div>
                                        <div className="px-4 py-3 flex items-center justify-between gap-3 bg-gray-50 border-b border-gray-200">
                                            <h3 className="font-semibold text-gray-800">สรุปผลงานรายวัน</h3>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => { const d = new Date(dailyDate); d.setDate(d.getDate() - 1); setDailyDate(d.toISOString().split('T')[0]); }}
                                                    className="px-3 py-2 bg-white border rounded-lg text-gray-700 hover:bg-gray-50">←</button>
                                                <input type="date" value={dailyDate} onChange={e => setDailyDate(e.target.value)}
                                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white" />
                                                <button onClick={() => { const d = new Date(dailyDate); d.setDate(d.getDate() + 1); setDailyDate(d.toISOString().split('T')[0]); }}
                                                    className="px-3 py-2 bg-white border rounded-lg text-gray-700 hover:bg-gray-50">→</button>
                                            </div>
                                        </div>
                                        <div className="overflow-x-auto">
                                            {oldDailyLoading ? (
                                                <div className="flex items-center justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" /></div>
                                            ) : (
                                                <table className="w-full text-sm">
                                                    <thead className="bg-gray-50 text-gray-700">
                                                        <tr>
                                                            <th className="px-2 py-2 text-left font-medium">#</th>
                                                            <th className="px-2 py-2 text-left font-medium">ชื่อ</th>
                                                            <th className="px-2 py-2 text-center font-medium">สายที่โทร</th>
                                                            <th className="px-2 py-2 text-center font-medium">นาที</th>
                                                            <th className="px-2 py-2 text-center font-medium">รับสาย</th>
                                                            <th className="px-2 py-2 text-center font-medium">ได้คุย</th>
                                                            <th className="px-2 py-2 text-center font-medium">ไม่ได้รับ</th>
                                                            <th className="px-2 py-2 text-center font-medium">%รับ</th>
                                                            <th className="px-2 py-2 text-center font-medium border-l border-gray-200">ออเดอร์</th>
                                                            <th className="px-2 py-2 text-center font-medium">ยอดขาย</th>
                                                            <th className="px-2 py-2 text-center font-medium">% ปิด</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100">
                                                        {(oldDailyData?.telesaleDetails ?? []).map((ts, idx) => (
                                                            <tr key={ts.userId} className="hover:bg-gray-50">
                                                                <td className="px-2 py-2 text-gray-400">{idx + 1}</td>
                                                                <td className="px-2 py-2 font-medium text-gray-800">{ts.firstName}</td>
                                                                <td className="px-2 py-2 text-center">{ts.metrics.totalCalls || '-'}</td>
                                                                <td className="px-2 py-2 text-center">{ts.metrics.totalMinutes > 0 ? ts.metrics.totalMinutes.toFixed(0) : '-'}</td>
                                                                <td className="px-2 py-2 text-center text-emerald-600">{ts.metrics.connectedCalls || '-'}</td>
                                                                <td className="px-2 py-2 text-center">{ts.metrics.talkedCalls || '-'}</td>
                                                                <td className="px-2 py-2 text-center text-red-500">{ts.metrics.missedCalls || '-'}</td>
                                                                <td className="px-2 py-2 text-center">{ts.metrics.answerRate}%</td>
                                                                <td className="px-2 py-2 text-center border-l border-gray-100 font-semibold">{ts.metrics.totalOrders || '-'}</td>
                                                                <td className="px-2 py-2 text-center text-green-700">{ts.metrics.combinedSales > 0 ? formatMoney(ts.metrics.combinedSales) : '-'}</td>
                                                                <td className={`px-2 py-2 text-center font-medium ${ts.metrics.conversionRate >= 5 ? 'text-green-600' : ts.metrics.conversionRate >= 2 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                                    {ts.metrics.conversionRate > 0 ? `${ts.metrics.conversionRate}%` : '-'}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                        {(!oldDailyData || oldDailyData.telesaleDetails.length === 0) && (
                                                            <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-500">ไม่มีข้อมูลสำหรับวันที่เลือก</td></tr>
                                                        )}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {dailyViewMode === 'new' && (
                                    <div>
                                        <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gray-50 border-b border-gray-200">
                                            <h3 className="font-semibold text-gray-800">ตรวจสอบ KPI & ยอดขายรายวัน</h3>
                                            <div className="flex items-center gap-2">
                                                <div className="w-64 bg-white">
                                                    <UniversalDateRangePicker
                                                        value={{ start: startDate, end: endDate }}
                                                        onChange={val => { setStartDate(val.start); setEndDate(val.end); }}
                                                    />
                                                </div>
                                                <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-lg px-2 py-2 h-[42px]">
                                                    <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                                                        className="border-none bg-transparent text-sm focus:ring-0 p-0 text-gray-700 w-24 text-center" />
                                                    <span className="text-gray-400">-</span>
                                                    <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                                                        className="border-none bg-transparent text-sm focus:ring-0 p-0 text-gray-700 w-24 text-center" />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-3 border-b border-gray-200 text-xs">
                                            <div className="font-semibold text-gray-700 mb-2">ซ่อน/แสดง คอลัมน์:</div>
                                            <div className="flex flex-wrap gap-x-3 gap-y-1">
                                                {([
                                                    ['kpi_calls', 'สายที่โทร'], ['kpi_minutes', 'นาที'], ['kpi_avgDailyMinutes', 'โทรเฉลี่ย/วัน'],
                                                    ['kpi_connected', 'รับสาย'], ['kpi_talked', 'ได้คุย'], ['kpi_missed', 'ไม่ได้รับ'],
                                                    ['kpi_answerRate', '%รับ'], ['kpi_workingHours', 'วันทำงาน'],
                                                    ['kpi_newCust', 'ลค.ใหม่'], ['kpi_coreCust', 'ลค.เก่า'], ['kpi_revivalCust', 'ลค.ขุด'],
                                                    ['kpi_upsell', 'Upsell'], ['kpi_totalOrders', 'ออเดอร์'], ['kpi_totalSales', 'ยอดขาย'], ['kpi_closeRate', '% ปิด'],
                                                    ['sales_gross', 'ยอดตั้งต้น'], ['sales_cancelled', 'ยอดยกเลิก'], ['sales_returned', 'ยอดตีกลับ'],
                                                    ['sales_bio', 'ชีวภัณฑ์'], ['sales_fertilizer', 'ปุ๋ย'], ['sales_other', 'อื่นๆ'],
                                                ] as [keyof typeof visibleCols, string][]).map(([key, label]) => (
                                                    <label key={key} className="flex items-center gap-1 cursor-pointer">
                                                        <input type="checkbox" checked={visibleCols[key]}
                                                            onChange={e => setVisibleCols(p => ({ ...p, [key]: e.target.checked }))} />
                                                        {label}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="overflow-auto max-h-[600px]">
                                            {dailyLoading ? (
                                                <div className="flex items-center justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" /></div>
                                            ) : (
                                                <table className="w-full text-xs">
                                                    <thead className="bg-gray-100 text-gray-700 sticky top-0 z-10">
                                                        <tr>
                                                            <th className="px-2 py-2 text-left font-medium sticky left-0 bg-gray-100">วันที่</th>
                                                            <th className="px-2 py-2 text-left font-medium">ชื่อ</th>
                                                            {visibleCols.kpi_calls && <th className="px-2 py-2 text-center font-medium">สาย</th>}
                                                            {visibleCols.kpi_minutes && <th className="px-2 py-2 text-center font-medium">นาที</th>}
                                                            {visibleCols.kpi_avgDailyMinutes && <th className="px-2 py-2 text-center font-medium">นาที/วันทำงาน</th>}
                                                            {visibleCols.kpi_connected && <th className="px-2 py-2 text-center font-medium">รับสาย</th>}
                                                            {visibleCols.kpi_talked && <th className="px-2 py-2 text-center font-medium">ได้คุย</th>}
                                                            {visibleCols.kpi_missed && <th className="px-2 py-2 text-center font-medium">ไม่ได้รับ</th>}
                                                            {visibleCols.kpi_answerRate && <th className="px-2 py-2 text-center font-medium">%รับ</th>}
                                                            {visibleCols.kpi_workingHours && <th className="px-2 py-2 text-center font-medium">วันทำงาน</th>}
                                                            {visibleCols.kpi_newCust && <th className="px-2 py-2 text-center font-medium border-l border-gray-200">ลค.ใหม่</th>}
                                                            {visibleCols.kpi_coreCust && <th className="px-2 py-2 text-center font-medium">ลค.เก่า</th>}
                                                            {visibleCols.kpi_revivalCust && <th className="px-2 py-2 text-center font-medium">ลค.ขุด</th>}
                                                            {visibleCols.kpi_upsell && <th className="px-2 py-2 text-center font-medium">Upsell</th>}
                                                            {visibleCols.kpi_totalOrders && <th className="px-2 py-2 text-center font-medium border-l border-gray-200">ออเดอร์</th>}
                                                            {visibleCols.kpi_totalSales && <th className="px-2 py-2 text-center font-medium">ยอดสุทธิ</th>}
                                                            {visibleCols.kpi_closeRate && <th className="px-2 py-2 text-center font-medium">% ปิด</th>}
                                                            {visibleCols.sales_gross && <th className="px-2 py-2 text-right font-medium border-l border-gray-200">ตั้งต้น</th>}
                                                            {visibleCols.sales_cancelled && <th className="px-2 py-2 text-right font-medium text-red-600">ยกเลิก</th>}
                                                            {visibleCols.sales_returned && <th className="px-2 py-2 text-right font-medium text-orange-600">ตีกลับ</th>}
                                                            {visibleCols.sales_bio && <th className="px-2 py-2 text-right font-medium border-l border-gray-200">ชีวภัณฑ์</th>}
                                                            {visibleCols.sales_fertilizer && <th className="px-2 py-2 text-right font-medium">ปุ๋ย</th>}
                                                            {visibleCols.sales_other && <th className="px-2 py-2 text-right font-medium">อื่นๆ</th>}
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100">
                                                        {filteredDailyRecords.map(ts => {
                                                            const m = ts.metrics;
                                                            const net = m.totalSales + m.upsellSales;
                                                            const closeRate = pct(m.netOrders, m.talkedCalls);
                                                            return (
                                                                <tr key={`${ts.userId}-${ts.date}`} className="hover:bg-gray-50">
                                                                    <td className="px-2 py-1.5 sticky left-0 bg-white whitespace-nowrap text-gray-600">{ts.date}</td>
                                                                    <td className="px-2 py-1.5 font-medium text-gray-800 whitespace-nowrap">{ts.name}</td>
                                                                    {visibleCols.kpi_calls && <td className="px-2 py-1.5 text-center">{m.totalCalls || '·'}</td>}
                                                                    {visibleCols.kpi_minutes && <td className="px-2 py-1.5 text-center">{m.totalMinutes > 0 ? m.totalMinutes.toFixed(0) : '·'}</td>}
                                                                    {visibleCols.kpi_avgDailyMinutes && <td className="px-2 py-1.5 text-center text-gray-300">·</td>}
                                                                    {visibleCols.kpi_connected && <td className="px-2 py-1.5 text-center text-emerald-600">{m.connectedCalls || '·'}</td>}
                                                                    {visibleCols.kpi_talked && <td className="px-2 py-1.5 text-center">{m.talkedCalls || '·'}</td>}
                                                                    {visibleCols.kpi_missed && <td className="px-2 py-1.5 text-center text-red-500">{m.missedCalls || '·'}</td>}
                                                                    {visibleCols.kpi_answerRate && <td className="px-2 py-1.5 text-center">{m.totalCalls ? `${m.answerRate.toFixed(1)}%` : '·'}</td>}
                                                                    {visibleCols.kpi_workingHours && <td className="px-2 py-1.5 text-center text-blue-600 whitespace-nowrap">{m.workingHours > 0 ? formatWorkingTime(m.workingHours, m.workingDays) : '·'}</td>}
                                                                    {visibleCols.kpi_newCust && <td className="px-2 py-1.5 text-center border-l border-gray-100">{m.newCustOrders || '·'}</td>}
                                                                    {visibleCols.kpi_coreCust && <td className="px-2 py-1.5 text-center">{m.coreCustOrders || '·'}</td>}
                                                                    {visibleCols.kpi_revivalCust && <td className="px-2 py-1.5 text-center">{m.revivalCustOrders || '·'}</td>}
                                                                    {visibleCols.kpi_upsell && <td className="px-2 py-1.5 text-center">{m.upsellOrders || '·'}</td>}
                                                                    {visibleCols.kpi_totalOrders && <td className="px-2 py-1.5 text-center border-l border-gray-100 font-semibold">{m.netOrders || '·'}</td>}
                                                                    {visibleCols.kpi_totalSales && <td className="px-2 py-1.5 text-center text-green-700">{net > 0 ? formatNumber(net) : '·'}</td>}
                                                                    {visibleCols.kpi_closeRate && <td className="px-2 py-1.5 text-center">{closeRate > 0 ? `${closeRate.toFixed(1)}%` : '·'}</td>}
                                                                    {visibleCols.sales_gross && <td className="px-2 py-1.5 text-right border-l border-gray-100">{m.grossSales > 0 ? formatNumber(m.grossSales) : '·'}</td>}
                                                                    {visibleCols.sales_cancelled && <td className="px-2 py-1.5 text-right text-red-500">{m.cancelledSales > 0 ? `-${formatNumber(m.cancelledSales)}` : '·'}</td>}
                                                                    {visibleCols.sales_returned && <td className="px-2 py-1.5 text-right text-orange-500">{m.returnedSales > 0 ? `-${formatNumber(m.returnedSales)}` : '·'}</td>}
                                                                    {visibleCols.sales_bio && <td className="px-2 py-1.5 text-right border-l border-gray-100">{m.bioSales > 0 ? formatNumber(m.bioSales) : '·'}</td>}
                                                                    {visibleCols.sales_fertilizer && <td className="px-2 py-1.5 text-right">{m.fertilizerSales > 0 ? formatNumber(m.fertilizerSales) : '·'}</td>}
                                                                    {visibleCols.sales_other && <td className="px-2 py-1.5 text-right">{m.otherSales > 0 ? formatNumber(m.otherSales) : '·'}</td>}
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                    <tfoot className="bg-blue-50/50 border-t-2 border-gray-300">
                                                        {summaryDailyRecords.map(ts => {
                                                            const m = ts.metrics;
                                                            const net = m.totalSales + m.upsellSales;
                                                            // API แปลงวันทำงานมาให้แล้ว (ส-อา 6 ชม. = 1 วันเต็มสำหรับ role 6/7)
                                                            const workingDays = m.workingDays > 0 ? m.workingDays : m.workingHours / 8;
                                                            const closeRate = pct(m.netOrders, m.talkedCalls);
                                                            const perDay = (v: number) =>
                                                                workingDays > 0 ? v / workingDays : null;
                                                            const avgCell = (v: number) => {
                                                                const r = perDay(v);
                                                                if (r === null) {
                                                                    return v > 0
                                                                        ? <span className="text-red-500 font-bold" title="มีกิจกรรม แต่ไม่มีบันทึกเวลาทำงาน">⚠️ 0</span>
                                                                        : <span className="text-gray-300">·</span>;
                                                                }
                                                                return <span className="font-semibold">{r.toFixed(0)}</span>;
                                                            };
                                                            return (
                                                                <tr key={`sum-${ts.userId}`} className="font-semibold text-gray-800">
                                                                    <td className="px-2 py-2 sticky left-0 bg-blue-50">สรุปรวม</td>
                                                                    <td className="px-2 py-2 whitespace-nowrap">{ts.name}</td>
                                                                    {visibleCols.kpi_calls && <td className="px-2 py-2 text-center">{m.totalCalls || '·'}</td>}
                                                                    {visibleCols.kpi_minutes && <td className="px-2 py-2 text-center">{m.totalMinutes > 0 ? m.totalMinutes.toFixed(0) : '·'}</td>}
                                                                    {visibleCols.kpi_avgDailyMinutes && <td className="px-2 py-2 text-center">{avgCell(m.totalMinutes)}</td>}
                                                                    {visibleCols.kpi_connected && <td className="px-2 py-2 text-center">{m.connectedCalls || '·'}</td>}
                                                                    {visibleCols.kpi_talked && <td className="px-2 py-2 text-center">{m.talkedCalls || '·'}</td>}
                                                                    {visibleCols.kpi_missed && <td className="px-2 py-2 text-center">{m.missedCalls || '·'}</td>}
                                                                    {visibleCols.kpi_answerRate && <td className="px-2 py-2 text-center">{m.totalCalls ? `${m.answerRate.toFixed(1)}%` : '·'}</td>}
                                                                    {visibleCols.kpi_workingHours && <td className="px-2 py-2 text-center text-blue-700 whitespace-nowrap">{m.workingHours > 0 ? formatWorkingTime(m.workingHours, m.workingDays) : '·'}</td>}
                                                                    {visibleCols.kpi_newCust && <td className="px-2 py-2 text-center border-l border-gray-200">{m.newCustOrders || '·'}</td>}
                                                                    {visibleCols.kpi_coreCust && <td className="px-2 py-2 text-center">{m.coreCustOrders || '·'}</td>}
                                                                    {visibleCols.kpi_revivalCust && <td className="px-2 py-2 text-center">{m.revivalCustOrders || '·'}</td>}
                                                                    {visibleCols.kpi_upsell && <td className="px-2 py-2 text-center">{m.upsellOrders || '·'}</td>}
                                                                    {visibleCols.kpi_totalOrders && <td className="px-2 py-2 text-center border-l border-gray-200 text-blue-700">{m.netOrders || '·'}</td>}
                                                                    {visibleCols.kpi_totalSales && <td className="px-2 py-2 text-center text-green-700">{net > 0 ? formatNumber(net) : '·'}</td>}
                                                                    {visibleCols.kpi_closeRate && <td className="px-2 py-2 text-center">{closeRate > 0 ? `${closeRate.toFixed(1)}%` : '·'}</td>}
                                                                    {visibleCols.sales_gross && <td className="px-2 py-2 text-right border-l border-gray-200">{formatNumber(m.grossSales)}</td>}
                                                                    {visibleCols.sales_cancelled && <td className="px-2 py-2 text-right text-red-600">{m.cancelledSales > 0 ? `-${formatNumber(m.cancelledSales)}` : '·'}</td>}
                                                                    {visibleCols.sales_returned && <td className="px-2 py-2 text-right text-orange-600">{m.returnedSales > 0 ? `-${formatNumber(m.returnedSales)}` : '·'}</td>}
                                                                    {visibleCols.sales_bio && <td className="px-2 py-2 text-right border-l border-gray-200">{m.bioSales > 0 ? formatNumber(m.bioSales) : '·'}</td>}
                                                                    {visibleCols.sales_fertilizer && <td className="px-2 py-2 text-right">{m.fertilizerSales > 0 ? formatNumber(m.fertilizerSales) : '·'}</td>}
                                                                    {visibleCols.sales_other && <td className="px-2 py-2 text-right">{m.otherSales > 0 ? formatNumber(m.otherSales) : '·'}</td>}
                                                                </tr>
                                                            );
                                                        })}
                                                    </tfoot>
                                                </table>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* ── Target modal ───────────────────────────────────── */}
            {showTargetModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowTargetModal(false)}>
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                            <h2 className="text-lg font-bold">🎯 ตั้งเป้ายอดขาย</h2>
                            <button onClick={() => setShowTargetModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
                        </div>
                        <div className="px-4 py-3 border-b border-gray-100 flex gap-2">
                            <select value={targetMonth} onChange={e => { const m = parseInt(e.target.value); setTargetMonth(m); fetchTargets(m, targetYear); }}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                                {THAI_MONTHS.slice(1).map((name, idx) => <option key={idx + 1} value={idx + 1}>{name}</option>)}
                            </select>
                            <select value={targetYear} onChange={e => { const y = parseInt(e.target.value); setTargetYear(y); fetchTargets(targetMonth, y); }}
                                className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                                {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                        <div className="p-4 overflow-y-auto max-h-[50vh] space-y-2">
                            {targetLoading ? (
                                <div className="text-center py-6 text-gray-500">กำลังโหลด...</div>
                            ) : targetTelesales.map(t => (
                                <div key={t.user_id} className="flex items-center gap-2">
                                    <span className="flex-1 text-sm text-gray-700 truncate">{t.first_name} {t.last_name}</span>
                                    <input
                                        type="number"
                                        value={t.target_amount || 0}
                                        onChange={e => setTargetTelesales(prev => prev.map(x => x.user_id === t.user_id ? { ...x, target_amount: parseFloat(e.target.value) || 0 } : x))}
                                        className="w-32 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                                    />
                                    <button onClick={() => saveTarget(t.user_id, t.target_amount)} disabled={savingTarget === t.user_id}
                                        className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 disabled:opacity-50">
                                        {savingTarget === t.user_id ? '...' : 'บันทึก'}
                                    </button>
                                </div>
                            ))}
                            {!targetLoading && targetTelesales.length === 0 && <div className="text-center py-6 text-gray-500">ไม่มีข้อมูล</div>}
                        </div>
                        <div className="px-4 py-3 border-t border-gray-200 flex justify-end gap-2">
                            <button onClick={() => setShowTargetModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">ปิด</button>
                            <button onClick={saveAllTargets} disabled={savingTarget === -1}
                                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                                {savingTarget === -1 ? 'กำลังบันทึก...' : 'บันทึกทั้งหมด'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
