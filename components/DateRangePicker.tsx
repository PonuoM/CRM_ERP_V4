import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatThaiDateTime } from '../utils/datetime';

export interface DateRange {
  start: string; // ISO
  end: string;   // ISO
}

interface DateRangePickerProps {
  value: DateRange;
  onApply?: (range: DateRange) => void;
  onChange?: (range: DateRange) => void;
  placeholder?: string;
}

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const inBetween = (d: Date, s: Date | null, e: Date | null) =>
  s && e ? d.getTime() >= s.getTime() && d.getTime() <= e.getTime() : false;

const DateRangePicker: React.FC<DateRangePickerProps> = ({ value, onApply, onChange, placeholder = 'ทั้งหมด' }) => {
  const [open, setOpen] = useState(false);
  const [rangeTempStart, setRangeTempStart] = useState<Date | null>(null);
  const [rangeTempEnd, setRangeTempEnd] = useState<Date | null>(null);
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => {
    const d = value.end ? new Date(value.end) : new Date();
    if (isNaN(d.getTime())) {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), 1);
    }
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [alignRight, setAlignRight] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Close on click outside
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (open && ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  // Sync temp dates when popover opens
  useEffect(() => {
    if (open) {
      const s = value.start ? new Date(value.start) : null;
      const e = value.end ? new Date(value.end) : null;
      
      const safeS = s && !isNaN(s.getTime()) ? s : null;
      const safeE = e && !isNaN(e.getTime()) ? e : null;
      
      setRangeTempStart(safeS ? new Date(safeS.getFullYear(), safeS.getMonth(), safeS.getDate()) : null);
      setRangeTempEnd(safeE ? new Date(safeE.getFullYear(), safeE.getMonth(), safeE.getDate()) : null);
      
      const vMonth = safeE || safeS || new Date();
      setVisibleMonth(new Date(vMonth.getFullYear(), vMonth.getMonth(), 1));
      // Check if popup would overflow right edge
      if (btnRef.current) {
        const rect = btnRef.current.getBoundingClientRect();
        setAlignRight(rect.left + 660 > window.innerWidth);
      }
    }
  }, [open]);

  const display = useMemo(
    () => {
      if (!value.start && !value.end) return placeholder;
      const startStr = value.start ? formatThaiDateTime(value.start).split(' ')[0] : '...';
      const endStr = value.end ? formatThaiDateTime(value.end).split(' ')[0] : '...';
      return `${startStr}  —  ${endStr}`;
    },
    [value, placeholder]
  );

  // Preset helpers
  const applyPreset = (days: number) => {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);
    setRangeTempStart(new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()));
    setRangeTempEnd(new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()));
  };

  const applyThisMonth = () => {
    const now = new Date();
    setRangeTempStart(new Date(now.getFullYear(), now.getMonth(), 1));
    setRangeTempEnd(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  };

  const applyLastMonth = () => {
    const now = new Date();
    setRangeTempStart(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    setRangeTempEnd(new Date(now.getFullYear(), now.getMonth(), 0));
  };

  // Render a single month calendar grid
  const renderMonth = (monthStart: Date) => {
    const firstDay = new Date(monthStart.getFullYear(), monthStart.getMonth(), 1);
    const startWeekDay = firstDay.getDay();
    const gridStart = new Date(firstDay);
    gridStart.setDate(firstDay.getDate() - startWeekDay);
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      days.push(d);
    }
    const monthLabel = firstDay.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
    const weekDays = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

    return (
      <div className="w-[280px]">
        <div className="text-sm font-semibold text-gray-700 text-center mb-2">{monthLabel}</div>
        <div className="grid grid-cols-7 gap-0.5 text-[11px] text-gray-400 mb-1 font-medium">
          {weekDays.map(d => <div key={d} className="text-center py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {days.map((d, idx) => {
            const isCurrMonth = d.getMonth() === monthStart.getMonth();
            const isToday = isSameDay(d, new Date());
            const selectedStart = rangeTempStart && isSameDay(d, rangeTempStart);
            const selectedEnd = rangeTempEnd && isSameDay(d, rangeTempEnd);
            const between = inBetween(d, rangeTempStart, rangeTempEnd) && !selectedStart && !selectedEnd;

            let tone = isCurrMonth ? 'text-gray-800 hover:bg-gray-100' : 'text-gray-300';
            if (selectedStart || selectedEnd) tone = 'bg-blue-600 text-white font-semibold shadow-sm';
            else if (between) tone = 'bg-blue-50 text-blue-700';

            return (
              <div
                key={idx}
                className={`text-[13px] text-center py-1.5 rounded-md cursor-pointer select-none transition-colors ${tone} ${isToday && !selectedStart && !selectedEnd && !between ? 'ring-1 ring-blue-400' : ''}`}
                onClick={() => {
                  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                  if (!rangeTempStart || (rangeTempStart && rangeTempEnd)) {
                    setRangeTempStart(day);
                    setRangeTempEnd(null);
                    return;
                  }
                  if (day.getTime() < rangeTempStart.getTime()) {
                    setRangeTempEnd(rangeTempStart);
                    setRangeTempStart(day);
                  } else {
                    setRangeTempEnd(day);
                  }
                }}
              >
                {d.getDate()}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const handleApply = () => {
    if (rangeTempStart === null && rangeTempEnd === null) {
      const newRange = { start: '', end: '' };
      if (onApply) onApply(newRange);
      if (onChange) onChange(newRange);
      setOpen(false);
      return;
    }

    const s = rangeTempStart ? new Date(rangeTempStart) : new Date(value.start);
    const e = rangeTempEnd ? new Date(rangeTempEnd) : (rangeTempStart ? new Date(rangeTempStart) : new Date(value.end));
    s.setHours(0, 0, 0, 0);
    e.setHours(23, 59, 59, 999);

    // Build ISO strings preserving local time (same approach as fromLocalDatetimeString)
    const toLocalISO = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const h = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      const sec = String(d.getSeconds()).padStart(2, '0');
      return `${y}-${m}-${day}T${h}:${min}:${sec}`;
    };

    const newRange = { start: toLocalISO(s), end: toLocalISO(e) };
    if (onApply) onApply(newRange);
    if (onChange) onChange(newRange);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        ref={btnRef}
        onClick={() => setOpen(o => !o)}
        className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex items-center gap-2 bg-white hover:border-gray-300 transition-colors shadow-sm"
      >
        <Calendar className="w-4 h-4 text-blue-500" />
        <span className="text-gray-700">{display}</span>
      </button>

      {open && (
        <div className={`absolute top-full mt-1 z-[9999] bg-white rounded-xl shadow-xl border border-gray-200 p-5 w-auto ${alignRight ? 'right-0' : 'left-0'}`} style={{ minWidth: '640px' }}>
          {/* Preset Buttons */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {[
              { label: 'ทั้งหมด', fn: () => { setRangeTempStart(null); setRangeTempEnd(null); } },
              { label: 'วันนี้', fn: () => applyPreset(1) },
              { label: 'เมื่อวาน', fn: () => applyPreset(2) },
              { label: '7 วัน', fn: () => applyPreset(7) },
              { label: '30 วัน', fn: () => applyPreset(30) },
              { label: '60 วัน', fn: () => applyPreset(60) },
              { label: '90 วัน', fn: () => applyPreset(90) },
              { label: 'เดือนนี้', fn: applyThisMonth },
              { label: 'เดือนที่แล้ว', fn: applyLastMonth },
            ].map(p => (
              <button
                key={p.label}
                onClick={p.fn}
                className="px-2.5 py-1 text-xs rounded-md border border-gray-200 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors text-gray-600"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-3">
            <button className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}>
              <ChevronLeft className="w-4 h-4 text-gray-500" />
            </button>
            <div className="text-xs text-gray-400 font-medium">เลือกช่วงวันที่</div>
            <button className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}>
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Two-Month Calendar Grid */}
          <div className="flex gap-6 justify-center">
            {renderMonth(new Date(visibleMonth))}
            {renderMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
            <div className="text-xs text-gray-500 flex items-center gap-3">
              <span>
                <span className="text-gray-400">เริ่ม:</span>{' '}
                <span className="font-medium text-gray-700">{rangeTempStart ? rangeTempStart.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : 'ทั้งหมด'}</span>
              </span>
              <span className="text-gray-300">→</span>
              <span>
                <span className="text-gray-400">สิ้นสุด:</span>{' '}
                <span className="font-medium text-gray-700">{rangeTempEnd ? rangeTempEnd.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : 'ทั้งหมด'}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500 transition-colors"
                onClick={() => { setRangeTempStart(null); setRangeTempEnd(null); }}
              >
                ล้าง
              </button>
              <button
                className="px-4 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors shadow-sm"
                disabled={rangeTempStart !== null && rangeTempEnd === null}
                onClick={handleApply}
              >
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;
