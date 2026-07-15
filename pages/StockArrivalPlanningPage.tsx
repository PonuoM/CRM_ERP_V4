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
  pending: { label: 'รอกำหนดวันที่คาดว่าจะเข้า', badge: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-400' },
  expected: { label: 'คาดว่าจะเข้า', badge: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-400' },
  confirmed: { label: 'ยืนยันรับเข้าแล้ว', badge: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-500' },
  closed_short: { label: 'ปิด - ไม่ครบ', badge: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500' },
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
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];
const WEEKDAY_NAMES_TH = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

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

// สินค้าของแพลนใช้แคตตาล็อกแยกของตัวเอง (stock_arrival_products) ไม่ผูกกับตาราง products หลัก
// การมองเห็นแพลนข้ามบริษัท (พรีม่าแพสชั่น49 + พรีออนิค) จัดการฝั่ง backend: api/inventory/stock_plan_company_group.php

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
      setError('ไม่สามารถโหลดข้อมูลแพลนได้');
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
  // so a save made elsewhere (other tab/user) can never leave stale "ยังไม่ตั้งค่า" cells
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
    if (!confirm('ต้องการลบแพลนนี้ใช่หรือไม่? (ใช้สำหรับกรณีฉุกเฉินเท่านั้น)')) return;
    try {
      await deleteStockPlan(planId, true);
      setSelectedDay(null);
      loadPlans();
    } catch (err: any) {
      alert(err?.data?.error || err?.message || 'ลบไม่สำเร็จ');
    }
  };

  const productLabel = (row: StockPlanRow) => `${row.item.sku ?? row.item.product_id} ${row.item.product_name ?? ''}`.trim();

  const rowQty = (row: StockPlanRow) => (row.kind === 'pending' ? row.remaining_qty : (row.actual_qty ?? row.expected_qty));

  const calendarLabel = (row: StockPlanRow) => `${row.item.product_name ?? row.item.sku ?? row.item.product_id} · ${rowQty(row)}`;

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
          <div className="text-gray-300">แพลนรวม {row.item.planned_qty} · ยังไม่กำหนดวันที่ {row.remaining_qty}</div>
        ) : (
          <>
            <div className="text-gray-300">
              คาดว่าจะเข้า {row.expected_qty}
              {row.actual_qty !== null ? ` · จริง ${row.actual_qty}` : ''}
            </div>
            {row.so_number && <div className="text-gray-300">SO: {row.so_number}</div>}
            {row.note && <div className="text-gray-400 italic">"{row.note}"</div>}
          </>
        )}
        <div className="border-t border-gray-700 mt-1.5 pt-1.5 space-y-0.5 text-[11px] text-gray-400">
          {row.plan.created_by_name && <div>แพลนโดย {row.plan.created_by_name} · {shortStamp(row.plan.created_at)}</div>}
          {row.kind === 'expectation' && row.scheduled_by_name && (
            <div>กำหนดวันโดย {row.scheduled_by_name} · {shortStamp(row.scheduled_at)}</div>
          )}
          {row.kind === 'expectation' && row.confirmed_by_name && (
            <div>ยืนยันโดย {row.confirmed_by_name} · {shortStamp(row.confirmed_at)}</div>
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
                  <span className="text-[9px] px-1 py-0.5 rounded bg-red-100 text-red-600 border border-red-200 truncate" title={holiday.label ?? 'วันหยุดโรงงาน'}>
                    {holiday.label || 'หยุดโรงงาน'}
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
                  <div className="text-[10px] text-gray-400">+{dayItems.length - 5} เพิ่มเติม</div>
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
            <p className="text-xs text-gray-500">รายการแพลน/คาดว่าจะเข้าของวันนี้</p>
            {holidayByDay[selectedDay] && (
              <p className="text-xs text-red-600 font-medium mt-0.5">🏭 วันหยุดโรงงาน{holidayByDay[selectedDay].label ? `: ${holidayByDay[selectedDay].label}` : ''}</p>
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
            <Plus size={16} /> เพิ่มแพลนวันนี้
          </button>

          {dayPlanGroups.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">ไม่มีแพลนวันนี้</p>
          )}

          {dayPlanGroups.map(group => (
            <div key={group.plan.id} className="border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between bg-gray-50 px-3 py-2 border-b">
                <div className="min-w-0">
                  <div className="text-xs text-gray-500 truncate">แพลน #{group.plan.id} · {group.plan.planned_date.slice(0, 10)}{group.plan.notes ? ` · ${group.plan.notes}` : ''}</div>
                  {group.plan.created_by_name && (
                    <div className="text-[11px] text-gray-400">สร้างโดย {group.plan.created_by_name} · {shortStamp(group.plan.created_at)}</div>
                  )}
                </div>
                {isSuperAdmin && (
                  <button onClick={() => handleDeletePlan(group.plan.id)} className="shrink-0 text-gray-400 hover:text-red-600" title="ลบแพลน (ฉุกเฉิน)">
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
                        <div className="text-xs text-gray-500">แพลนรวม {row.item.planned_qty} · ยังไม่กำหนดวันที่ {row.remaining_qty}</div>
                        <button
                          onClick={() => handleRowAction(row)}
                          className="mt-2 text-blue-600 hover:text-blue-800 text-xs font-medium flex items-center gap-1 border border-blue-200 rounded-lg px-2 py-1 hover:bg-blue-50"
                        >
                          <CalendarPlus size={14} /> กำหนดวันที่คาดว่าจะเข้า
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="text-xs text-gray-500">
                          คาดว่าจะเข้า {row.expected_qty}
                          {row.actual_qty !== null ? ` · จริง ${row.actual_qty}` : ''}
                        </div>
                        {row.note && <div className="text-xs text-gray-400 mt-1">หมายเหตุ: {row.note}</div>}
                        {row.scheduled_by_name && (
                          <div className="text-[11px] text-gray-400 mt-1">กำหนดวันโดย {row.scheduled_by_name} · {shortStamp(row.scheduled_at)}</div>
                        )}
                        {row.confirmed_by_name && (
                          <div className="text-[11px] text-gray-400">ยืนยันโดย {row.confirmed_by_name} · {shortStamp(row.confirmed_at)}</div>
                        )}
                        {row.status === 'expected' && (
                          <button
                            onClick={() => handleRowAction(row)}
                            className="mt-2 text-blue-600 hover:text-blue-800 text-xs font-medium flex items-center gap-1 border border-blue-200 rounded-lg px-2 py-1 hover:bg-blue-50"
                          >
                            <PackageCheck size={14} /> ยืนยันรับเข้า
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
          <div className="text-sm text-gray-500 mb-1">แพลนทั้งหมด</div>
          <div className="text-2xl font-bold text-gray-800">{reportTotals.totalQty.toLocaleString()} <span className="text-sm font-normal text-gray-400">ชิ้น</span></div>
          <div className="text-xs text-gray-400 mt-1">{reportTotals.totalModels} รุ่น</div>
        </div>
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <div className="text-sm text-gray-500 mb-1">สำเร็จ (ยืนยันรับเข้าแล้ว)</div>
          <div className="text-2xl font-bold text-green-600">{reportTotals.confirmedQty.toLocaleString()} <span className="text-sm font-normal text-gray-400">ชิ้น</span></div>
          <div className="text-xs text-gray-400 mt-1">{reportTotals.confirmedModels} รุ่น</div>
        </div>
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <div className="text-sm text-gray-500 mb-1">ค้างส่ง</div>
          <div className="text-2xl font-bold text-orange-600">{reportTotals.outstandingQty.toLocaleString()} <span className="text-sm font-normal text-gray-400">ชิ้น</span></div>
          <div className="text-xs text-gray-400 mt-1">{reportTotals.outstandingModels} รุ่นที่เหลือ</div>
        </div>
      </div>

      <div className="overflow-x-auto bg-white rounded-xl border shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">รุ่น</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">ยอดรวมทั้งหมด/ชิ้น</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">ยอดรับเข้า/ชิ้น</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">ยอดค้างรับเข้า/ชิ้น</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">ยอดรับเข้า/ตัน</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">ยอดค้างรับเข้า/ตัน</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {productSummaries.length === 0 && (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">ไม่มีแพลนในเดือนนี้</td></tr>
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
                  <td className="px-4 py-3 text-right">{receivedTon ?? <span className="text-gray-300">ยังไม่ตั้งค่า</span>}</td>
                  <td className="px-4 py-3 text-right">{outstandingTon ?? <span className="text-gray-300">ยังไม่ตั้งค่า</span>}</td>
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
      setHolidayMsg({ ok: false, text: 'กรุณาเลือกวันที่' });
      return;
    }
    setSavingHoliday(true);
    try {
      await saveFactoryHoliday({ holiday_date: newHolidayDate, label: newHolidayLabel.trim() || undefined, user_id: currentUser?.id });
      setNewHolidayDate('');
      setNewHolidayLabel('');
      setHolidayMsg({ ok: true, text: 'บันทึกวันหยุดเรียบร้อย' });
      loadHolidays();
    } catch (err: any) {
      setHolidayMsg({ ok: false, text: err?.data?.error || err?.message || 'บันทึกไม่สำเร็จ' });
    } finally {
      setSavingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (id: number) => {
    try {
      await deleteFactoryHoliday(id);
      loadHolidays();
    } catch (err: any) {
      alert(err?.data?.error || err?.message || 'ลบไม่สำเร็จ');
    }
  };

  const handleAddCatalogProduct = async () => {
    setNewProductMsg(null);
    if (!newProductSku.trim() || !newProductName.trim()) {
      setNewProductMsg({ ok: false, text: 'กรุณาระบุทั้งรหัสสินค้าและชื่อสินค้า' });
      return;
    }
    setSavingNewProduct(true);
    try {
      await saveStockPlanProduct({ sku: newProductSku.trim(), name: newProductName.trim(), user_id: currentUser?.id });
      setNewProductSku('');
      setNewProductName('');
      setNewProductMsg({ ok: true, text: 'เพิ่มสินค้าเรียบร้อย ใช้เลือกในฟอร์มเพิ่มแพลนได้ทันที' });
      loadCatalog();
    } catch (err: any) {
      setNewProductMsg({ ok: false, text: err?.data?.error || err?.message || 'บันทึกไม่สำเร็จ' });
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
      alert(err?.data?.error || err?.message || 'บันทึกไม่สำเร็จ');
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
    if (row.kind === 'pending') return `${d} · รอกำหนดวันที่ ${row.remaining_qty}`;
    const label = STATUS_META[row.status]?.label ?? row.status;
    const qty = row.status === 'confirmed' ? (row.actual_qty ?? row.expected_qty) : row.expected_qty;
    return `${d} · ${label} ${qty}`;
  };

  const renderSettingsView = () => {
    const filtered = productSummaries.filter(p => {
      if (!divisorSearch.trim()) return true;
      const term = divisorSearch.trim().toLowerCase();
      return `${p.sku ?? ''} ${p.product_name ?? ''}`.toLowerCase().includes(term);
    });

    const sortedHolidays = [...holidays].sort((a, b) => a.holiday_date.localeCompare(b.holiday_date));
    const settingsTabs: { key: 'catalog' | 'holidays' | 'divisor'; label: string; icon: React.ElementType }[] = [
      { key: 'catalog', label: 'แคตตาล็อกสินค้า', icon: Package },
      { key: 'holidays', label: 'วันหยุดโรงงาน', icon: CalendarDays },
      { key: 'divisor', label: 'ตั้งค่าตัวหารตัน', icon: SettingsIcon },
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
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-1"><Plus size={15} /> เพิ่มสินค้าใหม่เข้าแคตตาล็อกแพลน</h3>
            <p className="text-xs text-gray-400 mb-3">สินค้าของระบบแพลนแยกจากรหัสสินค้าหลัก — ถ้ามีของที่สั่งเข้าแต่ไม่มีให้เลือกในฟอร์มเพิ่มแพลน เพิ่มได้ที่นี่เลย</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={newProductSku}
                onChange={e => setNewProductSku(e.target.value)}
                placeholder="รหัสสินค้า เช่น PTTM500001"
                className="border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                style={{ width: 200 }}
              />
              <input
                type="text"
                value={newProductName}
                onChange={e => setNewProductName(e.target.value)}
                placeholder="ชื่อสินค้า เช่น ซุปเปอร์ไตรโค ขนาด 500 กรัม"
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                style={{ minWidth: 240 }}
              />
              <button
                onClick={handleAddCatalogProduct}
                disabled={savingNewProduct}
                className="bg-blue-600 text-white text-sm font-medium rounded-lg px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
              >
                {savingNewProduct ? 'กำลังบันทึก...' : 'เพิ่มสินค้า'}
              </button>
            </div>
            {newProductMsg && (
              <p className={`text-xs mt-2 ${newProductMsg.ok ? 'text-green-600' : 'text-red-600'}`}>{newProductMsg.text}</p>
            )}

            <div className="mt-4 border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-500">สินค้าในแคตตาล็อกทั้งหมด ({products.length} รายการ)</span>
                <input
                  type="text"
                  value={catalogSearch}
                  onChange={e => setCatalogSearch(e.target.value)}
                  placeholder="ค้นหา..."
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
                  <div className="text-center py-6 text-gray-400 text-xs">ยังไม่มีสินค้าในแคตตาล็อก</div>
                )}
              </div>
            </div>
          </div>
        )}

        {settingsTab === 'holidays' && (
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-1"><CalendarDays size={15} /> วันหยุดโรงงาน</h3>
            <p className="text-xs text-gray-400 mb-3">วันที่บันทึกไว้จะแสดงเป็นพื้นสีแดงบนหน้าปฏิทิน — ด้านล่างแสดงวันหยุดทั้งหมดที่ตั้งค่าไว้</p>
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
                placeholder="ชื่อวันหยุด (ถ้ามี) เช่น หยุดสงกรานต์"
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                style={{ minWidth: 200 }}
              />
              <button
                onClick={handleAddHoliday}
                disabled={savingHoliday}
                className="bg-blue-600 text-white text-sm font-medium rounded-lg px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
              >
                {savingHoliday ? 'กำลังบันทึก...' : 'เพิ่มวันหยุด'}
              </button>
            </div>
            {holidayMsg && (
              <p className={`text-xs mb-2 ${holidayMsg.ok ? 'text-green-600' : 'text-red-600'}`}>{holidayMsg.text}</p>
            )}
            <div className="text-xs font-semibold text-gray-500 mb-2">วันหยุดที่ตั้งค่าไว้ ({sortedHolidays.length} วัน)</div>
            {sortedHolidays.length === 0 ? (
              <p className="text-xs text-gray-400">ยังไม่มีวันหยุดที่ตั้งค่า</p>
            ) : (
              <div className="divide-y border rounded-lg max-h-[460px] overflow-y-auto">
                {sortedHolidays.map(h => (
                  <div key={h.id} className="flex items-center justify-between px-3 py-2">
                    <div className="text-sm text-gray-700">
                      {h.holiday_date.slice(0, 10)}
                      {h.label && <span className="text-gray-400"> · {h.label}</span>}
                    </div>
                    <button onClick={() => handleDeleteHoliday(h.id)} className="text-gray-400 hover:text-red-600 p-1" title="ลบวันหยุด">
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
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><SettingsIcon size={15} /> ตั้งค่าตัวหารตัน (สินค้า ÷ ตัวเลข = ตัน)</h3>
              <p className="text-xs text-gray-400">แสดงเฉพาะรุ่นที่มีคาดว่าจะเข้าในเดือนที่เลือกด้านบน ({MONTH_NAMES_TH[month - 1]} {year + 543}) — รุ่นที่เคยตั้งค่าไว้แล้วจะคำนวณยอดตันให้ทันที ถ้าเป็นรุ่นใหม่ให้กรอกตัวหารเอง (เช่น เดิมใน Excel หารด้วย 40 ก็ใส่ 40) การแก้ไขจะมีผลตั้งแต่เดือนปัจจุบันจริงเป็นต้นไปเท่านั้น ไม่กระทบเดือนที่ผ่านมาแล้ว</p>
              <input
                type="text"
                value={divisorSearch}
                onChange={e => setDivisorSearch(e.target.value)}
                placeholder="ค้นหาสินค้า..."
                className="mt-2 w-full max-w-sm border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="divide-y max-h-[560px] overflow-y-auto">
              {filtered.length === 0 && (
                <div className="text-center py-10 text-gray-400 text-sm">ไม่มีรุ่นที่คาดว่าจะเข้าในเดือนนี้</div>
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
                        {arrivals.map(arrivalSummaryText).join('  ·  ')}
                      </div>
                    </div>
                    <div className="shrink-0 text-xs text-gray-500 w-20 text-right">
                      {ton !== null ? <span className="font-medium text-gray-700">{ton} ตัน</span> : <span className="text-gray-300">ยังไม่ตั้งค่า</span>}
                    </div>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={displayValue}
                      onChange={e => {
                        const v = e.target.value.replace(/[^0-9.]/g, '');
                        setDivisorDrafts(prev => ({ ...prev, [p.product_id]: v }));
                      }}
                      placeholder="เช่น 40"
                      style={{ width: 90 }}
                      className="shrink-0 border rounded-lg px-2 py-1.5 text-sm text-right"
                    />
                    <button
                      onClick={() => handleSaveDivisor(p.product_id)}
                      disabled={!isDirty || savingDivisorFor === p.product_id}
                      className="shrink-0 text-blue-600 hover:text-blue-800 disabled:text-gray-300 p-1.5"
                      title="บันทึก"
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
          <h1 className="text-xl font-bold text-gray-800">แพลนรับสินค้า</h1>
          <p className="text-sm text-gray-500">วางแผนสินค้าเข้าคลังรายเดือน และตรวจสอบของจริงเทียบกับแพลน</p>
        </div>
        <button
          onClick={() => setFormDate(null)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-1.5 hover:bg-blue-700 font-medium shadow-sm"
        >
          <Plus size={18} /> เพิ่มแพลน
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
            <CalendarDays size={15} /> ปฏิทิน
          </button>
          <button
            onClick={() => setViewMode('report')}
            className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 ${viewMode === 'report' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <FileBarChart size={15} /> รายงาน
          </button>
          <button
            onClick={() => setViewMode('settings')}
            className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 ${viewMode === 'settings' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <SettingsIcon size={15} /> ตั้งค่า
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border-l-4 border-red-400 p-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="text-center py-16">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-3 text-gray-500 text-sm">กำลังโหลดข้อมูล...</p>
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
