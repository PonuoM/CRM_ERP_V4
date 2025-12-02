import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';
import { toLocalDatetimeString, fromLocalDatetimeString, formatThaiDateTime } from '../utils/datetime';

export interface DateRange {
  start: string; // ISO
  end: string;   // ISO
}

interface DateRangePickerProps {
  value: DateRange;
  onApply: (range: DateRange) => void;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({ value, onApply }) => {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState<string>(toLocalDatetimeString(value.start));
  const [end, setEnd] = useState<string>(toLocalDatetimeString(value.end));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => { if (open && ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  useEffect(() => {
    setStart(toLocalDatetimeString(value.start));
    setEnd(toLocalDatetimeString(value.end));
  }, [value.start, value.end]);

  const display = useMemo(() => `${formatThaiDateTime(value.start)}  —  ${formatThaiDateTime(value.end)}`, [value]);

  const applyPreset = (days: number) => {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);

    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);

    setStart(toLocalDatetimeString(startDate.toISOString()));
    setEnd(toLocalDatetimeString(endDate.toISOString()));
  };

  return (
    <div className="relative inline-block" ref={ref}>
      <button onClick={() => setOpen(o => !o)} className="border rounded-md px-3 py-2 text-sm flex items-center gap-2 bg-white">
        <Calendar className="w-4 h-4 text-gray-500" />
        <span className="text-gray-700">{display}</span>
      </button>

      {open && (
        <div className="absolute z-50 mt-2 bg-white rounded-lg shadow-lg border p-4 w-[680px]">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500">เริ่ม</label>
              <input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} className="w-full border rounded-md px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">สิ้นสุด</label>
              <input type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} className="w-full border rounded-md px-2 py-1.5 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 mt-4 text-xs">
            <button onClick={() => applyPreset(1)} className="border rounded px-2 py-1 hover:bg-gray-50">วันนี้</button>
            <button onClick={() => applyPreset(2)} className="border rounded px-2 py-1 hover:bg-gray-50">เมื่อวาน</button>
            <button onClick={() => applyPreset(7)} className="border rounded px-2 py-1 hover:bg-gray-50">7 วันย้อนหลัง</button>
            <button onClick={() => applyPreset(30)} className="border rounded px-2 py-1 hover:bg-gray-50">30 วันย้อนหลัง</button>
            <button onClick={() => applyPreset(60)} className="border rounded px-2 py-1 hover:bg-gray-50">60 วันย้อนหลัง</button>
            <button onClick={() => applyPreset(90)} className="border rounded px-2 py-1 hover:bg-gray-50">90 วันย้อนหลัง</button>
          </div>
          <div className="flex justify-end mt-3">
            <button
              onClick={() => {
                // Convert local datetime-local values to ISO strings while preserving local time
                const startISO = fromLocalDatetimeString(start);
                const endISO = fromLocalDatetimeString(end);
                onApply({ start: startISO, end: endISO });
                setOpen(false);
              }}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
            >OK</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;

