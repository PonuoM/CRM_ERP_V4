import React, { useState, useEffect, useMemo } from 'react';
import { Settings as SettingsIcon, Save, Calendar, CheckSquare, Square, Check, Trash2, Package, CalendarDays, Plus, Edit2, X } from 'lucide-react';
import { ProductSummary, StockPlanRow, TonDivisorRow, formatTon, STATUS_META } from './types';
import { listStockPlanProducts, saveStockPlanProduct, listFactoryHolidays, saveFactoryHoliday, deleteFactoryHoliday } from '@/services/api';
import { User } from '@/types';

interface StockPlanSettingsProps {
  currentUser?: User;
  productSummaries: ProductSummary[];
  rows: StockPlanRow[];
  reportDivisorRows: TonDivisorRow[];
  reportTonDivisorMap: Record<number, number>;
  onSaveDivisor: (productId: number, divisor: number | null) => Promise<void>;
  
  onRefreshHolidays: () => void;
  viewedYear: number;
  viewedMonth: number;
}

const MONTH_NAMES_TH = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
];

const StockPlanSettings: React.FC<StockPlanSettingsProps> = ({ 
  currentUser,
  productSummaries, 
  rows, 
  reportDivisorRows, 
  reportTonDivisorMap, 
  onSaveDivisor,
  onRefreshHolidays,
  viewedYear,
  viewedMonth
}) => {
  const [settingsTab, setSettingsTab] = useState<'catalog' | 'holidays' | 'divisor'>('catalog');

  // ==================== Divisor State ====================
  const [divisorSearch, setDivisorSearch] = useState('');
  const [divisorDrafts, setDivisorDrafts] = useState<Record<number, string>>({});
  const [savingDivisorFor, setSavingDivisorFor] = useState<number | null>(null);

  // ==================== Catalog State ====================
  const [products, setProducts] = useState<any[]>([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [newProductSku, setNewProductSku] = useState('');
  const [newProductName, setNewProductName] = useState('');
  const [savingNewProduct, setSavingNewProduct] = useState(false);
  const [newProductMsg, setNewProductMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadCatalog = async () => {
    try {
      const res = await listStockPlanProducts();
      setProducts(res?.data ?? []);
    } catch (err) {
      console.error('Error loading plan product catalog:', err);
      setProducts([]);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

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

  // ==================== Holidays State ====================
  const [holidaysList, setHolidaysList] = useState<{ id: number; holiday_date: string; label: string | null }[]>([]);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayLabel, setNewHolidayLabel] = useState('');
  const [savingHoliday, setSavingHoliday] = useState(false);
  const [holidayMsg, setHolidayMsg] = useState<{ ok: boolean; text: string } | null>(null);
  
  const [editingHolidayId, setEditingHolidayId] = useState<number | null>(null);
  const [editingHolidayLabel, setEditingHolidayLabel] = useState('');

  const loadHolidays = async () => {
    try {
      const res = await listFactoryHolidays();
      setHolidaysList(res?.data ?? []);
      onRefreshHolidays(); // Inform parent to update calendar
    } catch (err) {
      console.error('Error loading factory holidays:', err);
    }
  };

  useEffect(() => {
    loadHolidays();
  }, []);

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

  const handleUpdateHoliday = async (id: number, dateStr: string) => {
    setSavingHoliday(true);
    try {
      await saveFactoryHoliday({ holiday_date: dateStr, label: editingHolidayLabel.trim() || undefined, user_id: currentUser?.id });
      setEditingHolidayId(null);
      loadHolidays();
    } catch (err) {
      alert('บันทึกไม่สำเร็จ');
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

  // Calendar toggle for holidays
  const toggleHolidayInCalendar = async (dateStr: string) => {
    const existing = holidaysList.find(h => h.holiday_date.slice(0, 10) === dateStr);
    if (existing) {
      await handleDeleteHoliday(existing.id);
    } else {
      setSavingHoliday(true);
      try {
        await saveFactoryHoliday({ holiday_date: dateStr, user_id: currentUser?.id });
        await loadHolidays();
      } catch (err) {
        alert('เกิดข้อผิดพลาดในการบันทึกวันหยุด');
      } finally {
        setSavingHoliday(false);
      }
    }
  };

  // ==================== Divisor Computation ====================
  const filtered = productSummaries.filter(p => {
    if (!divisorSearch.trim()) return true;
    const term = divisorSearch.trim().toLowerCase();
    return `${p.sku ?? ''} ${p.product_name ?? ''}`.toLowerCase().includes(term);
  });

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

  // Calendar Helpers for Holiday UI
  const calendarCells = useMemo(() => {
    const firstDayOfMonth = new Date(viewedYear, viewedMonth - 1, 1);
    const daysInMonth = new Date(viewedYear, viewedMonth, 0).getDate();
    const startWeekday = (firstDayOfMonth.getDay() + 6) % 7; // Monday=0
    
    const cells: (string | null)[] = Array(startWeekday).fill(null);
    for (let i = 1; i <= daysInMonth; i++) {
      cells.push(`${viewedYear}-${String(viewedMonth).padStart(2, '0')}-${String(i).padStart(2, '0')}`);
    }
    return cells;
  }, [viewedYear, viewedMonth]);

  const sortedHolidays = [...holidaysList].sort((a, b) => a.holiday_date.localeCompare(b.holiday_date));

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
            className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 transition-colors ${settingsTab === t.key ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {settingsTab === 'catalog' && (
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-1"><Plus size={15} /> เพิ่มสินค้าใหม่เข้าแคตตาล็อกแพลน</h3>
          <p className="text-xs text-gray-400 mb-3">สินค้าของระบบแพลนแยกจากแคตตาล็อกหลัก — ถ้ามีของที่สั่งเข้ามาแต่ไม่มีให้เลือกในฟอร์มเพิ่มแพลน เพิ่มได้ที่นี่</p>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-1"><CalendarDays size={15} /> ปฏิทินวันหยุด (คลิกเพื่อเปิด/ปิด)</h3>
            <p className="text-xs text-gray-400 mb-4">เดือน {MONTH_NAMES_TH[viewedMonth - 1]} {viewedYear + 543}</p>
            
            <div className="border rounded-lg overflow-hidden relative">
              {savingHoliday && (
                <div className="absolute inset-0 bg-white/50 z-10 flex items-center justify-center">
                  <span className="text-xs font-medium text-gray-600 bg-white px-2 py-1 rounded shadow">กำลังบันทึก...</span>
                </div>
              )}
              <div className="grid grid-cols-7 text-center text-xs font-semibold text-gray-500 bg-gray-50 border-b">
                {['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'].map(w => <div key={w} className="py-2">{w}</div>)}
              </div>
              <div className="grid grid-cols-7">
                {calendarCells.map((day, idx) => {
                  if (!day) return <div key={idx} className="aspect-square bg-gray-50/50 border-b border-r" />;
                  
                  const isHoliday = holidaysList.some(h => h.holiday_date.slice(0, 10) === day);
                  const isSunday = (idx % 7) === 6;
                  
                  return (
                    <button
                      key={idx}
                      onClick={() => toggleHolidayInCalendar(day)}
                      className={`
                        aspect-square border-b border-r relative hover:bg-gray-50 transition-colors flex items-center justify-center
                        ${isHoliday ? 'bg-red-50 hover:bg-red-100 text-red-600' : isSunday ? 'text-red-400' : 'text-gray-600'}
                      `}
                    >
                      <span className="text-sm font-medium">{Number(day.slice(8, 10))}</span>
                      {isHoliday && (
                        <Check size={14} className="absolute bottom-1 right-1 opacity-50" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-1"><Plus size={15} /> เพิ่มวันหยุด (ระบุชื่อ)</h3>
            <p className="text-xs text-gray-400 mb-3">คุณสามารถเพิ่มวันหยุดพร้อมระบุชื่อวันหยุด (เช่น วันสงกรานต์) ได้ที่นี่</p>
            
            <div className="flex flex-wrap items-center gap-2 mb-4">
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
                placeholder="ชื่อวันหยุด (ไม่บังคับ)"
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                style={{ minWidth: 160 }}
              />
              <button
                onClick={handleAddHoliday}
                disabled={savingHoliday}
                className="bg-blue-600 text-white text-sm font-medium rounded-lg px-4 py-2 hover:bg-blue-700 disabled:opacity-50"
              >
                เพิ่ม
              </button>
            </div>
            
            <div className="text-xs font-semibold text-gray-500 mb-2">วันหยุดทั้งหมด ({sortedHolidays.length} วัน)</div>
            {sortedHolidays.length === 0 ? (
              <p className="text-xs text-gray-400">ยังไม่มีวันหยุดที่ตั้งค่าไว้</p>
            ) : (
              <div className="divide-y border rounded-lg max-h-[360px] overflow-y-auto">
                {sortedHolidays.map(h => (
                  <div key={h.id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50">
                    {editingHolidayId === h.id ? (
                      <div className="flex items-center gap-2 flex-1 mr-2">
                        <span className="text-sm text-gray-700 whitespace-nowrap">{h.holiday_date.slice(0, 10).split('-').reverse().join('/')}</span>
                        <input
                          type="text"
                          value={editingHolidayLabel}
                          onChange={e => setEditingHolidayLabel(e.target.value)}
                          placeholder="ชื่อวันหยุด"
                          className="flex-1 border rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleUpdateHoliday(h.id, h.holiday_date.slice(0, 10));
                            if (e.key === 'Escape') setEditingHolidayId(null);
                          }}
                        />
                        <button onClick={() => handleUpdateHoliday(h.id, h.holiday_date.slice(0, 10))} className="text-blue-600 hover:text-blue-800 p-1" title="บันทึก">
                          <Check size={16} />
                        </button>
                        <button onClick={() => setEditingHolidayId(null)} className="text-gray-400 hover:text-gray-600 p-1" title="ยกเลิก">
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="text-sm text-gray-700">
                          {h.holiday_date.slice(0, 10).split('-').reverse().join('/')}
                          {h.label && <span className="text-gray-400 text-xs ml-2">({h.label})</span>}
                        </div>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => {
                              setEditingHolidayId(h.id);
                              setEditingHolidayLabel(h.label || '');
                            }} 
                            className="text-gray-400 hover:text-blue-600 p-1" 
                            title="แก้ไขชื่อวันหยุด"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDeleteHoliday(h.id)} className="text-gray-400 hover:text-red-600 p-1" title="ลบวันหยุด">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {settingsTab === 'divisor' && (
        <div className="bg-white rounded-xl border shadow-sm">
          <div className="p-4 border-b space-y-1">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><SettingsIcon size={15} /> ตั้งค่าตัวหารตัน (สินค้า ÷ ตัวเลข = ตัน)</h3>
            <p className="text-xs text-gray-400">ตัวหารที่ตั้งค่าจะถูกใช้คำนวณน้ำหนักสำหรับเดือน {MONTH_NAMES_TH[viewedMonth - 1]} {viewedYear + 543} เป็นต้นไป</p>
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
                <div key={p.product_id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-800 truncate font-medium">{p.sku ? `${p.sku} - ` : ''}{p.product_name ?? p.product_id}</div>
                    <div className="text-[11px] text-gray-400 truncate mt-0.5">
                      {arrivals.map(arrivalSummaryText).join('  ·  ')}
                    </div>
                  </div>
                  <div className="shrink-0 text-xs text-gray-500 w-24 text-right pr-2">
                    {ton !== null ? <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{ton} ตัน</span> : <span className="text-gray-300">ไม่ได้ตั้งค่า</span>}
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
                    className="shrink-0 border rounded-lg px-2 py-1.5 text-sm text-right w-20 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <button
                    onClick={async () => {
                      const raw = divisorDrafts[p.product_id];
                      const value = raw === undefined ? null : (raw.trim() === '' ? null : parseFloat(raw));
                      setSavingDivisorFor(p.product_id);
                      try {
                        await onSaveDivisor(p.product_id, value);
                        setDivisorDrafts(prev => { const next = { ...prev }; delete next[p.product_id]; return next; });
                      } catch (err) {
                        alert('บันทึกไม่สำเร็จ');
                      } finally {
                        setSavingDivisorFor(null);
                      }
                    }}
                    disabled={!isDirty || savingDivisorFor === p.product_id}
                    className={`shrink-0 p-1.5 rounded-lg transition-colors flex items-center justify-center
                      ${isDirty 
                        ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm' 
                        : 'text-gray-300 bg-gray-50 cursor-not-allowed'
                      }`}
                    title="บันทึก"
                  >
                    {savingDivisorFor === p.product_id ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Save size={16} />
                    )}
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

export default StockPlanSettings;
