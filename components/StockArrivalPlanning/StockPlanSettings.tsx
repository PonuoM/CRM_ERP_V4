import React, { useState } from 'react';
import { Settings as SettingsIcon, Save, Calendar, CheckSquare, Square, Check, Trash2 } from 'lucide-react';
import { ProductSummary, StockPlanRow, TonDivisorRow, formatTon, STATUS_META } from './types';

interface StockPlanSettingsProps {
  productSummaries: ProductSummary[];
  rows: StockPlanRow[];
  reportDivisorRows: TonDivisorRow[];
  reportTonDivisorMap: Record<number, number>;
  onSaveDivisor: (productId: number, divisor: number | null) => Promise<void>;
  
  // Holidays
  holidays: string[]; // YYYY-MM-DD format
  onSaveHolidays: (dates: string[]) => Promise<void>;
  viewedYear: number;
  viewedMonth: number;
}

const StockPlanSettings: React.FC<StockPlanSettingsProps> = ({ 
  productSummaries, 
  rows, 
  reportTonDivisorMap, 
  onSaveDivisor,
  holidays,
  onSaveHolidays,
  viewedYear,
  viewedMonth
}) => {
  const [divisorSearch, setDivisorSearch] = useState('');
  const [divisorDrafts, setDivisorDrafts] = useState<Record<number, string>>({});
  const [savingDivisorFor, setSavingDivisorFor] = useState<number | null>(null);
  
  const [holidayDrafts, setHolidayDrafts] = useState<Set<string>>(new Set(holidays));
  const [isSavingHolidays, setIsSavingHolidays] = useState(false);

  // Sync draft when holidays prop changes
  React.useEffect(() => {
    setHolidayDrafts(new Set(holidays));
  }, [holidays]);

  const handleSaveDivisorClick = async (productId: number) => {
    const raw = divisorDrafts[productId];
    const value = raw === undefined ? null : (raw.trim() === '' ? null : parseFloat(raw));
    setSavingDivisorFor(productId);
    try {
      await onSaveDivisor(productId, value);
      setDivisorDrafts(prev => { const next = { ...prev }; delete next[productId]; return next; });
    } finally {
      setSavingDivisorFor(null);
    }
  };

  const rowsByProduct = React.useMemo(() => {
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

  const filtered = productSummaries.filter(p => {
    if (!divisorSearch.trim()) return true;
    const term = divisorSearch.trim().toLowerCase();
    return `${p.sku ?? ''} ${p.product_name ?? ''}`.toLowerCase().includes(term);
  });

  // Holiday Calendar Logic
  const daysInMonth = new Date(viewedYear, viewedMonth, 0).getDate();
  const firstDayOfWeek = new Date(viewedYear, viewedMonth - 1, 1).getDay();
  // Adjust to Monday = 0, Sunday = 6
  const startWeekday = (firstDayOfWeek + 6) % 7;
  
  const calendarCells: (string | null)[] = [];
  for (let i = 0; i < startWeekday; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(viewedMonth).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    calendarCells.push(`${viewedYear}-${mm}-${dd}`);
  }
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  const toggleHoliday = (dateStr: string) => {
    const next = new Set(holidayDrafts);
    if (next.has(dateStr)) next.delete(dateStr);
    else next.add(dateStr);
    setHolidayDrafts(next);
  };

  const toggleDayOfWeek = (dayIndex: number) => { // 0 = Mon, 6 = Sun
    let allSelected = true;
    const datesToToggle: string[] = [];
    
    for (let i = 0; i < calendarCells.length; i++) {
      if (i % 7 === dayIndex && calendarCells[i]) {
        datesToToggle.push(calendarCells[i]!);
        if (!holidayDrafts.has(calendarCells[i]!)) {
          allSelected = false;
        }
      }
    }

    const next = new Set(holidayDrafts);
    datesToToggle.forEach(dateStr => {
      if (allSelected) {
        next.delete(dateStr);
      } else {
        next.add(dateStr);
      }
    });
    setHolidayDrafts(next);
  };

  const selectWholeMonth = () => {
    const next = new Set<string>();
    calendarCells.forEach(c => { if (c) next.add(c); });
    setHolidayDrafts(next);
  };

  const clearHolidays = () => setHolidayDrafts(new Set());

  const handleSaveHolidays = async () => {
    setIsSavingHolidays(true);
    try {
      await onSaveHolidays(Array.from(holidayDrafts));
    } finally {
      setIsSavingHolidays(false);
    }
  };

  const isHolidaysChanged = holidays.length !== holidayDrafts.size || holidays.some(h => !holidayDrafts.has(h));

  return (
    <div className="space-y-4">
      {/* Holidays Settings */}
      <div className="bg-white rounded-xl border shadow-sm p-4">
        <div className="flex items-center justify-between border-b pb-3 mb-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><Calendar size={15} /> กำหนดวันหยุดประจำเดือน</h3>
            <p className="text-xs text-gray-400 mt-1">วันที่เลือกจะถูกไฮไลท์ในหน้าปฏิทิน</p>
          </div>
          <button 
            onClick={handleSaveHolidays}
            disabled={!isHolidaysChanged || isSavingHolidays}
            className={`text-sm px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium transition-colors ${
              isHolidaysChanged 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Save size={15} />
            {isSavingHolidays ? 'กำลังบันทึก...' : 'บันทึกวันหยุด'}
          </button>
        </div>
        
        <div className="flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-80 border rounded-lg overflow-hidden shrink-0">
            <div className="grid grid-cols-7 text-center text-xs font-semibold bg-gray-50 border-b">
              {['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'].map((day, i) => (
                <button 
                  key={day} 
                  className="py-2 hover:bg-gray-200 transition-colors"
                  onClick={() => toggleDayOfWeek(i)}
                  title={`เลือก/ยกเลิก ${day} ทั้งเดือน`}
                >
                  {day}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-7 text-sm">
              {calendarCells.map((day, idx) => (
                <button
                  key={idx}
                  disabled={!day}
                  onClick={() => day && toggleHoliday(day)}
                  className={`aspect-square flex items-center justify-center border-b border-r p-1 text-xs transition-colors
                    ${!day ? 'bg-gray-50/50 cursor-default' : 
                      holidayDrafts.has(day) ? 'bg-red-50 text-red-700 font-semibold border-red-200' : 'hover:bg-blue-50'}
                    ${(idx + 1) % 7 === 0 ? 'border-r-0' : ''}
                  `}
                >
                  {day ? Number(day.slice(8, 10)) : ''}
                </button>
              ))}
            </div>
          </div>
          
          <div className="space-y-3 flex-1">
            <div className="text-sm font-medium text-gray-700">เครื่องมือจัดการแบบด่วน</div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => toggleDayOfWeek(6)} className="text-xs px-3 py-1.5 border rounded-lg hover:bg-gray-50 flex items-center gap-1.5">
                วันอาทิตย์ทั้งหมด
              </button>
              <button onClick={() => toggleDayOfWeek(5)} className="text-xs px-3 py-1.5 border rounded-lg hover:bg-gray-50 flex items-center gap-1.5">
                วันเสาร์ทั้งหมด
              </button>
              <button onClick={selectWholeMonth} className="text-xs px-3 py-1.5 border rounded-lg hover:bg-gray-50 flex items-center gap-1.5">
                <CheckSquare size={14} className="text-blue-600"/> เลือกทั้งเดือน
              </button>
              <button onClick={clearHolidays} className="text-xs px-3 py-1.5 border rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 flex items-center gap-1.5 text-gray-600">
                <Trash2 size={14} /> ล้างค่าทั้งหมด
              </button>
            </div>
            <div className="mt-4 text-xs text-gray-500">
              * การกดที่หัวตาราง (จ, อ, พ, ...) จะเป็นการเลือกหรือยกเลิกการเลือกวันนั้นๆ ทั้งเดือน
            </div>
          </div>
        </div>
      </div>

      {/* Ton Divisor Settings */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="p-4 border-b space-y-1">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><SettingsIcon size={15} /> ตั้งค่าตัวหารตัน (สินค้า ÷ ตัวเลข = ตัน)</h3>
          <p className="text-xs text-gray-400">แสดงเฉพาะรุ่นที่มีคาดว่าจะเข้าในเดือนที่เลือกด้านบน — รุ่นที่เคยตั้งค่าไว้แล้วจะคำนวณยอดตันให้ทันที ถ้าเป็นรุ่นใหม่ให้กรอกตัวหารเอง การแก้ไขจะบันทึกโดยอิงจากเดือนที่กำลังดูปฏิทินอยู่</p>
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
                  onClick={() => handleSaveDivisorClick(p.product_id)}
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
    </div>
  );
};

export default StockPlanSettings;
