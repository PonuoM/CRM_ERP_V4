import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';

export interface DateRange {
  start: string; // ISO
  end: string;   // ISO
}

interface DateRangePickerProps {
  value: DateRange;
  onApply: (range: DateRange) => void;
}

const pad = (n: number) => String(n).padStart(2, '0');
const toLocalInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmtDisplay = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const DateRangePicker: React.FC<DateRangePickerProps> = ({ value, onApply }) => {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState<string>(toLocalInput(new Date(value.start)));
  const [end, setEnd] = useState<string>(toLocalInput(new Date(value.end)));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => { if (open && ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  useEffect(() => {
    setStart(toLocalInput(new Date(value.start)));
    setEnd(toLocalInput(new Date(value.end)));
  }, [value.start, value.end]);

  const display = useMemo(() => `${fmtDisplay(value.start)}  —  ${fmtDisplay(value.end)}`, [value]);

  const applyPreset = (days: number) => {
    const e = new Date();
    e.setSeconds(59, 0);
    const s = new Date(e);
    s.setDate(s.getDate() - (days - 1));
    s.setHours(0,0,0,0);
    setStart(toLocalInput(s));
    setEnd(toLocalInput(e));
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
                const s = new Date(start);
                const e = new Date(end);
                onApply({ start: s.toISOString(), end: e.toISOString() });
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

