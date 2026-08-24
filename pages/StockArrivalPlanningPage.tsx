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
  Pencil,
  PackageCheck,
  CalendarPlus,
  X,
  Download,
} from 'lucide-react';
import { User, UserRole } from '@/types';
import {
  listStockPlans,
  listProducts,
  deleteStockPlan,
  listTonDivisors,
  saveTonDivisor,
  listFactoryHolidays,
  listStockPlanProducts,
  listStockPlanNotes,
  addStockPlanNote,
  deleteStockPlanNote,
  getStockPlanAccess,
} from '@/services/api';
import StockPlanFormModal from '@/components/StockPlanFormModal';
import StockPlanScheduleModal from '@/components/StockPlanScheduleModal';
import StockPlanReconcileModal from '@/components/StockPlanReconcileModal';
import StockPlanExpectationEditModal from '@/components/StockPlanExpectationEditModal';

import { StockPlanRow, StockPlanExpectation, ProductSummary, TonDivisorRow, StockPlanNote, StockPlanAccess, STATUS_META, rowStatus, shortStamp, movedFromLabel } from '@/components/StockArrivalPlanning/types';
import StockPlanCalendar from '@/components/StockArrivalPlanning/StockPlanCalendar';
import { MONTH_NAMES_TH } from '@/components/StockArrivalPlanning/calendarGrid';
import { exportStockPlanExcel } from '@/components/StockArrivalPlanning/exportStockPlanExcel';
import StockPlanReport from '@/components/StockArrivalPlanning/StockPlanReport';
import StockPlanSettings from '@/components/StockArrivalPlanning/StockPlanSettings';
import StockPlanNotes from '@/components/StockArrivalPlanning/StockPlanNotes';

interface StockArrivalPlanningPageProps {
  currentUser?: User;
  companyId?: number;
}

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
  const [notes, setNotes] = useState<StockPlanNote[]>([]);
  const [access, setAccess] = useState<StockPlanAccess>({ can_manage: false, can_grant: false, is_super_admin: false });

  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [formDate, setFormDate] = useState<string | null | undefined>(undefined);
  const [editPlanId, setEditPlanId] = useState<number | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<any | null>(null);
  const [reconcileTarget, setReconcileTarget] = useState<any | null>(null);
  const [editExpectation, setEditExpectation] = useState<StockPlanExpectation | null>(null);

  const isSuperAdmin = currentUser?.role === UserRole.SuperAdmin;
  const effectiveCompanyId = companyId ?? currentUser?.companyId;
  // สิทธิ์เพิ่ม/ลบแพลน + เพิ่มหมายเหตุ — ตอบจากเซิร์ฟเวอร์ (role สูง หรือได้รับสิทธิ์รายบัญชี)
  const canManage = access.can_manage;

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

  const loadNotes = async () => {
    try {
      const res = await listStockPlanNotes({ month, year, companyId: effectiveCompanyId });
      setNotes(res?.data ?? []);
    } catch (err) {
      console.error('Error loading plan notes:', err);
    }
  };

  const loadHolidays = async () => {
    try {
      const res = await listFactoryHolidays();
      if (res.data) {
        // map to string[] for calendar
        setHolidays(res.data.map((h: any) => h.holiday_date.slice(0, 10)));
      }
    } catch (err) {
      console.error('Error loading holidays:', err);
    }
  };

  useEffect(() => {
    if (effectiveCompanyId) {
      loadPlans();
      loadReportTonDivisors();
      loadHolidays();
      loadNotes();
    }
  }, [month, year, effectiveCompanyId]);

  useEffect(() => {
    const loadAccess = async () => {
      if (!currentUser?.id) {
        setAccess({ can_manage: false, can_grant: false, is_super_admin: false });
        return;
      }
      try {
        const res = await getStockPlanAccess(currentUser.id);
        const data = res?.data;
        setAccess({
          can_manage: !!data?.can_manage,
          can_grant: !!data?.can_grant,
          is_super_admin: !!data?.is_super_admin,
          role: data?.role ?? null,
        });
      } catch (err) {
        console.error('Error loading stock plan access:', err);
        // โหลดสิทธิ์ไม่ได้ = ถือว่าไม่มีสิทธิ์ (เซิร์ฟเวอร์กันซ้ำอีกชั้นอยู่แล้ว)
        setAccess({ can_manage: false, can_grant: false, is_super_admin: false });
      }
    };
    loadAccess();
  }, [currentUser?.id]);

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const res = await listStockPlanProducts();
        setProducts(res?.data ?? []);
      } catch (err) {
        console.error('Error loading plan product catalog:', err);
        setProducts([]);
      }
    };
    if (effectiveCompanyId) loadCatalog();
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

  // Process rows for Calendar and Side Panel.
  // Each row lands on exactly one day — the day it is actually expected/arrived on. A rescheduled
  // item used to also render a faded "ghost" copy back on its original planned date, which read as
  // a second, still-pending arrival; the origin is now shown as a label on the row itself instead.
  const itemsByDay = useMemo(() => {
    const map: Record<string, StockPlanRow[]> = {};

    rows.forEach(row => {
      const realDate = row.display_date.slice(0, 10);
      if (!map[realDate]) map[realDate] = [];
      map[realDate].push(row);
    });

    Object.values(map).forEach(list => {
      list.sort((a, b) => (a.item.product_name ?? '').localeCompare(b.item.product_name ?? '', 'th'));
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

  const handleDeletePlan = async (planId: number) => {
    if (!confirm('ต้องการลบแพลนนี้ใช่หรือไม่? (ใช้สำหรับกรณีฉุกเฉินเท่านั้น)')) return;
    try {
      // force = ข้ามด่าน "ห้ามลบแพลนที่ยืนยันรับเข้าแล้ว" -- Super Admin เท่านั้น (เซิร์ฟเวอร์บังคับซ้ำ)
      await deleteStockPlan(planId, isSuperAdmin, currentUser?.id);
      setSelectedDay(null);
      loadPlans();
      loadNotes();
    } catch (err: any) {
      alert(err?.data?.error || err?.message || 'ลบไม่สำเร็จ');
    }
  };

  const notesByPlan = useMemo(() => {
    const map: Record<number, StockPlanNote[]> = {};
    notes.forEach(n => {
      if (!map[n.plan_id]) map[n.plan_id] = [];
      map[n.plan_id].push(n);
    });
    return map;
  }, [notes]);

  const handleAddNote = async (planId: number, note: string) => {
    await addStockPlanNote({ plan_id: planId, note, user_id: currentUser?.id });
    await loadNotes();
  };

  const handleDeleteNote = async (noteId: number) => {
    await deleteStockPlanNote(noteId, currentUser?.id);
    await loadNotes();
  };

  // Export ปฏิทินทั้งเดือนเป็น Excel — ชีต "ปฏิทิน" แสดงครบทุกรายการของแต่ละวัน
  // (บนหน้าจอตัดที่ 5 รายการแล้วขึ้น "+N เพิ่มเติม" เพราะช่องมีพื้นที่จำกัด ในไฟล์ไม่ตัด)
  const exportToExcel = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await exportStockPlanExcel({ year, month, itemsByDay, rows, productSummaries, holidays });
    } catch (err) {
      console.error('Error exporting stock plan:', err);
      alert('Export ไม่สำเร็จ');
    } finally {
      setExporting(false);
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

  // Move dayPlanGroups outside to follow Rules of Hooks
  const dayRows = selectedDay ? (itemsByDay[selectedDay] ?? []) : [];
  const dayPlanGroups = useMemo(() => {
    const groups: Record<number, { plan: any; rows: StockPlanRow[] }> = {};
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
          </div>
          <button onClick={() => setSelectedDay(null)} className="text-gray-400 hover:text-gray-600 rounded-full p-1 hover:bg-gray-200">
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {canManage && (
            <button
              onClick={() => setFormDate(selectedDay)}
              className="w-full bg-blue-600 text-white px-3 py-2 rounded-lg flex items-center justify-center gap-1.5 hover:bg-blue-700 text-sm font-medium"
            >
              <Plus size={16} /> เพิ่มแพลนวันนี้
            </button>
          )}

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
                {canManage && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setEditPlanId(group.plan.id)} className="text-gray-400 hover:text-blue-600" title="แก้ไขแพลน">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDeletePlan(group.plan.id)} className="text-gray-400 hover:text-red-600" title="ลบแพลน (ฉุกเฉิน)">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
              <div className="divide-y">
                {group.rows.map((row, i) => {
                  const movedFrom = movedFromLabel(row);
                  return (
                    <div key={i} className="p-3">
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <span className="font-medium text-sm">{productLabel(row)}</span>
                        {renderStatusBadge(rowStatus(row))}
                      </div>
                      {movedFrom && <div className="text-xs text-orange-600 mb-1">{movedFrom}</div>}
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
                          {row.status === 'expected' && (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <button
                                onClick={() => handleRowAction(row)}
                                className="text-blue-600 hover:text-blue-800 text-xs font-medium flex items-center gap-1 border border-blue-200 rounded-lg px-2 py-1 hover:bg-blue-50"
                              >
                                <PackageCheck size={14} /> ยืนยันรับเข้า
                              </button>
                              {canManage && (
                                <button
                                  onClick={() => setEditExpectation(row)}
                                  className="text-gray-600 hover:text-gray-800 text-xs font-medium flex items-center gap-1 border border-gray-200 rounded-lg px-2 py-1 hover:bg-gray-50"
                                  title="แก้ไขวันที่ / จำนวน / เลข SO ของสินค้ารายการนี้"
                                >
                                  <Pencil size={13} /> แก้ไขรายการนี้
                                </button>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              <StockPlanNotes
                planId={group.plan.id}
                notes={notesByPlan[group.plan.id] ?? []}
                canAdd={canManage}
                currentUserId={currentUser?.id}
                isSuperAdmin={isSuperAdmin}
                onAdd={handleAddNote}
                onDelete={handleDeleteNote}
              />
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
        <div className="flex items-center gap-2">
          <button
            onClick={exportToExcel}
            disabled={exporting}
            className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-1.5 hover:bg-green-700 font-medium shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Download size={18} /> {exporting ? 'กำลัง Export...' : 'Export Excel'}
          </button>
          {canManage && (
            <button
              onClick={() => setFormDate(null)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-1.5 hover:bg-blue-700 font-medium shadow-sm"
            >
              <Plus size={18} /> เพิ่มแพลน
            </button>
          )}
        </div>
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
              currentUser={currentUser}
              productSummaries={productSummaries}
              rows={rows}
              reportDivisorRows={reportDivisorRows}
              reportTonDivisorMap={reportTonDivisorMap}
              onSaveDivisor={handleSaveDivisorAction}
              onRefreshHolidays={loadHolidays}
              viewedYear={year}
              viewedMonth={month}
              canGrantAccess={access.can_grant}
              companyId={effectiveCompanyId}
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

      {editPlanId !== null && (
        <StockPlanFormModal
          editPlanId={editPlanId}
          products={products}
          companyId={effectiveCompanyId}
          currentUser={currentUser}
          onClose={() => setEditPlanId(null)}
          onSaved={() => { setEditPlanId(null); loadPlans(); }}
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

      {editExpectation && (
        <StockPlanExpectationEditModal
          expectation={editExpectation}
          currentUser={currentUser}
          onClose={() => setEditExpectation(null)}
          onSaved={() => { setEditExpectation(null); loadPlans(); }}
        />
      )}
    </div>
  );
};

export default StockArrivalPlanningPage;
