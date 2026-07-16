import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CalendarDays,
  FileBarChart,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  PackageCheck,
  Package,
  CalendarPlus,
  Save,
  X,
} from 'lucide-react';
import { User, UserRole } from '@/types';
import { listStockPlans, listStockPlanProducts, saveStockPlanProduct, deleteStockPlan, listTonDivisors, saveTonDivisor, listFactoryHolidays, saveFactoryHoliday, deleteFactoryHoliday } from '@/services/api';
import StockPlanFormModal from '@/components/StockPlanFormModal';
import StockPlanScheduleModal from '@/components/StockPlanScheduleModal';
import StockPlanReconcileModal from '@/components/StockPlanReconcileModal';
import HoverTooltip from '@/components/HoverTooltip';

interface StockPlanItemRef {
  id: number;
  product_id: number;
  planned_qty: number;
  sku?: string;
  product_name?: string;
}

interface StockPlanRef {
  id: number;
  planned_date: string;
  notes: string | null;
  company_id: number | null;
  created_by_name?: string | null;
  created_at?: string | null;
}

export interface PendingStockPlanRow {
  kind: 'pending';
  display_date: string;
  remaining_qty: number;
  item: StockPlanItemRef;
  plan: StockPlanRef;
}

export interface StockPlanExpectation {
  kind: 'expectation';
  id: number;
  display_date: string;
  expected_qty: number;
  expected_date: string;
  so_number: string | null;
  status: 'expected' | 'confirmed' | 'closed_short';
  actual_qty: number | null;
  actual_date: string | null;
  note: string | null;
  next_expectation_id: number | null;
  scheduled_by_name?: string | null;
  scheduled_at?: string | null;
  confirmed_by_name?: string | null;
  confirmed_at?: string | null;
  item: StockPlanItemRef;
  plan: StockPlanRef;
}

export type StockPlanRow = PendingStockPlanRow | StockPlanExpectation;

const shortStamp = (ts?: string | null) => (ts ? ts.slice(0, 16) : '');

interface StockArrivalPlanningPageProps {
  currentUser?: User;
  companyId?: number;
}

const STATUS_META: Record<string, { label: string; badge: string; dot: string }> = {
  pending: { label: 'α╕úα╕¡α╕üα╕│α╕½α╕Öα╕öα╕ºα╕▒α╕Öα╕ùα╕╡α╣êα╕äα╕▓α╕öα╕ºα╣êα╕▓α╕êα╕░α╣Çα╕éα╣ëα╕▓', badge: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-400' },
  expected: { label: 'α╕äα╕▓α╕öα╕ºα╣êα╕▓α╕êα╕░α╣Çα╕éα╣ëα╕▓', badge: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-400' },
  confirmed: { label: 'α╕óα╕╖α╕Öα╕óα╕▒α╕Öα╕úα╕▒α╕Üα╣Çα╕éα╣ëα╕▓α╣üα╕Ñα╣ëα╕º', badge: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-500' },
  closed_short: { label: 'α╕¢α╕┤α╕ö - α╣äα╕íα╣êα╕äα╕úα╕Ü', badge: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500' },
};

const rowStatus = (row: StockPlanRow) => (row.kind === 'pending' ? 'pending' : row.status);

interface TonDivisorRow {
  product_id: number;
  sku?: string;
  product_name?: string;
  divisor: number | null;
  effective_from?: string | null;
}

interface ProductSummary {
  product_id: number;
  sku?: string;
  product_name?: string;
  totalQty: number;
  receivedQty: number;
}

const formatTon = (qty: number, divisor: number | null | undefined) => {
  if (!divisor || divisor <= 0) return null;
  return (qty / divisor).toFixed(2);
};

const MONTH_NAMES_TH = [
  'α╕íα╕üα╕úα╕▓α╕äα╕í', 'α╕üα╕╕α╕íα╕áα╕▓α╕₧α╕▒α╕Öα╕ÿα╣î', 'α╕íα╕╡α╕Öα╕▓α╕äα╕í', 'α╣Çα╕íα╕⌐α╕▓α╕óα╕Ö', 'α╕₧α╕ñα╕⌐α╕áα╕▓α╕äα╕í', 'α╕íα╕┤α╕ûα╕╕α╕Öα╕▓α╕óα╕Ö',
  'α╕üα╕úα╕üα╕Äα╕▓α╕äα╕í', 'α╕¬α╕┤α╕çα╕½α╕▓α╕äα╕í', 'α╕üα╕▒α╕Öα╕óα╕▓α╕óα╕Ö', 'α╕òα╕╕α╕Ñα╕▓α╕äα╕í', 'α╕₧α╕ñα╕¿α╕êα╕┤α╕üα╕▓α╕óα╕Ö', 'α╕ÿα╕▒α╕Öα╕ºα╕▓α╕äα╕í',
];
const WEEKDAY_NAMES_TH = ['α╕¡α╕▓', 'α╕ê', 'α╕¡', 'α╕₧', 'α╕₧α╕ñ', 'α╕¿', 'α╕¬'];

function buildCalendarMatrix(year: number, month: number): (string | null)[] {
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startWeekday = firstDay.getDay();

  const cells: (string | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(month).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    cells.push(`${year}-${mm}-${dd}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// α╕¬α╕┤α╕Öα╕äα╣ëα╕▓α╕éα╕¡α╕çα╣üα╕₧α╕Ñα╕Öα╣âα╕èα╣ëα╣üα╕äα╕òα╕òα╕▓α╕Ñα╣çα╕¡α╕üα╣üα╕óα╕üα╕éα╕¡α╕çα╕òα╕▒α╕ºα╣Çα╕¡α╕ç (stock_arrival_products) α╣äα╕íα╣êα╕£α╕╣α╕üα╕üα╕▒α╕Üα╕òα╕▓α╕úα╕▓α╕ç products α╕½α╕Ñα╕▒α╕ü
// α╕üα╕▓α╕úα╕íα╕¡α╕çα╣Çα╕½α╣çα╕Öα╣üα╕₧α╕Ñα╕Öα╕éα╣ëα╕▓α╕íα╕Üα╕úα╕┤α╕⌐α╕▒α╕ù (α╕₧α╕úα╕╡α╕íα╣êα╕▓α╣üα╕₧α╕¬α╕èα╕▒α╣êα╕Ö49 + α╕₧α╕úα╕╡α╕¡α╕¡α╕Öα╕┤α╕ä) α╕êα╕▒α╕öα╕üα╕▓α╕úα╕¥α╕▒α╣êα╕ç backend: api/inventory/stock_plan_company_group.php

const StockArrivalPlanningPage: React.FC<StockArrivalPlanningPageProps> = ({ currentUser, companyId }) => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [viewMode, setViewMode] = useState<'calendar' | 'report' | 'settings'>('calendar');
  const [rows, setRows] = useState<StockPlanRow[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [reportDivisorRows, setReportDivisorRows] = useState<TonDivisorRow[]>([]); // value effective as of the viewed month
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [formDate, setFormDate] = useState<string | null | undefined>(undefined); // undefined = closed
  const [scheduleTarget, setScheduleTarget] = useState<PendingStockPlanRow | null>(null);
  const [reconcileTarget, setReconcileTarget] = useState<StockPlanExpectation | null>(null);

  const isSuperAdmin = currentUser?.role === UserRole.SuperAdmin;
  const effectiveCompanyId = companyId ?? currentUser?.companyId;

  const loadPlans = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listStockPlans({ month, year, companyId: effectiveCompanyId });
      setRows(res?.data ?? []);
    } catch (err) {
      console.error('Error loading stock plans:', err);
      setError('α╣äα╕íα╣êα╕¬α╕▓α╕íα╕▓α╕úα╕ûα╣éα╕½α╕Ñα╕öα╕éα╣ëα╕¡α╕íα╕╣α╕Ñα╣üα╕₧α╕Ñα╕Öα╣äα╕öα╣ë');
    } finally {
      setLoading(false);
    }
  };

  const loadReportTonDivisors = async () => {
    try {
      const asOfDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const res = await listTonDivisors({ asOfDate, companyId: effectiveCompanyId });
      setReportDivisorRows(res?.data ?? []);
    } catch (err) {
      console.error('Error loading report ton divisors:', err);
    }
  };

  const loadCatalog = async () => {
    try {
      const res = await listStockPlanProducts();
      setProducts(res?.data ?? []);
    } catch (err) {
      console.error('Error loading plan product catalog:', err);
      setProducts([]);
    }
  };

  // Load ALL configured holidays (not month-scoped) so the settings list shows everything;
  // the calendar keys them by full date so current-month rendering still picks up the right ones.
  const [holidays, setHolidays] = useState<{ id: number; holiday_date: string; label: string | null }[]>([]);
  const loadHolidays = async () => {
    try {
      const res = await listFactoryHolidays();
      setHolidays(res?.data ?? []);
    } catch (err) {
      console.error('Error loading factory holidays:', err);
    }
  };

  const [settingsTab, setSettingsTab] = useState<'catalog' | 'holidays' | 'divisor'>('catalog');

  useEffect(() => { loadPlans(); }, [month, year, effectiveCompanyId]);
  useEffect(() => { loadCatalog(); }, []);
  useEffect(() => { loadReportTonDivisors(); }, [month, year, effectiveCompanyId]);
  useEffect(() => { loadHolidays(); }, []);
  // Safety net: freshly refetch divisors whenever the user lands on report/settings,
  // so a save made elsewhere (other tab/user) can never leave stale "α╕óα╕▒α╕çα╣äα╕íα╣êα╕òα╕▒α╣ëα╕çα╕äα╣êα╕▓" cells
  useEffect(() => { if (viewMode === 'report' || viewMode === 'settings') loadReportTonDivisors(); }, [viewMode]);

  const holidayByDay = useMemo(() => {
    const map: Record<string, { id: number; holiday_date: string; label: string | null }> = {};
    holidays.forEach(h => { map[h.holiday_date.slice(0, 10)] = h; });
    return map;
  }, [holidays]);

  const reportTonDivisorMap = useMemo(() => {
    const map: Record<number, number> = {};
    reportDivisorRows.forEach(r => { if (r.divisor) map[r.product_id] = r.divisor; });
    return map;
  }, [reportDivisorRows]);

  const productSummaries = useMemo(() => {
    const map: Record<number, ProductSummary> = {};
    rows.forEach(row => {
      const pid = row.item.product_id;
      if (!map[pid]) {
        map[pid] = { product_id: pid, sku: row.item.sku, product_name: row.item.product_name, totalQty: 0, receivedQty: 0 };
      }
      const qty = row.kind === 'pending' ? row.remaining_qty : row.expected_qty;
      map[pid].totalQty += qty;
      if (row.kind === 'expectation' && row.status === 'confirmed') {
        map[pid].receivedQty += row.actual_qty ?? 0;
      }
    });
    return Object.values(map).sort((a, b) => (a.product_name ?? '').localeCompare(b.product_name ?? '', 'th'));
  }, [rows]);

  const reportTotals = useMemo(() => {
    const totalModels = productSummaries.length;
    const totalQty = productSummaries.reduce((sum, p) => sum + p.totalQty, 0);
    const confirmedList = productSummaries.filter(p => p.receivedQty > 0);
    const confirmedQty = productSummaries.reduce((sum, p) => sum + p.receivedQty, 0);
    const outstandingList = productSummaries.filter(p => Math.max(p.totalQty - p.receivedQty, 0) > 0);
    const outstandingQty = productSummaries.reduce((sum, p) => sum + Math.max(p.totalQty - p.receivedQty, 0), 0);
    return {
      totalModels, totalQty,
      confirmedModels: confirmedList.length, confirmedQty,
      outstandingModels: outstandingList.length, outstandingQty,
    };
  }, [productSummaries]);

  const itemsByDay = useMemo(() => {
    const map: Record<string, StockPlanRow[]> = {};
    rows.forEach(row => {
      const key = row.display_date.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(row);
    });
    return map;
  }, [rows]);

  const goPrevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); } else { setMonth(m => m - 1); }
  };
  const goNextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); } else { setMonth(m => m + 1); }
  };

  const handleDeletePlan = async (planId: number) => {
    if (!confirm('α╕òα╣ëα╕¡α╕çα╕üα╕▓α╕úα╕Ñα╕Üα╣üα╕₧α╕Ñα╕Öα╕Öα╕╡α╣ëα╣âα╕èα╣êα╕½α╕úα╕╖α╕¡α╣äα╕íα╣ê? (α╣âα╕èα╣ëα╕¬α╕│α╕½α╕úα╕▒α╕Üα╕üα╕úα╕ôα╕╡α╕ëα╕╕α╕üα╣Çα╕ëα╕┤α╕Öα╣Çα╕ùα╣êα╕▓α╕Öα╕▒α╣ëα╕Ö)')) return;
    try {
      await deleteStockPlan(planId, true);
      setSelectedDay(null);
      loadPlans();
    } catch (err: any) {
      alert(err?.data?.error || err?.message || 'α╕Ñα╕Üα╣äα╕íα╣êα╕¬α╕│α╣Çα╕úα╣çα╕ê');
    }
  };

  const productLabel = (row: StockPlanRow) => `${row.item.sku ?? row.item.product_id} ${row.item.product_name ?? ''}`.trim();

  const rowQty = (row: StockPlanRow) => (row.kind === 'pending' ? row.remaining_qty : (row.actual_qty ?? row.expected_qty));

  const calendarLabel = (row: StockPlanRow) => `${row.item.product_name ?? row.item.sku ?? row.item.product_id} ┬╖ ${rowQty(row)}`;

  const renderStatusBadge = (status: string) => {
    const meta = STATUS_META[status] ?? STATUS_META.pending;
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border ${meta.badge}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
        {meta.label}
      </span>
    );
  };

  const renderTooltipContent = (row: StockPlanRow) => {
    const meta = STATUS_META[rowStatus(row)] ?? STATUS_META.pending;
    return (
      <div className="space-y-1">
        <div className="font-semibold text-white">{row.item.product_name ?? row.item.sku ?? row.item.product_id}</div>
        {row.item.sku && <div className="text-gray-400">SKU: {row.item.sku}</div>}
        <div className="flex items-center gap-1.5 pt-0.5">
          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
          <span>{meta.label}</span>
        </div>
        {row.kind === 'pending' ? (
          <div className="text-gray-300">α╣üα╕₧α╕Ñα╕Öα╕úα╕ºα╕í {row.item.planned_qty} ┬╖ α╕óα╕▒α╕çα╣äα╕íα╣êα╕üα╕│α╕½α╕Öα╕öα╕ºα╕▒α╕Öα╕ùα╕╡α╣ê {row.remaining_qty}</div>
        ) : (
          <>
            <div className="text-gray-300">
              α╕äα╕▓α╕öα╕ºα╣êα╕▓α╕êα╕░α╣Çα╕éα╣ëα╕▓ {row.expected_qty}
              {row.actual_qty !== null ? ` ┬╖ α╕êα╕úα╕┤α╕ç ${row.actual_qty}` : ''}
            </div>
            {row.so_number && <div className="text-gray-300">SO: {row.so_number}</div>}
            {row.note && <div className="text-gray-400 italic">"{row.note}"</div>}
          </>
        )}
        <div className="border-t border-gray-700 mt-1.5 pt-1.5 space-y-0.5 text-[11px] text-gray-400">
          {row.plan.created_by_name && <div>α╣üα╕₧α╕Ñα╕Öα╣éα╕öα╕ó {row.plan.created_by_name} ┬╖ {shortStamp(row.plan.created_at)}</div>}
          {row.kind === 'expectation' && row.scheduled_by_name && (
            <div>α╕üα╕│α╕½α╕Öα╕öα╕ºα╕▒α╕Öα╣éα╕öα╕ó {row.scheduled_by_name} ┬╖ {shortStamp(row.scheduled_at)}</div>
          )}
          {row.kind === 'expectation' && row.confirmed_by_name && (
            <div>α╕óα╕╖α╕Öα╕óα╕▒α╕Öα╣éα╕öα╕ó {row.confirmed_by_name} ┬╖ {shortStamp(row.confirmed_at)}</div>
          )}
        </div>
      </div>
    );
  };

  const handleRowAction = (row: StockPlanRow) => {
    if (row.kind === 'pending') setScheduleTarget(row);
    else if (row.status === 'expected') setReconcileTarget(row);
  };

  const handleDayClick = (day: string) => {
    setSelectedDay(prev => (prev === day ? null : day));
  };

  // ==================== Calendar View ====================
  const calendarCells = useMemo(() => buildCalendarMatrix(year, month), [year, month]);

  const renderCalendarView = () => (
    <div className="bg-white rounded-xl border shadow-sm p-3">
      <div className="grid grid-cols-7 text-center text-xs font-semibold text-gray-500 mb-2">
        {WEEKDAY_NAMES_TH.map(w => <div key={w} className="py-1">{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {calendarCells.map((day, idx) => {
          if (!day) return <div key={idx} className="min-h-[130px] rounded-lg bg-gray-50/40" />;
          const dayItems = itemsByDay[day] ?? [];
          const isSelected = selectedDay === day;
          const isToday = day === now.toISOString().slice(0, 10);
          const holiday = holidayByDay[day];
          return (
            <button
              key={idx}
              onClick={() => handleDayClick(day)}
              className={`min-h-[130px] rounded-lg border p-1.5 text-left align-top hover:border-blue-400 transition-colors ${isSelected ? 'border-blue-500 ring-1 ring-blue-500' : holiday ? 'border-red-200 bg-red-50/60' : 'border-gray-200'}`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className={`text-xs font-semibold ${isToday ? 'text-blue-600' : holiday ? 'text-red-500' : 'text-gray-600'}`}>{Number(day.slice(8, 10))}</span>
                {holiday && (
                  <span className="text-[9px] px-1 py-0.5 rounded bg-red-100 text-red-600 border border-red-200 truncate" title={holiday.label ?? 'α╕ºα╕▒α╕Öα╕½α╕óα╕╕α╕öα╣éα╕úα╕çα╕çα╕▓α╕Ö'}>
                    {holiday.label || 'α╕½α╕óα╕╕α╕öα╣éα╕úα╕çα╕çα╕▓α╕Ö'}
                  </span>
                )}
              </div>
              <div className="mt-1 space-y-0.5">
                {dayItems.slice(0, 5).map((row, i) => {
                  const meta = STATUS_META[rowStatus(row)] ?? STATUS_META.pending;
                  return (
                    <HoverTooltip key={i} content={renderTooltipContent(row)}>
                      <div className={`text-[10px] px-1 py-0.5 rounded truncate ${meta.badge}`}>
                        {calendarLabel(row)}
                      </div>
                    </HoverTooltip>
                  );
                })}
                {dayItems.length > 5 && (
                  <div className="text-[10px] text-gray-400">+{dayItems.length - 5} α╣Çα╕₧α╕┤α╣êα╕íα╣Çα╕òα╕┤α╕í</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  // ==================== Day Detail Side Panel (popup) ====================
  const dayRows = selectedDay ? (itemsByDay[selectedDay] ?? []) : [];
  const dayPlanGroups = useMemo(() => {
    const groups: Record<number, { plan: StockPlanRef; rows: StockPlanRow[] }> = {};
    dayRows.forEach(row => {
      if (!groups[row.plan.id]) groups[row.plan.id] = { plan: row.plan, rows: [] };
      groups[row.plan.id].rows.push(row);
    });
    return Object.values(groups);
  }, [dayRows]);

  const renderDayPanel = () => {
    if (!selectedDay) return null;
    return createPortal(
      <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] bg-white shadow-2xl z-40 flex flex-col border-l">
        <header className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div>
            <h3 className="font-semibold text-gray-800">{selectedDay}</h3>
            <p className="text-xs text-gray-500">α╕úα╕▓α╕óα╕üα╕▓α╕úα╣üα╕₧α╕Ñα╕Ö/α╕äα╕▓α╕öα╕ºα╣êα╕▓α╕êα╕░α╣Çα╕éα╣ëα╕▓α╕éα╕¡α╕çα╕ºα╕▒α╕Öα╕Öα╕╡α╣ë</p>
            {holidayByDay[selectedDay] && (
              <p className="text-xs text-red-600 font-medium mt-0.5">≡ƒÅ¡ α╕ºα╕▒α╕Öα╕½α╕óα╕╕α╕öα╣éα╕úα╕çα╕çα╕▓α╕Ö{holidayByDay[selectedDay].label ? `: ${holidayByDay[selectedDay].label}` : ''}</p>
            )}
          </div>
          <button onClick={() => setSelectedDay(null)} className="text-gray-400 hover:text-gray-600 rounded-full p-1 hover:bg-gray-200">
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <button
            onClick={() => setFormDate(selectedDay)}
            className="w-full bg-blue-600 text-white px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 hover:bg-blue-700 text-sm font-medium"
          >
            <Plus size={16} /> α╣Çα╕₧α╕┤α╣êα╕íα╣üα╕₧α╕Ñα╕Öα╕ºα╕▒α╕Öα╕Öα╕╡α╣ë
          </button>

          {dayPlanGroups.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">α╣äα╕íα╣êα╕íα╕╡α╣üα╕₧α╕Ñα╕Öα╕ºα╕▒α╕Öα╕Öα╕╡α╣ë</p>
          )}

          {dayPlanGroups.map(group => (
            <div key={group.plan.id} className="border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between bg-gray-50 px-3 py-2 border-b">
                <div className="min-w-0">
                  <div className="text-xs text-gray-500 truncate">α╣üα╕₧α╕Ñα╕Ö #{group.plan.id} ┬╖ {group.plan.planned_date.slice(0, 10)}{group.plan.notes ? ` ┬╖ ${group.plan.notes}` : ''}</div>
                  {group.plan.created_by_name && (
                    <div className="text-[11px] text-gray-400">α╕¬α╕úα╣ëα╕▓α╕çα╣éα╕öα╕ó {group.plan.created_by_name} ┬╖ {shortStamp(group.plan.created_at)}</div>
                  )}
                </div>
                {isSuperAdmin && (
                  <button onClick={() => handleDeletePlan(group.plan.id)} className="shrink-0 text-gray-400 hover:text-red-600" title="α╕Ñα╕Üα╣üα╕₧α╕Ñα╕Ö (α╕ëα╕╕α╕üα╣Çα╕ëα╕┤α╕Ö)">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <div className="divide-y">
                {group.rows.map((row, i) => (
                  <div key={i} className="p-3">
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <span className="font-medium text-sm">{productLabel(row)}</span>
                      {renderStatusBadge(rowStatus(row))}
                    </div>
                    {row.kind === 'expectation' && row.so_number && <div className="text-xs text-gray-400">SO: {row.so_number}</div>}
                    {row.kind === 'pending' ? (
                      <>
                        <div className="text-xs text-gray-500">α╣üα╕₧α╕Ñα╕Öα╕úα╕ºα╕í {row.item.planned_qty} ┬╖ α╕óα╕▒α╕çα╣äα╕íα╣êα╕üα╕│α╕½α╕Öα╕öα╕ºα╕▒α╕Öα╕ùα╕╡α╣ê {row.remaining_qty}</div>
                        <button
                          onClick={() => handleRowAction(row)}
                          className="mt-2 text-blue-600 hover:text-blue-800 text-xs font-medium flex items-center gap-1 border border-blue-200 rounded-lg px-2 py-1 hover:bg-blue-50"
                        >
                          <CalendarPlus size={14} /> α╕üα╕│α╕½α╕Öα╕öα╕ºα╕▒α╕Öα╕ùα╕╡α╣êα╕äα╕▓α╕öα╕ºα╣êα╕▓α╕êα╕░α╣Çα╕éα╣ëα╕▓
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="text-xs text-gray-500">
                          α╕äα╕▓α╕öα╕ºα╣êα╕▓α╕êα╕░α╣Çα╕éα╣ëα╕▓ {row.expected_qty}
                          {row.actual_qty !== null ? ` ┬╖ α╕êα╕úα╕┤α╕ç ${row.actual_qty}` : ''}
                        </div>
                        {row.note && <div className="text-xs text-gray-400 mt-1">α╕½α╕íα╕▓α╕óα╣Çα╕½α╕òα╕╕: {row.note}</div>}
                        {row.scheduled_by_name && (
                          <div className="text-[11px] text-gray-400 mt-1">α╕üα╕│α╕½α╕Öα╕öα╕ºα╕▒α╕Öα╣éα╕öα╕ó {row.scheduled_by_name} ┬╖ {shortStamp(row.scheduled_at)}</div>
                        )}
                        {row.confirmed_by_name && (
                          <div className="text-[11px] text-gray-400">α╕óα╕╖α╕Öα╕óα╕▒α╕Öα╣éα╕öα╕ó {row.confirmed_by_name} ┬╖ {shortStamp(row.confirmed_at)}</div>
                        )}
                        {row.status === 'expected' && (
                          <button
                            onClick={() => handleRowAction(row)}
                            className="mt-2 text-blue-600 hover:text-blue-800 text-xs font-medium flex items-center gap-1 border border-blue-200 rounded-lg px-2 py-1 hover:bg-blue-50"
                          >
                            <PackageCheck size={14} /> α╕óα╕╖α╕Öα╕óα╕▒α╕Öα╕úα╕▒α╕Üα╣Çα╕éα╣ëα╕▓
                          </button>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>,
      document.body
    );
  };

  // ==================== Report View ====================
  const renderReportView = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <div className="text-sm text-gray-500 mb-1">α╣üα╕₧α╕Ñα╕Öα╕ùα╕▒α╣ëα╕çα╕½α╕íα╕ö</div>
          <div className="text-2xl font-bold text-gray-800">{reportTotals.totalQty.toLocaleString()} <span className="text-sm font-normal text-gray-400">α╕èα╕┤α╣ëα╕Ö</span></div>
          <div className="text-xs text-gray-400 mt-1">{reportTotals.totalModels} α╕úα╕╕α╣êα╕Ö</div>
        </div>
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <div className="text-sm text-gray-500 mb-1">α╕¬α╕│α╣Çα╕úα╣çα╕ê (α╕óα╕╖α╕Öα╕óα╕▒α╕Öα╕úα╕▒α╕Üα╣Çα╕éα╣ëα╕▓α╣üα╕Ñα╣ëα╕º)</div>
          <div className="text-2xl font-bold text-green-600">{reportTotals.confirmedQty.toLocaleString()} <span className="text-sm font-normal text-gray-400">α╕èα╕┤α╣ëα╕Ö</span></div>
          <div className="text-xs text-gray-400 mt-1">{reportTotals.confirmedModels} α╕úα╕╕α╣êα╕Ö</div>
        </div>
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <div className="text-sm text-gray-500 mb-1">α╕äα╣ëα╕▓α╕çα╕¬α╣êα╕ç</div>
          <div className="text-2xl font-bold text-orange-600">{reportTotals.outstandingQty.toLocaleString()} <span className="text-sm font-normal text-gray-400">α╕èα╕┤α╣ëα╕Ö</span></div>
          <div className="text-xs text-gray-400 mt-1">{reportTotals.outstandingModels} α╕úα╕╕α╣êα╕Öα╕ùα╕╡α╣êα╣Çα╕½α╕Ñα╕╖α╕¡</div>
        </div>
      </div>

      <div className="overflow-x-auto bg-white rounded-xl border shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">α╕úα╕╕α╣êα╕Ö</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">α╕óα╕¡α╕öα╕úα╕ºα╕íα╕ùα╕▒α╣ëα╕çα╕½α╕íα╕ö/α╕èα╕┤α╣ëα╕Ö</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">α╕óα╕¡α╕öα╕úα╕▒α╕Üα╣Çα╕éα╣ëα╕▓/α╕èα╕┤α╣ëα╕Ö</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">α╕óα╕¡α╕öα╕äα╣ëα╕▓α╕çα╕úα╕▒α╕Üα╣Çα╕éα╣ëα╕▓/α╕èα╕┤α╣ëα╕Ö</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">α╕óα╕¡α╕öα╕úα╕▒α╕Üα╣Çα╕éα╣ëα╕▓/α╕òα╕▒α╕Ö</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">α╕óα╕¡α╕öα╕äα╣ëα╕▓α╕çα╕úα╕▒α╕Üα╣Çα╕éα╣ëα╕▓/α╕òα╕▒α╕Ö</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {productSummaries.length === 0 && (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">α╣äα╕íα╣êα╕íα╕╡α╣üα╕₧α╕Ñα╕Öα╣âα╕Öα╣Çα╕öα╕╖α╕¡α╕Öα╕Öα╕╡α╣ë</td></tr>
            )}
            {productSummaries.map(p => {
              const outstandingQty = Math.max(p.totalQty - p.receivedQty, 0);
              const divisor = reportTonDivisorMap[p.product_id];
              const receivedTon = formatTon(p.receivedQty, divisor);
              const outstandingTon = formatTon(outstandingQty, divisor);
              return (
                <tr key={p.product_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{p.sku ? `${p.sku} - ` : ''}{p.product_name ?? p.product_id}</td>
                  <td className="px-4 py-3 text-right">{p.totalQty.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-green-700">{p.receivedQty.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-orange-700">{outstandingQty.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">{receivedTon ?? <span className="text-gray-300">α╕óα╕▒α╕çα╣äα╕íα╣êα╕òα╕▒α╣ëα╕çα╕äα╣êα╕▓</span>}</td>
                  <td className="px-4 py-3 text-right">{outstandingTon ?? <span className="text-gray-300">α╕óα╕▒α╕çα╣äα╕íα╣êα╕òα╕▒α╣ëα╕çα╕äα╣êα╕▓</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ==================== Settings View: per-product ton divisor + catalog management ====================
  const [divisorSearch, setDivisorSearch] = useState('');
  const [divisorDrafts, setDivisorDrafts] = useState<Record<number, string>>({});
  const [savingDivisorFor, setSavingDivisorFor] = useState<number | null>(null);
  const [newProductSku, setNewProductSku] = useState('');
  const [newProductName, setNewProductName] = useState('');
  const [savingNewProduct, setSavingNewProduct] = useState(false);
  const [newProductMsg, setNewProductMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayLabel, setNewHolidayLabel] = useState('');
  const [savingHoliday, setSavingHoliday] = useState(false);
  const [holidayMsg, setHolidayMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const handleAddHoliday = async () => {
    setHolidayMsg(null);
    if (!newHolidayDate) {
      setHolidayMsg({ ok: false, text: 'α╕üα╕úα╕╕α╕ôα╕▓α╣Çα╕Ñα╕╖α╕¡α╕üα╕ºα╕▒α╕Öα╕ùα╕╡α╣ê' });
      return;
    }
    setSavingHoliday(true);
    try {
      await saveFactoryHoliday({ holiday_date: newHolidayDate, label: newHolidayLabel.trim() || undefined, user_id: currentUser?.id });
      setNewHolidayDate('');
      setNewHolidayLabel('');
      setHolidayMsg({ ok: true, text: 'α╕Üα╕▒α╕Öα╕ùα╕╢α╕üα╕ºα╕▒α╕Öα╕½α╕óα╕╕α╕öα╣Çα╕úα╕╡α╕óα╕Üα╕úα╣ëα╕¡α╕ó' });
      loadHolidays();
    } catch (err: any) {
      setHolidayMsg({ ok: false, text: err?.data?.error || err?.message || 'α╕Üα╕▒α╕Öα╕ùα╕╢α╕üα╣äα╕íα╣êα╕¬α╕│α╣Çα╕úα╣çα╕ê' });
    } finally {
      setSavingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (id: number) => {
    try {
      await deleteFactoryHoliday(id);
      loadHolidays();
    } catch (err: any) {
      alert(err?.data?.error || err?.message || 'α╕Ñα╕Üα╣äα╕íα╣êα╕¬α╕│α╣Çα╕úα╣çα╕ê');
    }
  };

  const handleAddCatalogProduct = async () => {
    setNewProductMsg(null);
    if (!newProductSku.trim() || !newProductName.trim()) {
      setNewProductMsg({ ok: false, text: 'α╕üα╕úα╕╕α╕ôα╕▓α╕úα╕░α╕Üα╕╕α╕ùα╕▒α╣ëα╕çα╕úα╕½α╕▒α╕¬α╕¬α╕┤α╕Öα╕äα╣ëα╕▓α╣üα╕Ñα╕░α╕èα╕╖α╣êα╕¡α╕¬α╕┤α╕Öα╕äα╣ëα╕▓' });
      return;
    }
    setSavingNewProduct(true);
    try {
      await saveStockPlanProduct({ sku: newProductSku.trim(), name: newProductName.trim(), user_id: currentUser?.id });
      setNewProductSku('');
      setNewProductName('');
      setNewProductMsg({ ok: true, text: 'α╣Çα╕₧α╕┤α╣êα╕íα╕¬α╕┤α╕Öα╕äα╣ëα╕▓α╣Çα╕úα╕╡α╕óα╕Üα╕úα╣ëα╕¡α╕ó α╣âα╕èα╣ëα╣Çα╕Ñα╕╖α╕¡α╕üα╣âα╕Öα╕ƒα╕¡α╕úα╣îα╕íα╣Çα╕₧α╕┤α╣êα╕íα╣üα╕₧α╕Ñα╕Öα╣äα╕öα╣ëα╕ùα╕▒α╕Öα╕ùα╕╡' });
      loadCatalog();
    } catch (err: any) {
      setNewProductMsg({ ok: false, text: err?.data?.error || err?.message || 'α╕Üα╕▒α╕Öα╕ùα╕╢α╕üα╣äα╕íα╣êα╕¬α╕│α╣Çα╕úα╣çα╕ê' });
    } finally {
      setSavingNewProduct(false);
    }
  };

  const handleSaveDivisor = async (productId: number) => {
    const raw = divisorDrafts[productId];
    const value = raw === undefined ? null : (raw.trim() === '' ? null : parseFloat(raw));
    setSavingDivisorFor(productId);
    try {
      await saveTonDivisor({ product_id: productId, divisor: value, user_id: currentUser?.id });
      await loadReportTonDivisors();
      setDivisorDrafts(prev => { const next = { ...prev }; delete next[productId]; return next; });
    } catch (err: any) {
      alert(err?.data?.error || err?.message || 'α╕Üα╕▒α╕Öα╕ùα╕╢α╕üα╣äα╕íα╣êα╕¬α╕│α╣Çα╕úα╣çα╕ê');
    } finally {
      setSavingDivisorFor(null);
    }
  };

  const rowsByProduct = useMemo(() => {
    const map: Record<number, StockPlanRow[]> = {};
    rows.forEach(row => {
      const pid = row.item.product_id;
      if (!map[pid]) map[pid] = [];
      map[pid].push(row);
    });
    Object.values(map).forEach(list => list.sort((a, b) => a.display_date.localeCompare(b.display_date)));
    return map;
  }, [rows]);

  const arrivalSummaryText = (row: StockPlanRow) => {
    const d = row.display_date.slice(5, 10).split('-').reverse().join('/'); // dd/mm
    if (row.kind === 'pending') return `${d} ┬╖ α╕úα╕¡α╕üα╕│α╕½α╕Öα╕öα╕ºα╕▒α╕Öα╕ùα╕╡α╣ê ${row.remaining_qty}`;
    const label = STATUS_META[row.status]?.label ?? row.status;
    const qty = row.status === 'confirmed' ? (row.actual_qty ?? row.expected_qty) : row.expected_qty;
    return `${d} ┬╖ ${label} ${qty}`;
  };

  const renderSettingsView = () => {
    const filtered = productSummaries.filter(p => {
      if (!divisorSearch.trim()) return true;
      const term = divisorSearch.trim().toLowerCase();
      return `${p.sku ?? ''} ${p.product_name ?? ''}`.toLowerCase().includes(term);
    });

    const sortedHolidays = [...holidays].sort((a, b) => a.holiday_date.localeCompare(b.holiday_date));
    const settingsTabs: { key: 'catalog' | 'holidays' | 'divisor'; label: string; icon: React.ElementType }[] = [
      { key: 'catalog', label: 'α╣üα╕äα╕òα╕òα╕▓α╕Ñα╣çα╕¡α╕üα╕¬α╕┤α╕Öα╕äα╣ëα╕▓', icon: Package },
      { key: 'holidays', label: 'α╕ºα╕▒α╕Öα╕½α╕óα╕╕α╕öα╣éα╕úα╕çα╕çα╕▓α╕Ö', icon: CalendarDays },
      { key: 'divisor', label: 'α╕òα╕▒α╣ëα╕çα╕äα╣êα╕▓α╕òα╕▒α╕ºα╕½α╕▓α╕úα╕òα╕▒α╕Ö', icon: SettingsIcon },
    ];

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-1 bg-white border rounded-lg p-1 shadow-sm w-fit">
          {settingsTabs.map(t => (
            <button
              key={t.key}
              onClick={() => setSettingsTab(t.key)}
              className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 ${settingsTab === t.key ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </div>

        {settingsTab === 'catalog' && (
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-1"><Plus size={15} /> α╣Çα╕₧α╕┤α╣êα╕íα╕¬α╕┤α╕Öα╕äα╣ëα╕▓α╣âα╕½α╕íα╣êα╣Çα╕éα╣ëα╕▓α╣üα╕äα╕òα╕òα╕▓α╕Ñα╣çα╕¡α╕üα╣üα╕₧α╕Ñα╕Ö</h3>
            <p className="text-xs text-gray-400 mb-3">α╕¬α╕┤α╕Öα╕äα╣ëα╕▓α╕éα╕¡α╕çα╕úα╕░α╕Üα╕Üα╣üα╕₧α╕Ñα╕Öα╣üα╕óα╕üα╕êα╕▓α╕üα╕úα╕½α╕▒α╕¬α╕¬α╕┤α╕Öα╕äα╣ëα╕▓α╕½α╕Ñα╕▒α╕ü ΓÇö α╕ûα╣ëα╕▓α╕íα╕╡α╕éα╕¡α╕çα╕ùα╕╡α╣êα╕¬α╕▒α╣êα╕çα╣Çα╕éα╣ëα╕▓α╣üα╕òα╣êα╣äα╕íα╣êα╕íα╕╡α╣âα╕½α╣ëα╣Çα╕Ñα╕╖α╕¡α╕üα╣âα╕Öα╕ƒα╕¡α╕úα╣îα╕íα╣Çα╕₧α╕┤α╣êα╕íα╣üα╕₧α╕Ñα╕Ö α╣Çα╕₧α╕┤α╣êα╕íα╣äα╕öα╣ëα╕ùα╕╡α╣êα╕Öα╕╡α╣êα╣Çα╕Ñα╕ó</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={newProductSku}
                onChange={e => setNewProductSku(e.target.value)}
                placeholder="α╕úα╕½α╕▒α╕¬α╕¬α╕┤α╕Öα╕äα╣ëα╕▓ α╣Çα╕èα╣êα╕Ö PTTM500001"
                className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                style={{ width: 200 }}
              />
              <input
                type="text"
                value={newProductName}
                onChange={e => setNewProductName(e.target.value)}
                placeholder="α╕èα╕╖α╣êα╕¡α╕¬α╕┤α╕Öα╕äα╣ëα╕▓ α╣Çα╕èα╣êα╕Ö α╕ïα╕╕α╕¢α╣Çα╕¢α╕¡α╕úα╣îα╣äα╕òα╕úα╣éα╕ä α╕éα╕Öα╕▓α╕ö 500 α╕üα╕úα╕▒α╕í"
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                style={{ minWidth: 240 }}
              />
              <button
                onClick={handleAddCatalogProduct}
                disabled={savingNewProduct}
                className="bg-blue-600 text-white text-sm font-medium rounded-lg px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
              >
                {savingNewProduct ? 'α╕üα╕│α╕Ñα╕▒α╕çα╕Üα╕▒α╕Öα╕ùα╕╢α╕ü...' : 'α╣Çα╕₧α╕┤α╣êα╕íα╕¬α╕┤α╕Öα╕äα╣ëα╕▓'}
              </button>
            </div>
            {newProductMsg && (
              <p className={`text-xs mt-2 ${newProductMsg.ok ? 'text-green-600' : 'text-red-600'}`}>{newProductMsg.text}</p>
            )}

            <div className="mt-4 border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500">α╕¬α╕┤α╕Öα╕äα╣ëα╕▓α╣âα╕Öα╣üα╕äα╕òα╕òα╕▓α╕Ñα╣çα╕¡α╕üα╕ùα╕▒α╣ëα╕çα╕½α╕íα╕ö ({products.length} α╕úα╕▓α╕óα╕üα╕▓α╕ú)</span>
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={e => setCatalogSearch(e.target.value)}
                  placeholder="α╕äα╣ëα╕Öα╕½α╕▓..."
                  className="border rounded-lg px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                  style={{ width: 160 }}
                />
              </div>
              <div className="max-h-[460px] overflow-y-auto border rounded-lg divide-y">
                {products
                  .filter(p => {
                    const term = catalogSearch.trim().toLowerCase();
                    return !term || `${p.sku ?? ''} ${p.name ?? ''}`.toLowerCase().includes(term);
                  })
                  .map(p => (
                    <div key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <span className="font-mono text-gray-500 shrink-0" style={{ width: 120 }}>{p.sku}</span>
                      <span className="text-gray-700 truncate">{p.name}</span>
                      {p.format_code && <span className="ml-auto shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border">{p.format_code}</span>}
                    </div>
                  ))}
                {products.length === 0 && (
                  <div className="text-center py-6 text-gray-400 text-xs">α╕óα╕▒α╕çα╣äα╕íα╣êα╕íα╕╡α╕¬α╕┤α╕Öα╕äα╣ëα╕▓α╣âα╕Öα╣üα╕äα╕òα╕òα╕▓α╕Ñα╣çα╕¡α╕ü</div>
                )}
              </div>
            </div>
          </div>
        )}

        {settingsTab === 'holidays' && (
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-1"><CalendarDays size={15} /> α╕ºα╕▒α╕Öα╕½α╕óα╕╕α╕öα╣éα╕úα╕çα╕çα╕▓α╕Ö</h3>
            <p className="text-xs text-gray-400 mb-3">α╕ºα╕▒α╕Öα╕ùα╕╡α╣êα╕Üα╕▒α╕Öα╕ùα╕╢α╕üα╣äα╕ºα╣ëα╕êα╕░α╣üα╕¬α╕öα╕çα╣Çα╕¢α╣çα╕Öα╕₧α╕╖α╣ëα╕Öα╕¬α╕╡α╣üα╕öα╕çα╕Üα╕Öα╕½α╕Öα╣ëα╕▓α╕¢α╕Åα╕┤α╕ùα╕┤α╕Ö ΓÇö α╕öα╣ëα╕▓α╕Öα╕Ñα╣êα╕▓α╕çα╣üα╕¬α╕öα╕çα╕ºα╕▒α╕Öα╕½α╕óα╕╕α╕öα╕ùα╕▒α╣ëα╕çα╕½α╕íα╕öα╕ùα╕╡α╣êα╕òα╕▒α╣ëα╕çα╕äα╣êα╕▓α╣äα╕ºα╣ë</p>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <input
                type="date"
                value={newHolidayDate}
                onChange={e => setNewHolidayDate(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <input
                type="text"
                value={newHolidayLabel}
                onChange={e => setNewHolidayLabel(e.target.value)}
                placeholder="α╕èα╕╖α╣êα╕¡α╕ºα╕▒α╕Öα╕½α╕óα╕╕α╕ö (α╕ûα╣ëα╕▓α╕íα╕╡) α╣Çα╕èα╣êα╕Ö α╕½α╕óα╕╕α╕öα╕¬α╕çα╕üα╕úα╕▓α╕Öα╕òα╣î"
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                style={{ minWidth: 200 }}
              />
              <button
                onClick={handleAddHoliday}
                disabled={savingHoliday}
                className="bg-blue-600 text-white text-sm font-medium rounded-lg px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
              >
                {savingHoliday ? 'α╕üα╕│α╕Ñα╕▒α╕çα╕Üα╕▒α╕Öα╕ùα╕╢α╕ü...' : 'α╣Çα╕₧α╕┤α╣êα╕íα╕ºα╕▒α╕Öα╕½α╕óα╕╕α╕ö'}
              </button>
            </div>
            {holidayMsg && (
              <p className={`text-xs mb-2 ${holidayMsg.ok ? 'text-green-600' : 'text-red-600'}`}>{holidayMsg.text}</p>
            )}
            <div className="text-xs font-semibold text-gray-500 mb-2">α╕ºα╕▒α╕Öα╕½α╕óα╕╕α╕öα╕ùα╕╡α╣êα╕òα╕▒α╣ëα╕çα╕äα╣êα╕▓α╣äα╕ºα╣ë ({sortedHolidays.length} α╕ºα╕▒α╕Ö)</div>
            {sortedHolidays.length === 0 ? (
              <p className="text-xs text-gray-400">α╕óα╕▒α╕çα╣äα╕íα╣êα╕íα╕╡α╕ºα╕▒α╕Öα╕½α╕óα╕╕α╕öα╕ùα╕╡α╣êα╕òα╕▒α╣ëα╕çα╕äα╣êα╕▓</p>
            ) : (
              <div className="divide-y border rounded-lg max-h-[460px] overflow-y-auto">
                {sortedHolidays.map(h => (
                  <div key={h.id} className="flex items-center justify-between px-3 py-2">
                    <div className="text-sm text-gray-700">
                      {h.holiday_date.slice(0, 10)}
                      {h.label && <span className="text-gray-400"> ┬╖ {h.label}</span>}
                    </div>
                    <button onClick={() => handleDeleteHoliday(h.id)} className="text-gray-400 hover:text-red-600 p-1" title="α╕Ñα╕Üα╕ºα╕▒α╕Öα╕½α╕óα╕╕α╕ö">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {settingsTab === 'divisor' && (
          <div className="bg-white rounded-xl border shadow-sm">
            <div className="p-4 border-b space-y-1">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><SettingsIcon size={15} /> α╕òα╕▒α╣ëα╕çα╕äα╣êα╕▓α╕òα╕▒α╕ºα╕½α╕▓α╕úα╕òα╕▒α╕Ö (α╕¬α╕┤α╕Öα╕äα╣ëα╕▓ ├╖ α╕òα╕▒α╕ºα╣Çα╕Ñα╕é = α╕òα╕▒α╕Ö)</h3>
              <p className="text-xs text-gray-400">α╣üα╕¬α╕öα╕çα╣Çα╕ëα╕₧α╕▓α╕░α╕úα╕╕α╣êα╕Öα╕ùα╕╡α╣êα╕íα╕╡α╕äα╕▓α╕öα╕ºα╣êα╕▓α╕êα╕░α╣Çα╕éα╣ëα╕▓α╣âα╕Öα╣Çα╕öα╕╖α╕¡α╕Öα╕ùα╕╡α╣êα╣Çα╕Ñα╕╖α╕¡α╕üα╕öα╣ëα╕▓α╕Öα╕Üα╕Ö ({MONTH_NAMES_TH[month - 1]} {year + 543}) ΓÇö α╕úα╕╕α╣êα╕Öα╕ùα╕╡α╣êα╣Çα╕äα╕óα╕òα╕▒α╣ëα╕çα╕äα╣êα╕▓α╣äα╕ºα╣ëα╣üα╕Ñα╣ëα╕ºα╕êα╕░α╕äα╕│α╕Öα╕ºα╕ôα╕óα╕¡α╕öα╕òα╕▒α╕Öα╣âα╕½α╣ëα╕ùα╕▒α╕Öα╕ùα╕╡ α╕ûα╣ëα╕▓α╣Çα╕¢α╣çα╕Öα╕úα╕╕α╣êα╕Öα╣âα╕½α╕íα╣êα╣âα╕½α╣ëα╕üα╕úα╕¡α╕üα╕òα╕▒α╕ºα╕½α╕▓α╕úα╣Çα╕¡α╕ç (α╣Çα╕èα╣êα╕Ö α╣Çα╕öα╕┤α╕íα╣âα╕Ö Excel α╕½α╕▓α╕úα╕öα╣ëα╕ºα╕ó 40 α╕üα╣çα╣âα╕¬α╣ê 40) α╕üα╕▓α╕úα╣üα╕üα╣ëα╣äα╕éα╕êα╕░α╕íα╕╡α╕£α╕Ñα╕òα╕▒α╣ëα╕çα╣üα╕òα╣êα╣Çα╕öα╕╖α╕¡α╕Öα╕¢α╕▒α╕êα╕êα╕╕α╕Üα╕▒α╕Öα╕êα╕úα╕┤α╕çα╣Çα╕¢α╣çα╕Öα╕òα╣ëα╕Öα╣äα╕¢α╣Çα╕ùα╣êα╕▓α╕Öα╕▒α╣ëα╕Ö α╣äα╕íα╣êα╕üα╕úα╕░α╕ùα╕Üα╣Çα╕öα╕╖α╕¡α╕Öα╕ùα╕╡α╣êα╕£α╣êα╕▓α╕Öα╕íα╕▓α╣üα╕Ñα╣ëα╕º</p>
              <input
                type="text"
                value={divisorSearch}
                onChange={e => setDivisorSearch(e.target.value)}
                placeholder="α╕äα╣ëα╕Öα╕½α╕▓α╕¬α╕┤α╕Öα╕äα╣ëα╕▓..."
                className="mt-2 w-full max-w-sm border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="divide-y max-h-[560px] overflow-y-auto">
              {filtered.length === 0 && (
                <div className="text-center py-10 text-gray-400 text-sm">α╣äα╕íα╣êα╕íα╕╡α╕úα╕╕α╣êα╕Öα╕ùα╕╡α╣êα╕äα╕▓α╕öα╕ºα╣êα╕▓α╕êα╕░α╣Çα╕éα╣ëα╕▓α╣âα╕Öα╣Çα╕öα╕╖α╕¡α╕Öα╕Öα╕╡α╣ë</div>
              )}
              {filtered.map(p => {
                const draft = divisorDrafts[p.product_id];
                const currentDivisor = reportTonDivisorMap[p.product_id];
                const displayValue = draft !== undefined ? draft : (currentDivisor !== undefined ? String(currentDivisor) : '');
                const isDirty = draft !== undefined;
                const ton = formatTon(p.totalQty, currentDivisor);
                const arrivals = rowsByProduct[p.product_id] ?? [];
                return (
                  <div key={p.product_id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-800 truncate">{p.sku ? `${p.sku} - ` : ''}{p.product_name ?? p.product_id}</div>
                      <div className="text-[11px] text-gray-400 truncate">
                        {arrivals.map(arrivalSummaryText).join('  ┬╖  ')}
                      </div>
                    </div>
                    <div className="shrink-0 text-xs text-gray-500 w-20 text-right">
                      {ton !== null ? <span className="font-medium text-gray-700">{ton} α╕òα╕▒α╕Ö</span> : <span className="text-gray-300">α╕óα╕▒α╕çα╣äα╕íα╣êα╕òα╕▒α╣ëα╕çα╕äα╣êα╕▓</span>}
                    </div>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={displayValue}
                      onChange={e => {
                        const v = e.target.value.replace(/[^0-9.]/g, '');
                        setDivisorDrafts(prev => ({ ...prev, [p.product_id]: v }));
                      }}
                      placeholder="α╣Çα╕èα╣êα╕Ö 40"
                      style={{ width: 90 }}
                      className="shrink-0 border rounded-lg px-2 py-1.5 text-sm text-right"
                    />
                    <button
                      onClick={() => handleSaveDivisor(p.product_id)}
                      disabled={!isDirty || savingDivisorFor === p.product_id}
                      className="shrink-0 text-blue-600 hover:text-blue-800 disabled:text-gray-300 p-1.5"
                      title="α╕Üα╕▒α╕Öα╕ùα╕╢α╕ü"
                    >
                      <Save size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">α╣üα╕₧α╕Ñα╕Öα╕úα╕▒α╕Üα╕¬α╕┤α╕Öα╕äα╣ëα╕▓</h1>
          <p className="text-sm text-gray-500">α╕ºα╕▓α╕çα╣üα╕£α╕Öα╕¬α╕┤α╕Öα╕äα╣ëα╕▓α╣Çα╕éα╣ëα╕▓α╕äα╕Ñα╕▒α╕çα╕úα╕▓α╕óα╣Çα╕öα╕╖α╕¡α╕Ö α╣üα╕Ñα╕░α╕òα╕úα╕ºα╕êα╕¬α╕¡α╕Üα╕éα╕¡α╕çα╕êα╕úα╕┤α╕çα╣Çα╕ùα╕╡α╕óα╕Üα╕üα╕▒α╕Üα╣üα╕₧α╕Ñα╕Ö</p>
        </div>
        <button
          onClick={() => setFormDate(null)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-1.5 hover:bg-blue-700 font-medium shadow-sm"
        >
          <Plus size={18} /> α╣Çα╕₧α╕┤α╣êα╕íα╣üα╕₧α╕Ñα╕Ö
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 bg-white border rounded-lg px-2 py-1.5 shadow-sm">
          <button onClick={goPrevMonth} className="p-1 text-gray-500 hover:text-gray-700"><ChevronLeft size={18} /></button>
          <span className="text-sm font-medium w-32 text-center">{MONTH_NAMES_TH[month - 1]} {year + 543}</span>
          <button onClick={goNextMonth} className="p-1 text-gray-500 hover:text-gray-700"><ChevronRight size={18} /></button>
        </div>

        <div className="flex items-center gap-1 bg-white border rounded-lg p-1 shadow-sm">
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 ${viewMode === 'calendar' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <CalendarDays size={15} /> α╕¢α╕Åα╕┤α╕ùα╕┤α╕Ö
          </button>
          <button
            onClick={() => setViewMode('report')}
            className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 ${viewMode === 'report' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <FileBarChart size={15} /> α╕úα╕▓α╕óα╕çα╕▓α╕Ö
          </button>
          <button
            onClick={() => setViewMode('settings')}
            className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 ${viewMode === 'settings' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <SettingsIcon size={15} /> α╕òα╕▒α╣ëα╕çα╕äα╣êα╕▓
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border-l-4 border-red-400 p-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="text-center py-16">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-3 text-gray-500 text-sm">α╕üα╕│α╕Ñα╕▒α╕çα╣éα╕½α╕Ñα╕öα╕éα╣ëα╕¡α╕íα╕╣α╕Ñ...</p>
        </div>
      ) : (
        <>
          {viewMode === 'calendar' && renderCalendarView()}
          {viewMode === 'report' && renderReportView()}
          {viewMode === 'settings' && renderSettingsView()}
        </>
      )}

      {renderDayPanel()}

      {formDate !== undefined && (
        <StockPlanFormModal
          plannedDate={formDate}
          products={products}
          companyId={effectiveCompanyId}
          currentUser={currentUser}
          onClose={() => setFormDate(undefined)}
          onSaved={() => { setFormDate(undefined); loadPlans(); }}
        />
      )}

      {scheduleTarget && (
        <StockPlanScheduleModal
          pending={scheduleTarget}
          currentUser={currentUser}
          onClose={() => setScheduleTarget(null)}
          onSaved={() => { setScheduleTarget(null); loadPlans(); }}
        />
      )}

      {reconcileTarget && (
        <StockPlanReconcileModal
          expectation={reconcileTarget}
          currentUser={currentUser}
          onClose={() => setReconcileTarget(null)}
          onSaved={() => { setReconcileTarget(null); loadPlans(); }}
        />
      )}
    </div>
  );
};

export default StockArrivalPlanningPage;
