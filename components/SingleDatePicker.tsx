import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface SingleDatePickerProps {
  value: string; // YYYY-MM-DD or ''
  onChange: (date: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const toYMD = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const SingleDatePicker: React.FC<SingleDatePickerProps> = ({ value, onChange, placeholder = 'เลือกวันที่', disabled, className }) => {
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00');
      return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  });
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

  // Reset visible month when opening
  useEffect(() => {
    if (open && value) {
      const d = new Date(value + 'T00:00:00');
      setVisibleMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    } else if (open) {
      setVisibleMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    }
  }, [open]);

  const selectedDate = useMemo(() => {
    if (!value) return null;
    const d = new Date(value + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d;
  }, [value]);

  const display = useMemo(() => {
    if (!value || !selectedDate) return placeholder;
    return selectedDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  }, [value, selectedDate, placeholder]);

  // Render month calendar
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
            const isSelected = selectedDate && isSameDay(d, selectedDate);

            let tone = isCurrMonth ? 'text-gray-800 hover:bg-gray-100' : 'text-gray-300';
            if (isSelected) tone = 'bg-blue-600 text-white font-semibold shadow-sm';

            return (
              <div
                key={idx}
                className={`text-[13px] text-center py-1.5 rounded-md cursor-pointer select-none transition-colors ${tone} ${isToday && !isSelected ? 'ring-1 ring-blue-400' : ''}`}
                onClick={() => {
                  onChange(toYMD(d));
                  setOpen(false);
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

  // Presets
  const presets = [
    { label: 'วันนี้', fn: () => { onChange(toYMD(new Date())); setOpen(false); } },
    { label: 'พรุ่งนี้', fn: () => { const d = new Date(); d.setDate(d.getDate() + 1); onChange(toYMD(d)); setOpen(false); } },
    { label: 'ต้นเดือนนี้', fn: () => { const d = new Date(); onChange(toYMD(new Date(d.getFullYear(), d.getMonth(), 1))); setOpen(false); } },
    { label: 'สิ้นเดือนนี้', fn: () => { const d = new Date(); onChange(toYMD(new Date(d.getFullYear(), d.getMonth() + 1, 0))); setOpen(false); } },
    { label: 'ต้นเดือนหน้า', fn: () => { const d = new Date(); onChange(toYMD(new Date(d.getFullYear(), d.getMonth() + 1, 1))); setOpen(false); } },
  ];

  return (
    <div className={`relative ${className || ''}`} ref={ref}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        className={`border border-gray-200 rounded-lg px-3 py-2 text-sm flex items-center gap-2 bg-white hover:border-gray-300 transition-colors shadow-sm w-full ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <Calendar className="w-4 h-4 text-blue-500 flex-shrink-0" />
        <span className={`${value ? 'text-gray-700' : 'text-gray-400'} truncate`}>{display}</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-[9999] bg-white rounded-xl shadow-xl border border-gray-200 p-4 w-auto" style={{ minWidth: '320px' }}>
          {/* Presets */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            {presets.map(p => (
              <button
                key={p.label}
                onClick={p.fn}
                className="px-2.5 py-1 text-xs rounded-md border border-gray-200 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors text-gray-600"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mb-2">
            <button type="button" className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}>
              <ChevronLeft className="w-4 h-4 text-gray-500" />
            </button>
            <div className="text-xs text-gray-400 font-medium">เลือกวันที่</div>
            <button type="button" className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}>
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          {/* Calendar */}
          <div className="flex justify-center">
            {renderMonth(visibleMonth)}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-100">
            <span className="text-xs text-gray-500">
              <span className="text-gray-400">เลือก:</span>{' '}
              <span className="font-medium text-gray-700">
                {selectedDate ? selectedDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
              </span>
            </span>
            {value && (
              <button
                type="button"
                className="px-3 py-1 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500 transition-colors"
                onClick={() => { onChange(''); setOpen(false); }}
              >
                ล้าง
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SingleDatePicker;
