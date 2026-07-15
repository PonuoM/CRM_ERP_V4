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
  CalendarPlus,
  X,
} from 'lucide-react';
import { User, UserRole } from '@/types';
import { listStockPlans, listProducts, deleteStockPlan, listTonDivisors, saveTonDivisor, getHolidays, saveHolidays } from '@/services/api';
import StockPlanFormModal from '@/components/StockPlanFormModal';
import StockPlanScheduleModal from '@/components/StockPlanScheduleModal';
import StockPlanReconcileModal from '@/components/StockPlanReconcileModal';

import { StockPlanRow, ProductSummary, TonDivisorRow, STATUS_META, rowStatus, shortStamp } from '@/components/StockArrivalPlanning/types';
import StockPlanCalendar from '@/components/StockArrivalPlanning/StockPlanCalendar';
import StockPlanReport from '@/components/StockArrivalPlanning/StockPlanReport';
import StockPlanSettings from '@/components/StockArrivalPlanning/StockPlanSettings';

interface StockArrivalPlanningPageProps {
  currentUser?: User;
  companyId?: number;
}

const MONTH_NAMES_TH = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

// Keep in sync with api/inventory/stock_plan_company_group.php
const COMPANY_GROUPS: number[][] = [[1, 2]];
const companyGroupIds = (companyId?: number): number[] => {
  if (!companyId) return [];
  return COMPANY_GROUPS.find(g => g.includes(companyId)) ?? [companyId];
};

const StockArrivalPlanningPage: React.FC<StockArrivalPlanningPageProps> = ({ currentUser, companyId }) => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [viewMode, setViewMode] = useState<'calendar' | 'report' | 'settings'>('calendar');
  
  const [rows, setRows] = useState<StockPlanRow[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [reportDivisorRows, setReportDivisorRows] = useState<TonDivisorRow[]>([]);
  const [holidays, setHolidays] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [formDate, setFormDate] = useState<string | null | undefined>(undefined); 
  const [scheduleTarget, setScheduleTarget] = useState<any | null>(null);
  const [reconcileTarget, setReconcileTarget] = useState<any | null>(null);

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

  const loadHolidays = async () => {
    if (!effectiveCompanyId) return;
    try {
      const res = await getHolidays({ month, year, companyId: effectiveCompanyId });
      if (res.success) setHolidays(res.data);
    } catch (err) {
      console.error('Error loading holidays:', err);
    }
  };

  useEffect(() => { 
    if (effectiveCompanyId) {
      loadPlans();
      loadReportTonDivisors();
      loadHolidays();
    }
  }, [month, year, effectiveCompanyId]);

  useEffect(() => {
    const loadGroupProducts = async () => {
      try {
        const ids = companyGroupIds(effectiveCompanyId);
        const lists = await Promise.all(
          ids.length > 0 ? ids.map(id => listProducts({ companyId: id })) : [listProducts()]
        );

        const rankOf = (p: any) => {
          const cid = p.companyId ?? p.company_id;
          const idx = ids.indexOf(cid);
          return idx === -1 ? ids.length : idx;
        };
        const bySku: Record<string, any> = {};
        const noSku: any[] = [];
        const seen = new Set<number>();
        (lists as any[][]).flat().forEach(p => {
          if (seen.has(p.id)) return;
          seen.add(p.id);
          if (!p.sku) { noSku.push(p); return; }
          const existing = bySku[p.sku];
          if (!existing || rankOf(p) < rankOf(existing)) bySku[p.sku] = p;
        });

        setProducts([...Object.values(bySku), ...noSku]);
      } catch (err) {
        console.error('Error loading products:', err);
        setProducts([]);
      }
    };
    if (effectiveCompanyId) loadGroupProducts();
  }, [effectiveCompanyId]);

  const reportTonDivisorMap = useMemo(() => {
    const map: Record<number, number> = {};
    reportDivisorRows.forEach(r => { if (r.divisor) map[r.product_id] = r.divisor; });
    return map;
  }, [reportDivisorRows]);

  const productSummaries = useMemo(() => {
    const map: Record<number, ProductSummary> = {};
    rows.forEach(row => {
      // Don't double count if it's a ghost row, though ghost rows aren't in `rows` natively, 
      // they are injected in itemsByDay. `rows` is just what comes from API.
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

  // Process rows for Calendar and Side Panel
  const itemsByDay = useMemo(() => {
    const map: Record<string, StockPlanRow[]> = {};
    
    rows.forEach(row => {
      const realDate = row.display_date.slice(0, 10);
      
      // Add real item
      if (!map[realDate]) map[realDate] = [];
      map[realDate].push({ ...row, is_ghost: false });

      // Ghost Plan Logic: if it's an expectation and it has been rescheduled from its original planned date
      if (row.kind === 'expectation' && row.plan.planned_date) {
        const plannedDate = row.plan.planned_date.slice(0, 10);
        if (plannedDate !== realDate) {
          if (!map[plannedDate]) map[plannedDate] = [];
          // Inject a ghost copy
          map[plannedDate].push({ ...row, is_ghost: true });
        }
      }
    });
    
    // Sort items within each day
    Object.values(map).forEach(list => {
      list.sort((a, b) => {
        // Real plans first, ghost plans last
        if (a.is_ghost && !b.is_ghost) return 1;
        if (!a.is_ghost && b.is_ghost) return -1;
        return (a.item.product_name ?? '').localeCompare(b.item.product_name ?? '');
      });
    });

    return map;
  }, [rows]);

  const goPrevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); } else { setMonth(m => m - 1); }
  };
  const goNextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); } else { setMonth(m => m + 1); }
  };

  const handleSaveDivisorAction = async (productId: number, divisor: number | null) => {
    const effectiveFrom = `${year}-${String(month).padStart(2, '0')}-01`;
    await saveTonDivisor({ product_id: productId, divisor, user_id: currentUser?.id, effective_from: effectiveFrom });
    await loadReportTonDivisors();
  };

  const handleSaveHolidaysAction = async (dates: string[]) => {
    if (!effectiveCompanyId) return;
    await saveHolidays({
      month,
      year,
      companyId: effectiveCompanyId,
      dates,
      userId: currentUser?.id
    });
    await loadHolidays();
    alert('บันทึกวันหยุดเรียบร้อยแล้ว');
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

  const renderStatusBadge = (status: string) => {
    const meta = STATUS_META[status] ?? STATUS_META.pending;
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border ${meta.badge}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
        {meta.label}
      </span>
    );
  };

  const handleRowAction = (row: StockPlanRow) => {
    if (row.kind === 'pending') setScheduleTarget(row);
    else if (row.status === 'expected') setReconcileTarget(row);
  };

  const renderDayPanel = () => {
    if (!selectedDay) return null;
    const dayRows = itemsByDay[selectedDay] ?? [];
    
    // Group by plan ID
    const dayPlanGroups = useMemo(() => {
      const groups: Record<number, { plan: any; rows: StockPlanRow[] }> = {};
      dayRows.forEach(row => {
        if (!groups[row.plan.id]) groups[row.plan.id] = { plan: row.plan, rows: [] };
        groups[row.plan.id].rows.push(row);
      });
      return Object.values(groups);
    }, [dayRows]);

    return createPortal(
      <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] bg-white shadow-2xl z-40 flex flex-col border-l">
        <header className="flex items-center justify-between p-4 border-b bg-gray-50">
          <div>
            <h3 className="font-semibold text-gray-800">{selectedDay}</h3>
            <p className="text-xs text-gray-500">รายการแพลน/คาดว่าจะเข้าของวันนี้</p>
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
                  <div key={i} className={`p-3 ${row.is_ghost ? 'opacity-50 bg-gray-50' : ''}`}>
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <span className="font-medium text-sm">
                        {row.is_ghost && <span className="text-orange-500 text-xs mr-1">👻 (เลื่อนไป {row.display_date.slice(0,10)})</span>}
                        {productLabel(row)}
                      </span>
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
                        {!row.is_ghost && row.status === 'expected' && (
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
          {viewMode === 'calendar' && (
            <StockPlanCalendar 
              year={year} 
              month={month} 
              itemsByDay={itemsByDay} 
              selectedDay={selectedDay}
              onDayClick={(day) => setSelectedDay(prev => prev === day ? null : day)}
              holidays={holidays}
            />
          )}
          
          {viewMode === 'report' && (
            <StockPlanReport 
              productSummaries={productSummaries}
              reportDivisorRows={reportDivisorRows}
              reportTotals={reportTotals}
            />
          )}
          
          {viewMode === 'settings' && (
            <StockPlanSettings
              productSummaries={productSummaries}
              rows={rows}
              reportDivisorRows={reportDivisorRows}
              reportTonDivisorMap={reportTonDivisorMap}
              onSaveDivisor={handleSaveDivisorAction}
              holidays={holidays}
              onSaveHolidays={handleSaveHolidaysAction}
              viewedYear={year}
              viewedMonth={month}
            />
          )}
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
