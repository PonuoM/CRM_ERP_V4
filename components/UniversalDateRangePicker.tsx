import React, { useEffect, useMemo, useState, useRef } from "react";
import { Calendar } from "lucide-react";

export interface DateRange {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
}

interface UniversalDateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  label?: string;
  buttonClassName?: string;
  placeholder?: string;
}

const formatDate = (dateString?: string) => {
  if (!dateString) return "";
  const d = new Date(dateString + "T00:00:00");
  return d.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const formatDateLocal = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const UniversalDateRangePicker: React.FC<UniversalDateRangePickerProps> = ({
  value,
  onChange,
  label,
  buttonClassName = "w-64 px-3 py-2 text-left border border-gray-300 rounded-md bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex items-center justify-between",
  placeholder = "เลือกช่วงวันที่"
}) => {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(value.start || "");
  const [end, setEnd] = useState(value.end || "");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStart(value.start || "");
    setEnd(value.end || "");
  }, [value]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (open && ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const display = useMemo(() => {
    if (!value.start && !value.end) {
      return placeholder;
    }
    if (value.start && value.end) {
      return `${formatDate(value.start)} - ${formatDate(value.end)}`;
    }
    return placeholder;
  }, [value, placeholder]);

  const applyPreset = (type: string) => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (type) {
      case "all":
        setStart("");
        setEnd("");
        onChange({ start: "", end: "" });
        setOpen(false);
        return;
      case "today":
        startDate = new Date(now);
        endDate = new Date(now);
        break;
      case "yesterday":
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 1);
        endDate = new Date(startDate);
        break;
      case "thisWeek":
        const dayOfWeek = now.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        startDate = new Date(now);
        startDate.setDate(now.getDate() - daysToMonday);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        break;
      case "thisMonth":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case "lastMonth":
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case "last7Days":
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 6);
        endDate = new Date(now);
        break;
      case "last30Days":
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 29);
        endDate = new Date(now);
        break;
      default:
        return;
    }

    const newRange = {
      start: formatDateLocal(startDate),
      end: formatDateLocal(endDate),
    };
    setStart(newRange.start);
    setEnd(newRange.end);
    onChange(newRange);
    setOpen(false);
  };

  const handleApply = () => {
    onChange({ start, end });
    setOpen(false);
  };

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={buttonClassName}
      >
        <div className="flex flex-col items-start truncate overflow-hidden">
             {label && <span className="text-[10px] text-gray-400 font-medium leading-none mb-1">{label}</span>}
             <span className={(value.start || value.end) ? "text-gray-700 text-sm font-medium" : "text-gray-500 text-sm"}>
                {(!value.start && !value.end) ? "ทั้งหมด (All)" : display}
             </span>
        </div>
        <Calendar className="w-4 h-4 text-gray-400 shrink-0 ml-2" />
      </button>

      {open && (
        <div className="absolute z-50 right-0 w-80 mt-2 bg-white rounded-lg shadow-xl border border-gray-200 p-4">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">วันที่เริ่มต้น</label>
                <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">วันที่สิ้นสุด</label>
                <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500" />
              </div>
            </div>

            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-semibold text-gray-600 mb-2">เลือกช่วงเวลาด่วน:</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => applyPreset("all")} className="px-2 py-2 text-xs rounded-md bg-green-50 text-green-700 hover:bg-green-100 flex items-center shadow-sm border border-green-100 transition-colors">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span> ทั้งหมด
                </button>
                <button onClick={() => applyPreset("today")} className="px-2 py-2 text-xs rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 flex items-center shadow-sm border border-blue-100 transition-colors">
                  <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span> วันนี้
                </button>
                <button onClick={() => applyPreset("yesterday")} className="px-2 py-2 text-xs rounded-md bg-orange-50 text-orange-700 hover:bg-orange-100 flex items-center shadow-sm border border-orange-100 transition-colors">
                  <span className="w-2 h-2 bg-orange-500 rounded-full mr-2"></span> เมื่อวาน
                </button>
                <button onClick={() => applyPreset("thisWeek")} className="px-2 py-2 text-xs rounded-md bg-gray-50 text-gray-700 hover:bg-gray-100 flex items-center shadow-sm border border-gray-200 transition-colors">
                  <span className="w-2 h-2 bg-gray-500 rounded-full mr-2"></span> อาทิตย์นี้
                </button>
                <button onClick={() => applyPreset("thisMonth")} className="px-2 py-2 text-xs rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex items-center shadow-sm border border-emerald-100 transition-colors">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full mr-2"></span> เดือนนี้
                </button>
                <button onClick={() => applyPreset("lastMonth")} className="px-2 py-2 text-xs rounded-md bg-purple-50 text-purple-700 hover:bg-purple-100 flex items-center shadow-sm border border-purple-100 transition-colors">
                  <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span> เดือนที่แล้ว
                </button>
                <button onClick={() => applyPreset("last7Days")} className="px-2 py-2 text-xs rounded-md bg-yellow-50 text-yellow-700 hover:bg-yellow-100 flex items-center shadow-sm border border-yellow-100 transition-colors">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span> 7 วันล่าสุด
                </button>
                <button onClick={() => applyPreset("last30Days")} className="px-2 py-2 text-xs rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 flex items-center shadow-sm border border-indigo-100 transition-colors">
                  <span className="w-2 h-2 bg-indigo-500 rounded-full mr-2"></span> 30 วันล่าสุด
                </button>
              </div>
            </div>

            <div className="flex justify-end mt-4 pt-3 border-t border-gray-100">
              <button
                onClick={handleApply}
                className="w-full px-4 py-2 bg-blue-600 text-white font-medium text-sm rounded-md shadow hover:bg-blue-700 transition duration-150"
              >
                ตกลง
              </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default UniversalDateRangePicker;
